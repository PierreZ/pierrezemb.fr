+++
title = "Deterministic Simulation from Scratch, Stage 2: SimWorld"
description = "Determinism requires three coordinated mechanisms: seeded RNG, controlled time, and single-threaded execution."
date = 2025-12-22
draft = true
[taxonomies]
tags = ["moonpool", "rust", "simulation", "deterministic", "distributed-systems", "testing"]
+++

> This post is part of **Deterministic Simulation from Scratch**, a series about building [moonpool](https://github.com/PierreZ/moonpool), a deterministic simulation testing framework for Rust inspired by FoundationDB. Each Stage builds on the previous one. Start with [Stage 1](/posts/deterministic-simulation-from-scratch-stage-1/) or jump to any Stage: [Stage 3](/posts/deterministic-simulation-from-scratch-stage-3/), [Stage 4](/posts/deterministic-simulation-from-scratch-stage-4/).

FoundationDB compresses years of uptime into seconds of testing. How? **Logical time only advances when all futures are blocked.** No wall clocks. No OS timers. Just a priority queue of events and a single thread running them in order. Same seed, same execution, same bugs. Every time.

In [Stage 1](/posts/deterministic-simulation-from-scratch-stage-1/), we introduced `TimeProvider` and `SleepFuture`. Now let's see what happens inside `SimTimeProvider` when you call `.await` on a sleep.

## The Three Pillars of Determinism

Reproducible simulation requires three mechanisms working together:

**Seeded RNG.** Every random decision in your application flows through a seeded random number generator. Same seed produces identical decisions in the same order. When a test fails at seed 42, you rerun with seed 42 and get the exact same failure.

**Controlled time.** The simulation controls the clock. When you call `sleep(Duration::from_secs(86400))`, the simulation does not actually wait 24 hours. It advances the logical clock instantly to the wake time. Time only moves forward when all tasks are blocked waiting for events.

**Single-threaded execution.** No scheduling non-determinism. No race conditions from thread interleaving. Every task runs to completion or blocks before another task gets a turn. The order is determined by the event queue, which is deterministic.

Break any one of these and reproducibility dies. Use `std::time::Instant::now()` instead of the time provider, and your test depends on wall clock time. Use `thread_rng()` instead of the random provider, and your decisions become unpredictable. Spawn tasks on multiple threads, and the interleaving becomes non-deterministic.

The discipline is strict: **all I/O must flow through provider traits**. No exceptions.

## SimWorld Architecture

`SimWorld` is the heart of the simulation runtime. It coordinates time, randomness, and event scheduling:

```rust
pub struct SimWorld {
    pub(crate) inner: Rc<RefCell<SimInner>>,
}

impl SimWorld {
    pub fn new() -> Self;
    pub fn new_with_seed(seed: u64) -> Self;
    pub fn step(&mut self) -> bool;
    pub fn run_until_empty(&mut self);
    pub fn current_time(&self) -> Duration;
    pub fn now(&self) -> Duration;
    pub fn timer(&self) -> Duration;
    pub fn schedule_event(&self, event: Event, delay: Duration);
}
```

The internal state tracks several things. An event queue (BinaryHeap) ordered by scheduled time. A sequence number for deterministic ordering when events have the same timestamp. The current simulation time. Network state for simulated connections. A registry of wakers for blocked tasks.

The run loop is simple:

1. Poll all ready tasks until they block
2. When all tasks are waiting, find the next event in the queue
3. Advance time to that event's timestamp
4. Wake the tasks waiting for that event
5. Repeat until the event queue is empty

This loop is what compresses time. A 24-hour sleep becomes instant. The simulation only waits for real CPU time, not simulated time.

## SleepFuture and Time Control

When you call `time.sleep(duration)` with `SimTimeProvider`, you get a `SleepFuture`. Here is how it integrates with async/await:

```rust
pub struct SleepFuture {
    sim: WeakSimWorld,
    task_id: u64,
    completed: bool,
}

impl Future for SleepFuture {
    type Output = SimulationResult<()>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        match sim.is_task_awake(self.task_id) {
            Ok(true) => Poll::Ready(Ok(())),
            Ok(false) => {
                sim.register_task_waker(self.task_id, cx.waker().clone())?;
                Poll::Pending
            }
            Err(e) => Poll::Ready(Err(e)),
        }
    }
}
```

The first poll creates a timer event in the simulation's event queue. The future returns `Poll::Pending` and registers a waker. When the simulation advances time to the wake point, it calls the waker. The next poll sees `is_task_awake` return true and completes.

The beauty is in what does not happen. No OS timers. No threads blocking. No real time passing. Just a future that remembers when it should wake and a simulation that advances logical time.

Time compression makes impossible tests possible. Testing a 30-day leader election timeout? Run it in milliseconds. Testing retry logic with exponential backoff to 24 hours? Instant. Testing clock drift between nodes over months of operation? Seconds.

## Deterministic RNG Functions

All randomness flows through thread-local seeded state:

```rust
pub fn set_sim_seed(seed: u64);
pub fn get_current_sim_seed() -> u64;
pub fn sim_random<T: SampleUniform>() -> T;
pub fn sim_random_range<T: SampleUniform>(range: Range<T>) -> T;
pub fn sample_duration(range: Range<Duration>) -> Duration;
```

The thread-local pattern ensures that each simulation run has isolated RNG state. When you set the seed at the start of a test, every call to `sim_random()` produces the same sequence.

This is why failed tests are reproducible. The seed captures the entire random state. Rerun with the same seed, and every random decision in your code happens exactly the same way. The network partition hits at the same moment. The retry delay is the same duration. The leader election tie-breaker picks the same node.

When a test fails, the seed is your time machine. It lets you replay the exact scenario that caused the failure.

## SimulationBuilder

Running simulations requires some boilerplate. `SimulationBuilder` handles setup:

```rust
SimulationBuilder::new()
    .register_workload("server", |random, network, time, tasks, topology| async {
        // Server workload
    })
    .register_workload("client", |random, network, time, tasks, topology| async {
        // Client workload
    })
    .set_iteration_control(IterationControl::UntilAllSometimesReached(1000))
    .run()
    .await;
```

The builder pattern configures several things. **Workloads** are async functions that represent different nodes in your system. Each workload gets its own IP address and access to all provider traits. **Iteration control** determines how many seeds to test. You can run a fixed count, run for a time limit, or run until all `sometimes_assert!` macros have fired (more on that in Stage 3).

`WorkloadTopology` gives each workload information about its peers. The server workload can discover client addresses. The client can discover server addresses. This mimics service discovery in a real distributed system.

Each iteration:
1. Resets the RNG with a new seed
2. Creates a fresh `SimWorld`
3. Spawns all workloads
4. Runs until completion or timeout
5. Collects metrics and assertion results

After thousands of iterations, you have explored thousands of different random paths through your code.

## The One Takeaway

SimWorld coordinates time, randomness, and execution into a deterministic universe. The seed is your replay button for bugs.

We can control time. We can make randomness reproducible. But simulation without chaos is just a fast test. In [Stage 3](/posts/deterministic-simulation-from-scratch-stage-3/), we inject failures with BUGGIFY and **prove** they actually happened.

---

Feel free to reach out with any questions or to share your experiences with deterministic simulation testing. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

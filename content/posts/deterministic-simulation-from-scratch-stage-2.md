+++
title = "Deterministic Simulation from Scratch, Stage 2: SimWorld"
description = "Logical time only advances when all futures are blocked. This single insight compresses years of uptime into seconds of testing."
date = 2025-12-22
draft = true
[taxonomies]
tags = ["moonpool", "rust", "simulation", "deterministic", "distributed-systems", "testing"]
+++

> This post is part of **Deterministic Simulation from Scratch**, a series about building [moonpool](https://github.com/PierreZ/moonpool), a deterministic simulation testing framework for Rust inspired by FoundationDB. Each Stage builds on the previous one. Start with [Stage 1](/posts/deterministic-simulation-from-scratch-stage-1/) or jump to any Stage: [Stage 3](/posts/deterministic-simulation-from-scratch-stage-3/), [Stage 4](/posts/deterministic-simulation-from-scratch-stage-4/).

The insight that unlocked everything came from studying FoundationDB's [sim2.actor.cpp](https://github.com/apple/foundationdb/blob/main/fdbrpc/sim2.actor.cpp). I had the provider traits from [Stage 1](/posts/deterministic-simulation-from-scratch-stage-1/). I understood that swapping implementations could control time and networking. But I kept wondering: how does the simulation actually advance time?

The answer was elegant. **Logical time only advances when all futures are blocked.** No wall clocks. No OS timers. Just a priority queue of events and a single thread running them in order. When you call `sleep(Duration::from_secs(86400))`, the simulation does not wait 24 hours. It instantly jumps forward to the wake time because nothing else can run until then.

This is how FoundationDB compresses years of uptime into seconds of testing. This is how moonpool does it too.

## The Three Pillars of Determinism

Reproducible simulation requires three mechanisms working together:

**Seeded RNG.** Every random decision in your application flows through a seeded random number generator. Same seed produces identical decisions in the same order. When a test fails at seed 42, you rerun with seed 42 and get the exact same failure.

**Controlled time.** The simulation controls the clock. When you call `sleep(Duration::from_secs(86400))`, the simulation does not actually wait 24 hours. It advances the logical clock instantly to the wake time. Time only moves forward when all tasks are blocked waiting for events.

**Single-threaded execution.** No scheduling non-determinism. No race conditions from thread interleaving. Every task runs to completion or blocks before another task gets a turn. The order is determined by the event queue, which is deterministic.

Break any one of these and reproducibility dies. Use `std::time::Instant::now()` instead of the time provider, and your test depends on wall clock time. Use `thread_rng()` instead of the random provider, and your decisions become unpredictable. Spawn tasks on multiple threads, and the interleaving becomes non-deterministic.

The discipline is strict: **all I/O must flow through provider traits**. No exceptions.

## SimWorld Architecture

`SimWorld` is the heart of the simulation runtime. It coordinates time, randomness, and event scheduling through an internal state holder:

```rust
pub struct SimWorld {
    pub(crate) inner: Rc<RefCell<SimInner>>,
}

pub(crate) struct SimInner {
    pub(crate) current_time: Duration,
    pub(crate) timer_time: Duration,          // Drifted timer (can be ahead)
    pub(crate) event_queue: EventQueue,
    pub(crate) next_sequence: u64,            // Deterministic ordering key
    pub(crate) network: NetworkState,
    pub(crate) wakers: WakerRegistry,
    pub(crate) next_task_id: u64,
    pub(crate) awakened_tasks: HashSet<u64>,
    pub(crate) events_processed: u64,
    pub(crate) last_bit_flip_time: Duration,  // Chaos tracking
}
```

The split between `SimWorld` and `SimInner` enables handle-based access. `SimWorld` wraps an `Rc<RefCell<>>` so multiple components can share access to the simulation state without circular reference issues. The `WeakSimWorld` type provides weak references for components that should not prevent cleanup.

Two time fields might seem redundant, but they serve different purposes. `current_time` is the canonical simulation time, precise and consistent. `timer_time` can drift ahead by up to 100ms in simulation. This intentional drift tests your lease expiration logic, heartbeat timing, and leader election code. In production, both return wall clock time. In simulation, they diverge to expose timing bugs.

## The Event Loop

The question is: how does logical time advance?

```rust
pub fn step(&mut self) -> bool {
    let mut inner = self.inner.borrow_mut();

    if let Some(scheduled_event) = inner.event_queue.pop_earliest() {
        // Advance logical time to event timestamp
        inner.current_time = scheduled_event.time();

        // Clear expired clogs after time advancement
        Self::clear_expired_clogs_with_inner(&mut inner);

        // Trigger random partitions based on configuration
        Self::randomly_trigger_partitions_with_inner(&mut inner);

        // Process the event
        Self::process_event_with_inner(&mut inner, scheduled_event.into_event());

        // Return true if more events are available
        !inner.event_queue.is_empty()
    } else {
        false
    }
}
```

Each call to `step()` processes exactly one event. The simulation advances `current_time` to the event's scheduled timestamp, then processes the event. There is no sleeping. There is no waiting. Time jumps forward in discrete steps.

Here is how the pieces fit together:

```
┌─────────────────────────────────────────────────────────────────┐
│                        SIMULATION LOOP                          │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────┐     ┌───────────────────────────────────┐
│  All tasks poll   │────▶│  All return Poll::Pending         │
│  their futures    │     │  (blocked on sleep/network/etc)   │
└───────────────────┘     └───────────────────────────────────┘
        │                               │
        │                               ▼
        │                 ┌───────────────────────────────────┐
        │                 │  Pop earliest event from queue    │
        │                 │  (time=100ms, seq=42, Timer{7})   │
        │                 └───────────────────────────────────┘
        │                               │
        │                               ▼
        │                 ┌───────────────────────────────────┐
        │                 │  Advance current_time to 100ms    │
        │                 │  (instant jump, no wall time!)    │
        │                 └───────────────────────────────────┘
        │                               │
        │                               ▼
        │                 ┌───────────────────────────────────┐
        │                 │  Wake task 7's waker              │
        │                 │  awakened_tasks.insert(7)         │
        │                 └───────────────────────────────────┘
        │                               │
        ◀───────────────────────────────┘
```

The loop runs until no events remain. `run_until_empty()` calls `step()` repeatedly, with a smart optimization: it checks every 50 events whether only infrastructure events remain (like partition restoration), and terminates early if workloads have completed.

## The Sequence Number Rule

But what happens when two events are scheduled for the same instant?

In real wall-clock time, two events at the "same" time actually execute in some order determined by thread scheduling, system load, or cosmic rays. Non-deterministic. In simulation, we need a deterministic tie-breaker.

The answer is **sequence numbers**. Every scheduled event gets a monotonically increasing sequence number:

```rust
pub fn schedule_event(&self, event: Event, delay: Duration) {
    let mut inner = self.inner.borrow_mut();
    let scheduled_time = inner.current_time + delay;
    let sequence = inner.next_sequence;
    inner.next_sequence += 1;

    let scheduled_event = ScheduledEvent::new(scheduled_time, event, sequence);
    inner.event_queue.schedule(scheduled_event);
}
```

The `EventQueue` orders events by time first, then by sequence number:

```rust
impl Ord for ScheduledEvent {
    fn cmp(&self, other: &Self) -> Ordering {
        // BinaryHeap is a max heap, but we want earliest time first
        match other.time.cmp(&self.time) {
            Ordering::Equal => {
                // Same time: earlier sequence numbers first
                other.sequence.cmp(&self.sequence)
            }
            other => other,
        }
    }
}
```

The comparison is reversed because Rust's `BinaryHeap` is a max heap, but we want earliest events first (a min heap behavior).

Here is how the ordering works:

```
Event Queue (BinaryHeap as min-heap)
┌─────────────────────────────────────────────────────────────────┐
│  Events at SAME time are ordered by sequence number             │
└─────────────────────────────────────────────────────────────────┘

Schedule order:          Queue after scheduling:
  1. Timer{A} at 100ms     ┌─────────────────────────┐
  2. Timer{B} at 100ms     │ 100ms, seq=0, Timer{A} │
  3. Timer{C} at 50ms      │ 100ms, seq=1, Timer{B} │
                           │  50ms, seq=2, Timer{C} │
                           └─────────────────────────┘

Pop order: Timer{C} (50ms) → Timer{A} (100ms, seq=0) → Timer{B} (100ms, seq=1)
           ▲                 ▲
           │                 └── same time, lower sequence wins
           └── earlier time always wins
```

Same seed, same scheduling order, same sequence numbers, same execution order. Every time.

## SleepFuture and Time Control

How does the executor know when to wake a sleeping task?

When you call `time.sleep(duration)` with `SimTimeProvider`, you get a `SleepFuture`. The sleep method schedules a timer event and returns a future bound to a unique task ID:

```rust
pub fn sleep(&self, duration: Duration) -> SleepFuture {
    let task_id = self.generate_task_id();

    // Schedule a wake event for this task
    self.schedule_event(Event::Timer { task_id }, duration);

    // Return a future that will be woken when the event is processed
    SleepFuture::new(self.downgrade(), task_id)
}
```

The `SleepFuture` integrates with Rust's async/await through the `Future` trait:

```rust
impl Future for SleepFuture {
    type Output = SimulationResult<()>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        if self.completed {
            return Poll::Ready(Ok(()));
        }

        let sim = match self.sim.upgrade() {
            Ok(sim) => sim,
            Err(e) => return Poll::Ready(Err(e)),
        };

        match sim.is_task_awake(self.task_id) {
            Ok(true) => {
                self.completed = true;
                Poll::Ready(Ok(()))
            }
            Ok(false) => {
                sim.register_task_waker(self.task_id, cx.waker().clone());
                Poll::Pending
            }
            Err(e) => Poll::Ready(Err(e)),
        }
    }
}
```

Here is the complete flow:

```
time.sleep(Duration::from_secs(86400)).await    // 24 hours!
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ SimWorld::sleep(duration)                                      │
│   1. task_id = next_task_id++           // Generate unique ID  │
│   2. schedule_event(Timer{task_id}, duration)                  │
│   3. return SleepFuture { task_id, ... }                       │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ First poll of SleepFuture                                      │
│   is_task_awake(task_id)? → false                              │
│   register_task_waker(task_id, waker)                          │
│   return Poll::Pending                                         │
└───────────────────────────────────────────────────────────────┘
        │
        │  ... executor runs other tasks, all block ...
        │  ... no more runnable tasks ...
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ SimWorld::step() - Event Processing                            │
│   event = pop_earliest()     // Timer{task_id} at +86400s      │
│   current_time = 86400s      // INSTANT! No real time passes   │
│   awakened_tasks.insert(task_id)                               │
│   waker.wake()               // Tell executor to re-poll       │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ Second poll of SleepFuture                                     │
│   is_task_awake(task_id)? → true                               │
│   return Poll::Ready(Ok(()))                                   │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
    24 hours of simulated time in ~0ms of wall time
```

The beauty is in what does not happen. No OS timers. No threads blocking. No real time passing. Just a future that remembers when it should wake and a simulation that advances logical time.

## Event Loop Compression

Time compression makes impossible tests possible. Here is what it looks like in practice:

```
Real Time (wall clock):    Simulated Time (logical clock):
─────────────────────      ─────────────────────────────────

   0ms  ─┐                    0ms  ─┐
         │ step()                   │ Timer event fires
   1ms  ─┤                  100ms  ─┤
         │ step()                   │ Network event
   2ms  ─┤                  500ms  ─┤
         │ step()                   │ Timer event
   3ms  ─┤                86400s   ─┤  ◀── 24 hours!
         │ step()                   │
   4ms  ─┘               172800s   ─┘  ◀── 48 hours!

Wall time: 4ms            Simulated time: 2 days
```

Testing a 30-day leader election timeout? Run it in milliseconds. Testing retry logic with exponential backoff to 24 hours? Instant. Testing clock drift between nodes over months of operation? Seconds.

## Deterministic RNG

All randomness flows through thread-local seeded state using ChaCha8Rng:

```rust
thread_local! {
    static SIM_RNG: RefCell<ChaCha8Rng> = RefCell::new(ChaCha8Rng::seed_from_u64(0));
    static CURRENT_SEED: RefCell<u64> = const { RefCell::new(0) };
}

pub fn set_sim_seed(seed: u64) {
    SIM_RNG.with(|rng| {
        *rng.borrow_mut() = ChaCha8Rng::seed_from_u64(seed);
    });
    CURRENT_SEED.with(|current| {
        *current.borrow_mut() = seed;
    });
}

pub fn sim_random<T>() -> T
where
    StandardUniform: Distribution<T>,
{
    SIM_RNG.with(|rng| rng.borrow_mut().sample(StandardUniform))
}

pub fn sim_random_range<T>(range: Range<T>) -> T
where
    T: SampleUniform + PartialOrd,
{
    SIM_RNG.with(|rng| rng.borrow_mut().random_range(range))
}
```

The thread-local pattern ensures each simulation run has isolated RNG state. When you set the seed at the start of a test, every call to `sim_random()` produces the same sequence.

This is why failed tests are reproducible. The seed captures the entire random state. Rerun with the same seed, and every random decision in your code happens exactly the same way. The network partition hits at the same moment. The retry delay is the same duration. The leader election tie-breaker picks the same node.

When a test fails, the seed is your time machine. It lets you replay the exact scenario that caused the failure.

## SimulationBuilder

Running simulations requires configuration. `SimulationBuilder` handles the setup:

```rust
pub struct SimulationBuilder {
    iteration_control: IterationControl,
    workloads: Vec<Workload>,
    seeds: Vec<u64>,
    next_ip: u32,           // Auto-assigns IPs starting from 10.0.0.1
    use_random_config: bool,
    invariants: Vec<InvariantCheck>,
}

pub enum IterationControl {
    FixedCount(usize),                    // Run N iterations
    TimeLimit(Duration),                  // Run for X wall-clock time
    UntilAllSometimesReached(usize),      // Until all assertions hit
}
```

The builder pattern configures several things. **Workloads** are async functions that represent different nodes in your system. Each workload gets its own IP address (auto-assigned starting from 10.0.0.1) and access to all provider traits. **Iteration control** determines how many seeds to test.

```rust
SimulationBuilder::new()
    .register_workload("server", |random, network, time, tasks, topology| async move {
        // Server workload
        Ok(SimulationMetrics::default())
    })
    .register_workload("client", |random, network, time, tasks, topology| async move {
        // Client workload
        Ok(SimulationMetrics::default())
    })
    .set_iterations(1000)
    .set_debug_seeds(vec![42])  // Reproduce specific failures
    .run()
    .await;
```

The `set_debug_seeds()` method is specifically designed for debugging. When a test fails at seed 42, you can fix the code and rerun with just that seed to verify the fix.

Each iteration:
1. Resets the RNG with a new seed
2. Creates a fresh `SimWorld`
3. Spawns all workloads
4. Runs until completion or timeout
5. Collects metrics and assertion results

After thousands of iterations, you have explored thousands of different random paths through your code.

## The One Takeaway

SimWorld coordinates time, randomness, and execution into a deterministic universe. The seed is your replay button for bugs. The event loop compresses years into seconds.

We can control time. We can make randomness reproducible. But simulation without chaos is just a fast test. In [Stage 3](/posts/deterministic-simulation-from-scratch-stage-3/), we inject failures with BUGGIFY and **prove** they actually happened.

---

Feel free to reach out with any questions or to share your experiences with deterministic simulation testing. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

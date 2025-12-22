+++
title = "Deterministic Simulation from Scratch, Stage 3: BUGGIFY & Assertions"
description = "Coverage tells you lines were reached. sometimes_assert tells you interesting scenarios actually happened."
date = 2025-12-22
draft = true
[taxonomies]
tags = ["moonpool", "rust", "simulation", "deterministic", "distributed-systems", "testing"]
+++

> This post is part of **Deterministic Simulation from Scratch**, a series about building [moonpool](https://github.com/PierreZ/moonpool), a deterministic simulation testing framework for Rust inspired by FoundationDB. Each Stage builds on the previous one. Start with [Stage 1](/posts/deterministic-simulation-from-scratch-stage-1/) or jump to any Stage: [Stage 2](/posts/deterministic-simulation-from-scratch-stage-2/), [Stage 4](/posts/deterministic-simulation-from-scratch-stage-4/).

"So it just randomly breaks things?" I hear this question every time I explain deterministic simulation. No. **BUGGIFY is structured chaos.** Each fault point is enabled or disabled once per seed, then fires with fixed probability. Same seed, same faults. But here is the part nobody talks about: how do you know your chaos actually happened?

In [Stage 2](/posts/deterministic-simulation-from-scratch-stage-2/), we saw how SimWorld coordinates deterministic execution. Now we inject faults into that deterministic universe and **prove** they fired.

## The BUGGIFY Philosophy

Random testing is a treadmill. You run millions of iterations, exercising the same paths repeatedly. The deep bugs hide in rare combinations of events. Network partition AND slow disk AND coordinator crash at the exact same moment. The probability of all three aligning randomly? Astronomical. You would burn CPU-centuries waiting.

BUGGIFY solves this by **biasing** the simulation toward interesting states. It makes rare events happen more often, but deterministically. The insight comes from FoundationDB: your production code should cooperate with the simulator.

Here is how it works. Every `buggify!()` call has two phases:

**Phase 1: Activation.** When a buggify location is first evaluated for a given seed, it randomly decides whether this location is "active" for this run. Default probability: 25%. This decision is cached per location per seed.

**Phase 2: Firing.** If the location is active, each subsequent call fires with 25% probability.

The effective rate is roughly 6% per call (25% × 25%). But the key is consistency: same seed, same activation pattern. Different seeds activate different code locations. After thousands of seeds, you have exercised every BUGGIFY point from multiple angles.

## Buggify Macros

The macros are simple. The power is in how they integrate with deterministic simulation:

```rust
#[macro_export]
macro_rules! buggify {
    () => {
        $crate::chaos::buggify::buggify_internal(0.25, concat!(file!(), ":", line!()))
    };
}

#[macro_export]
macro_rules! buggify_with_prob {
    ($prob:expr) => {
        $crate::chaos::buggify::buggify_internal($prob as f64, concat!(file!(), ":", line!()))
    };
}
```

The location string (`file:line`) uniquely identifies each buggify point. Thread-local state tracks which locations are active for the current seed.

Use them to inject realistic failures:

```rust
async fn write_to_storage(&self, data: &[u8]) -> Result<(), Error> {
    // Sometimes fail writes
    if buggify!() {
        return Err(Error::DiskFull);
    }

    // Sometimes delay writes
    if buggify!() {
        self.time.sleep(Duration::from_secs(5)).await?;
    }

    self.storage.write(data).await
}
```

This code runs in production without any buggify effects. In simulation, some seeds will trigger the disk full error. Some will trigger the delay. Some will trigger both. The key: same seed always triggers the same combination.

## The Assertion Revolution

Code coverage tells you lines were reached. It does not tell you interesting scenarios happened. You could have 100% coverage while only testing the happy path.

Moonpool provides two assertion macros that go beyond coverage.

### always_assert!

Guards invariants that must **never** break:

```rust
#[macro_export]
macro_rules! always_assert {
    ($name:ident, $condition:expr, $message:expr) => {
        let result = $condition;
        if !result {
            let current_seed = $crate::sim::get_current_sim_seed();
            panic!(
                "Always assertion '{}' failed (seed: {}): {}",
                stringify!($name), current_seed, $message
            );
        }
    };
}
```

Use it for conditions that must hold regardless of chaos:

```rust
always_assert!(
    data_not_corrupted,
    verify_checksum(&data),
    "Data corruption detected after network transfer"
);
```

When it fails, the panic includes the seed. You can replay that exact execution to debug.

### sometimes_assert!

This is the innovation. It tracks whether a condition fires **both** true and false across seeds:

```rust
#[macro_export]
macro_rules! sometimes_assert {
    ($name:ident, $condition:expr, $message:expr) => {
        let result = $condition;
        $crate::chaos::assertions::record_assertion(stringify!($name), result);
    };
}
```

Use it to verify your chaos actually exercises interesting scenarios:

```rust
sometimes_assert!(
    queue_near_capacity,
    self.queue.len() >= (self.config.max_size as f64 * 0.8) as usize,
    "Queue should sometimes approach capacity"
);
```

The simulation tracks statistics per assertion: how many times it fired true, how many times false. At the end, `validate_assertion_contracts()` checks that every `sometimes_assert!` has fired both ways. If one only ever fires true (or only false), your test is not exploring the state space you think it is.

This catches a subtle problem: chaos that never triggers. Maybe your network partition probability is too low. Maybe your buggify points are in dead code. `sometimes_assert!` proves the chaos happened.

## ChaosConfiguration

Network chaos is configured through `ChaosConfiguration`:

```rust
pub struct ChaosConfiguration {
    pub clog_probability: f64,           // Temporary write/read blocking
    pub bit_flip_probability: f64,       // 0.01% default
    pub random_close_probability: f64,   // 0.001% default
    pub clock_drift_max: Duration,       // 100ms default
    pub connect_failure_mode: ConnectFailureMode,
    // ... many more options
}

pub enum ConnectFailureMode {
    Disabled,           // Normal connections
    AlwaysFail,         // Tests reconnection logic
    Probabilistic,      // 50% error, 50% hang forever
}
```

The defaults are tuned through experience:

| Mechanism | Default | What it tests |
|-----------|---------|---------------|
| Bit flip corruption | 0.01% | Checksum validation |
| Random connection close | 0.001% | Reconnection, redelivery |
| Clock drift | 100ms max | Leases, heartbeats |
| Partial writes | 1000 bytes max | Message fragmentation |

Three presets cover common scenarios. `default()` enables FDB-style chaos. `disabled()` turns everything off for fast debugging. `random_for_seed()` randomizes parameters per seed to explore the configuration space.

## The One Takeaway

Coverage tells you lines were reached. `sometimes_assert` tells you interesting scenarios actually happened. If it never fires both ways, your test is lying to you.

We can inject chaos. We can prove it happened. But distributed systems are really about networks that fail in creative ways. [Stage 4](/posts/deterministic-simulation-from-scratch-stage-4/) builds connections that survive the chaos we just learned to create.

---

Feel free to reach out with any questions or to share your experiences with chaos testing. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

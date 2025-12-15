+++
title = "Moonpool Chronicles, Part 2: Buggify and Proving Correctness"
description = "How to inject failures at the code level and prove your distributed system survived the chaos"
date = 2025-12-15
draft = true
[taxonomies]
tags = ["rust", "simulation", "deterministic", "distributed-systems", "moonpool-chronicles", "testing", "chaos-engineering"]
+++

> [Moonpool Chronicles](/tags/moonpool-chronicles/) documents my journey building a deterministic simulation framework in Rust, backporting patterns from FoundationDB and TigerBeetle.

<!-- TODO: Opening hook -->
<!-- Hook idea: "Network chaos is external. But the nastiest bugs hide in error paths your code rarely executes. Here's how to inject failures at the code level AND prove your system survived." -->
<!-- Link back to Part 1: /posts/moonpool-chronicles-part-1-tcp-chaos/ -->

## The Problem with Random Chaos

<!-- TODO: Explain why pure randomness fails -->
- Most deep bugs need a rare combination of events
- Network partition AND slow disk AND coordinator crash at the exact same moment
- Probability of all three aligning randomly? Astronomical
- You'd burn CPU-centuries waiting

<!-- TODO: The insight -->
- You need to **bias** the simulation toward interesting states
- Make rare events happen more often, but deterministically
- FDB's solution: BUGGIFY

## Buggify: Code-Level Fault Injection

<!-- TODO: Explain FDB's two-phase model -->
<!-- File: moonpool-sim/src/chaos/buggify.rs -->
- Phase 1: **Activation** (once per code location per seed)
  - Each `buggify!()` location randomly activates with 25% probability
  - Thread-local HashMap tracks which locations are active for this seed
- Phase 2: **Firing** (on each call)
  - If location is active, fire with 25% probability on each call
  - Default: 25% * 25% = ~6% effective rate per call

<!-- TODO: Show the macro implementation -->
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

<!-- TODO: Explain why two-phase matters -->
- Different seeds activate different code locations
- Each seed explores a different corner of the state space
- After thousands of seeds, you've exercised every BUGGIFY point

<!-- TODO: Explain determinism -->
- Same seed = same activation pattern = same failures
- Reproducible chaos: when a test fails, rerun with same seed
- Debug the exact same execution path

<!-- TODO: Show integration with providers -->
<!-- File: moonpool-sim/src/providers/time.rs -->
- Buggified delays in time provider
- Buggified connect failures in network provider
- Power-law distribution: `max_delay * pow(random01(), 1000.0)`

## Proving Correctness

<!-- TODO: Explain the challenge -->
- The cluster survived 187 network partitions
- But did it **actually work correctly**?
- You can't just check if the database "looks okay"
- You need **proof** the invariants held

### always_assert!

<!-- TODO: Explain always_assert -->
<!-- File: moonpool-sim/src/chaos/assertions.rs -->
- Guards invariants that must **never** break
- Panics immediately on failure
- Includes seed info for reproducibility

```rust
always_assert!(condition, "name", "error message with seed");
```

- Use for: data consistency, transaction isolation, protocol invariants

### sometimes_assert!

<!-- TODO: Explain sometimes_assert -->
- Statistical tracking: records success rate across runs
- Error paths **MUST** execute (at least 1% of the time)
- If a sometimes_assert never fires, you have dead code or insufficient chaos

```rust
sometimes_assert!(name, condition, "message");
```

- Use for: error recovery paths, timeout handling, reconnection logic

<!-- TODO: Show tracking mechanism -->
- Thread-local HashMap<String, AssertionStats>
- Tracks: total_checks, successes, success_rate()
- Reports at end of simulation run

### Multi-Seed Testing

<!-- TODO: Explain iteration control -->
<!-- File: moonpool-sim/src/runner/builder.rs -->

```rust
pub enum IterationControl {
    FixedCount(usize),                // Run exact N seeds
    UntilAllSometimesReached(usize),  // Run until all sometimes_assert fire
}
```

- Default: `UntilAllSometimesReached(1000)`
- Runs up to 1000 seeds until every `sometimes_assert` has triggered
- Ensures comprehensive coverage of all error paths

## The SimulationBuilder Pattern

<!-- TODO: Show the builder pattern -->
<!-- File: moonpool-sim/src/runner/builder.rs -->

```rust
SimulationBuilder::new()
    .register_workload("node-1", |random, network, time, tasks, topology| async {
        // Workload code
    })
    .set_iteration_control(IterationControl::UntilAllSometimesReached(1000))
    .run()
```

<!-- TODO: Explain workload topology -->
- `WorkloadTopology::ClientServer { clients, servers }`
- Multiple nodes running concurrently
- Shared chaos configuration

<!-- TODO: Explain reproducing failures -->
- Test fails at seed 42? Run with `set_seed(42)`
- Exact same chaos pattern
- Exact same failure
- Debug with full reproducibility

<!-- TODO: Show metrics and reporting -->
- `SimulationMetrics` & `SimulationReport`
- Track: iterations run, assertions triggered, coverage achieved

## What's Next

<!-- TODO: Tease Part 3 -->
We can simulate networks, inject chaos at the code level, and prove correctness across thousands of seeds. But real distributed systems need more than raw TCP: they need **resilient peer connections** that handle failures gracefully. In Part 3, we'll build the transport layer: exponential backoff, message queuing, and FDB-style RPC.

---

Feel free to reach out with any questions or to share your experiences with chaos testing. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

+++
title = "Designing Rust FDB Workloads That Actually Find Bugs"
description = "Patterns and principles for writing Rust simulation workloads that catch bugs before production does."
date = 2025-12-09
[taxonomies]
tags = ["foundationdb", "rust", "testing", "simulation", "deterministic", "distributed-systems"]
+++

After [one trillion CPU-hours of simulation testing](/posts/diving-into-foundationdb-simulation/), FoundationDB has been stress-tested under conditions far worse than any production environment. Network partitions, disk failures, Byzantine faults. FDB handles them all. **But what about your code?** Your layer sits on top of FDB. Your indexes, your transaction logic, your retry handling. How do you know it survives chaos?

At Clever Cloud, we are building [Materia](https://www.clever-cloud.com/materia/), our serverless database product. The question haunted us: how do you ship layer code with the same confidence FDB has in its own? Our answer was to hack our way into FDB's simulator using [foundationdb-simulation](https://github.com/foundationdb-rs/foundationdb-rs/tree/4ed057a/foundationdb-simulation), a crate that compiles Rust to run inside FDB's deterministic simulator. We're the only language besides Flow that can pull this off.

The first seed triggered [`commit_unknown_result`](https://apple.github.io/foundationdb/developer-guide.html#transactions-with-unknown-results), one of the most feared edge cases for FDB layer developers. When a connection drops, the client can't know if the transaction committed. Our atomic counters were incrementing twice. In production, this surfaces once every few months under heavy load and during failures. In simulation? **Almost immediately.**

This post won't walk you through the code mechanics. The [foundationdb-simulation crate](https://crates.io/crates/foundationdb-simulation) and its [README](https://github.com/foundationdb-rs/foundationdb-rs/tree/4ed057a/foundationdb-simulation) cover that. Instead, this teaches you how to **design** workloads that catch real bugs. Whether you're a junior engineer or an LLM helping write tests, these principles will guide you.

## Why Autonomous Testing Works

Traditional testing has you write specific tests for scenarios you imagined. But as Will Wilson put it at [Bug Bash 2025](https://www.youtube.com/watch?v=eZ1mmqlq-mY): **"The most dangerous bugs occur in states you never imagined possible."** The key insight of autonomous testing (what FDB's simulation embodies) is that instead of writing tests, you write a **test generator**. If you ran it for infinite time, it would eventually produce all possible tests you could have written. You don't have infinite time, so instead you get a probability distribution over all possible tests. And probability distributions are leaky: they cover cases you never would have thought to test.

This is why simulation finds bugs so fast. You're not testing what you thought to test. You're testing what the probability distribution happens to generate, which includes edge cases you'd never have written explicitly. Add fault injection (a probability distribution over all possible ways the world can conspire to screw you) and now you're finding bugs that would take months or years to surface in production.

This is what got me interested in simulation in the first place: how do you test the things you see during on-call shifts? Those weird transient bugs at 3 AM, the race conditions that happen once a month, the edge cases you only discover when production is on fire. Simulation shifts that complexity from SRE time to SWE time. What was a 3 AM page becomes a daytime debugging session. What was a high-pressure incident becomes a reproducible test case you can bisect, rewind, and experiment with freely.

## The Sequential Luck Problem

Here's why rare bugs are so hard to find: imagine a bug that requires three unlikely events in sequence. Each event has a 1/1000 probability. Finding that bug requires 1/1,000,000,000 attempts, roughly a billion tries with random testing. Research confirms this: [a study of network partition failures](https://www.usenix.org/conference/osdi18/presentation/alquraan) found that 83% require 3+ events to manifest, 80% have catastrophic impact, and 21% cause permanent damage that persists after the partition heals. **But here's the good news for Rust workloads**: you don't solve this problem yourself. FDB's simulation handles fault injection. BUGGIFY injects failures at arbitrary code points. Network partitions appear and disappear. Disks fail. Machines crash and restart. The simulator explores failure combinations that would take years to encounter in production.

Your job is different. You need to design operations that exercise interesting code paths. Not just reads and writes, but the edge cases your users will inevitably trigger. And you need to write invariants that CATCH bugs when simulation surfaces them. After a million injected faults, how do you prove your data is still correct? This division of labor is the key insight: FDB injects chaos, you verify correctness.

## Designing Your Operation Alphabet

The **operation alphabet** is the complete set of operations your workload can perform. This is where most workloads fail: they test happy paths with uniform distribution and miss the edge cases that break production. Think about three categories:

**Normal operations** with realistic weights. In production, maybe 80% of your traffic is reads, 15% is simple writes, 5% is complex updates. Your workload should reflect this, because bugs often hide in the interactions between operation types. A workload that runs 50% reads and 50% writes tests different code paths than one that runs 95% reads and 5% writes. Both might be valid, but they'll find different bugs.

**Adversarial inputs** that customers will inevitably send. Empty strings. Maximum-length values. Null bytes in the middle of strings. Unicode edge cases. Boundary integers (0, -1, MAX_INT). Customers never respect your API specs, so model the chaos they create.

**Nemesis operations** that break things on purpose. Delete random data mid-test. Clear ranges that "shouldn't" be cleared. Crash batch jobs mid-execution to test recovery. Run compaction every operation instead of daily. Create conflict storms where multiple clients hammer the same key. Approach the 10MB transaction limit. These operations stress your error handling and recovery paths. The rare operations are where bugs hide. That batch job running once a day in production? In simulation, you'll hit its partial-failure edge case in minutes, but only if your operation alphabet includes it.

## Designing Invariants

After simulation runs thousands of operations with injected faults, network partitions, and machine crashes, how do you know your data is still correct? Unlike FDB's internal testing, Rust workloads can't inject assertions at arbitrary code points. You verify correctness in the `check()` phase, after the chaos ends. The key question: **"After all this, how do I PROVE my data is still correct?"**

**One critical tip: validate during `start()`, not just in `check()`.** Don't wait until the end to discover corruption. After each operation (or batch of operations), read back the data and verify it matches expectations. If you're maintaining a counter, read it and check the bounds. If you're building an index, query it immediately after insertion. Early validation catches bugs closer to their source, making debugging far easier. The `check()` phase is your final safety net, but continuous validation during execution is where you'll catch most issues.

An invariant is just a property that must always hold, no matter what operations ran. If you've seen property-based testing, it's the same idea: instead of `assertFalse(new User(GUEST).canUse(SAVED_CARD))`, you write `assertEquals(user.isAuthenticated(), user.canUse(SAVED_CARD))`. The first tests one case. The second tests a rule that holds for all cases.

Four patterns dominate invariant design:

**Reference Models** maintain an in-memory copy of expected state. Every operation updates both the database and the reference model. In `check()`, you compare them. If they diverge, something went wrong. Use `BTreeMap` (not `HashMap`) for deterministic iteration. This pattern works best for single-client workloads where you can track state locally.

**Conservation Laws** track quantities that must stay constant. Inventory transfers between warehouses shouldn't change total inventory. Money transfers between accounts shouldn't create or destroy money. Sum everything up and verify the conservation law holds. This pattern is elegant because it doesn't require tracking individual operations, just the aggregate property.

**Structural Integrity** verifies data structures remain valid. If you maintain a secondary index, verify every index entry points to an existing record and every record appears in the index exactly once. If you maintain a linked list in FDB, traverse it and confirm every node is reachable. The cycle validation pattern (creating a circular list where nodes point to each other) is a classic technique from [FDB's own Cycle workload](https://github.com/apple/foundationdb/blob/231f762/fdbserver/workloads/Cycle.actor.cpp). After chaos, traverse the cycle and verify you visit exactly N nodes.

**Operation Logging** solves two problems at once: `maybe_committed` uncertainty and multi-client coordination. The trick from [FDB's own AtomicOps workload](https://github.com/apple/foundationdb/blob/231f762/fdbserver/workloads/AtomicOps.actor.cpp): **log the intent alongside the operation in the same transaction**. Write both your operation AND a log entry recording what you intended. Since they're in the same transaction, they either both commit or neither does. No uncertainty. For multi-client workloads, each client logs under its own prefix (e.g., `log/{client_id}/`). In `check()`, client 0 reads all logs from all clients, replays them to compute expected state, and compares against actual state. If they diverge, something went wrong, and you'll know exactly which operations succeeded. See the [Rust atomic workload example](https://github.com/foundationdb-rs/foundationdb-rs/blob/4ed057a/foundationdb-simulation/examples/atomic/lib.rs) for a complete implementation.

## The Determinism Rules

FDB's simulation is deterministic. Same seed, same execution path, same bugs. This is the superpower that lets you reproduce failures. But determinism is fragile. Break it, and you lose reproducibility. Five rules to remember:

1. **BTreeMap, not HashMap**: HashMap iteration order is non-deterministic
2. **context.rnd(), not rand::random()**: All randomness must come from the seeded PRNG
3. **context.now(), not SystemTime::now()**: Use simulation time, not wall clock
4. **db.run(), not manual retry loops**: The framework handles retries and `maybe_committed` correctly
5. **No tokio::spawn()**: The simulation runs on a custom executor, spawning breaks it

If you take nothing else from this post, memorize these. Break any of them and your failures become unreproducible. You'll see a bug once and never find it again.

## Architecture: The Three-Crate Pattern

Real production systems use tokio, gRPC, REST frameworks, all of which break simulation determinism. You can't just drop your production binary into the simulator. The solution is separating your FDB operations into a simulation-friendly crate:

```
my-project/
├── my-fdb-service/      # Core FDB operations - NO tokio
├── my-grpc-server/      # Production layer (tokio + tonic)
└── my-fdb-workloads/    # Simulation tests
```

The service crate contains pure FDB transaction logic with no async runtime dependency. The server crate wraps it for production. The workloads crate tests the actual service logic under simulation chaos. This lets you test your real production code, not a reimplementation that might have different bugs.

## Common Pitfalls

Beyond the determinism rules above, these mistakes will bite you:

**Running setup or check on all clients.** The framework runs multiple clients concurrently. If every client initializes data in `setup()`, you get duplicate initialization. If every client validates in `check()`, you get inconsistent results. Use `if self.client_id == 0` to ensure only one client handles initialization and validation.

**Forgetting maybe_committed.** The `db.run()` closure receives a `maybe_committed` flag indicating the previous attempt might have succeeded. If you're doing non-idempotent operations like atomic increments, you need either truly idempotent transactions or [automatic idempotency](/posts/automatic-txn-fdb-730/) in FDB 7.3+. Ignoring this flag means your workload might count operations twice.

**Storing SimDatabase between phases.** Each phase (`setup`, `start`, `check`) gets a fresh database reference. Storing the old one leads to undefined behavior. Always use the `db` parameter passed to each method.

**Wrapping FdbError in custom error types.** The `db.run()` retry mechanism checks if errors are retryable via `FdbError::is_retryable()`. If you wrap `FdbError` in your own error type (like `anyhow::Error` or a custom enum), the retry logic can't see the underlying error and won't retry. Keep `FdbError` unwrapped in your transaction closures, or ensure your error type preserves retryability information.

**Assuming setup is safe from failures.** BUGGIFY is disabled during `setup()`, so you might think transactions can't fail. But simulation randomizes FDB knobs, which can still cause transaction failures. Always use `db.run()` with retry logic even in setup, or wrap your setup in a retry loop.

## The Real Value

That `commit_unknown_result` edge case appeared on our first simulation seed. In production, we'd still be hunting it months later. 30 minutes of simulation covers what would take 24 hours of chaos testing. But the real value of simulation testing isn't just finding bugs, it's **forcing you to think about correctness.** When you design a workload, you're forced to ask: "What happens when this retries during a partition?" "How do I verify correctness when transactions can commit in any order?" "What invariants must hold no matter what chaos occurs?" Designing for chaos becomes natural. And if it survives simulation, it survives production.

---

Feel free to reach out with questions or to share your simulation workloads. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

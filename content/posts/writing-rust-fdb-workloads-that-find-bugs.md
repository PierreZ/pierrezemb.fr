+++
title = "Writing Rust FDB Workloads That Actually Find Bugs"
description = "Patterns and principles for writing Rust simulation workloads that catch bugs before production does."
date = 2025-12-06
[taxonomies]
tags = ["foundationdb", "rust", "testing", "simulation", "deterministic", "distributed-systems"]
+++

After [one trillion CPU-hours of simulation testing](/posts/diving-into-foundationdb-simulation/), FoundationDB has been stress-tested under conditions far worse than any production environment. Network partitions, disk failures, Byzantine faults. FDB handles them all. **But what about your code?** Your layer sits on top of FDB. Your indexes, your transaction logic, your retry handling. How do you know it survives chaos?

At Clever Cloud, we were building [Materia](https://www.clever-cloud.com/materia/), our serverless database product. We were afraid to ship our layer code without the same level of testing FDB itself enjoys. So we hacked our way into FDB's simulation framework using [foundationdb-simulation](https://github.com/foundationdb-rs/foundationdb-rs/tree/main/foundationdb-simulation). On our first seed, simulation surfaced one of the most dreaded edge cases for FDB layer developers: [`commit_unknown_result`](https://apple.github.io/foundationdb/developer-guide.html#transactions-with-unknown-results). The client can't always know if a transaction committed before the connection dropped. Our atomic counter increments were sometimes running twice. In production, you might see this once every few months under heavy load. In simulation? **Almost immediately.**

This post teaches you how to **think** about writing simulation workloads. Not just the mechanics, but the principles that make them effective. Whether you're a junior engineer or an LLM helping write tests, these patterns will guide you toward workloads that actually find bugs.

## Why Autonomous Testing Works

Traditional testing has you write specific tests for scenarios you imagined. But as Will Wilson put it at [Bug Bash 2025](https://www.youtube.com/watch?v=eZ1mmqlq-mY): **"The most dangerous bugs occur in states you never imagined possible."** The key insight of autonomous testing (what FDB's simulation embodies) is that instead of writing tests, you write a **test generator**. If you ran it for infinite time, it would eventually produce all possible tests you could have written. You don't have infinite time, so instead you get a probability distribution over all possible tests. And probability distributions are leaky: they cover cases you never would have thought to test.

This is why simulation finds bugs so fast. You're not testing what you thought to test. You're testing what the probability distribution happens to generate, which includes edge cases you'd never have written explicitly. Add fault injection (a probability distribution over all possible ways the world can conspire to screw you) and now you're finding bugs that would take months or years to surface in production.

This is what got me interested in simulation in the first place: how do you test the things you see during on-call shifts? Those weird transient bugs at 3 AM, the race conditions that happen once a month, the edge cases you only discover when production is on fire. Simulation shifts that complexity from SRE time to SWE time. What's a 3 AM page becomes a daytime debugging session. What's a high-pressure incident becomes a reproducible test case you can bisect, rewind, and experiment with freely.

## The Sequential Luck Problem

Here's why rare bugs are so hard to find: imagine a bug that requires three unlikely events in sequence. Each event has a 1/1000 probability. Finding that bug requires 1/1,000,000,000 attempts, roughly a billion tries with random testing. **But here's the good news for Rust workloads**: you don't solve this problem yourself. FDB's simulation handles fault injection. BUGGIFY injects failures at arbitrary code points. Network partitions appear and disappear. Disks fail. Machines crash and restart. The simulator explores failure combinations that would take years to encounter in production.

Your job is different. You need to design operations that exercise interesting code paths. Not just reads and writes, but the edge cases your users will inevitably trigger. And you need to write invariants that CATCH bugs when simulation surfaces them. After a million injected faults, how do you prove your data is still correct? This division of labor is the key insight: FDB injects chaos, you verify correctness.

## Designing Your Operation Alphabet

The **operation alphabet** is the complete set of operations your workload can perform. This is where most workloads fail: they test happy paths with uniform distribution and miss the edge cases that break production. Think about three categories:

**Normal operations** with realistic weights. In production, maybe 80% of your traffic is reads, 15% is simple writes, 5% is complex updates. Your workload should reflect this, because bugs often hide in the interactions between operation types. A workload that runs 50% reads and 50% writes tests different code paths than one that runs 95% reads and 5% writes. Both might be valid, but they'll find different bugs.

**Adversarial inputs** that customers will inevitably send. Empty strings. Maximum-length values. Null bytes in the middle of strings. Unicode edge cases. Boundary integers (0, -1, MAX_INT). Customers never respect your API specs, so model the chaos they create.

**Nemesis operations** that break things on purpose. Delete random data mid-test. Clear ranges that "shouldn't" be cleared. Retry immediately without backoff. Submit transactions that conflict with each other by design. These operations stress your error handling and recovery paths. The rare operations are where bugs hide. That batch update running once a day in production? In simulation, you'll hit its race condition in minutes, but only if your operation alphabet includes it.

## Designing Invariants

After simulation runs thousands of operations with injected faults, network partitions, and machine crashes, how do you know your data is still correct? Unlike FDB's internal testing, Rust workloads can't inject assertions at arbitrary code points. You verify correctness in the `check()` phase, after the chaos ends. The key question: **"After all this, how do I PROVE my data is still correct?"**

**One critical tip: validate during `start()`, not just in `check()`.** Don't wait until the end to discover corruption. After each operation (or batch of operations), read back the data and verify it matches expectations. If you're maintaining a counter, read it and check the bounds. If you're building an index, query it immediately after insertion. Early validation catches bugs closer to their source, making debugging far easier. The `check()` phase is your final safety net, but continuous validation during execution is where you'll catch most issues.

Four patterns dominate invariant design:

**Reference Models** maintain an in-memory copy of expected state. Every operation updates both the database and the reference model. In `check()`, you compare them. If they diverge, something went wrong. Use `BTreeMap` (not `HashMap`) for deterministic iteration. This pattern works best for single-client workloads where you can track state locally.

**Conservation Laws** track quantities that must stay constant. Inventory transfers between warehouses shouldn't change total inventory. Money transfers between accounts shouldn't create or destroy money. Sum everything up and verify the conservation law holds. This pattern is elegant because it doesn't require tracking individual operations, just the aggregate property.

**Structural Integrity** verifies data structures remain valid. If you maintain a secondary index, verify every index entry points to an existing record and every record appears in the index exactly once. If you maintain a linked list in FDB, traverse it and confirm every node is reachable. The cycle validation pattern (creating a circular list where nodes point to each other) is a classic technique from FDB's own workloads. After chaos, traverse the cycle and verify you visit exactly N nodes.

**Operation Logging** solves two problems at once: `maybe_committed` uncertainty and multi-client coordination. The trick from FDB's own AtomicOps workload: **log the intent alongside the operation in the same transaction**. Write both your operation AND a log entry recording what you intended. Since they're in the same transaction, they either both commit or neither does. No uncertainty. For multi-client workloads, each client logs under its own prefix (e.g., `log/{client_id}/`). In `check()`, client 0 reads all logs from all clients, replays them to compute expected state, and compares against actual state. If they diverge, something went wrong, and you'll know exactly which operations succeeded.

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

## The Real Value

That `commit_unknown_result` edge case appeared on our first simulation seed. In production, we'd still be hunting it months later. But the real value of simulation testing isn't just finding bugs, it's **forcing you to think about correctness.** When you design a workload, you're forced to ask: "What happens when this retries during a partition?" "How do I verify correctness when transactions can commit in any order?" "What invariants must hold no matter what chaos occurs?" Designing for chaos becomes natural. And if it survives simulation, it survives production.

## Further Reading

For code examples to complement these principles:

- [foundationdb-simulation README](https://github.com/foundationdb-rs/foundationdb-rs/tree/main/foundationdb-simulation): Getting started with the Rust simulation crate
- [Atomic workload example](https://github.com/foundationdb-rs/foundationdb-rs/blob/main/foundationdb-simulation/examples/atomic/lib.rs): A complete Rust workload showing the operation logging pattern
- [AtomicOps.actor.cpp](https://github.com/apple/foundationdb/blob/main/fdbserver/workloads/AtomicOps.actor.cpp): FDB's own C++ workload demonstrating intent logging for maybe_committed handling
- [Cycle.actor.cpp](https://github.com/apple/foundationdb/blob/main/fdbserver/workloads/Cycle.actor.cpp): The classic cycle validation pattern for testing transactional atomicity

---

Feel free to reach out with questions or to share your simulation workloads. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

+++
title = "Borrowing FoundationDB's simulator for moonpool"
date = 2026-02-18
description = "A hobby-grade deterministic simulation testing framework in Rust, one faulty seed at a time."

[taxonomies]
tags = ["rust", "dst", "foundationdb"]
+++

`moonpool` is my attempt to fit FoundationDB's simulation philosophy into a single,
readable Rust crate — small enough to understand in an afternoon, faithful enough to
find real bugs.

## The core idea

Everything that can vary — time, network ordering, disk latency, process crashes — is
driven by a single seeded RNG. Replace the runtime, not the code under test.

```rust
let sim = Sim::new(seed);
let mut cluster = Cluster::spawn(&sim, 3);
cluster.inject(Fault::Partition { from: 0, to: 2 });
cluster.run_until_quiescent();
assert!(cluster.linearizable());
```

One seed drives every source of nondeterminism, and the same seed always replays the
same history:

{% mermaid() %}
flowchart LR
  RNG[seeded RNG] --> SCHED[scheduler]
  SCHED --> NET[network reorder]
  SCHED --> DISK[disk latency]
  SCHED --> CLK[clock skew]
  NET --> CHECK{linearizable?}
  DISK --> CHECK
  CLK --> CHECK
  CHECK -->|no| SHRINK[shrink seed]
  CHECK -->|yes| PASS[commit]
{% end %}

## What it caught

The first non-trivial bug it found was a lost acknowledgement under a heal-then-elect
sequence — invisible in unit tests, obvious once the scheduler was allowed to be cruel.

### Lost acknowledgements

A follower acked an append, then the leader stepped down before the commit index
advanced. The client saw success; the cluster disagreed.

#### Reproduction

Seed `0xC0FFEE` replays it in under a millisecond — heal the partition, force an
election within the same tick, and the ack races the term change.

### Clock skew

Skewing one node's clock past the election timeout surfaced a second, unrelated split
vote that only a deterministic clock could have caught reliably.

## Where it goes next

Faster seeds, better shrinking, and a trace viewer. The goal is never realism for its
own sake; it is *reproducible cruelty*.

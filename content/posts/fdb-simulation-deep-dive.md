+++
title = "Deep Dive into FoundationDB's Simulation Framework"
description = "How FoundationDB achieves legendary reliability through deterministic simulation, interface swapping, and one trillion CPU-hours of testing"
date = 2025-10-15
draft = true
[taxonomies]
tags = ["foundationdb", "testing", "simulation", "deterministic", "distributed-systems"]
+++

After years of on-call shifts running FoundationDB at Clever Cloud, here's what I've learned: **I've never been woken up by FDB**. Every production incident traced back to our code, our infrastructure, our mistakes. Never FDB itself. That kind of reliability doesn't happen by accident.

The secret? **Deterministic simulation testing**. FoundationDB runs the real database software (not mocks, not stubs) in a discrete-event simulator alongside randomized workloads and aggressive fault injection. All sources of nondeterminism are abstracted: network, disk, time, and random number generation. Multiple FDB servers communicate through a simulated network in a single-threaded process. The simulator injects machine crashes, rack failures, network partitions, disk corruption, bit flips. Every failure mode you can imagine, happening in rapid succession, deterministically. Same seed, same execution path, same bugs, every single time.

After roughly **one trillion CPU-hours of simulation testing**, FoundationDB has been stress-tested under conditions far worse than any production environment will ever encounter. The development environment is deliberately harsher than production: network partitions every few seconds, machine crashes mid-transaction, disks randomly swapped between nodes on reboot. If your code survives the simulator, production is easy.

I've written before about [FoundationDB](/posts/notes-about-foundationdb/), [simulation-driven development](/posts/simulation-driven-development/), and [testing prevention vs discovery](/posts/testing-prevention-vs-discovery/). Those posts cover the concepts and benefits. This post is different: **this is how FoundationDB actually implements deterministic simulation**. Interface swapping, deterministic event loops, BUGGIFY chaos injection, Flow actors, and the architecture that makes it all work. We're going deep into the implementation.

<div style="text-align: center;">
  <img src="/images/fdb-simulation-deep-dive/simulator-architecture.jpeg" alt="FoundationDB Simulator Architecture" />
  <p><em>FoundationDB's simulation architecture: the same FDB server code runs in both the simulator process (using simulated I/O) and the real world (using real I/O)</em></p>
</div>

## The Trick: Interface Swapping

The genius of FDB's simulation is surprisingly simple: **the same code runs in both production and simulation by swapping interface implementations**. The global `g_network` pointer holds an `INetwork` interface. In production, this points to `Net2`, which creates real TCP connections using Boost.ASIO. In simulation, it points to `Sim2` ([sim2.actor.cpp:1051](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbrpc/sim2.actor.cpp#L1051)), which creates `Sim2Conn` objects (fake connections that write to in-memory buffers).

When code needs to send data, it gets a `Reference<IConnection>` from the network layer. In production, that's a real socket. In simulation, it's `Sim2Conn` ([sim2.actor.cpp:334](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbrpc/sim2.actor.cpp#L334)) with a `std::deque<uint8_t>` buffer. Network latency? The simulator adds `delay()` calls with values from `deterministicRandom()`. Packet loss? Just throw `connection_failed()`. Network partition? `Sim2Conn` checks `g_clogging.disconnected()` and refuses delivery. **It's all just memory operations with delays**, running single-threaded and completely deterministic.

What makes this truly deterministic is `deterministicRandom()`, a seeded PRNG that replaces all randomness. Every network latency value, every backoff delay (like the `Peer`'s exponential reconnection timing), every process crash timing goes through the same deterministic stream. Same seed, same execution path, every single time. When a test fails after 1 trillion simulated operations, you can reproduce the exact failure by running with the same seed.

### Biasing the Simulator: BUGGIFY

Most deep bugs need a rare combination of events. A network partition **and** a slow disk **and** a coordinator crash happening at the exact same moment. The probability of all three aligning randomly? Astronomical. You'd burn CPU-centuries waiting.

FoundationDB solves this with `BUGGIFY`, spread throughout the codebase. Each `BUGGIFY` point fires 25% of the time, deterministically, so every test explores a different corner of the state space (Alex Miller's [excellent post on BUGGIFY](https://transactional.blog/simulation/buggify) covers the implementation details).

Let's take timeout handling in data distribution as an example:

```cpp
// DDShardTracker.actor.cpp
choose {
    when(wait(BUGGIFY ? Never() : fetchTopKShardMetrics_impl(self, req))) {}
    when(wait(delay(SERVER_KNOBS->DD_SHARD_METRICS_TIMEOUT))) {
        // Timeout path
    }
}
```

The `Never()` future never completes. Literally hangs forever. When BUGGIFY is enabled, the operation gets stuck, forcing the timeout branch to execute. Simple, elegant failure injection.

But here's the trick: **the timeout value itself is also buggified**:

```cpp
// ServerKnobs.cpp
init( DD_SHARD_METRICS_TIMEOUT, 60.0 );  // Production: 60 seconds
if( randomize && BUGGIFY ) DD_SHARD_METRICS_TIMEOUT = 0.1;  // Simulation: 0.1 seconds!
```

Production timeout: 60 seconds. BUGGIFY timeout: 0.1 seconds (600x shorter). The shrinking timeout window means legitimate operations are far more likely to hit timeout paths. Even without `Never()` forcing a hang, simulated network delays and slow operations will trigger timeouts constantly. When `Never()` does fire, you get guaranteed timeout execution. Every knob marked `if (randomize && BUGGIFY)` becomes a chaos variable. Timeouts shrink, cache sizes drop, I/O patterns randomize.

This creates **combinatorial explosion**. FoundationDB has hundreds of randomized knobs. Each BUGGIFY-enabled test run picks a different configuration: maybe connection monitors are 4x slower, but file I/O is using 32KB blocks, and cache size is 1000 entries, and reconnection delays are doubled. The next run? Completely different knob values. Same code, thousands of different operating environments. After one trillion simulated operations across countless test runs, you've stress-tested your code under scenarios that would take decades to encounter in production.


## Flow: Actors and Cooperative Multitasking

FoundationDB doesn't use traditional threads. It uses Flow, a custom actor model built on C++. Here's a simple example:

```cpp
ACTOR Future<int> asyncAdd(Future<int> f, int offset) {
    int value = wait(f);  // Suspend until f completes, then resume with its value
    return value + offset;
}
```

The `ACTOR` keyword marks functions that can use `wait()`. When you call `wait(f)`, the actor **suspends**. It returns control to the event loop and resumes later when the `Future` completes, continuing with the result. No blocking. All asynchronous. Use the `state` keyword for variables that need to persist across multiple `wait()` calls.

If you know Rust's async/await, Flow is the same concept. `ACTOR` functions are like `async fn`, `wait()` is like `.await`, and `Future<T>` is like Rust's `Future`. The difference? Flow was built in 2009 for C++, and gets compiled by `actorcompiler.h` into state machines rather than relying on language support.

The same Flow code runs in both production and simulation. An actor waiting for network I/O gets a real socket in production, a simulated buffer in simulation. The code doesn't know the difference. The Flow documentation at [apple.github.io/foundationdb/flow.html](https://apple.github.io/foundationdb/flow.html) covers the full programming model.


## Single-Threaded Time Travel: The Event Loop

Hundreds of actors running concurrently. Coordinators electing leaders, transaction logs replicating commits, storage servers handling reads. All happening in **one thread**.

The trick is cooperative multitasking. Actors yield control with `wait()`. When all actors are waiting, the event loop can **advance simulated time**:

{% mermaid() %}
flowchart TD
    Start([Event Loop]) --> CheckReady{Any actors<br/>ready to run?}
    CheckReady -->|Yes| RunActor[Run next ready actor<br/>until it hits wait]
    RunActor --> CheckReady
    CheckReady -->|No, all waiting| CheckPending{Any pending<br/>futures?}
    CheckPending -->|Yes| AdvanceTime[Advance simulated clock<br/>to next event]
    AdvanceTime --> WakeActors[Wake actors waiting<br/>for this time]
    WakeActors --> CheckReady
    CheckPending -->|No| Done([Simulation complete])
{% end %}

Here's the key insight: when all actors are blocked waiting on futures, the event loop finds the next scheduled event (the earliest timestamp) and **jumps the simulated clock forward** to that time. Then it wakes the actors waiting for that event and runs them until they `wait()` again.

Example: 100 storage servers each execute `wait(delay(deterministicRandom()->random01() * 60.0))`. In wall-clock time, this takes microseconds. In simulated time, these delays are spread across 60 seconds. The event loop processes them in order, advancing time as it goes. **Zero wall-clock time has passed. 60 simulated seconds have passed.**

This gives you:

* **Compressed time**: Years of uptime in seconds of testing. `wait(delay(86400.0))` simulates 24 hours instantly.
* **Perfect determinism**: Single-threaded execution means no race conditions. Same seed, same event ordering, exact same execution path.
* **Reproducibility**: Test fails after 1 trillion simulated operations? Run again with the same seed, get the exact same failure at the exact same point.

No actor ever blocks. They all cooperate, yielding control back to the event loop. This is the foundation that makes realistic cluster simulation possible.


## Building the Simulated Cluster

Now that we understand Flow actors and the event loop, let's see what runs on it. SimulatedCluster **builds an entire distributed cluster in memory**.

`SimulatedCluster` starts by generating a random cluster configuration: 1-5 datacenters, 1-100+ machines per DC, different storage engines (memory, ssd, redwood-1), different replication modes (single, double, triple). Every test run gets a different topology.

The actor hierarchy looks like this: SimulatedCluster creates machine actors (`simulatedMachine`). Each machine actor creates process actors (`simulatedFDBDRebooter`). Each process actor runs **actual fdbserver code**. The machine actor sits in an infinite loop (shown earlier in the Flow section): wait for all processes to die, delay 10 simulated seconds, reboot.

**The same fdbserver code that runs in production runs here**. No mocks. No stubs. Real transaction logs writing to simulated disk. Real storage engines (RocksDB, Redwood). Real Paxos consensus. The only difference? `Sim2` network instead of `Net2`.

And of course, BUGGIFY shows up here too. Remember how BUGGIFY shrinks timeouts and injects failures? It also does something **completely insane** during machine reboots. When a machine reboots, the simulator can **swap its disks**:

```cpp
// SimulatedCluster.actor.cpp - machine reboot
state bool swap = killType == ISimulator::KillType::Reboot &&
                  BUGGIFY_WITH_PROB(0.75) &&
                  g_simulator->canSwapToMachine(localities.zoneId());
if (swap) {
    availableFolders[localities.dcId()].push_back(myFolders);  // Return my disks to pool
    myFolders = availableFolders[localities.dcId()][randomIndex];  // Get random disks from pool
}
```

75% of the time when BUGGIFY is enabled, a rebooting machine gets **random disks from the datacenter pool**. Maybe it gets its own disks back. Maybe it gets another machine's disks with completely different data. Maybe it gets the disks from a machine that was destroyed 10 minutes ago. Your storage server just woke up with someone else's data (or no data at all). Can the cluster handle this? Can it detect the mismatch and rebuild correctly?

For extra chaos, there's also `RebootAndDelete` which gives the machine **brand new empty folders**. No data. Fresh disks. This tests the actual failure mode of replacing a dead drive or provisioning a new machine.

Read that again. During testing, FoundationDB **randomly swaps or deletes storage server data on reboot**. If your distributed database doesn't assume storage servers occasionally come back with amnesia or someone else's memories, you're not testing the real world. Because surely, no one has ever accidentally mounted the wrong volume in a Kubernetes deployment, right?

What you get from all this:

* **Real cluster behavior**: Coordinators elect leaders, transaction logs replicate commits, storage servers handle reads/writes, backup agents run
* **Real failure modes**: Process crashes, machine reboots, network partitions (via `g_clogging`), slow disks (via `AsyncFileNonDurable`), disk swaps, data loss
* **Realistic topologies**: Multi-region configurations, different storage engines, different replication modes, different machine counts

When you run a simulation test, SimulatedCluster boots this entire virtual cluster, lets it stabilize, runs workloads against it while injecting chaos, then validates correctness.


## Workloads: Stress Testing Under Chaos

30 seconds. 2500 transactions per second. Concurrent machines swapping edges in a distributed data structure while chaos engines inject failures. Let's see if the database survives.

```
Simulation Overview
┌────────────┬──────────────────┬────────────────┬─────────────────┬────────────────┐
│ Seed       ┆ Replication      ┆ Simulated Time ┆ Real Time       ┆ Storage Engine │
╞════════════╪══════════════════╪════════════════╪═════════════════╪════════════════╡
│ 1876983470 ┆ triple           ┆ 5m 47s         ┆ 18s 891ms       ┆ ssd-2          │
└────────────┴──────────────────┴────────────────┴─────────────────┴────────────────┘

Timeline of Chaos Events
┌──────────┬────────────────────┬──────────────────────────────────────┐
│ Time (s) ┆ Event Type         ┆ Details                              │
╞══════════╪════════════════════╪══════════════════════════════════════╡
│ 87.234   ┆ Coordinator Change ┆ Triggering leader election           │
│ 92.156   ┆ Process Reboot     ┆ KillInstantly process at 10.0.4.2:3  │
│ 92.156   ┆ Process Reboot     ┆ KillInstantly process at 10.0.4.2:1  │
│ 95.871   ┆ Coordinator Change ┆ Triggering leader election           │
│ 103.445  ┆ Process Reboot     ┆ RebootAndDelete process at 10.0.2.1:4│
│ 103.445  ┆ Process Reboot     ┆ RebootAndDelete process at 10.0.2.1:2│
└──────────┴────────────────────┴──────────────────────────────────────┘

Chaos Summary
  Network Partitions: 187 events (max duration: 5.2s)
  Process Kills: 2 KillInstantly, 2 RebootAndDelete
  Coordinator Changes: 2
```

**The cluster survived.** 187 network partitions. 4 process kills. 2 coordinator changes. 5 minutes of simulated time compressed into 18 seconds of wall-clock time. Every transaction completed correctly. The cycle invariant never broke.

How did we unleash this chaos? Here's the test configuration:

```toml
[configuration]
buggify = true
minimumReplication = 3

[[test]]
testTitle = 'CycleWithAttrition'

    [[test.workload]]
    testName = 'Cycle'
    testDuration = 30.0
    transactionsPerSecond = 2500.0

    [[test.workload]]
    testName = 'RandomClogging'
    testDuration = 30.0

    [[test.workload]]
    testName = 'Attrition'
    testDuration = 30.0

    [[test.workload]]
    testName = 'Rollback'
    testDuration = 30.0
```

### What Just Happened?

Four concurrent workloads ran on the same simulated cluster for 30 seconds. **Workloads** are reusable scenario templates (180+ built-in in [fdbserver/workloads/](https://github.com/apple/foundationdb/tree/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads)) that either generate transactions or inject chaos.

**The application workload** we ran:

* **Cycle** ([Cycle.actor.cpp](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/Cycle.actor.cpp)): Hammered the database with 2500 transactions/second, each one swapping edges in a distributed graph. Tests SERIALIZABLE isolation by maintaining a cycle invariant. If isolation breaks, the cycle splits or nodes vanish. We'll dive deep into how this works below.

**The chaos workloads** that tried to break it:

* **RandomClogging** ([RandomClogging.actor.cpp:92](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/RandomClogging.actor.cpp#L92)): Calls `g_simulator->clogInterface(ip, duration)` to partition machines. Those **187 network partitions** we saw? This workload. Some lasted over 5 seconds.
* **Attrition** ([MachineAttrition.actor.cpp](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/MachineAttrition.actor.cpp)): Calls `g_simulator->killMachine()` and `g_simulator->rebootMachine()`. The **4 process kills** (2 instant, 2 with deleted data)? This workload.
* **Rollback** ([Rollback.actor.cpp](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/Rollback.actor.cpp)): Forces proxy-to-TLog failures, triggering coordinator recovery. The **2 coordinator changes**? This workload.

Workloads are composable. The TOML format lets you stack them: `[configuration]` sets global parameters (BUGGIFY, replication), each `[[test.workload]]` adds another concurrent workload. Want to test atomic operations under network partitions? Stack `AtomicOps` + `RandomClogging`. Want to test backup during machine failures? Combine `BackupToBlob` + `Attrition`. Test files live in [tests/](https://github.com/apple/foundationdb/tree/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/tests).

### How Does Cycle Work?

Remember that test we just ran? Let's break down how the `Cycle` workload actually works. It creates a directed graph where every node points to exactly one other node, forming a single cycle: `0→1→2→...→N→0`. Then it runs 2500 concurrent transactions per second, each one randomly swapping edges in the graph. Meanwhile, chaos workloads kill machines, partition the network, and force coordinator changes. **If SERIALIZABLE isolation works correctly, the cycle never breaks**. You always have exactly N nodes in one ring, never split cycles or dangling pointers.

Every workload implements four phases ([workloads.actor.h:99](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/include/fdbserver/workloads/workloads.actor.h#L99)):

**SETUP** ([Cycle.actor.cpp:89](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/Cycle.actor.cpp#L89)): Creates `nodeCount` nodes. Each key stores the index of the next node in the cycle. Key 0 → value 1, key 1 → value 2, ..., key N-1 → value 0.

**EXECUTION** ([Cycle.actor.cpp:164](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/Cycle.actor.cpp#L164)): Multiple concurrent `cycleClient` actors run this loop:
1. Pick random node `r`
2. Read three hops: `r→r2→r3→r4`
3. Swap the middle two edges: make `r→r3` and `r2→r4`
4. Commit

This transaction reads 3 keys and writes 2. If isolation breaks, you could create cycles of the wrong length or lose nodes entirely.

**CHECK** ([Cycle.actor.cpp:313](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/Cycle.actor.cpp#L313)): One client reads the entire graph in a single transaction. Starting from node 0, follow pointers: 0→next→next→next. Count the hops. After exactly `nodeCount` hops, you must be back at node 0. If you get there earlier (cycle too short) or can't get there (broken chain), the test fails. Also verifies transaction throughput met the expected rate.

**METRICS**: Reports transactions completed, retry counts, latency percentiles.

This is the pattern all workloads follow: SETUP initializes data, EXECUTION generates load, CHECK verifies correctness, METRICS reports results. When you execute a test, SimulatedCluster boots the cluster, runs SETUP phases sequentially, then runs all EXECUTION phases concurrently (they're Flow actors on the same event loop). After `testDuration`, CHECK phases verify correctness.

**This is what runs before every FoundationDB commit.** Not once. Not a few times. Thousands of test runs with different seeds, different cluster configurations, different workload combinations. Application workloads generate realistic transactions. Chaos workloads inject failures. The CHECK phases prove correctness survived the chaos. This is why FoundationDB doesn't fail in production. The simulator has already broken it every possible way, and every bug got fixed before shipping.

I generated that simulation output using [fdb-sim-visualizer](https://github.com/PierreZ/fdb-sim-visualizer), a tool I wrote to parse simulation trace logs and understand what happened during testing.


## Verifying Correctness: Building Reliable Workloads

**But here's the hard part: proving correctness when everything is randomized.** The cluster survived. Transactions completed. The cycle invariant never broke... or did it? When you're running 2500 transactions per second with random edge swaps under 187 network partitions, how do you **prove** nothing went wrong? You can't just check if the database "looks okay." You need mathematical proof the invariants held.

FoundationDB's approach: **track during EXECUTION, verify in CHECK.** Three patterns emerge across the codebase:

### Pattern 1: Reference Implementation

**The challenge**: How do you verify complex API behavior under chaos?

**The solution**: Run every operation twice. `ApiCorrectness` ([ApiCorrectness.actor.cpp](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/ApiCorrectness.actor.cpp)) mirrors all operations in a simple `MemoryKeyValueStore` (just a `std::map<Key, Value>`). Every `transaction->set(k, v)` also executes `store.set(k, v)` in memory. The CHECK phase reads from FDB and compares with the memory model. Mismatch = bug found.

### Pattern 2: Operation Logging

**The challenge**: How do you verify atomic operations executed in the right order?

**The solution**: Log everything. `AtomicOps` ([AtomicOps.actor.cpp](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/AtomicOps.actor.cpp)) logs every operation to a separate keyspace. During EXECUTION: `atomicOp(ops_key, value)` on real data, `set(log_key, value)` to track what happened. During CHECK: replay all logged operations, compute what the final state should be, compare with actual database state.

### Pattern 3: Invariant Tracking

**The challenge**: How do you prove SERIALIZABLE isolation worked during chaos?

**The solution**: Maintain a mathematical invariant that breaks if isolation fails. `Cycle` (from our test earlier) maintains "exactly N nodes in one ring." During EXECUTION, random edge swaps must preserve the invariant. During CHECK, walk the graph: 0→next→next→next. After exactly N hops, you must be back at node 0. If you arrive earlier (cycle split) or can't arrive (broken chain), isolation failed. The CHECK phase catches this immediately.

### Using clientId for Work Distribution

Every workload gets `clientId` (0, 1, 2...) and `clientCount` (total clients). Three patterns:

**Client 0 only** ([AtomicOps.actor.cpp:128](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/AtomicOps.actor.cpp#L128)):
```cpp
if (clientId != 0) return true;  // Common for CHECK phases
```

**Partition keyspace** ([WatchAndWait.actor.cpp:91](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/WatchAndWait.actor.cpp#L91)):
```cpp
uint64_t startNode = (nodeCount * clientId) / clientCount;
uint64_t endNode = (nodeCount * (clientId + 1)) / clientCount;
// Client 0: nodes 0-33, Client 1: nodes 34-66, Client 2: nodes 67-99
```

**Round-robin** ([Watches.actor.cpp:63](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbserver/workloads/Watches.actor.cpp#L63)):
```cpp
if (i % clientCount == clientId)
// Client 0: keys 0,3,6,9... Client 1: keys 1,4,7,10...
```

Use `clientId` to create concurrency (multiple clients hitting different keys) or coordinate work (one client checks, others generate load).

### Randomize Everything

The key to finding bugs: **randomize every decision**. Which keys to read? Random. How many operations per transaction? Random. Which atomic operation type? Random. Order of operations? Random. When to inject chaos? Random.

But use `deterministicRandom()` for all randomness. It's a seeded PRNG. Same seed = same random choices = reproducible failures. When a test fails after 10 million operations, rerun with the same seed, get the exact same failure at the exact same point.

### Pattern Selection Guide

| Testing | Use Pattern | Example Workload |
|---------|-------------|------------------|
| API correctness | Reference implementation | ApiCorrectness |
| Atomic operations | Operation logging | AtomicOps |
| ACID guarantees | Invariant tracking | Cycle |
| Backup/restore | Absence checking | BackupCorrectness |

Chaos workloads (`RandomClogging`, `Attrition`, `Rollback`) don't need CHECK phases. They just return `true`. They inject failures. Application workloads verify that correctness survived the chaos.


## Writing Workloads in Rust

Remember those chaos workloads hammering the Cycle test? `RandomClogging`, `Attrition`, `Rollback`. All written in C++ Flow. But you can write workloads in **Rust** and compile them directly into the simulator. At Clever Cloud, we open-sourced [foundationdb-simulation](https://github.com/foundationdb-rs/foundationdb-rs/tree/main/foundationdb-simulation), which lets you implement the `RustWorkload` trait with `setup()`, `start()`, and `check()` methods using Rust's async/await:

```rust
#[async_trait]
impl RustWorkload for MyWorkload {
    async fn setup(&mut self, db: Database, _ctx: Context) -> Result<()> {
        // Initialize test data
        db.run(|tx, _| async move {
            tx.set(b"key", b"value");
            Ok(())
        }).await
    }

    async fn start(&mut self, db: Database, ctx: Context) -> Result<()> {
        // Generate load under simulation
        for _ in 0..ctx.get_option("nodeCount", 100) {
            db.run(|tx, _| async move {
                let value = tx.get(b"key", false).await?;
                // Your workload logic here
                Ok(())
            }).await?;
        }
        Ok(())
    }

    async fn check(&mut self, db: Database, _ctx: Context) -> Result<()> {
        // Verify correctness after chaos
        Ok(())
    }
}
```

Your Rust code compiles to a shared library, FDB's `ExternalWorkload` loads it at runtime via FFI, and your Rust async functions run on the same Flow event loop as the C++ cluster. The FFI boundary is managed by the `foundationdb-simulation` crate, which handles marshaling between Flow's event loop and Rust futures. Same determinism, same reproducibility, same chaos injection. But you're writing `async fn` instead of `ACTOR Future<Void>`.

We use this at Clever Cloud to test [Materia KV](https://www.clever-cloud.com/blog/features/2024/06/11/materia-kv-our-easy-to-use-serverless-key-value-database-is-available-to-all/), our multi-tenant database built on FDB. Here's a [complete example workload](https://github.com/foundationdb-rs/foundationdb-rs/blob/main/foundationdb-simulation/examples/atomic/lib.rs) that tests atomic operations in ~100 lines of Rust. Write application code in Rust, run it in the simulator with machine kills and network partitions, verify correctness. If it survives simulation, it survives production. Though simulation can't catch every production issue (operational mistakes, hardware quirks), it eliminates entire classes of distributed systems bugs.

## Running Simulations Yourself

Think you can break FoundationDB? You don't need to build from source or set up a cluster. Download a prebuilt `fdbserver` binary from the [releases page](https://github.com/apple/foundationdb/releases), create a test file, and unleash chaos:

```bash
# Download fdbserver (Linux example, adjust for your platform)
wget https://github.com/apple/foundationdb/releases/download/7.3.27/fdbserver.x86_64
chmod +x fdbserver.x86_64

# Create the folder for traces
mkdir events

# Run a simulation test with JSON trace output
./fdbserver.x86_64 -r simulation -f Attritions.toml --trace-format json -L ./events --logsize 1GiB
```

Here are two test files to get you started. Save either as a `.toml` file and run with the command above.

**Attritions.toml** - Network partitions + machine crashes + database reconfigurations (the NemesisTest shown earlier):

```toml
[configuration]
buggify = true
minimumReplication = 3

[[test]]
testTitle = 'NemesisTest'
    [[test.workload]]
    testName = 'ReadWrite'
    testDuration = 30.0
    transactionsPerSecond = 1000.0

    [[test.workload]]
    testName = 'RandomClogging'  # Network partitions
    testDuration = 30.0
    swizzle = 1  # Unclog in reversed order

    [[test.workload]]
    testName = 'Attrition'  # Machine crashes
    testDuration = 30.0

    [[test.workload]]
    testName = 'Rollback'  # Proxy-to-TLog errors
    testDuration = 30

    [[test.workload]]
    testName = 'ChangeConfig'  # Database reconfigurations
    coordinators = 'auto'
```

**DiskFailureCycle.toml** - Disk failures + bit flips during the Cycle workload:

```toml
[configuration]
minimumReplication = 3
minimumRegions = 3
buggify = false

[[test]]
testTitle = 'DiskFailureCycle'
    [[test.workload]]
    testName = 'Cycle'
    transactionsPerSecond = 2500.0
    testDuration = 30.0

    [[test.workload]]
    testName = 'DiskFailureInjection'
    testDuration = 120.0
    stallInterval = 5.0
    stallPeriod = 5.0
    throttlePeriod = 30.0
    corruptFile = true
    percentBitFlips = 10
```

The simulation generates JSON trace logs in `./events/`. Parse them with [fdb-sim-visualizer](https://github.com/PierreZ/fdb-sim-visualizer).

For more test examples, check FoundationDB's [tests/](https://github.com/apple/foundationdb/tree/main/tests) directory. Hundreds of workload combinations testing every corner of the system.

---

## Why I've Never Been Woken Up by FDB

After years of on-call and one trillion CPU-hours of simulation, I've never been woken up by FoundationDB. Now you know why.

Interface swapping lets the same code run in both production and simulation. Flow actors enable single-threaded determinism. The event loop compresses years into seconds. BUGGIFY injects chaos into every corner of the codebase. SimulatedCluster builds entire distributed systems in memory. Workloads generate realistic transactions while chaos engines try to break everything. And deterministic randomness guarantees every bug can be reproduced, diagnosed, and fixed before shipping.

The simulator has already broken FoundationDB in every possible way. Network partitions during coordinator elections. Machine crashes mid-transaction. Disks swapped between nodes on reboot. Bit flips. Slow I/O. Every edge case, every race condition, every distributed systems nightmare. Found, fixed, and verified before production ever sees it.

**Want to try breaking FoundationDB yourself?** Grab a test config from above, run the simulator, inject chaos, and see if you can find a bug that survived one trillion CPU-hours. If you do, the FDB team would love to hear about it.

---

Feel free to reach out with any questions or to share your simulation testing experiences or FDB workloads. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
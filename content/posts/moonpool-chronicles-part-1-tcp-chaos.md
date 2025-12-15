+++
title = "Moonpool Chronicles, Part 1: Simulating TCP Chaos"
description = "Building a deterministic network simulator in Rust with partitions, bit flips, and creative failure modes"
date = 2025-12-15
draft = true
[taxonomies]
tags = ["rust", "simulation", "deterministic", "distributed-systems", "moonpool-chronicles", "testing", "networking"]
+++

> [Moonpool Chronicles](/tags/moonpool-chronicles/) documents my journey building a deterministic simulation framework in Rust, backporting patterns from FoundationDB and TigerBeetle.

<!-- TODO: Opening hook linking back to FDB simulation post -->
<!-- Reference: /posts/diving-into-foundationdb-simulation/ -->
<!-- Hook idea: "In my previous post, I showed how FDB's g_network swaps between Net2 and Sim2. Here's how I rebuilt that in Rust, and all the ways I can break your network." -->

## The Foundation: Provider Traits

<!-- TODO: Explain the core insight -->
- Distributed systems interact with the outside world through only 4 operations
- Time (sleep, timeout, now)
- Networking (connect, listen, accept)
- Task spawning (spawn, yield)
- Randomness (deterministic seeding)

<!-- TODO: Show TimeProvider trait -->
<!-- File: moonpool-core/src/time.rs -->
- `sleep(duration)` - async sleep
- `now()` - canonical time
- `timer()` - drifted time (can be ahead of now by up to 100ms)
- `timeout(duration, future)` - race between future and timeout

<!-- TODO: Show NetworkProvider trait -->
<!-- File: moonpool-core/src/network.rs -->
- `bind(addr)` -> TcpListener
- `connect(addr)` -> TcpStream

<!-- TODO: Explain the swap -->
- Same application code runs with SimNetworkProvider (simulation) or TokioNetworkProvider (production)
- No `tokio::` calls in application code, only provider trait methods

<!-- TODO: Explain now() vs timer() -->
- `now()` is canonical, monotonic, used for scheduling
- `timer()` can drift ahead (simulates real-world clock skew)
- Tests timeout/lease/heartbeat code

## The SimWorld Event Loop

<!-- TODO: Explain single-threaded determinism -->
<!-- File: moonpool-sim/src/sim/world.rs -->
- All actors run in one thread
- No race conditions possible
- Same seed = same execution path

<!-- TODO: Show event queue structure -->
- BinaryHeap ordered by (time, sequence_number)
- Sequence number ensures deterministic ordering when events have same timestamp

<!-- TODO: Explain logical time -->
- Time only advances when events are processed
- Can skip idle periods instantly
- Years of uptime in seconds of testing

<!-- TODO: Explain async integration -->
<!-- File: moonpool-sim/src/sim/sleep.rs -->
- SleepFuture schedules Timer event
- Registers waker via register_task_waker()
- Returns Poll::Pending until event fires

## TCP in Software

<!-- TODO: Explain connection state -->
<!-- File: moonpool-sim/src/sim/state.rs -->
- send_buffer, receive_buffer (VecDeque<u8>)
- FIFO ordering guaranteed (matches real TCP)
- send_closed, recv_closed for asymmetric closure

<!-- TODO: Explain ephemeral address synthesis -->
<!-- File: moonpool-sim/src/sim/world.rs lines 514-542 -->
- Client sees server's listening address
- Server sees synthesized ephemeral address (modified client IP + random port 40000-60000)
- Matches real TCP behavior
- FDB reference: sim2.actor.cpp:1149-1175

<!-- TODO: Explain graceful vs abrupt shutdown -->
- Graceful: FIN exchange, buffers drain
- Abrupt: RST, immediate closure
- Half-open connections: peer crashed, we don't know yet

## Breaking Networks: Chaos Mechanisms

### Clogging

<!-- TODO: Explain clogging -->
<!-- File: moonpool-sim/src/network/config.rs -->
- Temporary write/read blocking
- `should_clog_write()` returns true probabilistically
- Duration from clog_duration range
- poll_write returns Pending until clog expires

### Partitions

<!-- TODO: Explain partitions -->
- IP-pair based: can partition specific src/dst pairs
- Directional: partition_send_from (all sends), partition_recv_to (all receives)
- Duration-based: automatic restoration via PartitionRestore event

### Bit Flipping

<!-- TODO: Explain bit flipping -->
- Probability: 0.01% per write operation
- Power-law distribution: `32 - floor(log2(random))` (1-32 bits)
- Tests checksum validation
- FDB reference: FlowTransport.actor.cpp:1297

### Random Close

<!-- TODO: Explain random close -->
- FDB's rollRandomClose pattern
- Probability: 0.001% per I/O operation
- Cooldown: 5 seconds (prevents cascading)
- Modes: 30% explicit error vs 70% silent (asymmetric closure)

### Connect Failures

<!-- TODO: Explain connect failure modes -->
<!-- File: moonpool-sim/src/network/sim/provider.rs:77-149 -->
```rust
pub enum ConnectFailureMode {
    Disabled,           // Normal connections
    AlwaysFail,         // Always fail with ConnectionRefused when buggified
    Probabilistic,      // 50% error, 50% hang forever
}
```
- AlwaysFail: tests immediate reconnection logic
- Probabilistic: tests both error recovery AND timeout handling
- The hang path is crucial: tests timeout expiry mechanisms

### Clock Drift

<!-- TODO: Explain clock drift -->
- `timer()` can be 0-100ms ahead of `now()`
- Tests lease expiry, heartbeat timing, leader election
- FDB formula: interpolate timer toward (time + drift_max)

## ChaosConfiguration

<!-- TODO: Show the struct -->
<!-- File: moonpool-sim/src/network/config.rs -->

| Mechanism | Default | What it tests |
|-----------|---------|---------------|
| TCP latencies | 1-11ms connect | Async scheduling |
| Random connection close | 0.001% | Reconnection, redelivery |
| Bit flip corruption | 0.01% | Checksum validation |
| Connect failure | 50% probabilistic | Timeout handling, retries |
| Clock drift | 100ms max | Leases, heartbeats |
| Partial writes | 1000 bytes max | Message fragmentation |

<!-- TODO: Show presets -->
- `ChaosConfiguration::default()` - FDB-style defaults
- `ChaosConfiguration::disabled()` - No chaos (fast tests)
- `ChaosConfiguration::random_for_seed()` - Randomized per seed

## What's Next

<!-- TODO: Tease Part 2 -->
Network chaos is external. But the nastiest bugs hide in error paths your code rarely executes. In Part 2, we'll explore **buggify**: how to inject failures at the code level, and how to prove your system survived the chaos.

---

Feel free to reach out with any questions or to share your experiences with simulation testing. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

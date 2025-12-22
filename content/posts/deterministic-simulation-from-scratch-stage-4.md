+++
title = "Deterministic Simulation from Scratch, Stage 4: Transport & Peers"
description = "FDB-compatible transport abstractions let you inject deterministic network chaos."
date = 2025-12-22
draft = true
[taxonomies]
tags = ["moonpool", "rust", "simulation", "deterministic", "distributed-systems", "testing"]
+++

> This post is part of **Deterministic Simulation from Scratch**, a series about building [moonpool](https://github.com/PierreZ/moonpool), a deterministic simulation testing framework for Rust inspired by FoundationDB. Each Stage builds on the previous one. Start with [Stage 1](/posts/deterministic-simulation-from-scratch-stage-1/) or jump to any Stage: [Stage 2](/posts/deterministic-simulation-from-scratch-stage-2/), [Stage 3](/posts/deterministic-simulation-from-scratch-stage-3/).

Networks do not fail cleanly. They flap. They partition. They reconnect in storms that overwhelm your retry logic. I learned this operating a 70+ node Hadoop cluster that refused to restart after a network partition. The bug was in the recovery path. Code that only runs during failures is the hardest to test. Unless you have simulation.

The `Peer` abstraction uses all three previous Stages: `NetworkProvider` for connections ([Stage 1](/posts/deterministic-simulation-from-scratch-stage-1/)), `SimWorld` timers for backoff delays ([Stage 2](/posts/deterministic-simulation-from-scratch-stage-2/)), and `buggify!` to inject connection failures ([Stage 3](/posts/deterministic-simulation-from-scratch-stage-3/)).

## The Transport Architecture

Moonpool's transport layer stacks abstractions like FoundationDB's FlowTransport:

```
┌─────────────────────────────────────────────────┐
│              Application Code                   │
│         Uses NetTransport + RPC                 │
├─────────────────────────────────────────────────┤
│     NetTransport (endpoint routing)             │
│     • Multiplexes connections per endpoint      │
│     • Request/response with correlation         │
├─────────────────────────────────────────────────┤
│     Peer (connection management)                │
│     • Automatic reconnection with backoff       │
│     • Message queuing during disconnection      │
├─────────────────────────────────────────────────┤
│     Wire Format (serialization)                 │
│     • Length-prefixed packets                   │
│     • CRC32C checksums                          │
└─────────────────────────────────────────────────┘
```

Each layer has a single responsibility. Wire format handles bytes. Peer handles a single connection's lifecycle. NetTransport routes messages to the right peer. Application code speaks in typed requests and responses.

## The Peer Abstraction

A Peer manages one connection to a remote address. It handles the messy reality of networks:

```rust
pub struct Peer<N, T, TP> {
    config: PeerConfig,
    address: String,
    state: Rc<RefCell<PeerState>>,
    metrics: PeerMetrics,
    // ... network, time, task providers
}
```

The state machine is implicit in the connection lifecycle: disconnected, connecting, connected, backing off after failure. The Peer hides this complexity from callers.

**PeerConfig** controls retry behavior:

```rust
pub struct PeerConfig {
    pub initial_reconnect_delay: Duration,  // default: 100ms
    pub max_reconnect_delay: Duration,      // default: 30s
    pub max_queue_size: usize,              // default: 1000
    pub connection_timeout: Duration,       // default: 5s
    pub max_connection_failures: Option<u32>,
}
```

**Exponential backoff** prevents thundering herd on recovery:

```rust
let next_delay = std::cmp::min(
    state.reconnect_state.current_delay * 2,
    config.max_reconnect_delay,
);
state.reconnect_state.current_delay = next_delay;
```

Each failure doubles the delay until hitting the cap. In simulation, this uses `sim_random_range()` from [Stage 2](/posts/deterministic-simulation-from-scratch-stage-2/) for any jitter, ensuring deterministic backoff timing.

**Message queuing** during disconnection is critical. When a peer disconnects, messages queue up instead of failing immediately. When the connection restores, the queue drains in order. This provides at-least-once delivery semantics that applications can build on.

The Peer tracks metrics for observability: connection attempts, successes, failures, messages sent/received, current queue size. In simulation, these metrics help verify that chaos actually exercised the reconnection paths.

## NetTransport and RPC

NetTransport provides FDB-compatible endpoint addressing. Every message routes to an `Endpoint`:

```rust
pub struct Endpoint {
    pub address: NetworkAddress,
    pub token: UID,
}
```

The `UID` is a 128-bit unique identifier. Well-known tokens (like `Ping = 1`) provide stable addressing for system services. Dynamic tokens identify specific request/response pairs.

**EndpointMap** routes incoming messages:

```rust
impl EndpointMap {
    pub fn register(&self, token: UID, receiver: impl MessageReceiver);
    pub fn dispatch(&self, token: UID, payload: &[u8]);
}
```

Well-known tokens (0-63) use O(1) array lookup. Dynamic tokens use a HashMap. This hybrid approach optimizes for both common system messages and arbitrary RPC.

RPC builds on this foundation. `RequestStream<T>` receives typed requests. `ReplyPromise<T>` sends typed responses. `ReplyFuture<T>` awaits the response:

```rust
// Client side
let response: PongResponse = send_request(
    &transport,
    &server_endpoint,
    PingRequest { id: 42 },
    JsonCodec,
).await?;

// Server side
let request_stream: RequestStream<PingRequest, JsonCodec> =
    transport.register_handler(PING_TOKEN);

while let Some(envelope) = request_stream.recv().await {
    envelope.reply.send(PongResponse { id: envelope.request.id });
}
```

The `MessageCodec` trait makes serialization pluggable. `JsonCodec` uses serde_json. You could implement protobuf or bincode.

## Wire Format

Packets are length-prefixed with CRC32C checksums:

```rust
pub const HEADER_SIZE: usize = 24;  // 4 (len) + 4 (crc) + 16 (token)
pub const MAX_PAYLOAD_SIZE: usize = 1024 * 1024;  // 1MB
```

The structure is simple:

```
+------------------+------------------+------------------+
| Length (4 bytes) | CRC32C (4 bytes) | Token (16 bytes) |
+------------------+------------------+------------------+
| Payload (N bytes)                                      |
+--------------------------------------------------------+
```

CRC32C catches corruption from bit flips. In simulation, the chaos configuration can inject bit flips at configurable probability (default 0.01%). The checksum catches them, and the connection handles the error.

Serialization and deserialization are straightforward:

```rust
pub fn serialize_packet(token: UID, payload: &[u8]) -> Result<Vec<u8>, WireError>;
pub fn deserialize_packet(data: &[u8]) -> Result<(UID, Vec<u8>), WireError>;
```

Errors include `ChecksumMismatch`, `PacketTooLarge`, and `InsufficientData` for partial reads.

## Chaos in the Network Layer

How does `ChaosConfiguration` from [Stage 3](/posts/deterministic-simulation-from-scratch-stage-3/) apply to transport?

**Connection failures** use `ConnectFailureMode`:
- `AlwaysFail` tests immediate reconnection logic
- `Probabilistic` tests both error recovery AND timeout handling (50% error, 50% hang)

**Random connection cutting** (0.001% per I/O operation) tests unexpected disconnection. The Peer detects the failure, backs off, and reconnects.

**Bit flip corruption** tests the checksum path. When a flip occurs, `deserialize_packet` returns `ChecksumMismatch`, and the connection resets.

**Latency injection** exercises timeout handling. Connections take 1-50ms to establish in chaos mode, testing async scheduling and timeout races.

The transport layer uses `sometimes_assert!` to verify chaos is exercised:

```rust
sometimes_assert!(
    peer_reconnected_after_failure,
    self.metrics.connection_failures > 0 && self.metrics.connections_established > 1,
    "Peer should experience and recover from connection failures"
);
```

If this never fires, your chaos is not reaching the transport layer.

## The One Takeaway

FDB-compatible transport abstractions let you inject deterministic network chaos. Partitions, delays, and failures reproduce exactly when you need to debug them.

## Series Conclusion

Four Stages. Four layers of abstraction. The same code that runs in simulation runs in production. The same seed that found the bug reproduces it perfectly.

[Stage 1](/posts/deterministic-simulation-from-scratch-stage-1/) established provider traits as the foundation. Swap implementations to change physics.

[Stage 2](/posts/deterministic-simulation-from-scratch-stage-2/) built SimWorld for deterministic time and randomness. The seed is your replay button.

[Stage 3](/posts/deterministic-simulation-from-scratch-stage-3/) added structured chaos with BUGGIFY and proof it happened with `sometimes_assert!`.

[Stage 4](/posts/deterministic-simulation-from-scratch-stage-4/) applied everything to networking. Resilient connections that survive the chaos.

This is how [FoundationDB achieved legendary reliability](/posts/diving-into-foundationdb-simulation/). [Moonpool](https://github.com/PierreZ/moonpool) brings that power to Rust. The code is open source. Try it on your distributed system. Find the bugs hiding in your recovery paths.

---

Feel free to reach out with any questions or to share your experiences with deterministic simulation testing. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

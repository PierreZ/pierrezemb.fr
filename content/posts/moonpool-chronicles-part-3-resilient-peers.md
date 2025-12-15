+++
title = "Moonpool Chronicles, Part 3: Building Resilient Peers"
description = "Implementing FDB-style connection management with exponential backoff, message queuing, and RPC in Rust"
date = 2025-12-15
draft = true
[taxonomies]
tags = ["rust", "simulation", "deterministic", "distributed-systems", "moonpool-chronicles", "networking", "rpc"]
+++

> [Moonpool Chronicles](/tags/moonpool-chronicles/) documents my journey building a deterministic simulation framework in Rust, backporting patterns from FoundationDB and TigerBeetle.

<!-- TODO: Opening hook -->
<!-- Hook idea: "FDB's FlowTransport handles connection failures gracefully: exponential backoff, message queuing, automatic reconnection. Here's the Rust version." -->
<!-- Link back to Part 2: /posts/moonpool-chronicles-part-2-buggify-and-correctness/ -->

## The Architecture

<!-- TODO: Show the layer stack -->
```
Application Code (NetTransport + RPC)
    |
NetTransport (endpoint routing & multiplexing)
    |
Peer (connection management & backoff)
    |
Wire Format (serialization with CRC32C)
```

<!-- TODO: Explain each layer's responsibility -->
- **Wire Format**: Serialize/deserialize with integrity checks
- **Peer**: Maintain connection, handle failures, queue messages
- **NetTransport**: Route messages to endpoints, multiplex connections
- **Application**: Send typed requests, receive typed responses

## The Peer Abstraction

<!-- TODO: Explain FDB's Peer concept -->
<!-- File: moonpool-transport/src/peer/ -->
<!-- FDB reference: FlowTransport.h:147-191 -->

- One Peer per remote address
- Manages the TCP connection lifecycle
- Handles automatic reconnection with backoff
- Queues messages during disconnection

### Connection Lifecycle

<!-- TODO: Show state machine -->
```
Disconnected -> Connecting -> Connected -> Disconnected
                    |              |
                    v              v
              (backoff)     (send/recv)
```

<!-- TODO: Explain PeerConfig -->
```rust
pub struct PeerConfig {
    pub connect_timeout: Duration,
    pub initial_backoff: Duration,
    pub max_backoff: Duration,
    pub backoff_multiplier: f64,
}
```

### Exponential Backoff with Jitter

<!-- TODO: Explain backoff strategy -->
- Initial backoff: small (e.g., 100ms)
- Multiply on each failure (e.g., 2x)
- Cap at max backoff (e.g., 30s)
- Add jitter to prevent thundering herd

<!-- TODO: Show implementation -->
<!-- File: moonpool-transport/src/peer/mod.rs -->

### Message Queuing

<!-- TODO: Explain queuing during disconnection -->
- Messages sent while disconnected go to queue
- When connection restored, drain queue in order
- Configurable queue limits
- Back-pressure when queue full

### Connection Monitoring

<!-- TODO: Explain health checks -->
- Periodic ping/pong or application-level heartbeat
- Detect half-open connections
- Trigger reconnection on timeout

## Wire Format

<!-- TODO: Explain the wire protocol -->
<!-- File: moonpool-transport/src/wire/ -->
<!-- FDB reference: Net2Packet.h -->

### Packet Structure

```
+----------------+----------------+----------------+
| Length (4 bytes) | CRC32C (4 bytes) | Payload      |
+----------------+----------------+----------------+
```

- Length-prefixed for framing
- CRC32C checksum for integrity
- Catches bit flips from simulation chaos

<!-- TODO: Show serialization functions -->
```rust
pub fn serialize_packet(payload: &[u8]) -> Vec<u8>;
pub fn deserialize_packet(data: &[u8]) -> Result<Vec<u8>, WireError>;
```

<!-- TODO: Explain constants -->
- `HEADER_SIZE`: 8 bytes (length + CRC)
- `MAX_PAYLOAD_SIZE`: configurable limit

## NetTransport and Endpoint Routing

<!-- TODO: Explain NetTransport -->
<!-- File: moonpool-transport/src/rpc/ -->

### Endpoint Addressing

<!-- TODO: Explain UID and tokens -->
<!-- File: moonpool-core/src/types.rs -->
- **UID**: 128-bit unique identifier
- **WellKnownToken**: Reserved tokens for system services (e.g., `first = u64::MAX`)
- **Endpoint**: NetworkAddress + Token

<!-- TODO: Explain EndpointMap -->
- Maps Token -> MessageReceiver
- Well-known endpoints registered at startup
- Dynamic endpoints for request/response patterns

### Building the Transport

<!-- TODO: Show NetTransportBuilder -->
```rust
let transport = NetTransportBuilder::new(network, time)
    .build();
```

## RPC Primitives

<!-- TODO: Explain the RPC abstraction -->

### ReplyPromise<T>

<!-- TODO: Explain ReplyPromise -->
- Represents a pending response from a remote node
- Serialized across the network
- Automatically spawns `networkSender` actor on deserialize
- Rust equivalent of FDB's Promise serialization

### RequestStream<T>

<!-- TODO: Explain RequestStream -->
- Incoming request handler
- Typed: only receives messages of type T
- Used for service registration

### NetNotifiedQueue<T>

<!-- TODO: Explain NetNotifiedQueue -->
- Typed message receiver
- Async notification when messages arrive
- Used with endpoint registration

### send_request()

<!-- TODO: Show send_request function -->
```rust
let response: PongResponse = send_request(&transport, endpoint, ping).await?;
```

- Typed RPC call
- Handles serialization/deserialization
- Integrates with Peer for reliable delivery

## Example: Ping Pong

<!-- TODO: Reference the example -->
<!-- File: moonpool-transport/examples/ping_pong.rs -->

### Server Side

<!-- TODO: Show server registration -->
```rust
// Register typed handler for PingRequest
transport.register_endpoint(PING_TOKEN, |request: PingRequest| {
    PongResponse { id: request.id }
});
```

### Client Side

<!-- TODO: Show client sending -->
```rust
let endpoint = Endpoint::new(server_addr, PING_TOKEN);
let response: PongResponse = send_request(&transport, endpoint, PingRequest { id: 42 }).await?;
assert_eq!(response.id, 42);
```

## What's Next

<!-- TODO: Closing thoughts -->
With the transport layer in place, moonpool has all the pieces for building simulated distributed systems:

- **Part 1**: Network simulation with chaos injection
- **Part 2**: Code-level fault injection and correctness proofs
- **Part 3**: Resilient peer connections and RPC

<!-- TODO: Tease future content -->
What patterns would you like to see backported next? TigerBeetle's approach to storage? Something else from the distributed systems canon?

---

Feel free to reach out with any questions or to share your experiences building resilient distributed systems. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

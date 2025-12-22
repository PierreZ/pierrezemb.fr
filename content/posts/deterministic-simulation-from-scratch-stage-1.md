+++
title = "Deterministic Simulation from Scratch, Stage 1: Provider Traits"
description = "Provider traits are dependency injection for physics. Swap implementations to control time, network, and randomness."
date = 2025-12-22
draft = true
[taxonomies]
tags = ["moonpool", "rust", "simulation", "deterministic", "distributed-systems", "testing"]
+++

> This post is part of **Deterministic Simulation from Scratch**, a series about building [moonpool](https://github.com/PierreZ/moonpool), a deterministic simulation testing framework for Rust inspired by FoundationDB. Each Stage builds on the previous one. Start here or jump to any Stage: [Stage 2](/posts/deterministic-simulation-from-scratch-stage-2/), [Stage 3](/posts/deterministic-simulation-from-scratch-stage-3/), [Stage 4](/posts/deterministic-simulation-from-scratch-stage-4/).

The first time I ran moonpool with a real seed, `commit_unknown_result` fired immediately. In production, this edge case surfaces once every few months. In simulation? The first seed. That moment validated everything I had been building.

But how do you write code that runs identically in simulation and production? The answer is embarrassingly simple: **you swap the interfaces**.

## The Interface Swapping Philosophy

When I first read about [FoundationDB's simulation framework](/posts/diving-into-foundationdb-simulation/), one detail stuck with me. The same binary runs in production and in simulation. No separate test harness. No mocking framework. Just a compile-time flag that swaps `Net2` for `Sim2`.

The insight is powerful: **distributed systems interact with the outside world through only a handful of operations**. Time. Networking. Task spawning. Randomness. If you control these four, you control the entire execution.

FoundationDB calls this pattern `INetwork` and `IConnection`. I call them **provider traits**. The name comes from dependency injection, but the concept is deeper. You are not injecting dependencies. You are injecting physics. Swap the implementation, and your code runs in a different universe where time is logical, networks fail on command, and randomness is reproducible.

This is the foundation of [simulation-driven development](/posts/simulation-driven-development/). Write your application against abstract traits. Run it with real implementations in production. Run it with simulation implementations in tests. Same code. Different rules.

## The Four Provider Traits

Moonpool defines four provider traits in [`moonpool-core`](https://github.com/PierreZ/moonpool). Each one abstracts a fundamental interaction with the outside world.

### TimeProvider

Time is the most important abstraction. In simulation, time does not flow. It jumps.

```rust
pub trait TimeProvider: Send + Sync + 'static {
    fn now(&self) -> Duration;
    fn timer(&self) -> Duration;
    async fn sleep(&self, duration: Duration) -> SimulationResult<()>;
    async fn timeout<F, T>(&self, duration: Duration, future: F)
        -> SimulationResult<Result<T, ()>>;
}
```

Two time functions might seem redundant, but they serve different purposes. `now()` returns the canonical simulation time. `timer()` can drift ahead by up to 100ms. This simulates real-world clock skew and tests your lease expiry, heartbeat timing, and leader election code.

### NetworkProvider

Networking is where chaos lives. The trait is deceptively simple:

```rust
pub trait NetworkProvider: Send + Sync + 'static {
    type TcpStream: AsyncRead + AsyncWrite + Unpin + 'static;
    type TcpListener: TcpListenerTrait<TcpStream = Self::TcpStream> + 'static;

    async fn bind(&self, addr: &str) -> io::Result<Self::TcpListener>;
    async fn connect(&self, addr: &str) -> io::Result<Self::TcpStream>;
}
```

The associated types are the key. `TcpStream` could be a real Tokio stream. Or it could be a simulated stream that randomly corrupts bytes, drops connections, and partitions your network. Same interface. Very different behavior.

### RandomProvider

Randomness must be reproducible. Same seed, same sequence:

```rust
pub trait RandomProvider: Send + Sync + 'static {
    fn random<T>(&self) -> T where StandardUniform: Distribution<T>;
    fn random_range<T>(&self, range: Range<T>) -> T
        where T: SampleUniform + PartialOrd;
    fn random_ratio(&self) -> f64;
    fn random_bool(&self, probability: f64) -> bool;
}
```

Every call to `random()` in your application flows through this trait. In simulation, a seeded RNG ensures the same decisions happen in the same order. Run the test with seed 42, and you get the exact same execution every time.

### TaskProvider

Task spawning needs a name for debugging:

```rust
pub trait TaskProvider: Send + Sync + 'static {
    fn spawn_task<F>(&self, name: &str, future: F) -> JoinHandle<()>
    where F: Future<Output = ()> + Send + 'static;

    async fn yield_now(&self);
}
```

The `name` parameter is crucial for debugging. When a test fails at seed 12345, you want to know which task was running. The simulation runtime can log every task switch with its name.

## Sim vs Tokio Implementations

Each provider trait has two implementations. One for production, one for simulation.

**TimeProvider** has `TokioTimeProvider` and `SimTimeProvider`. The Tokio version delegates to `tokio::time::sleep`. The simulation version registers with the event queue. When you await a `SleepFuture` in simulation, time does not actually pass. The future returns `Poll::Pending`, and the simulation advances the clock to the wake time when all tasks are blocked.

**NetworkProvider** has `TokioNetworkProvider` and `SimNetworkProvider`. The Tokio version wraps real TCP. The simulation version creates in-memory channels with configurable chaos: latency, partitions, corruption, random disconnection.

**RandomProvider** has a Tokio-compatible version that uses the `rand` crate and `SimRandomProvider` that uses a seeded RNG tied to the simulation state.

**TaskProvider** has `TokioTaskProvider` and works with the simulation event loop for deterministic scheduling.

The pattern is always the same. Your application code looks like this:

```rust
async fn my_server<T: TimeProvider, N: NetworkProvider>(
    time: &T,
    network: &N,
) -> Result<(), Error> {
    let listener = network.bind("0.0.0.0:8080").await?;
    loop {
        let (stream, _) = listener.accept().await?;
        time.sleep(Duration::from_millis(100)).await?;
        handle_connection(stream).await?;
    }
}
```

No Tokio imports. No direct system calls. Just trait bounds. The same function runs in production with real networking and real time. In simulation, it runs with controlled chaos.

## The Crate Architecture

Moonpool splits these concerns across three crates:

```
┌─────────────────────────────────────────────────┐
│           moonpool (facade crate)               │
│         Re-exports all functionality            │
├─────────────────────────────────────────────────┤
│  moonpool-transport    │    moonpool-sim        │
│  • Peer connections    │    • SimWorld runtime  │
│  • Wire format         │    • Chaos testing     │
│  • RPC primitives      │    • Buggify macros    │
├─────────────────────────────────────────────────┤
│              moonpool-core                      │
│  Provider traits: Time, Task, Network, Random   │
│  Core types: UID, Endpoint, NetworkAddress      │
└─────────────────────────────────────────────────┘
```

`moonpool-core` defines only abstractions. No simulation logic. No networking code. Just traits and core types like `UID` (128-bit unique identifier, FDB-compatible), `Endpoint` (address + token for routing), and `NetworkAddress` (IP + port + flags).

`moonpool-sim` implements the deterministic runtime. This is where `SimWorld` lives, along with the event queue, chaos configuration, and buggify macros.

`moonpool-transport` provides FDB-style networking abstractions. Peer connections with automatic reconnection. RPC with typed requests and responses. This layer uses provider traits, so it works in both simulation and production.

## The One Takeaway

Provider traits are the foundation of everything that follows. Every Stage in this series assumes you understand this swap: **same application code, different universe rules**.

But swapping interfaces only works if the simulation can actually control time. In [Stage 2](/posts/deterministic-simulation-from-scratch-stage-2/), we build the event loop that makes logical time possible. When all futures are blocked, time advances. Years of uptime compress into seconds of testing.

---

Feel free to reach out with any questions or to share your experiences with deterministic simulation testing. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

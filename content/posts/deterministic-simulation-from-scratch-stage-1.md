+++
title = "Deterministic Simulation from Scratch, Stage 1: Provider Traits"
description = "Provider traits are dependency injection for physics. Swap implementations to control time, network, and randomness."
date = 2025-12-22
draft = true
[taxonomies]
tags = ["moonpool", "rust", "simulation", "deterministic", "distributed-systems", "testing"]
+++

> This post is part of **Deterministic Simulation from Scratch**, a series about building [moonpool](https://github.com/PierreZ/moonpool), a deterministic simulation testing framework for Rust inspired by FoundationDB. Each Stage builds on the previous one. Start here or jump to any Stage: [Stage 2](/posts/deterministic-simulation-from-scratch-stage-2/), [Stage 3](/posts/deterministic-simulation-from-scratch-stage-3/), [Stage 4](/posts/deterministic-simulation-from-scratch-stage-4/).

I wanted to truly understand deterministic simulation testing. Not just read about it. Build it.

FoundationDB's approach to testing fascinated me ever since I [dove into their simulation framework](/posts/diving-into-foundationdb-simulation/). The idea that you could compress years of production chaos into seconds of deterministic testing felt like a superpower worth acquiring. But the FDB codebase is written in Flow, a custom language that transpiles to C++. Understanding the core ideas meant navigating hundreds of thousands of lines of unfamiliar code. On my free time, that exploration would take years.

LLMs changed the equation. I used them extensively to convert Flow idioms to Rust, to explain FDB's internal patterns, and to help me understand design decisions buried in decades-old code. What would have been impossible became feasible. [Moonpool](https://github.com/PierreZ/moonpool) exists because I could finally explore FDB's simulation architecture at a pace my schedule allowed.

The first lesson from that exploration? **The entire framework rests on a simple foundation: interface swapping.**

## The Interface Swapping Philosophy

When I studied [FoundationDB's simulation](/posts/diving-into-foundationdb-simulation/), one detail stuck with me. The same binary runs in production and in simulation. No separate test harness. No mocking framework. Just a compile-time flag that swaps `Net2` for `Sim2`.

The insight is powerful: **distributed systems interact with the outside world through only a handful of operations.** Time. Networking. Task spawning. Randomness. Control these four, and you control the entire execution.

FoundationDB calls this pattern `INetwork` and `IConnection`. I call them **provider traits**. The name comes from dependency injection, but the concept is deeper. You are not injecting dependencies. You are injecting physics. Swap the implementation, and your code runs in a different universe where time is logical, networks fail on command, and randomness is reproducible.

This is the foundation of [simulation-driven development](/posts/simulation-driven-development/). Write your application against abstract traits. Run it with real implementations in production. Run it with simulation implementations in tests. Same code. Different rules.

## The Four Provider Traits

Moonpool defines four provider traits in [`moonpool-core`](https://github.com/PierreZ/moonpool/tree/main/moonpool-core). Each one abstracts a fundamental interaction with the outside world.

### TimeProvider

Time is the most important abstraction. In simulation, time does not flow. It jumps.

```rust
#[async_trait(?Send)]
pub trait TimeProvider: Clone {
    async fn sleep(&self, duration: Duration) -> SimulationResult<()>;
    fn now(&self) -> Duration;
    fn timer(&self) -> Duration;
    async fn timeout<F, T>(&self, duration: Duration, future: F)
        -> SimulationResult<Result<T, ()>>
    where
        F: std::future::Future<Output = T>;
}
```

Two time functions might seem redundant, but they serve different purposes. `now()` returns the canonical simulation time, precise and consistent. `timer()` can drift ahead by up to 100ms in simulation. This intentional drift tests your lease expiration logic, heartbeat timing, and leader election code. In production, the two are identical. In simulation, they diverge to expose timing bugs.

### NetworkProvider

Networking is where chaos lives. The trait is deceptively simple:

```rust
#[async_trait(?Send)]
pub trait NetworkProvider: Clone {
    type TcpStream: AsyncRead + AsyncWrite + Unpin + 'static;
    type TcpListener: TcpListenerTrait<TcpStream = Self::TcpStream> + 'static;

    async fn bind(&self, addr: &str) -> io::Result<Self::TcpListener>;
    async fn connect(&self, addr: &str) -> io::Result<Self::TcpStream>;
}
```

The associated types are the key design choice here. `TcpStream` could be a real Tokio stream. Or it could be a simulated stream that randomly corrupts bytes, drops connections, and partitions your network. Using associated types instead of trait objects preserves type information at compile time. Same interface. Very different behavior. Zero runtime dispatch overhead.

### RandomProvider

Randomness must be reproducible. Same seed, same sequence:

```rust
pub trait RandomProvider: Clone {
    fn random<T>(&self) -> T
        where StandardUniform: Distribution<T>;
    fn random_range<T>(&self, range: Range<T>) -> T
        where T: SampleUniform + PartialOrd;
    fn random_ratio(&self) -> f64;
    fn random_bool(&self, probability: f64) -> bool;
}
```

Every call to `random()` in your application flows through this trait. In simulation, a seeded RNG ensures the same decisions happen in the same order. Run the test with seed 42, and you get the exact same execution every time. When a test fails, the seed becomes your replay button.

### TaskProvider

Task spawning needs a name for debugging:

```rust
#[async_trait(?Send)]
pub trait TaskProvider: Clone {
    fn spawn_task<F>(&self, name: &str, future: F) -> JoinHandle<()>
    where
        F: Future<Output = ()> + 'static;

    async fn yield_now(&self);
}
```

The `name` parameter is crucial for debugging. When a test fails at seed 12345, you want to know which task was running. The runtime can log every task switch with its name, making it possible to trace exactly what happened before the failure.

## The Providers Bundle

Four type parameters get tedious quickly. Every struct that needs providers would look like this:

```rust
struct MyServer<N, T, TP, R>
where
    N: NetworkProvider + Clone + 'static,
    T: TimeProvider + Clone + 'static,
    TP: TaskProvider + Clone + 'static,
    R: RandomProvider + Clone + 'static,
{
    network: N,
    time: T,
    // ... and so on
}
```

The `Providers` trait bundles all four into a single type parameter:

```rust
pub trait Providers: Clone + 'static {
    type Network: NetworkProvider + Clone + 'static;
    type Time: TimeProvider + Clone + 'static;
    type Task: TaskProvider + Clone + 'static;
    type Random: RandomProvider + Clone + 'static;

    fn network(&self) -> &Self::Network;
    fn time(&self) -> &Self::Time;
    fn task(&self) -> &Self::Task;
    fn random(&self) -> &Self::Random;
}
```

Now the same struct becomes:

```rust
struct MyServer<P: Providers> {
    providers: P,
}
```

The bundle pattern propagates cleanly through your entire codebase. One type parameter instead of four. One where clause instead of four. The accessor methods provide individual providers when you need them.

## Sim vs Tokio Implementations

Each provider trait has two implementations. One for production, one for simulation.

**TokioProviders** bundles the production implementations:

```rust
#[derive(Clone)]
pub struct TokioProviders {
    network: TokioNetworkProvider,
    time: TokioTimeProvider,
    task: TokioTaskProvider,
    random: TokioRandomProvider,
}
```

`TokioTimeProvider` delegates to `tokio::time::sleep`. `TokioNetworkProvider` wraps real TCP. `TokioRandomProvider` uses thread-local RNG. Nothing surprising. Just pass-through to Tokio.

**SimProviders** bundles the simulation implementations:

```rust
#[derive(Clone)]
pub struct SimProviders {
    network: SimNetworkProvider,
    time: SimTimeProvider,
    task: TokioTaskProvider,  // Same as production
    random: SimRandomProvider,
}
```

`SimTimeProvider` registers with the event queue. When you await a sleep in simulation, time does not actually pass. The future returns `Poll::Pending`, and the simulation advances the clock to the wake time when all tasks are blocked. `SimNetworkProvider` creates in-memory channels with configurable chaos: latency, partitions, corruption, random disconnection. `SimRandomProvider` uses a seeded RNG tied to the simulation state.

Notice that `task` uses the same `TokioTaskProvider` in both. Task spawning does not need simulation-specific behavior. What matters is that spawned tasks run single-threaded for determinism.

Your application code looks like this:

```rust
async fn my_server<P: Providers>(providers: &P) -> Result<(), Error> {
    let listener = providers.network().bind("0.0.0.0:8080").await?;
    loop {
        let (stream, _) = listener.accept().await?;
        providers.time().sleep(Duration::from_millis(100)).await?;
        handle_connection(stream).await?;
    }
}
```

No Tokio imports. No direct system calls. Just the `Providers` bound. The same function runs in production with real networking and real time. In simulation, it runs with controlled chaos.

## The Crate Architecture

Moonpool splits these concerns across five crates:

```
┌─────────────────────────────────────────────────┐
│           moonpool (facade crate)               │
│         Re-exports all functionality            │
├─────────────────────────────────────────────────┤
│  moonpool-transport    │    moonpool-sim        │
│  • Peer connections    │    • SimWorld runtime  │
│  • NetTransport RPC    │    • Chaos testing     │
│  • Wire format         │    • Buggify macros    │
├────────────────────────┴────────────────────────┤
│       moonpool-transport-derive (proc-macros)   │
│       • #[interface] attribute for RPC          │
├─────────────────────────────────────────────────┤
│              moonpool-core                      │
│  Provider traits: Time, Task, Network, Random   │
│  Core types: UID, Endpoint, NetworkAddress      │
└─────────────────────────────────────────────────┘
```

`moonpool-core` defines only abstractions. No simulation logic. No networking code. Just traits and core types like `UID` (128-bit unique identifier, FDB-compatible), `Endpoint` (address + token for routing), and `NetworkAddress` (IP + port + flags).

`moonpool-sim` implements the deterministic runtime. This is where `SimWorld` lives, along with the event queue, chaos configuration, and buggify macros.

`moonpool-transport` provides FDB-style networking abstractions. Peer connections with automatic reconnection. RPC with typed requests and responses. This layer uses provider traits, so it works in both simulation and production.

`moonpool-transport-derive` provides the `#[interface]` proc-macro for deriving RPC boilerplate.

`moonpool` is the facade crate that re-exports everything. Users depend on `moonpool` and get the complete API.

## The One Takeaway

Provider traits are the foundation of everything that follows. Every Stage in this series assumes you understand this swap: **same application code, different universe rules.**

But swapping interfaces only works if the simulation can actually control time. In [Stage 2](/posts/deterministic-simulation-from-scratch-stage-2/), we build the event loop that makes logical time possible. When all futures are blocked, time advances. Years of uptime compress into seconds of testing.

---

Feel free to reach out with any questions or to share your experiences with deterministic simulation testing. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

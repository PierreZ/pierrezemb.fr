+++
title = "Testing: prevention vs discovery"
description = "Most testing prevents old bugs from returning. But what if we built systems where LLMs could actively discover new bugs instead?"
date = 2025-09-08
[taxonomies]
tags = ["testing", "simulation", "deterministic", "llm", "foundationdb"]
+++

While working on [moonpool](https://github.com/PierreZ/moonpool), my hobby project for studying and backporting FoundationDB's low-level engineering concepts (actor model, deterministic simulation, network fault injection), Claude Code did something remarkable: it found a bug I didn't know existed on its own. Not through traditional testing, but through active exploration of edge cases I hadn't considered.

<div style="text-align: center;">

![Claude Code autonomously debugging moonpool](/images/testing-prevention-vs-discovery/claude-moonpool.png)

</div>

Claude identified a faulty seed triggering an edge case, debugged it locally using deterministic replay, and added it to the test suite. All by itself. 🤯 **This wasn't prevention but discovery.** It's time to shift our testing paradigm from preventing regressions to actively discovering unknown bugs.

## Building for Discovery

The difference between prevention and discovery isn't just philosophical but requires completely different system design. Moonpool was built from day one around three principles that enable active bug discovery:

**Deterministic simulation**: Every execution is completely reproducible. Given the same seed, the system makes identical decisions every time. This changes debugging from "I can't reproduce this" to "let me replay exactly what happened." More importantly, it lets LLMs explore the state space step by step without getting lost in non-deterministic noise.

**Controlled failure injection**: Built-in mechanisms intentionally introduce failures in controlled, reproducible ways. This includes timed failures like network delays and disconnects, plus ["buggify" mechanisms](https://transactional.blog/simulation/buggify) that inject faulty internal state at strategic points in the code. Each buggify point is either enabled or disabled for an entire simulation run, creating consistent failure scenarios instead of random chaos. Instead of waiting for production to reveal edge cases, we force the system to encounter dangerous, bug-finding behaviors during development.

**Observability through sometimes assertions**: Borrowed from [Antithesis](https://antithesis.com/docs/best_practices/sometimes_assertions/), these verify we're actually discovering the edge cases we think we're testing. Here's what they look like:

```rust
// Verify that server binds sometimes fail during chaos testing
sometimes_assert!(
    server_bind_fails,
    self.bind_result.is_err(),
    "Server bind should sometimes fail during chaos testing"
);

// Ensure message queues sometimes approach capacity under load
sometimes_assert!(
    peer_queue_near_capacity,
    state.send_queue.len() >= (self.config.max_queue_size as f64 * 0.8) as usize,
    "Message queue should sometimes approach capacity limit"
);
```

Traditional code coverage only tells you "this line was reached." Sometimes assertions verify "this interesting scenario actually happened." If a sometimes assertion never triggers across thousands of test runs, you know you're not discovering the edge cases that matter.

These three elements shift testing from prevention to discovery. Instead of developers writing tests for scenarios they already know about, the system forces them to hit failure modes they haven't thought of. For Claude, this meant it could explore the state space step by step, understanding not just what the code does, but what breaks it.

## The Chaos Environment

Moonpool is currently limited to simulating TCP connections through its Peer abstraction, but even this narrow scope creates a surprisingly rich failure environment. Here's what the chaos testing configuration looks like (borrowed from TigerBeetle's approach):

```rust
impl NetworkRandomizationRanges {
    /// Create chaos testing ranges with connection cutting enabled for distributed systems testing
    pub fn chaos_testing() -> Self {
        Self {
            bind_base_range: 10..200,                       // 10-200µs
            bind_jitter_range: 10..100,                     // 10-100µs
            accept_base_range: 1000..10000,                 // 1-10ms in µs
            accept_jitter_range: 1000..15000,               // 1-15ms in µs
            connect_base_range: 1000..50000,                // 1-50ms in µs
            connect_jitter_range: 5000..100000,             // 5-100ms in µs
            read_base_range: 5..100,                        // 5-100µs
            read_jitter_range: 10..200,                     // 10-200µs
            write_base_range: 50..1000,                     // 50-1000µs
            write_jitter_range: 100..2000,                  // 100-2000µs
            clogging_probability_range: 0.1..0.3,           // 10-30% chance of temporary network congestion
            clogging_base_duration_range: 50000..300000,    // 50-300ms congestion duration in µs
            clogging_jitter_duration_range: 100000..400000, // 100-400ms additional congestion variance in µs
            cutting_probability_range: 0.10..0.20,          // 10-20% cutting chance per tick
            cutting_reconnect_base_range: 200000..800000,   // 200-800ms in µs
            cutting_reconnect_jitter_range: 100000..500000, // 100-500ms in µs
            cutting_max_cuts_range: 1..3,                   // 1-2 cuts per connection max (exclusive upper bound)
        }
    }
}
```

Even with just TCP simulation, this creates a hostile environment where connections randomly fail, messages get delayed, and network operations experience unpredictable latencies. Each seed represents a different combination of timing and probability, creating unique failure scenarios. 

### Why Even Simple Network Code Needs Chaos

You might think testing a simple peer implementation with fault injection is overkill, but production experience and research show otherwise. ["An Analysis of Network-Partitioning Failures in Cloud Systems"](https://www.usenix.org/system/files/osdi18-alquraan.pdf) (OSDI '18) studied real-world failures and found:

- **80%** of network partition failures have catastrophic impact
- **27%** lead to data loss (the most common consequence)
- **90%** of these failures are silent
- **21%** cause permanent damage that persists even after the partition heals
- **83%** need three additional events to manifest

That last point is crucial; exactly the kind of complex interaction that deterministic simulation with fault injection helps uncover.

My peer implementation only does simple ping-pong communication, yet it still took some work to make it robust enough to pass all the checks and assertions. It's enough complexity for Claude to discover edge cases in connection handling, retry logic, and recovery mechanisms.

The breakthrough wasn't that Claude wrote perfect code but that **Claude could discover and explore failure scenarios I hadn't thought to test, then use deterministic replay to debug and fix what went wrong.**

## The Paradigm Shift

The difference between prevention and discovery completely changes how we think about software quality. **Prevention testing asks "did we break what used to work?" Discovery testing asks "what else is broken that we haven't found yet?"**

This shift creates a powerful feedback loop for young engineers and LLMs alike. Both developers and LLMs learn what production failure really looks like, not the sanitized version we imagine. When Claude can explore failure scenarios step by step and immediately see the results through sometimes assertions, it becomes a discovery partner that finds edge cases human intuition misses.

This isn't theoretical. It's working in my hobby project today. Moonpool is definitely hobby-grade, but if a side project can enable LLM-assisted bug discovery, imagine what's possible with production systems designed from the ground up for deterministic testing.

The [FoundationDB](https://github.com/apple/foundationdb), [TigerBeetle](https://tigerbeetle.com/), and [Antithesis](https://antithesis.com/) communities have been practicing discovery-oriented testing for years. FoundationDB's legendary reliability comes from exactly this approach; deterministic simulation that actively hunts for bugs rather than just preventing regressions. After operating FoundationDB in production for 3 years, I can confirm it's by far the most robust and predictable distributed system I've encountered. Everything behaves exactly as documented, with none of the usual distributed systems surprises. I've written more about these ideas in my posts on [simulation-driven development](/posts/simulation-driven-development/) and [notes about FoundationDB](/posts/notes-about-foundationdb/).

**What's new is that LLMs can now participate in this process.** Through deterministic simulation and sometimes assertions, we're not just telling the LLM "write good code" but showing it exactly what production failure looks like. If you're curious about production-grade implementations of these ideas, check out [Antithesis](https://antithesis.com/); their best hidden feature is that it works on any existing system without requiring a rewrite.

The tools exist. The techniques are proven. **Testing must evolve from prevention to discovery.** The future isn't about writing better test cases but about building systems that actively reveal their own bugs.

---

Feel free to reach out with any questions or to share your experiences with deterministic testing. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
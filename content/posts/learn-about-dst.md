+++
title = "So, You Want to Learn More About Deterministic Simulation Testing?"
description = "A curated collection of resources about deterministic simulation testing for distributed systems."
date = 2025-04-11T00:00:00+02:00
[taxonomies]
tags = ["distributed", "testing", "reliability", "simulation", "deterministic"]
+++

I recently attended [BugBash 2025](https://bugbash.antithesis.com/), a software reliability conference organized by Antithesis in Washington, D.C. during April 3-4, 2025. The conference brought together industry experts like Kyle Kingsbury, Ankush Desai, and Mitchell Hashimoto to discuss various aspects of building reliable software, with deterministic simulation testing being a significant focus throughout many of the sessions and discussions.

One of the highlights for me was having the chance to talk with the Antithesis team and meet some of the original creators of FoundationDB. Having operated FoundationDB in production for several years, I can confidently say it's the most robust distributed system I've ever been paged on - or more accurately, rarely been paged on. This exceptional reliability is largely thanks to their pioneering simulation approach, which they've documented at [apple.github.io/foundationdb/testing.html](https://apple.github.io/foundationdb/testing.html). The FoundationDB team estimates they've run the equivalent of roughly one trillion CPU-hours of simulation on their system, helping them find deep issues that would only happen in the rarest real-world scenarios.

## What is Deterministic Simulation Testing?

In short, DST is a methodology that makes testing distributed systems more reliable and predictable by:

1. Controlling the passage of time within the system
2. Ensuring deterministic execution (same inputs produce same outputs)
3. Introducing controlled failure scenarios
4. Providing complete observability of the system

For those interested in diving deeper into this exciting field, here's my curated list of resources.

## TL;DR
If you only have limited time, here are the three must-watch videos that will give you the best introduction to deterministic simulation testing:

- [Will Wilson: Building FoundationDB - Testing Distributed Systems with Deterministic Simulation](https://www.youtube.com/watch?v=4fFDFbi3toc)
- [Will Wilson: Autonomous Testing and the Future of Software Development](https://www.youtube.com/watch?v=fFSPwJFXVlw)
- [Will Wilson: Testing a Single-Node, Single Threaded, Distributed System Written in 1985](https://www.youtube.com/watch?v=m3HwXlQPCEU)

## Essential Reading

### Foundations & Concepts

- [Alex Miller: Simulation and Buggify](https://transactional.blog/simulation/buggify) - Techniques for controlled fault injection in distributed systems
- [Phil Eaton: Deterministic Simulation Testing](https://notes.eatonphil.com/2024-08-20-deterministic-simulation-testing.html) - Comparative analysis of DST implementations across different systems
- [Resonate: Deterministic Simulation Testing](https://journal.resonatehq.io/p/deterministic-simulation-testing) - Insights into practical implementation
- [CockroachLabs: Demonic Nondeterminism](https://www.cockroachlabs.com/blog/demonic-nondeterminism/) - Understanding the challenges of nondeterminism in distributed systems
- [AWS: Systems Correctness Practices](https://queue.acm.org/detail.cfm?ref=rss&id=3712057) - Highlights deterministic simulation as a "lightweight formal method" that allows testing distribution, failure, and timing issues at build time rather than integration time

### Language-Specific Implementations

- [Polar Signals: Mostly-DST in Go](https://www.polarsignals.com/blog/posts/2024/05/28/mostly-dst-in-go) - How to approach DST in Go applications
- [Sled: Simulation Testing](https://sled.rs/simulation.html) - A Rust perspective on simulation testing
- [S2: Deterministic simulation testing for async Rust](https://s2.dev/blog/dst) - Practical implementation combining Turmoil and MadSim for reliable Rust testing

### Real-World Case Studies

- [RisingWave: A New Era of Distributed System Testing](https://risingwave.com/blog/deterministic-simulation-a-new-era-of-distributed-system-testing/) - Part 1 of their DST journey
- [RisingWave: The RisingWave Story](https://risingwave.com/blog/applying-deterministic-simulation-the-risingwave-story-part-2-of-2/) - Part 2 continuing their implementation story
- [Dropbox: Testing Our New Sync Engine](https://dropbox.tech/infrastructure/-testing-our-new-sync-engine) - How Dropbox applied simulation testing
- [WarpStream: DST for Our Entire SaaS](https://www.warpstream.com/blog/deterministic-simulation-testing-for-our-entire-saas) - Ambitious application at scale
- [Antithesis: Case Studies](https://antithesis.com/solutions/case_studies/) - Various case studies of Antithesis
- [TigerBeetle: Building Reliable Systems](https://docs.tigerbeetle.com/concepts/safety/#software-reliability)
- [TigerBeetle: A Friendly Abstraction Over io_uring and kqueue](https://tigerbeetle.com/blog/2022-11-23-a-friendly-abstraction-over-iouring-and-kqueue/)

## Must-Watch Talks

- [Ben Collins: FoundationDB Testing: Past & Present](https://www.youtube.com/watch?v=IaB8jvjW0kk) - Practical implementation examples
- [Marc Brooker: AWS re:Invent 2024 - Try again: The tools and techniques behind resilient systems (ARC403)](https://www.youtube.com/watch?v=rvHd4Y76-fs) - Formal verification approach to distributed systems

---

Please, feel free to react to this article, you can reach me on [Twitter](https://twitter.com/PierreZ), or have a look on my [website](https://pierrezemb.fr).

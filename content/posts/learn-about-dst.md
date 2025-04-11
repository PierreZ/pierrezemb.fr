+++
title = "So, You Want to Learn More About Deterministic Simulation Testing?"
description = "A curated collection of resources about deterministic simulation testing for distributed systems."
date = 2025-04-11T00:00:00+02:00
[taxonomies]
tags = ["distributed", "testing", "reliability", "simulation", "deterministic"]
+++

I recently attended [BugBash 2025](https://bugbash.antithesis.com/), a software reliability conference organized by [Antithesis](https://antithesis.com) in Washington, D.C. during April 3-4, 2025. The conference brought together industry experts like Kyle Kingsbury, Ankush Desai, and Mitchell Hashimoto to discuss various aspects of building reliable software, with deterministic simulation testing being a significant focus throughout many of the sessions and discussions.

One of the highlights for me was having the chance to talk with the Antithesis team and meet some of the original creators of FoundationDB. 

## What is Deterministic Simulation Testing?

The best description of DST I've found is described in [FoundationDB's testing page](https://apple.github.io/foundationdb/testing.html):

> The major goal of Simulation is to make sure that we find and diagnose issues in simulation rather than the real world. Simulation runs tens of thousands of simulations every night, each one simulating large numbers of component failures. Based on the volume of tests that we run and the increased intensity of the failures in our scenarios, we estimate that we have run the equivalent of roughly one trillion CPU-hours of simulation on FoundationDB.

> Simulation is able to conduct a deterministic simulation of an entire FoundationDB cluster within a single-threaded process. Determinism is crucial in that it allows perfect repeatability of a simulated run, facilitating controlled experiments to home in on issues. The simulation steps through time, synchronized across the system, representing a larger amount of real time in a smaller amount of simulated time. In practice, our simulations usually have about a 10-1 factor of real-to-simulated time, which is advantageous for the efficiency of testing.

> We use Simulation to simulate failures modes at the network, machine, and datacenter levels, including connection failures, degradation of machine performance, machine shutdowns or reboots, machines coming back from the dead, etc. We stress-test all of these failure modes, failing machines at very short intervals, inducing unusually severe loads, and delaying communications channels.

> Simulation's success has surpassed our expectation and has been vital to our engineering team. It seems unlikely that we would have been able to build FoundationDB without this technology.

After years of operating many Apache-oriented distributed systems, I can confidently say that FoundationDB stands apart in its remarkable robustness—I've rarely been paged for it, which speaks volumes about its stability in production. At [Clever Cloud](https://www.clever-cloud.com/), we've even leveraged FoundationDB's simulation framework during our application development by [embedding Rust code inside FDB's simulation environment](/posts/providing-safety-fdb-rs/#user-safety), allowing us to inherit the same reliability guarantees for our custom applications.


## TL;DR
If you only have limited time, here are the three must-watch videos that will give you the best introduction to deterministic simulation testing:

- [Will Wilson: Testing Distributed Systems with Deterministic Simulation](https://www.youtube.com/watch?v=4fFDFbi3toc)
- [Will Wilson: Autonomous Testing and the Future of Software Development](https://www.youtube.com/watch?v=fFSPwJFXVlw)
- [Will Wilson: Testing a Single-Node, Single Threaded, Distributed System Written in 1985](https://www.youtube.com/watch?v=m3HwXlQPCEU)

## Essential Reading

### Foundations & Concepts
- [CockroachLabs: Demonic Nondeterminism](https://www.cockroachlabs.com/blog/demonic-nondeterminism/)
- [Alex Miller: BUGGIFY](https://transactional.blog/simulation/buggify)
- [TigerBeetle: Building Reliable Systems](https://docs.tigerbeetle.com/concepts/safety/#software-reliability)
- [Dominik Tornow: Deterministic Simulation Testing](https://journal.resonatehq.io/p/deterministic-simulation-testing)
- [Poorly Defined Behaviour: Deterministic Simulation Testing](https://poorlydefinedbehaviour.github.io/posts/deterministic_simulation_testing/)
- [Phil Eaton: What's the big deal about Deterministic Simulation Testing?](https://notes.eatonphil.com/2024-08-20-deterministic-simulation-testing.html)
- [AWS: Systems Correctness Practices](https://queue.acm.org/detail.cfm?ref=rss&id=3712057)

### Language-Specific Implementations
- [Turmoil: Network Simulation Framework for Rust](https://docs.rs/turmoil/latest/turmoil/)
- [MadSim: Deterministic Simulation Testing Library for Rust](https://docs.rs/madsim/latest/madsim/)
- [Sled: Simulation Testing](https://sled.rs/simulation.html)
- [S2: Deterministic simulation testing for async Rust](https://s2.dev/blog/dst)
- [Polar Signals: Mostly-DST in Go](https://www.polarsignals.com/blog/posts/2024/05/28/mostly-dst-in-go)

### Real-World Case Studies
- [TigerBeetle: A Friendly Abstraction Over io_uring and kqueue](https://tigerbeetle.com/blog/2022-11-23-a-friendly-abstraction-over-iouring-and-kqueue/)
- [Dropbox: Testing Our New Sync Engine](https://dropbox.tech/infrastructure/-testing-our-new-sync-engine)
- [TigerBeetle: We Put a Distributed Database in the Browser](https://tigerbeetle.com/blog/2023-07-11-we-put-a-distributed-database-in-the-browser/)
- [Antithesis: Case Studies](https://antithesis.com/solutions/case_studies/)
- [RisingWave: A New Era of Distributed System Testing](https://risingwave.com/blog/deterministic-simulation-a-new-era-of-distributed-system-testing/)
- [RisingWave: The RisingWave Story](https://risingwave.com/blog/applying-deterministic-simulation-the-risingwave-story-part-2-of-2/)
- [WarpStream: DST for Our Entire SaaS](https://www.warpstream.com/blog/deterministic-simulation-testing-for-our-entire-saas)
- [Antithesis: How Antithesis finds bugs (with help from the Super Mario Bros.)](https://antithesis.com/blog/sdtalk/)

## Talks
- [Ben Collins: FoundationDB Testing: Past & Present](https://www.youtube.com/watch?v=IaB8jvjW0kk)
- [Marc Brooker: AWS re:Invent 2024 - Try again: The tools and techniques behind resilient systems (ARC403)](https://www.youtube.com/watch?v=rvHd4Y76-fs)
- [TigerBeetle: Episode 064: Two In One, New Request Protocol and VOPR Tutorial](https://www.youtube.com/watch?v=6y8Ga3oogLY)
- [FOSDEM 2025: Squashing the Heisenbug with Deterministic Simulation Testing](https://fosdem.org/2025/schedule/event/fosdem-2025-4279-squashing-the-heisenbug-with-deterministic-simulation-testing/)

---

Have I missed any important resources on Deterministic Simulation Testing? This field is rapidly evolving, and I'm always looking to expand this collection. If you know of any articles, talks, or tools related to DST that should be included here, please reach out! I'd love to hear about your experiences with deterministic testing as well.

Please, feel free to react to this article, you can reach me on [Twitter](https://twitter.com/PierreZ), or have a look on my [website](https://pierrezemb.fr).

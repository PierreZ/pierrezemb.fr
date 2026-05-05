+++
title = "BugBash 2026, or how the correctness decade has started"
description = "A retrospective on BugBash 2026, and why software engineering looks brighter than ever."
date = 2026-05-05
draft = false
[taxonomies]
tags = ["software-engineering", "testing", "simulation", "correctness", "llm"]
+++

[BugBash 2026](https://antithesis.com/bugbash/conference2026) was two days in Washington D.C., organized by Antithesis, dedicated to **extracting reliable software from the slop factory**. The conference brought together thirty speakers from across the correctness landscape: Kyle Kingsbury running a seminar on transaction safety, Peter Alvaro reflecting on twenty years of attacking distributed systems, Brian Potter explaining why buildings don't fall down, Frank McSherry on why Materialize works for one reason, and Steve Klabnik connecting Descartes to Rust. I attended [the first edition last year](https://pierrezemb.fr/posts/2025-year-in-review/#the-awakening) and it was where I finally met the correctness niche in person. This year I was back with [a lightning talk on borrowing FoundationDB's simulator](https://pierrezemb.fr/slides/2026-04-fdb-sim.pdf), sharing the stage with people whose work shaped how I think about distributed systems.

Despite being a conference where we talk about simulation, formal methods and property-based testing, this year almost everyone was asking a single question: **how can we trust LLM-generated code?**

## The gap agents opened

Steve Klabnik named the problem in his keynote, *Steel, Rust, and truth*:

> We said "good enough" because we wrote it, we understood it, we tried it. AI broke all three.

That gap, between the speed at which agents produce code and the confidence we have that the code is right, is what filled the conference. Engineers had used LLMs to ship faster, then discovered a new class of correctness problem they did not have before. At Clever Cloud, we saw it firsthand: once we ran our [Materia](https://www.clever.cloud/materia) layers through FoundationDB's simulator, it found bugs that neither humans nor agents had anticipated. Query planners picking the wrong index, data corruption during reindexing, dual leader election under clock skew. The kind of bugs that pass code review and unit tests but explode under real failure conditions.

## The loop that closes the gap

On the side, I am doing [agentic engineering](https://simonwillison.net/2025/Oct/7/vibe-engineering/) on [moonpool](https://github.com/PierreZ/moonpool), my own hobby-grade DST framework in Rust, inspired by FoundationDB and TigerBeetle. I am having more fun engineering than at any point in my career. Claude writes a lot of the code, the simulator beats it up, [a faulty seed reproduces the bug deterministically](https://pierrezemb.fr/posts/testing-prevention-vs-discovery/), and the loop closes the same way for me as it does for the agent. You do not trust Claude. You trust the simulator. It finds what you never thought to test.

This is what I told people at BugBash when they asked the question. But the more interesting story is that I was no longer the only one saying it.

## From tribe to requirement

Will Wilson opened the conference with a keynote titled *We won, what now?*

![property-based testing search interest, near-zero through 2024, vertical spike in late 2025](/images/bugbash-2026/property-based-testing.png)

![formal methods search interest, flat baseline, sharp climb in late 2025](/images/bugbash-2026/formal-methods.png)

In 2025 that "we" was a small tribe. In 2026 it was a packed room. The conversations confirmed it. People came up after my talk wanting to know how we designed [Materia](https://www.clever.cloud/materia) at Clever Cloud, how to introduce simulation to an existing team, whether their system was complex enough to need it. Practical questions from people who had decided to start.

## Understanding lives in behaviors

Gabriela Moreira walked the chain backwards in her keynote *Behaviors as the backbone of software correctness*:

> We start wanting correctness. We realize we need confidence. Confidence requires understanding. Understanding lives in behaviors.

The original way to learn the behaviors of software was to operate it. [Charity Majors](https://www.honeycomb.io/blog/testing-in-production) has been making this case for years, and I have been advocating that developers should be on the on-call rotation for the systems they ship, because nothing teaches you what your code actually does like getting paged by it at 3am. Simulation gives you a second way to witness behaviors, this time in a controlled environment instead of in production. Both routes lead to the same place: understanding.

## Sixty years of preparation

Klabnik finished his keynote with another slide:

> You've been taking this seriously for sixty years. The rest of the field is about to catch up in a hurry. Contracts. Specifications. Invariants. Refinement. Types. Proof. You're the ones who know how to wield this. Every programmer is about to need what you already know.

The techniques to restore trust in code we did not fully write, **deterministic replay, simulation, property-based testing, model checking, types**, are not new. They have been refined for decades by people who cared about correctness when caring about correctness was a niche interest. The agents made these techniques mandatory. The techniques themselves are mature, documented, and getting cheaper to adopt every year.

The academic world keeps pushing too. Peter Alvaro showed how [mathematical models combined with simulation](https://sigops.org/s/conferences/hotos/2025/papers/hotos25-106.pdf) can now predict where distributed systems are vulnerable to [metastable failures](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf) before they hit production.

The boring parts of the job are getting cheaper. The interesting parts, **the right abstractions, designing for chaos, finding unknown unknowns, building tools that catch what humans miss**, are becoming central. The people in the room were not worried about their careers. They were too busy figuring out what to build next.

## The correctness decade

Every generation of engineers gets a moment where the field shifts underneath them. The correctness crowd waited sixty years for theirs. It is here.

---

Feel free to reach out with any questions or to share your experiences from BugBash. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

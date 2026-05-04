+++
title = "BugBash 2026, or how the correctness decade has started"
description = "A retrospective on BugBash 2026, and why software engineering looks brighter than ever."
date = 2026-05-03
draft = true
[taxonomies]
tags = ["software-engineering", "testing", "simulation", "correctness", "llm"]
+++

A few days ago I was at [BugBash 2026](https://antithesis.com/bugbash/conference2026), a two-day conference in DC dedicated to **extracting reliable software from the slop factory**. BugBash is where I meet the people who care about the same problems I do, and this year, despite Twitter's certainty that software engineering is dying, I found myself on the other side of the conversation. People kept asking me the same question: **how did you manage to trust Claude?**

## The diagnosis

Steve Klabnik named the problem in his closing keynote, *Steel, Rust, and truth*:

> We said "good enough" because we wrote it, we understood it, we tried it. AI broke all three.

That gap, between the speed at which agents produce code and the confidence we have that the code is right, is what filled the conference. Engineers had used LLMs to ship faster, then discovered a new class of correctness problem they did not have before. At Clever Cloud, we saw it firsthand: once we ran our [Materia](https://www.clever.cloud/materia) layers through FoundationDB's simulator, it found bugs that neither humans nor agents had anticipated. Query planners picking the wrong index, data corruption during reindexing, dual leader election under clock skew. The kind of bugs that pass code review and unit tests but explode under real failure conditions.

## What was different from last year

I attended [BugBash 2025](https://pierrezemb.fr/posts/2025-year-in-review/#the-awakening) too, and the first edition was a gift: it was where I finally met the niche in person, the deterministic simulation and formal methods crowd I had mostly known through blog posts and online discussions. The vibe was different then. In 2025, those techniques felt like a small tribe. In 2026, they almost felt like a requirement to build complicated software.

Will Wilson opened the conference with a keynote titled *We won, what now?*. *What* won?

![property-based testing search interest, near-zero through 2024, vertical spike in late 2025](/images/bugbash-2026/property-based-testing.png)

![formal methods search interest, flat baseline, sharp climb in late 2025](/images/bugbash-2026/formal-methods.png)

The "we" assumed everyone in the room. In 2025 the "we" was a small group. In 2026 it was the rest of us. The conversations confirmed it. People came up after my [lightning talk on borrowing FoundationDB's simulator](https://pierrezemb.fr/slides/2026-04-fdb-sim.pdf) wanting to know how we designed [Materia](https://www.clever.cloud/materia) at Clever Cloud, how to introduce simulation to an existing team, whether their system was complex enough to need it. Practical questions from people who had decided to start.

## Understanding lives in behaviors

Later during the conference, Gabriela Moreira walked the chain backwards in her keynote *Behaviors as the backbone of software correctness*:

> We start wanting correctness. We realize we need confidence. Confidence requires understanding. Understanding lives in behaviors.

The line that hit me hardest is *understanding lives in behaviors*. The original way to learn the behaviors of software was to operate it. [Charity Majors](https://www.honeycomb.io/blog/testing-in-production) has been making this case for years, and I have been advocating that developers should be on the on-call rotation for the systems they ship, because nothing teaches you what your code actually does like getting paged by it at 3am. Simulation gives you a second way to witness behaviors, this time in a controlled environment instead of in production. Both routes lead to the same place: understanding.

## Sixty years of preparation

Klabnik finished his keynote with another slide:

> You've been taking this seriously for sixty years. The rest of the field is about to catch up in a hurry. Contracts. Specifications. Invariants. Refinement. Types. Proof. You're the ones who know how to wield this. Every programmer is about to need what you already know.

The techniques to restore trust in code we did not fully write, **deterministic replay, simulation, property-based testing, model checking, types**, are not new. They have been refined for decades by people who cared about correctness when caring about correctness was a niche interest. The agents made these techniques mandatory. The techniques themselves are mature, documented, and getting cheaper to adopt every year.

The academic world keeps pushing too. Peter Alvaro showed how [mathematical models combined with simulation](https://sigops.org/s/conferences/hotos/2025/papers/hotos25-106.pdf) can now predict where distributed systems are vulnerable to [metastable failures](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf) before they hit production.

I know what that feels like in practice. On the side, I am doing [agentic engineering](https://simonwillison.net/2025/Oct/7/vibe-engineering/) on [moonpool](https://github.com/PierreZ/moonpool), my own hobby-grade DST framework in Rust, inspired by FoundationDB and TigerBeetle. I am having more fun engineering than at any point in my career. Claude writes a lot of the code, the simulator beats it up, [a faulty seed reproduces the bug deterministically](https://pierrezemb.fr/posts/testing-prevention-vs-discovery/), and the loop closes the same way for me as it does for the agent. You do not trust Claude. You trust the simulator. It finds what neither you nor the agent anticipated.

The boring parts of the job are getting cheaper. The interesting parts, **the right abstractions, designing for chaos, finding unknown unknowns, building tools that catch what humans miss**, are becoming central. The people in the room were not worried about their careers. They were too busy figuring out what to build next.

## The correctness decade

Every generation of engineers gets a moment where the field shifts underneath them. The correctness crowd waited sixty years for theirs. It is here.

---

Feel free to reach out with any questions or to share your experiences from BugBash. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
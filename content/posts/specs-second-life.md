+++
title = "The Spec-Model-Simulation Trinity"
description = "Specs for the why, model checking for correctness, simulation for survival. Different tools for different layers of confidence."
date = 2025-12-04
draft = true
[taxonomies]
tags = ["software-engineering", "llm", "specifications", "formal-methods", "model-checking", "fizzbee", "simulation"]
+++

I truly think LLMs are changing how we write software. For me, it's been a massive productivity boost. I can ask Claude to read some piece of code and explain it to me, or make a quick PoC of something, or refactor stuff that would take me hours. I even used it to help me [backport features from FoundationDB in Rust](https://github.com/PierreZ/moonpool), and it worked surprisingly well 🤯

But [João Alves made a great point recently](https://world.hey.com/joaoqalves/when-software-becomes-fast-food-23147c9b): code is becoming like fast food. Cheap, fast, everywhere. And I think he's right. The bottleneck isn't writing code anymore, it's knowing **what** to write in the first place. You ask an LLM to generate something, it compiles, the tests pass, and you ship it. But how do you actually enforce that the code is suitable for production use? Without enough guardrails, you ship code that breaks users and becomes the on-call's problem. And since LLMs help engineers produce more code, or more complex code, than ever, debugging has become the critical skill.

## Why specs died in the first place

Ask any engineering team "where's the spec for this service?" and you'll probably get one of three answers: blank stares, a link to some 3-year-old Google doc that's completely outdated, or my personal favorite, "the code is the spec."

I think the problem was simple: **specs had no feedback loop**. Code compiles, tests pass, but specs? They just sit there. Nobody validates them, nobody updates them. Six months later, the spec has become archaeology, and new team members learn to ignore it because they can't trust it anyway.

What changed is that LLMs can actually **read** specifications now. And suddenly, specs aren't dead documents anymore. They're instructions that can be executed. I've found two modes that actually work:

- **Generation**: you give an LLM a structured spec, and it gives you an implementation
- **Validation**: you give an LLM some existing code and a spec, and ask "does this implementation actually respect the specification?"

## spec-kit and the right prompt chain

I tried [spec-kit](https://github.com/github/spec-kit) a while ago and found it pretty useful. What it does well is guide you through a structured chain of prompts: you start with a Constitution (your project principles), then you write Specifications (requirements with acceptance criteria), then Technical Plans, then Tasks, and finally Implementation.

It sounds obvious when I write it like that, but it's surprisingly effective. This isn't scattered TODO comments. It's a queryable structure that builds context progressively, and the LLM can use all of it.

The generated code was POC-level at best. But the **spec itself**? actually useful. And here's what surprised me: the LLM kept challenging my vague requirements. Every time I wrote something like "handle edge cases," it would ask "what happens when X? what about Y?" until the spec was actually implementable.

I think that's the trick. Specs stayed vague for years because nobody challenged them. **LLMs challenge everything** 🚀

## The limits of English

Here's where I hit a wall though. English-based specs work great for user stories and acceptance criteria, the kind of stuff product managers care about. But for algorithms and system behavior? Natural language gets ambiguous really fast.

"Handle concurrent access" means different things to different people. "Ensure consistency" is even worse. When you're designing a lease mechanism with vesting times, or a two-phase worker model where pointers are released before processing begins, you need precision. English just doesn't cut it.

I needed something more engineering-driven. Not formal verification for academic purposes, but practical precision that the whole team could read and reason about.

## Finding an engineering-driven approach

The project that pushed me toward formal methods is a replication of [Apple's QuiCK](https://pierrez.github.io/fdb-book/the-record-layer/quick.html), a distributed queuing system built for CloudKit. It has fault-tolerant leasing with vesting times, two-level sharding, exactly-once semantics, and a two-phase worker model. English specs would be dangerously ambiguous here. I finally felt I'd be safer writing a TLA+ spec before touching simulation code.

So I started watching [TLA+ videos](https://lamport.azurewebsites.net/video/videos.html). And... the notation felt like another language to maintain. I didn't want to be the only one on the team who could read the specs. I've been there before with other technologies, and it's not a great place to be 😅

Then [a friend](https://bsky.app/profile/alexmillerdb.bsky.social/post/3m6ptancmus2o) suggested [Fizzbee](https://fizzbee.io). It's based on Starlark, a Python dialect. Model checking without the TLA+ notation. The whole team can contribute.

Learning new languages with LLMs works well. The trick is to find or generate a spec of the language first, then ask for a tutorial tailored to your specific problem. In my case, I asked Claude to write a Starlark reference and a Fizzbee concepts recap, incremental roadmap to modelize something like QuiCK. Now we share vocabulary, and the conversations are productive.

## The spec-model-simulation trinity

Now I have:

- one **spec** for the master plan
- one **model** to validate the algorithms and concurrency
- **simulation code** to validate that it survives production

The spec is just markdown, but it captures the "why" and the high-level design. The Fizzbee model explores all possible states and finds bugs before any code exists. Here's what an invariant looks like for exactly-once semantics:

```python
# Safety: no duplicate completions
always assertion NoDuplicateCompletions:
    return len(completed) == len(set(completed))
```

Readable by anyone who knows Python. And the simulation code, FoundationDB-style deterministic testing, verifies that the implementation actually matches what I intended.

What surprised me is how they reinforce each other. The model forces me to think precisely about invariants, which makes the spec clearer. The simulation catches implementation bugs that the model can't see. And when something fails in simulation, I can go back to the model to understand if it's a design bug or just a coding mistake.

I've written before about [how simulation helps discover bugs](/posts/testing-prevention-vs-discovery/) - and how Claude can even use deterministic replay to fix issues by itself.

For algorithms and concurrency, **this is what actually works**. The Fizzbee model checker feels like the Rust compiler but for higher-level design.

I've modified QuiCK's design to be simulatable using [FoundationDB-style deterministic testing](/posts/diving-into-foundationdb-simulation/#writing-workloads-in-rust), so the trinity is complete: spec for the architecture decisions, Fizzbee model for the lease and concurrency invariants, and simulation code to verify the implementation survives chaos.

## The gap we still need to fill

But you won't write Fizzbee specs for your API endpoints or service contracts. It's overkill for "this endpoint returns a list of users." It's perfect for "this lease mechanism must never allow duplicate processing," but that's not most of what we build day to day.

There's a gap here that we still need to fill. High-level specs need something that's LLM-readable like markdown, but also compileable in some way to find gaps and provide feedback. Not as formal as model checking, but more structured than prose.

OpenAPI gets close for APIs. But for business logic? The tooling doesn't exist yet. I think there's a lot of room for innovation here.

---

Feel free to reach out to share your experiences with specifications and LLM-driven development. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

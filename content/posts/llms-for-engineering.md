+++
title = "What I Tell Colleagues About Using LLMs for Engineering"
description = "LLMs amplify expertise, they don't replace it. Here's what works: planning, context, feedback loops, and building systems that let AI discover bugs."
date = 2026-01-15
draft = false
[taxonomies]
tags = ["llm", "software-engineering", "rust", "testing"]
+++

In a few months, I went from skeptic to heavy user. Claude Code is now part of my daily workflow, both for my personal projects and at Clever Cloud where I help teams adopt these tools. I keep having the same conversation: colleagues ask how I use it, what works, what doesn't. This post captures what I tell them.

The shift matters because [code is becoming cheap](https://world.hey.com/joaoqalves/when-software-becomes-fast-food-23147c9b). What used to take hours now takes minutes. But this doesn't diminish the craft.

[Tobi Lütke](https://x.com/tobi/status/2010438500609663110) got MRI data on a USB stick that required commercial Windows software to view. He asked Claude to build an HTML viewer instead. It looked better than the commercial tool. That's the superpower: not just using software, but **making** software for your exact problem. As [antirez wrote](https://antirez.com/news/158), the fire that kept us coding until night was never about typing. It was about building. LLMs let us build more and better. The fun is still there, untouched.

The first months were honestly frustrating. Code that looked right but broke in subtle ways. APIs that no longer existed. Patterns that didn't match my codebase. It took experimentation to find what actually works. These are the patterns that survived.

## What Becomes Reachable

I keep hearing that LLMs unlock velocity. We can ship faster! While that may be true, I think it misses the main benefit. LLMs are about reaching work that would never get done otherwise.

Every engineering team has a backlog of things that matter but never happen: comprehensive doc tests, database migrations, dependency updates, technical debt. These tasks sit in dream lists because the return on investment is too low given the effort required. LLMs change that equation.

[moonpool](https://github.com/PierreZ/moonpool) is my concrete example. Backporting FoundationDB's low-level internals to Rust was always a dream project. I had operated distributed systems for years and understood the concepts, but the sheer volume of translation work kept it out of reach. I could throw multiple codebases at Claude for analysis, create recap files summarizing key patterns, and nourish my own implementation plan in hours instead of days. The project exists because LLMs made it reachable.

This is the shift worth paying attention to: LLMs amplify expertise, they do not replace it. The knowledge of what to build and why remains the bottleneck. The execution barrier just got lower.

## Plan First, Always

Here is the paradox: when code becomes cheap, design becomes more valuable. Not less. You can now afford to spend time on architecture, discuss tradeoffs, commit to an approach before writing a single line of code. [Specs are coming back](/posts/specs-are-back/), and the judgment to write good ones still requires years of building systems.

Every significant task now starts in Plan Mode with `ultrathink`. Boris Cherny [says thinking is on by default now](https://x.com/bcherny/status/2007892431031988385) and the command does not do much anymore, but old habits die hard. The practical goal is breaking work into chunks small enough that the AI can digest the context without hallucinating. This is not about limiting ambition. It is about matching task scope to context window.

For large tasks, I produce a **spec file** that Claude and I iterate on together. Claude Code has an `AskUserQuestion` tool that lets Claude ask clarifying questions mid-task. Combined with a spec file, this becomes powerful: Claude asks about edge cases, I refine the requirements, we converge on an approach before writing code. The collaboration happens in the spec, not scattered across conversation turns. As a bonus, the spec survives context compaction and remains the source of truth when Claude summarizes the conversation.

Instead of generating a spec from assumptions, I tell Claude to clarify first. Here is an example prompt I use:

> ultrathink. Generate a spec.md for adding a new API endpoint to this codebase. Before writing anything, ask me about the endpoint's purpose, request/response schema, authentication requirements, and edge cases. Then produce a comprehensive spec covering motivation, technical design, error handling, and testing strategy.

The result is a spec that matches what I actually need, not what Claude guessed I might want. Fewer iterations, better alignment.

A plan is only as good as the context it is built on.

## Context is Everything

The output quality depends entirely on the context you provide. This sounds obvious, but the implications took me a while to internalize. I now create context files with domain knowledge, code patterns, and project summaries. Writing down the hidden coding style rules that exist only in your head is surprisingly valuable. The conventions you enforce in code review but never documented? Write them down. The LLM will follow them, and so will newcomers on your team. I am currently experimenting with Claude skills to make this context reusable across sessions.

The difference between [vibe coding and vibe engineering](https://simonwillison.net/2025/Oct/7/vibe-engineering/), as Simon Willison puts it, is whether you stay accountable for what the LLM produces. Accountability requires understanding, and understanding requires context.

Without enough context framing the problem, Claude over-engineers. I have seen it add abstraction layers, configuration options, and patterns I never asked for. The cure is constraints: explicit context about what simplicity looks like in this codebase. The LLM can generate code faster than I ever could, but knowing what context matters is expertise that cannot be delegated.

Context works when it is accurate. Documentation often is not.

## Clone Your Dependencies

MCP tools exist to fetch documentation, but I find git clone more powerful. I clone the dependencies I care about and **checkout the version I actually use**. Claude browses the real source code, not cached docs or outdated training data. When I ask about an API, the answer comes from the actual implementation in my lock file. This simple habit prevents entire categories of frustrating debugging sessions where the model confidently generates code for an API that no longer exists.

This also works for **understanding unfamiliar code**. Clone a dependency, check out the version you use, and ask specific questions. The LLM handles breadth, you handle depth.

Good context helps Claude generate better code. But how does it know when the code is wrong?

## Feedback Loops

[Boris Cherny](https://x.com/bcherny/status/2007179832300581177), creator of Claude Code, calls this the most important thing: **give Claude a way to verify its work**. If Claude has that feedback loop, it will 2-3x the quality of the final result. The pattern is simple: generate code, get feedback, fix, repeat. The faster and clearer the feedback, the better the results.

This is why Rust and Claude work so well together. The compiler gives **actionable error messages**. The type system catches bugs before runtime. Clippy suggests improvements. Claude reads the feedback and fixes issues immediately. The compiler output is isolated, textual, actionable. The model does not have to guess what went wrong. Any language or tool that provides clear, structured feedback enables this same cycle.

**TDD** fits perfectly here. Tests are easy for you to read and verify, and they give fast feedback to the LLM. Write the test first, let Claude implement until it passes. You stay in control of the specification while delegating the implementation.

For software that needs to be correct, the feedback must be exhaustive. I maintain the [FoundationDB Rust crate](https://crates.io/crates/foundationdb). Over 11 million downloads, used by real companies. The [binding tester](/posts/providing-safety-fdb-rs/) generates operation sequences and compares our implementation against the reference. We run the equivalent of **219 days of continuous testing each month** across our CI runners. When Claude contributes code, the binding tester tells it exactly where behavior diverges. This kind of feedback gives confidence to change things in a database driver that you would never touch otherwise.

### Simulation: Feedback for Distributed Systems

Compiler feedback catches syntax and types. Tests catch logic errors. But what about bugs that hide in timing and network partitions?

Distributed systems fail in ways that only manifest under specific conditions. [A network partition once disrupted a 70-node Hadoop cluster](/posts/simulation-driven-development/#the-tale-of-a-bug) and left it unable to restart due to corrupted state. That incident shaped how I think about testing. This is why I love FoundationDB: [after years of on-call, it has never woken me up](/posts/diving-into-foundationdb-simulation/).

Distributed systems need feedback loops that inject failures **before** production. This is what [deterministic simulation](/posts/simulation-driven-development/) provides. Same seed, same execution, same bugs. When every run is reproducible, the LLM can methodically explore the state space, find a failure, and debug it step by step.

In moonpool, Claude [discovered a bug I did not know existed](/posts/testing-prevention-vs-discovery/) through active exploration of edge cases I had not considered. [Armin Ronacher](https://x.com/mitsuhiko/status/2011048778896212251) recently noted that agents can now port entire codebases to new languages with all tests passing. The combination of simulation and LLMs makes this possible.

The most awful bugs are the **unknown unknowns**. You cannot write a test for a bug you do not know exists. Simulation and state exploration are the cheatsheet. If the code survives exhaustive exploration of edge cases, failures, and adversarial conditions, it behaves correctly. It does not matter whether an LLM wrote it or you did.

What dream project has been sitting on your list, waiting for the execution barrier to drop?

---

Feel free to reach out with any questions or to share your experiences with LLM-assisted development. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

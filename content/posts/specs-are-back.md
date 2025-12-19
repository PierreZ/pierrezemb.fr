+++
title = "Specs Are Back, But We're Missing the Tools"
description = "LLMs revived specifications. Model checkers like Fizzbee work for algorithms. But for APIs and business logic? The tooling doesn't exist yet."
date = 2025-12-19
[taxonomies]
tags = ["software-engineering", "llm", "specifications", "formal-methods", "model-checking", "fizzbee"]
+++

I truly think LLMs are changing how we write software. For me, it's been a massive productivity boost. I can ask Claude to read some piece of code and explain it to me, or make a quick PoC of something, or refactor stuff that would take me hours. I even used it to help me [backport features from FoundationDB in Rust](https://github.com/PierreZ/moonpool), and it worked surprisingly well 🤯

[João Alves made a great point recently](https://world.hey.com/joaoqalves/when-software-becomes-fast-food-23147c9b): code is becoming like fast food. Cheap, fast, everywhere. You ask an LLM to generate something, it compiles, the tests pass, and you ship it. For critical systems, [simulation testing](/posts/diving-into-foundationdb-simulation/) can validate that code actually survives production chaos.

But here's what I keep running into: we're still using **natural language** to prompt, correct, and guide LLMs. Vague instructions produce vague code. The bottleneck isn't writing code anymore, it's knowing **what** to write in the first place.

## Why specs died in the first place

Ask any engineering team "where's the spec for this service?" and you'll probably get one of three answers: blank stares, a link to some 3-year-old Google doc that's completely outdated, or my personal favorite, "the code is the spec."

I think the problem was simple: **specs had no feedback loop**. Code compiles, tests pass, but specs? They just sit there. Nobody validates them, nobody updates them. Six months later, the spec has become archaeology, and new team members learn to ignore it because they can't trust it anyway.

What changed is that LLMs can actually **read** specifications now. And suddenly, specs aren't dead documents anymore. They're instructions that can be executed. I've found two modes that actually work:

- **Generation**: you give an LLM a structured spec, and it gives you an implementation
- **Validation**: you give an LLM some existing code and a spec, and ask "does this implementation actually respect the specification?"

## spec-kit and the right prompt chain

I tried [spec-kit](https://github.com/github/spec-kit) a while ago and found it pretty useful. What it does well is guide you through a structured chain of prompts: you start with a Constitution (your project principles), then you write Specifications (requirements with acceptance criteria), then Technical Plans, then Tasks, and finally Implementation.

It sounds obvious when I write it like that, but it's surprisingly effective. This isn't scattered TODO comments. It's a queryable structure that builds context progressively, and the LLM can use all of it.

The generated code was actually good, because spec-kit forced me to build the right context first. And here's what surprised me: the LLM kept challenging my vague requirements. Every time I wrote something like "handle edge cases," it would ask "what happens when X? what about Y?" until the spec was actually implementable.

I think that's the trick. **Context is everything**. Build the right context, and the LLM produces the right code.

## The limits of English

Here's where I hit a wall though. English-based specs work great for user stories and acceptance criteria, the kind of stuff product managers care about. But for algorithms and system behavior? Natural language gets ambiguous really fast.

"Handle concurrent access" means different things to different people. "Ensure consistency" is even worse. When you're designing distributed algorithms with subtle timing constraints, you need precision. English just doesn't cut it.

I needed something more engineering-driven. Not formal verification for academic purposes, but practical precision that the whole team could read and reason about.

## Finding an engineering-driven approach

I started looking at formal methods. [TLA+](https://lamport.azurewebsites.net/video/videos.html) is the classic choice, but the notation felt like another language to maintain. I didn't want to be the only one on the team who could read the specs. I've been there before with other technologies, and it's not a great place to be 😅

Then [a friend](https://bsky.app/profile/alexmillerdb.bsky.social/post/3m6ptancmus2o) suggested [Fizzbee](https://fizzbee.io). It's based on Starlark, a Python dialect. Model checking without the TLA+ notation. The whole team can contribute.

Learning new languages with LLMs works well. The trick is to find or generate a spec of the language first, then ask for a tutorial tailored to your specific problem. I asked Claude to write a Starlark reference and a Fizzbee concepts recap. Now we share vocabulary, and the conversations are productive.

## What we're still missing

Fizzbee is great for what it does. For algorithms and concurrency, model checking feels like the Rust compiler but for higher-level design. It explores all possible states and finds bugs before any code exists. Here's what an invariant looks like:

```python
# Safety: no duplicate completions
always assertion NoDuplicateCompletions:
    return len(completed) == len(set(completed))
```

Readable by anyone who knows Python.

But most software isn't distributed algorithms. Most of what we build is about storing data in databases, sending messages to queues, calling other services, transforming inputs into outputs.

And we describe this behavior in a dozen different places: C4 diagrams for architecture, OpenAPI for HTTP endpoints, protobuf for message schemas, ADRs for decisions, markdown for everything else. No single notation captures the full picture.

I keep thinking about what this tool would need to be. It should be **compact**, short enough to fit in an LLM's context window without eating thousands of tokens. It should work at both levels: service interactions ("UserService stores in Postgres, publishes to Kafka") and function behavior ("validateUser checks format, queries DB, returns DTO"). It should be the **common language** that both the team and the LLM can read, write, and reason about.

Most importantly, it should be **verifiable**. Not just documentation that sits there, but something that can actually validate whether an implementation matches what we said it would do. The feedback loop that specs never had.

OpenAPI gets close for HTTP APIs. You can validate requests, generate clients, catch breaking changes. But for the rest? For business logic, for service contracts that aren't just endpoints, for the behavior that actually matters? The tooling doesn't exist yet.

As the old joke goes, [a spec precise enough to generate code is just called code](https://www.commitstrip.com/en/2016/08/25/a-very-comprehensive-and-precise-spec/). But there has to be something in between prose and implementation. And yes, I'm aware that proposing a new format makes me [the 15th competing standard](https://xkcd.com/927/). But if you've found something that fills this gap, or have ideas about what it should look like, I'd love to hear about it.

---

Feel free to reach out to share your thoughts on spec tooling. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

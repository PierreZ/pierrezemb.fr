+++
title = "Still Learning: Software Engineering in the LLM Era"
description = "TODO: one sentence for social media"
date = 2026-11-22
path = "posts/still-learning"
draft = true
[taxonomies]
tags = ["llm", "software-engineering", "personal"]
+++

<!--
Notes for the rewrite (delete before publishing)
- Fill the TODOs: the concrete thing in the hook, the Raft leaks, the paper example, and one example per verb.
- Say "evidence", not "proof": FoundationDB has simulation evidence, not a proof.
- Keep two images, the box and its leaks. The house appears once, in section 3.
- Verbs 2 and 3 overlap a bit; merge them if the list feels long.
- Rewrite in your own voice: this draft is scaffolding, not the post.
-->

I have never learned as much as in the last two years, and an LLM wrote most of my code. <!-- TODO: name one concrete thing you learned, in one clause, so this doesn't read as a boast. -->

Yet I keep hearing the opposite fear, from juniors and seniors alike: if the LLM writes the code, how do we still learn?

The usual answer online is blunt. You are an engineer, not a code monkey, and nobody mourns writing their own compiler. It is half right. It explains why typing code was never the job. It says nothing about how we keep getting better at the job.

## I never learned by typing

At some point in my career, I stopped learning by implementing things alone. Starting from scratch means walking from 0 to 80% on your own, with your own biases. You make the simple mistakes everyone made before you, and you end up with a simplistic view of the problem.

So I read code that works instead. Most of my "Diving into" posts started that way: etcd's linearizable reads, HBase's MemStore, FoundationDB's simulation framework.

Reading is not memorising. Nobody remembers each line. We remember the structure, the happy path, the error path, the shape of the code.

Writing is not memorising either. Ask someone to explain code they wrote a few months ago. They walk to the whiteboard and draw boundaries, messages, and what each part guarantees. The flow is gone; the guarantees stay. That drawing is what is left of the code, whoever typed it.

LLMs made reading cheap. I can ask questions about any codebase, in any language, by cloning the dependency at the version I use. I can turn a paper into a visualisation I can step through and break. <!-- TODO: one example of a paper you visualised. -->

## We already trust boxes

Delivering software has always meant building a box: a set of interactions you know, with guarantees you can state.

We already live with boxes we never opened. Nobody reads the code of all their dependencies. I picked FoundationDB because of the evidence behind it, years of deterministic simulation, not because I had read its storage engine.

SREs have always worked this way. Their job is to operate systems they did not write, and they learn them from the outside: metrics, probes, incidents. That is real knowledge, and it is the difference between software that is shipped and software that is operated.

But there is an asymmetry. FoundationDB earned its trust. So did the compiler. The box an LLM just built for me starts at zero: plausible code, no track record. Reading its shape will not catch a subtle concurrency bug.

So the work moves. Until now, we drew the plans and laid the bricks ourselves. The LLM lays the bricks now, but someone still has to inspect the house. That someone is us, and the job is correctness and quality.

## The leaks are the curriculum

Joel Spolsky named it in 2002: every non-trivial abstraction leaks. Sooner or later, a detail from inside the box shows through.

Anyone can now generate a Raft implementation. The paper fits in a weekend. Making it viable in production is the last 20%, and that 20% is mostly leaks: <!-- TODO: pick two or three you have lived through, such as fsync failures, membership changes, lease reads under clock drift, snapshots -->.

A leak is the moment the box forces you to open it, and it tells you exactly where to look. You don't study the whole engine; you study the part that broke a guarantee. That is when I read a dependency's code: not upfront, but on demand, because it surprised me. Those moments are where my engineering values came from.

One honest caveat: you need fundamentals to recognise a leak in the first place. LLMs don't remove that. They make fundamentals cheaper to acquire, because you can interrogate any implementation. <!-- TODO: is that enough for someone starting out? Say what you actually think, even if it is "I don't know". -->

## How I hunt leaks

Here is the loop I use now that an LLM writes most of my code:

1. Understand the fundamentals, so you can tell a leak from noise. <!-- TODO: example or link -->
2. Run experiments that provoke the leaks of existing designs, instead of trusting the paper. <!-- TODO: example -->
3. Compare alternatives quantitatively. Code is cheap now: build two designs and measure how each one leaks. <!-- TODO: example -->
4. Run continuous verification loops that catch leaks before your users do. I wrote about feedback loops and simulation earlier this year.
5. Communicate clearly. If you can't explain the leak, you didn't learn it.

The LLM builds the engine. Our job is the evidence that the box keeps its guarantees, and building that evidence is how we keep learning.

What is the last leak that taught you something?

---

Feel free to reach out with any questions or to share your experiences with learning in the LLM era. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

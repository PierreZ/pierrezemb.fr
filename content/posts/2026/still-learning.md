+++
title = "Still Learning, despite LLM writing all my code"
description = "TODO: one sentence for social media"
date = 2026-11-25
path = "posts/still-learning"
draft = true
[taxonomies]
tags = ["llm", "software-engineering", "personal"]
+++

As you may have guessed from [previous blogposts](/tags/llm/), I'm having a lot of fun in this new age for software engineering. But I see many people struggling to use LLM, for many reasons. Today I want to talk about one of the fear I had that turned out to be massively wrong: **if the LLM writes the code, how do we still learn?**

## I never learned by typing

I discovered coding kind of late, when I arrived in my engineering school. I learned C, and spent countless nights building up my coding skill from the ground up. Then I started to work, and at some point, I stopped learning by implementing things alone and from scratch. Starting from scratch means walking from 0 to 80% on your own, with your own biases. You make the simple mistakes everyone made before you, and you end up with a simplistic view of the problem. So I read code that works instead. Most of my "Diving into" posts started that way: etcd's linearizable reads, HBase's MemStore, FoundationDB's simulation framework.

Reading is not memorising. Nobody remembers each line, we remember the structure, the happy path, the error path, the shape of the code. Writing is not memorising either: ask someone to explain code they wrote a few months ago. They walk to the whiteboard and draw boundaries, messages, and what each part guarantees. The flow is gone; the guarantees stay. That drawing is what is left of the code, whoever typed it.

LLMs made reading cheap. For years, I have felt stuck by the language barrier: how can I discover and learn easily in a language that I don't master? With experience, you do have some sort of insight that let you kind of read almost any programming language, but sometimes it just tough. Nowadays, I can ask questions about any codebase, in any language, by cloning the dependency at the version I use.

Reading academic papers was another struggle, because it needed a lot of time to completely absorb and get the grasp of the design. Now I can turn a paper into a visualisation I can step through and break. 

## We already trust abstractions

Delivering software has always meant building abstractions: a set of interactions you know, with guarantees you can state. Defining APIs, components, modules and micro-services is what software architecture is about.

We also live with abstractions we never opened. Have you read your whole stack? Your compiler, the Linux kernel, all your dependencies? I bet not. SREs have always worked this way: their job is to operate systems they did not write, and they learn them from the outside through metrics, probes and incidents. Some systems are also so complex that you cannot keep the full map in your head, so you have to trust the software to behave like you think it would.

This is something SREs are trained to do, as they are mostly operating software they didn't write.

## The leaks are the learning opportunities

Joel Spolsky named it in 2002 with [the Law of Leaky Abstractions](https://www.joelonsoftware.com/2002/11/11/the-law-of-leaky-abstractions/): "All non-trivial abstractions, to some degree, are leaky." Sooner or later, a detail from underneath shows through, and you have to understand what the abstraction was hiding from you. It can take multiple forms:

* That fast query that turned out to become slower and slower,
* caching invalidation,
* a network call that looks like a function call, until it hangs for 15 minutes,
* memory you never have to free, until the garbage collector pauses everything,
* a retry that looks safe, until it runs your transaction twice.

A leak is the moment the abstraction forces you to open it, and it tells you exactly where to look. You don't study the whole engine; you study the part that broke a guarantee. Every item above is a **learning opportunities**, and to be fair, this is what separates juniors from seniors engineers.

Do we need to code to see the leaks? No, but you need to be close to production and accountable for the abstractions you are maintaining.

## Owning the abstractions

So what is left for us when the LLM writes most of the code? [Cindy Sridharan put it in a list](https://x.com/copyconstruct/status/2123943098527174884) that matches how I see the job today:

* understand the fundamentals,
* run experiments to prove the shortcomings in existing designs,
* analyze alternative designs and tradeoffs quantitatively,
* run continuous verification loops to categorically prove/disprove your implementation,
* communicate about all of this clearly.

Most of this list is about testing, and there are many testing strategies that can help you design the right abstractions for your software. Writing [a fake that proves correctness](/posts/designing-fakes-that-prove-correctness/) forces you to state the few methods your code actually calls and what each of them guarantees, and making that fake fail the way production does shows you the leaks before your users see them. [Deterministic simulation](/posts/simulation-driven-development/) pushes the same idea further, by running the abstraction through crashes and network partitions over thousands of seeds, each one replayable.

---

Feel free to reach out with any questions or to share your experiences with learning in the LLM era. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

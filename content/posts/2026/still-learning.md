+++
title = "Still Learning, despite LLMs writing all my code"
description = "TODO: one sentence for social media"
date = 2026-11-25
path = "posts/still-learning"
draft = true
[taxonomies]
tags = ["llm", "software-engineering", "personal"]
+++

As you may have guessed from [previous blogposts](/tags/llm/), I'm having a lot of fun in this new age for software engineering. But I see many people struggling to use LLMs, for many reasons. Today I want to talk about one of the fears I had that turned out to be massively wrong: **if the LLM writes the code, how do we still learn?**

## I stopped learning by typing a long time ago

I discovered coding late, when I arrived in my engineering school. I learned C, and spent countless nights building up my coding skill from the ground up. Then I started to work, and at some point, I stopped learning by implementing things alone and from scratch. Starting from scratch means walking from 0 to 80% on your own, with your own biases. You make the simple mistakes everyone made before you, and you end up with a simplistic view of the problem. So I read code that works instead. Most of my "Diving into" posts started that way: [etcd's linearizable reads](/posts/diving-into-etcd-linearizable/), [HBase's MemStore](/posts/diving-into-hbase-memstore/), [FoundationDB's simulation framework](/posts/diving-into-foundationdb-simulation/).

Reading is not memorising. Nobody remembers each line, we remember the structure, the happy path, the error path, the shape of the code. Writing is not memorising either: ask someone to explain code they wrote a few months ago. They walk to the whiteboard and draw boundaries, messages, and what each part guarantees, because the flow of the code is gone and only the guarantees stay, whoever typed it.

LLMs made reading cheap. For years, I have felt stuck by the language barrier: how can I discover and learn easily in a language that I don't master? With experience, you develop an insight that lets you read almost any programming language, but sometimes it is just tough. Nowadays, I can ask questions about any codebase, in any language, by [cloning the dependency at the version I use](/posts/llms-for-engineering/#clone-your-dependencies).

Reading academic papers was another struggle, because it took a lot of time to completely absorb a paper and grasp its design. Now I can turn a paper into a visualisation I can step through and break, as I did with Lamport's Paxos, from [Paxos Made Simple](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf) to the implementations that followed it.

## We already trust abstractions

The guarantees on that whiteboard are an abstraction. Delivering software has always meant building abstractions: a set of interactions you know, with guarantees you can state. Defining APIs, components, modules and micro-services is what software architecture is about.

We also live with abstractions we never opened. Have you read your whole stack, from your compiler to the Linux kernel and all your dependencies? I bet not. SREs have always worked this way: their job is to operate systems they did not write, and they learn them from the outside through metrics, probes and incidents. Some systems are also so complex that you cannot keep the full map in your head, so you have to trust the software to behave like you think it would.

## The leaks are the learning opportunities

Joel Spolsky described how abstractions break in 2002, with [the Law of Leaky Abstractions](https://www.joelonsoftware.com/2002/11/11/the-law-of-leaky-abstractions/): "All non-trivial abstractions, to some degree, are leaky." Sooner or later, a detail from underneath shows through, and you have to understand what the abstraction was hiding from you. It can take multiple forms:

* a fast query that turns out to become slower and slower,
* cache invalidation,
* a network call that looks like a function call, until it hangs for 15 minutes,
* memory you never have to free, until the garbage collector pauses everything,
* a retry that looks safe, until it runs your transaction twice.

A leak is the moment the abstraction forces you to open it, and it tells you exactly where to look. You don't study the whole engine, only the part that broke a guarantee. Every item above is a **learning opportunity**.

Do we need to code to see the leaks? No, but you need to be close to production and accountable for the abstractions you are maintaining.

## Owning the abstractions

So what is left for us when the LLM writes most of the code? [Cindy Sridharan put it in a list](https://x.com/copyconstruct/status/2123943098527174884) that matches how I see the job today:

* understand the fundamentals,
* run experiments to prove the shortcomings in existing designs,
* analyze alternative designs and tradeoffs quantitatively,
* run continuous verification loops to categorically prove/disprove your implementation,
* communicate about all of this clearly.

Most of this list is about testing, and I think everyone should now use testing strategies designed to find **unknown unknowns**, the bugs you cannot write a test for because you do not know they exist. Property-based testing, mutation testing, [fuzzing](/posts/diving-into-coverage-guided-fuzzing/), [deterministic simulation](/posts/simulation-driven-development/) and formal methods share the same idea: you state what the abstraction guarantees, and the tool searches for the inputs, the interleavings or the failures that break it.

The internals of your abstractions can become the LLM's territory, but their correctness, their behaviors and their own leaks stay your concern. Someone has to decide what the abstraction guarantees, check that the implementation keeps those guarantees, and get paged when it does not. That is our job, and it is where the learning happens, because every leak these tools find is ours to understand and fix.

---

Feel free to reach out with any questions or to share your experiences with learning in the LLM era. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

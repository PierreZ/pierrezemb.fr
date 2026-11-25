+++
title = "Still Learning, Despite LLMs Writing Most of My Code"
description = "TODO: one sentence for social media"
date = 2026-11-25
path = "posts/still-learning"
draft = true
[taxonomies]
tags = ["llm", "software-engineering", "personal"]
+++

As you may have guessed from [previous blog posts](/tags/llm/), I'm having a lot of fun in this [new age for software engineering](https://brooker.co.za/blog/2026/03/20/ic-leadership.html). But I see many people struggling with LLMs, and one of their fears was also mine, until it turned out to be massively wrong: **if the LLM writes the code, how do we still learn?**

## I stopped learning by typing a long time ago

I discovered coding late, when I arrived in my engineering school. I learned C, and spent countless nights building up my coding skill from the ground up. Then I started to work, and at some point, I stopped learning by implementing things alone and from scratch. Starting from scratch means making, alone and with your own biases, the simple mistakes everyone made before you. So I **read code that works** instead, starting when I was on call and some software kept paging me while other software never did, because I wanted to understand the difference. Most of my ["Diving into" posts](/tags/diving-into/) started that way: etcd's linearizable reads, HBase's MemStore, FoundationDB's simulation framework.

Reading all that code never meant learning it by heart. Nobody remembers each line, we remember the structure, the happy path, the error path, the shape of the code. Writing is not learning by heart either: ask someone to explain code they wrote a few months ago. They walk to the whiteboard and draw boundaries, messages, and what each part guarantees, because the flow of the code is gone and **only the guarantees stay**. That is true whoever typed the code.

And **reading is exactly what LLMs made cheap**. For years, the language barrier blocked me: experience lets you read almost any programming language, but a codebase in a language you have not mastered is just tough. Nowadays, I can ask questions about any codebase, in any language.

Reading academic papers was another struggle, because absorbing a design took me a lot of time. Now I can turn a paper into a visualization I can step through and break, as I did with Lamport's Paxos papers, starting from [Paxos Made Simple](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf).

## We already trust abstractions

Those guarantees we draw on the whiteboard are what we call an **abstraction**. Delivering software has always meant building abstractions: a set of interactions you know, with guarantees you can state.

We also live with abstractions we never opened. Have you read your whole stack, from your compiler to the Linux kernel and all your dependencies? I bet not. SREs have always worked this way, operating systems they did not write and learning them from the outside through metrics, probes and incidents, because some systems are too complex to keep the full map in your head.

## The leaks are the learning opportunities

That trust never holds forever, as Joel Spolsky described in 2002 with [the Law of Leaky Abstractions](https://www.joelonsoftware.com/2002/11/11/the-law-of-leaky-abstractions/): "All non-trivial abstractions, to some degree, are leaky." Sooner or later, a detail from underneath shows through, and you have to understand what the abstraction was hiding from you. It can take multiple forms:

* a fast query that gets slower and slower,
* a cache that serves stale data after an update,
* a network call that looks like a function call, until it hangs for 15 minutes,
* memory you never have to free, until the garbage collector pauses everything,
* a retry that looks safe, until it runs your transaction twice.

A **leak** is the moment the abstraction forces you to open it, and it tells you where to start looking. You don't study the whole engine, only the part that broke a guarantee. Every item above is a **learning opportunity**, for whoever is there to see it. Do we need to write the code to be that person? No, but we need to be **close to production and accountable** for the abstractions we maintain. This is one of the main reasons I am still part of the on-call rotation: I see the leaks and the software issues first-hand, which helps me develop the software better, and I do not lose touch with production.

## Owning the abstractions

If being close to production matters more than typing the code, what is left for us when the LLM writes most of it? [Cindy Sridharan put it in a list](https://x.com/copyconstruct/status/2123943098527174884) that matches how I see the job today:

* understand the fundamentals,
* run experiments to prove the shortcomings in existing designs,
* analyze alternative designs and tradeoffs quantitatively,
* run continuous verification loops to categorically prove/disprove your implementation,
* communicate about all of this clearly.

Two items of this list are about verification, and I think everyone should now use testing strategies designed to find **unknown unknowns**, [the bugs you cannot write a test for](/posts/llms-for-engineering/#simulation-feedback-for-distributed-systems). [Property-based testing](https://antithesis.com/resources/property_based_testing/), [fuzzing](/posts/diving-into-coverage-guided-fuzzing/), [deterministic simulation](/posts/simulation-driven-development/) and model checking all state what the abstraction guarantees and search for the inputs, the interleavings or the failures that break it, and mutation testing checks that your tests would notice a broken implementation. They let us see leaks before production does, and as Marc Brooker argues, [agents are only as good as the feedback they get](https://brooker.co.za/blog/2026/05/18/whats-easy-whats-hard.html).

They also make delegating safe. Do you prefer to spend your days writing minor code, or learning? Most projects have one core component that matters far more than the glue code and wiring around it, so **delegate the glue to the LLM** and spend the days you get back **mastering the core**.

Whether it is the core or the glue, someone has to decide what the abstraction guarantees, check that the implementation keeps it, and get paged when it does not. The LLM will not do it for us, because as Bryan Cantrill points out, [LLMs lack the virtue of laziness](https://bcantrill.dtrace.org/2026/04/12/the-peril-of-laziness-lost/): work costs them nothing, so left alone they make systems larger instead of simpler. That is our job and where the learning happens, because every leak these tools find is ours to understand and fix.

The fear is even stronger for engineers who are just starting, and Spolsky already had an answer: abstractions "save us time working, but they don't save us time learning". LLMs don't change that, but they change how fast a junior can meet the leaks that took me years of on-call to collect. If you are starting, **use the LLM as a tutor** for the fundamentals, get close to production early by owning projects and carrying a pager, as [Marc Brooker advises juniors](https://brooker.co.za/blog/2026/03/25/ic-junior.html), and learn the testing strategies above. Code is now cheap enough to prototype a design and watch it under load or failures, so you can **try three designs in an afternoon**, when a wrong design cost me nights of C before I saw it break.

And keep building. With LLMs, we have finally become engineers who **design the building**, not only the masons who put up the walls, so use that time to improve your engineering skills.

---

Feel free to reach out with any questions or to share your experiences with learning in the LLM era. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

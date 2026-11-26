+++
title = "If the LLM Writes the Code, How Do We Still Learn?"
description = "I was afraid that letting LLMs write my code would stop me from learning, and it turned out that typing had not been how I learn for years."
date = 2026-11-25
path = "posts/how-do-we-still-learn"
draft = true
[taxonomies]
tags = ["llm", "software-engineering", "personal"]
+++

As you may have guessed from [previous blog posts](/tags/llm/), I'm having a lot of fun in this [new age of software engineering](https://brooker.co.za/blog/2026/03/20/ic-leadership.html). But I see colleagues and friends struggling with LLMs, and one of their fears used to be mine, and it turned out to be wrong: **if the LLM writes the code, how do we still learn?**

## Typing stopped being how I learn a long time ago

I discovered coding late, when I started engineering school. I learned C, and spent countless nights building my coding skills from the ground up. Then I started working, and at some point, implementing things alone and from scratch stopped being how I learned. When you start from scratch, you are alone with your own biases, and you make the simple mistakes everyone made before you. So I started to **read code that works** instead. It began when I was on call, because some software kept paging me while other software never did, and I wanted to understand the difference. Most of my ["Diving into" posts](/tags/diving-into/) started that way: [etcd's linearizable reads](/posts/diving-into-etcd-linearizable/) and [HBase's MemStore](/posts/diving-into-hbase-memstore/).

Reading all that code never meant learning it by heart. Nobody remembers each line, we remember the structure, the happy path, the error path, the shape of the code. Writing is not learning by heart either. If you ask someone to explain code they wrote a few months ago, they walk to the whiteboard and draw boundaries, messages, and what each part guarantees, because the line-by-line detail is gone and **only the guarantees stay**. That is true no matter who typed the code.

And **reading is exactly what LLMs made cheap**. For years, I was blocked by programming languages I did not know well, because experience lets me follow the syntax of almost any language, but not a large codebase written in a language I have not mastered. Nowadays, I can ask questions about any codebase, in any language, which is how I read FoundationDB's C++ internals before writing [moonpool](https://github.com/PierreZ/moonpool). Reading academic papers was another struggle, because absorbing a design took me a lot of time. Now I can turn a paper into a visualization I can step through and break, as I did with Lamport's Paxos papers, starting from [Paxos Made Simple](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf). A concept is always easier to understand when I can see it move.

## We already trust abstractions

The boundaries and guarantees we draw on the whiteboard are what we call an **abstraction**, a set of interactions you know, with guarantees you can state. Delivering software has always meant building them.

We also live with abstractions we have never opened. Have you read your whole stack, from your compiler to the Linux kernel and all your dependencies? I bet not. SREs have always worked this way, and I operated HBase and Hadoop for years without having written them, learning them from the outside through metrics, probes and incidents, because some systems are too complex for anyone to keep the full map in their head. Code written by an LLM is just one more layer I did not write, so the real question is how far I can trust it.

## The leaks are the learning opportunities

Even earned trust never holds forever, as Joel Spolsky wrote in 2002 in [the Law of Leaky Abstractions](https://www.joelonsoftware.com/2002/11/11/the-law-of-leaky-abstractions/): "All non-trivial abstractions, to some degree, are leaky." Sooner or later, a detail from underneath shows through, and you have to understand what the abstraction was hiding from you. Leaks come in many forms:

* a fast query that gets slower and slower,
* a cache that serves stale data after an update,
* memory you never have to free, until the garbage collector pauses everything,
* a network call that looks like a function call, until it hangs for 15 minutes,
* an `fsync` that looks safe to retry after an error, until the retry reports success while the kernel has already dropped your dirty pages and the data is gone, as PostgreSQL found with [fsyncgate](https://wiki.postgresql.org/wiki/Fsync_Errors) in 2018,
* a retry that looks safe, until it hits an operation that is not idempotent and charges your customer twice,
* retries that keep the system overloaded long after the trigger is gone, one of the [metastable failures](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf) described at HotOS 2021.

A **leak** is the moment the abstraction forces you to open it, and it tells you where to start looking. You don't study the whole engine, only the part that broke a guarantee. Every item above is **a learning opportunity** for whoever is there to see it. Do we need to write the code to be the one who sees it? No, but we need to be **close to production and accountable** for the abstractions we maintain. This is one of the main reasons I am still part of the on-call rotation: I see the leaks and the software issues first-hand, which helps me build better software.

## Owning the abstractions

If being close to production matters more than typing the code, what is left for us when the LLM writes most of it? [Cindy Sridharan wrote a list](https://x.com/copyconstruct/status/2123943098527174884) that matches how I see the job today:

* understand the fundamentals,
* run experiments to prove the shortcomings in existing designs,
* analyze alternative designs and tradeoffs quantitatively,
* run continuous verification loops to categorically prove/disprove your implementation,
* communicate about all of this clearly.

Two items on this list are about verification, and I think everyone should now use testing strategies designed to find **unknown unknowns**, [the bugs you cannot write a test for](/posts/llms-for-engineering/#simulation-feedback-for-distributed-systems). [Property-based testing](https://antithesis.com/resources/property_based_testing/), [fuzzing](/posts/diving-into-coverage-guided-fuzzing/), [deterministic simulation](/posts/simulation-driven-development/) and model checking all search for the inputs, the interleavings or the failures that break what the abstraction guarantees. Mutation testing then checks that your tests would notice a broken implementation. This is where the trust in code I did not write comes from. These strategies let us find leaks before they reach production, and they give the LLM the feedback it needs, because, as Marc Brooker argues, [accurate feedback sets the limit of what agents can do](https://brooker.co.za/blog/2026/05/18/whats-easy-whats-hard.html).

These testing strategies also make delegation safe. Would you rather spend your days writing glue code or learning? Most projects have one core component that matters far more than the wiring around it, so delegate the glue to the LLM and spend the days you get back on the core: its guarantees, its failure modes and its tests.

Whether it is the core or the glue, someone has to decide what the abstraction guarantees, check that the implementation respects those guarantees, and get paged when it does not. That is our job, and it is where the learning happens, because we are the ones who have to understand and fix every leak the testing strategies find. Keeping the system small is our job too, because as Bryan Cantrill points out, [LLMs lack the virtue of laziness](https://bcantrill.dtrace.org/2026/04/12/the-peril-of-laziness-lost/): work costs them nothing, so left unchecked they make systems larger, not better.

## Juniors learn faster now

The fear is even stronger for engineers who are just starting out, and Spolsky had already seen it with the code-generation tools of 2002: abstractions "save us time working, but they don't save us time learning". LLMs don't change that, but they change how fast a junior can [run into the leaks](/posts/simulation-driven-development/#benefits-for-developer-education) that took me years of on-call to find. If you are starting out, get close to production early by owning projects and carrying a pager, as [Marc Brooker advises juniors](https://brooker.co.za/blog/2026/03/25/ic-junior.html). Use the LLM as a tutor for the fundamentals, and learn the testing strategies above. Code is now cheap enough to prototype a design and watch it under load or failure, so you can try three designs in an afternoon. A wrong design used to cost me nights of C before I saw it break.

And keep building things. With LLMs, we spend more of our days as the engineer who designs the house than as the mason who puts up the walls, so use that time to improve your engineering skills.

---

Feel free to reach out with any questions or to share your experiences with learning in the LLM era. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

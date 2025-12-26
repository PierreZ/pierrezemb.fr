+++
title = "2025: A Year in Review"
description = "Reflections on returning to engineering, discovering simulation as a superpower, learning to work with LLMs, and the compounding value of years of distributed systems work."
date = 2025-12-26
[taxonomies]
tags = ["personal"]
+++

2025 was the year I stopped managing and started shipping software again. After nearly two years of context-switching between fires and people issues, I returned to the keyboard. As the year closes, it feels like the right time to look back. It was about **going deeper**: into code, into writing, and into understanding why simulation testing is a superpower.

## Back in Engineering

### The Transition

In January, I [went back to engineering](/posts/back-engineering/) after nearly two years in management. It felt like coming home.

But I will be honest: the transition was harder than I expected. There was real imposter syndrome. Had I lost my edge? Was I still the technical person I used to be? The hardest part was not the code itself but giving myself **permission to focus**. Having another engineering manager handle the team and another SRE team handling the fires while I dove into low-level work was the perfect setup. I am also **grateful** to the whole team for making that transition possible. But after three years of context-switching between fires and people issues, sitting down to write code without interruption felt almost wrong. It took months to fully allow myself to focus without afterthoughts.

### Building the Toolbox Behind Materia, the Long Way Around

Helping put [Clever Cloud's etcd shim](https://www.clever-cloud.com/blog/company/2025/06/27/why-we-finally-built-our-own-managed-kubernetes-etcd/) into production was meaningful because of the long arc behind it.

At OVHcloud, I got paged too often when etcd hit its performance ceiling. We were adding hundreds of customers per etcd cluster, each with their own Kubernetes control plane. I [talked about this at KubeCon](https://www.youtube.com/watch?v=IrJyrGQ_R9c). Spawning three etcd nodes per customer is not a valid approach at scale, whether in the cloud or on-premise. You need to mutualize, but you cannot scale etcd horizontally because the whole keyspace must fit on every member and the recommended storage limit is **8GB**. When you outgrow one cluster, you boot another, split your keys, and now you operate two, three, or many clusters. We had to balance customers manually across clusters. After [contributing a custom balancer to HBase](/posts/hbase-custom-data-balancing/) to solve exactly this problem, doing it by hand for etcd felt like going backward.

Then I discovered Apple's [FDB Record Layer](https://pierrez.github.io/fdb-book/the-record-layer/what-is-record-layer.html). It was an eye-opener: here was a way to **virtualize database-like systems** on top of FoundationDB, building any storage abstraction you want on a rock-solid distributed foundation. During France's first lockdown, I [prototyped an etcd layer](https://forums.foundationdb.org/t/a-foundationdb-layer-for-apiserver-as-an-alternative-to-etcd/2697) using the Record Layer. The prototype worked, but more importantly, the Record Layer showed me what was important: **a reusable toolbox to encapsulate FoundationDB knowledge**.

I moved to Clever Cloud to build exactly that: serverless systems based on FoundationDB. We started building the toolbox in Rust, piece by piece, driven by what our layers actually needed. Our first layer was [Materia KV](https://www.clever-cloud.com/product/materia-kv/), exposing the Redis protocol. That forced us to build the foundational primitives.

One highlight was building the query engine for Materia. I wrote [datafusion-index-provider](https://github.com/datafusion-contrib/datafusion-index-provider), a library that extends Apache DataFusion with index-based query acceleration. I had a lot of fun digging into how a query plan might look when fetching indexes: a two-phase model where you first scan indexes to identify matching row IDs, then fetch complete records. The interesting part was combining **AND** and **OR** operations. AND predicates build a left-deep tree of joins to intersect row IDs across indexes. OR predicates use unions with deduplication to merge results without fetching the same record twice. The first time DataFusion, FoundationDB, and our indexes all connected and a SELECT query returned real data, [I remembered why I write software](/posts/thank-you-datafusion/).

Then came etcd, which required **a lot** more work: watches, leases, revision tracking. I [debugged the watch cache](/posts/diving-into-kubernetes-watch-cache/) along the way. We are not alone in this approach: [AWS](https://aws.amazon.com/blogs/containers/under-the-hood-amazon-eks-ultra-scale-clusters/) and [GKE](https://cloud.google.com/blog/products/containers-kubernetes/gke-65k-nodes-and-counting?hl=en) also run custom storage layers for Kubernetes at scale. No more splitting clusters, no more manual data balancing, no more operational nightmares. FoundationDB handles the hard distributed systems parts. Years of frustration with etcd turned into an etcd-compatible API backing Kubernetes control planes.

## The Simulation Year

### The Awakening

Then came [BugBash 2025](https://bugbash.antithesis.com/) in early April.

The conference in Washington D.C., organized by Antithesis, brought together people like Kyle Kingsbury, Ankush Desai, and Mitchell Hashimoto to discuss software reliability. The highlight was meeting some of the original FoundationDB creators. Hearing their war stories and seeing how deeply simulation shaped FDB's legendary reliability reignited something in me. I had been using FDB's simulation for years, but I had never fully internalized that **[this could be how I write all software](/posts/simulation-driven-development/)**.

BugBash reminded me of my painful on-call years at OVHcloud. Before etcd, I operated a massive HBase cluster: 255 machines, 2 million writes per second, 6 million reads. HBase was weak to network issues, and every incident triggered region split inconsistencies. We ran hbck in brutal ways just to keep things running. HBase led me to FDB, a system **built to handle network chaos**, and that robustness comes from simulation.

### From Understanding to Building

2025 was about turning that understanding into something real. At work, we added simulation workloads to critical software running on top of Materia. I [spoke at Devoxx France](https://docs.google.com/presentation/d/1xm4yNGnV2Oi8Lk3ZHEvg4aDMNEFieSmW06CkItCigSc/edit?usp=sharing) about embracing simulation-driven development. But I wanted to go deeper: to understand how FoundationDB created its robustness. So I [dug into the implementation](/posts/diving-into-foundationdb-simulation/), then started backporting it to Rust.

That became [moonpool](https://github.com/PierreZ/moonpool).

I split moonpool into four crates, each a foundational block for distributed systems. **[moonpool-core](https://docs.rs/moonpool-core/latest/moonpool_core/)** defines provider traits for time, networking, task spawning, and randomness. Same code runs in production and simulation. **[moonpool-sim](https://docs.rs/moonpool-sim/latest/moonpool_sim/)** is the simulation engine: virtual time, event queues, and fault injection. **[moonpool-transport](https://docs.rs/moonpool-transport/latest/moonpool_transport/)** provides FDB-style RPC: connection management, checksummed wire formats, automatic reconnection. Claude accelerated this work significantly. I used it to translate C++ patterns into Rust. At some point, [Claude started fixing bugs on its own](/posts/testing-prevention-vs-discovery/).

At the beginning of 2025, I had basic knowledge of deterministic simulation. By the end, I had built a framework. In 2026, I will start a **blogpost series** explaining moonpool's internals. Maybe it becomes something others can use. Maybe it stays a hobby project. Either way, I am convinced: **simulation is the future**.

## Sharing

I set a goal to write one or two posts per month, and I published 20. You can trace my monthly focus just by looking at what I published. The results surprised me: traffic multiplied by 2.5x according to Plausible. This was also the first year where people actually reached out to say **thank you** for sharing. I always assumed no one was reading.

The top posts by visitors: [NixOS: The Good, The Bad, and The Ugly](/posts/nixos-good-bad-ugly/), [Unlocking Tokio's Hidden Gems](/posts/tokio-hidden-gems/), [Distributed Systems Resources](/posts/distsys-resources/), and [What if we embraced simulation-driven development?](/posts/simulation-driven-development/). Strangely enough, my most shared post was not about distributed systems or FoundationDB but about NixOS. I think people appreciated the honest take: the good, the bad, **and** the ugly. The Tokio post being #2 was also unexpected. Sometimes the posts you almost do not publish are the ones that resonate.

I love making presentations. In 2025, I gave two talks at Devoxx France: one about [simulation-driven development](https://docs.google.com/presentation/d/1xm4yNGnV2Oi8Lk3ZHEvg4aDMNEFieSmW06CkItCigSc/edit?usp=sharing) and another about [prototyping distributed systems with Maelstrom](https://docs.google.com/presentation/d/1UbJ7drA_6hX7kLN2nV8IxOsAt1k8WOnfGrEfRlbIa7k/edit?usp=sharing). I also presented [my fdb-rs journey](https://docs.google.com/presentation/d/13pCaWXNkITj5Sh4dKofILbxPg_Wb2BBedbbi2Mv4PoE/edit?usp=sharing) at [FinistDevs](https://finistdevs.org/), which I help organize in Brest.

The [FoundationDB Rust crate](https://crates.io/crates/foundationdb) keeps growing: 11 million downloads, used in production by real companies. But I was not a great maintainer this year. Development followed Clever Cloud's requirements. People asked for documentation about simulation testing and a roadmap, and I did not deliver. That is not a complaint about open source, just honesty. Being a solo maintainer without foundation backing means priorities get driven by the day job. Last week I finally wrote a roadmap and flushed my brain into GitHub issues so contributors can pick up work. I hope to do better in 2026.

## How LLMs Changed My Work

I cannot write about 2025 without talking about LLMs. I spent a **lot** of time learning how to use them in my work.

For years, I had a weekly habit: two hours dedicated to reading codebases I depend on, understanding the internals of libraries, frameworks, and databases. Then I stopped. Life got busy, management took over, and diving into unfamiliar code took too long to justify. With LLMs, I picked the habit back up. What used to take hours now takes minutes. I can explore a codebase conversationally, asking questions, jumping to relevant sections, building mental models faster than ever. I learn more now than I did before.

They handle peripheral code well: glue code, boilerplate, scaffolding. Geoffrey Litt calls this "[coding like a surgeon](https://www.geoffreylitt.com/2025/10/24/code-like-a-surgeon)": delegate the prep work, focus on what matters. Moonpool is a good example. Claude translated C++ Flow patterns into Rust and generated test scaffolding. But knowing **what** to translate required years of operating distributed systems: why FDB uses interface swapping, why buggify has two-phase activation, why virtual time compresses hours into seconds. As João Alves wrote, when "[software becomes fast food](https://world.hey.com/joaoqalves/when-software-becomes-fast-food-23147c9b)", expertise becomes the scarce resource.

But what I did not expect is that working with LLMs forces me to flesh out invariants and hidden rules somewhere explicit. You need to write things down for the LLM to understand, and that documentation ends up being useful for humans too. **Context is everything**: given the right context, LLMs generate the right code. So I spent a lot of time (and tokens) generating project recaps and summaries to feed them. When working with libraries, I make local git clones so the LLM can browse the actual source code instead of relying on potentially outdated training data. I have been using Claude extensively, and I found [spec-kit](https://github.com/github/spec-kit) helpful for framing my prompts. It is a toolkit for "spec-driven development" that helps you focus on product scenarios instead of what Simon Willison calls "[vibe coding](https://simonwillison.net/2025/Oct/7/vibe-engineering/)". But [we are still missing the tools](/posts/specs-are-back/) to make this workflow seamless.

Some posts became unexpectedly useful as LLM context. My [practical guide to application metrics](/posts/practical-guide-to-application-metrics/) and my [guidelines for FDB workloads](/posts/writing-rust-fdb-workloads-that-find-bugs/) now live in project contexts. When I ask Claude to add instrumentation or write a simulation workload, it already knows my patterns.

## Looking Ahead

2025 reminded me why I love this work: building systems, learning in public, watching years of investment pay off.

For 2026, the habits stay: writing one or two posts per month, reading codebases with LLM assistance, speaking at conferences. I want to push moonpool toward something others can actually use. We have ambitious plans for Materia at Clever Cloud, and some of them should lead me to contribute to FoundationDB directly. I will keep helping organize [FinistDevs](https://finistdevs.org/) in Brest. And I will definitely be back at BugBash 2026.

The theme is the same as 2025: go deeper, share what I learn, build things that last. **What did your 2025 look like?**

---

Feel free to reach out to share your own 2025 reflections. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

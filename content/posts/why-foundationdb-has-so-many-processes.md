+++
title = "Why Does FoundationDB Have So Many Processes?"
description = "Compartmentalization explains FoundationDB's architecture: find the responsibilities that got coupled together, split them, and scale only the parts that can scale."
date = 2026-07-30
draft = true
[taxonomies]
tags = ["distributed-systems", "foundationdb", "consensus", "algorithms"]
+++

## The architecture I couldn't explain

One thing always puzzled me about FoundationDB. Compared to many distributed databases, its architecture looks almost excessive: GRV proxies, commit proxies, resolvers, log servers, storage servers, ratekeepers, data distributors, cluster controllers. Every responsibility seems to be its own process, and it was deliberately designed this way from the beginning. After years of operating FDB for [Materia](https://www.clever-cloud.com/materia/) at Clever Cloud, I understood what every component did, but I couldn't explain why the system had been split that way. Michael Whittaker's [**Scaling Replicated State Machines with Compartmentalization**](https://mwhittaker.github.io/publications/compartmentalized_paxos.html) (VLDB 2021) finally gave me the vocabulary I was missing.

## A different way to look at distributed systems

When we learn distributed systems, we usually learn to partition: partition the data, partition the workload, add replicas. The paper looks at systems from a different angle. Instead of asking how to split the data, ask:

**Which responsibilities have we accidentally coupled together?**

It calls the answer **compartmentalization**: decouple individual bottlenecks into distinct components, then scale those components independently. The MultiPaxos leader is its canonical example. The leader has exactly two responsibilities, sequencing commands into the log and handling the communication for the whole protocol, and the coupling shows as soon as you count messages: per command, the leader touches seven while every other node touches at most two. There is no fundamental reason those two jobs have to live together. Sequencing is inherently serialized, communication is embarrassingly parallel, so the paper introduces **proxy leaders**: the leader keeps sequencing and hands each command to a proxy leader that runs the rest of the protocol. The leader drops to two messages per command, proxy leaders scale until they are never the bottleneck, and applied across the whole protocol the technique raises MultiPaxos throughput by 6x on a write-only workload and 16x on a mixed read-write one, without changing the protocol.

## How I read systems now

Since reading the paper, I read distributed systems through the same short list of questions.

**How many RPCs does each component touch per request?** I start with the communication graph, not the algorithm: who receives every request, who fans out to the rest of the cluster. Counting messages finds the bottleneck long before I understand the protocol.

**What is this component actually responsible for?** Persistence, sequencing, conflict detection, broadcasting, batching, replying to clients? When one component does many unrelated jobs, I wonder whether they really belong together.

**Which steps are inherently serialized, and which are embarrassingly parallel?** Ordering commands is serialized, broadcasting them isn't, replying to clients isn't, and conflict detection might not be. Once I know which parts are fundamentally sequential, the architecture starts to explain itself.

**Do reads have to travel the write path?** Writes must go through the leader and every replica, but reads commute, so the paper routes them around the leader to a single replica with Paxos Quorum Reads. Read-heavy is the norm: the paper cites the [Chubby](https://www.usenix.org/legacy/event/osdi06/tech/burrows.html) paper (OSDI 2006) observing fewer than 1% of operations as writes, and the [Spanner](https://www.usenix.org/conference/osdi12/technical-sessions/presentation/corbett) paper (OSDI 2012) fewer than 0.3%.

**Is batching a responsibility of its own?** The paper adds batchers and unbatchers, so the leader and the replicas only ever touch batches instead of individual messages.

Looking back at FoundationDB, I stopped seeing dozens of processes and started seeing answers to those questions. The sequencer hands out versions, the one job that has to be serialized. Resolvers check conflicts in parallel. Commit proxies batch and broadcast. GRV proxies and storage servers form the read path, entirely separate from the commit path.

## Every split has a cost

Compartmentalization isn't free. Every isolated responsibility is another running component, another RPC path, another thing that can fail, be upgraded, and be reconfigured. The responsibilities can evolve independently, but the number of possible interactions grows quickly. I think this is also why FoundationDB invested so heavily in [deterministic simulation](/posts/diving-into-foundationdb-simulation/): once your architecture is dozens of independently reconfigurable components, validating all those interactions with traditional integration tests becomes increasingly difficult. That's probably a topic for another post.

---

If you work on distributed systems, I highly recommend [Michael Whittaker's talk](https://mwhittaker.github.io/publications/compartmentalized_paxos.html) on **Scaling Replicated State Machines with Compartmentalization**. It isn't just a Paxos optimization, it offers a simple design heuristic that has permanently changed the way I read papers and think about architecture.

{{ youtube(id="LWFml1LFIqc", title="Scaling Replicated State Machines with Compartmentalization") }}

Which responsibilities are coupled together in the system you operate?

---

Feel free to reach out with any questions or to share your experiences with compartmentalization. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

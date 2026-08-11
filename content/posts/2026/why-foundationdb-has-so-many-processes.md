+++
title = "Why Does FoundationDB Have So Many Processes?"
description = "Compartmentalization explains FoundationDB's architecture: find the responsibilities that got coupled together, split them, and scale only the parts that can scale."
date = 2026-08-11
path = "posts/why-foundationdb-has-so-many-processes"
draft = true
[taxonomies]
tags = ["distributed-systems", "foundationdb", "consensus", "algorithms"]
+++

## The architecture I couldn't explain

One thing always puzzled me about FoundationDB. Compared to many distributed databases, its architecture looks almost excessive: GRV proxies, commit proxies, resolvers, log servers, storage servers, and that's only the data plane. Every responsibility seems to be its own process, and it was deliberately designed this way from the beginning. After years of operating FDB for [Materia](https://www.clever-cloud.com/materia/) at Clever Cloud, I understood what every component did, but I couldn't explain why the system had been split that way. Michael Whittaker's [**Scaling Replicated State Machines with Compartmentalization**](https://mwhittaker.github.io/publications/compartmentalized_paxos.html) (VLDB 2021) finally gave me the vocabulary I was missing.

Start with his talk, it explains the paper better than I could. The rest of this post is what his lens does to FoundationDB:

{{ youtube(id="LWFml1LFIqc", title="Scaling Replicated State Machines with Compartmentalization") }}

## A different way to look at distributed systems

When we learn distributed systems, we usually learn to partition: partition the data, partition the workload, add replicas. The paper looks at systems from a different angle. Instead of asking how to split the data, ask:

**Which responsibilities have we accidentally coupled together?**

It calls the answer **compartmentalization**: decouple individual bottlenecks into distinct components, then scale those components independently. The MultiPaxos leader is its canonical example. The leader has two responsibilities, sequencing commands into the log and handling the communication for the whole protocol, and the coupling shows as soon as you count messages: per command, the leader touches seven messages when the cluster tolerates one failure, while every other node touches at most two. Scaling does not help, adding acceptors or replicas only gives the leader more nodes to talk to.

{% mermaid() %}
flowchart TB
    subgraph t1["MultiPaxos: 7 messages touch the leader"]
        direction TB
        C1([Client]) -- "x" --> L1["Leader"]
        L1 -- "replicate x, 1 per acceptor" --> A1["Acceptors"]
        A1 -- "ack, 1 per acceptor" --> L2["Leader"]
        L2 -- "x is chosen, 1 per replica" --> R1["Replicas"]
        R1 -- "result of x" --> C2([Client])
    end
{% end %}

There is no fundamental reason those two jobs have to live together. Sequencing is inherently serialized, communication is embarrassingly parallel, so the paper introduces **proxy leaders**: the leader keeps sequencing and hands each command to a proxy leader that runs the rest of the protocol, dropping the leader to two messages per command. I will not paraphrase the whole construction, the talk does it better, so here is just the paper's result: applied across the protocol, compartmentalization raises MultiPaxos throughput by 6x on a write-only workload and 16x on a workload with 90% reads, without adopting a new protocol.

{% mermaid() %}
flowchart TB
    subgraph t2["Compartmentalized: 2 messages touch the leader, the rest moved to scalable proxy leaders"]
        direction TB
        C3([Client]) -- "x" --> L3["Leader"]
        L3 -- "x at position 0" --> P1["Proxy leader"]
        P1 -- "replicate x, 1 per acceptor" --> A2["Acceptors"]
        A2 -- "ack, 1 per acceptor" --> P2["Proxy leader"]
        P2 -- "x is chosen, 1 per replica" --> R2["Replicas"]
        R2 -- "result of x" --> C4([Client])
    end
{% end %}

## How I read systems now

Since reading the paper, I read distributed systems through the same short list of questions.

**How many RPCs does each component touch per request?** I start with the communication graph, not the algorithm: who receives every request, who fans out to the rest of the cluster. Counting messages finds the bottleneck long before I understand the protocol.

**What is this component actually responsible for?** Persistence, sequencing, conflict detection, broadcasting, batching, replying to clients? When one component does many unrelated jobs, I wonder whether they really belong together.

**Which steps are inherently serialized, and which are embarrassingly parallel?** Ordering commands is serialized, broadcasting them isn't, replying to clients isn't, and conflict detection might not be. Once I know which parts are fundamentally sequential, the architecture starts to explain itself.

**Do reads have to travel the write path?** Writes must go through the leader and every replica, but reads commute, so the paper routes them around the leader with Paxos Quorum Reads, asking a quorum of acceptors for a log position and then reading from a single replica. Read-heavy is the norm: the paper cites the [Chubby](https://www.usenix.org/legacy/event/osdi06/tech/burrows.html) paper (OSDI 2006) observing fewer than 1% of operations as writes, and the [Spanner](https://www.usenix.org/conference/osdi12/technical-sessions/presentation/corbett) paper (OSDI 2012) fewer than 0.3%.

**Is batching a responsibility of its own?** The paper adds batchers and unbatchers, so the leader and the replicas only ever touch batches instead of individual messages.

Looking back at FoundationDB, I stopped seeing dozens of processes and started seeing answers to those questions. The sequencer hands out versions, the one job that has to be serialized. Resolvers check conflicts in parallel. Commit proxies batch and broadcast to the log servers, and storage servers pull from them. The talk's second example, partitioning the log across acceptor groups to scale the acceptors, is the same move FDB makes when it spreads tagged mutations across the log servers. The read path is the paper's two-step read made concrete: a GRV proxy hands out a read version the way a quorum of acceptors hands out a log position, then a storage server caught up to that version serves the read, entirely separate from the commit path.

## Every split has a cost

Compartmentalization isn't free. Every isolated responsibility is another running component, another RPC path, another thing that can fail, be upgraded, and be reconfigured, and reconfiguration is a hard enough problem that the same author wrote [**Matchmaker Paxos**](https://mwhittaker.github.io/publications/matchmaker_paxos.html) about it, another paper I like a lot.

The paper is upfront about the price: its 6x speedup used 6.66x the machines, a command now crosses six network delays instead of four, and running more machines shortens the expected time to f failures. The responsibilities can evolve independently, but the number of possible interactions grows quickly. I think this is also why FoundationDB invested so heavily in [deterministic simulation](/posts/diving-into-foundationdb-simulation/): once your architecture is dozens of independently reconfigurable components, validating all those interactions with traditional integration tests becomes increasingly difficult.

---

Which responsibilities are coupled together in the system you operate?

---

Feel free to reach out with any questions or to share your experiences with compartmentalization. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

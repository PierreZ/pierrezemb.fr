+++
title = "Explaining FoundationDB's Architecture Through Compartmentalization"
description = "Compartmentalization explains FoundationDB's architecture: find the responsibilities that got coupled together, split them, and scale only the parts that can scale."
date = 2026-08-13
path = "posts/foundationdb-architecture-through-compartmentalization"
[taxonomies]
tags = ["distributed-systems", "foundationdb", "consensus", "algorithms"]
+++

## The architecture I couldn't explain

One thing always puzzled me about FoundationDB: compared to many distributed databases, its architecture looks almost excessive: GRV proxies, commit proxies, resolvers, log servers, storage servers, and that's only the data plane. When I say that I operate FDB, people often ask, "Isn't that complicated? There are so many processes and roles." After years of operating FDB for [Materia](https://www.clever-cloud.com/materia/) at Clever Cloud, I understood what every component did, but I couldn't explain why the system had been split that way. Michael Whittaker's [**Scaling Replicated State Machines with Compartmentalization**](https://mwhittaker.github.io/publications/compartmentalized_paxos.html) (VLDB 2021) finally gave me the vocabulary I was missing.

Start with his talk, it explains the paper better than I could:

{{ youtube(id="LWFml1LFIqc", title="Scaling Replicated State Machines with Compartmentalization") }}

## A different way to look at distributed systems

When we learn distributed systems, we usually learn to partition data and replicate it. The paper asks a different question: **which responsibilities are accidentally coupled inside the bottleneck?**

It calls the answer **compartmentalization**: separate those responsibilities, then scale each one independently.

The MultiPaxos leader is its canonical example, since it sequences commands into the log and handles communication for the whole protocol. For f = 1, each command gives the leader one client message, four messages exchanged with a quorum of two acceptors, and two messages to replicas, seven messages in total, so adding acceptors or replicas only gives it more nodes to talk to.

{% mermaid() %}
sequenceDiagram
    participant C as Client
    participant L as Leader
    participant A as Acceptors
    participant R as Replicas
    C->>L: x
    L->>A: replicate x to quorum of 2 acceptors
    A->>L: acknowledgements from 2 acceptors
    L->>R: x is chosen, sent to 2 replicas
    R->>C: result of x
    Note over L: 7 messages touch leader
{% end %}

There is no fundamental reason those two jobs have to live together. Sequencing is inherently serialized, communication is embarrassingly parallel, so the paper introduces **proxy leaders**: the leader keeps sequencing and hands each command to a proxy leader that runs the rest of the protocol, dropping the leader to two messages per command. I will not paraphrase the whole construction, the talk does it better, so here is just the paper's result: applied across the protocol, compartmentalization raises MultiPaxos throughput by 6x on a write-only workload and 16x on a workload with 90% reads, without adopting a new protocol.

{% mermaid() %}
sequenceDiagram
    participant C as Client
    participant L as Leader
    participant P as Proxy leader
    participant A as Acceptors
    participant R as Replicas
    C->>L: x
    L->>P: x at position 0
    P->>A: replicate x to quorum of 2 acceptors
    A->>P: acknowledgements from 2 acceptors
    P->>R: x is chosen, sent to 2 replicas
    R->>C: result of x
    Note over L: 2 messages touch leader
    Note over P: 7 messages touch proxy
{% end %}

## How I read systems now

Since reading the paper, I read distributed systems through the same short list of questions.

* **How many RPCs does each component touch per request?**
* **What is this component actually responsible for?**
* **Which steps are inherently serialized, and which are embarrassingly parallel?**
* **When I add instances, does the work per node go down, or does fan-out go up?**
* **Can this work be partitioned across independent groups?**

Looking back at FoundationDB, I stopped seeing dozens of processes and started seeing answers to those questions. The RPC flow makes those splits visible:

{% mermaid() %}
sequenceDiagram
    participant C as Client
    participant G as GRV proxy
    participant M as Master (singleton sequencer)
    participant S as Storage servers
    participant CP as Commit proxy
    participant R as Resolvers
    participant T as TLogs
    C->>G: get read version
    G->>M: batched request
    M-->>G: read version
    G-->>C: read version
    C->>S: read keys at version
    S-->>C: values
    C->>CP: commit transaction
    CP->>M: batched commit-version request
    M-->>CP: commit version
    CP->>R: conflict ranges
    R-->>CP: conflict decisions
    CP->>T: mutations and commit version
    T-->>CP: durable
    CP->>M: live committed version
    M-->>CP: acknowledged
    CP-->>C: commit result
{% end %}

FoundationDB does not minimize the total number of round trips. It keeps the RPC count low at the serialized role. The Master sees batched version requests and live committed version reports, while GRV and commit proxies carry the client traffic. Commit proxies coordinate the fan-out to resolvers and TLogs.

The remaining work is divided along its own boundaries. Resolvers partition conflict checking by key range, TLogs durably retain mutation streams for storage servers, and storage servers serve reads directly once clients locate the relevant ranges. The scalable responsibilities have their own pools, while the Master remains a singleton. FDB's process count comes from those separate scaling decisions.

## Every split has a cost

Compartmentalization isn't free. The paper's 6x speedup used 6.66x the machines, a command crosses six network delays instead of four, and running more machines shortens the expected time to f failures. Those additional roles also create more RPC paths, upgrade boundaries, and interactions between roles during failures.

{% note() %}
As a side note, reconfiguration is a hard enough problem that Michael Whittaker also wrote [**Matchmaker Paxos**](https://mwhittaker.github.io/publications/matchmaker_paxos.html) about it, another paper I like a lot.
{% end %}

FoundationDB pays that cost when the transaction system's shape changes. GRV proxies, commit proxies, resolvers, and TLogs have configured counts, but changing one does not resize a pool in place. FDB starts a new transaction-system epoch and recruits the roles according to the new configuration. I really like this: from the outside, it looks like tearing the transaction system down and bringing it back up, although old TLogs can remain until storage servers consume their mutations.

[FoundationDB's simulation suite](/posts/diving-into-foundationdb-simulation/) exercises shutdown and recovery so often that it almost makes this look easy.

---

Feel free to reach out with any questions or to share your experiences with compartmentalization. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

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

One thing always puzzled me about FoundationDB. Compared to many distributed databases, its architecture looks almost excessive: GRV proxies, commit proxies, resolvers, log servers, storage servers, and that's only the data plane. Each of these roles has a narrow responsibility, often in its own process. After years of operating FDB for [Materia](https://www.clever-cloud.com/materia/) at Clever Cloud, I understood what every component did, but I couldn't explain why the system had been split that way. Michael Whittaker's [**Scaling Replicated State Machines with Compartmentalization**](https://mwhittaker.github.io/publications/compartmentalized_paxos.html) (VLDB 2021) finally gave me the vocabulary I was missing.

Start with his talk, it explains the paper better than I could:

{{ youtube(id="LWFml1LFIqc", title="Scaling Replicated State Machines with Compartmentalization") }}

## A different way to look at distributed systems

When we learn distributed systems, we usually learn to partition: partition the data, partition the workload, add replicas. The paper looks at systems from a different angle. Instead of asking how to split the data, ask:

**Which responsibilities have we accidentally coupled together?**

It calls the answer **compartmentalization**: decouple individual bottlenecks into distinct components, then scale those components independently. The MultiPaxos leader is its canonical example, since it sequences commands into the log and handles communication for the whole protocol. For f = 1, each command gives the leader one client message, four messages exchanged with a quorum of two acceptors, and two messages to replicas, seven messages in total, so adding acceptors or replicas only gives it more nodes to talk to.

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

**How many RPCs does each component touch per request?** I start with the communication graph, not the algorithm: who receives every request, who fans out to the rest of the cluster. Counting messages gives me a first hypothesis about the bottleneck long before I understand the protocol.

**What is this component actually responsible for?** Persistence, sequencing, conflict detection, broadcasting, batching, replying to clients? When one component does many unrelated jobs, I wonder whether they really belong together.

**Which steps are inherently serialized, and which are embarrassingly parallel?** Ordering commands is serialized, broadcasting them isn't, replying to clients isn't, and conflict detection might not be. Once I know which parts are fundamentally sequential, the architecture starts to explain itself.

**When I add instances, does the work per node go down, or does fan-out go up?** I want to know whether an added instance absorbs work or simply gives a singleton more nodes to contact.

**Can this work be partitioned across independent groups?** The talk's acceptor-group example partitions the log across groups to scale the acceptors, so I ask whether the work can be split across independent groups in the same way.

Looking back at FoundationDB, I stopped seeing dozens of processes and started seeing answers to those questions. The master, the FDB sequencer, keeps version assignment serialized. GRV proxies batch read-version requests and keep client fan-in away from that singleton. Commit proxies batch transactions, send their conflict ranges to resolvers, then tag the mutations and synchronously push them to TLogs. Resolvers can partition conflict checking by key range, while TLogs are replicated, sharded persistent mutation queues. FDB uses a different protocol, and the useful analogy is the separation itself: its transaction system keeps serialized work apart from communication, conflict checking, and durable mutation handling, so each role can absorb a different part of the load.

{% mermaid() %}
flowchart TB
    C[Client]
    G[GRV proxy]
    M[Master / sequencer]
    CP[Commit proxy]
    R[Resolvers]
    T[TLogs<br/>replicated, sharded persistent mutation queues]
    C -->|get read version| G
    G -->|batched request| M
    M -->|read version| G
    G -->|read version| C
    C -->|transaction| CP
    CP -->|batched commit-version request| M
    M -->|commit version| CP
    CP -->|conflict ranges| R
    R -->|conflict result| CP
    CP -->|tagged mutations, synchronous push| T
{% end %}

## Every split has a cost

Compartmentalization isn't free. Every isolated responsibility is another running component, another RPC path, another thing that can fail, be upgraded, and be reconfigured, and reconfiguration is a hard enough problem that the same author wrote [**Matchmaker Paxos**](https://mwhittaker.github.io/publications/matchmaker_paxos.html) about it, another paper I like a lot.

The paper is upfront about the price: its 6x speedup used 6.66x the machines, a command now crosses six network delays instead of four, and running more machines shortens the expected time to f failures. The responsibilities can evolve independently, but the number of possible interactions grows quickly. I think this is also why FoundationDB invested so heavily in [deterministic simulation](/posts/diving-into-foundationdb-simulation/): the hard part is exercising interacting roles and failure sequences, including generation recovery in the transaction system, and traditional integration tests make that increasingly difficult.

---

Which responsibilities are coupled together in the system you operate?

---

Feel free to reach out with any questions or to share your experiences with compartmentalization. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

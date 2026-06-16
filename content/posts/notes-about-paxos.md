+++
title = "Notes about Paxos"
description = "Single-decree Paxos and Multi-Paxos, explained as a set of Mermaid diagrams."
date = 2026-06-16
draft = true
[taxonomies]
tags = ["distributed-systems", "consensus", "paxos", "algorithms", "notes"]
+++

## Glossary

Paxos terms used below, with the closest Raft name in the last column for anyone coming from Raft. The diagrams use a Python-like syntax for messages, so `Prepare(ballot=5)` reads as "a Prepare message whose ballot is 5".

| Paxos | What it is | Raft equivalent |
|---|---|---|
| Proposer | Node that proposes a value and drives a round | Leader, candidate |
| Acceptor | Node that votes on rounds and holds the durable state | Follower (voter) |
| Learner | Node that learns the chosen value | No separate role, every node learns the committed log |
| Ballot, proposal id | Monotonic number that orders rounds and leadership | Term |
| New higher ballot, a "bump" | Picking a ballot above every promise to start or retry a round | Incrementing the term to start an election |
| Prepare / Promise (phase 1) | Ask a majority for permission to lead a round | Leader election, RequestVote and the vote |
| AcceptRequest / Accept (phase 2) | Push a value and get a majority to store it | Log replication, AppendEntries and its ack |
| Majority, quorum | Any set of more than half the acceptors | Majority, quorum (same) |
| Chosen | A value a majority has accepted, now permanent | Committed |
| Piggyback | An acceptor returns its accepted value on its promise, forcing the new round to keep it | Election restriction, only an up-to-date log can win |
| Slot, log position | One independent decision in the log | Log index |
| Single-decree Paxos | Agreeing on one value, a single slot | Deciding one log entry |
| Multi-Paxos | One Paxos instance per slot under a stable leader | Raft in normal operation |
| No-op | A do-nothing command used to fill a log gap | No-op entry, committed on a new leader's election |

## The three roles and the ground rules

Paxos defines three roles. **Proposers** propose values to reach consensus on, **acceptors** contribute to reaching the consensus itself, and **learners** learn the agreed value and can be queried for it later. In practice a single node usually wears several hats, often all three at once.

Three ground rules matter for the algorithm below. Every node must know what a **majority** is, because the whole protocol rests on one property, two majorities always overlap in at least one node. Nodes must be **persistent**, so even when the channels are faulty they never forget what they accepted, and the variants that relax this are out of scope here. And one Paxos run only ever reaches a **single** consensus, on one value that never mutates, so to let a value change over time you run a new instance, which is what Multi-Paxos does.

## Single-decree Paxos

A single Paxos run agrees on exactly one value, even when several proposers compete for it.

### The algorithm: the happy path

{% mermaid() %}
sequenceDiagram
    participant P as Proposer
    participant A as Acceptors
    participant L as Learners

    Note over P,L: 3 acceptors, so a majority is 2.
    Note over P,L: The proposer picks a UNIQUE ballot.<br/>Proposer 1 uses 1,3,5..., Proposer 2 uses 2,4,6...<br/>On timeout, it retries with a higher ballot.

    P->>A: Prepare(ballot=5)
    Note over P,L: On Prepare, an acceptor checks: have I already promised a<br/>higher ballot? If yes it ignores, if no it promises to ignore<br/>anything below this ballot.
    A-->>P: Promise(ballot=5)
    Note over P,L: A MAJORITY promised ballot 5, so no lower ballot can ever<br/>pass, because two majorities always overlap.

    P->>A: AcceptRequest(ballot=5, value='cat')
    Note over P,L: On AcceptRequest the acceptor checks the same promise.<br/>If it has not promised a higher ballot, it sends Accept<br/>to the Proposer AND the Learners.
    A-->>P: Accept(ballot=5, value='cat')
    A-->>L: Accept(ballot=5, value='cat')
    Note over P,L: A MAJORITY accepted, so CONSENSUS is on the VALUE 'cat'.<br/>The ballot is a Paxos-internal artifact.

    Note over P,L: Three milestones, always in this order:<br/>1. a majority Promise a ballot, no lower ballot ever passes<br/>2. a majority Accept a ballot and value, consensus on the value<br/>3. a proposer or learner sees a majority of Accept, learns it
{% end %}

### What an acceptor and a proposer actually decide

{% mermaid() %}
flowchart TD
    subgraph Prep["An acceptor receives Prepare(ballot=n)"]
        Q1{"Already promised<br/>a higher ballot?"}
        Q1 -->|yes| Ig1["Ignore"]
        Q1 -->|no| Prom["Promise to ignore<br/>any ballot below n"]
        Prom --> Q2{"Ever accepted<br/>a value?"}
        Q2 -->|no| Pr1["Reply Promise(ballot=n)"]
        Q2 -->|yes| Pr2["Reply Promise(ballot=n,<br/>accepted=(highest ballot, value))"]
    end

    subgraph Acc["An acceptor receives AcceptRequest(ballot=n, value=v)"]
        Q3{"Already promised a ballot<br/>higher than n? (same promise)"}
        Q3 -->|yes| Ig2["Ignore"]
        Q3 -->|no| Ac1["Send Accept(ballot=n, value=v)<br/>to the Proposer and all Learners"]
    end

    subgraph Prop["A proposer gets a majority of Promise(ballot=n)"]
        Q4{"Did any Promise carry<br/>an accepted value?"}
        Q4 -->|no| V1["Free to pick ANY value"]
        Q4 -->|yes| V2["MUST reuse the value with<br/>the highest accepted ballot"]
    end

    Pr1 ~~~ Q3
    Ac1 ~~~ Q4
{% end %}

### A second proposer, and the piggyback

{% mermaid() %}
sequenceDiagram
    participant P2 as Proposer 2
    participant A as Acceptors
    participant L as Learners

    Note over P2,L: Proposer 2 is unaware of the 'cat' consensus<br/>and wants to propose something different.
    P2->>A: Prepare(ballot=4)
    Note over P2,L: A majority already promised ballot 5, so no majority<br/>will promise 4 and Proposer 2 times out.

    P2->>A: Prepare(ballot=6)
    Note over P2,L: The acceptors must promise ballot 6, but they already<br/>accepted (ballot=5, value='cat'), so they piggyback it.
    A-->>P2: Promise(ballot=6, accepted=(ballot=5, value='cat'))
    Note over P2,L: A piggybacked value forces Proposer 2 to reuse the<br/>value with the highest accepted ballot, which is 'cat'.

    P2->>A: AcceptRequest(ballot=6, value='cat')
    A-->>L: Accept(ballot=6, value='cat')
    Note over P2,L: The value stays 'cat', only the ballot moved from 5 to 6.<br/>This is how a proposer or learner catches up on<br/>a consensus it had missed.
{% end %}

### Detailed review: majority of promises

{% mermaid() %}
%%{init: {"sequence": {"actorMargin": 10, "boxMargin": 6, "noteMargin": 6}}}%%
sequenceDiagram
    participant P1 as Proposer 1
    participant A1 as Acceptor 1
    participant A2 as Acceptor 2
    participant A3 as Acceptor 3
    participant P2 as Proposer 2

    P1->>A1: Prepare(ballot=5)
    P1->>A2: Prepare(ballot=5)
    P1->>A3: Prepare(ballot=5)
    P2->>A1: Prepare(ballot=4)
    P2->>A2: Prepare(ballot=4)
    P2->>A3: Prepare(ballot=4)
    Note over A1,A3: Can arrive in a different<br/>order (latency).

    A1-->>P1: Promise(ballot=5)
    A1-->>P2: ignore(ballot=4)
    A2-->>P1: Promise(ballot=5)
    A2-->>P2: ignore(ballot=4)
    A3-->>P2: Promise(ballot=4)
    Note over P1,A1: Majority promised ballot 5.
    Note over A3,P2: One stray Promise(ballot=4).

    Note over P1,P2: Once a majority promise to ignore anything below a ballot,<br/>no lower ballot can make it through, so the ballot-4 request<br/>is never accepted.
{% end %}

### Detailed review: contention

{% mermaid() %}
sequenceDiagram
    participant P1 as Proposer 1
    participant P2 as Proposer 2
    participant A as Acceptors

    P1->>A: Prepare(ballot=5)
    A-->>P1: Promise(ballot=5)
    P2->>A: Prepare(ballot=6)
    A-->>P2: Promise(ballot=6)
    Note over P1,A: ballot 6 > 5, so a majority now ignores ballot 5.
    P1->>A: AcceptRequest(ballot=5, value='cat')
    A-->>P1: ignore (already promised ballot 6)
    P1->>A: Prepare(ballot=7)
    A-->>P1: Promise(ballot=7)
    Note over P1,A: ballot 7 > 6, so a majority now ignores ballot 6.
    P2->>A: AcceptRequest(ballot=6, value='dog')
    A-->>P2: ignore (already promised ballot 7)
    P2->>A: Prepare(ballot=8)
    A-->>P2: Promise(ballot=8)

    Note over P1,A: Each higher Prepare preempts the other's AcceptRequest,<br/>so nothing ever commits. Several proposals on the same<br/>Paxos run cause HOT SPOTS that yield contention.
    Note over P1,A: Fix: EXPONENTIAL BACKOFF, so one proposer waits long enough<br/>for the other to finish its AcceptRequest and reach consensus.
{% end %}

### Detailed review: majority of accepts

{% mermaid() %}
%%{init: {"sequence": {"actorMargin": 12, "boxMargin": 6, "noteMargin": 6}}}%%
sequenceDiagram
    participant P1 as Proposer 1
    participant P2 as Proposer 2
    participant A as Acceptors
    participant L as Learners

    P1->>A: Prepare(ballot=5)
    A-->>P1: Promise(ballot=5)
    P1->>A: AcceptRequest(ballot=5, value='cat')
    A-->>P1: Accept(ballot=5, value='cat')
    A-->>L: Accept(ballot=5, value='cat')
    Note over P1,L: A majority accepted (ballot=5, value='cat'),<br/>so CONSENSUS is reached and the value is 'cat'.

    P2->>A: Prepare(ballot=6)
    A-->>P2: Promise(ballot=6, accepted=(5, 'cat'))
    P2->>A: AcceptRequest(ballot=6, value='cat')

    Note over P1,L: No accept with a LOWER ballot can win: it would need a majority of<br/>promises for the lower ballot, but the higher one already holds them.
    Note over P1,L: No accept with a HIGHER ballot can change the value: at least one<br/>acceptor piggybacks the accepted ballot and value, which propagates.
    Note over P1,L: This is how a proposer or learner LEARNS a consensus it missed:<br/>propose, get the value piggybacked, and re-propose it.
{% end %}

## Multi-Paxos

Single-decree Paxos agrees on one value that never changes, which is rarely what a real system wants. **Multi-Paxos** turns that one decision into a sequence of decisions. You keep a **replicated log** and run one independent single-decree Paxos instance per slot, so the value chosen for slot i is the i-th command, and every deposit or withdrawal on a bank account becomes a new consensus on the next slot.

{% mermaid() %}
flowchart TD
    Idea["MULTI-PAXOS: one independent single-decree Paxos run per slot.<br/>The value chosen for slot i is the i-th command."]
    Idea --> Log

    subgraph Log["The replicated log for one bank account"]
        direction TB
        S0["slot 0: $100 (account opened)"]
        S1["slot 1: +$50 = $150"]
        S2["slot 2: -$20 = $130"]
        S3["slot 3: -$30 = $100"]
        S0 --> S1 --> S2 --> S3
    end

    Log --> Leader["Leader optimization, the usual deployment:<br/>elect ONE stable leader as the distinguished proposer for ALL slots.<br/>It runs phase 1 once for every future slot, so the steady-state cost is phase 2 only.<br/>Gaps left by a crashed leader are filled with a no-op so the log can move on."]
{% end %}

The ballot only ever bumps at a **leader change**, never per command and never per slot. A new command just takes the next slot. A new leader bumps the ballot once and runs phase 1 once for the whole tail of the log, which recovers every slot at the same time.

{% mermaid() %}
%%{init: {"sequence": {"actorMargin": 14, "boxMargin": 6, "noteMargin": 6}}}%%
sequenceDiagram
    participant L1 as Leader L1
    participant A as Acceptors
    participant L2 as Leader L2

    Note over L1,L2: STEADY STATE: L1 already won phase 1 for ballot 1,<br/>so new commands skip phase 1 and do phase 2 only.
    L1->>A: AcceptRequest(ballot=1, slot=4, value=cmd4)
    A-->>L1: Accept(ballot=1, slot=4, value=cmd4)
    Note over L1,L2: L1 crashes after slot 5 was accepted by only one acceptor.

    Note over L1,L2: LEADER CHANGE: L2 BUMPS to ballot 2 and runs phase 1<br/>ONCE for every slot from its frontier upward.
    L2->>A: Prepare(ballot=2, from_slot=4)
    Note over L1,L2: Acceptors adopt ballot 2 and piggyback every<br/>(slot, value) they have already accepted.
    A-->>L2: Promise(ballot=2, accepted=[(4, cmd4), (5, cmd5)])

    Note over L1,L2: Per slot, the single-decree rule: reuse the value with the<br/>highest accepted ballot, and fill real gaps with a no-op.
    L2->>A: AcceptRequest(ballot=2, slot=4, value=cmd4)
    L2->>A: AcceptRequest(ballot=2, slot=5, value=cmd5)
    A-->>L2: Accept(ballot=2, slots 4 and 5)

    Note over L1,L2: Recovered. L2 is the stable leader on ballot 2 and drops<br/>back to STEADY STATE for new slots 6, 7, ...
    L2->>A: AcceptRequest(ballot=2, slot=6, value=cmd6)
{% end %}

---

Feel free to reach out with any questions or to share your experiences with Paxos and consensus. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

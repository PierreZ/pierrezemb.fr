+++
title = "Notes about Raft's paper"
description = "List of ressources gleaned about Raft"
date = "2020-07-30T07:24:27+01:00"
[taxonomies]
tags= ["distributed", "consensus", "raft", "algorithms", "notes"]
+++

![raft_image](/images/notes-about-raft/raft.png)

[Notes About](/tags/notes/) is a blogpost serie  you will find a lot of **links, videos, quotes, podcasts to click on** about a specific topic. Today we will discover Raft's paper called 'In Search of an Understandable Consensus Algorithm'.

---

As I'm digging into ETCD, I needed to refresh my memory about Raft. I started by reading the paper located [here](https://raft.github.io/raft.pdf) and I'm also playing with the amazing [Raft labs made by PingCAP](https://github.com/pingcap/talent-plan/tree/master/courses/dss/raft).

> These labs are derived from the [lab2:raft][6824lab2] and [lab3:kvraft][6824lab3] from the famous [MIT 6.824][6824] course but rewritten in Rust.

[6824lab2]:http://nil.csail.mit.edu/6.824/2018/labs/lab-raft.html
[6824lab3]:http://nil.csail.mit.edu/6.824/2018/labs/lab-kvraft.html
[6824]:http://nil.csail.mit.edu/6.824/2018/index.html

## Abstract

> Raft is a consensus algorithm for managing a replicated log. It produces a result equivalent to (multi-)Paxos, andit is as efficient as Paxos, but its structure is differentfrom Paxos; this makes Raft more understandable thanPaxos and also provides a better foundation for build-ing practical systems.

> Raft separates the key elements of consensus, such asleader election, log replication, and safety, and it enforcesa stronger degree of coherency to reduce the number ofstates that must be considered.

## Introduction

> Consensus algorithms allow a collection of machines to work as a coherent group that can survive the failures of some of its members.

> Paxos has dominated the discussion of consensus algorithms over the last decade.

> Unfortunately, Paxos is quite difficult to understand, inspite of numerous attempts to make it more approachable.Furthermore, its architecture requires complex changes to support practical systems. As a result, both systembuilders and students struggle with Paxos.

> Our approach was unusual in that our primary goal was **understandability**.

> We believe that Raft is superior to Paxos and other consensus algorithms, both for educational purposes and as a foundation for implementation.

## Replicated state machines

The main idea is to compute identical copies of the same state (i.e `x:3, y:9`) in case of machines's failure. Most of the time, an ordered `wal` (write-ahead log) is used in the implementation, to hold the mutation (`x:4`). Keeping the replicated log consistent is the job of the consensus algorithm, here Raft.

Raft creates a true split between:

* the consensus module,
* the wal,
* the state machine.

<img src="/images/notes-about-raft/fig_1.png" alt="fig1" class="center">

## What’s wrong with Paxos?

The paper is listing the drawbacks of Paxos:

* difficult to understand, and [I can't blame them](https://www.microsoft.com/en-us/research/uploads/prod/2016/12/The-Part-Time-Parliament.pdf)
* many details are missing from the paper to implement `Multi-Paxos` as the paper is mainly describing `single-decree Paxos`

> It is simpler and more efficient to design a system around a log, where new entries are appended sequentially in a constrained order.

> As a result, practical systems bear little resemblance to Paxos. Each implementation begins with Paxos, discovers the difficulties in implementing it, and then develops a significantly different architecture. This is time-consuming and error-prone, and the difficulties of understanding Paxos exacerbate the problem. The following com-ment from the [Chubby](https://static.googleusercontent.com/media/research.google.com/en//archive/chubby-osdi06.pdf) implementers is typical:

> > There are significant gaps between the description of the Paxos algorithm and the needs of a real-world system
> > the final system will be based on an un-proven protocol [4].

## Designing for understandability

Beside all the others goals of Raft:

* a complete and practical foundation for system building,
* must be safe under all conditions and available under typical operating conditions,
* must be efficient for common operations,

**understandability** was the most difficult challenge:

> It must be possible for a large audience to understand the algorithm comfortably. In addition, it must be possible to develop intuitions about the algorithm, so that system builders can make the extensions that are inevitable in real-world implementations.

> we divided problems into separate pieces that could be solved, explained, and understood relatively independently. For example, in Raft we separated leader election, log replication, safety, and membership changes.

> Our second approach was to simplify the state spaceby reducing the number of states to consider, making thesystem more coherent and eliminating nondeterminism where possible.

## The Raft consensus algorithm

Raft is heavily relying on the `leader` pattern:

> Raft implements consensus by first electing a distinguished leader, then giving the leader complete responsibility for managing the replicated log.

> The leader accepts log entries from clients, replicates them on other servers, and tells servers when it is safe to apply log entries to their state machines.

Thanks to this pattern, Raft is splitting the consensus problem into 3:

* Leader election
* Log replication
* Safety

### Raft basics

Each server can be in one of the three states:

* **Leader** handle all requests,
* **Follower** passive member, they issue no requests on their own but simply respond to requests from leaders and candidates,
* **Candidate** is used to elect a new leader.

Leader is elected through `election`: Each term (interval of time of arbitrary length packed with an number) begins with an election, in which one or more candidates attempt to become leader. If a candidate wins the election, then it serves as leader for the rest of the term. In the case of a split vote, the term will end with no leader; a new term (with a new election) will begin.

> Terms act as a logical clock [14] in Raft.

> Each server stores a current term number, which increases monotonically over time. Current terms are exchanged whenever servers communicate; if one server’s current term is smaller than the other’s, then it updates its current term to the larger value. If a candidate or leader discovers that its term is out of date, it immediately reverts to fol-lower state. If a server receives a request with a stale term number, it rejects the request.

`RPC` is used for communications:

* **RequestVote RPCs** are initiated by candidates during elections,
* **Append-Entries RPCs** are initiated by leaders to replicate log en-tries and to provide a form of heartbeat.

### Leader election

A good vizualization is available [here](http://thesecretlivesofdata.com/raft/#election).

The key-point of the election are the fact that:

* nodes vote for themselves,
* the term number is used to recover from failure,
* election timeouts are randomized.

> To begin an election, a follower increments its current term and transitions to candidate state. It then votes for itself and issues RequestVote RPCs in parallel to each of the other servers in the cluster. A candidate continues in this state until one of three things happens:
>
> * (a) it wins the election,
> * (b) another server establishes itself as leader,
> * (c) a period of time goes by with no winner.

> Raft uses randomized election timeouts to ensure that split votes are rare and that they are resolved quickly. To prevent split votes in the first place, election timeouts are chosen randomly from a fixed interval (e.g., 150–300ms).

### Log replication

A good vizualization is available [here](http://thesecretlivesofdata.com/raft/#replication).

> Once a leader has been elected, it begins servicing client requests. Each client request contains a command to be executed by the replicated state machines. The leader appends the command to its log as a new entry, then issues AppendEntries RPCs in parallel to each of the other servers to replicate the entry. When the entry has been safely replicated (as described below), the leader applies the entry to its state machine and returns the result of that execution to the client.

> The term numbers in log entries are used to detect inconsistencies between logs

> The leader decides when it is safe to apply a log entry to the state machines; such an entry is called committed. Raft guarantees that committed entries are durable and will eventually be executed by all of the available state machines.

Raft is implementing a lot of safety inside the log:

> When sending an AppendEntries RPC, the leader includes the index and term of the entry in its log that immediately precedes the new entries. If the follower does not find an entry in its log with the same index and term, then it refuses the new entries

This is really interesting to be leader-failure proof. And for follower's failure:

> In Raft, the leader handles inconsistencies by forcing the followers’ logs to duplicate its own.

> To bring a follower’s log into consistency with its own,the leader must find the latest log entry where the two logs agree, delete any entries in the follower’s log after that point, and send the follower all of the leader’s entries after that point.

## Safety

### Leader election

As Raft guarantees that all the committed entries are available on all followers, log entries only flow in one di-rection, from leaders to followers, and leaders never over-write existing entries in their logs.

> Raft uses the voting process to prevent a candidate from winning an election unless its log contains all committed entries. A candidate must contact a majority of the cluster in order to be elected, which means that every committed entry must be present in at least one of those servers.

> Raft determines which of two logs is more up-to-date by comparing the index and term of the last entries in the logs. If the logs have last entries with different terms, then the log with the later term is more up-to-date. If the log send with the same term, then whichever log is longer is more up-to-date.

### Committing entries from previous terms

> Raft never commits log entries from previous terms by counting replicas. Only log entries from the leader’s current term are committed by counting replicas.

This behavior avoids future leaders to attempt to finish replicating an entry where the leader crashes before committing an entry.

### Follower and candidate crashes

> If a follower or candidate crashes, then future RequestVote and AppendEntries RPCs sent to it will fail. Raft handles these failures by retrying indefinitely.

## Cluster membership changes

This section presents how to do cluster configuration(the set of servers participating in the consensus algorithm). Raft implements a two-phase approach:

> In Raft the cluster first switches to a transitional configuration we call joint consensus; once the joint consensus has been committed,the system then transitions to the new configuration. The joint consensus combines both the old and new configurations:
>
> * Log entries are replicated to all servers in both con-figurations,
> * Any server from either configuration may serve asleader,
> * Agreement (for elections and entry commitment) requires separate majorities from both the old and new configurations.

## Log compaction

As the WAL holds the commands, we need to compact it. Raft is using snapshots as describe here:

<img src="/images/notes-about-raft/fig_3.png" alt="fig3" class="center">

> the leader must occasionally send snapshots to followers that lag behind.

This is useful for slow follower or a new server joining the cluster.

> The leader uses a new RPC called InstallSnapshot to send snapshots to followers that are too far behind.

## Client interaction

> Clients of Raft send all of their requests to the leader. When a client first starts up, it connects to a randomly-chosen server. If the client’s first choice is not the leader,that server will reject the client’s request and supply information about the most recent leader it has heard from.

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.

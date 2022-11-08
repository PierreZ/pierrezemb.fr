---
title: "Notes about ETCD"
description: "List of ressources gleaned about ETCD"
images:
  - /posts/notes-about-etcd/images/etcd.png
date: 2021-01-11T00:24:27+01:00
draft: false
 
showpagemeta: true
toc: true
categories:
 - etcd
 - notesabout
---

![etcd image](/posts/notes-about-etcd/images/etcd.png)

[Notes About](/tags/notesabout/) is a blogpost serie  you will find a lot of **links, videos, quotes, podcasts to click on** about a specific topic. Today we will discover ETCD.

## Overview of ETCD

As stated in the [official documentation](https://etcd.io/):

> etcd is a strongly consistent, distributed key-value store that provides a reliable way to store data that needs to be accessed by a distributed system or cluster of machines. It gracefully handles leader elections during network partitions and can tolerate machine failure, even in the leader node.


## History

ETCD was initially developed by CoreOS:

> CoreOS built etcd to solve the problem of shared configuration and service discovery.

* July 23, 2013 - announcement
* December 27, 2013 - etcd 0.2.0 - new API, new modules and tons of improvements
* February 07, 2014 - etcd 0.3.0 - Improved Cluster Discovery, API Enhancements and Windows Support 
* January 28, 2015 - etcd 2.0 - First Major Stable Release 
* June 30, 2016 - etcd3 - A New Version of etcd from CoreOS
* June 09, 2017 - etcd 3.2 - etcd 3.2 now with massive watch scaling and easy locks
* February 01, 2018 - etcd 3.3 - Announcing etcd 3.3, with improvements to stability, performance, and more
* August 30, 2019 - etcd 3.4 - Better Storage Backend, concurrent Read, Improved Raft Voting Process, Raft Learner Member

## Overall architecture

> The etcd key-value store is a distributed system intended for use as a coordination primitive. Like Zookeeper and Consul, etcd stores a small volume of infrequently-updated state (by default, up to 8 GB) in a key-value map, and offers strict-serializable reads, writes and micro-transactions across the entire datastore, plus coordination primitives like locks, watches, and leader election. Many distributed systems, such as Kubernetes and OpenStack, use etcd to store cluster metadata, to coordinate consistent views over data, to choose leaders, and so on.

ETCD is:

* using [the raft consensus algorithm](/posts/notes-about-raft/),
* a single group raft,
* using [gRPC](https://grpc.io/) for communication,
* using a self-made WAL implementation,
* storing key-values into bbolt,
* optimized for consistency over latency in normal situations and consistency over availability in the case of a partition ([in terms of the PACELC theorem](https://en.wikipedia.org/wiki/PACELC_theorem)).

### Consensus? Raft?

* Raft is a consensus algorithm for managing a replicated log.
* consensus involves multiple servers agreeing on values.
* two common consensus algorithm are Paxos and Raft
> , Paxos is quite difficult to understand, inspite of numerous attempts to make it more approachable.Furthermore, its architecture requires complex changes to support practical systems. As a result, both system builders and students struggle with Paxos.
* A common alternative to Paxos/Raft is a non-consensus (aka peer-to-peer) replication protocol.
> Raft separates the key elements of consensus, such asleader election, log replication, and safety

ETCD contains several raft optimizations:
* Read Index,
* Follower reads,
* Transfer leader,
* Learner role,
* Client-side load-balancing.

### Exposed API

ETCD is exposing several APIs through different gRPC services:

* Put(key, value),
* Delete(key, Optional(keyRangeEnd)),
* Get(key, Optional(keyRangeEnd)),
* Watch(key, Optional(keyRangeEnd)),
* Transaction(if/then/else ops),
* Compact(revision),
* Lease:
  * Grant,
  * Revoke,
  * KeepAlive
  
Key and values are bytes-oriented but ordered.

### Transactions

```proto
// From google paxosdb paper:
// Our implementation hinges around a powerful primitive which we call MultiOp. All other database
// operations except for iteration are implemented as a single call to MultiOp. A MultiOp is applied atomically
// and consists of three components:
// 1. A list of tests called guard. Each test in guard checks a single entry in the database. It may check
// for the absence or presence of a value, or compare with a given value. Two different tests in the guard
// may apply to the same or different entries in the database. All tests in the guard are applied and
// MultiOp returns the results. If all tests are true, MultiOp executes t op (see item 2 below), otherwise
// it executes f op (see item 3 below).
// 2. A list of database operations called t op. Each operation in the list is either an insert, delete, or
// lookup operation, and applies to a single database entry. Two different operations in the list may apply
// to the same or different entries in the database. These operations are executed
// if guard evaluates to
// true.
// 3. A list of database operations called f op. Like t op, but executed if guard evaluates to false.
message TxnRequest {
  // compare is a list of predicates representing a conjunction of terms.
  // If the comparisons succeed, then the success requests will be processed in order,
  // and the response will contain their respective responses in order.
  // If the comparisons fail, then the failure requests will be processed in order,
  // and the response will contain their respective responses in order.
  repeated Compare compare = 1;
  // success is a list of requests which will be applied when compare evaluates to true.
  repeated RequestOp success = 2;
  // failure is a list of requests which will be applied when compare evaluates to false.
  repeated RequestOp failure = 3;
}
```
  
### Versioned data

Each Key/Value has a revision. When creating a new key, revision starts at 1, and then will be incremented each time the key is updated. 

In order to avoid having a growing keySpace, one can issue the `Compact` gRPC service:

> Compacting the keyspace history drops all information about keys superseded prior to a given keyspace revision

### Lease

```proto
// this message represent a Lease
message Lease {
  // TTL is the advisory time-to-live in seconds. Expired lease will return -1.
  int64 TTL = 1;
  // ID is the requested ID for the lease. If ID is set to 0, the lessor chooses an ID.
  int64 ID = 2;

  int64 insert_timestamp = 3;
}
```

### Watches

```proto
message Watch {
  // key is the key to register for watching.
  bytes key = 1;

  // range_end is the end of the range [key, range_end) to watch. If range_end is not given,
  // only the key argument is watched. If range_end is equal to '\0', all keys greater than
  // or equal to the key argument are watched.
  // If the range_end is one bit larger than the given key,
  // then all keys with the prefix (the given key) will be watched.
  bytes range_end = 2;

  // If watch_id is provided and non-zero, it will be assigned to this watcher.
  // Since creating a watcher in etcd is not a synchronous operation,
  // this can be used ensure that ordering is correct when creating multiple
  // watchers on the same stream. Creating a watcher with an ID already in
  // use on the stream will cause an error to be returned.
  int64 watch_id = 7;
}
```

### Linearizable reads

Section 8 of the raft paper explains the issue:

> Read-only operations can be handled without writing anything into the log. However, with no additional measures, this would run the risk of returning stale data, since the leader responding to the request might have been superseded by a newer leader of which it is unaware. Linearizable reads must not return stale data, and Raft needs two extra precautions to guarantee this without using the log. First, a leader must have the latest information on which entries are committed. The Leader Completeness Property guarantees that a leader has all committed entries, but at the start of its term, it may not know which those are. To find out, it needs to commit an entry from its term. Raft handles this by having each leader commit a blank no-op entry into the log at the start of its term. Second,a leader must check whether it has been deposed before processing a read-only request (its information may be stale if a more recent leader has been elected). Raft handles this by having the leader exchange heartbeat messages with a majority of the cluster before responding to read-only requests.

ETCD implements `ReadIndex` read(more info on [Diving into ETCD’s linearizable reads](/posts/diving-into-etcd-linearizable/)).

### How ETCD is using bbolt

[bbolt](https://github.com/etcd-io/bbolt) is the underlying kv used in etcd. [A bucket called `key` is used to store data, and the key is the revision](https://github.com/etcd-io/etcd/blob/v3.4.14/mvcc/kvstore_txn.go#L214). Then, to find keys, [a B-Tree is used](https://github.com/etcd-io/etcd/blob/v3.4.14/mvcc/index.go#L68).

> * Bolt allows only one read-write transaction at a time but allows as many read-only transactions as you want at a time.
> * Each transaction has a consistent view of the data as it existed when the transaction started.
> * Bolt uses a B+tree internally and only a single file. Both approaches have trade-offs.
> * If you require a high random write throughput (>10,000 w/sec) or you need to use spinning disks then LevelDB could be a good choice. If your application is read-heavy or does a lot of range scans then Bolt could be a good choice.
> * Try to avoid long running read transactions. Bolt uses copy-on-write so old pages cannot be reclaimed while an old transaction is using them.
> * Bolt uses a memory-mapped file so the underlying operating system handles the caching of the data. Typically, the OS will cache as much of the file as it can in memory and will release memory as needed to other processes. This means that Bolt can show very high memory usage when working with large databases. 
> * Etcd implements multi-version-concurrency-control (MVCC) on top of Boltdb

[From an Github issue](https://github.com/etcd-io/etcd/issues/12169#issuecomment-673292122):

> Note that the underlying `bbolt` mmap its file in memory. For better performance, usually it is a good idea to ensure the physical memory available to etcd is larger than its data size.



## ETCD in K8S

{{<tweet user="bgrant0607" id="1118273986956120064" >}}

[The interface can be found here](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apiserver/pkg/storage/interfaces.go#L159).

* Create use TTL and Txn 
* Get use KV.Get
* Delete use Get and then for with a Txn
* GuaranteedUpdate uses Txn
* List uses Get
* Watch uses Watch with a channel


## Jepsen

The Jepsen team tested [etcd-3.4.3](https://jepsen.io/analyses/etcd-3.4.3), here's some quotes:

> In our tests, etcd 3.4.3 lived up to its claims for key-value operations: we observed nothing but strict-serializable consistency for reads, writes, and even multi-key transactions, during process pauses, crashes, clock skew, network partitions, and membership changes.

> Watches appear correct, at least over single keys. So long as compaction does not destroy historical data while a watch isn’t running, watches appear to deliver every update to a key in order.

> However, etcd locks (like all distributed locks) do not provide mutual exclusion. Multiple processes can hold an etcd lock concurrently, even in healthy clusters with perfectly synchronized clocks.

> If you use etcd locks, consider whether those locks are used to ensure safety, or simply to improve performance by probabilistically limiting concurrency. It’s fine to use etcd locks for performance, but using them for safety might be risky.


## Operation notes

### Deployements tips

[From the official documentation](https://etcd.io/docs/v3.4.0/faq/):

> Since etcd writes data to disk, SSD is highly recommended. 
> To prevent performance degradation or unintentionally overloading the key-value store, etcd enforces a configurable storage size quota set to 2GB by default.
> To avoid swapping or running out of memory, the machine should have at least as much RAM to cover the quota.
> 8GB is a suggested maximum size for normal environments and etcd warns at startup if the configured value exceeds it. 

### Defrag

> After compacting the keyspace, the backend database may exhibit internal fragmentation. 
> Defragmentation is issued on a per-member so that cluster-wide latency spikes may be avoided.

Defrag is basically [dumping the bbolt tree on disk and reopening it](https://github.com/etcd-io/etcd/blob/2b79442d8e9fc54b1ac27e7e230ac0e4c132a054/mvcc/backend/backend.go#L349).

### Snapshot

An ETCD snapshot is related to Raft's snapshot:

> Snapshotting is the simplest approach to compaction. In snapshotting, the entire current system state is written to a snapshot on stable storage, then the entire log up to that point is discarded

Snapshot can be saved using `etcdctl`:

```bash
etcdctl snapshot save backup.db
```

### Lease

Be careful on Leader's change and lease, this can [create some issues](https://github.com/kubernetes/kubernetes/issues/65497):

> The new leader extends timeouts automatically for all leases. This mechanism ensures no lease expires due to server side unavailability.

### War stories

* [An analysis of the Cloudflare API availability incident on 2020-11-02](https://blog.cloudflare.com/a-byzantine-failure-in-the-real-world/)
* [How a production outage in Grafana Cloud's Hosted Prometheus service was caused by a bad etcd client setup](https://grafana.com/blog/2020/04/07/how-a-production-outage-in-grafana-clouds-hosted-prometheus-service-was-caused-by-a-bad-etcd-client-setup/)
* [Random performance issue on etcd 3.4](https://github.com/etcd-io/etcd/issues/11884)
* [Impact of etcd deployment on Kubernetes, Istio, and application performance](https://arxiv.org/pdf/2004.00372.pdf)



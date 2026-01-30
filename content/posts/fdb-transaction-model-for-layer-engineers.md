+++
title = "FoundationDB's Transaction Model for Layer Engineers"
description = "How optimistic concurrency control works in FoundationDB, and how to design data structures that stop fighting it"
date = 2026-01-27
[taxonomies]
tags = ["foundationdb", "distributed-systems", "database", "transactions"]
+++

FoundationDB gives you serializable transactions with external consistency, automatic sharding, and fault tolerance. That's a strong foundation for building layers. But once your first layer hits production under real load, you start seeing transaction conflicts you don't understand. The logic looks correct: read a key, check a condition, write the result. Under load, conflicts pile up and throughput collapses.

## How OCC Works

FoundationDB implements these guarantees using **Optimistic Concurrency Control** (OCC). Your transaction runs without holding any locks. It reads from a consistent snapshot, does its work, and at commit time the system checks whether anything you read was modified by another transaction since you started. If yes, your transaction is aborted and retried. If no, it commits atomically.

All writes are buffered locally in the client until commit. Nothing goes to the cluster while your transaction is running. At commit time, the client sends the buffered writes and the read/write conflict sets to the Resolver in a single request. A read-only transaction that calls commit is mostly a no-op: the network thread checks there are no writes to send and skips the round-trip.

No locks means no waiting, but it also means **your reads determine whether YOU can conflict, and your writes determine what OTHER transactions will conflict with**. A read-only transaction never conflicts. It observes a snapshot and goes away. A write-only transaction also never conflicts. It blindly sets keys and commits. Only transactions that both read and write can fail. When they do, your writes don't cause your conflicts. Your reads do. The writes cause problems for future transactions, but your transaction was doomed the moment you issued reads on keys that someone else was modifying. Every time you add a read to a transaction, ask yourself: **do I actually need to conflict on this?**

## Read Version, Commit Version, and the Window of Vulnerability

When your transaction starts, it obtains a **read version** from the cluster. All your reads see a consistent snapshot frozen at that version. When you commit, your transaction gets a **commit version**, guaranteed to be higher. Between these two versions lies what I call **the Window of Vulnerability**: any key you read that was modified by another committed transaction within this window will cause your transaction to abort.

```
read version                                          commit version
     │                                                      │
     ▼                                                      ▼
─────┼──────────────────────────────────────────────────────┼────── time
     │              Window of Vulnerability                 │
     │◄────────────────────────────────────────────────────►│
     │                                                      │
     │   your reads see          other transactions         │
     │   a frozen snapshot       may commit writes here     │
```

The longer your transaction runs, the wider this window grows. FoundationDB enforces a strict **5-second transaction limit**, which is exactly **5 million versions** (`MAX_WRITE_TRANSACTION_LIFE_VERSIONS = 5 * VERSIONS_PER_SECOND`). The Resolver tracks conflict history in memory up to this age; transactions older than `currentVersion - 5,000,000` are rejected as "transaction too old."

A transaction that completes in 50 milliseconds has almost no exposure. A transaction that takes 4.5 seconds is exposed to every concurrent write on every key it read.

This is why long transactions are one of the most common sources of production trouble. More work means more time, wider window, more conflicts. The fix is parallelizing your reads so the transaction completes faster, splitting work into smaller transactions when full atomicity isn't required, or using [continuations](/posts/understanding-fdb-record-layer-continuations/) to checkpoint progress across transaction boundaries.

## How Conflicts Actually Work

Every read your transaction performs adds a **read-conflict range** to your transaction. Every write adds a **write-conflict range**. At commit time, the Resolver checks: does your read-conflict set intersect any committed write-conflict set since your read version? If yes, your transaction is aborted. The Resolver uses a version-aware skiplist to make this check efficient, pruning entire subtrees of committed writes that predate your read version.

```
 Your Transaction                Resolver               Another Transaction
┌─────────────────┐                                    ┌─────────────────┐
│ get(key_A)      │─► read conflict: {key_A}           │                 │
│ get_range(B, D) │─► read conflict: {B..D}            │ set(key_C)      │─► write conflict: {key_C}
│ set(key_X)      │─► write conflict: {key_X}          │                 │
└─────────────────┘                                    └─────────────────┘
                              │
                     at commit time:
                     read conflicts ∩ write conflicts
                     from txns committed since read version?
                              │
                     key_C ∈ {B..D}? → YES → ABORT
```

`get` and `get_range` create read conflicts. `set`, `clear`, and `clear_range` create write conflicts.

The simplest conflict pattern is the **hot key**: a single key read and written by many concurrent transactions. A naive global counter, a "last updated" timestamp, a configuration value everyone checks. The read-modify-write creates a read conflict, and under concurrent updates, all but one transaction fails. The following sections cover three escape hatches: phantom conflicts and how to avoid them with snapshot reads, atomic operations that write without reading, and versionstamps that generate unique IDs without coordination.

## The Phantom Conflict Problem

When you call `get(key)`, FDB adds that single key to your read conflict set. Straightforward. But when you call `get_range(start, end)`, FDB adds **the entire range** to your conflict set, not just the keys that happened to exist, not just the keys your code iterated over. The mathematical range from start to end, including every possible key that could exist within it. The SIGMOD 2021 paper calls this **phantom read prevention**: "The read set is checked against the modified key ranges of concurrent committed transactions, which prevents phantom reads." **You can conflict on keys you never saw.**

```
Your range read: get_range("order/user1/", "order/user1/\xff")

Keyspace:
  order/user1/001  ◄── exists, returned
  order/user1/002  ◄── exists, returned
  order/user1/003  ◄── exists, returned
  order/user1/004  ◄── DOES NOT EXIST YET
  ···

Read conflict range: [ "order/user1/" , "order/user1/\xff" )
                       ◄──────── covers EVERYTHING ────────►

Another transaction: set("order/user1/004", ...)
  → write conflict on "order/user1/004"
  → inside your read conflict range
  → YOUR transaction aborts (you never saw this key)
```

Imagine you're scanning a user's orders to check if they have any pending shipments. Your range read returns 3 orders. You check each one, they're all shipped, great. You decide to update a status flag. Meanwhile, another transaction inserts a brand new order for that same user. The key for that new order falls within your scanned range. Your transaction conflicts and aborts, even though you never touched that key, never saw it, and your business logic doesn't care about it at all. Full table scans are the extreme version of this problem: the wider your range, the more phantom writes can abort you. The fix requires either narrowing your reads to touch less keyspace, or using snapshot reads with selective conflicts.

## Snapshot Reads

A snapshot read returns the same data as a regular read from the same consistent snapshot, but it does not add any read conflicts to your transaction. The operation is `tr.snapshot().get(key)` or `tr.snapshot().get_range(start, end)`. The data you get back is identical. The only difference is what happens at commit time: the Resolver won't check whether those keys changed.

FDB also exposes **manual conflict APIs** that complement snapshot reads. `add_read_conflict_key` and `add_read_conflict_range` let you inject read conflicts explicitly: you read without conflicts, then selectively add conflicts on exactly the keys you care about. On the write side, `add_write_conflict_key` and `add_write_conflict_range` let you inject write conflicts without actually writing data. This is useful for implementing locks or coordination primitives where your transaction claims a key to block others without storing anything there.

When would you want this? Whenever you need to read data for your logic but don't need the transaction to abort if that data changes concurrently. A common case is reading configuration or metadata that rarely changes and where a slightly stale value is acceptable within the transaction's own snapshot.

The trade-off is that you're accepting your decision might be based on data that changed concurrently. This is safe for read-mostly metadata or filtering logic. It's dangerous for business-critical checks like balance verification or uniqueness constraints. If your code path is "read X, decide based on X, write Y", and the decision must hold at commit time, you need the read conflict.

The real power of snapshot reads comes from combining them with manual conflict APIs. Go back to the phantom conflict problem: you need to scan a user's orders to check for pending shipments, but you don't want inserts of new orders to abort your transaction. With a regular `get_range`, any write within that range kills you. With a snapshot range read, you get the data without the conflict surface:

```
// Regular range read: conflicts on the entire range
orders = tr.get_range("order/user1/", "order/user1/\xff")

// Snapshot range read: same data, no read conflicts added
orders = tr.snapshot().get_range("order/user1/", "order/user1/\xff")

// Add conflicts only on the specific keys you care about
for order in orders:
    if order.status == "pending":
        tr.add_read_conflict_key(order.key)
```

The snapshot read gives you all the data. The manual `add_read_conflict_key` calls protect only the keys your logic actually depends on. If another transaction inserts a new order, your transaction doesn't care. If another transaction modifies a pending order you're acting on, your transaction correctly conflicts. You went from conflicting on the entire keyspace range to conflicting on exactly the keys that matter.

## Atomic Operations: Writing Without Reading

When you need to increment a counter, the obvious approach is to read the current value, add one, and write the result back. This creates a read conflict on that key, and under concurrent updates, transactions start failing because they all race to write their incremented value. **Atomic operations** take a different approach: they send an instruction to the storage server ("add this delta to whatever value is there") without your transaction ever knowing the current value. No read, no read conflict.

```
// Read-modify-write: creates read conflict, will fail under contention
value = tr.get(counter_key)
tr.set(counter_key, value + 1)

// Atomic: no read conflict, concurrent updates all succeed
tr.atomic_add(counter_key, 1)
```

The [Record Layer](https://foundationdb.github.io/fdb-record-layer/) exploits this for aggregate indexes. A `COUNT` index issues `atomic_add(count_key, 1)` on every record insertion and `atomic_add(count_key, -1)` on deletion. A `SUM` index adds the field's value. `MAX_EVER` and `MIN_EVER` use `atomic_max` and `atomic_min`. Unlimited concurrent updates to the same aggregate, zero conflicts between writers.

But there's a trap: if you read a key and also atomically modify it in the same transaction, you lose all the benefits. The FoundationDB documentation is explicit: "If a transaction uses both an atomic operation and a strictly serializable read on the same key, the benefits of using the atomic operation (for both conflict checking and performance) are lost." The read already poisoned the transaction. The pattern only works when you genuinely don't need to see the current value.

## Versionstamps: Conflict-Free Ordering

Generating sequential IDs the obvious way means reading the current maximum, incrementing it, and writing the new value. That's a read-modify-write on a single key, which is exactly the conflict pattern we've been trying to avoid. Every concurrent transaction reads the same max ID, and all but one will abort.

**Versionstamps** solve this by deferring ID assignment to commit time. Instead of your transaction deciding what the next ID is, FoundationDB fills it in at the moment of commit. A versionstamp is a **12-byte value**: 8 bytes of commit version (assigned by the Sequencer), 2 bytes of batch ordering, and 2 bytes of user version. The result is globally unique and monotonically increasing across the entire cluster. You write a key containing a placeholder that FDB replaces with the actual versionstamp at commit. Your transaction doesn't know the final key until it commits, but multiple concurrent appends generate different versionstamps and write to different keys. Zero conflicts. As a secondary benefit, versionstamps also help with hot spots from monotonic keys. For key design patterns that spread writes across shards, see [crafting keys in FoundationDB](/posts/crafting-keys-in-fdb/).

```
// Write a log entry with a versionstamp key (placeholder filled at commit)
log_key = pack(log_subspace, VERSIONSTAMP_PLACEHOLDER, entry_id)
tr.set_versionstamped_key(log_key, data)

// Later, read everything since a known version
changes = tr.get_range(
    pack(log_subspace, last_known_version),
    pack(log_subspace, MAX_VERSIONSTAMP)
)
```

The Record Layer uses this for its `VERSION` index, which powers CloudKit's sync protocol. Each record stores its commit version, and a secondary index maps versions to primary keys. When a mobile device syncs, it scans the version index starting from its last-known version. Writers don't coordinate at all.

One limitation: you cannot read a versionstamped key within the same transaction that creates it. The final key doesn't exist until commit. Versionstamps work beautifully for append-only structures where you write and walk away.

### Cross-Cluster Ordering

Versionstamps are monotonically increasing within a single cluster, but versions assigned by different FoundationDB clusters are uncorrelated. This creates a problem when migrating data between clusters for load balancing or locality. A sync index based purely on versionstamps would break: updates committed after the move might sort before updates committed before the move.

The Record Layer solves this with an **incarnation** counter. Each user starts with incarnation 1, incremented every time their data moves to a different cluster. On every record update, the current incarnation is written to the record's header. The VERSION sync index maps `(incarnation, version)` pairs to changed records, sorting first by incarnation, then by version. Updates after a move have a higher incarnation and correctly sort after pre-move updates, even if the new cluster's version numbers are lower.

## Conclusion

The next time you see a conflict error, ask yourself: what did I read that I didn't need to? The answer is usually hiding in a range read that could have been narrower, a read-modify-write that could have been an atomic operation, or a check that could have used a snapshot read.

None of these techniques require changing FoundationDB itself. They're all about how you design your key schema and structure your transactions. As always, data-modeling in ordered key-value stores is the hard part of the job. What's the most surprising conflict you've debugged?

---

Feel free to reach out with any questions or to share your experiences with FDB transaction debugging. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

+++
title = "FoundationDB's Transaction Model for Layer Engineers"
description = "How optimistic concurrency control works in FoundationDB, and how to design data structures that stop fighting it"
date = 2026-01-27
draft = true
[taxonomies]
tags = ["foundationdb", "distributed-systems", "database", "transactions"]
+++

It's been a while since I've been writing layers on FoundationDB, but last year I really started to debug some concurrency issues in production. Transactions were failing with conflict errors that didn't make sense from reading the code. The logic looked correct: read a key, check a condition, write the result. Simple stuff. But under load, conflicts piled up and throughput collapsed.

Debugging those issues forced me to re-examine how **Optimistic Concurrency Control** actually works in FDB. Not the textbook version, but the practical version: which operations generate which conflict ranges, why range reads are more dangerous than they look, and how production systems like the [Record Layer](https://foundationdb.github.io/fdb-record-layer/) achieve less than 1% conflict rates across billions of databases. This post is the mental model I wish I'd had before that debugging session.

## The Mental Model That Changes Everything

FoundationDB uses **Optimistic Concurrency Control**, usually shortened to OCC. The name tells you the philosophy: assume your transaction will succeed, do your work without holding any locks, and check for conflicts only at commit time. This is the opposite of traditional databases where reading a row locks it until you're done.

The key insight that unlocks everything else: **your reads determine whether YOU can conflict, your writes determine what OTHER transactions will conflict with**. I'd suggest reading that sentence twice. It's the single most important idea in this entire post, and it took me an embarrassingly long time to internalize it.

Think about what this means. A transaction that only reads can never conflict with anything. It observes a snapshot of the database and goes away. A transaction that only writes, without reading anything first, also never conflicts. It blindly sets some keys and commits. The only transactions that can fail due to conflicts are those that both read and write. But here's the trap that catches everyone: your writes don't cause your conflicts. Your reads do. The writes you make cause problems for future transactions, but your transaction's fate was sealed the moment you issued those reads.

This asymmetry between reads and writes is the foundation of every pattern we'll explore. Once you see it, you can't unsee it. Every time you're about to read something in a transaction, ask yourself: **do I actually need to conflict on this?**

## Read Version, Commit Version, and the Window of Vulnerability

When your transaction starts, it obtains a **read version** from the cluster. Think of this as a logical timestamp maintained by the Sequencer process. This read version says "show me the database as it existed at this moment." All your reads within that transaction see a consistent snapshot frozen at that version. No locks, no waiting for other transactions to finish, just a pristine view of the world as it was.

When you finally commit, your transaction gets a **commit version**, guaranteed to be higher than your read version. Between your read version and your commit version lies what I call **the Window of Vulnerability**. This is the danger zone. Any key you read during your transaction that was modified by another committed transaction within this window will cause your transaction to abort.

The longer your transaction runs, the wider this window grows. More time means more opportunities for other transactions to modify keys you've read. This is why FoundationDB enforces a strict **5-second transaction limit**. It's not an arbitrary number. Resolvers keep conflict history in memory to perform conflict detection, and storage servers cache multi-version data so they can serve reads at old versions. Five seconds is the practical limit for keeping all that state in memory. Exceed it and the system physically cannot process your transaction anymore.

Short transactions have a tiny window of vulnerability. A transaction that completes in 50 milliseconds has almost no exposure. A transaction that takes 4.5 seconds is playing Russian roulette with every key it read.

## How Conflicts Actually Work

Every read your transaction performs adds a **read-conflict range** to your transaction. Every write adds a **write-conflict range**. At commit time, the Resolver checks: does your read-conflict set intersect any committed write-conflict set since your read version? If yes, your transaction is aborted.

Different operations generate different conflict ranges. This table is the reference I keep coming back to when designing data structures:

| Operation | Read Conflict | Write Conflict |
|-----------|:---:|:---:|
| `get(key)` | Yes (single key) | No |
| `get_range(start, end)` | Yes (entire range) | No |
| `set(key, value)` | No | Yes |
| `clear(key)` | No | Yes |
| `clear_range(start, end)` | No | Yes (entire range) |
| `atomic_add(key, param)` | No | Yes |
| `atomic_min / atomic_max` | No | Yes |
| `snapshot.get(key)` | No | No |
| `snapshot.get_range(...)` | No | No |
| `add_read_conflict_key(key)` | Yes (explicit) | No |
| `add_read_conflict_range(...)` | Yes (explicit) | No |

The pattern is clear. Regular reads create read conflicts. Regular writes create write conflicts. Atomic operations create write conflicts but **no read conflicts**. Snapshot reads create **no conflicts at all**. And you can manually add read conflicts for surgical precision.

Understanding this table changes how you design every data structure in your layer. Each row is a tool in your conflict-management toolkit.

## The Phantom Conflict Problem

Here's where engineers get burned, and I include myself in that group. When you call `get(key)`, FDB adds that single key to your read conflict set. Straightforward. You read a key, you conflict if someone else changes it.

But when you call `get_range(start, end)`, something more subtle happens. FDB adds **the entire range** to your conflict set. Not just the keys that happened to exist. Not just the keys your code iterated over. The mathematical range from start to end, including every possible key that could exist within it.

**You can conflict on keys you never saw.**

Imagine you're scanning a user's orders to check if they have any pending shipments. Your range read returns 3 orders. You check each one, they're all shipped, great. You decide to update a status flag. Meanwhile, another transaction inserts a brand new order for that same user. The key for that new order falls within your scanned range. Your transaction conflicts and aborts, even though you never touched that key, never saw it, and your business logic doesn't care about it at all.

I call this **The Phantom Conflict Problem**, and it's responsible for more confused debugging sessions than any other FDB behavior. The instinct is to blame the other transaction, or to assume something is wrong with FDB's conflict detection. But the system is working exactly as designed. You declared interest in a range of keys by reading it, and someone else wrote to that range. Conflict.

The fix requires either narrowing your reads to touch less keyspace, or using snapshot reads with selective conflicts.

## Atomic Operations: Writing Without Reading

The most powerful tool for avoiding conflicts is the **atomic operation**. When you need to increment a counter, the obvious approach is to read the current value, add one, and write the result back. This creates a read conflict on that key. Under concurrent updates, transactions start failing because they all read the counter and then race to write their incremented value.

Atomic operations like `ADD`, `MIN`, and `MAX` take a completely different approach. They send an instruction to the storage server: "add this delta to whatever value is there." The storage server performs the transformation without your transaction ever knowing the current value. From the conflict system's perspective, an atomic operation is a write without any corresponding read.

```
// Read-modify-write: creates read conflict, will fail under contention
value = tr.get(counter_key)
tr.set(counter_key, value + 1)

// Atomic: no read conflict, concurrent updates all succeed
tr.atomic_add(counter_key, 1)
```

The [Record Layer](https://foundationdb.github.io/fdb-record-layer/) exploits this for aggregate indexes. A `COUNT` index issues `atomic_add(count_key, 1)` on every record insertion and `atomic_add(count_key, -1)` on deletion. A `SUM` index adds the field's value. `MAX_EVER` and `MIN_EVER` use `atomic_max` and `atomic_min`. Unlimited concurrent updates to the same aggregate, zero conflicts between writers.

**The trap**: if you read a key and also atomically modify it in the same transaction, you lose all the benefits. The read already added a conflict range. The pattern only works when you genuinely don't need to see the current value. For a counter you're incrementing, that's fine. For a value you need to validate before modifying, atomic operations won't help.

When thinking about [idempotent transactions](/posts/automatic-txn-fdb-730/) and what happens when `commit_unknown_result` fires, atomic operations behave differently from regular writes. An `ADD` executed twice doubles the delta. Design accordingly.

## Snapshot Reads: Surgical Conflicts

Sometimes you need to read data but don't care if it changes before you commit. For these cases, FDB offers **snapshot reads**. A snapshot read sees a consistent view at your read version, just like a normal read. The difference is that it doesn't add anything to your read conflict set. Your transaction won't abort because someone modified data you observed through a snapshot.

The danger is obvious: if you make decisions based on snapshot reads and those decisions would be invalid with newer data, you have a consistency bug. But used carefully, snapshot reads enable patterns that would otherwise be impossible under high contention.

The most powerful technique is **The Snapshot + Surgical Conflict Pattern**. You read broadly with snapshots to survey the landscape, then explicitly add conflict ranges only for the specific keys that actually matter to your transaction's correctness.

The [Record Layer paper](https://www.foundationdb.org/files/record-layer-paper.pdf) describes this with a phrase I love: **"the transaction depends only on what would invalidate its results."**

Consider implementing a queue dequeue operation. The naive approach reads the first item and deletes it. Under concurrent dequeuers, everyone conflicts trying to grab the same first item. With the snapshot + surgical pattern:

```
// Snapshot-read the queue to find candidates (no conflict added)
items = tr.snapshot.get_range(queue_start, queue_end)

// Pick an item (could even be random to spread load)
chosen = pick(items)

// Add a conflict only on the chosen item
tr.add_read_conflict_key(chosen.key)

// Delete it
tr.clear(chosen.key)
```

Other dequeuers pick different items and succeed in parallel. You've converted a high-conflict sequential operation into a low-conflict parallel one.

The Record Layer paper includes a warning worth heeding: **"bugs due to incorrect manual conflict ranges are very hard to find, especially when mixed with business logic."** Build these patterns into reusable layer abstractions, not application code. When you start manually manipulating conflict ranges, you're taking responsibility for reasoning about consistency that FDB would normally handle automatically.

## Versionstamps: Conflict-Free Ordering

Sequential IDs and log entries present a frustrating paradox. You need ordering, but generating that order typically requires reading the last entry's ID to increment it. That read creates conflicts. Under high append rates, transactions fight over who gets to extend the sequence.

**Versionstamps** solve this by deferring ID assignment to commit time. A versionstamp is a **10-byte value**: 8 bytes of commit version (assigned by the Sequencer) plus 2 bytes of batch ordering (for ordering multiple operations within the same commit batch). The result is globally unique and monotonically increasing across the entire cluster.

The magic is that you write a key containing a placeholder that FDB replaces with the actual versionstamp at commit. Your transaction doesn't know the final key until it commits, but it can still write to it. Multiple concurrent appends generate different versionstamps and write to different keys. Zero conflicts.

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

The Record Layer uses this pattern for its `VERSION` index, which powers CloudKit's sync protocol. Each record stores its commit version, and a secondary index maps versions to primary keys. When a mobile device syncs, it scans the version index starting from its last-known version. Writers don't coordinate at all. They write their records with versionstamped index entries, and readers catch up by scanning the version space.

**Limitation**: you cannot read a versionstamped key within the same transaction that creates it. The final key doesn't exist until commit. Design your data model around this constraint. Versionstamps work beautifully for append-only structures where you write and walk away.

## Transaction Size Budget

The **10MB transaction limit** includes:

- Keys and values you write
- Keys and ranges you read (but not the returned values)
- Read and write conflict ranges

One detail that surprises people: `get_range` only adds the start and end keys as conflict range boundaries, not every key/value pair returned. Range reads are efficient for transaction size even when they return large result sets.

**Production numbers from CloudKit**: median transactions are roughly **7KB**, 99th percentile roughly **36KB**. If you're approaching 1MB, reconsider your data model. If you're approaching 10MB, you need to split across multiple transactions using [continuations](/posts/understanding-fdb-record-layer-continuations/).

**Index overhead**: CloudKit measures roughly **4 writes per record saved** (primary data plus index entries). Budget accordingly when designing multi-index schemas. Each additional index adds at least one more key-value write per record mutation.

## The Four Anti-Patterns

Let me name the patterns that consistently cause trouble in production so you can recognize them quickly.

**The Hot Key** appears when many clients read or write the same key at high rates. A naive global counter, a "last updated" timestamp, a single configuration value that everyone checks. The fix depends on access patterns: atomic operations for counters, sharding across multiple keys for extreme write rates, caching with acceptable staleness for read-heavy configuration.

**The Unbounded Range** shows up when you scan a large key range but only care about a small fraction of what's there. Full table scans in a transaction, searching for a needle in a haystack with `get_range`. The Phantom Conflict Problem makes this especially dangerous. The fix is narrowing your queries when possible, or using snapshot reads with surgical conflicts when you truly need to scan broadly.

**The Sequential Key** problem emerges when your keys have a monotonically increasing prefix like timestamps or auto-increment IDs. All writes land on keys near each other, which means they land on the same storage server's shard. You get hot spots even without conflicts. The fix is adding a shard prefix before the sequential component: `(shard, timestamp, id)` instead of `(timestamp, id)`. The shard can be a hash of some other field. See [crafting keys in FoundationDB](/posts/crafting-keys-in-fdb/) for more key design patterns.

**The Long Transaction** tries to do too much in one transaction. More work means more time, more time means a wider window of vulnerability, wider window means more conflicts. The fix is parallelizing reads so the transaction completes faster, splitting work into smaller transactions when full atomicity isn't required, or using [continuations](/posts/understanding-fdb-record-layer-continuations/) to checkpoint progress across transaction boundaries.

## Conclusion

The next time you see a conflict error, ask yourself: what did I read that I didn't need to? The answer is usually hiding in a range read that could have been narrower, a read-modify-write that could have been an atomic operation, or a check that could have used a snapshot read.

FoundationDB's OCC model isn't a limitation to work around. It's a design philosophy to embrace. Apple reports less than 1% conflict rates in production across billions of databases. That's not magic. It's careful data structure design that respects how OCC works.

Structure your keyspace so different entities live in different key ranges. Use atomic operations and versionstamps to modify shared state without observing it. When you must observe broadly, use snapshots and add conflicts surgically. You can test these patterns under realistic concurrency using [deterministic simulation](/posts/diving-into-foundationdb-simulation/).

---

Feel free to reach out with any questions or to share your experiences with FDB transaction debugging. You can find me on [Bluesky](https://bsky.app/profile/pierrezemb.fr), [Twitter](https://twitter.com/PierreZ) or through my [website](https://pierrezemb.fr).

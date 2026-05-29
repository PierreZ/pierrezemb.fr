+++
title = "Writing Fakes Is Easier Than You Think"
description = "The boundary you pick decides everything. Draw it at your code's view of the dependency and the fake collapses to a HashMap or a Vec. Even FoundationDB fits in under 400 lines."
date = 2026-05-29
draft = true
[taxonomies]
tags = ["testing", "simulation", "distributed-systems", "foundationdb"]
+++

I published a post a couple of months ago arguing that [fakes beat mocks and Testcontainers](/posts/why-fakes-beat-mocks-and-testcontainers/). Most people agreed with the idea, and then the same sentence came back to me over and over, in different rooms with different names attached. I have Postgres, I am not going to fake Postgres. I have RabbitMQ, I am not faking a broker. I have S3. The agreement was real and so was the refusal, and both came from the same mistake, because they picture faking Postgres as rebuilding Postgres, and rebuilding Postgres is a career, so they stop before they start. The estimate is off by an order of magnitude because it prices the wrong thing.

**The difficulty of a dependency and the difficulty of faking it are almost opposite.** Everything that makes Postgres hard to build, the durability and the concurrency under load and the query planner and the replication, sits below the thin line your own code actually touches, and a fake only has to stand on that line. It is the same trick as the tutorials that promise you Redis in a weekend or your own database in 500 lines, because the hard part of Redis was never `GET` and `SET`, it was keeping a million of those per second alive across a fleet of machines through restarts and failovers, and a fake keeps the `GET` and `SET` and skips the ninety-nine percent that was scale. So the only real question is where you put that line.

## The boundary is the whole decision

The line has two natural homes, and only one of them is sane. Draw it at the wire, at the S3 HTTP API or the AMQP protocol or the JDBC driver, and you have signed up to reimplement the dependency, with its connection pooling and its error codes and its version-to-version quirks. Draw it instead at your code's view of the dependency, at an object-store trait or a publisher or a repository, and the fake is a data structure, because that line is the contract you wrote and the only behaviors crossing it are the ones your code already depends on.

## Most fakes are a data structure

Once the line sits there, the thing left to build is small enough to see in one glance. Object storage is the clearest case, where your code calls `put`, `get`, and `list`, and the fake is a `HashMap<String, Vec<u8>>`. A message broker is the same idea in a different shape, a `Vec` per partition or topic or queue that you append to on publish and read by offset on consume. In both cases the parts that make the real thing famous, the eleven nines of durability for object storage and the clustering and flow control for the broker, never cross the line into your code, so they never enter the fake. Your code appends and reads, so your fake appends and reads, and the rest was never yours to reproduce.

## Even FoundationDB

Object stores and queues are easy, someone always says, but a transactional database is different, and you cannot fake a transaction without rebuilding the engine. FoundationDB is the hardest case I can name, a strictly serializable distributed database, and the people who built it drew this same line twice, once at the network and once at the transaction.

Take the network first. Flow, the language all FDB code is written in, reaches it through one interface, `IConnection`, and that interface is a byte stream:

```cpp
int read(uint8_t* begin, uint8_t* end) override;
int write(SendBuffer const* buffer, int limit) override;
```

The application reads bytes into a buffer and writes a buffer of bytes, and that is the whole contract. In production it wraps a TCP socket, so fragmentation and retransmission and reordering all sit below the line, while the simulator's `Sim2Conn` ([sim2.actor.cpp](https://github.com/apple/foundationdb/blob/dfbb0ea72ce01ba87148ef67cf216200e8b249cd/fdbrpc/sim2.actor.cpp)), which I took apart in [an earlier deep dive](/posts/diving-into-foundationdb-simulation/), is a `std::deque<uint8_t>` that hands bytes over in order with a `delay()` and a disconnect flag. Drop the line one level down to the packet and you would owe a whole TCP stack, so the stream boundary did not shrink that work, it deleted it.

The transaction is the second line, and the one I faked myself. The whole thing, MVCC and snapshot isolation and conflict detection, fits in [one file under 400 lines](https://github.com/PierreZ/moonpool/blob/a7ac54d3d83ff3a57c18c1914611374a782a3edc/moonpool-sim-examples/src/fdb.rs), because it fakes the FoundationDB an application sees, a transaction it opens, reads, writes, and commits, not the cluster underneath. That view is a trait of four methods, `get`, `put`, `delete`, and `commit`. The fake and a real binding over the C client implement the same trait, so the code on top cannot tell which is underneath, and a passing test ran against the same path that ships. Each piece then shrinks once the cluster is a single `Mutex`: the state is four fields, MVCC is a `Vec` per key that a snapshot read walks backwards, and the resolver that runs as its own cluster role in real FDB is one `for` loop:

```rust
for (begin, end) in &self.read_conflict_ranges {
    if fdb.any_write_in_range_since(begin, end, self.read_version) {
        return Err(FdbError::NotCommitted);
    }
}
```

That loop runs inline because there is no network between proxies and resolvers when the cluster is a mutex, and every client shares one copy of the data through an `Arc::clone`. The partial failures collapse the same way: the ones a real cluster needs a partition and precise timing to cause come down to a single `if` that draws from the seed, so the fake raises `NotCommitted`, `CommitUnknownResult`, and `TransactionTooOld` on demand. That keeps the failures your code has to handle and drops the causes you could never trigger reliably against the real thing.

**The hard part of FoundationDB is the environment, and the fake has no environment.** The TCP stack under the stream and the cluster under the transaction are both environment, the writers racing over a network and the crash between two writes and the disk that lies about flushing, and with none of it present, atomicity is just holding the mutex across two writes.

## A singleton with paused time

What lets every one of these collapse to a data structure is that the fake is a singleton holding a single mutex, where time is a number it advances itself. Atomic becomes holding the lock, expiry becomes a comparison against the clock, and a monotonic commit version becomes a counter that climbs by `max(1, elapsed)`. The genuinely hard problems of distributed systems, the concurrency across a network and the real clocks and the partial ordering, do not get solved in the fake, they stop existing, because there is one process and you own the clock.

## You do not have to be complete or perfect

A fake that covers four methods can feel unfinished, as if a real one would support everything the dependency does, but it only ever needs to cover what your code calls. The FDB fake skips range reads, atomic operations, versionstamps, and the retry helper, each a few more lines added the day a layer needs them, and everything left uncovered is a loud panic rather than a silent empty result that passes a test for the wrong reason. The fake is exactly as large as your usage, and the only thing that grows it is your code growing.

The one real worry is fidelity, that the fake drifts from the real dependency, a test passes against it, and a bug ships. The answer is a single test suite written against the trait, run against the fake on every commit and against the real thing in a container nightly, so when they disagree you learn which one is wrong the next morning. You are not reverse-engineering Postgres, you are pinning the handful of behaviors your code depends on, and that handful is small because your usage is small.

## Count the operations, not the manual

The size of Postgres was never the obstacle, and neither was the size of FoundationDB, because the obstacle was imagining the fake had to be as large as the system it stands in for when it only has to be as large as your code's view of that system. So the next time someone says they cannot fake RabbitMQ because it is too complex, the complexity of RabbitMQ is the wrong number to look at, and the right one is how many operations your service actually calls against it. Count those, not the pages in the dependency's manual, and you can count them before lunch.

---

Feel free to reach out with any questions or to share your experiences writing fakes. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

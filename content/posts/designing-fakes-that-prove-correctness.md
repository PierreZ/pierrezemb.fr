+++
title = "Designing Fakes That Prove Correctness"
description = "You never reimplement Postgres. You fake the five methods your code calls, then prove the fake still tells the truth."
date = 2026-06-08
draft = true
[taxonomies]
tags = ["testing", "simulation", "distributed-systems", "software-engineering", "rust"]
+++

"I'm not going to write a PostgreSQL fake."

My [last post on why fakes beat mocks and Testcontainers](/posts/why-fakes-beat-mocks-and-testcontainers/) kept coming up in conversations with colleagues, and that sentence was the most common reaction. They are picturing a reimplementation of a query planner, a write-ahead log, and twenty years of MVCC subtlety, and they are right to refuse that, because it was never the job. Fakes are way easier than you think, for several reasons.

## Fakes are all about ownership

Every fake starts with two questions. **What code do you actually own**, and **where is the fallible boundary it leans on**? The first you own by definition, it is the code you wrote and have to keep correct. The second is any point where that code hands off to something it does not control, a syscall, an RPC across the network, a file write, a TLS handshake, anything that can fail on its own schedule. You fake at that boundary, and which side of it you take depends on which one you own.

Say you wrote the client for an external system, like a database or an S3 client. You own the code that opens the connection, issues the request, and parses what comes back, and what you need to prove is that it survives that system misbehaving under it. So the fake becomes the server, a stand-in that answers your real client with the timeouts and errors the real thing throws on a bad day. FoundationDB does this on its backup path, where the real S3 client `S3BlobStoreEndpoint` runs completely unmodified and talks to a `MockS3Server` that answers over `Sim2`'s in-memory network instead of a real socket.

Now not everyone is writing low-level systems like the one above, but the logic still applies. Say you own a handful of microservices that talk to each other through a messaging system you did not write, like RabbitMQ or Kafka. The broker is just a dependency there, and the code you care about is the logic sitting on top of it. You hide the messaging system behind a trait your own services call, and you fake the trait. Same rule as the client case, just one layer up, only depending on **what you own** and **what is the fallible boundary**.

### Fakes must own their world

Another hint for finding the boundary is to look at your trait and ask whether it owns its own world. Take the network. To fake it, you have to own both ends of the connection, because a client with no server on the other side gets no response. A mock answers one call in isolation, but a fake runs a world where a `send` on one node genuinely routes through and lands in another node's `recv`. That shared fabric is what lets you express a partial partition, A and B cut off while B and C stay healthy, which no per-connection stub can reach. You host every process in one runtime and own the network yourself, the way FoundationDB's simulator, Madsim, and TigerBeetle's VOPR all do.

## Fakes are not hard to build

Now that we have the right boundary, we still need to build the fake, and that is the part that looks like work. It is not. A fake implements **a behavior** and skips the hardest part of any program: production. S3 is famously hundreds of microservices handling security, scaling, and failover. You do not need a fleet of microservices, you can fake S3 with four verbs, GET, PUT, LIST, and DELETE, backed by a singleton holding a `HashMap`. A weekend tutorial can rebuild Twitter in an afternoon because it keeps the timeline on screen and throws away the sharding and fan-out underneath that make the real thing hard. A fake makes the same trade on purpose, keeping only the behavior your code can observe and dropping everything that exists to survive production. The surface your code actually touches is almost always that small, and the afternoon you were dreading turns out to be an afternoon you have.

## Prove it can be honest

Now the fair worry. How do I know my `HashMap` behaves like Postgres for the handful of operations I kept? You do not, until you check, and the check is cheaper than the worry. Write one behavioral suite against the interface and run it twice, against the fake on every commit where it is fast and deterministic, and against the real dependency on a nightly tier where it is slow but honest. Martin Fowler called this a [contract test](https://martinfowler.com/bliki/ContractTest.html), Itamar Turner-Trauring calls the result a [verified fake](https://pythonspeed.com/articles/verified-fakes/), and the [Software Engineering at Google](https://abseil.io/resources/swe-book/html/ch13.html) book makes the same point, that a fake earns its trust only from a suite the real implementation passes too. The mechanics are nothing more than pointing the same assertions at two implementations.

## Design the (deterministic) failures

* Now that we have a verified fake, we can start the most interesting work: injecting failures!
* fakes have unique opportunities, because they own their world, they can take a lot of decisions to mess up things
* the easiest thing is to roll a dice and decide if you can throw an error.
* Now you can easily represent the most difficult problem in distributed-systems: did your operations succeeded or not during your error?
* Add an example for galera, that you can easily keep history in-memory and sometimes return old data
* and if you seed your random source, you have determininism


---

Feel free to reach out with any questions or to share your experiences with fakes and simulation. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

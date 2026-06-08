+++
title = "Designing Fakes That Prove Correctness"
description = "You never reimplement Postgres. You fake the five methods your code calls, then prove the fake still tells the truth."
date = 2026-06-08
draft = true
[taxonomies]
tags = ["testing", "simulation", "distributed-systems", "software-engineering", "rust"]
+++

"I'm not going to write a PostgreSQL fake."

My [last post on why fakes beat mocks and Testcontainers](/posts/why-fakes-beat-mocks-and-testcontainers/) kept coming up in conversations with colleagues, and that sentence was the most common reaction, said in a tone somewhere between tired and offended. They are picturing a reimplementation of a query planner, a write-ahead log, and twenty years of MVCC subtlety, and they are right to refuse that, because it was never the job.

Your code never sees Postgres. It sees the five methods you call through a repository you defined yourself, and that interface is the whole surface you owe a fake. Behind them sits a `HashMap`. You are not faking the product, you are faking your own contract.

## Fakes are all about ownership

Every fake starts with two questions. What code do you actually own, and where is the fallible boundary it leans on? The first you own by definition, it is the code you wrote and have to keep correct. The second is any point where that code hands off to something it does not control, a syscall, an RPC across the network, a file write, a TLS handshake, anything that can fail on its own schedule. You fake at that boundary, and which side of it you take depends on which one you own.

Say you wrote the client for an external system. You own the code that opens the connection, issues the request, and parses what comes back, and what you need to prove is that it survives that system misbehaving under it. So the fake becomes the server, a stand-in that answers your real client with the timeouts and errors the real thing throws on a bad day. FoundationDB does this on its backup path, where the S3 client `S3BlobStoreEndpoint` runs completely unmodified and `Sim2::connect()` hands it an in-memory connection wired to a `MockS3RequestHandler` instead of a socket.

Now move up a layer. Say you own a handful of microservices that talk to each other through a messaging system you did not write. The broker is just a dependency there, and the code you care about is the logic sitting on top of it. You hide the messaging system behind a trait your own services call, and you fake the trait. Same rule as the driver case, just one layer up, and in both you fake the first thing past the edge of the code you own.

## Fakes are not hard to rewrite

The objection hiding behind the Postgres one is that building the fake is the real work. It is not, and it fails to be for the same reason the weekend tutorials can promise you a working Twitter in three hours. They quietly drop everything that makes Twitter hard, the sharding, the timelines, the second user, and keep the part that fits on a slide. A fake makes that same trade on purpose. You throw away the scaling and the production concerns the real system carries, and you keep only the behavior your code can actually observe.

That behavior is almost always small. FoundationDB's simulated network does not reproduce TCP retransmission on the switch, it mimics the network from the point of view of the program, so a send turns into a delayed delivery into a buffer and nothing more. An S3 fake does not need the hundreds of services AWS runs behind the real thing, because the surface your code touches is four verbs, GET, PUT, LIST and DELETE. Most of the time the whole fake is a singleton holding a plain data structure, a `HashMap` behind a mutex, and the afternoon you were dreading turns out to be an afternoon you actually have.

## Fakes must own their world

This is what separates a fake from a mock, and the distinction is sharper than it looks. A mock answers a call. **A fake runs a world.** If you stand up one side of a network with canned replies and the other end never exists, nothing is really sent and nothing really arrives, and what you have is a mock wearing a fake's clothes. Build it properly and every endpoint plugs into the same fabric, so a `send` on one node genuinely routes through and lands in another node's `recv`. The thing runs end to end on its own, with nothing scripting each call from the outside.

That self-containment is the whole point. Shared state is what lets conflicts, ordering, and read-your-writes emerge on their own instead of being staged by hand, and it forces a real decision once the failures you care about live between machines rather than inside one. A per-connection fake can never express A and B partitioned while B and C stay healthy, which is when you host every process in one runtime and own the network as a `HashMap<HostId, VecDeque<Msg>>`, the way FoundationDB's simulator, Madsim, and TigerBeetle's VOPR all do.

## Prove it can be honest

Now the fair worry. How do I know my `HashMap` behaves like Postgres for the handful of operations I kept? You do not, until you check, and the check is cheaper than the worry. Write one behavioral suite against the interface and run it twice, against the fake on every commit where it is fast and deterministic, and against the real dependency on a nightly tier where it is slow but honest. Martin Fowler called this a [contract test](https://martinfowler.com/bliki/ContractTest.html), Itamar Turner-Trauring calls the result a [verified fake](https://pythonspeed.com/articles/verified-fakes/), and the [Software Engineering at Google](https://abseil.io/resources/swe-book/html/ch13.html) book makes the same point, that a fake earns its trust only from a suite the real implementation passes too. The mechanics are nothing more than pointing the same assertions at two implementations.

The morning those two runs disagree is the morning you learn something, that your fake drifted from the database or the database changed under you, and you learn it from a red test instead of an incident. That cross-check is also what keeps the work finite. You are never holding all of Postgres in your head, you are pinning down the short list of behaviors your code leans on and confirming, every night, that the real thing still honors them. The list stays small because your usage was small to begin with, and the suite that proves the fake is the same suite that documents exactly what you depend on.

## Design the failures

The happy path is the easy part and the least useful, because the real dependency cannot fail on command and your fake can. The failures worth chasing are never the whole dependency going down, since a container can already give you that and your code almost certainly handles it. What a container cannot give you, because it only knows fully up or fully down, is the **partial failure**, and that is where a fake earns its place. It drops one broker partition while the rest keep serving, evicts a single cache key between your write and the next read, answers a read 30 seconds stale while every health check stays green.

When the failure is ambiguous, the fake models the ambiguity instead of resolving it for free. A write that times out may have committed or may not have, so flip a coin rather than always rolling back, and let your code prove it survives both outcomes the way it will have to in production.

So design the fake to be **worse than production**, not faithful to it. The instinct is to match reality, but reality misbehaves beyond its own spec on a routine basis. I leaned on MariaDB Galera in the last post to make that point, the [healthy cluster Jepsen tested](https://jepsen.io/analyses/mariadb-galera-cluster-12.1.2) with no faults injected that still lost committed transactions and served reads weaker than Read Uncommitted. The design consequence is the part I skipped. If a calm cluster already does that rarely and without a sound, your fake should do it constantly and out loud, dropping more committed writes and serving more stale reads than the real system ever would. Code that survives a fake meaner than reality has nothing left to fear from reality.

## Make the failure come back, deterministically

A fake that fails at random is a slot machine, and a failing test you cannot reproduce is worse than no test at all. Take the clock and the randomness as inputs the test seeds, the way FoundationDB routes every random choice through a single seeded `deterministicRandom()`, and the same seed replays the same failure byte for byte.

That one move is the door to [simulation-driven development](/posts/simulation-driven-development/), where you stop hand-writing failure cases and let the machine search thousands of seeded schedules for the one ordering that breaks you. FoundationDB has run on the order of a trillion CPU-hours of this, and it is the reason I have never once been paged for FDB in production. Your afternoon `HashMap` is the first rung of that same ladder.

So agree with your colleague. Nobody should reimplement Postgres. Put a small self-contained fake on the far side of the five methods their code actually calls, pin it to the real thing with a contract test, and teach it to fail the way a bad Tuesday fails.

How few of its methods does the dependency you are so afraid to fake actually need from you?

---

Feel free to reach out with any questions or to share your experiences with fakes and simulation. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

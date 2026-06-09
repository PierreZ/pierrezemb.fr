+++
title = "Designing Fakes That Prove Correctness"
description = "You fake the handful of methods your code actually calls, prove the fake stays honest, and then make it fail the way production does."
date = 2026-06-09
draft = false
[taxonomies]
tags = ["testing", "simulation", "distributed-systems", "software-engineering", "rust"]
+++

"I'm not going to write a PostgreSQL fake."

My [last post on why fakes beat mocks and Testcontainers](/posts/why-fakes-beat-mocks-and-testcontainers/) kept coming up in conversations with colleagues, and that sentence was the most common reaction. They are picturing a reimplementation of a query planner, a write-ahead log, and twenty years of MVCC subtlety, and they are right to refuse that, because it was never the job. Fakes are way easier than you think, for several reasons.

## Fakes are all about ownership

Every fake starts with two questions. **What code do you actually own**, and **where is the fallible boundary it leans on**? The first you own by definition, it is the code you wrote and have to keep correct. The second is any point where that code hands off to something it does not control, a syscall, a library, an RPC across the network, a file write, a TLS handshake, anything that can fail on its own schedule. You fake at that boundary, and which side of it you take depends on which one you own.

Say you wrote the client for an external system, like a database or an S3 client. You own the code that opens the connection, issues the request, and parses what comes back, and what you need to prove is that it survives that system misbehaving under it. So the fake becomes the server, a stand-in that answers your real client with the timeouts and errors the real thing throws on a bad day. FoundationDB does this on its backup path, where the real S3 client `S3BlobStoreEndpoint` runs completely unmodified and talks to a `MockS3Server` that answers over `Sim2`'s in-memory network instead of a real socket.

Now not everyone is writing low-level systems like the one above, but the logic still applies. Say you own a handful of microservices that talk to each other through a messaging system you did not write, like RabbitMQ or Kafka. The broker is just a dependency there, and the code you care about is the logic sitting on top of it. You hide the messaging system behind a trait your own services call, and you fake the trait. Same rule as the client case, just one layer up, only depending on **what you own** and **what is the fallible boundary**.

### Fakes must own their world

Another hint for finding the boundary is to look at your trait and ask if it owns its own world. Take the network as an example. To fake the network you have to own both ends of the connection, because a client that sends a request to nothing never gets a response, and the test goes nowhere. So you fake the whole network, you host every process in a single runtime and you own the wire between them, and a `send` on one node travels through your fake network and lands in another node's `recv`. You own the clock the same way, a node that sleeps for thirty seconds does not actually wait, the simulated time jumps forward and the whole test runs in a frozen instant. Once you own the world like that, you can create a partial partition where A and B are cut off from each other while B and C keep talking, and the [OSDI 2018 study of 136 partition failures](https://www.usenix.org/system/files/osdi18-alquraan.pdf) found 80% of them catastrophic. This is how FoundationDB's simulator, Madsim, and TigerBeetle's VOPR all work.

## Fakes are not hard to build

Now that we have the right boundary, we still need to build the fake, and that sounds like the hard part, but it is the easy part, because a fake only has to implement a behavior and it skips the hardest thing any program carries, which is everything you build to survive production. S3 is famously hundreds of microservices working together to handle security, scaling, and failover, but your code never touches any of that, it only ever sees four verbs, GET, PUT, LIST, and DELETE, so you fake those four with a singleton holding a `HashMap` and you are done. It is the same trick as the weekend tutorial that rebuilds Twitter in an afternoon, you keep the timeline you can actually see and you throw away the sharding and fan-out underneath that make the real thing hard, and the surface your own code touches is almost always that small.

## Prove it can be honest

Now the fair worry. How do I know my `HashMap` behaves like Postgres for the handful of operations I kept? You do not know until you check, and checking is easy, you write one behavioral suite against the interface and you run it twice. On every commit you run it against the fake, where it is fast and deterministic, and on a nightly tier you run it against the real dependency, where it is slower but it tells you the truth. Martin Fowler called this a [contract test](https://martinfowler.com/bliki/ContractTest.html), Itamar Turner-Trauring calls the result a [verified fake](https://pythonspeed.com/articles/verified-fakes/), and the [Software Engineering at Google](https://abseil.io/resources/swe-book/html/ch13.html) book makes the same point, a fake is only worth trusting if the real implementation passes the very same suite, so the whole mechanism is nothing more than pointing one set of assertions at two implementations.

## Design the (deterministic) failures

Now that we have a verified fake, we can start the most interesting work: injecting failures! Fakes have unique opportunities, because they own their world, they can take a lot of decisions to mess up things. They can be slow, they can return an error, they can lose your write, and all of it happens inside the test.

The easiest thing is to roll a dice and decide if you throw an error. Now you can easily represent the most difficult problem in distributed systems: did your operations succeed or not during your error? When the dice says error, you roll again and decide if the write landed or not, and you return the same error in both cases. Your code does not know which one happened, that is exactly the situation you want to test.

Galera is a good example, because [a healthy cluster Jepsen tested with no faults injected](https://jepsen.io/analyses/mariadb-galera-cluster-12.1.2) still served stale reads, so old data is not a failure you invented, it is something a real database does even when nothing is wrong. You can reproduce that easily, you keep the history in-memory and sometimes return old data, which costs you a `Vec` instead of a single value and a dice roll on each read. And if you seed your random source, you have determinism, the same seed replays the same failures, so you can find a bug once and replay it as many times as you need.


---

Feel free to reach out with any questions or to share your experiences with fakes and simulation. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

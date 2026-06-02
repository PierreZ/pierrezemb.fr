+++
title = "Writing Fakes Is Easier Than You Think"
description = "You never fake Postgres, you fake your code's narrow access to it. Here is the four-step recipe, with the pitfalls and tips for each step."
date = 2026-05-29
draft = true
[taxonomies]
tags = ["testing", "simulation", "distributed-systems", "foundationdb"]
+++

A few months ago I argued that [fakes beat mocks and Testcontainers](/posts/why-fakes-beat-mocks-and-testcontainers/). Most people agreed with the idea, and then the same objection came back to me in room after room, with a different dependency each time. I get the whole fakes thing, but I am not going to fake Postgres. I am not faking RabbitMQ. I am not rebuilding S3. The agreement was real and so was the refusal, and both came from the same mistake, because everyone pictures faking Postgres as rebuilding Postgres, and rebuilding Postgres is a career, so they stop before they start.

That estimate is off by an order of magnitude because it prices the wrong thing. **You never fake Postgres. You fake your code's narrow access to it.** Everything that makes Postgres hard to build, the durability and the concurrency under load and the query planner and the replication and the crash recovery, sits below the thin line your code actually touches, and a fake only has to stand on that line. The difficulty of the dependency and the difficulty of faking it are almost opposite, because the impressive part of Postgres is the machinery that keeps its behavior alive in production, and the fake has no production. So here is the recipe I follow, four steps, with the pitfall and the tip at each one.

## Step 1: draw the line at the trait, not the wire

The first decision is the whole game, and it comes down to what you own. If you own the client of a system, fake the wire, but the wire means the contract your language exposes, not the layer below it. FoundationDB fakes the network at the level of TCP `read` and `write`, never at the level of packet retransmission inside a switch, because Flow code only ever sees a byte stream. If you talk to S3, you own the client, so you fake the server as your client sees it, a `put` and a `get` and a `list`. And if you own the service that reaches for the database, fake your access to it, the `UserRepository` you wrote, not the engine underneath it.

The second lens is fallibility. Walk your code and find the parts that talk to something that can fail, the network, the disk, the database, the clock. Those seams are where the line goes, because those are the only places a fake has anything to do. **Don't fake PostgreSQL. Fake your access to it.** The trait is a contract you already wrote, and the only behaviors crossing it are the ones your code already depends on.

The tip that saves you from the order-of-magnitude mistake is to count the methods your code actually calls. Postgres can do thousands of things and your service uses six of them. The fake covers the six, and its size tracks your usage, not the database's capability.

## Step 2: build the fake as a data structure

Once the line sits at the trait, what is left to build is small enough to see in one glance. Faking a system by its contract is cheap because you get to drop everything about production and scaling, the same way the weekend tutorials let you build Twitter in three hours by quietly never touching scale. You are left with correctness, and correctness is a data structure.

The shape follows one question: do multiple independent clients need to observe the same state? A message broker has producers and consumers that must see the same queue, and a network has peers that must see the same bytes, so those need a singleton holding the state, a `Vec` per partition that clients keep a reference to. A repository with a single access point needs nothing of the kind. `FakeUserRepository` is a `HashMap` and that is the end of it.

```rust
trait UserRepository {
    async fn save(&self, user: User) -> Result<(), StorageError>;
    async fn find_by_id(&self, id: u64) -> Result<Option<User>, StorageError>;
}

struct FakeUserRepository { store: Mutex<HashMap<u64, User>> }

impl UserRepository for FakeUserRepository {
    async fn save(&self, user: User) -> Result<(), StorageError> {
        self.store.lock().unwrap().insert(user.id, user);
        Ok(())
    }
    async fn find_by_id(&self, id: u64) -> Result<Option<User>, StorageError> {
        Ok(self.store.lock().unwrap().get(&id).cloned())
    }
}
```

An S3 fake is a `HashMap<String, Vec<u8>>`, because you do not need to store petabytes across a fleet of microservices to answer your code's `get`. Drop operation timing by default, since the fake returns instantly and correctness does not depend on latency, and the delays and the hangs come back as a deliberate choice in step 4. You can still own a logical clock, a number you advance yourself for ordering or expiry or a commit version, but you never reach for the wall clock.

For everything your code does not call, panic. A method the fake does not cover is a loud panic, never a silent empty return, because a silent default is how a test passes for the wrong reason. The panic is a visible, greppable TODO that turns the vague worry "is my fake complete?" into a finite list you can read. Make the message point the way:

```rust
async fn run_raw_sql(&self, _: &str) -> Result<Rows, StorageError> {
    panic!("run_raw_sql is not faked yet, implement it or run this test against the real repo")
}
```

The next engineer who hits that panic sees the two options immediately, implement it in a few more lines or route that one test against the real dependency. Both are correct, and the fake stays exactly as large as your usage.

Does this fall apart on a transaction? It does not, and that is the part people are surest is impossible. Atomicity in a fake is just holding the mutex across the writes, because the WAL and the replication and the crash recovery that make atomicity hard in Postgres are all there to survive production, and the fake has no production. I wrote a faithful FoundationDB fake this way, with real MVCC and snapshot isolation and commit-time conflict detection, and the whole thing fits in [under 400 lines](/posts/diving-into-foundationdb-simulation/). One trait, two implementations, swapped at the composition root, so the code on top cannot tell which is underneath and a passing test exercised the same path that ships.

## Step 3: pin fidelity with one contract suite

The one real worry left is that the fake drifts from the dependency, a test passes against it, and a bug ships. The answer is a single test suite written against the trait, run against the fake on every commit where it is fast and deterministic, and against the real dependency in a container nightly where it is slow but honest. When the two disagree, you learn which one is wrong the next morning, and because both sit behind the same trait you can run them side by side and diff the outputs directly.

This is what makes fidelity tractable. You are not reverse-engineering Postgres, you are asserting the specific behaviors your code depends on against both implementations, and that set is small because your usage is small. The fear of fidelity is an unbounded fear about everything the database might do, and the contract suite turns it into a finite list of properties you check.

## Step 4: inject partial failures from a seed

A faithful fake is useful, but a fake that is worse than production is where the bugs come from, so model your worst case into it. The failures that page you are the silent ones, a write that reports success and vanishes, a read that returns stale data, an operation that never comes back. Loud errors your code already handles, and this is where the delays and the no-reply you dropped in step 2 earn their place.

Take Galera. The [Jepsen analysis](https://jepsen.io/analyses/mariadb-galera-cluster-12.1.2) found that a healthy cluster with zero injected faults still produced lost committed transactions, lost updates, and stale reads, an isolation level that appeared weaker than Read Uncommitted, which is terrifying for anyone running it in production. Reproducing that worst case in a fake is trivial, you return a stale read half the time instead of 0.1% of the time, and now your code meets the behavior in a test instead of at 3 AM. Drive every one of these decisions from a seed so a failing run replays deterministically, and you keep the failures your code has to handle while dropping the causes you could never trigger reliably against the real thing. The point is to exercise your error handling and your retries against an environment meaner than anything you will actually deploy on.

## Count the operations, not the manual

The size of Postgres was never the obstacle, and neither was the size of RabbitMQ or S3 or FoundationDB. The obstacle was imagining the fake had to be as large as the system it stands in for, when it only has to be as large as your code's view of that system. So the next time someone says they cannot fake their database because it is too complex, the complexity of the database is the wrong number to look at. The right one is how many operations your service runs against it, and you can count those before lunch.

---

Feel free to reach out with any questions or to share your experiences writing fakes. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

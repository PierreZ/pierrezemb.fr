+++
title = "Writing Fakes Is Easier Than You Think"
description = "You never fake Postgres, you fake the small slice of it your code touches. Why that makes faking even a transactional database an afternoon of work."
date = 2026-05-29
draft = true
[taxonomies]
tags = ["testing", "simulation", "distributed-systems", "foundationdb"]
+++

A few months ago I wrote about why [fakes beat mocks and Testcontainers](/posts/why-fakes-beat-mocks-and-testcontainers/), and it started a lot of conversations, mostly with colleagues at work. They liked the idea, then came back with questions.

## Drawing the line

> So what am I actually faking?

It depends on what you own. Own the client of a system and you fake the wire, but the wire means the contract your language gives you, not the layer below it. FoundationDB fakes the network as a TCP `read` and `write`, never as packets moving through a switch, because Flow code only ever sees a byte stream. Use S3 and you own the client, so you fake the server it talks to, a `put`, a `get`, a `list`. Own the service that reaches for the database and you fake the call into it, the `UserRepository` you wrote, not the engine under it.

To find the line, follow what can fail. Walk your code and mark every call that hands work to the outside, the network, the disk, the database, the clock. Those are the only places a fake has anything to do, so that is where it lives.

This is also why that career-sized estimate is wrong. Count the methods your code calls. Postgres does thousands of things and your service uses six of them. The fake covers the six and grows with your code, never with the manual.

## Building it

> Fine, but building it is the real work.

With the line at the trait, what is left to build is small. You throw away production and scale, the same way the weekend tutorials hand you a working Twitter in an afternoon by never serving a second user. What stays behind is correctness, and correctness is a data structure.

The shape depends on one question. Do several clients have to see the same state? A broker has producers and consumers on the same queue, a network has peers on the same bytes, so each one needs a singleton that holds the state and lends out references. A repository with a single caller needs none of that. `FakeUserRepository` is a `HashMap`, and that is the end of it.

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

An S3 fake is a `HashMap<String, Vec<u8>>`. Answering a `get` never needed petabytes spread across a fleet. Let it return at once and ignore latency, since correctness does not depend on how long a call takes. The delays and the hangs come back on purpose later. Keep a logical clock if you need ordering or expiry, a number you bump yourself, but never read the wall clock.

Anything your code does not call, you panic on. A silent empty return is how a test passes for the wrong reason, so the fake refuses out loud. The panic is also a TODO you can grep for, and it turns "is my fake done yet" into a list you can read.

```rust
async fn run_raw_sql(&self, _: &str) -> Result<Rows, StorageError> {
    panic!("run_raw_sql is not faked yet, implement it or run this test against the real repo")
}
```

Whoever hits it has two honest choices. Write the missing method, a few more lines. Or send that test to the real database. Both are fine. The fake never grows past what the code in front of it asks for.

Then someone brings up the transaction. Surely you cannot fake atomicity. But in a fake, atomicity is holding the mutex across the writes and letting nothing see the gap. The write-ahead log, the crash that lands between the two writes, the replica that has not caught up, all of it is there to keep that promise while the machine is on fire, and a fake is never on fire. I built a faithful FoundationDB fake on this one idea. MVCC, snapshot isolation, conflict detection at commit, the whole cluster shrinking to four fields behind a mutex. It came out [under 400 lines](/posts/diving-into-foundationdb-simulation/). One trait, two implementations picked at startup, so the code above cannot tell which one it got, and a passing test ran the same path that ships.

## Keeping it honest

> How do I know it matches the real thing?

That one is fair. The fake drifts from the database, a test passes against it, the bug ships anyway. So write one suite against the trait and run it against both. The fake runs on every commit, fast and deterministic. The real database runs in a container at night, slow but honest. When they disagree, you know by morning which one lied.

This makes fidelity a finite job. You are not rebuilding Postgres in your head. You are listing the behaviors your code depends on and checking the real one still holds them. The list is short because your usage is short.

## Making it worse

> A fake only ever gives me the happy path.

Only if you let it. A faithful fake is useful, but a fake that lies is where the bugs come from. So teach it the worst your database can do. The failures that page you are not the loud ones, your code already catches those. They are the quiet ones, a write that reports success and vanishes, a read that hands back old data, a call that never returns. This is where the delays and the hangs from before are useful.

Take Galera. Jepsen ran a [healthy cluster](https://jepsen.io/analyses/mariadb-galera-cluster-12.1.2) with no injected faults and watched it lose committed transactions, lose updates, and serve stale reads, landing in places below Read Uncommitted. **If I was running Galera**, I would set my fake to lose committed transactions at a high rate and run it under simulation, just to see whether my code can handle it. The real cluster does this rarely and without a sound. The fake does it often, and on a seed, so a failing run replays it exactly.

## Count the operations, not the manual

None of this grows with the size of Postgres, and that was the trap all along. The fake never had to match the database, only the slice your code reaches for. So when someone says their database is too complex to fake, its size is the wrong thing to look at. Count the calls your service makes against it. That is the only number that matters, and it is small.

---

Feel free to reach out with any questions or to share your experiences writing fakes. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

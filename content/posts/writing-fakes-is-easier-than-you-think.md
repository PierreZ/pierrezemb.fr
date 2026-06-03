+++
title = "Writing Fakes Is Easier Than You Think"
description = "You never fake Postgres, you fake the small slice of it your code touches. Why that makes faking even a transactional database an afternoon of work."
date = 2026-05-29
draft = true
[taxonomies]
tags = ["testing", "simulation", "distributed-systems", "foundationdb"]
+++

A few months ago I wrote about why [fakes beat mocks and Testcontainers](/posts/why-fakes-beat-mocks-and-testcontainers/), and it kept coming up in conversations with colleagues at work. They liked the idea, then came back with the same doubt, that faking something the size of Postgres sounds like far too much work to be worth it.

## Drawing the line

> So what am I actually faking?

Two questions decide it together, and faking the wrong layer almost always means you answered only one of them. The first is what you own, since your code runs right up to the moment it calls into something you did not write, and the fake has to sit somewhere along that ownership line. The second is whose error handling you are trying to exercise, because the reason to fake at all is to push failures into the code you wrote and watch it cope, which only works when the fake sits low enough to hand those failures to the exact code you want to harden.

FoundationDB's backup is the example that made this click for me, because it owns the S3 client, the code that issues a `put`, waits on a `get`, and parses whatever comes back, while it plainly does not own S3 itself. The error handling they wanted to harden lived inside that client, so the fake could not be the client, it had to be the server beneath it, a shim they controlled that was free to answer with the timeouts, the error codes, and the half-truncated bodies a real S3 throws on a bad day. Every one of those answers lands in the client's own recovery path, which was the entire point, where faking the client would have tested nothing, since the client was the very code they were trying to harden.

Move the code you care about and the line moves with it, so when the thing you want to harden is your own logic sitting on top of a database, you stop caring about the SQL driver's error handling and care only about yours, and the boundary climbs to the `UserRepository` trait you wrote. There the fake just implements that trait, a `HashMap` that can also hand back the errors your logic has to survive, and you never reach down to the engine underneath because nothing you are testing lives there.

When you cannot see the line, walk your code and mark every call that hands work to something you do not control, the network, the disk, the database, the clock, then for each mark ask whose recovery code you want to run, because that answer alone tells you whether to fake the call itself or the layer just beneath it.

## Building it

> Fine, but building it is the real work.

Once the line sits at the trait, what is left to build turns out to be small, because you get to throw away production and scale the same way the weekend tutorials hand you a working Twitter in an afternoon by quietly never serving a second user. What stays behind is correctness, and correctness is just a data structure.

The shape it takes comes down to one question, whether several clients have to share the same state. A broker has producers and consumers on one queue, a network has peers reading the same bytes, and each needs a singleton that owns the state and lends out references to it. A repository with a single caller carries none of that weight, which is why `FakeUserRepository` can be a bare `HashMap` and nothing more.

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

An S3 fake is nothing more than a `HashMap<String, Vec<u8>>`, because answering a `get` never needed petabytes spread across a fleet, only the bytes you once put under that key. You let it answer instantly and ignore latency, since correctness does not depend on how long a call takes, and the delays and the hangs you strip out here come back on purpose later. The only state worth keeping beyond the data itself is a logical clock for ordering or expiry, a number you bump yourself instead of ever reading the wall clock.

Anything your code does not call yet, you panic on, because a silent empty return lets a test pass for the wrong reason, while a panic refuses out loud. That same panic doubles as a TODO you can grep for, so the question of whether your fake is finished stops being a worry and becomes a list you can read.

```rust
async fn run_raw_sql(&self, _: &str) -> Result<Rows, StorageError> {
    panic!("run_raw_sql is not faked yet, implement it or run this test against the real repo")
}
```

Whoever hits it has two honest choices, either write the missing method, which is usually a few more lines, or send that test to the real database, and both are fine. The fake never grows past what the code in front of it asks for.

Then someone always brings up the transaction, certain that atomicity is the one thing you cannot fake, when it is really nothing more than holding the mutex across the writes and letting nothing observe the gap between them. The write-ahead log, the crash that lands between two writes, the replica that has not caught up, all of that machinery exists to keep that promise while the machine is on fire, and a fake is never on fire. I built a faithful [FoundationDB](/posts/diving-into-foundationdb-simulation/) fake on exactly this one idea, with MVCC, snapshot isolation, and conflict detection at commit, the whole cluster shrinking to four fields behind a mutex, and it came out under 400 lines, one trait with two implementations chosen at startup, so the code above could never tell which one it got and a passing test ran the same path that ships.

## Keeping it honest

> How do I know it matches the real thing?

That worry is the fair one, because a fake really can drift from the database it stands in for, the test keeps passing against the drifted version, and the bug ships anyway. The fix is to write one suite against the trait and point it at both implementations, the fake on every commit where it is fast and deterministic, the real database in a container overnight where it is slow but honest. On the morning after the two disagree, you know which of them was lying.

That cross-check is what makes fidelity a finite job, because you are not rebuilding Postgres in your head, you are only listing the behaviors your code leans on and confirming the real database still honors them, a list that stays short because your usage was short to begin with.

## Making it worse

> A fake only ever gives me the happy path.

It only gives you the happy path if you let it stay polite, because the fake that catches bugs is the one that can lie the way your database does, which is why you teach it the worst the real thing is capable of. The failures that page you are never the loud ones your code already handles, they are the quiet ones, a write that reports success and then vanishes, a read that hands back data from an hour ago, a call that never returns, and this is where the delays and the hangs you stripped out earlier come back to earn their place.

Galera makes the case better than I could, because Jepsen ran a [healthy cluster](https://jepsen.io/analyses/mariadb-galera-cluster-12.1.2) with no injected faults and still watched it lose committed transactions, lose updates, and serve stale reads, landing below Read Uncommitted. If I was running it, I would set my fake to drop committed transactions at a high rate and run my code against that under simulation, to see whether it survives what the real cluster already does on a calm day. The cluster does this rarely and without a sound, while the fake does it constantly and on a fixed seed, so the run that finally breaks replays itself exactly.

The fake never had to match the whole database, only the thin slice your code ever reaches for, so the next time one feels too big to fake, do not ask what it is capable of, ask instead how few of its methods your own code actually calls. How many is that, really, for the database you were about to give up on?

---

Feel free to reach out with any questions or to share your experiences writing fakes. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

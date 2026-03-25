+++
title = "Why Fakes Beat Mocks and Testcontainers"
description = "Trait-based fakes test partial failures that mocks and Testcontainers fundamentally cannot simulate. They are also the on-ramp to simulation-driven development."
date = 2026-03-25
draft = true
[taxonomies]
tags = ["testing", "simulation", "distributed-systems"]
+++

Your CI pipeline spins up Kafka, Postgres, and Redis in Docker containers. It takes 4 minutes to start. Every test passes. And none of them can simulate the one failure mode that will page you at 3 AM.

The problem is not speed or convenience. The problem is that Testcontainers give you a binary outcome: the whole service is up, or it is down. But production failures are **partial**. A Kafka broker loses partition 3 while partitions 1, 2, and 4 stay healthy. A Postgres replica falls behind by 30 seconds while the primary is fine. A Redis cluster has one shard OOM while five others serve normally. These are the failures where the real bugs hide, and Testcontainers simply cannot produce them.

## Mocks, Testcontainers, and fakes

Mocks and Testcontainers are the two tools most developers reach for. Both have fundamental limitations. There is a third option that is surprisingly underused: **fakes**.

|  | Mocks | Testcontainers | Fakes |
|---|---|---|---|
| **State** | None — scripted returns | Full — real database | Realistic — in-memory |
| **Failure modes** | Only what you anticipate | Binary: up or down | Arbitrary granularity |
| **Partial failures** | Manual, per-test | Impossible | Built-in |
| **Speed** | Microseconds | Minutes (startup) | Microseconds |
| **Deterministic** | Yes | No | Yes |

A fake is a real implementation of a dependency's interface that runs in-memory, maintains realistic state, and can inject failures at arbitrary granularity. Not a compromise between mocks and real dependencies, but something **more powerful** than both.

## What is wrong with mocks

The first problem is that mock expectations couple your tests to implementation details. Oxide Computer's [README on fakes](https://github.com/oxidecomputer/omicron/blob/main/illumos-utils/src/fakes/README.adoc) captures it:

> "If you're calling a mocked API which accesses the host OS several call stacks down, your test must have an expect call for that API, or it will fail."

Refactor an internal call path and every mock-based test breaks, even though the external behavior is unchanged. Your tests are testing the implementation, not the contract.

This leads to the second problem: refactoring brittleness. Each mock setup is per-test, so:

> "Changed host OS interactions can require changes across a broad number of tests."

A fake implementation is written once and shared across all tests. When an internal behavior changes, you update one fake instead of N test setups. The difference compounds: in a fast-moving codebase, mock maintenance becomes the thing that slows you down.

The third problem is subtler. Mock frameworks push you toward conditional compilation, feature-gated calls, or annotations like `@VisibleForTesting`, making:

> "Certain codepaths incredibly difficult to test."

A fake avoids this entirely because it is just another implementation of the same interface. It exercises the same production wiring, the same error handling. The only thing that changes is what sits behind the interface.

But if mocks are the wrong tool, what replaces them?

## The pattern

The idea is simple enough to fit in a single paragraph: define an interface for the external dependency, implement it once for real usage (the version that calls the OS, the network, the disk), implement it again as a fake (in-memory, stateful, with injectable failure modes), and inject via interface reference so you can swap between real and fake at runtime. Tests compose multiple fake implementations into a complete test environment. That is the entire pattern.

Two principles help you choose where to draw the boundary.

**Code ownership.** Fake where your code meets code you do not own. If you fake at the JDBC level, you are simulating PostgreSQL's behavior: connection pooling, transaction isolation, error codes. That is code you do not own. When PostgreSQL changes behavior between major versions, your fake silently diverges from reality. If you fake at `UserRepository`, you are simulating a contract you defined. Three methods, a `HashMap`. You can keep it correct because you wrote the spec.

**Abstraction sufficiency.** Fake at the level where the fake can represent all failure modes your code cares about, without simulating complexity below. If your code uses TCP streams, fake TCP streams. You do not need to simulate packet fragmentation or TCP retries because your code never sees packets. But you can still inject connection drops, slow reads, and partial writes. The fake is **self-sufficient** at that abstraction. FoundationDB does exactly this: their [`INetwork`](/posts/diving-into-foundationdb-simulation/) interface fakes at the TCP stream level, not the packet level. Their simulation covers every failure their application code will encounter without modeling anything below the stream abstraction.

Both principles point to the same place in practice: the highest boundary where your application interacts with the dependency. For a typical service, that means domain-level traits like `UserRepository` or `ObjectStore`, and OS primitives like network, disk, and clock.

Start with the trait:

```rust
trait UserRepository {
    async fn save(&self, user: User) -> Result<(), StorageError>;
    async fn find_by_id(&self, id: u64) -> Result<Option<User>, StorageError>;
}
```

Your code depends on this trait, not on PostgreSQL. Now write two implementations:

```rust
// Production
struct PostgresUserRepository { pool: PgPool }

impl UserRepository for PostgresUserRepository {
    async fn save(&self, user: User) -> Result<(), StorageError> {
        sqlx::query("INSERT INTO users ...").execute(&self.pool).await?;
        Ok(())
    }
}

// Test
struct FakeUserRepository { store: HashMap<u64, User> }

impl UserRepository for FakeUserRepository {
    async fn save(&self, user: User) -> Result<(), StorageError> {
        self.store.insert(user.id, user);
        Ok(())
    }
}
```

Same trait. One talks to Postgres. One lives in memory. Your system cannot tell the difference. The fake maintains real state, supports real queries against that state, and runs in microseconds with zero infrastructure.

So the pattern is straightforward. But why is it better than just running the real dependency in a container?

## The failures containers miss

Testcontainers running real Kafka give you binary: up or down. A `FakeMessageBroker` can return `Ok` for partition 1 and `Err(PartitionUnavailable)` for partition 3 in the same call. A real PostgreSQL container serves consistent reads. A `FakeStore` can return stale data on 50% of reads, simulating replica lag your application must handle. A real Redis container never evicts keys mid-test. A `FakeCache` can expire entries between a write and the immediately following read. A real system clock never goes backward. A `FakeClock` can jump forward, rewind, or freeze, exposing every time-dependent assumption in your code.

These are not exotic edge cases. They are Tuesday in production. And containers cannot produce any of them because containers faithfully implement the dependency's happy path. A fake controls the failure surface at arbitrary granularity: which operation fails, when it fails, and how it fails.

A fake that covers 80% of a dependency's behavior with determinism and fault injection is strictly better than Testcontainers covering 100% with none of those properties. The 20% you do not model belongs in a separate integration test against the real dependency, run less frequently.

## Be worse than production

A fake that faithfully reproduces production behavior is useful, but a fake that is **worse** than production is powerful. Consider MariaDB Galera Cluster: the documentation claims transaction isolation "between Serializable and Repeatable Read." [Jepsen tested a healthy cluster with zero injected faults](https://jepsen.io/analyses/mariadb-galera-cluster-12.1.2) and found lost committed transactions, lost updates, and stale reads. The actual isolation appeared **weaker than Read Uncommitted**.

Most code handles loud failures: errors, timeouts, connection resets. The dangerous failures are **silent**. A write that reports success but vanishes. A read that returns stale data. An operation that simply never comes back. No error to catch. Your code thinks everything is fine.

Take the `FakeUserRepository` from earlier and make it lie:

```rust
impl UserRepository for ChaosUserRepository {
    async fn save(&self, user: User) -> Result<(), StorageError> {
        // Loud failure: connection lost
        if self.rng.next_f32() < 0.1 {
            return Err(StorageError::ConnectionLost);
        }

        // Silent failure: lost committed transaction
        if self.rng.next_f32() < 0.1 {
            return Ok(());
        }

        // Silent failure: hangs forever
        if self.rng.next_f32() < 0.05 {
            std::future::pending().await
        }

        self.stale.insert(user.id, self.store.get(&user.id).cloned());
        self.store.insert(user.id, user);
        Ok(())
    }

    async fn find_by_id(&self, id: u64) -> Result<Option<User>, StorageError> {
        // Silent failure: stale read
        if self.rng.next_f32() < 0.2 {
            return Ok(self.stale.get(&id).cloned().flatten());
        }

        Ok(self.store.get(&id).cloned())
    }
}
```

This fake does not just return errors. It silently drops writes, returns stale data, and sometimes never responds at all. Every one of these failure modes exists in production. If your code detects and handles them, it survives the real thing.

So fakes are more powerful than Testcontainers, and cranking up their hostility makes them even more effective. But is this a fringe idea?

## You are not alone

This is not a niche technique. AWS has used interface-swapped simulation for [15+ years](https://www.usenix.org/conference/nsdi20/presentation/brooker) to test distributed consensus, with typical correctness tests executing in under 100 milliseconds. Google's [Fauxmaster](https://research.google/pubs/large-scale-cluster-management-at-google-with-borg/) runs real scheduler code against simulated workers replaying production data. Microsoft's [CrystalNet](https://www.microsoft.com/en-us/research/publication/crystalnet-faithfully-emulating-large-production-networks/) found **50+ bugs** using virtualized network hardware, catching **69%** of Azure network outage categories. [Oxide Computer](https://github.com/oxidecomputer/omicron) uses trait-based fakes across 500,000+ lines of Rust with a mock framework in exactly one place. The pattern scales from startups to hyperscalers.

Start with one fake. Replace one mock with a stateful, injectable implementation of the same trait. Every fake you write is a step toward [simulation](/posts/simulation-driven-development/).

---

Feel free to reach out with any questions or to share your experiences with fakes and simulation. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

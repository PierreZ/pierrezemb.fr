+++
title = "Notes about cell-based architecture"
description = "Cell-based architecture as the middle ground between one dense cluster and one cluster per customer, and why moving data is the core capability."
date = 2026-10-14
path = "posts/notes-about-cell-based-architecture"
draft = true
[taxonomies]
tags = ["distributed-systems", "notes", "foundationdb", "software-engineering"]
+++

<!-- Sources: Well-Architected whitepaper (Oliveira, Sep 2023)
https://docs.aws.amazon.com/pdfs/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.pdf
ARC338 (Vosshall, re:Invent 2018) https://www.youtube.com/watch?v=swQbA4zub20 -->

<!-- 0. Intro: the dilemma -->

## The deployment layout of a distributed system

When you are working with multi-tenant systems, there is one recurring decision that everyone needs to make: how are you going to densify? Are you going to have a single, almighty distributed cluster to hold everything, or are you going to create a cluster per usage?

```
 one dense cluster           one cluster per usage

   A   B   C   D               A      B      C      D
   |   |   |   |               |      |      |      |
 +----------------+          +---+  +---+  +---+  +---+
 |    cluster     |          | 1 |  | 2 |  | 3 |  | 4 |
 +----------------+          +---+  +---+  +---+  +---+
 1 cluster to operate        4 clusters to operate
 failure hits A,B,C,D        failure hits 1 usage
```

Big clusters have a big impact when they fail, but they are efficient in terms of SRE time and infrastructure cost. One cluster per usage is expensive, but the blast radius of a failure is minimal. Can we have something in the middle? This is what cell-based design is all about, and the [AWS whitepaper on the topic](https://docs.aws.amazon.com/pdfs/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.pdf) asks a pretty interesting question:

> "Is it better for 100% of customers to experience a 5% failure rate, or 5% of customers to experience a 100% failure rate?"

## Cell overall design

The main idea is to design your system so that customers have a single entry point, but internally, they are routed to different backends, called cells:

```
               clients
                  |
           +-------------+  map   +---------------+
           | thin router | <----- | control plane |
           +-------------+        +---------------+
            /     |     \
      +------+ +------+ +------+
      |cell 1| |cell 2| |cell 3|
      +------+ +------+ +------+
```

A **cell** is a complete copy of your workload that shares no state with the others. The **thin router** only sends each request to the right cell based on a **partition key**, like the customer ID, and the **control plane** provisions cells and migrates customers between them. Load and blast radius are divided by the number of cells, except at the router, and it does not have to mean more infrastructure: 30 hosts can stay 30 hosts, grouped behind a router.

When cells hold data, the design comes down to spreading data and moving it.


## The partition key

To spread customers across cells, you need a key to shard on, and the first candidate in a multi-tenant system is the tenant:

```
           +-------------+
           | thin router |
           +-------------+
            /     |     \
      +------+ +------+ +------+
      |cell 1| |cell 2| |cell 3|
      | A, D | | B, E | | C, F |
      +------+ +------+ +------+
```

But that means a tenant can never outgrow the capacity of its cell. S3 has a better key, the bucket, so the partition key becomes (tenant, bucket) and a large tenant can spread its buckets over several cells. Whatever the key, the router must find it cheaply in every request, as a parameter or a direct transformation of one, otherwise the router stops being thin.

### Routing and assigning the partition key

The naive transformation way will be to hash the partition key, and then assign it to a cell, like this with 3 cells:

| Tenant | hash(key) | hash mod 3 | Cell (mod + 1) |
|---|---|---|---|
| A | 17 | 2 | `Cell(3)` |
| B | 22 | 1 | `Cell(2)` |
| C | 27 | 0 | `Cell(1)` |
| D | 40 | 1 | `Cell(2)` |
| E | 53 | 2 | `Cell(3)` |
| F | 68 | 2 | `Cell(3)` |

The problem is that adding a cell means that we need to move a lot of tenants on day one:

| Tenant | hash(key) | hash mod 4 | Cell (mod + 1) |
|---|---|---|---|
| A | 17 | 1 | `Moving(From(Cell(3)), To(Cell(2)))` |
| B | 22 | 2 | `Moving(From(Cell(2)), To(Cell(3)))` |
| C | 27 | 3 | `Moving(From(Cell(1)), To(Cell(4)))` |
| D | 40 | 0 | `Moving(From(Cell(2)), To(Cell(1)))` |
| E | 53 | 1 | `Moving(From(Cell(3)), To(Cell(2)))` |
| F | 68 | 0 | `Moving(From(Cell(3)), To(Cell(1)))` |

One better way is to use a fixed bucket count:

| Tenant | hash(key) | hash mod 12 | Bucket |
|---|---|---|---|
| A | 17 | 5 | `Bucket(5)` |
| B | 22 | 10 | `Bucket(10)` |
| C | 27 | 3 | `Bucket(3)` |
| D | 40 | 4 | `Bucket(4)` |
| E | 53 | 5 | `Bucket(5)` |
| F | 68 | 8 | `Bucket(8)` |

The 12 buckets are for readability. The whitepaper gives an order of magnitude, not a recommendation:

> "A general use of consistent hash in cell mapping is a system that is configured with a fixed large number (for example, tens of thousands) of logical buckets which are explicitly mapped to much smaller number of physical cells."

For a public number in that range, [Redis Cluster](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/) splits its key space into 16384 hash slots.

Then assign buckets to cells:

| Bucket | State | Tenants |
|---|---|---|
| `Bucket(0)` | `Assigned(Cell(1))` | |
| `Bucket(1)` | `Assigned(Cell(1))` | |
| `Bucket(2)` | `Assigned(Cell(1))` | |
| `Bucket(3)` | `Assigned(Cell(1))` | C |
| `Bucket(4)` | `Assigned(Cell(2))` | D |
| `Bucket(5)` | `Assigned(Cell(2))` | A, E |
| `Bucket(6)` | `Assigned(Cell(2))` | |
| `Bucket(7)` | `Assigned(Cell(2))` | |
| `Bucket(8)` | `Assigned(Cell(3))` | F |
| `Bucket(9)` | `Assigned(Cell(3))` | |
| `Bucket(10)` | `Assigned(Cell(3))` | B |
| `Bucket(11)` | `Assigned(Cell(3))` | |

Like this, adding a new cell is easy:

| Bucket | State | Tenants |
|---|---|---|
| `Bucket(3)` | `Moving(From(Cell(1)), To(Cell(4)))` | C |
| `Bucket(7)` | `Moving(From(Cell(2)), To(Cell(4)))` | |
| `Bucket(11)` | `Moving(From(Cell(3)), To(Cell(4)))` | |
| all others | unchanged | |

The hash step never changes, so the bucket is a stable identity for a tenant, and adding or removing a cell only touches the second table. The bucket count is the grain of a move: with 12 buckets the smallest move is a twelfth of the data, with tens of thousands it is a tiny slice, which is why the whitepaper's number is that large. A new tenant needs no write at all, its hash lands in a bucket that already points to a cell, so the control plane is not on the path of the first request. The whitepaper's other option, a full map with one row per tenant, has to be written before that first request and grows with the number of tenants, which is a lot of state to load in every router.

We still need to have some override tables for testing/quarantine/heavy tenants, which give us something like this:

| Tenant | State | Reason |
|---|---|---|
| A | `Assigned(Cell(5))` | heavy tenant, gets a dedicated cell, E stays in `Bucket(5)` |
| internal-* | `Assigned(Cell(4))` | testing, internal tenants land on the newest cell first |
| G | `Assigned(Cell(6))` | quarantine, poison pills |

The router checks the override table first, then falls back to the bucket table:

| Tenant | Route |
|---|---|
| A | `Override(Cell(5))` |
| B | `Bucket(10)` |
| C | `Bucket(3)` |
| D | `Bucket(4)` |
| E | `Bucket(5)` |
| F | `Bucket(8)` |
| G | `Override(Cell(6))` |

Then the bucket table, as it stands after the fourth cell:

| Bucket | State |
|---|---|
| `Bucket(0)` | `Assigned(Cell(1))` |
| `Bucket(1)` | `Assigned(Cell(1))` |
| `Bucket(2)` | `Assigned(Cell(1))` |
| `Bucket(3)` | `Assigned(Cell(4))` |
| `Bucket(4)` | `Assigned(Cell(2))` |
| `Bucket(5)` | `Assigned(Cell(2))` |
| `Bucket(6)` | `Assigned(Cell(2))` |
| `Bucket(7)` | `Assigned(Cell(4))` |
| `Bucket(8)` | `Assigned(Cell(3))` |
| `Bucket(9)` | `Assigned(Cell(3))` |
| `Bucket(10)` | `Assigned(Cell(3))` |
| `Bucket(11)` | `Assigned(Cell(4))` |

The directory stays small: the bucket table has a fixed number of rows whatever the number of tenants, and the override table only holds the exceptions. It fits in the memory of every router and can be published as a single document. Moving a tenant, or a whole bucket, is one row going from `Assigned` to `Moving` and back to `Assigned`, and the control plane flips it once the data has moved.

## Sizing and shaping cells

<!-- Purpose: a cell has a known ceiling and a chosen shape, both decisions get revised, so the section ends on moving. FDB appears only as hints that the dials exist. -->

Size:

- Three forces (whitepaper): "Big enough to fit the largest workloads", "Small enough to test at full scale", "Big enough to gain economies of scale benefits". They cannot all hold at once, so the first size is a guess
- "Small enough to test at full scale" is the FDB ethos: one cluster is something you can simulate and load test to failure, a dense cluster of everything is not
- Express the limit in business terms, the whitepaper's questions: "How many transactions per second can a cell handle?", "How many GB of transfer per second or stored capacity does it support?"
- FDB hint: the ceiling is documented before you measure anything. [Known limitations](https://apple.github.io/foundationdb/known-limitations.html): "performance testing and tuning with clusters of up to 500 cores/processes", "tested with databases up to 100 TB". A full cell is a known event, not a surprise
- Whitepaper: "the cell size you initially set isn't ideal". The first size will be wrong
- The table below is the intro's dilemma one level down: smaller versus larger cells is one dense cluster versus one cluster per usage again. Keep it only with that framing

| Smaller cells | Larger cells |
|---|---|
| More cells to manage | Fewer cells to manage |
| An outage touches a small share | An outage touches a large share |
| Less likely to hit quotas and unknown limits | More likely to hit them |
| Easier and cheaper to test at max size | Fewer customer splits across cells |
| Less idle capacity | Better utilization and economies of scale |

Shape:

- Cells do not have to be the same size, or even the same shape. A cell variant is a canary on real data, blast radius capped at 1/N. Whitepaper: "the first cell deployed to in a phased cell deployment can be a canary cell"
- The alternative everyone has: an integration cluster nobody keeps up to date, fake data, fake load
- FDB hints, all per-cluster [configuration](https://apple.github.io/foundationdb/configuration.html): redundancy mode (double for a cheap cell, three_data_hall or three_datacenter for low-volume data that must survive anything), hardware (NVMe-dense cells for storage-heavy tenants, cheaper disks for cheap tenants), storage engine (ssd versus redwood), major version (one cell on the new major, compare its behavior with a same-shape cell on the old one)
- Who lands in the variant: the override table from the routing section, internal tenants first
- Nuance: every shape has its own ceiling, so limits are measured per shape. Every variant is one more thing to operate, upgrade and test. Real data means real customers on the canary
- Scope note (whitepaper): "Cells were not intended to mitigate dependency failures or single points of failure. Therefore, they were not designed as failover domains." A resilient shape is DR inside one cell, not a property of the cell architecture

<!-- Transition: a wrong size and a wrong shape are fixed the same way, by moving tenants -->

- → A wrong size and a wrong shape both get fixed the same way: by moving tenants

## Moving data is the core capability

<!-- Purpose: the thesis section. Every revision of the layout is a move, so the move is the primitive to build first, and it applies to the directory and the control plane too. Order: operations, stuck extremes, whitepaper support, mechanism, evidence, directory and control plane. -->

- Callback to the design section, said once there: when cells hold data, the design comes down to spreading data and moving it
- Every operation becomes a move: rebalancing, evacuating a failing cell, isolating a noisy tenant, outgrowing a cell, undoing a shape experiment, and adopting cells in the first place (cell zero, next section)
- Without moves, a layout gets stuck at one extreme of the intro's dilemma: a full cell gets densified, or each new big customer gets its own cell
- Whitepaper support, its own words: "For data and state heavy workloads, the problem of allocation becomes a core competency." Among the placement inputs: "The cost of moving a partition key between cells." And: "Stateful cell-based architectures will almost certainly require online cell migration to adjust placement when cells are added or removed."
- Whitepaper, when to move: "when a customer or partitioned key starts to dominate a cell, you need to migrate some tenants or customers to other cells". Best practice: "Start with a cell migration mechanism from day one"
- Mechanism: clone, flip, redirect, forget (whitepaper). ARC338 live-migration analogy: build an invisible clone in the target, sync while the source keeps changing, freeze briefly for the final sync, flip atomically, coordinated at the router
- In the bucket tables above, a move is one row going from Assigned to Moving and back to Assigned, and redirect is publishing the new version of the directory
- Evidence: OVHcloud HBase, regions moved inside one cluster, nothing ever moved a tenant out of it (to confirm). The dense-cluster extreme, lived

```
            old cell          new cell
 clone      authoritative     copy, catching up
 flip       copy              authoritative
 redirect                     <- router sends traffic
 forget     deleted
```

Directory and control plane:

- If everything must move, so does the directory. Pinning it to one cell creates the one cell you can never drain or retire
- Static stability is what makes it possible: routers hold the whole published map in memory and keep serving on the last known map. Whitepaper: "Even if the control plane, Amazon S3 or a zone is unavailable, the router is still able to direct traffic to the cells." So the directory's home is off the request path
- The mapping choice decides how big the directory is: the bucket table is B rows, the override table is the exceptions, both small enough to move. A full map is not
- Depending on what you store, the whole control plane state is a tenant: tenant registry, capacity per cell, moves in flight, overrides, all small key-value data. A general-purpose store like FDB can host its own control plane as one more tenant. A specialized cell (blobs, time series) cannot, and then you need the whitepaper's separate store, its S3 bucket or DynamoDB table
- The recursion: the thing that places tenants is placed like a tenant, and moves itself with the same four steps
- Bootstrap: a router needs the map to find the map's cell. The publish location (object storage, config) is the seed, and routers never read the control-plane tenant on the request path
- Nuance: the other way to avoid a cell you can never retire is a directory that can be rebuilt from the cells, each cell knowing its own tenants. The claim to make is narrower than "never pin": the directory must not be the one thing you cannot recreate elsewhere. Moving it or rebuilding it both satisfy that
- The router stays the one thing you cannot split. Whitepaper: "thinnest possible layer", and "all the recommendations described so far and later must also be followed for the cell router"

```
 pinned directory           movable directory
 +----------------+         routers: map in memory
 | pinned cell    |                ^ refresh
 |  directory     |         control plane state is a tenant:
 |  + tenants     |         lives in any cell,
 +----------------+         moves like one
 a pinned cell can never be
 drained or retired
```

## Operating many cells

<!-- Purpose: short landing. Adoption is the first move, operations must respect the boundaries, end on the question. -->

- "Your current instance/stack is your cell zero" (whitepaper): adopt cells by putting a router in front of what you have. The first migration out of it is your first move, so the move exists before the second cell does
- The rest of the whitepaper's practices in one sentence: automation from day one because cells "can grow to tens, hundreds or more cells", deploy in waves with the canary cell first and automated rollback, cell-aware observability where every request is traceable to its cell
- 2017 S3 outage (ARC338 Q&A): an engineer who knew the philosophy still made a command-line mistake. Isolation only helps if operations respect it, hence "never touch more than one zone at a time" and automated operational tooling
- Closing question to the reader: can you move every piece of your system, including the part that knows where everything is?

<!-- To check before publishing:
- HBase numbers: 2M/6M writes/reads (2025 review) vs 2.5M/6.5M (AGENTS.md)
- FDB limits: not public, describe without numbers or use public FDB limits
- The HBase "nothing moved a tenant" claim
- S3 (tenant, bucket) partition key: not in the whitepaper, which only says "CustomerID plus a second dimension", find a source
- External links resolve: Redis cluster spec, FDB known-limitations and configuration pages
-->

---

Feel free to reach out with any questions or to share your experiences with cell-based architecture. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

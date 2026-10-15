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

The router then has to turn a key into a cell. A full map of every key is flexible, but it grows with the number of tenants, and a new tenant must be written to it before its first request. Hashing the key into a fixed number of buckets, tens of thousands in the whitepaper, and mapping only buckets to cells keeps the map small and lets a new key route without any write. An override table on top forces specific keys into specific cells, for testing, quarantine, or heavy tenants.


## Sizing and shaping cells

- Three forces: big enough for the largest workload, small enough to load test to failure, big enough for economies of scale
- Express the limit in business terms: TPS or GB stored per cell
- FDB: the limits are known (storage size, TPS), so a full cluster is a known event, not a surprise
- "Your first cell size will be wrong" (whitepaper)

| Smaller cells | Larger cells |
|---|---|
| More cells to manage | Fewer cells to manage |
| An outage touches a small share | An outage touches a large share |
| Less likely to hit quotas and unknown limits | More likely to hit them |
| Easier and cheaper to test at max size | Fewer customer splits across cells |
| Less idle capacity | Better utilization and economies of scale |

- Cells do not have to be the same size, or even the same shape
- A cell can differ on purpose: replication, storage engine, version, hardware
- A canary on real data, with blast radius capped at 1/N
- The alternative: an integration cluster nobody keeps up to date, fake data, fake load
- FDB, public terms only: redundancy mode and storage engine are per-cluster configuration
- The override table decides who lands in the experimental cell, internal tenants first
- Whitepaper: "The first cell can act as a canary cell"
- Nuance: real data means real customers, and every variant you keep must be operated and tested
- → A wrong size and a cell variant both get fixed the same way: by moving tenants

## Moving data is the core capability

- Cell design is about spreading data and moving it
- Clone, flip, redirect, forget (whitepaper), live-migration analogy (ARC338)
- "Build cell migration from day one" (whitepaper)
- Every operation becomes a move: rebalancing, evacuating a failing cell, isolating a noisy tenant, outgrowing a cell, undoing an experiment
- Without moves, a layout gets stuck at one extreme: a full cell gets densified, or each new big customer gets its own cell
- OVHcloud HBase: regions moved inside one cluster, nothing moved a tenant out of it (to confirm)

```
            old cell          new cell
 clone      authoritative     copy, catching up
 flip       copy              authoritative
 redirect                     <- router sends traffic
 forget     deleted
```

- If everything must move, so does the directory: no cell zero
- The router is the one thing you cannot split: keep it thin, no business logic, constant work
- Dispatching is isolated per cell, so a slow cell does not starve the others
- Static stability: map in memory, the last known map keeps serving
- The directory has to live somewhere: pinning it to a "cell 0" goes against the design, so it must move like any tenant
- Whitepaper: "apply all the cell rules to the router itself"
- The mapping choice from the partition key section decides how big the directory is, so how easy it is to move

```
 pinned directory           movable directory
 +----------------+         routers: map in memory
 | cell 0         |                ^ refresh
 |  directory     |         directory is a tenant:
 |  + tenants     |         lives in any cell,
 +----------------+         moves like one
 cell 0 can never be
 drained or retired
```

## Operating many cells

- Automation from day one: "tooling is needed either way"
- Deploy in waves, canary cell first, automated rollback
- Cell-aware observability
- "Your current stack is cell zero": adopt cells by putting a router in front of what you have
- 2017 S3 command-line mistake: isolation only helps if operations respect it
- Closing question to the reader: can you move every piece of your system, including the part that knows where everything is?

<!-- To check before publishing:
- HBase numbers: 2M/6M writes/reads (2025 review) vs 2.5M/6.5M (AGENTS.md)
- Exact whitepaper wording of every quote, against the PDF
- FDB limits: not public, describe without numbers or use public FDB limits
- The HBase "nothing moved a tenant" claim
- S3 (tenant, bucket) partition key: not in the whitepaper, which only says "CustomerID plus a second dimension", find a source
-->

---

Feel free to reach out with any questions or to share your experiences with cell-based architecture. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

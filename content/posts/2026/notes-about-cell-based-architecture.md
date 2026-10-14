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

- Notes About series meta-intro
- The recurring choice: densify into one big cluster, or run an army of clusters (infra cash, SREs)
- Cells sit in the middle of both extremes
- The two AWS sources: whitepaper (Oliveira, September 2023) and ARC338 (Vosshall, re:Invent 2018)
- One sentence and a link: cells are compartmentalization at fleet scope ([compartmentalization post](/posts/foundationdb-architecture-through-compartmentalization/))
- Scope: cells that hold data, not stateless cells

```
 dense             cells              sprawl
 1 cluster         N capped cells     1 cluster/customer
 |------------------|------------------|
 blast: 100%       blast: 1/N         blast: 1 customer
 cost: low         cost: per cell     cost: per customer
```

## The dense end: one big cluster

- What densifying buys: economies of scale, one system to tune
- OVHcloud HBase: 255 machines, tuned to its limit, custom balancer for servers holding 180 to 900 regions ([hbase-custom-data-balancing](/posts/hbase-custom-data-balancing/))
- The cost: when there is an incident or a noisy tenant, the blast radius is the whole platform
- ARC338 framing: blast radius as vocabulary, poison pills, COE question "How could you cut the blast radius for a similar event in half?"
- AWS's own dense failure (ARC338 Q&A): S3 2008, one NIC flipping one bit, S3 down
- → So why not split everything?

## The sprawl end: one cluster per customer

- What it buys: perfect isolation
- OVHcloud etcd: "three etcd nodes per customer is not a valid approach at scale", shared clusters hitting their ceiling ([2025 year in review](/posts/2025-year-in-review/), [KubeCon talk](https://www.youtube.com/watch?v=IrJyrGQ_R9c))
- The cost: fixed cost per cluster (ARC338), plus the whitepaper's downsides (complexity, cost, tooling, a routing layer)
- → AWS sits in between

## Cells: one entry point, many backends

- Definition: one entry point and many backends, so load and blast radius are divided by N, except at the routing layer
- ARC338: a zonal service is "an entry point plus a routing layer over isolated compartments"
- Vocabulary: cell, thin router, control plane, partition key
- Cells do not have to multiply infrastructure: "30 hosts can stay 30 hosts"
- Whitepaper question: "Is it better for 100% of customers to see a 5% failure rate, or for 5% of customers to see a 100% failure rate?"
- Scope line: [Slack's cells](https://slack.engineering/slacks-migration-to-a-cellular-architecture/) are AZs you drain traffic away from, this post is about cells that hold data
- → The design comes down to spreading data and moving it

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

## The partition key

- The most important decision, made first
- Cut with the grain: the natural split with minimal cross-cell interactions
- The key must be easy to get from most API calls
- Calls against the grain go through the router, never cell to cell
- Mapping: a fixed set of buckets plus a bucket-to-cell table, and always an override table
- FDB angle: a transaction cannot span clusters, so the grain is the largest set of data that must commit together
- → The key decides who lands together, the size decides how many fit

```
 key = (customer, object)
         |
 hash(key) % 16384  ->  bucket 4242
         |
 in override table? --yes--> cell 7
         | no
 bucket table: 4242 -> cell 2
```

## Sizing the cell

- Three forces: big enough for the largest workload, small enough to load test to failure, big enough for economies of scale
- Express the limit in business terms: TPS or GB stored per cell
- FDB: the limits are known (storage size, TPS), so a full cluster is a known event, not a surprise
- "Your first cell size will be wrong" (whitepaper)
- → Cells do not have to be the same size, or even the same shape

| Smaller cells | Larger cells |
|---|---|
| More cells to manage | Fewer cells to manage |
| An outage touches a small share | An outage touches a large share |
| Less likely to hit quotas and unknown limits | More likely to hit them |
| Easier and cheaper to test at max size | Fewer customer splits across cells |
| Less idle capacity | Better utilization and economies of scale |

## Not every cell has to look the same

- A cell can differ on purpose: replication, storage engine, version, hardware
- A canary on real data, with blast radius capped at 1/N
- The alternative: an integration cluster nobody keeps up to date, fake data, fake load
- FDB, public terms only: redundancy mode and storage engine are per-cluster configuration
- The override table decides who lands in the experimental cell, internal tenants first
- Whitepaper: "The first cell can act as a canary cell"
- Nuance: real data means real customers, and every variant you keep must be operated and tested
- → Even with the right size and shape, one customer may still not fit

## What if a customer is bigger than your cell?

- The question, with a hypothetical: a cell holds 10 PB, a customer needs 100 PB
- S3-style answer: the grain is the object, not the customer, so split below the customer with a composite key
- The cost moves to customer-wide operations: scatter-gather, batches, coordinated writes (ARC338's three cross-cell cases)
- Real case, [Unified Grid](https://slack.engineering/unified-grid-how-we-re-architected-slack-for-our-largest-customers/): one shard per workspace, customers outgrew it, messages re-sharded by channel ID
- The rule underneath: the grain is the consistency boundary, not the customer
- When the consistency boundary is bigger than a cell: bigger cells (toward dense), dedicated cells (sprawl limited to outliers), or a second key dimension
- → Every answer requires moving data

```
 cell = 10 PB, customer X = 100 PB

 grain = customer      grain = object
 +-----------+         +----+ +----+     +-----+
 | X: 100 PB |  --->   | X1 | | X2 | ... | X10 |
 +-----------+         +----+ +----+     +-----+
 does not fit          fits, but LIST, quotas and
                       bucket delete go cross-cell
```

```
 customer bigger than a cell?
   |
   +-- can its data split into independent units?
         |
         +-- yes: composite key, pay in cross-cell ops
         |
         +-- no:  bigger cells     (toward dense)
                  dedicated cells  (toward sprawl)
```

## Moving data is the core capability

- Cell design is about spreading data and moving it
- Clone, flip, redirect, forget (whitepaper), live-migration analogy (ARC338)
- "Build cell migration from day one" (whitepaper)
- Every operation becomes a move: rebalancing, evacuating a failing cell, isolating a noisy tenant, outgrowing a cell, undoing an experiment
- Without moves, a layout gets stuck at one extreme: a full cell gets densified, or each new big customer gets its own cell
- OVHcloud HBase: regions moved inside one cluster, nothing moved a tenant out of it (to confirm)
- → If everything must move, so does the directory

```
            old cell          new cell
 clone      authoritative     copy, catching up
 flip       copy              authoritative
 redirect                     <- router sends traffic
 forget     deleted
```

## No cell zero

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
-->

---

Feel free to reach out with any questions or to share your experiences with cell-based architecture. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

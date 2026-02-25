+++
title = "Building Index-Backed Query Plans in DataFusion"
description = "What I learned about manually constructing physical query plans for secondary index queries, and the library that came out of it."
date = 2026-02-25
[taxonomies]
tags = ["rust", "datafusion", "sql", "query-engine", "databases", "distributed-systems"]
+++

When you build a system on top of a key-value store like FoundationDB, you eventually need secondary indexes. You create them, you maintain them, and then one day you need to query them. Not just scan a single index, but combine results from multiple indexes: intersect them for AND conditions, union them for OR conditions, and fetch the actual records at the end. That's a query engine's job. I didn't want to write a query engine. But I had to learn how one thinks.

[Last year](/posts/thank-you-datafusion/), I wrote about integrating DataFusion and mentioned a PoC library for index-backed queries. That PoC has grown into [`datafusion-index-provider`](https://github.com/datafusion-contrib/datafusion-index-provider), a real library in `datafusion-contrib` running in production. Building it meant learning how to construct physical query plans by hand, assembling them from existing DataFusion operators instead of writing execution logic from scratch.

## The PostgreSQL Pattern

Every database with secondary indexes follows the same two-phase pattern. Take `SELECT * FROM employees WHERE age > 30`. PostgreSQL doesn't scan every row. It walks the B-tree index on `age`, collecting **TIDs** (tuple identifiers) pointing to matching rows. Then it fetches the actual data using those TIDs. **Find where, then fetch what.**

For multi-index queries like `WHERE age < 25 OR department = 'Sales'`, PostgreSQL uses **BitmapIndexScan**: each index produces a bitmap of matching TIDs, bitmaps get combined (OR for union, AND for intersection), and one pass fetches the results. No duplicates, no wasted reads.

This is the pattern I wanted to bring to DataFusion. But DataFusion's existing index support (ParquetAccessPlan, zone maps) works at **planning time** on **row groups**. What I needed was OLTP-style indexes that resolve at **execution time** and produce **specific row identifiers**. The DataFusion community has [discussed both approaches](https://github.com/apache/datafusion/discussions/9963#discussioncomment-6464175). `datafusion-index-provider` implements the OLTP path.

## Primary Keys as the Universal Glue

In PostgreSQL, TIDs connect everything. In my system, that role falls to the **primary key schema**. Every index declares an `index_schema()` defining the columns that form the row's primary key. Could be a single `id` column, could be a composite `(tenant_id, employee_id)`. Every index scan produces batches of these primary key columns, every join operates on them, every record fetch consumes them. Because every operator in the pipeline agrees on what a "row identifier" looks like, you can wire up standard DataFusion joins, unions, and aggregations without any custom glue.

## From Filters to Execution Plans

The library first converts SQL filters into an intermediate `IndexFilter` enum: `Single` (one index handles one filter), `And` (intersection), or `Or` (union). Then it recursively builds the physical plan from that intermediate representation.

The library introduces only two custom `ExecutionPlan` nodes: `IndexScanExec` (which wraps your index) and `RecordFetchExec` (which wraps your storage). No custom join logic, no custom dedup, no custom union. Everything in between is standard DataFusion operators wired together.

### Single Index

```sql
SELECT * FROM employees WHERE age > 29
```

The simplest case needs just these two custom nodes wired together. `IndexScanExec` calls `index.scan(filters, limit)` and streams primary key batches. `RecordFetchExec` consumes those batches and calls a `RecordFetcher` to look up complete records.

{% mermaid() %}
flowchart BT
    A[IndexScanExec] --> B[RecordFetchExec]
{% end %}

### AND: Intersection Through Joins

```sql
SELECT * FROM employees WHERE age > 25 AND department = 'Engineering'
```

Both conditions must hold. Each index produces a separate stream of primary keys, and we need their intersection: only keys that appear in both streams. How do you compute an intersection of two streams? That's exactly what an **INNER JOIN** does when both sides share the same key columns.

{% mermaid() %}
flowchart BT
    A[IndexScanExec<br/>age index] --> C[HashJoinExec<br/>INNER on PK columns]
    B[IndexScanExec<br/>department index] --> C
    C --> P[ProjectionExec<br/>PK columns]
    P --> D[RecordFetchExec]
{% end %}

DataFusion ships two join implementations that we can pick from. **HashJoinExec** works in two phases: it reads the entire left (build) side into memory, constructs a hash table keyed on the join columns, then streams the right (probe) side through, looking up each row's key in that table. Matches produce output rows. Memory cost is proportional to the build side, but the probe side streams through with no buffering. The library uses `PartitionMode::CollectLeft`, which collects the left input into a single partition before building the hash table.

**SortMergeJoinExec** takes a different approach. When both inputs are already sorted on the join keys, it walks both streams in lockstep, comparing keys as it goes. When keys match, it buffers rows sharing that key value and outputs all combinations. For unique primary keys (the common case with index scans), this means constant memory: one row buffered from each side at a time. No hash table, no bulk memory allocation, just two cursors advancing together.

How does the library choose? If both indexes report sorted output via `is_ordered()`, it picks SortMergeJoin. Otherwise, HashJoin. For ordered key-value stores like FoundationDB, indexes naturally return sorted keys, so SortMergeJoin is the common path in practice.

There's a wrinkle after the join. An inner join on column `id` from both sides produces output with columns `(id_left, id_right)`, but downstream operators expect just `(id)`. A `ProjectionExec` after the join strips the duplicates back to the primary key schema. This matters because when three or more indexes are involved, the library builds a **left-deep join tree**: join the first two, project back to the primary key schema, then join that result with the third, and so on. Each join progressively narrows the result set, and the projection keeps the schema clean between steps.

### OR: Union with Deduplication

```sql
SELECT * FROM employees WHERE age < 25 OR department = 'Sales'
```

A row matches if either condition is true, but a row satisfying both should appear exactly once. The plan needs to combine both index results and deduplicate before fetching.

{% mermaid() %}
flowchart BT
    A[IndexScanExec<br/>age index] --> C[UnionExec]
    B[IndexScanExec<br/>department index] --> C
    C --> D[AggregateExec<br/>GROUP BY PK columns]
    D --> E[RecordFetchExec]
{% end %}

Each index scan feeds into DataFusion's `UnionExec`, which concatenates streams with zero-copy partition pass-through. But a row matching both conditions appears twice, once from each index. The deduplication step uses DataFusion's `AggregateExec` with a `GROUP BY` on all primary key columns. AggregateExec maintains a hash table mapping group key values to group indices. For pure dedup (no aggregate functions, just GROUP BY), it's essentially a hash set of seen primary keys. When memory pressure exceeds limits, it spills groups to disk in Arrow IPC format and merges them back later.

Why not write a custom dedup node? Because `AggregateExec` already handles hash-based grouping, memory tracking against DataFusion's memory pool, and spill-to-disk. Writing a custom dedup operator would mean reimplementing all of that. The library's philosophy is to construct a query plan that DataFusion already knows how to execute, not to reinvent execution primitives.

### Combining AND and OR

```sql
SELECT * FROM employees
WHERE (age > 30 AND department = 'Engineering')
   OR (age < 25 AND department = 'Sales')
```

The `IndexFilter` tree for this query is an `Or` of two `And` branches. Each `And` branch becomes a join subtree (two IndexScanExec nodes joined on primary key columns), and the two subtrees feed into a UnionExec + AggregateExec for deduplication, just like a simple OR.

{% mermaid() %}
flowchart BT
    A1[IndexScanExec<br/>age > 30] --> J1[HashJoinExec<br/>INNER on PK]
    B1[IndexScanExec<br/>dept = Engineering] --> J1
    J1 --> P1[ProjectionExec]
    A2[IndexScanExec<br/>age < 25] --> J2[HashJoinExec<br/>INNER on PK]
    B2[IndexScanExec<br/>dept = Sales] --> J2
    J2 --> P2[ProjectionExec]
    P1 --> U[UnionExec]
    P2 --> U
    U --> AG[AggregateExec<br/>GROUP BY PK columns]
    AG --> RF[RecordFetchExec]
{% end %}

Joins for AND and union + dedup for OR compose naturally into nested plans. The library doesn't need special handling for nested expressions. It recurses down the `IndexFilter` tree, builds the appropriate subtree for each node, and DataFusion executes the whole thing as one pipeline.

## Limitations and What's Next

The filter analysis has one important simplification: if any part of an AND/OR expression can't be handled by an index, the entire expression falls back to a regular scan. Consider `WHERE age > 30 AND color = 'blue'` with an index on `age` but not `color`. A smarter approach would use the age index then scan-filter for color, but mixing index-backed and scan-based execution paths complicates plan construction, especially when AND/OR expressions are nested. For v1, the clean boundary keeps things correct. Partial index usage is on the roadmap, along with **projection pushdown** into the fetch phase and **multi-partition execution** for parallelism. Each is an opportunity for [contribution](https://github.com/datafusion-contrib/datafusion-index-provider).

## Try It

If you're building a system that needs secondary index queries over your own storage, give [`datafusion-index-provider`](https://github.com/datafusion-contrib/datafusion-index-provider) a try. The [tests directory](https://github.com/datafusion-contrib/datafusion-index-provider/tree/main/tests/common) has reference implementations for both single-column and composite primary keys.

This library only works because DataFusion's architecture is genuinely composable. Special thanks to **Andrew Lamb**, whose work on DataFusion and the [architecture paper](https://github.com/apache/datafusion/issues/6782) has been instrumental. HashJoinExec, SortMergeJoinExec, AggregateExec, UnionExec, ProjectionExec: all ready to be wired up into whatever query plan your system needs. Do you have a custom storage layer that could benefit from secondary index queries?

---

Feel free to reach out with any questions or to share your experiences with DataFusion. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

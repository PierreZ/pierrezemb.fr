+++
title = "Bypassing FoundationDB's Transaction Limits with Record Layer Continuations"
description = "A technical deep-dive into FoundationDB Record Layer continuations, explaining how they enable long-running operations by segmenting work across multiple FDB transactions, effectively bypassing the inherent 5-second and 10MB limits."
draft = false
date = 2025-06-03T00:30:00+02:00
[taxonomies]
tags = ["foundationdb", "record-layer", "java", "database", "continuation", "pagination", "distributed-systems" ]
+++

## Introducing the FoundationDB Record Layer

Before we dive into the specifics of handling large operations with continuations (the main topic of this post), let's briefly introduce the [**FoundationDB Record Layer**](https://foundationdb.github.io/fdb-record-layer/index.html). It's a powerful open-source library built atop FoundationDB that brings a structured, record-oriented data model to FDB's highly scalable key-value store. Think of it as adding schema management, rich indexing capabilities, and a sophisticated query engine, making it easier to build complex applications.

The Record Layer is versatile and has been adopted for demanding use-cases, most notably by Apple as the core of CloudKit, powering services for millions of users. It allows developers to define their data models using Protocol Buffers and then query them in a flexible manner.

For instance, you can express queries like finding all 'Order' records for roses costing less than $50 with a declarative API (example in Java):

```java
RecordQuery query = RecordQuery.newBuilder()
        .setRecordType("Order")
        .setFilter(Query.and(
                Query.field("price").lessThan(50),
                Query.field("flower").matches(Query.field("type").equalsValue(FlowerType.ROSE.name()))))
        .build();
```

To get started and explore its capabilities further, the official [Getting Started Guide](https://foundationdb.github.io/fdb-record-layer/GettingStarted.html) is an excellent resource. You can also watch these talks for a deeper understanding:
*   [Using FoundationDB and the FDB Record Layer to Build CloudKit - Scott Gray, Apple](https://www.youtube.com/watch?v=SvoUHHM9IKU)
*   [FoundationDB Record Layer: Open Source Structured Storage on FoundationDB - Nicholas Schiefer, Apple](https://www.youtube.com/watch?v=HLE8chgw6LI)

> For a detailed academic perspective on its design and how CloudKit uses it, refer to the [SIGMOD'19 paper: FoundationDB Record Layer: A Multi-Tenant Structured Datastore](https://www.foundationdb.org/files/record-layer-paper.pdf).

## The Challenge: FDB's Transaction Constraints

FoundationDB (FDB) imposes strict constraints on its transactions: they must complete within 5 seconds and are limited to 10MB of manipulated data, either writes or reads. These constraints are fundamental to FDB's design, ensuring high performance and serializable isolation. However, they pose a significant challenge for operations that inherently require processing large datasets or executing complex queries that cannot complete within these tight boundaries, such as full table scans, large analytical queries, or bulk data exports.

The **FoundationDB Record Layer** addresses this challenge through a mechanism known as **continuations**. Continuations allow a single logical operation to be broken down into a sequence of smaller, independent FDB transactions. Each transaction processes a segment of the total workload and, if more work remains, yields a **continuation token**. This opaque token encapsulates the state required to resume the operation precisely where the previous transaction left off.

This article delves into the technical details of Record Layer continuations, exploring how they function and how to leverage them effectively to build robust, scalable applications on FDB.

## Bridging Transactions: The Role of Continuations

Consider a query to retrieve all records matching a specific filter from a large dataset. Executing this as a single FDB transaction would likely violate the 5-second or 10MB limit. The Record Layer employs continuations to serialize this operation across multiple transactions:

1.  **Initial Request:** The application initiates a query against the Record Layer.
2.  **Segmented Execution:** The Record Layer's query planner executes the query, but with built-in scan limiters. It processes records until a predefined limit (e.g., row count, time duration, or byte size) is approached, or it nears FDB's intrinsic transaction limits.
3.  **State Serialization:** Before the current FDB transaction commits, if the logical operation is incomplete, the Record Layer serializes the execution state of the query plan into a continuation token.
4.  **Partial Result & Token:** The application receives the processed segment of data and the continuation token. The FDB transaction for this segment commits successfully.
5.  **Resumption:** To fetch the next segment, the application submits a new request, providing the previously received continuation token.
6.  **State Deserialization & Continued Execution:** The Record Layer deserializes the token, restores the query plan's state, and resumes execution from the exact point it paused. This typically involves adjusting scan boundaries (e.g., starting a key-range scan from the key after the last one processed).

This cycle repeats until the entire logical operation is complete. The continuation token acts as the critical link, enabling a series of short, FDB-compliant transactions to collectively achieve the effect of a single, long-running operation without violating FDB's core constraints.

## Dissecting the Continuation Token

While the continuation token is **opaque** to the application (it's a `byte[]` that should not be introspected or modified), it internally contains structured information vital for resuming query execution. The exact format is an implementation detail of the Record Layer and can evolve, but conceptually, it must capture:

*   **Scan Boundaries:** The key (or keys, for multi-dimensional indexes) where the next scan segment should begin. This ensures no data is missed or re-processed unnecessarily.
*   **Query Plan State:** For complex query plans involving joins, filters, aggregations, or in-memory sorting, the token may need to store intermediate state specific to those operators. For instance, a `UnionPlan` or `IntersectionPlan` might need to remember which child plan was active and its respective continuation.
*   **Scan Limiter State:** Information about accumulated counts or sizes if the scan was paused due to application-defined limits rather than FDB limits.
*   **Version Information:** To ensure compatibility if the token format changes across Record Layer versions.

The opacity of the token is a deliberate design choice. It decouples the application from the internal mechanics of the Record Layer, allowing the latter to evolve its continuation strategies (e.g., for efficiency or new features) without breaking client applications. The application's responsibility is solely to store and return this token verbatim.

## Resuming Query Execution via Continuations

When a continuation token is provided to a `RecordCursor` (the Record Layer's abstraction for iterating over query results), the underlying `RecordQueryPlan` uses it to reconstruct its state.

1.  **Plan Identification:** The token typically identifies the specific query plan or sub-plan it pertains to.
2.  **State Restoration:** Each operator in the query plan (e.g., `IndexScanPlan`, `FilterPlan`, `SortPlan`) that can be stateful across transaction boundaries implements logic to initialize itself from the continuation. For an `IndexScanPlan`, this primarily means setting the `ScanComparisons` for the next range read. For a `UnionPlan`, it might mean restoring the continuation for one of its child plans and indicating which child to resume.
3.  **Execution Resumption:** Once the plan's state is restored, the `RecordCursor` can proceed to fetch the next batch of records. The execution effectively "jumps" to the point encoded in the continuation.

This mechanism allows the Record Layer to transparently manage the complexities of distributed, stateful iteration over potentially vast datasets, all while adhering to FDB's transactional model.

## Implications of Non-Atomicity

It's important to understand a key implication of this multi-transaction approach: while each individual FDB transaction executed as part of a continued operation is atomic and isolated (typically providing serializable isolation), the overall logical operation spanning multiple continuations is **not atomic** in the same way. Mutations to the data by other concurrent transactions can occur *between* the FDB transactions of a continued scan. As a result, a long-running operation that uses continuations doesn't see the entire dataset at a single, frozen moment in time. Instead, it might see some data that was present or changed *after* the operation began but *before* it completed. This is a natural consequence of breaking the work into smaller pieces to fit within FDB's transaction limits. Applications should be aware of this behavior, particularly if they need all the data to reflect its state from one specific instant.

## Conclusion

The Record Layer's continuation feature is a powerful tool for handling large datasets and complex queries in FoundationDB, but it's important to understand the implications of non-atomicity. By breaking operations into smaller, FDB-compliant transactions, the Record Layer provides a flexible and scalable solution while maintaining the core principles of FDB's transactional model.

---

Feel free to reach out with any questions or to share your thoughts. You can find me on [Bluesky](https://bsky.app/profile/pierrezemb.fr), [Twitter](https://twitter.com/PierreZ) or through my [website](https://pierrezemb.fr).
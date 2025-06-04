+++
title = "Thank You, DataFusion: Queries in Rust, Without the Pain"
date = 2025-06-04
[taxonomies]
tags = ["rust", "datafusion", "sql", "query-engine", "databases"]
+++

## That “YATA!” Moment, Rebooted

We just merged at work our first successful data retrieval using [DataFusion](https://github.com/apache/datafusion) — a real SQL query, over real data, flowing through a system we built. And I’ll be honest: I haven’t had a “YATA!” moment like this in years. This wasn't just a feature shipped; it felt like unlocking a new superpower for our entire system, a complex vision finally materializing.

Not a silent nod. Not “huh, that works.” A *real*, physical, joyful reaction. The kind that makes you want to run a lap around the office (or, in my remote-first case, the living room).

Because plugging a query engine into your software isn’t supposed to feel this smooth. It's usually a battle. But this one did. This one felt like an invitation.

## You Don’t Just Add a Query Engine

Adding a query engine to a codebase isn’t something you do lightly. It’s a foundational piece of infrastructure, the kind of decision that usually ends in regret, or at least a *lot* of rewriting. Most engines assume they own the world: they want to dictate your storage, your execution model, your schema, your optimizer, often forcing you to contort your application around their idiosyncrasies. It's a path often paved with impedance mismatches, performance bottlenecks, and the haunting feeling that you’ve just bolted an opinionated, unyielding black box onto your carefully crafted system.

But then there’s DataFusion. A SQL engine written in Rust, and — against all odds — one you can actually *use*. Drop-in? Not quite. But close enough to be kind of magical, offering a set of powerful, composable tools rather than a rigid framework.

## I’ve Been Watching From Day One

I’ve been following DataFusion since it was a weekend project. I still remember the early blog posts, the prototypes, the potential. And more importantly, I read [Andy Grove’s book *How Query Engines Work*](https://andygrove.io/how-query-engines-work/). That book unlocked it for me.

It demystified concepts like logical plans, physical plans, and execution trees — enough to give me the confidence to experiment. I first played with Apache Calcite, then circled back to DataFusion. Eventually, I contributed a small example: a custom `TableProvider`, [added to DataFusion in this issue](https://github.com/apache/datafusion/issues/1864) to demonstrate how to integrate custom datasources.

And then... it only took me **three years** to actually write the code that *used* it. Why so long? Well, let's just say a gazillion other things, the never-ending sagas of on-call, and a [brief-but-eventful detour into management](/posts/back-engineering) kept my dance card impressively full. But hey, it still felt amazing when it finally clicked.

More recently, I was genuinely happy to see that **Andrew Lamb** co-authored an [academic paper describing DataFusion’s architecture](https://github.com/apache/datafusion/issues/6782). There’s something really validating about seeing a project you’ve followed for years get formalized in research — it’s a sign that the internals are solid and the ideas are worth sharing. And they are.

That moment was big. Because here was a Rust-native query engine where I could plug in *my own data*, and get *real queries* back. No layers of JVM glue, no corroded abstractions. Just composable, hackable Rust.

## Modular, Composable, Respectful

What I love about DataFusion is that it doesn’t try to control your application. It’s a query engine that knows it’s a library — not a database.

It lets you:

- Plug in your own data sources  
- Register logical tables dynamically  
- Push down filters, projections, even partitions  
- Swap in or extend physical execution nodes  
- Keep your own runtime, threading, and lifecycle  

And all that without feeling like you’re stepping into “internal” code. It’s all open, cleanly layered, and welcoming.

## My Goal: Join Indexes Without Going Insane

From the beginning, my goal was never to just scan data — it was to **query it properly**, with indexes, joins, and all the things a real engine should do. I never had any intention of writing a join execution engine myself. That’s not the kind of wheel I want to reinvent.

It's no secret that at work, we're building a system on top of FoundationDB that draws inspiration from Apple's [FDB Record Layer](https://foundationdb.github.io/fdb-record-layer/) (you can learn more about its concepts in [this talk](https://www.youtube.com/watch?v=SvoUHHM9IKU)). We offer [a similar programmatic API for constructing queries](https://foundationdb.github.io/fdb-record-layer/GettingStarted.html), which naturally leads to similar requirements. For example, developers need to express sophisticated data retrieval logic, much like this FDB Record Layer example for querying orders:

```java
RecordQuery query = RecordQuery.newBuilder()
        .setRecordType("Order")
        .setFilter(Query.and(
                Query.field("price").lessThan(50),
                Query.field("flower").matches(Query.field("type").equalsValue(FlowerType.ROSE.name()))))
        .build();
```
The challenge then becomes translating such programmatic queries into efficient, index-backed scans and, crucially, leveraging a robust engine for complex operations like joins—without rebuilding that engine from scratch.

What I wanted was the ability to:

- Fetch rows efficiently through custom index-backed scans  
- Join them using `HashJoinExec` or `MergeJoinExec`  
- Let the planner and execution engine figure out the hard parts

This vision is what spurred me to start working on [`datafusion-index-provider`](https://github.com/datafusion-contrib/datafusion-index-provider), a library hosted in the `datafusion-contrib` GitHub organization — part of the growing ecosystem around DataFusion. At the time of writing, I’ve built a PoC — you can find it [on this branch](https://github.com/PierreZ/datafusion-index-provider/tree/init-v2) — and I’m integrating it into our internal stack before opening a proper PR upstream.

The architecture makes it feel possible. The abstractions are ready. And I still don’t have to write a join engine. Victory.

## The Joy of Real Libraries

There’s a special joy in finding a library that *slots in* — that doesn’t just solve a problem, but fits the shape of your system. DataFusion was that for me.

It didn’t just let me query data; it gave me a better way to think about the data I already had, and how I wanted to work with it. Instead of manually stitching together filters and projections, I could describe my intent, and let the engine handle the rest.

What’s even more exciting is that this isn’t happening in a vacuum.

We’re seeing a quiet shift in how query engines are built and used. Projects like [DuckDB](https://duckdb.org/) have shown just how powerful it is to have **SQL as a library**, not a service. No server to deploy. No socket to connect to. Just an API, embedded right in your code.

DataFusion follows that same philosophy — Rust-native, embeddable, and unapologetically library-first.

## To the DataFusion Team: Thank You

To Andy Grove, to all the contributors, to everyone filing issues and refining abstractions: thank you. Your work is enabling a new generation of Rust systems to think like databases — without becoming one.

I don’t know if you realize how rare that is. I just know it changed what I thought was possible in my software.

And I’m having a lot more fun because of it.

---

Feel free to reach out with any questions or to share your experiences with DataFusion. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
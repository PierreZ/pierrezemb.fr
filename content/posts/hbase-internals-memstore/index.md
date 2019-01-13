---
title: "Under the hood: Hbase's memstore"
date: 2019-01-11T23:24:27+01:00
draft: true
showpagemeta: true
categories:
 - under the hood
tags:
 - hbase
 - under the hood
---



**All extract of code are taken from [rel/2.1.2](https://github.com/apache/hbase/tree/rel/2.1.2) tag.**

# What is the MemStore?

The `memtable` from the official [BigTable paper](https://research.google.com/archive/bigtable-osdi06.pdf) is the equivalent of the `MemStore` in Hbase.

## HBase write path

As rows are **sorted lexicographically** in Hbase, when data comes in, you need to have some kind of a **in-memory buffer** to order those keys. This is where the memstore comes in. It absorbs the recent write (or put in Hbase semantics) operations. All the rest are immutable files called `HFile` stored in HDFS.

There is one `MemStore` per `column family`. A region server can holds multiples regions, which itself have multiples `memstores`.

--- 

**Thank you** for reading my post! feel free to react to this article, I'm also available on [Twitter](https://twitter.com/PierreZ) if needed.
+++
title = "Diving into Hbase's MemStore"
date = "2019-11-17T10:24:27+01:00"
draft = false
[taxonomies]
tags = ["database", "storage", "distributed", "hbase", "performance", "diving-into"]
+++

![hbase image](/images/hbase-data-model/hbase.jpg)

[Diving Into](/tags/diving-into/) is a blogpost serie where we are digging a specific part of of the project's basecode. In this episode, we will digg into the implementation behind Hbase's MemStore.

---

`tl;dr:` Hbase is using the [ConcurrentSkipListMap](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ConcurrentSkipListMap.html).

## What is the MemStore?

> The `memtable` from the official [BigTable paper](https://research.google.com/archive/bigtable-osdi06.pdf) is the equivalent of the `MemStore` in Hbase.

As rows are **sorted lexicographically** in Hbase, when data comes in, you need to have some kind of a **in-memory buffer** to order those keys. This is where the `MemStore` comes in. It absorbs the recent write (or put in Hbase semantics) operations. All the rest are immutable files called `HFile` stored in HDFS. There is one `MemStore` per `column family`.

Let's dig into how the MemStore internally works in Hbase 1.X.

## Hbase 1

All extract of code for this section are taken from [rel/1.4.9](https://github.com/apache/hbase/tree/rel/1.4.9) tag.

### in-memory storage

The [MemStore interface](https://github.com/apache/hbase/blob/rel/1.4.9/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/MemStore.java#L35) is giving us insight on how it is working internally.

```java
  /**
   * Write an update
   * @param cell
   * @return approximate size of the passed cell.
   */
long add(final Cell cell);
```

-- [add function on the MemStore](https://github.com/apache/hbase/blob/rel/1.4.9/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/MemStore.java#L68-L73)

The implementation is hold by [DefaultMemStore](https://github.com/apache/hbase/blob/rel/1.4.9/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/DefaultMemStore.java). `add` is wrapped by several functions, but in the end, we are arriving here:

```java
  private boolean addToCellSet(Cell e) {
    boolean b = this.activeSection.getCellSkipListSet().add(e);
```

-- [addToCellSet on the DefaultMemStore](https://github.com/apache/hbase/blob/rel/1.4.9/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/DefaultMemStore.java#L202-L213)

[CellSkipListSet class](https://github.com/apache/hbase/blob/rel/1.4.9/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/CellSkipListSet.java#L33-L48) is built on top of [ConcurrentSkipListMap](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ConcurrentSkipListMap.html), which provide nice features:

* concurrency
* sorted elements

### Flush on HDFS

As we seen above, the `MemStore` is supporting all the puts. When asked to flush, the current memstore is **moved to snapshot and is cleared**. Flushed file are called ([HFiles](https://github.com/apache/hbase/blob/rel/2.1.2/hbase-server/src/main/java/org/apache/hadoop/hbase/io/hfile/HFile.java)) and they are similar to `SSTables` introduced by the official [BigTable paper](https://research.google.com/archive/bigtable-osdi06.pdf). HFiles are flushed on the Hadoop Distributed File System called `HDFS`.

> If you want deeper insight about SSTables, I recommend reading [Table Format from the awesome RocksDB wiki](https://github.com/facebook/rocksdb/wiki/Rocksdb-BlockBasedTable-Format)

### Compaction

Compaction are only run on HFiles. It means that **if hot data is continuously updated, we are overusing memory due to duplicate entries per row per MemStore**. Accordion tends to solve this problem through *in-memory compactions*. Let's have a look to Hbase 2.X!

## Hbase 2

### storing data

**All extract of code starting from here are taken from [rel/2.1.2](https://github.com/apache/hbase/tree/rel/2.1.2) tag.**

Does `MemStore` interface changed?

```java
  /**
   * Write an update
   * @param cell
   * @param memstoreSizing The delta in memstore size will be passed back via this.
   *        This will include both data size and heap overhead delta.
   */
  void add(final Cell cell, MemStoreSizing memstoreSizing);
```

-- [add function in MemStore interface](https://github.com/apache/hbase/blob/rel/2.1.2/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/MemStore.java#L67-L73)

The signature changed a bit, to include passing a object instead of returning a long. Moving on.

The new structure implementing MemStore is called [AbstractMemStore](https://github.com/apache/hbase/blob/rel/2.1.2/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/AbstractMemStore.java#L42). Again, we have some layers, where AbstractMemStore is writing to a `MutableSegment`, which itsef is wrapping `Segment`. If you dig far enough, you will find that data are stored into the [CellSet class](https://github.com/apache/hbase/blob/rel/2.1.2/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/CellSet.java#L35-L51) which is also things built on top of **ConcurrentSkipListMap**!

### in-memory Compactions

Hbase 2.0 introduces a big change to the original memstore called Accordion which is a codename for in-memory compactions. An awesome blogpost is available here: [Accordion: HBase Breathes with In-Memory Compaction](https://blogs.apache.org/hbase/entry/accordion-hbase-breathes-with-in) and the [document design](https://issues.apache.org/jira/secure/attachment/12709471/HBaseIn-MemoryMemstoreCompactionDesignDocument.pdf) is also available.

---

**Thank you** for reading my post! feel free to react to this article, I'm also available on [Twitter](https://twitter.com/PierreZ) if needed.

---
title: "Under the hood: Hbase's MemStore"
date: 2019-01-11T23:24:27+01:00
draft: true
showpagemeta: true
categories:
 - under the hood
tags:
 - hbase
 - under the hood
---

# What is the MemStore?

> The `memtable` from the official [BigTable paper](https://research.google.com/archive/bigtable-osdi06.pdf) is the equivalent of the `MemStore` in Hbase.

As rows are **sorted lexicographically** in Hbase, when data comes in, you need to have some kind of a **in-memory buffer** to order those keys. This is where the `MemStore` comes in. It absorbs the recent write (or put in Hbase semantics) operations. All the rest are immutable files called `HFile` stored in HDFS.

There is one `MemStore` per `column family`. A region server can holds multiples regions, which itself have multiples `memstores`.

# Hbase 1.X vs Hbase 2.X

Hbase 2.0 introduces a big change to the original memstore: in-memory compaction. The [document design](https://issues.apache.org/jira/secure/attachment/12709471/HBaseIn-MemoryMemstoreCompactionDesignDocument.pdf) for in-memory MemStore compaction is very well written, so let me quote it:

> A ​store ​unit holds a column family in a region, where the ​memstore ​is its in­memory component. The memstore absorbs all updates to the store; from time to time these updates are flushed to a file on disk, where they are compacted. **Unlike disk components, the memstore is not compacted until it is written to the filesystem and optionally to block­cache**. This may result in underutilization of the memory due to duplicate entries per row, for example, when hot data is continuously updated.

# Implementation design

We will go through the implementation on how data are stored in both versions of Hbase, then we will talk about compactions

## storing data

> tl;dr: both versions of Hbase are using something built on top of [ConcurrentSkipListMap](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ConcurrentSkipListMap.html).

###  Hbase 1.X.X
**All extract of code for this section are taken from [rel/1.4.9](https://github.com/apache/hbase/tree/rel/1.4.9) tag.**

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

The implementation is hold by [DefaultMemStore](https://github.com/apache/hbase/blob/rel/1.4.9/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/DefaultMemStore.java). add is wrapped by several functions, but in the end, we are arriving here:


```java
  private boolean addToCellSet(Cell e) {
    boolean b = this.activeSection.getCellSkipListSet().add(e);
    // In no tags case this NoTagsKeyValue.getTagsLength() is a cheap call.
    // When we use ACL CP or Visibility CP which deals with Tags during
    // mutation, the TagRewriteCell.getTagsLength() is a cheaper call. We do not
    // parse the byte[] to identify the tags length.
    if(e.getTagsLength() > 0) {
      tagsPresent = true;
    }
    setOldestEditTimeToNow();
    return b;
  }
```
-- [addToCellSet on the DefaultMemStore](https://github.com/apache/hbase/blob/rel/1.4.9/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/DefaultMemStore.java#L202-L213)

Let's have a look at `CellSkipListSet`:

```java
/**
 * A {@link java.util.Set} of {@link Cell}s implemented on top of a
 * {@link java.util.concurrent.ConcurrentSkipListMap}.  Works like a
 * {@link java.util.concurrent.ConcurrentSkipListSet} in all but one regard:
 * An add will overwrite if already an entry for the added key.  In other words,
 * where CSLS does "Adds the specified element to this set if it is not already
 * present.", this implementation "Adds the specified element to this set EVEN
 * if it is already present overwriting what was there previous".  The call to
 * add returns true if no value in the backing map or false if there was an
 * entry with same key (though value may be different).
 * <p>Otherwise,
 * has same attributes as ConcurrentSkipListSet: e.g. tolerant of concurrent
 * get and set and won't throw ConcurrentModificationException when iterating.
 */
@InterfaceAudience.Private
public class CellSkipListSet implements NavigableSet<Cell> {
```
-- [CellSkipListSet class](https://github.com/apache/hbase/blob/rel/1.4.9/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/CellSkipListSet.java#L33-L48) 

[ConcurrentSkipListSet<E>](https://docs.oracle.com/javase/7/docs/api/java/util/concurrent/ConcurrentSkipListSet.html) has very interesting features:

> A scalable concurrent NavigableSet implementation based on a [ConcurrentSkipListMap](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ConcurrentSkipListMap.html). The elements of the set are kept sorted according to their natural ordering, or by a Comparator provided at set creation time, depending on which constructor is used. 



###  Hbase 2.X.X

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

The signature changed a bit, to include passing a object instead of returning a long. Moving on. Accordion, the name of the in-memory feature, introduces a new MemStore called [CompactingMemStore](https://github.com/apache/hbase/blob/rel/2.1.2/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/CompactingMemStore.java), let's have a look!

```java
/**
 * A memstore implementation which supports in-memory compaction.
 * A compaction pipeline is added between the active set and the snapshot data structures;
 * it consists of a list of segments that are subject to compaction.
 * Like the snapshot, all pipeline segments are read-only; updates only affect the active set.
 * To ensure this property we take advantage of the existing blocking mechanism -- the active set
 * is pushed to the pipeline while holding the region's updatesLock in exclusive mode.
 * Periodically, a compaction is applied in the background to all pipeline segments resulting
 * in a single read-only component. The ``old'' segments are discarded when no scanner is reading
 * them.
 */
@InterfaceAudience.Private
public class CompactingMemStore extends AbstractMemStore {
```
-- [CompactionMemStore class](https://github.com/apache/hbase/blob/rel/2.1.2/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/CompactingMemStore.java#L43-L55)

CompactionMemStore is not implementing MemStore, but maybe AbstractMemStore?

```java
  @Override
  public void add(Cell cell, MemStoreSizing memstoreSizing) {
    Cell toAdd = maybeCloneWithAllocator(cell, false);
    boolean mslabUsed = (toAdd != cell);
    // This cell data is backed by the same byte[] where we read request in RPC(See HBASE-15180). By
    // default MSLAB is ON and we might have copied cell to MSLAB area. If not we must do below deep
    // copy. Or else we will keep referring to the bigger chunk of memory and prevent it from
    // getting GCed.
    // Copy to MSLAB would not have happened if
    // 1. MSLAB is turned OFF. See "hbase.hregion.memstore.mslab.enabled"
    // 2. When the size of the cell is bigger than the max size supported by MSLAB. See
    // "hbase.hregion.memstore.mslab.max.allocation". This defaults to 256 KB
    // 3. When cells are from Append/Increment operation.
    if (!mslabUsed) {
      toAdd = deepCopyIfNeeded(toAdd);
    }
    internalAdd(toAdd, mslabUsed, memstoreSizing);
  }
```
-- [add function in AbstractMemStore class](https://github.com/apache/hbase/blob/rel/2.1.2/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/AbstractMemStore.java#L116-L133)

Gotcha, here goes our beloved `internalAdd`!


```java
  /*
   * Internal version of add() that doesn't clone Cells with the
   * allocator, and doesn't take the lock.
   *
   * Callers should ensure they already have the read lock taken
   * @param toAdd the cell to add
   * @param mslabUsed whether using MSLAB
   * @param memstoreSize
   */
  private void internalAdd(final Cell toAdd, final boolean mslabUsed, MemStoreSizing memstoreSizing) {
    active.add(toAdd, mslabUsed, memstoreSizing);
    setOldestEditTimeToNow();
    checkActiveSize();
  }
```
-- [internalAdd function in AbstractMemStore class](https://github.com/apache/hbase/blob/rel/2.1.2/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/AbstractMemStore.java#L295-308)

active is an `MutableSegment`, which itsef is wrapping `Segment`. Let's skip some layers and go to internalAdd function in `Segment` directly:

```java
  protected void internalAdd(Cell cell, boolean mslabUsed, MemStoreSizing memstoreSizing) {
    boolean succ = getCellSet().add(cell);
    updateMetaInfo(cell, succ, mslabUsed, memstoreSizing);
  }
```
-- [internalAdd function in Segment class](https://github.com/apache/hbase/blob/rel/2.1.2/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/Segment.java#L291-L294)

Finally here we are! getCellSet is an CellSet:

```java
/**
 * A {@link java.util.Set} of {@link Cell}s, where an add will overwrite the entry if already
 * exists in the set.  The call to add returns true if no value in the backing map or false if
 * there was an entry with same key (though value may be different).
 * implementation is tolerant of concurrent get and set and won't throw
 * ConcurrentModificationException when iterating.
 */
@InterfaceAudience.Private
public class CellSet implements NavigableSet<Cell>  {

  public static final int UNKNOWN_NUM_UNIQUES = -1;
  // Implemented on top of a {@link java.util.concurrent.ConcurrentSkipListMap}
  // Differ from CSLS in one respect, where CSLS does "Adds the specified element to this set if it
  // is not already present.", this implementation "Adds the specified element to this set EVEN
  // if it is already present overwriting what was there previous".
  // Otherwise, has same attributes as ConcurrentSkipListSet
  private final NavigableMap<Cell, Cell> delegatee; ///
```
-- [CellSet class](https://github.com/apache/hbase/blob/rel/2.1.2/hbase-server/src/main/java/org/apache/hadoop/hbase/regionserver/CellSet.java#L35-L51)

We just found another things built on top of **ConcurrentSkipListMap**!

## Compactions

--- 

**Thank you** for reading my post! feel free to react to this article, I'm also available on [Twitter](https://twitter.com/PierreZ) if needed.
---
title: Playing with TTL in HBase
date: 2019-05-27T22:07:11+02:00
draft: false
tags:
 - distributed-systems
 - hbase
---

<header class="row text-center header">
   <img src="/posts/hbase-data-model/images/hbase.jpg" alt="HBase Image" class="text-center"> 
</header>

Among all features provided by HBase, there is one that is pretty handy to deal with your data's lifecyle: the fact that every cell version can have **Time to Live** or TTL. Let's dive into the feature!

# Time To Live (TTL)

Let's read the doc first!

> ColumnFamilies can set a TTL length in seconds, and **HBase will automatically delete rows once the expiration time is reached**.

[HBase Book: Time To Live (TTL)](https://hbase.apache.org/book.html#ttl)

Let's play with it! You can easily start an standalone HBase by following [the HBase Book](https://hbase.apache.org/book.html#quickstart). Once your standalone cluster is started, we can get started:

```bash
./bin/hbase shell

hbase(main):001:0> create 'test_table', {'NAME' => 'cf1','TTL' => 30} # 30 sec
```

Now that our test_table is created, we can `put` some data on it:

```bash
hbase(main):002:0> put 'test_table','row123','cf1:desc', 'TTL Demo'
```

And you can `get` it with:

```bash
hbase(main):003:0> get 'test_table','row123','cf1:desc'
COLUMN                             CELL
 cf1:desc                          timestamp=1558366581134, value=TTL Demo
1 row(s) in 0.0080 seconds
```

Here's our row! But if you wait a bit, it will **disappear** thanks to the TTL:

```bash
hbase(main):004:0> get 'test_table','row123','cf1:desc'
COLUMN                             CELL
0 row(s) in 0.0220 seconds
```

It has been filtered from the result, but the data is still here.  You can trigger a **raw** scan to check:

```bash
hbase(main):002:0> scan 'test_table', {RAW => true}
ROW                                COLUMN+CELL
 row123                            column=cf1:desc, timestamp=1558366581134, value=TTL Demo
1 row(s) in 0.3280 seconds
```

It will be removed only when a **major-compaction** will occur. As we are playing, we can:

* force the memstore to be **flushed as HFiles**
* force the **compaction**:

<div class="bs-callout bs-callout-info">
You may have heard about <b><a target="_blank" href="https://blogs.apache.org/hbase/entry/accordion-hbase-breathes-with-in">Accordion</a></b>, the new feature in HBase 2. If you are playing with HBase 2, you can enable it by following <a target="_blank" href="https://hbase.apache.org/book.html#inmemory_compaction">this link</a> and run <b>compactions directly in the MemStores.</b>
</div>


```bash
hbase(main):014:0> flush 'test_table'
Took 0.4456 seconds    
hbase(main):015:0> compact 'test_table'
Took 0.0468 seconds
# wait a bit
hbase(main):016:0> scan 'test_table', {RAW => true}
ROW                            COLUMN+CELL
0 row(s)
Took 0.0060 seconds
```

# How does it works?

As always, the truth is held by the documentation:

> A {row, column, version} tuple exactly specifies a cell in HBase. It’s possible to have an unbounded number of cells where the row and column are the same but the cell address differs only in its version dimension.

> While rows and column keys are expressed as bytes, **the version is specified using a long integer**. Typically **this long contains time instances** such as those returned by java.util.Date.getTime() or **System.currentTimeMillis()**, 

[HBase Book: Versions](https://hbase.apache.org/book.html#versions)

You may have seen it during our scan earlier, there is a **timestamp associated** with the version of the cell:

```bash
hbase(main):003:0> get 'test_table','row123','cf1:desc'
COLUMN                             CELL
 cf1:desc                          timestamp=1558366581134, value=TTL Demo
 #                           here  ^^^^^^^^^^^^^^^^^^^^^^^ 
```

Hbase used the `System.currentTimeMillis()` at ingest time to add it. During scanner and compaction, as time went by, **there was more than TTL seconds between the cell version and now, so the row was discarded**.

Now the real question is: **can you set it by yourself and be real Time-Lord** (of HBase)?

The reponse is *yes!* There is also a bit of a warning a bit [below:](https://hbase.apache.org/book.html#_explicit_version_example)

> *Caution:* the version timestamp is used internally by HBase for things like **time-to-live calculations**. It’s usually best to avoid setting this timestamp yourself. Prefer using a separate timestamp attribute of the row, or have the timestamp as a part of the row key, or both.

Let's try it:

```bash
date +%s -d "+2 min"
1558472441  # don't forget to add 3 zeroes as the time need to be in millisecond!

./bin/hbase shell
hbase(main):001:0> put 'test_table','row1234','cf1:desc', 'timestamp Demo', 1558472441000  
hbase(main):044:0> scan 'test_table'
ROW                            COLUMN+CELL
 row1234                       column=cf1:desc, timestamp=1558473315, value=timestamp Demo
1 row(s)
Took 0.0031 seconds
```

Notice that we are using a timestamp at the end of the `put` method? This will **add the desired timestamp to the version**. Which means that **your application can control when your version will be removed, even with a TTL on your column-qualifier.** You just need to compute a timestamp like this: 

> `ts = now - ttlCF + desiredTTL`.

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.

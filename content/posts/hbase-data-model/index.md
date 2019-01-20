---
title: "Hbase data model"
date: 2019-01-11T23:24:27+01:00
draft: true
showpagemeta: true
categories:
 - distributed-systems
tags:
 - hbase
---

# HBase?

![hbase image](/posts/hbase-data-model/images/hbase.png)

> [Apache HBase™](https://hbase.apache.org/) is a type of "NoSQL" database. "NoSQL" is a general term meaning that the database isn’t an RDBMS which supports SQL as its primary access language. Technically speaking, HBase is really more a "Data Store" than "Data Base" because it lacks many of the features you find in an RDBMS, such as typed columns, secondary indexes, triggers, and advanced query languages, etc.

-- [Hbase architecture overview](https://hbase.apache.org/book.html#arch.overview.nosql)

# Hbase data model

The data model is simple: it's like a multi-dimensional map:

* Elements are stored as **rows** in a **table**. 
* Each table has only **one index, the row key**. There are no secondary indices.
* Rows are **sorted lexicographically by row key**.
* A range of rows is called a **region**. It is similar to a shard.
* A row in HBase consists of a **row key** and **one or more columns**, which are holding the cells.
* Values are stored into what we call a **cell** and are versioned with a timestamp.
* A column is divided between a **Column Family** and a **Column Qualifier**. Long story short, a Column Family is kind of like a column in classic SQL, and a qualifier is a sub-structure inside a Colum family. A column Family is **static**, you need to create at creation, whereas Column Qualifiers can be created on the fly.

Not as easy as you thought? Here's an example! Let's say that we're trying to **save the whole internet**. To do this, we need to store the content of each pages, and versioned it. We can use **the page addres as the row key**, and store the contents in a **column called "Contents"**. Nowadays, website **contents can be anything**, from a HTML file to a binary such as a PDF. To handle that, we can create as many **qualifiers** as we want, such as "content:html" or "content:video". 

```json
{
  "fr.pierrezemb.www": {          // Row key
    "contents": {                 // Column family
      "content:html": {	          // Column qualifier
        "2017-01-01":             // A timestamp
          "<html>...",            // The actual value
        "2016-01-01":             // Another timestamp
          "<html>..."             // Another cell
      },
      "content:pdf": {            // Another Column qualifier
        "2015-01-01": "<pdf>..."  // my website may only contained a pdf in 2015
      }
    }
  }
}
```

# Key design

Hbase is most efficient at queries when we're getting a **single row key**, or during **row range**, ie. getting a block of contiguous data because keys are **sorted lexicographically by row key**. For example, my website `fr.pierrezemb.www` and `org.pierrezemb.www` would not be "near".


 As such, the **key design** is really important:

*  If your data are too spread, you will have poor performance.
* If your data are too much collocate, you will also have poor performance.

As stated by the official [documentation](https://hbase.apache.org/book.html#rowkey.design):

> Hotspotting occurs when a **large amount of client traffic is directed at one node, or only a few nodes, of a cluster**. This traffic may represent reads, writes, or other operations. The traffic overwhelms the single machine responsible for hosting that region, causing performance degradation and potentially leading to region unavailability.

As you may have guessed, this is why we are using the **reverse adress name** in my example, because `www` is too generic, we would have hotspot the poor region holding data for `www`.

If you are curious about Hbase schema, you should have a look on [Designing Your BigTable Schema](https://cloud.google.com/bigtable/docs/schema-design), as BigTable is the proprietary version of Hbase.

# Be warned

I have been working with Hbase for the past three years, **including operation and on-call duty.** It is a really nice data store, but it diverges from classical RDBMS. Here's some warnings extracted from the well-written documentation:

> HBase is really more a "Data Store" than "Data Base" because it lacks many of the features you find in an RDBMS, such as typed columns, secondary indexes, triggers, and advanced query languages, etc. However, HBase has many features which supports both linear and modular scaling.

-- [NoSQL?](https://hbase.apache.org/book.html#arch.overview.nosql)

> If you have hundreds of millions or billions of rows, then HBase is a good candidate. If you only have a few thousand/million rows, then using a traditional RDBMS might be a better choice due to the fact that all of your data might wind up on a single node (or two) and the rest of the cluster may be sitting idle.

-- [When Should I Use HBase?](https://hbase.apache.org/book.html#arch.overview.when)

--- 

**Thank you** for reading my post! feel free to react to this article, I'm also available on [Twitter](https://twitter.com/PierreZ) if needed.
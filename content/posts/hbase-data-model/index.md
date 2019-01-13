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
* Rows are **sorted lexicographically by row key**
* A row in HBase consists of a **row key** and **one or more columns**, which are holding the cells.
* Values are stored into what we call a **cell** and are versioned with a timestamp.
* A column is divided between a **Column Family** and a **Column Qualifier**. Long story short, a Column Family is kind of like a column in classic SQL, and a qualifier is a sub-structure inside a Colum family. A column Family is **static**, you need to create at creation, whereas Column Qualifiers can be created on the fly.

Not as easy as you thought? Here's an example! Let's say that we're trying to **save the whole internet**. To do this, we need to store the content of each pages, and versioned it. We can use **the page addres as the row key**, and and store the contents in a **column called "Contents"**. **Contents can be anything**, from a HTML file to a binary such as a PDF, so we can create as many **qualifiers** as we want, such as "content:html" or "content:css". 

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

Hbase is most efficient at queries when we're getting a **single row key**, or during **row range**, ie. getting a block of contiguous data. Other types of queries **trigger a full table scan**, which is much less efficient.

Of course, there's always a devil in the details. The devil is that the schema for your data—the columns and the row-key structure—must **be designed carefully**. A good schema results in **excellent performance and scalability**, and a bad schema can lead to a poorly performing system. You may have noticed that the key above **is in reverse**. 

As you may have guessed, we are using the **reverse adress name**, because `www` is too generic to be used as the beginning of the row key, to better ventilate the keys on different servers.

--- 

**Thank you** for reading my post! feel free to react to this article, I'm also available on [Twitter](https://twitter.com/PierreZ) if needed.
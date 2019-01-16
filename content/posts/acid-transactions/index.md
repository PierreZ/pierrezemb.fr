---
title: "What are ACID transactions?"
date: 2019-01-10T23:24:27+01:00
draft: true
showpagemeta: true
categories:
 - distributed-systems
tags:
 - transaction
---

# Transaction?

                "Programming should be about transforming data"
                    Programming Elixir 1.3 by Dave Thomas

As developers, we are interacting oftenly with data, whenever handling it from an API or a messaging consumer. To store it, we started to create softwares called **relational database management system** or [RDBMS](https://en.wikipedia.org/wiki/Relational_database_management_system). Thanks to them, we, as developers, can develop applications pretty easily, **without the need to implement our own storage solution**. Interacting with [mySQL](https://www.mysql.com/) or [PostgreSQL](https://www.postgresql.org/) have now become a **commodity**. Handling a database is not that easy though, because anything can happen, from failures to concurrency isssues:

* How can we interact with **datastores that can fail?**
* What is happening if two users are  **updating a value at the same time?**

 As a database user, we are using `transactions` to answer these questions. It is an **abstraction** that we are using to **hide underlying problems**, such as concurrency or hardware faults.

`ACID` appears in a paper published in 1983 called ["Principles of transaction-oriented database recovery"](https://sites.fas.harvard.edu/~cs265/papers/haerder-1983.pdf) written by *Theo Haerder* and *Andreas Reuter*. This paper introduce a terminology of properties for a transaction:

> **A**tomic, **C**onsistency, **I**solation, **D**urability

## Atomic

Atomic, as you may have guessed, `atomic` represents something that **cannot be splitted**. In the database transaction world, it means for example that if a transaction whith several writes is **started and failed** at some point, **none of the write will be committed**. As stated by many, the word `atomic` could be reword as `abortability`.

---
## Consistency

You will hear about `consistency` a lot of this serie. Unfortunately, this word can be used in a lot of context. In the ACID definition, it refers to the fact that a transaction will **bring the database from one valid state to another.**

---
## Isolation

Think back to your database. Were you the only user on it? I don't think so. Maybe they were concurrent transactions at the same time, beside yours. `isolation` simplify the access model to the database by virtually **isolate transactions from each other**, like they were done one after the other(this is also called **serially**).

**Isolation while keeping good performance is the most difficult item on the list.** There's a lot of litterature and papers about it, and we will only scratch the surface. There is different transaction isolation levels, depending on the number of guarantees provided.

### Lock-based Concurrency Control

**Lock-based Concurrency Control** are relying on locks: if one transaction uses some piece of data, a lock is set on this row, and is kept until the transaction succeeds or fails. The most known are:

* **Read Committed** will provide:
    * no [dirty reads](https://en.wikipedia.org/wiki/Isolation_(database_systems)#Dirty_reads)(you can see only commited data)
    * no [dirty writes]()(you can only overwrite data that has been commited)
    * But [non-repeatable read](https://en.wikipedia.org/wiki/Isolation_%28database_systems%29#Non-repeatable_reads)(when during the course of a transaction, a row is retrieved twice and the values within the row differ between reads) are possible.

* **Repeatable Reads** will provide:
    * [repeatable read](https://en.wikipedia.org/wiki/Isolation_%28database_systems%29#Non-repeatable_reads)
    * But [phantom reads](https://en.wikipedia.org/wiki/Isolation_(database_systems)#Phantom_reads)(reading of rows which were added by other transaction after this one was started) are possible.

Phantom reads are a real problem for batch queries. This is why most modern datastore are not using a Lock-based concurrency control, but Multi-Versioned Concurrency Control.

### Multi-Versioned Concurrency Control

**Multi-Versioned Concurrency Control** or **MVCC**, is relying on a different approach. Instead of locking that row for reading when somebody starts working on it, it ensures that **any transaction will see a version of the data that is corresponding to the start of the query**. We will cover it later, as MVCC deserves its own blogpost!

---

## Durability

`Durability` ensure that your database is a **safe place** where data can be stored without fear of losing it. If a transaction has commited successfully, any written data will not be forgotten.

# That's it?

**All these properties may seems obvious to you, but they are really not.** Each of the item is involving a lot of engineering and knowledge. Consistency and isolation for example deserve their own blogposts!

I look forward to dig into each properties on several databases!

---

**Thank you** for reading my post! feel free to react to this article, I'm also available on [Twitter](https://twitter.com/PierreZ) if needed.

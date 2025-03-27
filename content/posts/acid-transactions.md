+++
title = "What are ACID transactions?"
date = 2019-02-03
[taxonomies]
tags= ["database", "transactions", "sql", "storage"]
+++

# Transaction?

    "Programming should be about transforming data"

--- Programming Elixir 1.3 by Dave Thomas

---

As developers, we are interacting oftenly with data, whenever handling it from an API or a messaging consumer. To store it, we started to create softwares called **relational database management system** or [RDBMS](https://en.wikipedia.org/wiki/Relational_database_management_system). Thanks to them, we, as developers, can develop applications pretty easily, **without the need to implement our own storage solution**. Interacting with [mySQL](https://www.mysql.com/) or [PostgreSQL](https://www.postgresql.org/) have now become a **commodity**. Handling a database is not that easy though, because anything can happen, from failures to concurrency isssues:

* How can we interact with **datastores that can fail?**
* What is happening if two users are  **updating a value at the same time?**

 As a database user, we are using `transactions` to answer these questions. As a developer, a transaction is a **single unit of logic or work**, sometimes made up of multiple operations. It is mainly an **abstraction** that we are using to **hide underlying problems**, such as concurrency or hardware faults.

`ACID` appears in a paper published in 1983 called ["Principles of transaction-oriented database recovery"](https://sites.fas.harvard.edu/~cs265/papers/haerder-1983.pdf) written by *Theo Haerder* and *Andreas Reuter*. This paper introduce a terminology of properties for a transaction:

> **A**tomic, **C**onsistency, **I**solation, **D**urability

## Atomic

Atomic, as you may have guessed, `atomic` represents something that **cannot be splitted**. In the database transaction world, it means for example that if a transaction with several writes is **started and failed** at some point, **none of the write will be committed**. As stated by many, the word `atomic` could be reword as `abortability`.

---

## Consistency

You will hear about `consistency` a lot of this serie. Unfortunately, this word can be used in a lot of context. In the ACID definition, it refers to the fact that a transaction will **bring the database from one valid state to another.**

---

## Isolation

Think back to your database. Were you the only user on it? I don't think so. Maybe they were concurrent transactions at the same time, beside yours. **Isolation while keeping good performance is the most difficult item on the list.** There's a lot of litterature and papers about it, and we will only scratch the surface. There is different transaction isolation levels, depending on the number of guarantees provided.

### Isolation by the theory

The SQL standard defines four isolation levels: `Serializable`, `Repeatable Read`, `Read Commited` and `Read Uncommited`. The strongest isolation is `Serializable` where transaction are **not runned in parallel**. As you may have guessed, it is also the slowest. **Weaker isolation level are trading speed against anomalies** that can be sum-up like this:

| Isolation level  | [dirty reads](https://en.wikipedia.org/wiki/Isolation_(database_systems)#Dirty_reads) | [Non-repeatable reads](https://en.wikipedia.org/wiki/Isolation_%28database_systems%29#Non-repeatable_reads)  | [Phantom reads](https://en.wikipedia.org/wiki/Isolation_(database_systems)#Phantom_reads)  | Performance  |
|----------------- |----------- |-------------------- |-------------- |------------- |
| Serializable  | 😎  | 😎  | 😎  | 👍  |
| Repeatable Read  | 😎  | 😎  | 😱  | 👍👍   |
| Read Commited  | 😎  | 😱  | 😱  | 👍👍👍    |
| Read uncommited  | 😱  | 😱  | 😱  | 👍👍👍👍     |

> I encourage you to click on all the links within the table to **see everything that could go wrong in a weak database!**

### Isolation in Real Databases

Now that we saw some theory, let's have a look on a particular well-known database: PostgreSQL. What kind of isolation PostgreSQL is offering?

> PostgreSQL provides a rich set of tools for developers to manage concurrent access to data. Internally, data consistency is maintained by using a multiversion model (**Multiversion Concurrency Control, MVCC**).

--- [Concurrency Control introduction](https://www.postgresql.org/docs/current/mvcc-intro.html)

Wait what? What is MVCC? Well, turns out that after the SQL standards came another type of Isolation: **Snapshot Isolation**. Instead of locking that row for reading when somebody starts working on it, it ensures that **any transaction will see a version of the data that is corresponding to the start of the query**. As it is providing a good balance between **performance and consistency**, it became [a standard used by the industry](https://en.wikipedia.org/wiki/List_of_databases_using_MVCC).

---

## Durability

`Durability` ensure that your database is a **safe place** where data can be stored without fear of losing it. If a transaction has commited successfully, any written data will not be forgotten.

# That's it?

**All these properties may seems obvious to you** but each of the item is involving a lot of engineering and researchs. And this is only valid for a single machine, **the distributed transaction field** is even more complicated, but we will get to it in another blogpost!

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.

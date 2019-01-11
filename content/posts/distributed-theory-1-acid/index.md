---
title: "the Hitchhiker's Guide to Distributed Systems Theory - chapter 1: Did you say ACID?"
date: 2019-01-10T23:24:27+01:00
draft: true
showpagemeta: true
categories:
 - distributed-systems
tags:
 - hitchhikers-guide
---
<p align="center">
<a title="nclm [CC0 or OFL (http://scripts.sil.org/cms/scripts/page.php?item_id=OFL_web)], from Wikimedia Commons" href="https://commons.wikimedia.org/wiki/File:The_Hitchhiker%27s_Guide_to_the_Galaxy.svg"><img width="512" alt="The Hitchhiker&#039;s Guide to the Galaxy" src="/posts/distributed-theory-1-acid/images/dontpanic.png"/></a>
</p>

Getting started with distributed systems can be overwhelming. When trying to learn about them, the most common response to learn is something like

> *"you should really read the (BigTable|MapReduce|Paxos|MVCC) paper"*.

In practice, papers: 

* are usually deep and complex
* require serious study and significant experience to glean their important contributions and to place them in context. 

Like the [the original encyclopedia](https://en.wikipedia.org/wiki/The_Hitchhiker%27s_Guide_to_the_Galaxy), this serie called `the Hitchhiker's Guide to Distributed Systems Theory` will help you survive and understand the distributed world through examples, links and extract of code.

# ACID?

                "Programming should be about transforming data" 
                    Programming Elixir 1.3 by Dave Thomas

As developers, we are interacting oftenly with data, whenever handling it from an API or a messaging consumer. To store, it, we started to create softwares called **relational database management system** or [RDBMS](https://en.wikipedia.org/wiki/Relational_database_management_system). Thanks to them, we, as developers, can develop applications pretty easily, **without the need to implement our own storage solution**. Interacting with [mySQL](https://www.mysql.com/) or [PostgreSQL](https://www.postgresql.org/) have now become a **commodity**. Handling a database is not that easy though, because anything can happen, from power to network failures. **How can we interact with datastores that can fail?** As a database user, we are using `transaction` to answer failure. It is an **abstraction** that we are using to **hide underlying problems**, such as concurrency or hardware faults. 

`ACID` appears in a paper published in 1983 called ["Principles of transaction-oriented database recovery"](https://sites.fas.harvard.edu/~cs265/papers/haerder-1983.pdf) written by *Theo Haerder* and *Andreas Reuter*. This paper introduce a terminology of properties for a transaction: 

> **A**tomic, **C**onsistency, **I**solation, **D**urability 

## Atomic
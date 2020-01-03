---
title: "Hello FoundationDB!"
date: 2020-01-03T10:24:27+01:00
draft: true
showpagemeta: true
tags:
 - foundationdb
 - hello
---

![fdb image](/posts/intro-fdb/images/fdb-logo.png)

[Hello](/tags/hello/) is a blogpost serie where we are discovering a new piece of technology. You will find a lot of **links, videos, podcasts to click on**. Today we will discover FoundationDB.

---

# What is FoundationDB?

## Overview

As stated in the [official documentation](https://apple.github.io/foundationdb/index.html):

> FoundationDB is a distributed database designed to handle large volumes of structured data across clusters of commodity servers. It organizes data as an ordered key-value store and employs ACID transactions for all operations. It is especially well-suited for read/write workloads but also has excellent performance for write-intensive workloads.

It has strong key points:

* Multi-model data store
* Easily scalable and fault tolerant
* Industry-leading performance
* Open source.

From a database dialect, it provides [strict serializability](https://jepsen.io/consistency/models/strict-serializable) and [external consistency](https://cloud.google.com/spanner/docs/true-time-external-consistency).

## The story

FoundationDB started as a company in 2009, and then [has been acquired in 2015 by Apple](https://techcrunch.com/2015/03/24/apple-acquires-durable-database-company-foundationdb/). It [was a bad public publicity for the database as the download were removed.](https://news.ycombinator.com/item?id=9259986)

On April 19, 2018, Apple [open sourced the software, releasing it under the Apache 2.0 license](https://www.foundationdb.org/blog/foundationdb-is-open-source/).

# Tooling before coding

## Flow

From the [Engineering page](https://apple.github.io/foundationdb/engineering.html):

> FoundationDB began with ambitious goals for both high performance per node and scalability. We knew that to achieve these goals we would face serious engineering challenges that would require tool breakthroughs. We’d need efficient asynchronous communicating processes like in Erlang or the Async in .NET, but we’d also need the raw speed, I/O efficiency, and control of C++. To meet these challenges, we developed several new tools, the most important of which is **Flow**, a new programming language that brings actor-based concurrency to C++11.

Flow is more of a **stateful distributed system framework** than an asynchronous library. It takes a number of highly opinionated stances on how the overall distributed system should be written, and isn’t trying to be a widely reusable building block.



> Flow adds about 10 keywords to C++11 and is technically a trans-compiler: the Flow compiler reads Flow code and compiles it down to raw C++11, which is then compiled to a native binary with a traditional toolchain.

Flow was developed before FDB, as stated in this [2013's post](https://news.ycombinator.com/item?id=5319163):

> FoundationDB founder here. Flow sounds crazy. What hubris to think that you need a new programming language for your project? Three years later: Best decision we ever made.

> We knew this was going to be a long project so we invested heavily in tools at the beginning. The first two weeks of FoundationDB were building this new programming language to give us the speed of C++ with high level tools for actor-model concurrency. But, the real magic is how Flow enables us to use our real code to do deterministic simulations of a cluster in a single thread. We have a white paper upcoming on this.

> We've had quite a bit of interest in Flow over the years and I've given several talks on it at meetups/conferences. We've always thought about open-sourcing it... It's not as elegant as some other actor-model languages like Scala or Erlang (see: C++) but it's nice and fast at run-time and really helps productivity vs. writing callbacks, etc.

> (Fun fact: We've only ever found two bugs in Flow. After the first, we decided that we never wanted a bug again in our programming language. So, we built a program in Python that generates random Flow code and independently-executes it to validate Flow's behavior. This fuzz tester found one more bug, and we've never found another.) 

A very good overview of Flow is available [here](https://apple.github.io/foundationdb/flow.html) and some details [here](https://forums.foundationdb.org/t/why-was-flow-developed/1711/3).


## Simulation-Driven development

One of Flow’s most important job is enabling **Simulation**:

> We wanted FoundationDB to survive failures of machines, networks, disks, clocks, racks, data centers, file systems, etc., so we created a simulation framework closely tied to Flow. By replacing physical interfaces with shims, replacing the main epoll-based run loop with a time-based simulation, and running multiple logical processes as concurrent Flow Actors, Simulation is able to conduct a deterministic simulation of an entire FoundationDB cluster within a single-thread! Even better, we are able to execute this simulation in a deterministic way, enabling us to reproduce problems and add instrumentation ex post facto. This incredible capability enabled us to build FoundationDB exclusively in simulation for the first 18 months and ensure exceptional fault tolerance long before it sent its first real network packet. For a database with as strong a contract as the FoundationDB, testing is crucial, and over the years we have run the equivalent of a trillion CPU-hours of simulated stress testing.

A good overview of the simulation can be found [here](https://apple.github.io/foundationdb/testing.html). You can also have a look at this awesome talk!

{{< youtube 4fFDFbi3toc>}}

Here's an example of a [testfile](https://github.com/apple/foundationdb/blob/master/tests/slow/SwizzledCycleTest.txt):

```
testTitle=SwizzledCycleTest
    testName=Cycle
    transactionsPerSecond=5000.0
    testDuration=30.0
    expectedRate=0.01

    testName=RandomClogging
    testDuration=30.0
    swizzle = 1

    testName=Attrition
    machinesToKill=10
    machinesToLeave=3
    reboot=true
    testDuration=30.0

    testName=Attrition
    machinesToKill=10
    machinesToLeave=3
    reboot=true
    testDuration=30.0

    testName=ChangeConfig
    maxDelayBeforeChange=30.0
    coordinators=auto
```

The test is splitted into two parts:

* The goal, for example doing a [Ring benchmark](https://github.com/michaelnisi/ring-benchmark) with thousands of transactions per sec and there should be only 0.01% of success.
* What will be done to try to prevent the test to succeed. In this example it will **at the same time**:
    * do random clogging. Which means that **network connections will be stopped** (preventing actors to send and receive packets). Swizzle flag means that a subset of network connections will be stopped and bring back in reverse order, 😳
    * will **poweroff/reboot machines** (attritions) pseudo-randomly while keeping a minimal of three machines, 🤯 
    * **change configuration**, which means a coordination changes through multi-paxos for the whole cluster. 😱

Keep in mind that all these failures will appears **at the same time!** Do you think that your current **datastore has gone through the same test on a daily basis?** [I think not](https://github.com/etcd-io/etcd/pull/11308).

Applications written using the FoundationDB simulator have hierarchy: `DataCenter -> Machine -> Process -> Interface`. Each of these can be killed/freezed/nuked. Even faulty admin commands fired by some DevOps are tested!

## Recap

An awesome recap is available on the [Software Engineering Daily podcast](https://softwareengineeringdaily.com/2019/07/01/foundationdb-with-ryan-worl/):

> FoundationDB is tested in a very rigorous way using what's called **a deterministic simulation**. The reason they needed a new programming language to do this, is that to get a deterministic simulation, you have to make something that is deterministic. It's kind of obvious, but it's hard to do. 

> For example, if your process interacts with the network, or disks, or clocks, it's not deterministic. If you have multiple threads, not deterministic. So, they needed a way to write a concurrent program that could talk with networks and disks and that type of thing. They needed a way to write a concurrent program that does all of those things that you would think are non-deterministic in a deterministic way. 

> So, all FoundationDB processes, and FoundationDB, it's basically all written in Flow except a very small amount of it from the SQLite B-tree. The reason why that was useful is that when you use Flow, you get all of these higher level abstraction that let what you do what feels to you like asynchronous stuff, but under the hood, it's all implemented using callbacks in C++, which you can make deterministic by running it in a single thread. So, there's a scheduler that just calls these callbacks one after another and it's very crazy looking C++ code, like you wouldn't want to read it, but it's because of Flow they were able to implement that deterministic simulation.


# The Architecture

## Microservices

A typical FDB cluster is composed of different actors which are describe [here](https://github.com/apple/foundationdb/blob/master/documentation/sphinx/source/kv-architecture.rst). Because everything is written in an async way, **you can start a single FDB node running all the actors.**


## Read and Write Path

With FDB, you have **single hop read latencies** and **four hop write latencies**

### Write Path

### Read Path

## Storage

A lot of information are available in this talk:

{{< youtube nlus1Z7TVTI>}}

To sum-up:

* `SSD` Storage Engine is based on SQLite B-Tree
* `Redwood` will be a new storage engine based on Versioned B+Tree

# Developer experience

FoundationDB’s keys are ordered, making `tuples` a particularly useful tool for data modeling. FoundationDB provides a **tuple layer** (available in each language binding) that encodes tuples into keys. This layer lets you store data using a tuple like `(state, county)` as a key. Later, you can perform reads using a prefix like `(state,)`. The layer works by preserving the natural ordering of the tuples. 

Everything is wrapped into a transaction in FDB.

# FDB One more things: Layers

{{< youtube SvoUHHM9IKU>}}
{{< youtube HLE8chgw6LI>}}


# Kubernetes Operators

{{< youtube A3U8M8pt3Ks>}}

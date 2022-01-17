---
title: "Best resources to learn about data and distributed systems"
description: "Learning distributed systems is tough. You need to go through a lot of academic papers, concepts, code review, before being able to have a global pictures. Thankfully, there is a lot of resources out there that can help you. Here's the best resources I used to learn distributed systems"
draft: false
date: 2022-01-17T01:37:27+01:00
showpagemeta: true
images:
- /posts/distsys-resources/books.jpeg
categories:
- learning
- distributed-systems
---

Learning distributed systems is tough. You need to go through a lot of academic papers, concepts, code review, before being able to have a global pictures. Thankfully, there is a lot of resources out there that can help you to get started.  Here's a list of resources I used to learn distributed systems. I will keep this blogpost up-to-date with books, conferences, and so on.

![/posts/distsys-resources/books.jpeg](/posts/distsys-resources/books.jpeg)

> A distributed system is one in which the failure of a computer you didn't even know existed can render your own computer unusable.
> 
> -Lamport, 1987

## Reading 📚

### Designing Data-Intensive Applications 📘

Let's start by one of my favorite book, [Designing Data-Intensive Applications](https://dataintensive.net/), written by [Martin Kleppmann](https://martin.kleppmann.com/). This is by far the most practical book you will ever find about distributed systems. It covers:

* Data models, query languages and encoding,
* Replication, partitioning, the associated troubles, consistency, consensus,
* batch and stream processing.

> NoSQL… Big Data… Scalability… CAP Theorem… Eventual Consistency… Sharding…
> 
> Nice buzzwords, but how does the stuff actually work?
> 
> As software engineers, we need to build applications that are reliable, scalable and maintainable in the long run. We need to understand the range of available tools and their trade-offs. For that, we have to dig deeper than buzzwords.
> 
> This book will help you navigate the diverse and fast-changing landscape of technologies for storing and processing data. We compare a broad variety of tools and approaches, so that you can see the strengths and weaknesses of each, and decide what’s best for your application.

### Database Internals 📘

[Database Internals](https://www.databass.dev/), written by [Alex Petrov](https://twitter.com/ifesdjeen), is a fantastic book for anyone wondering how a database works. I recommend reading it after `Designing Data-Intensive Applications`, as the author dives in more details compared to Martin's book.

> Have you ever wanted to learn more about Databases but did not know where to start? This is a book just for you.
>
> We can treat databases and other infrastructure components as black boxes, but it doesn’t have to be that way. Sometimes we have to take a closer look at what’s going on because of performance issues. Sometimes databases misbehave, and we need to find out what exactly is going on. Some of us want to work in infrastructure and develop databases. This book’s main intention is to introduce you to the cornerstone concepts and help you understand how databases work.
> 
> The book consists of two parts: Storage Engines and Distributed Systems since that’s where most of the differences between the vast majority of databases is coming from.

### Jepsen blog ✍️

We are often using databases as a source of truth, but they are also pieces of software with bugs in it. Kyle Kingsbury is the most famous database-breaker with [Jepsen](http://jepsen.io/):

> Jepsen is an effort to improve the safety of distributed databases, queues, consensus systems, etc. We maintain an open source software library for systems testing, as well as blog posts and conference talks exploring particular systems’ failure modes. In each analysis we explore whether the system lives up to its documentation’s claims, file new bugs, and suggest recommendations for operators.

You will find analysis on many databases, such as CockroachDB, etcd, Kafka, MongoDB, and so on.

Here's a great bonus: Kyle is also teaching distributed systems, and his notes are [available](https://github.com/aphyr/distsys-class#an-introduction-to-distributed-systems).

### Distributed systems for fun and profit 📘

While being the only free book on this list, [Distributed systems for fun and profit](http://book.mixu.net/distsys/) is an awesome book. The author, [Mikito Takada](http://mixu.net/) has done a terrific work to vulgarize distributed systems.

> I wanted a text that would bring together the ideas behind many of the more recent distributed systems - systems such as Amazon's Dynamo, Google's BigTable and MapReduce, Apache's Hadoop and so on.

> In this text I've tried to provide a more accessible introduction to distributed systems. To me, that means two things: introducing the key concepts that you will need in order to have a good time reading more serious texts, and providing a narrative that covers things in enough detail that you get a gist of what's going on without getting stuck on details.

### Translucent Databases 📘

I really like the pitch of the book:

> Do you have personal information in your database?
> 
> Do you keep files on your customers, your employees, or anyone else?
> 
> Do you need to worry about European laws restricting the information you keep?
> 
> Do you keep copies of credit card numbers, social security numbers, or other information that might be useful to identity thieves or insurance fraudsters?
> 
> Do you deal with medical records or personal secrets?
> 
> Most database administrators have some of these worries. Some have all of them. That's why database security is so important.
> 
> This new book, Translucent Databases, describes a different attitude toward protecting the information.

[Translucent Databases](http://wayner.org/node/46) is a short book, focus on how to store sensitive data. You will find several dozen examples of interesting case studies on how to efficiently and privately store sensitive data. A must-have.

### The Art of PostgreSQL 📘

[The Art of PostgreSQL](https://theartofpostgresql.com/) is all about showing the power of both SQL and PostgreSQL. It explains the how's and why's of using Postgres's many feature, and how you, as a developers, can take advantages of it. A brilliant book that should be read by every developer.

> This book is for developers, covering advanced SQL techniques for data processing. Learn how to get exactly the result set you need in your application’s code!
> 
> Learn advanced SQL with practical examples and datasets that help you get the most of the book! Every query solves a practical use case and is given in context.
> 
> The book covers (de-)normalisation with simple practical examples to dive into this seemingly complex topic, including Caching and Indexing Strategy.
> 
> Writing efficient SQL is easier than it looks, and begins with database modeling and writing clear code. The book teaches you how to write fast queries!

### Readings in Database Systems 📘 

Another free book, [Readings in Database Systems](http://www.redbook.io/) is a great read if you are looking for an opinionated and short review on subject like architecture, engines, analytics and so on.

> Readings in Database Systems (commonly known as the "Red Book") has offered readers an opinionated take on both classic and cutting-edge research in the field of data management since 1988. Here, we present the Fifth Edition of the Red Book — the first in over ten years.

## Watching 📺

### CMU Database Group 🧑‍🏫

The Database Group at Carnegie Mellon University have been publishing a lot of contents, including:
* [Intro to Database Systems lecture](https://www.youtube.com/playlist?list=PLSE8ODhjZXjZaHA6QcxDfJ0SIWBzQFKEG)
* [Advanced Database Systems lecture](https://www.youtube.com/playlist?list=PLSE8ODhjZXjasmrEd2_Yi1deeE360zv5O)

which are the best lectures about database in my opinion.

I also recommend their Quarantine database talks playlists:

>  the "Quarantine Database Tech Talks" is a on-line seminar series at Carnegie Mellon University with leading developers and researchers of database systems. Each speaker will present the implementation details of their respective systems and examples of the technical challenges that they faced when working with real-world customers.

* [Vaccination Database Tech Talks First Dose](https://www.youtube.com/playlist?list=PLSE8ODhjZXjbeqnfuvp30VrI7VXiFuOXS)
* [Vaccination Database Tech Talks Second Dose](https://www.youtube.com/playlist?list=PLSE8ODhjZXjbDOFN4U4-Uv95-N8sgzs5D)

### Distributed Systems lecture series 🧑‍🏫

[Martin Kleppmann](https://martin.kleppmann.com/)(`Designing Data Intensive applications`'s author) published an [8-lecture series on distributed systems](https://www.youtube.com/playlist?list=PLeKd45zvjcDFUEv_ohr_HdUFe97RItdiB):

> This video is part of an 8-lecture series on distributed systems, given as part of the undergraduate computer science course at the University of Cambridge.

### Academic conferences 📹 

Keeping track of the academic world is not easy, but thankfully, we can keep track of several academic conferences which are data-related, including:

* [CIDR](http://cidrdb.org)
* [SIGMOD/PODS](https://sigmod.org/)
* [VLDB](https://vldb.org)
* [PaPoC](https://papoc-workshop.github.io/2022/)

### Industrial conference 📹

There is not much database-focused conferences, but you will be interested to see talks from:

* [HydraConf](https://hydraconf.com/)
* [HYTRADBOI](https://www.hytradboi.com/)

### DistSys Reading Group sessions 📹

If you are looking for explanations about a distributed systems paper, you may be interested in the [DistSys Reading Group](http://charap.co/category/reading-group/):

> Every week we present and discuss one distributed systems paper. We try to focus on relatively new papers, although we occasionally break this rule for some important older publications. The main objective of this group is to share knowledge through the discussion. Our participants come from academia and industry and often carry a unique perspective and expertise on the subject matter.

Every session can be found on their [YouTube channel](https://www.youtube.com/channel/UCMKIroHVXvMQRIBhENE6RhQ). 

## Coding 🧑‍💻

### Maelstrom ⚡

Ever wonder to develop your own toy distributed systems? Fear no more, you can use [Maelstrom](https://github.com/jepsen-io/maelstrom) for that!

> Maelstrom is a workbench for learning distributed systems by writing your own. It uses the Jepsen testing library to test toy implementations of distributed systems. Maelstrom provides standardized tests for things like "a commutative set" or "a transactional key-value store", and lets you learn by writing implementations which those test suites can exercise. It's used as a part of a distributed systems workshop by Jepsen.

> Maelstrom provides a range of tests for different kinds of distributed systems, built on top of a simple JSON protocol via STDIN and STDOUT. Users write servers in any language. Maelstrom runs those servers, sends them requests, routes messages via a simulated network, and checks that clients observe expected behavior. You want to write Plumtree in Bash? Byzantine Paxos in Intercal? Maelstrom is for you.

### PingCAP's Talent Plan ⚡

PingCAP is the company behind the tidb/tikv stack, a new distributed systems. They developed their own [open source training program](https://github.com/pingcap/talent-plan):

> Talent Plan is an open source training program initiated by PingCAP. It aims to create or combine some open source learning materials for people interested in open source, distributed systems, Rust, Golang, and other infrastructure knowledge. As such, it provides a series of courses focused on open source collaboration, rust programming, distributed database and systems.

I went through the Raft project in Rust and I learned a lot!
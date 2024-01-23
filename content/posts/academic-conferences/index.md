---
title: "The unseen treasures of Infrastructure Engineering: Academic Papers"
description: "Are you using academic papers in your RSS fields? You should!"
draft: false
date: 2024-01-22T15:37:27+01:00
showpagemeta: true
toc: true
images:
  - /posts/academic-conferences/papers.png
categories:
- learning
- distributed-systems
---

{{< figure src="/posts/academic-conferences/papers.png">}}

I really like using RSS feeds. My Feedly account has more than 190 feeds, all neatly organized by categories. They help me keep up with new ideas and interesting blog posts about engineering. But there's another source of information I've been using for a long time that not many people know about: **academic papers**.

You can discover details about infrastructure that you might not find in regular blog posts. Academic papers, unlike typical blog content, often dive deeper into specific aspects of infrastructure. They provide more in-depth information, uncovering details that are not commonly discussed. So, if you're interested in gaining a more comprehensive understanding of infrastructure-related topics, exploring academic papers can be really worthwile.

> Sounds a bit too academic, doesn't it? 🤔

I don't think so!  It's true that academic research can sometimes seem distant from everyday industry needs, but following both academic and industry tracks is beneficial. R&D from academia often lead to new ideas and technologies that eventually find their way into practical use. Moreover, numerous academic conferences feature a **"industry track"** that is essential to monitor.

> Aren't they too complex to read? 🤔

If you don't get everything right away, that's okay. Reading these smart papers might be a bit hard, but it's a skill that gets better with practice. And who knows, maybe you'll be inspired to write your own paper someday! 😉

> I'm intrigued! Where should I start?

Here's a short list of my go-to academic papers and conferences that you can follow for infrastructure engineering. Please note that many conferences exists on other subjects, like security and so.

## The USENIX community

### OSDI

As part of the USENIX Association, the **Operating Systems Design and Implementation** is an annual computer science conference that you shouldn't miss. You can catch most of the sessions online along with some useful slides. One standout is the 2020 paper by Facebook/Meta introducing Delos, where they discuss replacing Zookeeper with a virtual consensus.

### Usenix ATC

Similar to OSDI, the Usenix **Annual Technical Conference** is another classic to follow. [On-demand Container Loading in AWS Lambda](https://www.usenix.org/conference/atc23/presentation/brooker) has been awarded Best Paper in 2023, and it's a gem!

## The ACM family

### SIGMOD

SIGMOD, or the **Special Interest Group on Management of Data**, is an essential conference under the ACM umbrella, focusing on the management and organization of data. I really enjoyed the [FoundationDB's paper](https://www.foundationdb.org/blog/fdb-paper/) which has been awarded best industry paper.

### SoCC

The **Symposium on Cloud Computing** or SoCC for short belongs to ACM. It has a bit less content, as videos are not published, but you should keep it in your watchlist. In 2023, the best paper was awarded to [Golgi: Performance-Aware, Resource-Efficient Function Scheduling for Serverless Computing](https://dl.acm.org/doi/10.1145/3620678.3624645).

### SOSP

The **Symposium on Operating Systems Principles** is another noteworthy conference in the ACM family. It's a top-tier venue for discussing operating systems research. Stay tuned for updates on the latest breakthroughs and innovative ideas. One of my favorite SOSP award is [Using Lightweight Formal Methods to Validate a Key-Value Storage Node in Amazon S3](https://www.youtube.com/watch?v=YdxvOPenjWI).

## Others

### VLDB

Not belonging to USENIX or ACM, the **Very Large Data Bases** (VLDB) conference is a key event in the database community. It provides a platform for researchers and professionals to exchange ideas on managing and analyzing large-scale datasets. 2023's best industry paper is about how Confluent improved Kafka with [Kora](https://www.confluent.io/blog/cloud-native-kafka-kora-vldb-award/).

### CIDR

The **Conference on Innovative Data Systems Research** (CIDR) is a systems-oriented conference, complementary in its mission to the mainstream database conferences like SIGMOD and VLDB, emphasizing the systems architecture perspective.

2024's edition is featuring [Scalable OLTP in the Cloud: What's the BIG DEAL?](https://www.cidrdb.org/cidr2024/papers/p63-helland.pdf), which seems interesting.

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.

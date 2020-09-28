---
title: "$ whoami"
date: 2018-12-15T18:34:45+01:00
draft: false
---

{{< image src="/img/myself.jpg" alt="Hello Friend" position="center" style="max-width: 300px;border-radius: 200px;" >}}

I am an **Technical Leader** at **[OVHcloud](https://www.ovhcloud.com)**. I love working with **distributed systems**, specifically around **data storage**.

I enjoy being part of open-source communities, through **[talks](/talks)**, **[blogposts](/posts)**, and contributions to:

* SenX
    * [Warp10](https://github.com/senx/warp10-platform/commits?author=PierreZ),
* Apache
    * [HBase](https://github.com/apache/hbase/commits/master?author=PierreZ),
    * [Flink](https://github.com/apache/flink/commits/master?author=PierreZ),
    * [Pulsar](https://github.com/apache/pulsar/commits/master?author=PierreZ) and some related plugins like [streamnative/kop (Kafka On Pulsar)](https://github.com/streamnative/kop/commits/master?author=PierreZ),
* Apple
    * [FoundationDB](https://github.com/apple/foundationdb/commits/master?author=PierreZ) and their [Kubernetes Operator](https://github.com/FoundationDB/fdb-kubernetes-operator/commits/master?author=PierreZ),
* CNCF
    * [ETCD](https://github.com/etcd-io/etcd/commits/master?author=PierreZ),
* and [others](https://github.com/PierreZ/).

I am also maintaining/playing with some projects such as:

* [awesome-cs-papers-and-implementations](https://github.com/PierreZ/awesome-cs-papers-and-implementations), An awesome list about the most iconic CS papers
* [fdb-etcd](https://github.com/PierreZ/fdb-etcd), An experiment to provide ETCD layer on top of Record-Layer and FoundationDB.
* [Record-Store](https://pierrez.github.io/record-store/), A light, multi-model, user-defined place for your data. 

On my free time, I am giving a hand to local events, such as the local GDG/JUG **[FinistDevs](https://finistdevs.org/)**, **[Devoxx4Kids](https://twitter.com/devoxx4kidsbes)** and **[DevFest du Bout du Monde](https://devfest.duboutdumonde.bzh/)**, a technical conference. I am also a **teaching assistant** in my former Engineer School.

I cofounded in 2017 **[HelloExoWorld](https://helloexo.world/)**, a initiative to search for exoplanets using Warp10, a time-series platform.

# Work

#### 2020 to now: Technical Leader @OVHcloud - Managed Kubernetes

I am  working on the [managed Kubernetes product](https://www.ovhcloud.com/en-gb/public-cloud/kubernetes/) and mostly on ETCD's scalability.

#### 2019 to 2020: Technical Leader @OVHcloud - ioStream

I was working on the underlying infrastructure of `IO` oriented products, including [ioStream](https://labs.ovh.com/iostream), a geo-replicated, managed topic-as-a-service product built using [Apache Pulsar](https://pulsar.apache.org).

During that time, I worked around adding [Kafka's protocol to Pulsar](/posts/announcing-kop/).

We launched a beta mid-2019, and the project has been shutdown mid-2020.

#### 2016 to 2019: Infrastructure Engineer @OVH

I worked on **[Metrics Data Platform](https://www.ovh.com/fr/data-platforms/metrics/)**. We are using **[Warp10](http://www.warp10.io/)** with friendly Apache softwares such as **Hbase, Hadoop, Zookeeper, Kafka and Flink** to handle all OVH's metrics-based monitoring, which represent around **432 billions of measurements per day**.

I have taken part of most of Metrics development, from internal management to Ingress/Egress translation part. I also worked on the implementation and deployment of a distributed and scalable alerting system using Apache Flink.

I was using `Flink`, `HBase`, `Hadoop,` `Kafka`, `Ansible`, `Go`, `Rust`, `Java`, `Linux`, `WarpScript` on a daily basis.

I was **on-call duty** on more than 700 servers, including:

* 3 Warp10 fully distributed clusters, including one that handling 1.5 millions datapoints per second
* 3 Hadoop clusters, including a 250 nodes Hadoop cluster running a 75k regions Hbase table
* Various Apache technologies, such as Kafka, Zookeeper and Flink

I gave training and support for both external and internal client of Metrics, including WarpScript.

During that time, I contributed to Apache Flink and HBase.
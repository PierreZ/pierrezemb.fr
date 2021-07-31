---
title: What can be gleaned about GFS successor codenamed Colossus?
date: 2019-08-04T15:07:11+02:00
draft: false

categories:
 - distributed-systems
 - hadoop
 - colossus
---

{{< image src="/posts/colossus-google/hadoop-logo.jpg" alt="Hello Friend" position="center" style="border-radius: 8px;" >}}

In the last few months, there has been numerous blogposts about the end of the Hadoop-era. It is true that:

* [Health of Hadoop-based companies are publicly bad](https://www.theregister.co.uk/2019/06/06/cloudera_ceo_quits_customers_delay_purchase_orders_due_to_roadmap_uncertainty_after_hortonworks_merger/)
* Hadoop has a bad publicity with headlines like ['What does the death of Hadoop mean for big data?'](https://techwireasia.com/2019/07/what-does-the-death-of-hadoop-mean-for-big-data/)

Hadoop, as a distributed-system, **is hard to operate, but can be essential for some type of workload**. As Hadoop is based on GFS, we can wonder how GFS evolved inside Google.

## Hadoop's story

Hadoop is based on a Google's paper called [The Google File System](https://static.googleusercontent.com/media/research.google.com/en//archive/gfs-sosp2003.pdf) published in 2003. There are some key-elements on this paper:

* It was designed to be deployed with [Borg](https://ai.google/research/pubs/pub43438),
* to "[simplify the overall design problem](https://queue.acm.org/detail.cfm?id=1594206)", they:
    * implemented a single master architecture
    * dropped the idea of a full POSIX-compliant file system
* Metadatas are stored in RAM in the master,
* Datas are stored within chunkservers,
* There is no YARN or Map/Reduce or any kind of compute capabilities.

## Is Hadoop still revelant?

Google with GFS and the rest of the world with Hadoop hit some issues:

* One (Metadata) machine is not large enough for large FS,
* Single bottleneck for metadata operations,
* Not appropriate for latency sensitive applications,
* Fault tolerant not HA,
* Unpredictable performance,
* Replication's cost,
* HDFS Write-path pipelining,
* fixed-size of blocks,
* cost of operations,
* ...

Despite all the issues, Hadoop is still relevant for some usecases, such as Map/Reduce, or if you need Hbase as a main datastore. There is stories available online about the scalability of Hadoop:

* [Twitter has multiple clusters storing over 500 PB (2017)](https://blog.twitter.com/engineering/en_us/topics/infrastructure/2017/the-infrastructure-behind-twitter-scale.html)
* whereas Google prefered to ["Scaled to approximately 50M files, 10P" to avoid "added management overhead" brought by the scaling.](https://cloud.google.com/files/storage_architecture_and_challenges.pdf)


Nowadays, Hadoop is mostly used for Business Intelligence or to create a datalake, but at first, GFS was designed to provide a distributed file-system on top of commodity servers. 

Google's developers were/are deploying applications into "containers", meaning that **any process could be spawned somewhere into the cloud**. Developers are used to work with the file-system abstraction, which provide a layer of durability and security. To mimic that process, they developed GFS, so that **processes don't need to worry about replication** (like Bigtable/HBase).

This is a promise that, I think, was forgotten. In a world where Kubernetes *seems* to be the standard, **the need of a global distributed file-system is now higher than before**. By providing a "file-system" abstraction for applications deployed in Kubernetes, we may be solving many problems Kubernetes-adopters are hitting, such as:

* How can I retrieve that particular file for my applications deployed on the other side of the Kubernetes cluster?
* Should I be moving that persistent volume over my slow network?
* What is happening when [Kubernetes killed an alpha pod in the middle of retrieving snapshot](https://github.com/dgraph-io/dgraph/issues/2698)?

## Well, let's put Hadoop in Kubernetes!

Putting a distributed systems inside Kubernetes is currently a unpleasant experience because of the current tooling:

* Helm is not helping me expressing my needs as a distributed-system operator. Even worse, the official [Helm chart for Hadoop is limited to YARN and Map/Reduce and "Data should be read from cloud based datastores such as Google Cloud Storage, S3 or Swift."](https://github.com/helm/charts/tree/master/stable/hadoop)
* Kubernetes Operators has no access to key-metrics, so they cannot watch over your applications correctly. It is only providing a "day-zero to day-two" good experience,
* Google seems to [not be using the Operators design internally](https://news.ycombinator.com/item?id=16971959).
* [CouchDB developers](https://www.ibm.com/cloud/blog/new-builders/database-deep-dives-couchdb) are saying that:
    * "For certain workloads, the technology isn’t quite there yet"
    * "In certain scenarios that are getting smaller and smaller, both Kubernetes and Docker get in the way of that. At that point, CouchDB gets slow, or you get timeout errors, that you can’t explain."


## How GFS evolved within Google

As GFS's paper was published in 2003, we can ask ourselves if GFS has evolved. And it did! The sad part is that there is only a few informations about this project codenamed `Colossus`. There is no papers, and not a lot informations available, here's what can be found online:

* From [Storage Architecture and Challenges(2010)](https://cloud.google.com/files/storage_architecture_and_challenges.pdf):
    * They moved from full-replication to [Reed-Salomon](https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction). This feature is acually in [Hadoop 3](https://hadoop.apache.org/docs/r3.0.0/hadoop-project-dist/hadoop-hdfs/HDFSErasureCoding.html),
    * replication is handled by the client, instead of the pipelining,
    * the metadata layer is automatically sharded. We can find more informations about that in the next ressource!

* From [Cluster-Level Storage @ Google(2017)](http://www.pdsw.org/pdsw-discs17/slides/PDSW-DISCS-Google-Keynote.pdf):
    * GFS master replaced by Colossus
    * GFS chunkserver replaced by D
    * Colossus rebalances old, cold data
    * distributes newly written data evenly across disks
    * Metadatas are stored into BigTable. each Bigtable row corresponds to a single file.

The "all in RAM" GFS master design was a severe single-point-of-failure, so getting rid of it was a priority. They didn't had a lof of options for a scalable and rock-solid datastore **beside BigTable**. When you think about it, a key/value datastore is a great replacement for a distributed file-system master:

* automatic sharding of regions,
* scan capabilities for files in the same "directory",
* lexical ordering,
* ...

The funny part is that they now need a Colossus for Colossus. The only things saving them is that storing the metametametadata (the metadata of the metadata of the metadata) can be hold in Chubby.

* From [GFS: Evolution on Fast-forward(2009)](https://queue.acm.org/detail.cfm?id=1594206)
    * they moved to chunks of 1MB of files, as the limitations of the master disappeared. This is also allowing Colossus to support latency sensitive applications,

* From [a Github comment on Colossus](https://github.com/cockroachdb/cockroach/issues/243#issuecomment-91575792):
    * File reconstruction from Reed-Salomnon was performed on both client-side and server-side
    * on-the-fly recovery of data is greatly enhanced by this data layout(Reed Salomon)

* From a [Hacker News comment](https://news.ycombinator.com/item?id=20135927):
    * Colossus and D are two separate things.

What is that "D"?

* From [ The Production Environment at Google, from the Viewpoint of an SRE](https://landing.google.com/sre/sre-book/chapters/production-environment/):
    * D stands for *Disk*,
    * D is a fileserver running on almost all machines in a cluster.

* From [The Production Environment at Google](https://medium.com/@jerub/the-production-environment-at-google-8a1aaece3767):
    * D is more of a block server than a file server
    * It provides nothing apart from checksums.

## Is there an open-source effort to create a Colossus-like DFS?

I did not found any point towards a open-source version of Colossus, beside some work made for [The Baidu File System](https://github.com/baidu/bfs) in which the Nameserver is implemented as a raft group.

There is [some work to add colossus's features in Hadoop](https://www.slideshare.net/HadoopSummit/scaling-hdfs-to-manage-billions-of-files-with-distributed-storage-schemes) but based on the bad publicity Hadoop has now, I don't think there will be a lot of money to power those efforts.

I do think that rewriting an distributed file-system based on Colossus would be a huge benefit for the community:

* Reimplement D may be easy, my current question is **how far can we use modern FS such as OpenZFS** to facilitate the work? FS capabilities such as [OpenZFS checksums](https://github.com/zfsonlinux/zfs/wiki/Checksums) seems pretty interesting.
* To resolve the distributed master issue, we could use [Tikv](https://tikv.org/) as a building block to provide an "BigTable experience" without the need of a distributed file-system underneath.

But remember:

> Like crypto, Do not roll your own DFS!

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.

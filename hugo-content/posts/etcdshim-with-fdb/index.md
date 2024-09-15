---
title: "Writing an ETCDshim with FoundationDB"
description: "The story behind the ETCDshim built as a FoundationDB's layer"
images:
  - /posts/notes-about-foundationdb/images/fdb-white.jpg
date: 2021-02-21T00:24:27+01:00
draft: true 
showpagemeta: true
toc: true
categories:
 - FoundationDB
 - etcd
---

![fdb image](/posts/notes-about-foundationdb/images/fdb-white.jpg)

As we will talk about both FoundationDB and ETCD, I recommend you go through these blogposts:

* [Notes about ETCD](/posts/notes-about-etcd/),
* [Notes about FoundationDB](/posts/notes-about-foundationdb/).

## Why an ETCDshim?

I should start with a small disclaimer: I worked a lot around ETCD in my previous work at OVHcloud, especially around [this issue](https://github.com/etcd-io/etcd/issues/11884). OVHcloud is using one ETCD for hundred of ApiServers and it was a pain for SRE team. I made a  [talk @KubeCon Europe 2021](https://pierrezemb.fr/talks/lessons-learned-from-operating-etcd/) about the difficulties of operating ETCD's cluster under heavy load, but a quick `tl;dr` is that an ETCDshim makes sense if you are deploying a lot of Kubernetes clusters.

I wrote the layer during the first french lockdown just before joining the K8S team to **learn** both FDB and ETCD at the same time.

### Requirements

To build an ETCDshim, we will need to:

* **mimic the interface**: the ETCDshim should be a drop-in replacement,
* **provide the same features**: ETCD is offering some features that needs to be implemented on the ETCDshim, like `Watches` or `Leases`.
* **improve multi-tenancy**: ETCD is a single-group Raft implementation, meaning that we cannot split the keyspace into several regions/shards, spread on a cluster.
* **improve maximum datasize**: The default storage size limit for ETCD is 2GB, and up to 8GB.

### Why FoundationDB?

After joining the team, a few months later, we decided to test some ETCDshims. Our goal was to avoid stacking ETCD´s cluster like they are doing now and have something designed to scale nicely as we are adding new customers. I talked with Darren Shepherd a lot about Kine and I was hyped about it. They replaced their ETCDs in Rancher by Kine and they are really happy about it. But the tradeoff here is that they are using Amazon managed SQL products.

You are right! The monotonic ID is interesting, but only works when running an non-distributed datastore. We tried something like CockroachDB below Kine to distribute the tables, but we were experiencing too much constraints on both the SQL layer and the SEQUENCE to have a nice performances.

Well, to be fair, we had better performances than ETCD, but it did not scale enough as we were having a lot transactions restarts with the ReadWithinUncertaintyInterval error.

I also tried to forked Kine to handle revision internally in the ETCDshim instead of relying on the database to generate them but I left OVHcloud before putting some tests in it.

After {writing, playing with} several ETCDshims, I feel like my first approach was the right one, FoundationDB´s interface is insanely good to help you carefully design a data service thanks to features like the byte-ordered key-Value, transactions, Versionstamp, Tuples/Subspaces/Directories and so on :sun_with_face:

    To make FDB a usable etcd replacement in k8s cluster, it is not a easy task. There many issues we need to resolve.

        Performance needs to be better than etcd.
        Horizontally Scalable. But Watch event should not be lost or reordered.
        Avoid single-point failures.

I´m not scared with 1 and 3 because of how bad ETCD behave under “high” QPS :smiley:
2 is completely tied to the design of the layer.

    Performance requires Scalable. Scalable requires distributed processing. However, distributed processing can hardly make sure the ordering and no event lost. That’s why I feel it is really hard to achieve these goals.

I feel like it is quite easy to design the layer with that in my mind. I prefer to pay a bit additional cost during GetRange to gain a perfectly handled Watch.

    Good thing is that FDB supports Watch. But the Watch support from FDB is also not very limited.

FDB´s watches are only the top of the iceberg to implement ETCD´s watches. I was like you at the beginning of the layer “I should use the Watches directly!!” Then I realized than they are two differents beasts:

    ETCD´s watch is a stream of mutations,
    FDB´s watch is a notification of a key change.

The first item means that ETCD need to keep an exact history of its keyspace, like this:

// ...
revision 432: added key foo
revision 433: deleted bar key
// ...

so that a Watch is simply a scheduled query, retrieving any new revisions. ETCD, Kine and my layer are designed like this, with the revision as a key. This is the only way to be sure that your Watches sees every mutations.

Well not the only way, you could use something like Kafka or Pulsar as the storage layer of an ETCDshim 1, but this will shift the design completely as the Watches will be simple but the kv interface will give you extra work.

I also feels like FDB´s watches have an impact on production clusters, but that is just a feeling, no production experience here :laughing:

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.

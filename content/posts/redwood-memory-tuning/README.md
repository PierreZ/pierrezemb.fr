---
title: "Redwood’s memory tuning in FoundationDB"
description: "Learn how to tune FoundationDB for Redwood storage Engine"
draft: false
date: 2024-04-22T00:37:27+01:00
showpagemeta: true
toc: true
images:
categories:
- foundationdb
- distributed-systems
---

While FoundationDB allows you to obtain sub-milliseconds transactions’s latency without any knob-tuning, we had to bump a bit memory usage for Redwood under certain usage and workload. The following configuration has been tested on clusters from 7.1 to 7.3.

## BTree page cache

We discovered the issue when we saw a performance decrease on our cluster storing time-series data. Our cluster was reporting some high disk-business, causing outages:

```
10.0.3.23:4501 ( 65% cpu; 61% machine; 0.010 Gbps; 93% disk IO; 7.5 GB / 7.4 GB RAM  )
10.0.3.24:4501 ( 61% cpu; 61% machine; 0.010 Gbps; 87% disk IO; 9.7 GB / 7.4 GB RAM  )
10.0.3.25:4501 ( 69% cpu; 61% machine; 0.010 Gbps; 93% disk IO; 5.4 GB / 7.4 GB RAM  )
```

This was our first «we need to dig into this» moment with FDB. We couldn’t find the root-cause and we asked the community. Turns out we had a classic page-cache issue which was spotted by [Markus Pilman](https://forums.foundationdb.org/u/markus.pilman/summary) and [William Dowling](https://forums.foundationdb.org/u/wmd/summary). While the trace files are pretty verbose, they are containing a lot of information like this one:

```
"PagerCacheHit": "39852",
"PagerCacheMiss": "25903",
```

Yep, that’s a 40% cache-miss ratio over 5s 😱 This is why the disk was so busy, spending his time moving pages back and forth. We need to bump the memory, but how much? The general recommandation that worked for us is to target around 1-2% of the `kvstore_used_bytes` metrics. As we have around 1TiB of data per StorageServer, we can add the following config key:

```
cache_memory = 10GiB
```

Which fixed our cache-miss issue 🎉

```
"PagerCacheHit": "51968",
"PagerCacheMiss": "432",
```
 
## Byte Sample memory usage

But our problems are still resolved, as we are still seeing some OOM 😭 Because this cluster is storing time-series data, each StorageServers is holding around 1TiB of data. As we were holding more and more data, we saw more and more OOM errors on our `fdbmonitor` logs. Something was growing linearly with our usage and needed tuning. This time, we had help from [Steve Atherton](https://forums.foundationdb.org/u/SteavedHams/summary) which pointed us towards the direction of the [Byte Sample](https://forums.foundationdb.org/t/foundationdb-7-1-24-the-memory-usage-after-clean-startup-of-fdbserver-process-is-too-high/3863/8?u=pierrez):

> There is a data structure that storage servers have called the Byte Sample which stores a deterministic random sample of keys. This data is persisted on disk in the storage engine and is loaded immediately upon storage server startup. Unfortunately, its size is not tracked or reported, but grows linearly with KV size and I suspect yours is somewhere around 4GB-6GB based on the memory usage I’ve seen for smaller storage KV sizes.

So, we need to add around 4GB more in the memory, but there is no config for that parameter. It needs to be embedded in the global `memory` parameter. Let’s compute the right value!

## The global memory formula

By testing things on our clusters, we ended up with this formula:
```
# Default is 2
cache_memory = (1-2% of kvstore_used_bytes)GiB
# Default is 8
memory = (8 + cache_memory + 4-6GB per TB of kvstore_used_bytes)GiB
```

Which fixed all our memory issues with FoundationDB 🎉 And to be fair, this is the only things we needed to tune on our clusters, which is quite impressive 👀

## Special thanks
I would like to thank Markus, William and Steve from the FoundationDB community for their help 🤝

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.

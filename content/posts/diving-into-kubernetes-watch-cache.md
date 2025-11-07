+++
title = "Diving into Kubernetes' Watch Cache"
description = "Understanding how Kubernetes apiserver caches etcd, the 3-second timeout, and K8s 1.34 consistent read feature"
date = 2025-11-05
[taxonomies]
tags = ["diving-into", "kubernetes", "distributed-systems", "etcd", "caching"]
+++

---

[Diving Into](/tags/diving-into/) is a blogpost series where we dig into specific parts of a project's codebase. In this episode, we dig into Kubernetes' watch cache implementation.

---

While debugging an etcd-shim on FoundationDB, I kept hitting `"Timeout: Too large resource version"` errors. The cache was stuck at revision 3044, but clients requested 3047. Three seconds later: timeout. This led me into the watch cache internals: specifically the 3-second timeout in `waitUntilFreshAndBlock()` and how progress notifications solve the problem. Let's dig into how it actually works.

> **Note:** Yes, [Clever Cloud](https://clever.cloud) runs an etcd-shim on top of FoundationDB for Kubernetes. Truth is, we're not alone: [AWS](https://aws.amazon.com/blogs/containers/under-the-hood-amazon-eks-ultra-scale-clusters/) and [GKE](https://cloud.google.com/blog/products/containers-kubernetes/gke-65k-nodes-and-counting?hl=en) have custom storage layers too. After [operating etcd at OVHcloud](https://www.youtube.com/watch?v=IrJyrGQ_R9c), we chose a different path. I actually wrote a naive PoC during COVID ([fdb-etcd](https://github.com/PierreZ/fdb-etcd)) without testing it against a real apiserver 😅 it was mostly an excuse to discover [the Record-Layer](https://pierrez.github.io/fdb-book/the-record-layer/what-is-record-layer.html). You can read more about the technical challenges in [this FoundationDB forum discussion](https://forums.foundationdb.org/t/a-foundationdb-layer-for-apiserver-as-an-alternative-to-etcd/2697).

## Overview of the Watch Cache

As stated in the [Kubernetes 1.34 blog post](https://kubernetes.io/blog/2024/08/15/consistent-read-from-cache-beta/):

> This enhancement allows the API server to serve consistent read requests directly from the watch cache, significantly reducing the load on etcd and improving overall cluster performance.

The key architectural points:

- A cache layer sits between the apiserver and [etcd](/posts/notes-about-etcd/)
- The architecture is **per resource group** - each resource type (pods, services, deployments, etc.) has its own Cacher instance
- Each Cacher runs independently with its own LIST+WATCH loop

## Architecture

```
Client Requests (kubectl, controllers)
          ↓
    Cacher (per resource)
          ↓ In-memory watch cache
          ↓ (on cache miss/delegate)
    etcd3/Store
          ↓
    etcd / etcd-shim
```

The main components:

- [cacher.go](https://github.com/kubernetes/kubernetes/blob/release-1.34/staging/src/k8s.io/apiserver/pkg/storage/cacher/cacher.go) - The in-memory watch cache
- [store.go](https://github.com/kubernetes/kubernetes/blob/release-1.34/staging/src/k8s.io/apiserver/pkg/storage/etcd3/store.go) - Direct [etcd](/posts/notes-about-etcd/) communication layer

## How The Cache Gets Fed

### Initialization: The LIST Phase

Here's how the cache gets fed. The Reflector pattern kicks off with a complete LIST operation. Each resource cache begins by fetching all existing objects through a paginated LIST (10,000 items per page). Once the LIST completes, `watchCache.Replace()` populates the in-memory cache with these objects. The critical moment happens when the `SetOnReplace()` callback fires, marking the cache as READY. Nothing works for that resource until this initialization completes.

The implementation can be seen in [cacher.go:468-478](https://github.com/kubernetes/kubernetes/blob/release-1.34/staging/src/k8s.io/apiserver/pkg/storage/cacher/cacher.go#L468-L478).

### Continuous Sync: The WATCH Phase

After initialization, the cache maintains synchronization through a Watch stream that starts at LIST revision + 1. This ensures no events are missed between the LIST and WATCH operations. Events flow from etcd through a buffered channel (capacity: 100 events) and are processed by the `dispatchEvents()` goroutine, which runs continuously and matches events to interested watchers.

See [Reflector documentation](https://github.com/kubernetes/kubernetes/blob/release-1.34/staging/src/k8s.io/client-go/tools/cache/reflector.go) for the complete pattern.

## The Problem: "Timeout: Too large resource version"

While debugging our etcd-shim, we kept hitting this error:

```
Error getting keys: err="Timeout: Too large resource version: 3047, current: 3044"
```

A client was requesting ResourceVersion 3047, but the cache only knew about revision 3044. The cache would wait... and timeout after 3 seconds.

## Understanding Cache Freshness

### The Freshness Check

When a client requests a consistent read at a specific ResourceVersion, Kubernetes needs to ensure the cache is "fresh enough" to serve that request. Here's the check: is my current revision at least as high as the requested revision? If not, it calls `waitUntilFreshAndBlock()` with a 3-second timeout, waiting for Watch events to bring the cache up to date.

From [cacher.go:1257-1261](https://github.com/kubernetes/kubernetes/blob/release-1.34/staging/src/k8s.io/apiserver/pkg/storage/cacher/cacher.go#L1257-L1261):

```go
if c.watchCache.notFresh(requestedWatchRV) {
    c.watchCache.waitingUntilFresh.Add()
    defer c.watchCache.waitingUntilFresh.Remove()
}
err := c.watchCache.waitUntilFreshAndBlock(ctx, requestedWatchRV)
```

The actual timeout implementation ([watch_cache.go:448-488](https://github.com/kubernetes/kubernetes/blob/release-1.34/staging/src/k8s.io/apiserver/pkg/storage/cacher/watch_cache.go#L448-L488)):

```go
func (w *watchCache) waitUntilFreshAndBlock(ctx context.Context, resourceVersion uint64) error {
    startTime := w.clock.Now()
    defer func() {
        if resourceVersion > 0 {
            metrics.WatchCacheReadWait.WithContext(ctx).WithLabelValues(w.groupResource.Group, w.groupResource.Resource).Observe(w.clock.Since(startTime).Seconds())
        }
    }()

    // In case resourceVersion is 0, we accept arbitrarily stale result.
    // As a result, the condition in the below for loop will never be
    // satisfied (w.resourceVersion is never negative), this call will
    // never hit the w.cond.Wait().
    // As a result - we can optimize the code by not firing the wakeup
    // function (and avoid starting a gorotuine), especially given that
    // resourceVersion=0 is the most common case.
    if resourceVersion > 0 {
        go func() {
            // Wake us up when the time limit has expired.  The docs
            // promise that time.After (well, NewTimer, which it calls)
            // will wait *at least* the duration given. Since this go
            // routine starts sometime after we record the start time, and
            // it will wake up the loop below sometime after the broadcast,
            // we don't need to worry about waking it up before the time
            // has expired accidentally.
            <-w.clock.After(blockTimeout)
            w.cond.Broadcast()
        }()
    }

    w.RLock()
    span := tracing.SpanFromContext(ctx)
    span.AddEvent("watchCache locked acquired")
    for w.resourceVersion < resourceVersion {
        if w.clock.Since(startTime) >= blockTimeout {
            // Request that the client retry after 'resourceVersionTooHighRetrySeconds' seconds.
            return storage.NewTooLargeResourceVersionError(resourceVersion, w.resourceVersion, resourceVersionTooHighRetrySeconds)
        }
        w.cond.Wait()
    }
    span.AddEvent("watchCache fresh enough")
    return nil
}
```

If the cache can't catch up within those 3 seconds, the request times out.

If you've ever seen kubectl commands hang for exactly 3 seconds before returning data, this is why. The cache is waiting for events that will never come.

### The Problem with Quiet Resources

This is where things get tricky. For infrequently-updated resources (namespaces, configmaps, etc.):

```
T0: Namespace cache at RV 3044, no namespace changes for 5 minutes
T1: Other resources change (pods, services) → global etcd revision advances to 3047
T2: Namespace Watch stream receives... nothing (no namespace events)
T3: Namespace cache remains at RV 3044
T4: Client lists pods, receives response with RV 3047
T5: Client then requests consistent read of namespaces: "give me data at RV ≥ 3047"
T6: Namespace cache: "I'm at 3044, need 3047... waiting"
T7: (3 seconds later) Timeout!
```

The cache has no way to know if etcd has moved forward. Is the system healthy? Is something broken? It just sees... nothing.

### Timeout Behavior Summary

| Scenario | Cache RV | Requested RV | Result |
|----------|----------|--------------|--------|
| Fresh cache | 3047 | 3045 | ✓ Serve immediately |
| Stale cache | 3044 | 3047 | ⏱ Wait 3s → timeout |
| With progress | 3044 | 3047 | ✓ RequestProgress → serve |

## Progress Notifications: Keeping Quiet Resources Fresh

### What Are Progress Notifications?

Here's the trick: progress notifications are **empty Watch responses** that only update the revision:

```go
WatchResponse {
    Header: { Revision: 3047 },  // Current etcd revision
    Events: []                     // No actual data changes
}
```

They solve the quiet resource problem by telling the cache: "etcd is now at revision X, even though your resource hasn't changed."

This is exactly what we had forgotten to implement in our etcd-shim. We handled regular Watch events perfectly, but didn't support progress notifications. The result? Kubernetes' watch cache would timeout waiting for revisions that would never arrive through normal events. Once we added `RequestProgress` support and started sending these empty bookmark responses, the timeouts disappeared.

### Two Mechanisms

#### 1. On-Demand: RequestWatchProgress()

When the cache needs to catch up, it can explicitly request a progress notification. The implementation is beautifully simple. See [store.go:99-103](https://github.com/kubernetes/kubernetes/blob/release-1.34/staging/src/k8s.io/apiserver/pkg/storage/etcd3/store.go#L99-L103):

```go
func (s *store) RequestWatchProgress(ctx context.Context) error {
    return s.client.RequestProgress(s.watchContext(ctx))
}
```

When called, etcd responds with a bookmark (also called a progress notification) containing the current revision. The cache at revision 3044 calls `RequestProgress()`, receives `{ Revision: 3047, Events: [] }`, and immediately updates its internal state to 3047.

The progress notification is detected in the watch stream ([watcher.go:401-404](https://github.com/kubernetes/kubernetes/blob/release-1.34/staging/src/k8s.io/apiserver/pkg/storage/etcd3/watcher.go#L401-L404)):

```go
// Handle progress notifications (bookmarks)
if wres.IsProgressNotify() {
    wc.queueEvent(progressNotifyEvent(wres.Header.GetRevision()))
    metrics.RecordEtcdBookmark(wc.watcher.groupResource)
    continue
}
```

#### 2. Proactive: Periodic Progress Requests

Kubernetes also runs a background component called [progressRequester](https://github.com/kubernetes/kubernetes/blob/release-1.34/staging/src/k8s.io/apiserver/pkg/storage/cacher/cacher.go#L425-L428) that monitors quiet watches. This component detects when watches haven't received events for a while and periodically calls `RequestProgress()` to ensure even completely idle resources stay fresh. This proactive approach prevents timeout errors before they happen.

The progress requester is initialized when the Cacher is created ([cacher.go:425-428](https://github.com/kubernetes/kubernetes/blob/release-1.34/staging/src/k8s.io/apiserver/pkg/storage/cacher/cacher.go#L425-L428)):

```go
progressRequester := progress.NewConditionalProgressRequester(
    config.Storage.RequestWatchProgress,  // The function to call
    config.Clock,
    contextMetadata
)
```

## The Complete Flow

**Timeline showing how progress notifications solve the timeout:**

Picture this:

```
T0: Namespace watch established at revision 3044
    - No namespace changes happening

T1: Pod creates/updates → etcd revisions 3045, 3046, 3047
    - Namespace watch: silent (no namespace changes)
    - Cache still at 3044

T2: Client requests namespace LIST at RV 3047 (consistent read)
    - Cache checks: notFresh(3047) → true (stuck at 3044)
    - Starts waiting: waitUntilFreshAndBlock(3047)

T3: progressRequester detects quiet watch
    - Calls RequestProgress() on namespace watch stream

T4: etcd sends progress notification
    WatchResponse {
        Header: { Revision: 3047 },
        Events: []
    }

T5: Cache processes bookmark
    - Updates internal revision: 3044 → 3047
    - Signals waiters: "I'm fresh now!"

T6: waitUntilFreshAndBlock() returns (within 3 seconds)
    - Request served from cache successfully
```


## Key Takeaways

Here's what you need to know: Kubernetes runs a separate watch cache for each resource type (pods, services, deployments, etc.), and each one maintains its own LIST+WATCH loop. When you request a consistent read, the cache performs a freshness check with a **3-second timeout** via `waitUntilFreshAndBlock()`. Without this mechanism, you'd see 3-second hangs on every consistent read to quiet resources.

**Progress notifications** solve the critical problem of quiet resources: those that don't receive updates for extended periods. These empty Watch responses update the cache's revision without transferring data. Kubernetes implements this through two mechanisms: **on-demand** (explicit RequestProgress calls when the cache needs to catch up) and **proactive** (periodic monitoring by the progressRequester component).

Without progress notifications, consistent reads must bypass the cache entirely and go directly to etcd, significantly increasing load on the storage layer. This is the difference between a responsive cluster and one where every kubectl command feels sluggish.

## Related Posts

If you enjoyed this deep dive into Kubernetes watch caching, you might also be interested in:

- [Notes about ETCD](/posts/notes-about-etcd/) - An overview and collection of resources about etcd, the distributed key-value store that powers Kubernetes
- [Diving into ETCD's linearizable reads](/posts/diving-into-etcd-linearizable/) - A deep dive into how etcd implements linearizable reads using Raft consensus

---

Feel free to reach out with any questions or to share your experiences with Kubernetes watch caching. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

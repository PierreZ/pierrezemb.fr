+++
title = "Diving into ETCD's linearizable reads"
date = "2020-09-18T05:24:27+01:00"
draft = false
[taxonomies]
tags = ["distributed", "etcd", "raft", "consensus", "storage", "diving"]
+++

![etcd image](/images/diving-into-etcd-linearizable/etcd.png)

[Diving Into](/tags/diving/) is a blogpost serie where we are digging a specific part of the project's basecode. In this episode, we will digg into the implementation behind ETCD's Linearizable reads.

---

## What is ETCD?

From [the official website](https://etcd.io/):

> etcd is a strongly consistent, distributed key-value store that provides a reliable way to store data that needs to be accessed by a distributed system or cluster of machines. It gracefully handles leader elections during network partitions and can tolerate machine failure, even in the leader node.

ETCD is well-known to be Kubernetes's datastore, and a CNCF incubating project.

## Linea-what?

[Let's quote Kyle Kingsbury, a.k.a "Aphyr"](https://jepsen.io/consistency/models/linearizable), for this one:

> Linearizability is one of the strongest single-object consistency models, and implies that every operation appears to take place atomically, in some order, consistent with the real-time ordering of those operations: e.g., if operation A completes before operation B begins, then B should logically take effect after A.

## Why?

ETCD is using [Raft](https://raft.github.io/), a consensus algorithm at his core. As always, the devil is hidden in the details, or when things are going wrong. Here's an example:

1. `node1` is `leader` and heartbeating properly to `node2` and `node3`,
2. network partition is happening, and `node1` is isolated from the others.

At this moment, all the actions are depending on timeouts and settings. In a (close) future, all nodes will go into **election mode** and node 2 and 3 will be able to create a quorum. This can lead to this situation:

* `node1` thinks he is a leader as heartbeat timeouts and retry are not yet reached, so he can serve reads 😱
* `node2` and `node3` have elected a new leader and are working again, accepting writes.

This situation is violating Linearizable reads, as reads going through `node1` will not see the last updates from the current leader.

How can we solve this? One way is to use `ReadIndex`!

## ReadIndex

The basic idea behind this is to confirm that the **leader is true leader or not** by sending a message to the followers. If a majority of responses are healthy, then the leader can safely serve the reads. Let's dive into the implementation!

All codes are from the current latest release [v3.4.13](https://github.com/etcd-io/etcd/releases/tag/v3.4.13).

[Let's take a Range operation](https://github.com/etcd-io/etcd/blob/v3.4.13/etcdserver/v3_server.go#L114-L120):

```go
 if !r.Serializable {
  err = s.linearizableReadNotify(ctx)
  trace.Step("agreement among raft nodes before linearized reading")
  if err != nil {
   return nil, err
  }
 }
```

```go

func (s *EtcdServer) linearizableReadNotify(ctx context.Context) error {
 s.readMu.RLock()
 nc := s.readNotifier
 s.readMu.RUnlock()

 // signal linearizable loop for current notify if it hasn't been already
 select {
 case s.readwaitc <- struct{}{}:
 default:
 }

 // wait for read state notification
 select {
 case <-nc.c:
  return nc.err
 case <-ctx.Done():
  return ctx.Err()
 case <-s.done:
  return ErrStopped
 }
}
```

So in [linearizableReadNotify](https://github.com/etcd-io/etcd/blob/v3.4.13/etcdserver/v3_server.go#L773-L793), we are waiting for a signal. `readwaitc` is used in another goroutine called [linearizableReadLoop](https://github.com/etcd-io/etcd/blob/v3.4.13/etcdserver/v3_server.go#L672-L771). This goroutines will call this:

```go
func (n *node) ReadIndex(ctx context.Context, rctx []byte) error {
 return n.step(ctx, pb.Message{Type: pb.MsgReadIndex, Entries: []pb.Entry{{Data: rctx}}})
}

```

that will create a `MsgReadIndex` message that will be handled in [stepLeader](https://github.com/etcd-io/etcd/blob/v3.4.13/raft/raft.go#L994), who will send the message to the followers, like this:

```go
 case pb.MsgReadIndex:
  // If more than the local vote is needed, go through a full broadcast,
  // otherwise optimize.
  if !r.prs.IsSingleton() {
      // PZ: omitting some code here
   switch r.readOnly.option {
   case ReadOnlySafe:
    r.readOnly.addRequest(r.raftLog.committed, m)
    // The local node automatically acks the request.
    r.readOnly.recvAck(r.id, m.Entries[0].Data)
    r.bcastHeartbeatWithCtx(m.Entries[0].Data)
   case ReadOnlyLeaseBased:
    ri := r.raftLog.committed
    if m.From == None || m.From == r.id { // from local member
     r.readStates = append(r.readStates, ReadState{Index: ri, RequestCtx: m.Entries[0].Data})
    } else {
     r.send(pb.Message{To: m.From, Type: pb.MsgReadIndexResp, Index: ri, Entries: m.Entries})
    }
   }
```

So, the `leader` is sending a heartbeat in `ReadOnlySafe` mode. Turns out there is two modes:

```go
const (
 // ReadOnlySafe guarantees the linearizability of the read only request by
 // communicating with the quorum. It is the default and suggested option.
 ReadOnlySafe ReadOnlyOption = iota
 // ReadOnlyLeaseBased ensures linearizability of the read only request by
 // relying on the leader lease. It can be affected by clock drift.
 // If the clock drift is unbounded, leader might keep the lease longer than it
 // should (clock can move backward/pause without any bound). ReadIndex is not safe
 // in that case.
 ReadOnlyLeaseBased
)
```

Responses from the followers will be handled here:

```go
 case pb.MsgHeartbeatResp:
  // PZ: omitting some code here
  rss := r.readOnly.advance(m)
  for _, rs := range rss {
   req := rs.req
   if req.From == None || req.From == r.id { // from local member
    r.readStates = append(r.readStates, ReadState{Index: rs.index, RequestCtx: req.Entries[0].Data})
   } else {
    r.send(pb.Message{To: req.From, Type: pb.MsgReadIndexResp, Index: rs.index, Entries: req.Entries})
   }
  }
```

We are storing things into a `ReadState`:

```go
// ReadState provides state for read only query.
// It's caller's responsibility to call ReadIndex first before getting
// this state from ready, it's also caller's duty to differentiate if this
// state is what it requests through RequestCtx, eg. given a unique id as
// RequestCtx
type ReadState struct {
 Index      uint64
 RequestCtx []byte
}
```

Now that the state has been updated, we need to unblock our [linearizableReadLoop](https://github.com/etcd-io/etcd/blob/v3.4.13/etcdserver/v3_server.go#L672-L771):

```go
  for !timeout && !done {
   select {
   case rs = <-s.r.readStateC:
```

Cool, another channel! Turns out, `readStateC` is updated in [one of the main goroutine](https://github.com/etcd-io/etcd/blob/v3.4.13/etcdserver/raft.go#L162):

```go
// start prepares and starts raftNode in a new goroutine. It is no longer safe
// to modify the fields after it has been started.
func (r *raftNode) start(rh *raftReadyHandler) {
 internalTimeout := time.Second

 go func() {
  defer r.onStop()
  islead := false

  for {
   select {
   case <-r.ticker.C:
    r.tick()
   case rd := <-r.Ready():
    // PZ: omitting some code here
    if len(rd.ReadStates) != 0 {
     select {
     case r.readStateC <- rd.ReadStates[len(rd.ReadStates)-1]:
    }
```

Perfect, now `readStateC` is notified, and we can continue on [linearizableReadLoop](https://github.com/etcd-io/etcd/blob/v3.4.13/etcdserver/v3_server.go#L672-L771):

```go
  if ai := s.getAppliedIndex(); ai < rs.Index {
   select {
   case <-s.applyWait.Wait(rs.Index):
   case <-s.stopping:
    return
   }
  }
  // unblock all l-reads requested at indices before rs.Index
  nr.notify(nil)
```

The first part is a safety measure to makes sure the applied index is lower that the index stored in `ReadState`. And then finally we are unlocking all pending reads 🤩

## One more thing: Follower read

We went through `stepLeader` a lot, be there is something interesting in [`stepFollower`](https://github.com/etcd-io/etcd/blob/v4.3.13/raft/raft.go#L1320):

```go
 case pb.MsgReadIndex:
  if r.lead == None {
   r.logger.Infof("%x no leader at term %d; dropping index reading msg", r.id, r.Term)
   return nil
  }
  m.To = r.lead
  r.send(m)
```

This means that a follower can send a `MsgReadIndex` message to perform the same kind of checks than a leader. This small features is in fact enabling **follower-reads** on ETCD 🤩 That is why you can see `Range` requests from a `follower`.

## operational tips

* If you are running etcd <= 3.4, make sure **logger=zap** is set. Like this, you will be able to see some tracing logs, and I trully hope you will not witness this one:

```json
{
  "level": "info",
  "ts": "2020-08-12T08:24:56.181Z",
  "caller": "traceutil/trace.go:145",
  "msg": "trace[677217921] range",
  "detail": "{range_begin:/...redacted...; range_end:; response_count:1; response_revision:2725080604; }",
  "duration": "1.553047811s",
  "start": "2020-08-12T08:24:54.628Z",
  "end": "2020-08-12T08:24:56.181Z",
  "steps": [
    "trace[677217921] 'agreement among raft nodes before linearized reading'  (duration: 1.534322015s)" 
  ]
}
```

* there is [a random performance issue on etcd 3.4](https://github.com/etcd-io/etcd/issues/11884)
* there is some metrics than you can watch for ReadIndex issues:
  * `etcd_server_read_indexes_failed_total`
  * `etcd_server_slow_read_indexes_total`

---

**Thank you** for reading my post! feel free to react to this article, I'm also available on [Twitter](https://twitter.com/PierreZ) if needed.

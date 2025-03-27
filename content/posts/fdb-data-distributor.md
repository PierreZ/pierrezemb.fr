+++
title = "Debugging FoundationDB's Data Distributor"
description = "A deep dive into the internals of FoundationDB's Data Distributor and how it manages shard placement and team priorities."
date = 2025-03-07T00:00:00+01:00
[taxonomies]
tags = ["foundationdb", "debugging", "distributed", "database", "storage"]
+++

FoundationDB is a powerful, distributed database designed to handle massive workloads with high consistency guarantees. At its core, the **Data Distributor** plays a critical role in determining how shards are distributed across the cluster to maintain load balance and resilience.

In this post, we dive into the **Data Distributor's** internals, along with practical lessons we learned during a outage.

## What is the Data Distributor?

The **Data Distributor (DD)** is [a subsystem](https://apple.github.io/foundationdb/architecture.html) responsible for efficiently placing and relocating shards (range of keys) in a FoundationDB cluster. Its key goals are:
- Balancing load across servers
- Handling failures by redistributing data
- Ensuring optimal data placement for performance reliability

## Data Distributor wording

The architecture and behavior of the **Data Distributor** are documented in the [official design document](https://github.com/apple/foundationdb/blob/release-7.3/design/data-distributor-internals.md), and introduce the following concepts: 

- **Machine**: A failure domain in FoundationDB, often considered equivalent to a rack. 
- **Shard**: A range of key-values—essentially a contiguous block of the database keyspace.
- **Server Team**: A group of `k` processes (where `k` is the replication factor) hosting the same shard.
- **Machine Team**: A collection of `k` machines, ensuring fault isolation for redundancy.

The term "machine" in FoundationDB’s documentation **often translates better as "rack"** in many practical cases. Using racks makes the Machine Team's role clearer: it ensures fault isolation by storing copies of data in different racks.

## Debug DD with `status json`

Your first input point should be to have a look at the `team_trackers` key in the `status json`. The JSON should contain enough information for basic monitoring:

```json
"team_trackers": [
  {
    "primary": true,
    "unhealthy_servers": 0,
    "state": {
      "healthy": true,
      "name": "healthy_rebalancing"
    }
  }
```

## Debug DD with Trace events

FoundationDB provides a robust tracing system where each process generates detailed events in either XML or JSON formats. To troubleshoot the **Data Distributor**, you first need to locate the process it has been elected to. From there, trace events can be analyzed to understand shard movements, priorities, and failures.

One particularly important attribute in these events is the `Priority` field. This field determines the precedence of shard placement or redistribution tasks:

```cpp
init( PRIORITY_RECOVER_MOVE, 110 );
init( PRIORITY_REBALANCE_UNDERUTILIZED_TEAM, 120 );
init( PRIORITY_REBALANCE_OVERUTILIZED_TEAM, 122 );
init( PRIORITY_TEAM_UNHEALTHY, 700);
init( PRIORITY_SPLIT_SHARD, 950 );
```

A full list of defined priorities can be found in the [Knobs file](https://github.com/apple/foundationdb/blob/release-7.3/fdbclient/ServerKnobs.cpp#L155-L173), providing useful insights into how tasks are scheduled.

### `ServerTeamInfo` Event

Understanding the state of server teams is essential since the Data Distributor schedules data movements based on real-time metrics. The `fdbcli` command `triggerddteaminfolog` triggers informative logs by invoking [printSnapshotTeamsInfo](https://github.com/apple/foundationdb/blob/release-7.3/fdbserver/DDTeamCollection.actor.cpp#L3425).

```json
{
  "Type": "ServerTeamInfo",
  "Priority": "709",
  "Healthy": "0",
  "TeamSize": "3",
  "MemberIDs": "5a69... 5fc1... 8718...",
  "LoadBytes": "1135157527",
  "MinAvailableSpaceRatio": "0.94108"
}
```

### `ServerTeamPriorityChange` Event

This event is logged when server team priorities change, often indicating server failures or rebalancing actions.

```json
{
  "Type": "ServerTeamPriorityChange",
  "Priority": "950",
  "TeamID": "e9b362decbafbd81"
}
```

### `RelocateShard` Event

This event tracks shard movement between teams to maintain balance.

```json
{
  "Type": "RelocateShard",
  "Priority": "120", // PRIORITY_REBALANCE_UNDERUTILIZED_TEAM
  "RelocationID": "3f1290654949771e"
}
```

Again, the most useful field is the priority, indicating why it is relocated.

### "ValleyFiller" and "MountainChopper" Mechanisms

To optimize shard placement, FoundationDB employs two balancing strategies:

- **ValleyFiller**: Fills underutilized servers (the **valleys**) with data to balance the load.
- **MountainChopper**: Redistributes shards from overutilized servers (the **mountains**) to spread the load evenly.

Both logs will have a `SourceTeam` and `DestTeam` to use in other traces:

```json
{
  "Type": "BgDDValleyFiller",
  "QueuedRelocations": "0",
  "SourceTeam": "TeamID 95819f0d3d7ea40d",
  "DestTeam": "TeamID 0817e6fe3135e6f6",
  "ShardBytes": "398281250"
}
```
```json
{
  "Type": "BgDDMountainChopper",
  "QueuedRelocations": "0",
  "SourceTeam": "TeamID 95819f0d3d7ea40d",
  "DestTeam": "TeamID e17dcecd86547e09",
  "ShardBytes": "308000000"
}
```

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.

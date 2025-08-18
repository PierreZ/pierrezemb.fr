+++
title = "Shipped vs. Operated, or How Many Bash Scripts Does It Take?"
date = 2025-08-18
description = "The difference between shipped and operated software is the difference between something you can run and forget, and something that demands ongoing, hands-on care. Choosing the former protects your team’s focus and sanity."
draft = false
[taxonomies]
tags = ["distributed-systems", "operation"]
+++

> **Summary:** The difference between shipped and operated software is the difference between something you can run and forget, and something that demands ongoing, hands-on care. Choosing the former protects your team’s focus and sanity.

## The Shipped vs. Operated Spectrum

Some technologies arrive as complete systems: you deploy them, give them minimal care, and they quietly do their job. Others arrive like complex machines: powerful, but demanding regular attention and maintenance. That’s the difference between *shipped* and *operated*.

The distinction isn’t just about features; it’s about the level of operational effort the system will demand over its lifetime. **Operated** technologies require continuous human care to stay healthy. They age, drift, and accumulate operational quirks. They often have sharp edges you only discover at 2 a.m., and when something goes wrong, you need people who already know the failure modes by heart. Think of a self-managed **HBase** or a ZooKeeper ensemble that you *really* hope never splits brain.

**Shipped** technologies are built to reduce that constant overhead. They can still fail, but they tend to fail in ways that are predictable, recoverable, and not existential. You can learn them as you go. Your outages will be frustrating, but they won’t demand a dedicated handler on payroll. **FoundationDB** is a good example: it’s not magic, but its operational surface area is small enough to fit in a single human brain.  

For contrast, I’ve also spent years with the other kind: **HBase** clusters spread over 250+ nodes, **Ceph**, **Kafka** and **ZooKeeper** in various configurations, **Pulsar**, **Warp10**, **etcd**, **Kubernetes**, **Flink**, and **RabbitMQ**, each with its own set of operational “adventures.”

## Identifying Operated Systems

Some systems live in both worlds depending on how you use them. **PostgreSQL** in standalone mode is usually shipped: it’s simple to run, predictable, and rarely causes surprises. But under certain conditions, like fighting vacuum performance at scale or running it in HA mode under sustained heavy load, it shifts into operated territory. The difference isn’t in the codebase, but in the demands your use case puts on it.

A quick way to tell which camp your system belongs to is the **Bash Script Test**: ask how many bash scripts or home-grown tools are required to survive an on-call shift. If the answer includes a collection of automation to clean up data, shuffle it between nodes, or probe the cluster’s health, you’re probably in operated territory. I’ve been there: running `hbck` and manually moving regions in **HBase**, shuffling partitions around in **Kafka** to balance load, or triggering repairs in **Ceph** after failed scrub errors. Many distributed systems quietly rely on these manual interventions, often run weekly, to stay healthy, and that’s an operational cost you can’t ignore.  

By contrast, we have **no** such scripts for **FoundationDB**, and that’s exactly why it feels shipped.

## The Strategic Cost of Operations

Each operated system consumes a slice of your team’s focus. Add too many, and you’ll spend more time keeping the lights on than moving forward. The more you can choose robust, low-maintenance software, the more space you keep for actually building new things.

I’m not a fan of Kubernetes from an operational perspective. But it does something important for end users: it gives them a standard way to write software that reacts to the state of the infrastructure through [Operators](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/). Operators turn that into continuous automation, with a reconciliation loop that keeps drifting systems aligned with the desired state. It’s a way to bake SRE knowledge into code, so even complex systems can be run and handed over without months of hand-holding.

The stakes are only going to get higher as LLMs become a common tool for software engineers. We’ll inevitably build more advanced and complex systems, but that complexity doesn’t disappear; it gets pushed to the people on call. LLMs are good at fixing failures that are reproducible and deterministic, because they can alter the system freely, but most on-call incidents aren’t like that. The only way to keep operational load sustainable is to change how we design and test: building for robustness from the start, and using techniques like [simulation-driven development](/posts/simulation-driven-development/) to expose failure modes before they reach production.  

If you can, choose the system you can deploy and leave alone, not the complex machine that demands your weekends.

---


Feel free to reach out with any questions or to share your experiences with shipped/operated software. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
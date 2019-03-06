---
title: "Handling OVH's alerts with Apache Flink"
date: 2019-02-03T15:37:27+01:00
draft: false
categories:
  - flink

tags:
  - distributed-systems
  - flink

canonical: https://www.ovh.com/fr/blog/handling-ovhs-alerts-with-apache-flink/
---

This is a repost from [OVH's official blogpost.](https://www.ovh.com/fr/blog/handling-ovhs-alerts-with-apache-flink/ "Permalink to Handling OVH's alerts with Apache Flink"). Thanks [Horacio Gonzalez](https://twitter.com/LostInBrittany/) for the awesome drawings!

# Handling OVH's alerts with Apache Flink


![OVH & Apache Flink][1]

OVH relies extensively on **metrics** to effectively monitor its entire stack. Whether they are **low-level** or **business** centric, they allow teams to gain **insight** into how our services are operating on a daily basis. The need to store **millions of datapoints per second** has produced the need to create a dedicated team to build a operate a product to handle that load: [**Metrics Data Platform][2].** By relying on [**Apache Hbase][3], [Apache Kafka][4]** and [**Warp 10**][5], we succeeded in creating a fully distributed platform that is handling all our metrics… and yours!

After building the platform to deal with all those metrics, our next challenge was to build one of the most needed feature for Metrics: the **Alerting.**

## Meet OMNI, our alerting layer

OMNI is our code name for a **fully distributed**, **as-code**, **alerting** system that we developed on top of Metrics. It is split into components:

* **The management part**, taking your alerts definitions defined in a Git repository, and represent them as continuous queries,
* **The query executor**, scheduling your queries in a distributed way.

The query executor is pushing the query results into Kafka, ready to be handled! We now need to perform all the tasks that an alerting system does:

* Handling alerts **deduplication** and **grouping**, to avoid [alert fatigue. ][6]
* Handling **escalation** steps, **acknowledgement **or **snooze**.
* **Notify** the end user, through differents **channels**: SMS, mail, Push notifications, …

To handle that, we looked at open-source projects, such as [Prometheus AlertManager,][7] [LinkedIn Iris,][8] we discovered the _hidden_ truth:

> Handling alerts as streams of data,  
moving from operators to another.

We embraced it, and decided to leverage [Apache Flink][9] to create **Beacon**. In the next section we are going to describe the architecture of Beacon, and how we built and operate it.

If you want some more information on Apache Flink, we suggest to read the introduction article on the official website: [What is Apache Flink?][10]

## **Beacon architecture**

At his core, Beacon is reading events from **Kafka**. Everything is represented as a **message**, from alerts to aggregations rules, snooze orders and so on. The pipeline is divided into two branches:

* One that is running the **aggregations**, and triggering notifications based on customer's rules.
* One that is handling the **escalation steps**.

Then everything is merged to **generate** **a** **notification**, that is going to be forward to the right person. A notification message is pushed into Kafka, that will be consumed by another component called **beacon-notifier.**

![Beacon architecture][11]

Beacon architecture

## Handling States

If you are new to streaming architecture, I recommend reading [Dataflow Programming Model][12] from Flink official documentation.

![Handling state][13]

Everything is merged into a dataStream, **partitionned** ([keyed by ][14]in Flink API) by users. Here's an example:
```java
    final DataStream> alertStream =
    
      // Partitioning Stream per AlertIdentifier
      cleanedAlertsStream.keyBy(0)
      // Applying a Map Operation which is setting since when an alert is triggered
      .map(new SetSinceOnSelector())
      .name("setting-since-on-selector").uid("setting-since-on-selector")
    
      // Partitioning again Stream per AlertIdentifier
      .keyBy(0)
      // Applying another Map Operation which is setting State and Trend
      .map(new SetStateAndTrend())
      .name("setting-state").uid("setting-state");
```

In the example above, we are chaining two keyed operations:

* **SetSinceOnSelector**, which is setting **since** when the alert is triggered
* **SetStateAndTrend**, which is setting the **state**(ONGOING, RECOVERY or OK) and the **trend**(do we have more or less metrics in errors).

Each of this class is under 120 lines of codes because Flink is **handling all the difficulties**. Most of the pipeline are **only composed** of **classic transformations** such as [Map, FlatMap, Reduce][15], including their [Rich][16] and [Keyed][17] version. We have a few [Process Functions][18], which are **very handy** to develop, for example, the escalation timer.

## Integration tests

As the number of classes was growing, we needed to test our pipeline. Because it is only wired to Kafka, we wrapped consumer and producer to create what we call **scenari: **a series of integration tests running different scenarios.

## Queryable state

One killer feature of Apache Flink is the **capabilities of [****querying the internal state**][19]** of an operator**. Even if it is a beta feature, it allows us the get the current state of the different parts of the job:

* at which escalation steps are we on
* is it snoozed or _ack_-ed
* Which alert is ongoing
* and so on.

![Queryable state overview][20]Queryable state overview

Thanks to this, we easily developed an **API** over the queryable state, that is powering our **alerting view** in [Metrics Studio,][21] our codename for the Web UI of the Metrics Data Platform.

### Apache Flink deployment

We deployed the latest version of Flink (**1.7.1** at the time of writing) directly on bare metal servers with a dedicated Zookeeper's cluster using Ansible. Operating Flink has been a really nice surprise for us, with **clear documentation and configuration**, and an **impressive resilience**. We are capable of **rebooting** the whole Flink cluster, and the job is **restarting at his last saved state**, like nothing happened.

We are using **RockDB** as a state backend, backed by OpenStack **Swift storage **provided by OVH Public Cloud.

For monitoring, we are relying on [Prometheus Exporter][22] with [Beamium][23] to gain **observability** over job's health.

### In short, we love Apache Flink!

If you are used to work with stream related software, you may have realized that we did not used any rocket science or tricks. We may be relying on basics streaming features offered by Apache Flink, but they allowed us to tackle many business and scalability problems with ease.

![Apache Flink][24]

As such, we highly recommend that any developers should have a look to Apache Flink. I encourage you to go through [Apache Flink Training][25], written by Data Artisans. Furthermore, the community has put a lot of effort to easily deploy Apache Flink to Kubernetes, so you can easily try Flink using our Managed Kubernetes!


[1]: https://www.ovh.com/fr/blog/wp-content/uploads/2019/01/001-1.png?x70472
[2]: https://www.ovh.com/fr/data-platforms/metrics/
[3]: https://hbase.apache.org/
[4]: https://kafka.apache.org/
[5]: https://www.warp10.io/
[6]: https://en.wikipedia.org/wiki/Alarm_fatigue
[7]: https://github.com/prometheus/alertmanager
[8]: https://engineering.linkedin.com/blog/2017/06/open-sourcing-iris-and-oncall
[9]: https://flink.apache.org/
[10]: https://flink.apache.org/flink-architecture.html
[11]: https://www.ovh.com/fr/blog/wp-content/uploads/2019/01/002.png?x70472
[12]: https://ci.apache.org/projects/flink/flink-docs-release-1.7/concepts/programming-model.html
[13]: https://www.ovh.com/fr/blog/wp-content/uploads/2019/01/003.png?x70472
[14]: https://medium.com/r/?url=https%3A%2F%2Fci.apache.org%2Fprojects%2Fflink%2Fflink-docs-release-1.7%2Fdev%2Fstream%2Fstate%2Fstate.html%23keyed-state
[15]: https://ci.apache.org/projects/flink/flink-docs-release-1.7/dev/stream/operators/
[16]: https://ci.apache.org/projects/flink/flink-docs-stable/dev/api_concepts.html#rich-functions
[17]: https://ci.apache.org/projects/flink/flink-docs-stable/dev/stream/state/state.html#using-managed-keyed-state
[18]: https://ci.apache.org/projects/flink/flink-docs-release-1.7/dev/stream/operators/process_function.html
[19]: https://ci.apache.org/projects/flink/flink-docs-release-1.7/dev/stream/state/queryable_state.html
[20]: https://www.ovh.com/fr/blog/wp-content/uploads/2019/01/004-1.png?x70472
[21]: https://studio.metrics.ovh.net/
[22]: https://ci.apache.org/projects/flink/flink-docs-stable/monitoring/metrics.html#prometheus-orgapacheflinkmetricsprometheusprometheusreporter
[23]: https://github.com/ovh/beamium
[24]: https://www.ovh.com/fr/blog/wp-content/uploads/2019/01/0F28C7F7-9701-4C19-BAFB-E40439FA1C77.png?x70472
[25]: https://medium.com/r/?url=https%3A%2F%2Ftraining.da-platform.com%2F

  
---
title: "Handling alerts at OVH-Scale with Apache Flink"
date: 
lastmod: 2019-01-12T19:54:31+01:00
draft: true

categories:
    - streaming
---

![image](/posts/handling-alerts-at-ovhscale-with-apache-flink/images/1.png)

OVH relies extensively on **metrics** to effectively monitor its entire stack. Whenever **** they are **low-level** or **business** centric, they allow teams to gain **insight** into how our services are operating on a daily basis. The need to store **millions of datapoints per second**  has produced the need to create a dedicated team to handle the load: **Metrics Data Platform.** By relying on **Apache Hbase, Apache Kafka** and **Warp 10**, we succeeded in creating a fully distributed platform that is handling all our metrics and yours!


![image](/posts/handling-alerts-at-ovhscale-with-apache-flink/images/2.png)

Our record on ingestion side: more than 4M datapoints per second!



After succeeding in ingesting all that data, we started to work on the most needed feature for Metrics: **Alerting.**

### Meet OMNI, our alerting layer

Logo OMNI?

OMNI is an **fully distributed**, **as-code**, **alerting** system that we developed on top of Metrics. It is splitted into components:

*   **OMNI**, taking your alerts definitions defined in a Git repository, and represent them as continuous queries running on a project called **Loops**
*   **Loops**, scheduling your queries in a distributed way. 

Now that we have the result of our queries, we need to perform all the jobs that an alerting system does:

*   Handling alerts **deduplication** and **grouping**, to avoid [alert fatigue.](https://en.wikipedia.org/wiki/Alarm_fatigue)
*   Handling **escalation** steps, **acknowledgement** or **snooze**.
*   **Notify** the end user, through differents **channels**: SMS, mail, Push notifications, …

To handle that, we looked at open-source projects, such as [Prometheus AlertManager,](https://github.com/prometheus/alertmanager) [LinkedIn Iris,](https://engineering.linkedin.com/blog/2017/06/open-sourcing-iris-and-oncall) we discovered the _hidden_   truth: 

> Handling alerts are only a stream of data, moving from operators to another. 

We embraced it, and decided to leverage Apache Flink to create **Beacon**.

### **Beacon overview**

> If you don’t know about Apache Flink, the best way is to read the introduction article on the official website: [What is Apache Flink?](https://flink.apache.org/flink-architecture.html)

#### Architecture

![image](/posts/handling-alerts-at-ovhscale-with-apache-flink/images/3.png)

Beacon&#39;s overview

At his core, Beacon is reading events from **Kafka**. Everything is represented as a **message**, from alerts to aggregations rules, snooze orders and so on. The pipeline is divided into two branches:

*   One that is running the **aggregations**, and triggering notifications based on customer’s rules.
*   One that is handling the **escalation steps**.

Then everything is merged to **generate** **a** **notification**, that is going to be forward to the right person. A notification message is pushed into Kafka, that will be consumed by another component called **beacon-notifier.**

#### Handling State
> If you are new to streaming architecture, I recommend reading [Dataflow Programming Model](https://ci.apache.org/projects/flink/flink-docs-release-1.7/concepts/programming-model.html) from Flink official documentation.



![image](/posts/handling-alerts-at-ovhscale-with-apache-flink/images/4.png)



Everything is merged into a dataStream, **partitionned** ([keyed by] (https://ci.apache.org/projects/flink/flink-docs-release-1.7/dev/stream/state/state.html#keyed-state)in Flink API) by users. Here&#39;s an example:




In the example above, we are chaining two keyed operations:

*   **SetSinceOnSelector**, which is setting **since** when the alert is triggered
*   **SetStateAndTrend**, which is setting the **state** (ONGOING, RECOVERY or OK) and the **trend**(do we have more or less metrics in errors).

Each of this class is under 120 lines of codes because Flink is **handling all the difficulties**. Most of the pipeline are **only composed** of **classic transformations** such as [Map, FlatMap, Reduce](https://ci.apache.org/projects/flink/flink-docs-release-1.7/dev/stream/operators/), including their [Rich](https://ci.apache.org/projects/flink/flink-docs-stable/dev/api_concepts.html#rich-functions) and [Keyed](https://ci.apache.org/projects/flink/flink-docs-stable/dev/stream/state/state.html#using-managed-keyed-state)  version. We have a few [Process Functions](https://ci.apache.org/projects/flink/flink-docs-release-1.7/dev/stream/operators/process_function.html), which are **very handy** to develop, for example, the escalation timer.

#### Integration tests

As the number of classes was growing, we needed to test our pipeline. Because it is only wired to Kafka, we wrapped consumer and producer to create what we call **scenari:** a series of integration tests running different scenarios.

#### Queryable state




![image](/posts/handling-alerts-at-ovhscale-with-apache-flink/images/5.png)

Queryable state overview



One killer feature of Apache Flink is the **capabilities of** [**querying the internal state**](https://ci.apache.org/projects/flink/flink-docs-release-1.7/dev/stream/state/queryable_state.html) **of an operator**. Even if it is a beta feature, it allows us the get the current state of the different parts of the job:

*   at which escalation steps are we on
*   is it snoozed or acked
*   Which alert is ongoing
*   and so on. 

Thanks to this, we easily developed an **API** over the queryable state, that is powering our **alerting view** in [Metrics Studio.](https://studio.metrics.ovh.net/)

### Apache Flink deployment




![image](/posts/handling-alerts-at-ovhscale-with-apache-flink/images/6.png)

Apache Flink&#39;s logo



We deployed Flink directly on bare-metals servers with a dedicated Zookeeper’s cluster using Ansible. Operating Flink has been a really nice surprise for us, with **clear documentation and configuration**, and an **impressive resilience**. We are capable of **rebooting** the whole Flink cluster, and the job is **restarting at his last saved state**, like nothing happened.

We are using **RockDB** as a state backend, backed by OpenStack **Swift storage** provided by OVH Public Cloud.

For monitoring, we are relying on [Prometheus Exporter](https://ci.apache.org/projects/flink/flink-docs-stable/monitoring/metrics.html#prometheus-orgapacheflinkmetricsprometheusprometheusreporter) with [Beamium](https://github.com/ovh/beamium) to gain **observability** over job’s health.

Flink community is really **active**, with new releases every three months or so, we are running latest version of Flink (**1.7.1** at the time of writing) on our production cluster, and we are looking forward to use Flink for another project! 

If you want to learn more about Flink, I encourage you to go through [Apache Flink Training](https://training.da-platform.com/), written by Data Artisans.

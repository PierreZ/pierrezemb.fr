---
title: "10 years of programming and counting 🚀"
description: "A retrospective of the last 10 years"
date: 2020-09-28T10:24:27+01:00
draft: true 
showpagemeta: true
toc: false 
tags:
 - personal
---

I’ve just realized that I’ve spent the last decade programming 🤯 While 2020 feels like a strange year, I thought it would be nice to write down a retrospective of the last 10 years 🗓

## Learning to program 👨🏻‍💻
I wrote my first _Hello, world_ program somewhere around September 2010, when I started my engineering school. I wanted to do some electronics, but that C language got me. I spent 6 months struggling to understand pointers and memory. I remember spending nights trying to find a memory leak with valgrind. Of course there were multiples mistakes, but it felt good to dig that far.

I also discovered Linux around that time, and spent many nights playing with Linux commands. I started my journey to Linux with Centos and then Ubuntu 11.04. I think this started the loop I’m (still!) stuck in:
`for {tryNewDistro()}`
I’m pretty sure that if I wanted to go away from distributed systems, I would try to land a job around operating systems. So many things to learn 🤩

After learning C, we started to learn web-based technologies like HTML/CSS/JS/PHP. I remember struggling to generate a calendar with PHP 🐘 I learned about APIs the week after the project 😅 I remember digging into cookies, and network calls from popular websites to see how they were using it. 

## Java and Hadoop 🐘 

I had the chance to land a part-time internship during the third year (out of five) of my engineering school. I joined the Systems team, which was working around mainframes and Hadoop, another kind of 🐘. 
I remember spending a lot of time with my coworkers, learning things from them. It was my first time grasping the work around “system programming”. 

My first task was around writing an installer for a java app on windows, but my tutor tried to push me further. He saw my interest around some specific layers of their perimeter, such as Hadoop and Kafka. He gave to me a chance to work directly on those. A small API that was could load old monitoring data stored HDFS and expose them back into the “real-time” visualization tool. I also used Kafka and even deployed a small HBase cluster for testing. 

I can't thank my tutor enough for giving me this chance, and for allowing me to discover what will become my main focus: distributed systems.

## Let’s meet other people 👋 
Around the same time, I discovered tech meetups and conferences. At that time, Google I/O was a major event with people jumping from a plane and streaming it through Google Glass. I found out there was a group of people watching the live together. And this is how I discovered my local GDG/JUG 🥳 I learned so many things by watching local talks, even if it was difficult to grasp everything at first. I remember taking 📝 about what I didn’t understand, to learn about it later. 

I also met amazing persons, that are now friends and/or mentors. I remember feeling humble to be able to learn from them. 

I also discovered more global tech conferences. I asked as a birthday 🎁 to go to Devoxx France and DotScale, in 2014. It was awesome 😎 

By dint of watching talks, I wanted to give some. I started small, giving talks at my engineering school, then moved to the JUG itself. I learned **a lot** by making a lot of mistakes, but I’m pretty happy how things turned out, as I’m now speaking at tech conferences as part of my current work. 

I also started to be involved in events and organizations such as:
* The JUG/GDG
* A coworking place
* Startup Weekend
* Devoxx4kids 
* DevFest du bout du monde

## Learning big data 💾 
After my graduation and a(nother) part-time internship at OVH, I started working on something called Metrics Data Platform. It is the platform massively used internally to store, query and alert on timeseries data. We avoid the Borgmon approach (deploying Prometheus’s like database for every team), instead we created a unique platform to ingest all OVHcloud’s datapoints using a big-data approach. Here’s the key point of Metrics:

* **multi-tenant**: as we said before, a single metrics cluster is handling all telemetry, from servers to applications and smart data centers from OVHcloud. 
* **scalable**: today we are receiving around 1.8 million datapoints per second/s 🙈 for about 450 million timeseries 🙉. During European daytime, we are reading around 4.5 millions datapoints per seconds thank to Grafana’s auto-refresh mode 🙊
* **multi-protocol support**: we didn’t want to reflect our infrastructure choice to our users, so we wrote some proxies that can translate known protocols to our query language, so users can query and push data using OpenTSDB, Prometheus, InfluxDB and so on. 
* **based on open source** we are using Warp10 as the core of our infrastructure with Kafka and HBase. Alerting was built with Apache flink. We opensourced many softwares, from agent to our proxies. We also gave many talks about what we learnt. 

I had the chance to built Metrics from the ground. I started working on the management layer and proxies. Then I wanted to learn operations, so I learned it by deploying Hadoop clusters 🤯 it took me a while to be able to start doing on-calls. I cannot count how many nights I was up, trying to fix some buggy softwares, or yelling at HBase for an inconsistent `hbck`, or trying to find a way to handle a side effect of a loosing multiple racks. 

Our work was highly technical, and I loved it: 

* We optimized a lot of things, from HBase to our Go’s based proxies. `optimize HBase's data balancer` or `fix issues with Go’s gc`  was almost a normal task to do
* We saw Metrics’s growth, from hundred to millions of datapoints 😎 we saw systems breaking at scale, causing us to rewrite software or change architecture. Production became the, last but final, test.
* Every software we developed had a `keep it simple, yet scalable` policy, and doing on-calls was a good way to ensure software quality. We all learned it the hard way I guess 🤣 
* We were only 4 to 6 to handle ~800 servers, 3 Hadoop clusters, and thousands of lines of Java/Go/Rust/Ansible codes. 

As always, things were not always magical, and i struggled more time than I can count. I learned that personal struggle is more difficult than technical, as you can always drill-down your tech problems by reading the code. The team was amazing 🚀, and we were helping each other a lot 🤝

## Searching for planets 🔭 🪐 

When I started working on Metrics, we did a lot of internal on boarding. At his core, metrics is usine Warp10, which is coming with his own language to analyze timeseries. This provides heavy query-capabilities, but as it is stack-based, getting started was difficult. I needed a project to dive into timeseries analysis.

I love astronomy 🔭, but there’s too much ☁️ (not the servers) in my city. I decided to look for astronomical timeseries. Turns out there is a lot, but one use case triggered my interest: exoplanet’s search. Almost everything from NASA is Opendata, so we decided to create [HelloExoWorld](https://helloexo.world/).

We imported the **25TB dataset into a Warp10 instance** and start writing some WarpScript to search for transits. We wrote a [hands-on about it](https://helloexoworld.github.io/hew-hands-on/). We also did several labs in french conferences like Devoxx and many others. 


## IO timeout 🚧
Around 2018, OVHcloud started Managed Kubernetes, a free K8S control-plane. With this product we saw more developers coming to OVHcloud. We started thinking about how we could help them. Running stateful systems is **hard**, so maybe we could offer them some databases or queues in a As-a-Service fashion. We started to design such products from our Metrics experience. We started the IO Vision to offer `popular Storage APIs in front of a scalable storage`. Does it sound familiar? 😇 I had a lot of fun working on that vision as a Technical Leader. 

We started with queuing with ioStream. We wanted something that was:
* Multi-tenant
* Multi-protocol
* Geo-replicated natively
* Less operation burden at scale than Kafka

We built ioStream around Apache Pulsar, and opened the beta around September, 2019. As the same time we were working on Kafka’s support as a proxy in Rust. Writing a proxy translating Kafka’s TCP frames to Pulsar’s was a **fun and challenging work**. Rust is really a nice language to write such softwares. 

Then we worked with Apache Pulsar’s PMC to introduce a Kafka protocol handler on Pulsar brokers. I had the chance to work closely to two PMCs, it was an amazing experience for me 🚀 You can read about our collaboration [here](https://www.ovh.com/blog/announcing-kafka-on-pulsar-bring-native-kafka-protocol-support-to-apache-pulsar/).

Unfortunately as stated by the official communication, the project has been shut down: 

```
However, the limited success of the beta service and other strategic focuses,
have resulted in us taking the very difficult decision to close it.
```

I learned a lot of things, both technically and on the product-side, especially considering the fact that it was shutdown.

## Today

After ioStream’s shutdown, most of the team moved to create a new LBaaS. I helped them wrote an operator to schedule HAProxy’s containers on a Kubernetes cluster. It was a nice introduction to operators. 

Then I decided to join the Managed Kubernetes team. This is my current team now, where I’m having a lot of fun working around ETCD.

I really hope the next 10 years will be as fun as the last 10 years 😇

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.
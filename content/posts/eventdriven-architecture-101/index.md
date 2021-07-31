---
title: "Event-driven architecture 101"
author: "Pierre Zemb"
date: 2016-05-13T17:19:23.788Z
lastmod: 2019-01-10T21:57:01+01:00
showpagemeta: true
canonical: https://medium.com/@PierreZ/event-driven-architecture-101-d8e13cc4c656
categories:
  - programming
  - event

---

**update 2019:** this is a repost on my own blog. original article can be read on [medium](https://medium.com/@PierreZ/event-driven-architecture-101-d8e13cc4c656).

---


![image](/posts/eventdriven-architecture-101/images/1.png)

Do your own cover on [http://dev.to/rly](http://dev.to/rly)

_I’m still a student, so my point of view could be far from reality, be gentle ;)_

**_tl;dr: Queue messaging are cool. Use them at the core of your architecture._**I’m currently playing a lot around [Kafka](https://kafka.apache.org/) and [Flink](https://flink.apache.org/) at work. I also discovered [Vert.x](http://vertx.io/) at my local JUG. All three have a common word: **events**. Event-driven architecture is not something that I learned at school, and I think that’s a shame. It’s really powerful and useful, especially in a world where we speak more and more about “serverless” and “micro services” stuff. So here’s my attempt to make a big sum-up.

# the Unix philosophy

![image](/posts/eventdriven-architecture-101/images/2.gif)


I’m a huge fan of GNU/Linux. I just love my terminal. It’s been difficult at the beginning, but now, I consider myself fluent with it. My favorite feature ? **Pipes or |**. For those who don’t know, it’s the ability to pass the result of the command to another command. For example, to count how many files you have in a folder, you’ll find yourself doing something like this:

*   **list files** in a folder
*   From this list, **manipulate/filter** it. One line must correspond to one file, things like folder are omitted
*   And then **count** the line!

In the UNIX world, it should give you something like “**_ls -l | grep ^- | wc -l”._** it might feels like chinese. For me, it’s just feels logical. **3 operations mapped into 3 commands.** You declare a set a commands that, in the end, give you the result. It’s simple and also very fast (in fact, you can find funny articles like this one: [Command-line tools can be 235x faster than your Hadoop cluster](http://aadrake.com/command-line-tools-can-be-235x-faster-than-your-hadoop-cluster.html)). This is only possible thanks to the **UNIX philosophy**, greatly describe by Doug McIlroy, Elliot Pinson and Berk Tague in 1978:

> Make each program do one thing well. To do a new job, build afresh rather than complicate old programs by adding new “features”.> Expect the output of every program to become the input to another, as yet unknown, program.

Why should I care? It’s 2016, not 1978! Well…

# Back in 2016

![image](/posts/eventdriven-architecture-101/images/3.gif)


Cloud changed everything in terms of software engineering. **We can now deploy applications without thinking about the underlying server**. How cool is that? Let’s take some steps back. Now that you can easily deploy a huge application, what can be accomplished? Well, if I can deploy one app with ease, **Why should I deploy only one huge app ?** why can’t I deploy multiples applications instead of one? **Let’s call theses applications micro services** because we are in 2016.


![image](/posts/eventdriven-architecture-101/images/4.png)

OK, so now I’m applying the first rule of the UNIX Philosophy, because I have multiples programs that are doing one job each. But about the second rule? **How can they communicate? How can we simulate UNIX pipes?** Before answering, let’s answer to another question first: **What do we really need to send through our network?** Don’t forget the  [**Fallacies of distributed computing**](https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing)**…**

Let’s take an example. We are a new startup, and we are building our plateform. We’ll certainly need to handle our customers. Let’s say that for each new customer, **we need to make two actions**: add it to our database, and then to our mailing-list. **A simple and classical way would be to just call two functions** (whether on the same applications or not), and then say to the customer: “You’re successfully registered”. Like this:

![image](/posts/eventdriven-architecture-101/images/5.png)

Classic approach

Is there another approach? Let’s use an **event-based architecture**:

# **Let’s talk events**

Let’s ask Google, what’s an event?

> a thing that happens, especially one of importance.

Well, handling a new customer is a thing that happens (hopefully). For this, we’ll be using a **Queue messaging system or Broker**. It’s a **middleware** that will **receive events, and making them available for another application or groups of applications.**


![image](/posts/eventdriven-architecture-101/images/6.gif)

Queue messaging architecture with 2 producers and 4 consumers


So let’s rethink our architecture. Pay attention to the words: our Register page will **produce** an event that will contains all the information about our client. This event will be **queued**, waiting to be **consumed** by the associated micro services.


![image](/posts/eventdriven-architecture-101/images/7.png)

Simple event-driven architecture

We didn’t changed much, but we enable many things over here:

*   **Simplicity**. Remember, the first rule ! “Make each program do one thing well”. Like this, your **code base for each app will be simple** **as hell**, and you’ll be able to easily replace your software if needed.
*   **Modularity**. You need to add another action to the event, for example CreateProfile ? Easy, **just plug another app on the same queue**. You need to test a new version of your program? Easy, **just plug it on the same queue**.
*   **Scalability**. One of your micro services is taking too much time? **Just start a new instance of it**. Huge traffic? Add new instances. With this approach, you can start really small and become giant.
*   **Big-data friendly.** This type of architecture is often used to handle a lot of data. With plateform like [Apache Flink](http://flink.apache.org), you can do some **stream processing directly**. [Look how easy it is](https://ci.apache.org/projects/flink/flink-docs-master/apis/streaming/index.html#example-program).
*   **Polyglotism.** Most messaging system are offering libraries for many languages.**Like this, you can use whatever language you want** . But be aware, _With great power comes great responsibility_.

# **What about serverless?**

Serverless is the “new” buzz word. Ignited by Amazon with their product [AWS Lambda](https://aws.amazon.com/lambda/) and quickly followed by [Google](https://cloud.google.com/functions/docs), [Microsoft](https://azure.microsoft.com/en-us/services/functions/), [IBM](https://new-console.ng.bluemix.net/openwhisk/) and [Iron.io](https://www.iron.io/introducing-aws-lambda-support), the goal is to **offer to developers a new way of building apps**. Instead of writing apps, **you’ll just write a function that will respond to an event**. In fact, you’ll be paying only for the time it’s running. It’s a interesting point-of-view, because you’ll be **deploying an architecture built only using events**. I must admit that I didn’t try it yet, but I think i**t’s a great idea to force developers to split their apps and really think about events,** but you could just build the same thing with any cloud provider.

# Additional links and talks about this topic

*   [Apache Kafka, Samza, and the Unix Philosophy of Distributed Data](http://www.confluent.io/blog/apache-kafka-samza-and-the-unix-philosophy-of-distributed-data) by [Martin Kleppmann](https://medium.com/u/13be457aed12)
*   [Apache Kafka for Beginners](http://blog.cloudera.com/blog/2014/09/apache-kafka-for-beginners/) by Cloudera Engineering Blog
*   [Introduction to Apache Kafka](https://www.voxxed.com/blog/2016/04/introduction-apache-kafka/) by Guglielmo Iozza
*   [Apache Flink Training] (http://dataartisans.github.io/flink-training/)by data-artisans
* Meetup LeboncoinTech — AMQP 101 by [Quentin ADAM](https://medium.com/u/58ea5a89aaae) (French sorry)
* vert.x 3 — be reactive on the JVM but not only in Java by Clement Escoffier/Paulo Lopes DEVOXX 2015

Please, Feel free to react to this article, you can reach me on [Twitter](https://twitter.com/PierreZ), or have a look on my [website](https://pierrezemb.fr).

---
title: "Diving into Kafka's Protocol"
date: 2019-12-08T15:00:00+01:00
draft: false

showpagemeta: true
categories:
 - kafka
 - diving into
---

![kafka image](/posts/diving-into-kafka-protocol/img/apache-kafka.png)

[Diving Into](/tags/diving-into/) is a blogpost serie where we are digging a specific part of of the project's basecode. In this episode, we will digg into Kafka's protocol.

---

# The protocol reference

For the last few months, I worked a lot around Kafka's protocols, first by creating a fully async Kafka to Pulsar Proxy in Rust, and now by contributing directly to [KoP (Kafka On Pulsar)](https://www.slideshare.net/streamnative/2-kafkaonpulsarjia). The full Kafka Protocol documentation is available [here](https://kafka.apache.org/protocol.html), but it does not offer a global view of what is happening for a classic Producer and Consumer exchange. Let's dive in!

## Common handshake

After a client established the TCP connection, there is a few common requests and responses that are almost always here.

The common handhake can be divided in three parts:

* Being able to understand each other. For this, we are using **[API_VERSIONS](https://kafka.apache.org/protocol.html#The_Messages_ApiVersions)** to know which versions of which TCP frames can be uses,
* Establish Auth using **SASL** if needed, thanks to **[SASL_HANDSHAKE](https://kafka.apache.org/protocol.html#The_Messages_SaslHandshake)** and **[SASL_AUTHENTICATE](https://kafka.apache.org/protocol.html#The_Messages_SaslAuthenticate)**,
* Retrieve the topology of the cluster using **[METADATA](https://kafka.apache.org/protocol.html#The_Messages_Metadata)**.


> All exchange are based between a Kafka 2.0 cluster and client.

> All the following diagrams are generated with [MermaidJS](https://mermaidjs.github.io/#/).

{{<mermaid>}}
sequenceDiagram

    Note left of KafkaClient: I'm speaking Kafka <br/> 2.3,but can the <br/> broker understand <br/> me?

    KafkaClient ->>+ Broker0: API_VERSIONS request

    Note right of Broker0: I can handle theses <br/> structures in theses <br/>versions: ...
    Broker0 ->>- KafkaClient: 

    Note left of KafkaClient: Thanks!<br/> I see you can handle <br/> SASL, let's auth! <br/> can you handle <br/> SASL_PLAIN?
    KafkaClient ->>+ Broker0: SASL_HANDSHAKE request

    Note right of Broker0: Yes I can handle <br/> SASL_PLAIN <br/> among others
    Broker0 ->>- KafkaClient: 

    Note left of KafkaClient: Awesome, here's <br/> my credentials!
    KafkaClient ->>+ Broker0: SASL_AUTHENTICATE request

    Note right of Broker0: Checking...
    Note right of Broker0: You are <br/>authenticated!
    Broker0 ->>- KafkaClient: 

    Note left of KafkaClient: Cool! <br/> Can you give <br/> the cluster topology?<br/> I want to <br/> use 'my-topic'
    KafkaClient ->>+ Broker0: METADATA request

    Note right of Broker0: There is one topic <br/> with one partition<br/> called 'my-topic'<br/>The partition's leader <br/> is Broker0
    Broker0 ->>- KafkaClient: 

Note left of KafkaClient: That is you, I don't <br/> need to handshake <br/> again with <br/> another broker

{{</mermaid>}}

## Producing

The **[PRODUCE](https://kafka.apache.org/protocol.html#The_Messages_Produce)** API is used to send message sets to the server. For efficiency it allows sending message sets intended for many topic partitions in a single request.

{{<mermaid>}}
sequenceDiagram

    Note over KafkaClient,Broker0: ...handshaking, see above...

    loop pull msg
        Note left of KafkaClient: I have a batch <br/> containing one <br/> message for the <br/> partition-0 <br/> of 'my-topic'
        KafkaClient ->>+ Broker0: PRODUCE request

        Note right of Broker0: Processing...<br/>
        Note right of Broker0: Done!
        Broker0 ->>- KafkaClient: 
        
        Note left of KafkaClient: Thanks
    end

{{</mermaid>}}

## Consuming

Consuming is more complicated than producing. You can learn more in [The Magical Group Coordination Protocol of Apache Kafka](https://www.youtube.com/watch?v=maJulQ4ABNY) By Gwen Shapira, Principal Data Architect @ Confluent and also in the [Kafka Client-side Assignment Proposal](https://cwiki.apache.org/confluence/display/KAFKA/Kafka+Client-side+Assignment+Proposal).

Consuming can be divided in three parts:

* coordinating the consumers to assign them partitions, using:
    * **[FIND_COORDINATOR](https://kafka.apache.org/protocol.html#The_Messages_FindCoordinator)**,
    * **[JOIN_GROUP](https://kafka.apache.org/protocol.html#The_Messages_JoinGroup)**,
    * **[SYNC_GROUP](https://kafka.apache.org/protocol.html#The_Messages_SyncGroup)**,
* then fetch messages using:
    * **[OFFSET_FETCH](https://kafka.apache.org/protocol.html#The_Messages_OffsetFetch)**,
    * **[LIST_OFFSETS](https://kafka.apache.org/protocol.html#The_Messages_ListOffsets)**,
    * **[FETCH](https://kafka.apache.org/protocol.html#The_Messages_Fetch)**,
    * **[OFFSET_COMMIT](https://kafka.apache.org/protocol.html#The_Messages_OffsetCommit)**,
* Send lifeproof to the coordinator using **[HEARTBEAT](https://kafka.apache.org/protocol.html#The_Messages_Heartbeat)**.

For the sake of the explanation, we have now another Broker1 which is holding the coordinator for topic 'my-topic'. In real-life, it would be the same.

{{<mermaid>}}
sequenceDiagram

    Note over KafkaClient,Broker0: ...handshaking, see above...

    Note left of KafkaClient: Who is the <br/> coordinator for<br/> 'my-topic'?
    KafkaClient ->>+ Broker0: FIND_COORDINATOR request

    Note right of Broker0: It is Broker1!
    Broker0 ->>- KafkaClient: 

    Note left of KafkaClient: OK, let's connect<br/> to Broker1
    Note over KafkaClient,Broker1: ...handshaking, see above...

    Note left of KafkaClient: Hi, I want to join a <br/> consumption group <br/>for 'my-topic'
    KafkaClient ->>+ Broker1: JOIN_GROUP request

    Note right of Broker1: Welcome! I will be <br/> waiting a bit for any <br/>of your friends.
    Note right of Broker1: You are now leader. <br/>Your group contains <br/> only one member.<br/> You now  need to <br/> assign partitions to <br/> them. 
    Broker1 ->>- KafkaClient: 

    Note left of KafkaClient: Computing <br/>the assigment...
    Note left of KafkaClient: Done! I will be <br/> in charge of handling <br/> partition-0 of <br/>'my-topic'
    KafkaClient ->>+ Broker1: SYNC_GROUP request

    Note right of Broker1: Thanks, I will <br/>broadcast the <br/>assigmnents to <br/>everyone
    Broker1 ->>- KafkaClient: 

    Note left of KafkaClient: Can I get the <br/> committed offsets <br/> for partition-0<br/>for my consumer<br/>group?
    KafkaClient ->>+ Broker1: OFFSET_FETCH request

    Note right of Broker1: Found no <br/>committed offset<br/> for partition-0
    Broker1 ->>- KafkaClient: 

    Note left of KafkaClient: Thanks, I will now <br/>connect to Broker0

    Note over KafkaClient,Broker0: ...handshaking again...

    opt if new consumer-group
        Note left of KafkaClient: Can you give me<br/> the earliest position<br/> for partition-0?
        KafkaClient ->>+ Broker0: LIST_OFFSETS request
        
        Note right of Broker0: Here's the earliest <br/> position: ...
        Broker0 ->>- KafkaClient: 
    end 
    loop pull msg

        opt Consume
            Note left of KafkaClient: Can you give me<br/> some messages <br/> starting  at offset X?
            KafkaClient ->>+ Broker0: FETCH request

            Note right of Broker0: Here some records...
            Broker0 ->>- KafkaClient: 

            Note left of KafkaClient: Processing...
            Note left of KafkaClient: Can you commit <br/>offset X?
            KafkaClient ->>+ Broker1: OFFSET_COMMIT request

            Note right of Broker1: Committing...
            Note right of Broker1: Done!
            Broker1 ->>- KafkaClient: 
        end

        Note left of KafkaClient: I need to send <br/> some lifeness proof <br/> to the coordinator           
        opt Healthcheck
            Note left of KafkaClient: I am still alive!  
            KafkaClient ->>+ Broker1: HEARTBEAT request
            Note right of Broker1: I hear you
            Broker1 ->>- KafkaClient: 
        end
    end 
{{</mermaid>}}

--- 

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.
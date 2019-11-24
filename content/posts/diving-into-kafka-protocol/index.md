---
title: "Diving into Kafka's Protocol"
date: 2019-11-17T10:24:27+01:00
draft: true
showpagemeta: true
tags:
 - kafka
 - diving into
---

![kafka image](/posts/diving-into-kafka-protocol/img/kafka.png)

[Diving Into](/tags/diving-into/) is a blogpost serie where we are digging a specific part of of the project's basecode. In this episode, we will digg into Kafka's protocol.

---

# The protocol reference

For the last few months, I worked a lot around Kafka's protocols, first by creating a fully async Kafka to Pulsar in Rust, and now by contributing directly to Pulsar on the feature called [KoP (Kafka On Pulsar)](https://www.slideshare.net/streamnative/2-kafkaonpulsarjia). The full Protocol documentation is available [here](https://kafka.apache.org/protocol.html), but it does not offer a global view of what is happening for a classic Producer and Consumer. Let's dive in!

## Common handshake

After a client established the TCP connection, there is a few common requests and responses that are almost always here.

The common handhake can be divided in three parts:

* Being able to understand each other. For this, we are using **API_VERSIONS** to know which versions of which TCP frames can be uses,
* Establish Auth using **SASL** if needed,
* Retrieve the topology of the cluster using **Metadata**.


{{<mermaid>}}
sequenceDiagram

    Note left of KafkaClient: I'm speaking Kafka <br/> 2.3,but can the <br/> broker understand <br/> me?

    KafkaClient ->> Broker0: API_VERSIONS request

    Note right of Broker0: I can handle theses <br/> structures in theses <br/>versions: ...
    Broker0 ->> KafkaClient: API_VERSIONS response

    rect rgb(52, 73, 94)
        Note left of KafkaClient: Thanks!<br/> I see you can handle <br/> SASL, let's auth! <br/> can you handle <br/> SASL_PLAIN?
        KafkaClient ->> Broker0: SASL_HANDSHAKE request

        Note right of Broker0: Yes I can handle <br/> SASL_PLAIN <br/> among others
        Broker0 ->> KafkaClient: SASL_HANDSHAKE response

        Note left of KafkaClient: Awesome, here's <br/> my credentials!
        KafkaClient ->> Broker0: SASL_AUTHENTICATE request

        Note right of Broker0: Checking...
        Note right of Broker0: You are <br/>authenticated!
        Broker0 ->> KafkaClient: SASL_AUTHENTICATE response
    end

    Note left of KafkaClient: Cool! <br/> Can you give <br/> the cluster topology?<br/> I want to <br/> use 'my-topic'
    KafkaClient ->> Broker0: METADATA request

    Note right of Broker0: There is one topic <br/> with one partition<br/> called 'my-topic'<br/>The partition's leader <br/> is Broker0
    Broker0 ->> KafkaClient: METADATA response

Note left of KafkaClient: That is you, I don't <br/> need to handshake <br/> again with <br/> another broker

{{</mermaid>}}

## Producing

The produce API is used to send message sets to the server. For efficiency it allows sending message sets intended for many topic partitions in a single request.

{{<mermaid>}}
sequenceDiagram

    Note over KafkaClient,Broker0: ...handshaking, see above...

    loop pull msg
        Note left of KafkaClient: I have a batch <br/> containing one <br/> message for the <br/> partition-0 <br/> of 'my-topic'
        KafkaClient ->>+ Broker0: PRODUCE request

        Note right of Broker0: Processing...<br/>
        Note right of Broker0: Done!
        Broker0 -->>- KafkaClient: PRODUCE response
        Note left of KafkaClient: Thanks
    end

{{</mermaid>}}

## Consuming

Consuming is more complicated than producing. You can learn more in [The Magical Group Coordination Protocol of Apache Kafka](https://www.youtube.com/watch?v=maJulQ4ABNY) By Gwen Shapira, Principal Data Architect @ Confluent.

Consuming can be divided in two parts:

* coordonating the consumers to assign them partitions,
* then fetch messages.

For the sake of the explanation, we have now another Broker1 which is holding the coordinator for topic 'my-topic'. In real-life, it could be the same.

{{<mermaid>}}
sequenceDiagram

    Note over KafkaClient,Broker0: ...handshaking, see above...
    rect rgb(52, 73, 94)

        Note left of KafkaClient: Who is the <br/> coordinator for<br/> 'my-topic'?
        KafkaClient ->> Broker0: FIND_COORDINATOR request

        Note right of Broker0: It is Broker1!
        Broker0 ->> KafkaClient: FIND_COORDINATOR response

        Note left of KafkaClient: OK, let's connect<br/> to Broker1
        Note over KafkaClient,Broker1: ...handshaking, see above...

        Note left of KafkaClient: Hi, I want to join a <br/> consumption group <br/>for 'my-topic'
        KafkaClient ->>+ Broker1: JOIN_GROUP request

        Note right of Broker1: Welcome! I will be <br/> waiting a bit for any <br/>of your friends.
        Note right of Broker1: You are now leader. <br/>Your group contains  <br/> only one member. You <br/> now need to asign <br/>partitions to them. 
        Broker1 ->> KafkaClient: JOIN_GROUP response

        Note left of KafkaClient: Computing <br/>the assigment...
        Note left of KafkaClient: Done! I will be <br/> in charge of handling <br/> partition-0 of <br/>'my-topic'
        KafkaClient ->> Broker1: SYNC_GROUP request

        Note right of Broker1: Thanks, I will <br/>broadcast the <br/>assigmnents to <br/>everyone
        Broker1 ->> KafkaClient: SYNC_GROUP response

    end
        Note over KafkaClient,Broker0: ...handshaking again...
    rect rgb(52, 73, 94)

        Note left of KafkaClient: Can you give me <br/> the current offsets?
        KafkaClient ->> Broker0: OFFSET_FETCH request

        Note right of Broker0: Here's a valid offset <br/> range: ...
        Broker0 ->> KafkaClient: OFFSET_FETCH response

        Note left of KafkaClient: Thanks!
        KafkaClient ->> Broker0: LIST_OFFSETS request
        
        Broker0 ->> KafkaClient: LIST_OFFSETS response
    
        loop pull msg
            KafkaClient ->> Broker0: FETCH request
            Broker0 ->> KafkaClient: FETCH response
                    opt At the same time...
                KafkaClient ->> Broker1: HEARTBEAT request
                Broker1 ->>- KafkaClient: HEARTBEAT response
        end
        end
    end 
{{</mermaid>}}
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

For the last few months, I worked a lot around Kafka's protocols, first in Rust and then in Java. The full documentation is available [here](https://kafka.apache.org/protocol.html), but it does not offer a global view of what is happening for a classic Producer and Consumer. Let's dive in!

## Common handshake

After a client established the TCP connection, there is a few common requests and responses that are almost always here.


{{<mermaid>}}
sequenceDiagram

    Note left of KafkaClient: I'm speaking Kafka <br/> 2.3,but can the <br/> broker understand <br/> me?

    KafkaClient ->> KafkaBroker: API_VERSIONS request

    Note right of KafkaBroker: I can handle theses <br/> structures in theses <br/>versions: ...
    KafkaBroker ->> KafkaClient: API_VERSIONS response

    Note left of KafkaClient: Thanks!<br/> I see you can handle <br/> SASL, let's auth!

    KafkaClient ->> KafkaBroker: SASL_HANDSHAKE request
    KafkaBroker ->> KafkaClient: SASL_HANDSHAKE response

    KafkaClient ->> KafkaBroker: SASL_AUTHENTICATE request
    KafkaBroker ->> KafkaClient: SASL_AUTHENTICATE response

    KafkaClient ->> KafkaBroker: METADATA request
    KafkaBroker ->> KafkaClient: METADATA response
{{</mermaid>}}

## Producing

Now that the handshake, let's see what is happening during production!

{{<mermaid>}}
sequenceDiagram

    KafkaClient ->> KafkaBroker: PRODUCE request
    KafkaBroker ->> KafkaClient: PRODUCE response
{{</mermaid>}}

## Consuming


{{<mermaid>}}
sequenceDiagram
    KafkaClient ->> KafkaBroker: FIND_COORDINATOR request
    KafkaBroker ->> KafkaClient: FIND_COORDINATOR response

    Note left of KafkaClient: OK, let's connect!<br/>

    Note over KafkaClient,Coordinator: ...handshaking again...

    KafkaClient ->> Coordinator: JOIN_GROUP request
    Coordinator ->> KafkaClient: JOIN_GROUP response

    KafkaClient ->> Coordinator: SYNC_GROUP request
    Coordinator ->> KafkaClient: SYNC_GROUP response

    Note over KafkaClient,KafkaBroker: ...handshaking again...

    KafkaClient ->> KafkaBroker: OFFSET_FETCH request
    KafkaBroker ->> KafkaClient: OFFSET_FETCH response

    KafkaClient ->> KafkaBroker: LIST_OFFSETS request
    KafkaBroker ->> KafkaClient: LIST_OFFSETS response
    
    loop pull msg
        KafkaClient ->> KafkaBroker: FETCH request
        KafkaBroker ->> KafkaClient: FETCH response
    end

    opt At the same time...
        KafkaClient ->> Coordinator: HEARTBEAT request
        Coordinator ->> KafkaClient: HEARTBEAT response
    end



{{</mermaid>}}
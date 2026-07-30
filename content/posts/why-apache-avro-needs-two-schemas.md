+++
title = "Why Apache Avro Needs Two Schemas"
description = "Avro payloads cannot be decoded without the writer schema, and that two-schema model is what makes rolling upgrades and schema evolution work."
date = 2026-07-30
draft = true
[taxonomies]
tags = ["avro", "database", "foundationdb", "software-engineering"]
+++

We have been using [Apache Avro](https://avro.apache.org/) for years as one of the binary encodings for [Materia](https://www.clever-cloud.com/materia/)'s records stored in FoundationDB. A few weeks ago, while writing the code that adds a new type of header for a new component, I made a mistake. I serialized the records, stored the bytes, and moved on. Only later did I realize I had forgotten something essential: I wasn't preserving the writer schema.

At first, it didn't seem like a problem. My application already knew the latest schema, so surely it could decode the data. Unfortunately, that's not how Avro works, and more importantly, that's not how long-lived data should work.

## Avro bytes don't know what they are

Avro's binary encoding is deliberately compact. [The specification](https://avro.apache.org/docs/1.12.0/specification/) states that binary encoded data "does not include field names, self-contained information about the types of individual bytes, nor field or record separators". A record is just its field values concatenated in the order the schema declares them, an int is a zig-zag varint, a string is a length followed by UTF-8 bytes. A decoder discovers none of this from the payload, it walks the schema and consumes bytes in exactly the order the writer produced them. Without the writer schema, those bytes are just bytes.

This is why Avro always assumes the writer schema is available somehow. [**Object Container Files**](https://avro.apache.org/docs/1.12.0/specification/#object-container-files) embed it in the file header. [**Single Object Encoding**](https://avro.apache.org/docs/1.12.0/specification/#single-object-encoding) prefixes the payload with a fingerprint of the writer schema, which is only a lookup key: you still need a schema store to turn it back into a schema. If you use raw binary Avro, like I was doing inside FoundationDB, you have to provide it yourself.

## Why do we need two schemas?

This is probably the question I answer most often.

> Why does Avro need both a writer schema and a reader schema?

Because they solve different problems. The **writer schema** describes the data that actually exists on disk. The **reader schema** describes the structure expected by the software reading that data today. Schema evolution is the process of reconciling those two versions, and without the writer schema there is nothing to reconcile against.

## What can you actually change?

When the two schemas differ, Avro resolves them field by field, matching fields by name. The [schema resolution rules](https://avro.apache.org/docs/1.12.0/specification/#schema-resolution) permit more than people expect:

- **Add a field**: declare it with a default value, and the reader fills it in when decoding records written before the field existed.
- **Remove a field**: the reader skips writer fields it doesn't declare. The trap is the other direction: an old reader falls back to its own default, so the default must already be deployed before you remove the field.
- **Rename a field**: declare the old name as an **alias** in the reader schema. Aliases only work forward: a reader deployed before the rename fails on the missing field, or worse, if the field has a default, silently reads the default instead of the written value.
- **Reorder fields**: free, since resolution matches by name, not position.
- **Widen types**: int promotes to long, float, or double, long to float or double, float to double, and string and bytes are interchangeable. Promotion is one-way too: once records are written as long, an int reader cannot decode them.

The rule that falls out of this is to give every field a default from day one, because a default turns a missing field into a value instead of a decode error. For nullable fields that means `["null", "string"]` with `default: null`, since implementations like the Java one validate the default against the union's first branch.

## Why readers come first

Those resolution rules are what make rolling upgrades work, as long as you deploy them in the right order. Imagine a service running two instances behind a load balancer, App A and App B. To keep the example simple, both read and write Avro-encoded values stored in Redis, both start at version 1, and the only schemas an instance knows are the ones compiled into its binary, there is no registry to fetch unknown ones from.

Now you deploy version 2. If App A, upgraded first, immediately starts writing schema V2, App B is stuck: it has never seen V2, so it doesn't hold the writer schema those records were encoded with. How compatible the change was doesn't matter, you cannot reconcile against a schema you don't know. As soon as App B reads a newly written record, the deployment is broken.

{% mermaid() %}
sequenceDiagram
    participant A as App A (upgraded, writes V2)
    participant R as Redis
    participant B as App B (still V1)

    A->>R: put(record), encoded with V2 writer schema
    B->>R: get(record)
    R-->>B: V2 bytes
    Note over B: decode fails: B has never seen V2,<br/>there is no writer schema to resolve against
{% end %}

Instead, App A starts with:

* Reader schema: V2
* Writer schema: V1

{% mermaid() %}
sequenceDiagram
    participant A as App A (upgraded: reads V2, writes V1)
    participant R as Redis
    participant B as App B (still V1)

    A->>R: put(record), encoded with V1 writer schema
    B->>R: get(record)
    R-->>B: V1 bytes, decodes fine
    Note over A,B: once every instance understands V2, switch writers to V2
{% end %}

App A understands both versions but keeps writing V1 until App B is upgraded too, then you switch the writer schema to V2. I prefer making that switch an explicit operational step through an API call rather than a deploy side effect. Readers stay ahead of writers, and a normal rolling upgrade is enough.

It gets worse when several programs share the same data. In Materia, one FoundationDB cluster hosts multiple layers, each on its own deployment schedule, so an internal encoding bump has to be synchronized across every layer that reads those records before the writer schema can move forward.

## Keeping old schemas is a feature

One criticism I occasionally hear is that Avro forces you to keep historical schemas around forever. That's true, and I think it's one of its best properties. Every schema version becomes part of your compatibility contract: when you introduce V5, you should be able to verify that records written by V0, V1, V2, V3, and V4 are still readable. Those old schemas stop being dead code and become regression tests. Instead of hoping schema evolution still works, you can prove it.

In the layers we build on top of Materia, that contract is explicit. Every record type declares its full schema lineage, each version tagged with the **generation** it starts writing from, and the store remembers the generation it was last reconciled to. That stamp pins the writer schema: a generation-2 binary opening a store stamped at generation 1 keeps writing V1 records, exactly as the older binaries do, and bumping the stamp is an explicit reconcile step, not a side effect of deploying a new binary.

{% mermaid() %}
sequenceDiagram
    participant App as App (generation 2 binary)
    participant Store

    App->>Store: put(record), encoded with V1 writer schema (stamp is 1)
    Note over App,Store: every instance now understands generation 2
    App->>Store: reconcile_to(Generation(2))
    Store-->>App: stamp bumped to generation 2
    App->>Store: put(record), encoded with V2 writer schema
{% end %}

This is the readers-first deployment from earlier, enforced by the store instead of by discipline.

## What about Protobuf?

Avro's decode path is defined over two schemas and cannot run without both, while a Protobuf decoder only ever consults one. Each Protobuf field is prefixed with a tag packing the field number and a wire type, so a decoder can skip fields it doesn't recognize even without a descriptor, it just cannot interpret them. That makes Protobuf feel schema-optional and moves evolution into rules on the schema source: never reuse a field number, only make wire-compatible changes. The price is tag bytes on every field, and that nothing forces you to record which schema wrote a given byte. Avro forces exactly that, so the compatibility question is always answerable against the data you have.

I've walked the Protobuf-on-FDB path myself: in September 2020 I shipped [Record-Store](/posts/announcing-record-store/), an experimental layer exposing the [FDB Record Layer](https://github.com/FoundationDB/fdb-record-layer) over gRPC, with Protobuf definitions as the schema. The Record Layer stores its file descriptors inside FDB and built meta-data evolution by hand. The point fixes shipped in February 2019 ([descriptor mismatches](https://github.com/FoundationDB/fdb-record-layer/issues/3), an [evolution validator](https://github.com/FoundationDB/fdb-record-layer/issues/85)), but the [meta-data evolution super-issue](https://github.com/FoundationDB/fdb-record-layer/issues/283) opened in January 2019 is still open seven years later, and so is [the stale meta-data problem during rolling upgrades](https://github.com/FoundationDB/fdb-record-layer/issues/965), the exact readers-first scenario above. That's a big part of why Materia uses Avro as its main encoding: I wanted the flexibility of the two-schema model.

## The mistake

Looking back, my mistake had nothing to do with FoundationDB, and it wasn't even really an Avro mistake. **Data outlives software**: the application that writes a record today will eventually disappear, the bytes won't. I think this is the main reason writing Materia is so complicated. We have to enforce correctness, always be able to read something back, and stay backward compatible with records written by the very first Materia services. A mistake in a distributed multi-tenant service gets fixed with background work and per-tenant migration workflows, and mine left dedicated code in the codebase whose only job is to detect the records written without a fingerprint. Avro's reader and writer schema model exists because tomorrow's software shouldn't have to guess how yesterday's data was written.

How does your system decode the records it wrote five years ago?

---

Feel free to reach out with any questions or to share your experiences with schema evolution. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

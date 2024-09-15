---
title: "Announcing Record-Store, a new (experimental) place for your data"
description: "Opensourcing Record-Store"
images:
  - /posts/notes-about-foundationdb/images/fdb-white.jpg
date: 2020-09-23T10:24:27+01:00
draft: false

showpagemeta: true
toc: false 
categories:
 - FoundationDB
 - oss 
---

TL;DR: I'm really happy to announce my latest open-source project called Record-Store 🚀 Please check it out on [https://pierrez.github.io/record-store](https://pierrez.github.io/record-store).

## What?

`Record-Store` is a [layer](https://apple.github.io/foundationdb/layer-concept.html) running on top of [FoundationDB](https://foundationdb.org). It provides abstractions to create, load and deletes customer-defined data called `records`, which are hold into a `RecordSpace`. We would like to have this kind of flow for developers:

1. Opening RecordSpace, for example `prod/users`
2. Create a protobuf definition which will be used as schema
3. Upsert schema
4. Push records
5. Query records
6. delete records

You need another `KeySpace` to store another type of data, or maybe a `KeySpace` dedicated to production env? Juste create it and you are good to go!

## Features

It is currently an experiment, but it already has some strong features:

* **Multi-tenant** A `tenant` can create as many `RecordSpace` as we want, and we can have many `tenants`.

* **Standard API** We are exposing the record-store with standard technologies:
  * [gRPC](https://grpc.io)
  * *very experimental* [GraphQL](https://graphql.org)

* **Scalable** We are based on the same tech behind [CloudKit](https://www.foundationdb.org/files/record-layer-paper.pdf) called the [Record Layer](https://github.com/foundationdb/fdb-record-layer/),

* **Transactional** We are running on top of [FoundationDB](https://www.foundationdb.org/). FoundationDB gives you the power of ACID transactions in a distributed database.

* **Encrypted** Data are encrypted by default.

* **Multi-model** For each `RecordSpace`, you can define a `schema`, which is in-fact only a `Protobuf` definition. You need to store some `users`, or a more complicated structure? If you can represent it as [Protobuf](https://developers.google.com/protocol-buffers), you are good to go!

* **Index-defined queries** Your queries's capabilities are defined by the indexes you put on your schema.

* **Secured** We are using [Biscuit](https://github.com/CleverCloud/biscuit), a mix of `JWT` and `Macaroons` to ensure auth{entication, orization}.

## Why?

Lately, I have been playing a lot with my [ETCD-Layer](https://github.com/PierreZ/fdb-etcd) that is using the [Record-Layer](https://github.com/foundationdb/fdb-record-layer/). Thanks to it, I was able to bootstrap my ETCD-layer very quickly, but I was not using a tenth of the capacities of this library. So I decided to go deeper. **What would a gRPC abstraction of the Record-Layer look like?**

The name of this project itself is a tribute to the Record Layer as we are exposing the layer within a gRPC interface.

## Try it out

Record-Store is open sourced under Apache License V2 in [https://github.com/PierreZ/record-store](https://github.com/PierreZ/record-store) and the documentation can be found [https://pierrez.github.io/record-store](https://pierrez.github.io/record-store).

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.

+++
title= "Providing safety to FoundationDB's rust crate"
description= "Tips and tricks I'm using to provide safety in fundationdb's crate"
date= 2025-02-15T00:37:27+01:00

[taxonomies]
tags= ["foundationdb", "rust", "simulation"]
+++

As we approach 5 million downloads of the FoundationDB Rust crate (4,998,185 at the time of writing), I wanted to share some insights into how I ensure the safety of the crate. Being the primary maintainer of a database driver comes with responsibility, but I sleep well at night knowing that we have robust safety measures in place.

## Crate overview

The Rust crate, foundationdb-rs, provides bindings to interact with FoundationDB's C API (libfdb). It has around 13k LoC and is used by companies (like Clever Cloud) and projects (such as Apache OpenDAL, SurrealDB). I've been involved into too many outages and issues with Rust drivers to not be stressed about it. If we want to have safety around the crate, we need to provide safety on 3 layers:

* the real client, `libfdb`,
* the crate itself, 
* the code that is using the crate.

Let's dive in each items.

## libfdb's safety

This is the easiest part. `libfdb`'s safety is garanteed by FoundationDB's [simulation framework](https://apple.github.io/foundationdb/testing.html). As such, we can consider it safe.

## foundationdb-rs's safety

Because we are using a C library, we need to go full FFI and unsafe mode. We have around 130 unsafes blocks in total, so we need to be extra careful about calling all C code, making sure that all preconditions are met, and so on. As you can imagine, we have some testing going on, but most importantly, we are running tests on high cardinality:

* On multiple OS(Ubuntu, macOS)
* On multiple FDB's versions(From FDB 6.1 to 7.3)
* On multiple Rust compiler version(MSRV, stable, beta, nightly)

The most useful test here is nightly, as we can catch [new behaviors in the Rust compiler pretty early](https://github.com/foundationdb-rs/foundationdb-rs/issues/90).

This is great, but our best tool is something provided by FDB's maintainer. Let's dive-in.

### The BindingTester

FDB is well-known for their implications into [simulation and testing](https://apple.github.io/foundationdb/testing.html). Binding are no exception. They developed the BindingTester, a cross-language validation suite ensuring that all bindings behave correctly and consistently across different languages.

The BindingTester is using a stack-based machine to insert operations to do in FoundationDB. Then a program is reading the stack machine and make operations. The operations are runned twice, one in the targetted environment, and against an implementation that is used as the reference. Then any difference is reported by the BindingTester.

The great advantage of this method is that the test are seeded, meaning that the operations are randomly selected to cover all bindings usages. We can combine this with code coverage to have a pretty good idea of what has been tested(at the cost of variating code coverage).

We are running the BindingTester every hour on our Github actions, which represents around 219 days of continuous testing every month (316,335 minutes of correctness last month). 

## users's safety

Thanks to libfdb and the BindingTester, we can ensure that the library is pretty safe. Now how about user's code? How can we help the users knows that it can handle all FoundationDB's caveats, such as [commit_unknown_result](/posts/automatic-txn-fdb-730/#transactions-with-unknown-results)?

My company contributed a great feature: the ability to include rust code **within FDB's simulation framework**. 
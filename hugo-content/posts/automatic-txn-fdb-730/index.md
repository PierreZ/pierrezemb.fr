---
title: "True idempotent transactions with FoundationDB 7.3"
description: "Learn how to avoid FDB's biggest caveats by using a new feature called automatic idempotency in FoundationDB"
draft: false
date: 2024-03-12T00:37:27+01:00
showpagemeta: true
toc: true
images:
categories:
- foundationdb
- distributed-systems
---

I have been working around [FoundationDB](https://foundationdb.org) for several years now, and the new upcoming version is fixing one of the most evil and painful caveats you can deal with when writing layers: `commit_unknown_result`.

##  Transactions with unknown results

When you start writing code with FDB, you may be under the assertions that given the database’s robustness, you will not experience some strange behavior under certain failure scenarios. Turns out, there is one scenario that is possible to reach, and quickly explained in the official [documentation](https://apple.github.io/foundationdb/developer-guide.html#transactions-with-unknown-results):

>  As with other client/server databases, in some failure scenarios a client may be unable to determine whether a transaction succeeded. In these cases, commit() will raise a [`commit_unknown_result`](https://apple.github.io/foundationdb/api-error-codes.html#developer-guide-error-codes) exception. The on_error() function treats this exception as retriable, so retry loops that don’t check for [`commit_unknown_result`](https://apple.github.io/foundationdb/api-error-codes.html#developer-guide-error-codes) could execute the transaction twice. In these cases, you must consider the idempotency of the transaction.

While having idempotent retry loops is possible, sometimes it is not possible, for example when using atomic operations to keep track of statistics.

> Is this problem worth fixing? Seems a really edgy case 🤔

It truly depends whether it is acceptable for your transaction to be committed twice. For most of the case, it is not, but sometimes developers are not aware of this behavior, leading to errors. This is one of the reasons why we worked and open-sourced a way to embed rust-code within FoundationDB’s simulation framework. Using the simulation crate, your layer can be tested like FDB, and I can assure you: you **will see** those transactions in simulation 🙈.

This behavior has given headache to my colleagues, as we tried to bypass correctness and validation code in simulation when transactions state are unknown, and who could blame us? Validate the correctness of your code is hard when certains transactions (for example, one that could clean everything) are “maybe committed”. Fortunately, the community has released a workaround for this: [`automatic idempotency`](https://github.com/apple/foundationdb/blob/release-7.3/documentation/sphinx/source/automatic-idempotency.rst).

## Automatic idempotency

The documentation is fairly explicit:

>  Use the automatic_idempotency transaction option to prevent commits from failing with `commit_unknown_result` at a small performance cost.

The option appeared in FoundationDB 7.3, and could solve our issue. I decided to give it a try and modify the foundationdb-simulation crate example. The example is trying to use a atomic increment under simulation. Before 7.1, during validation, we had to write [some code](https://github.com/foundationdb-rs/foundationdb-rs/blob/98136cbea1c9b8d40ea9a599438ce0fa8d0297c0/foundationdb-simulation/examples/atomic/workload.rs#L99C1-L99C94) that looks like this:

```rust
// We don't know how much maybe_committed transactions has succeeded,
// so we are checking the possible range
if self.success_count <= count
   && count <= self.expected_count + self.maybe_committed_count {
// ...
```

As I was adding 7.3 support in the crate, I decided to update the example and try the new option:

```rust
// Enable idempotent txn
 trx.set_option(TransactionOption::AutomaticIdempotency)?;
```

If the behavior is correct, I can simplify my consistency checks:

```rust
if self.success_count == count {
    self.context.trace(
        Severity::Info,
        "Atomic count match",
        details![],
     );
}
// ...
```

I’ve been running hundreds of seeds on my machine and everything works great: no more maybe-committed transactions! Now that 7.3 support is merged in the rust bindings, we will be able to expands our testing thanks to our simulation farm. I'm also looking to see the performance impact of the feature, even if I'm pretty sure that it will outperform any layer-work.

This is truly a very useful feature and I hope this option will be turned on by default on the next major release. The initial PR can be found [here](https://github.com/apple/foundationdb/pull/8398 ).

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) if needed.
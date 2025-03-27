+++
title= "Ensuring Safety in FoundationDB's Rust Crate"
description= "Strategies and techniques for enhancing safety in the FoundationDB Rust crate"
date= 2025-02-11T00:00:00+01:00

[taxonomies]
tags= ["foundationdb", "rust", "testing", "database", "distributed"]
+++

As we approach 5 million downloads of the [FoundationDB Rust crate](https://crates.io/crates/foundationdb) (4,998,185 at the time of writing), I wanted to share some insights into how I ensure the safety of the crate. Being the primary maintainer of a database driver comes with responsibility, but I sleep well at night knowing that we have robust safety measures in place.

## Crate Overview

The Rust crate, `foundationdb-rs`, provides bindings to interact with FoundationDB's C API (`libfdb`). It has around 13k lines of code and is used by companies (like Clever Cloud) and projects (such as Apache OpenDAL, SurrealDB). Having experienced numerous outages and issues with drivers and distributed systems, I understand the importance of safety. To ensure the safety of the crate, we need to focus on three layers:

- The underlying client, `libfdb`,
- The crate itself,
- The code that uses the crate.

Let's dig into each of these areas.

## libfdb Safety

This is the simplest part. `libfdb`'s safety is guaranteed by FoundationDB's [simulation framework](https://apple.github.io/foundationdb/testing.html). Therefore, we can consider it safe.

### Classic testing suite

Since we are using a C library, we need to use FFI (Foreign Function Interface) and unsafe code blocks. With around 130 unsafe blocks, we must be extra careful when calling C code, ensuring all preconditions are met. Naturally, we conduct extensive testing, but most importantly, we run tests in high-variety environments:

- On multiple operating systems (Ubuntu, macOS)
- On multiple FoundationDB versions (from FDB 6.1 to 7.3)
- On multiple Rust compiler versions (Minimum Supported Rust Version or MSRV, stable, beta, nightly)

The most useful tests are run on the nightly Rust compiler, as we can catch [new behaviors in the Rust compiler early](https://github.com/foundationdb-rs/foundationdb-rs/issues/90).

While these testing practices provide significant coverage, the most powerful tool we utilize comes from FoundationDB’s maintainers: the `BindingTester`.

### The BindingTester

FoundationDB is renowned for its [simulation and testing](https://apple.github.io/foundationdb/testing.html) frameworks. Bindings are no exception. They developed the BindingTester, a cross-language validation suite ensuring that all bindings behave correctly and consistently across different languages.

The BindingTester uses [a stack-based machine](https://github.com/apple/foundationdb/blob/main/bindings/bindingtester/spec/bindingApiTester.md) to queue operations for FoundationDB. A program then reads the stack and performs the operations. These operations are run twice: once in the target environment and once against a reference implementation. Any differences are reported by the BindingTester.

It looks like this:

```shell
./bindings/bindingtester/bindingtester.py --num-ops 1000 --api-version 730 --test-name api --compare python rust

Creating test at API version 730
Generating api test at seed 3208032894 with 1000 op(s) and 1 concurrent tester(s)...

# Inserting Rust tests
Inserting test into database...
Running tester '/home/runner/work/foundationdb-rs/foundationdb-rs/target/debug/bindingtester test_spec 730'...

Reading results from '('tester_output', 'workspace')'...
Reading results from '('tester_output', 'stack')'...

# Inserting Python tests
Inserting test into database...
Running tester 'python /home/runner/work/foundationdb-rs/foundationdb-rs/target/foundationdb_build/foundationdb/bindings/bindingtester/../python/tests/tester.py test_spec 730'...

Reading results from '('tester_output', 'workspace')'...
Reading results from '('tester_output', 'stack')'...

# Comparing the results
Comparing results from '('tester_output', 'workspace')'...
Comparing results from '('tester_output', 'stack')'...
Test with seed 3208032894 and concurrency 1 had 0 incorrect result(s) and 0 error(s) at API version 730
Completed api test with random seed 3208032894 and 1000 operations
```

The great advantage of this method is that the tests are seeded, meaning the operations are:
* randomly selected to cover all binding usages,
* deterministic, so a failing seed can be replayed locally.

Combined with code coverage, this gives us a good idea of what has been tested (though code coverage may vary).

We run the `BindingTester` **every hour** on our GitHub actions, amounting to **around 219 days of continuous testing each month** (316,335 minutes of correctness last month according to Github).

## User Safety

Thanks to `libfdb` and the `BindingTester`, we can ensure that the library is quite safe. But what about the user's code? How can we help users ensure their code can handle all of FoundationDB's caveats, such as [commit_unknown_result](/posts/automatic-txn-fdb-730/#transactions-with-unknown-results)? We added a great feature: the ability to include Rust code **within FDB's simulation framework**.


We can implement an Rust workload with the following Trait:

```rust
pub trait RustWorkload {
    fn description(&self) -> String;
    fn setup(&'static mut self, db: SimDatabase, done: Promise);
    fn start(&'static mut self, db: SimDatabase, done: Promise);
    fn check(&'static mut self, db: SimDatabase, done: Promise);
    fn get_metrics(&self) -> Vec<Metric>;
    fn get_check_timeout(&self) -> f64;
}
```

Which can be runned inside the simulation while injecting some faults:

```shell
fdbserver -r simulation -f /root/atomic.toml -b on --trace-format json

# Choosing a random seed
Random seed is 394378360...

# Then, everything is derived from the seed, including:
# * cluster topology,
# * cluster configuration,
# * timing to inject faults,
# * operations to run
# * ...
Datacenter 0: 3/12 machines, 1/1 coordinators
Datacenter 1: 3/12 machines, 0/1 coordinators
Datacenter 2: 3/12 machines, 0/1 coordinators
Datacenter 3: 3/12 machines, 0/1 coordinators

# Starting the Atomic workload
Run test:AtomicWorkload start

AtomicWorkload complete
checking test (AtomicWorkload)...

5 test clients passed; 0 test clients failed
Run test:AtomicWorkload Done.

1 tests passed; 0 tests failed.

Unseed: 66324
Elapsed: 405.055622 simsec, 30.342000 real seconds
```

This has been a **major keypoint** for us to develop and operate [Materia, Clever Cloud's serverless database offer](https://www.clever-cloud.com/materia/), as we can enjoy the same Simulation framework used by FDB's core engineers for layer engineering 🤯

## Closing words

As with any open-source project, there is always more to accomplish, but I am quite satisfied with the current level of safety provided by the crate. I would like to express my gratitude to the FoundationDB community for developing the BindingTester, and former contributors to the crate.

I also would like to encourage everyone to explore the simulation framework. Integrating Rust code within this framework has allowed us to harness the full potential of simulation without the need to build our own, and it has forever changed my perspective on testing and software engineering.

There is a strong likelihood that future blog posts will focus on simulation, so feel free to explore the [simulation tags](/tags/simulation/).
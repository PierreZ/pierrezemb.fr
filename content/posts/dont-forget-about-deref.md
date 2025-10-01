+++
title = "Don't Forget About Deref"
description = "How Rust's Deref trait solved a complex API design problem in FoundationDB-rs without traits or enums"
date = 2025-10-01
[taxonomies]
tags = ["rust", "foundationdb", "programming", "metaprogramming"]
+++

While working on [FoundationDB-rs](https://github.com/foundationdb-rs/foundationdb-rs), I hit a design problem that seemed like it would require complex trait gymnastics. I had two transaction types with identical APIs but different ownership semantics, and I needed functions to accept both. The solution turned out to be embarrassingly simple. It was already implemented.

## The Problem: Two Transaction Types, One API

FoundationDB-rs has two transaction types that do exactly the same thing but with different ownership models:

```rust
pub struct Transaction {
    inner: NonNull<fdb_sys::FDBTransaction>,
    metrics: Option<TransactionMetrics>,
}

pub struct RetryableTransaction {
    inner: Arc<Transaction>,  // Arc needed for retry loop ownership
}
```

**Why two types?** FoundationDB requires retry loops for handling conflicts and retriable errors. The `Transaction` is perfect when you're managing retries manually or doing single-shot operations. The `RetryableTransaction` wraps it in an `Arc` so the automatic retry machinery in `Database::run()` can clone references across async boundaries and exponential backoff delays.

The challenge: users need to write code that works with both. Real FoundationDB applications mix both patterns depending on the use case.

## The Obvious Solutions Didn't Work

My first instinct was creating a trait. But FoundationDB-rs operates directly on raw C pointers (`NonNull<fdb_sys::FDBTransaction>`) with custom `Future` implementations that handle FFI complexity and error mapping. Writing a trait with async methods that return these custom futures means associated types, lifetime bounds, and complex error handling. The resulting trait becomes painful to use and understand.

I considered an enum wrapper:

```rust
enum AnyTransaction<'a> {
    Regular(&'a Transaction),
    Retryable(&'a RetryableTransaction),
}
```

But this felt wrong. Users would need to match everywhere, and it adds runtime overhead for what should be a compile-time decision. Plus it doesn't feel natural to use.

## The Accidental Solution

The `RetryableTransaction` already had this implementation for convenience:

```rust
impl Deref for RetryableTransaction {
    type Target = Transaction;
    fn deref(&self) -> &Transaction {
        self.inner.deref()
    }
}
```

I'd added this so users could call transaction methods directly on `RetryableTransaction` instances. But this **accidentally solved the entire design problem.**

Functions can accept both types through a simple generic bound:

```rust
async fn perform_operations<T>(tx: &T) -> FdbResult<()>
where
    T: Deref<Target = Transaction>,
{
    tx.set(b"key", b"value");
    let value = tx.get(b"key", false).await?;
    tx.clear_range(b"start", b"end");
    Ok(())
}
```

Now the same function works seamlessly with both transaction types:

```rust
// Direct transaction usage
let tx = db.create_transaction()?;
perform_operations(&tx).await?;

// Automatic retry loop usage
db.run(|rtx| async move {
    perform_operations(&rtx).await?;  // Same function, no changes needed!
    Ok(())
}).await?;
```

The compiler handles everything through deref coercion. All methods of `Transaction` remain directly accessible on both types, and there's zero runtime overhead.

## The Pattern: Arc<T> + Deref = Universal APIs

This pattern works whenever you have a type `T` and a wrapper containing `Arc<T>` (or `Box<T>`, `Rc<T>`, etc.). As long as the wrapper implements `Deref<Target = T>`, you can write generic functions that accept both:

```rust
// Any function with this signature accepts:
// - &T directly  
// - &WrapperType where WrapperType: Deref<Target = T>
// - &Arc<T>, &Box<T>, &Rc<T> (stdlib types already implement Deref)
fn use_any_version<D>(val: &D)
where 
    D: Deref<Target = T>,
{
    val.some_method();  // All methods of T available through deref coercion
}
```

The key insight: when you're designing APIs that need to work with both `T` and `Arc<T>`, don't reach for traits or enums. The standard library already solved this. `Arc<T>` implements `Deref<Target = T>`, and your custom wrapper types should do the same.

Once you implement `Deref`, any function that accepts `&D where D: Deref<Target = T>` automatically works with your owned type, your wrapper type, and any smart pointer containing your type. The compiler handles everything through deref coercion, and you get zero-cost abstraction that feels completely natural to use.

---

Feel free to reach out with any questions or to share your experiences with Deref patterns in Rust. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
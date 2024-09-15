---
title: "Attribute macros in Rust"
description: "Discover attribute macros in Rust"
images:
- /posts/attribute-macros/images/rustacean.png
date: 2021-02-21T00:24:27+01:00
draft: true 

showpagemeta: true
toc: true
categories:
- rustlang
---

{{< image src="/posts/attribute-macros/images/rustacean.png" alt="Hello Friend" position="center" style="border-radius: 8px;" >}}

If you wrote a bit of Rust, you may have stumbled upon some strange attributes attached to some functions, like in the [Rust book](https://doc.rust-lang.org/book/ch11-01-writing-tests.html#the-anatomy-of-a-test-function):

```rust
#[test] // <---- What is that?
fn it_works() {
   assert_eq!(2 + 2, 4);
}
```

Or in the [Actix's documentation](https://actix.rs/docs/getting-started/):

```rust
#[get("/")] // <---- What is that?
async fn hello() -> impl Responder {
    HttpResponse::Ok().body("Hello world!")
}
```

or in the [tokio's documentation](https://docs.rs/tokio-macros/1.5.0/tokio_macros/attr.main.html):

```rust
#[tokio::main] // <---- What is that?
async fn main() {
    println!("Hello world");
}
```

These are called **attributes macros**, and they allow you to directly manipulate Rust's syntax. Let's discover how!

## Attribute macros 101

### What are attributes-macros?

Attributes macros allows you to reshape your rust code. This is called meta-programming, where you are using Rust code to generate Rust code.

### proc-macro, syn and quote

We are now ready to write our own macros. There is two crates that are going to ease our work:

* [syn](https://crates.io/crates/syn) a Rust code parser,
* [quote](https://crates.io/crates/quote) a Rust code generator.

Thanks to them, we will be able to **reshape our Rust code on the fly**.

## Creating the project

For this, we are going to build a simple macro. The goal is to inject a seed upon each test, which means instead of writing:

```rust
#[test]
fn random_seed() {
    let seed = create_random_seed();
    println!("{}", seed);
    // ...
}
```

We will write something like this:

```rust
#[with_random_seed]
#[test]
fn random_seed(seed: u64) {
    println!("{}", seed);
}
```

Let's create a new Rust project:

```console
cargo init --lib
     Created library package
```

We first need to declare that our crate will hold some macros by modifying the `Cargo.toml` file:

```toml
[lib]
proc-macro = true
```

The project has been initialized with a test that we can modify:

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}
```

What is happening if we are adding a parameter to the test function?

```rust
#[cfg(test)]
mod tests {
  #[test]
  fn it_works(seed: u64) { // <----- added a parameter to the test
    let result = 2 + 2;
    assert_eq!(result, 4);
  }
}
```

Trying to run this test will trigger some errors:

```shell
cargo test    
   Compiling blogpost v0.1.0 (/home/pierrez/workspace/rust/blogpost)
error: functions used as tests can not have any arguments
 --> src/lib.rs:4:5
  |
4 | /     fn it_works(seed: u64) {
5 | |         let result = 2 + 2;
6 | |         assert_eq!(result, 4);
7 | |     }
  | |_____^

error: could not compile `blogpost` due to previous error
```

Well, you can't change how a test look like. Let's use the attribute macros to pass this limitation:

```rust
#[cfg(test)]
mod tests {
    #[random_seed]
    #[test]
    fn it_works() { 
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}
```

```shell
cargo test
   Compiling blogpost v0.1.0 (/home/pierrez/workspace/rust/blogpost)
error: cannot find attribute `random_seed` in this scope
 --> src/lib.rs:3:7
  |
3 |     #[random_seed]
  |       ^^^^^^^^^^^

error: could not compile `blogpost` due to previous error
```

Okay, let's create `random_seed` by following [the official documentation](https://doc.rust-lang.org/reference/procedural-macros.html#attribute-macros):

> Attribute macros are defined by a public function with the proc_macro_attribute attribute that has a signature of `(TokenStream, TokenStream) -> TokenStream`

### Creating our first macro

Back to coding, we were stuck

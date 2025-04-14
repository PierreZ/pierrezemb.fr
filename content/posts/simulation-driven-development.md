+++
title = "Embracing Simulation-Driven Development for Resilient Systems"
description = "How deterministic simulation testing can help us build more reliable distributed systems and bridge the gap between development and production environments."
draft = true
date = 2025-04-18T11:12:12+02:00
[taxonomies]
tags = ["distributed", "testing", "reliability", "simulation", "deterministic"]
+++

This article has been translated from my original French presentation at the upcoming Devoxx France 2025, titled "[What if we embraced simulation-driven development?](https://docs.google.com/presentation/d/1xm4yNGnV2Oi8Lk3ZHEvg4aDMNEFieSmW06CkItCigSc/edit?usp=sharing)".

## The Tale of a Bug

As a software engineer, my responsibilities include debugging distributed systems during on-call shifts. My tendency to attract peculiar issues during these shifts earned me the nickname "Black Cat". Let me share a particularly memorable incident:

One of the most memorable incidents happened when a **network partition** completely disrupted a 70+ node Apache Hadoop cluster. The system was in disarray, with nodes confused about **block replication** and **management**. After the network issue was resolved, we decided to **restart the cluster**...

But it wouldn't come back online.

The reason? The system was encountering a `NullPointerException` during startup due to its faulty state. The cluster was too slow to restart properly because of how severely degraded it had become after the network partition. This bug had actually been fixed in newer versions of **HDFS**, but we were running an older release.

The solution required **patching the Hadoop codebase** by **backporting the fix**, **recompiling**, and **distributing the new jar** across all nodes—not exactly what you want to be doing during an active incident. Rolling out patches to a distributed system while it's already "on fire" is rarely recommended, but we had no choice.

This is exactly the type of code that feels disconnected from production requirements—the bug appeared at the worst possible moment, during recovery, when the system was most vulnerable.

## The Development-Production Gap

This incident highlights a fundamental truth in software engineering: **production environments are vastly different from development environments**. The gap between them is comparable to the difference between passing a written driving test and actually driving on a busy highway during rush hour.

{% mermaid() %}
flowchart LR
    S["Your System"] 
    U["Your Users"]
    W["The World"]
    
    U --> S
    W --> S

{% end %}

In development, everything is **controlled**, **clean**, and **predictable**. In production:
- Users do **unexpected things**
- Systems operate under **pressure**
- Components fail in **complex ways**
- **Edge cases** occur regularly

Being on-call forces you to confront this reality. The pager is an unforgiving teacher, but is there a better way to instill a production mindset without throwing engineers into the deep end of incident response?

## The Testing Problem

Let's consider a standard e-commerce API with multiple dimensions of variability:

- User Types: Guest, Logged-in, Premium, Business (4)
- Payment Methods: Credit Card, PayPal, Apple Pay, Gift Card, Bank Transfer (5)
- Delivery Options: Standard, Express, In-Store Pickup, Same-Day (4)
- Promotions: Yes, No, Expired (3)
- Inventory Status: In Stock, Low Stock, Out of Stock, Preorder (4)
- Currency: USD, EUR, GBP, JPY (4)

Testing all possible combinations requires 4×5×4×3×4×4 = 3,840 unique test cases—and that's just for the happy path! Add error conditions, network failures, and other edge cases, and this number explodes exponentially.

This is why comprehensive end-to-end testing is so difficult. Every new feature multiplies the complexity, and bugs often hide in rare combinations of conditions that we never thought to test.

## The World Is Harsh

Meanwhile, the real world is even more chaotic than our test cases. Research papers like "[An Analysis of Network-Partitioning Failures in Cloud Systems](https://www.usenix.org/system/files/osdi18-alquraan.pdf)" (OSDI '18) and "[Metastable Failures in Distributed Systems](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf)" (HotOS '21) document just how complex failure modes can be in production.

In a [presentation by John Wilkes (Google) at QCon London 2015](https://qconlondon.com/london-2015/system/files/keynotes-slides/2015-03%20QCon%20(john%20wilkes).pdf), a 2,000-machine service will experience more than 10 machine crashes per day—and this is considered normal, not exceptional. When you operate at scale, failures become a constant background noise rather than exceptional events.

And yes, your **microservices architecture** is absolutely a distributed system susceptible to these issues.

## SRE vs. SWE Perspectives

There's often a gap between the Software Engineer (SWE) perspective and the Site Reliability Engineer (SRE) perspective:

SWEs tend to focus on:
- Development environments (which are completely different from production)
- Feature implementations 
- Code that passes tests (but may not account for real-world complexity)

SREs worry about:
- System interactions in production under pressure
- Complex, unpredictable failure modes
- Recovery mechanisms when things are already broken
- Being paged at 3 AM to fix critical issues alone

The question then becomes: **How can we help developers gain a better understanding of production realities without subjecting them to the trial-by-fire of on-call rotations?** How might we bridge this gap between development and operations, creating environments where engineers can experience production-like conditions safely, learn from failures, and build more resilient systems from the beginning?

We need to test not just our expected use cases, but the **"worse" versions of both our users and the world**. How do we accomplish this comprehensively?

{% mermaid() %}
flowchart LR
    S["Your System"] 
    U["Your worst Users"]
    W["The worst World"]
    
    U --> S
    W --> S

{% end %}

## Deterministic Simulation Testing

The solution lies in a strategy that's both robust and practical: **Deterministic Simulation Testing (DST)**.

For effective testing of complex distributed systems, we need an approach that satisfies three key requirements:

1. **Fast and debuggable testing** → We achieve this with a single-threaded approach that uses a deterministic event loop, making issues perfectly reproducible
   
2. **Testing the entire system at once** → By packaging everything into a single binary with simulated network interactions, we can test complex distributed behaviors without actual network infrastructure
   
3. **Robust against unknown issues** → Through randomized testing with controlled entropy injection, we discover edge cases that we wouldn't think to test explicitly

These three elements work together to create a powerful testing methodology that's both practical to implement and effective at finding real-world issues.

Let's see how we can simulate both our users and the world?


## How to simulate?

### Simulating Users: Randomized Input and Property-Based Testing

Instead of writing thousands of individual test cases, we can use **property-based testing** to generate randomized inputs and verify system properties. This approach is not new and is well-known for unit tests but is relatively new for integration tests:

```java
enum UserType { GUEST, LOGGED_IN, PREMIUM, BUSINESS }
enum PaymentMethod { CARD, PAYPAL, APPLE_PAY, GIFT_CARD, BANK_TRANSFER }
// ...

Random rand = new Random(); // random seed

UserType user = pickRandom(rand, UserType.values());
PaymentMethod paymentMethod = pickRandom(rand, PaymentMethod.values());
```

Rather than hardcoding test cases like:

```java
assertFalse(new User(GUEST).canUse(SAVED_CARD));
```

We can write property-based assertions:

```java
assertEquals(user.isAuthenticated(), user.canUse(SAVED_CARD));
```

This approach is implemented in libraries like:
- Python: **Hypothesis**
- Java: **jqwik**
- Rust: **proptest**

### Simulating the World: Injecting Chaos

We also need to simulate the chaotic nature of production environments by injecting failures into:

- Time (delays, timeouts, retries, race conditions)
- Network (latency, failure, disconnection)
- Infrastructure (disk full, service crash, replica lag)
- External dependencies (slow APIs, rate limiting)
- Load (varying numbers of concurrent users)

It's important to note that implementing full deterministic simulation requires control over every aspect of your system, from task scheduling to I/O operations. This is significantly easier if your system is built with simulation in mind from day one. Some languages offer advantages in this area—for example, Rust's ecosystem makes it relatively straightforward to implement custom virtual threading executors compared to modifying the JVM.

For existing codebases where a full rewrite isn't practical, you can still benefit from simulation testing by adding layers of indirection. Even simple mocks like the HTTP client example below can help you discover how your system behaves under various failure conditions:

```java
class HttpClientMock {
    private final Random random = new Random(); // random seed

    String get(String url) {
        // Simulate random chance of returning an error
        if (random.nextDouble() < 0.2) {
            return "HTTP 500 Internal Server Error";
        }

        int delay = random.nextInt(500); // Simulate 0–499ms latency
        Thread.sleep(delay);
        return "HTTP 200 OK";
    }
}
```

## Who Uses DST?

Not many companies are using DST, but we are starting to have a nice list:

- Clever Cloud
- TigerBeetle
- Resonate
- RisingWave
- Sync @ Dropbox
- sled.rs
- Kafka’s KRaft
- Astradot
- Polar Signals
- AWS
- Antithesis


### DST at Clever Cloud

At Clever Cloud, we're implementing a multi-tenant, multi-model distributed database, **a feat made possible by deterministic simulation testing**, which is core to our first product, [Materia KV](https://www.clever-cloud.com/blog/features/2024/06/11/materia-kv-our-easy-to-use-serverless-key-value-database-is-available-to-all/). Our simulations include:

  - Random network partitions
  - Machine reboots (up to 10 machines, keeping at least 3 running)
  - Concurrent chaos events, like shuffling the actual data disk between 2 nodes

Our simulation-driven development workflow runs simulations:
- In CI loops
- Continuously in the cloud
- With 30 minutes of simulation equating to roughly 24 hours of chaos testing

When we find a faulty seed, we can replay it locally, providing a superpower for debugging complex distributed systems issues.

### Benefits for Developer Education

Deterministic simulation testing doesn't just help find bugs—it helps developers grow. By working with simulated but realistic failure scenarios, developers build intuition for how distributed systems behave under stress without having to experience painful on-call incidents.

Moreover, deterministic simulation testing has instilled a **deep trust in our software**, as it is tested under conditions even more challenging than those encountered in production. This confidence has been crucial for us.

## Conclusion

The gap between development and production is real and significant. Traditional testing approaches can't scale to cover all the possible combinations of user behavior and world events that our systems will encounter.

Deterministic simulation testing offers a powerful alternative that allows us to test complex distributed systems more thoroughly, find bugs before they impact users, and train developers to build more resilient systems.

By embracing simulation-driven development, we can build software that better handles the chaotic reality of production environments—and maybe reduce those 3 AM pages that give engineers like me unfortunate nicknames.

---

Want to learn more? Check out my [curated list of resources on deterministic simulation testing](/posts/learn-about-dst/), which includes articles, talks, and implementation examples.

Feel free to reach out with any questions or to share your experiences with simulation testing. You can find me on [Twitter](https://twitter.com/PierreZ) or through my [website](https://pierrezemb.fr).

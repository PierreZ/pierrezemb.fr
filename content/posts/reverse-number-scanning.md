+++
title = "Key design tip: reverse number scanning in ordered key-value stores"
date = "2025-03-27T05:24:27+01:00"
draft = false
[taxonomies]
tags = ["database", "performance", "optimization", "storage", "distributed"]
+++

Ordered key-value stores like HBase, FoundationDB or RocksDB store keys in lexicographical order. When getting the latest version or most recent events, this ordering often requires scanning through all values in reverse order. While this works, it can become a performance bottleneck, especially in distributed systems. Let's explore a simple yet powerful optimization technique that I've been using recently 🚀

## Key design in Key-value stores

Let's look at this using a tuple structure of `(key, number)`. This could represent a document version, a timestamp, or any numeric identifier:

```
("my-key-1", 1)
("my-key-1", 2)
("my-key-2", 1)
```

In ordered key-value stores, keys are stored in `lexicographical order`. This works well when you want to scan from lowest to highest values, but becomes inefficient when you need the opposite order. For example, to find the highest number for a key, you need to scan through all values:

```
("my-key-1", 1)
("my-key-1", 2)
("my-key-1", 3)
...
("my-key-1", 99)
```

You could scan in reverse mode, but you would lose the order of your first prefix(the "my-key-1").

## Reverse Number Scanning

By reversing the numbers using a simple subtraction from the maximum possible value (e.g., `Long.MAX_VALUE` in Java), we can optimize the scanning process:

```java
long reversedNumber = Long.MAX_VALUE - number;
```

This transforms our data into:

```
("my-key-1", 9223372036854775804) // number 3
("my-key-1", 9223372036854775805) // number 2
("my-key-1", 9223372036854775806) // number 1
```

Now, the highest number (which appears first in the reversed order) can be found efficiently, allowing us to stop after finding the first match. 

This technique is particularly useful in systems dealing with time-series data, versioned documents, or any scenario requiring efficient retrieval of the most recent or highest-valued items.

```
number 1: 9223372036854775806
number 2: 9223372036854775805
number 3: 9223372036854775804

// Reversing back is straightforward
Long.MAX_VALUE - 9223372036854775806 = 1
```

---

**Thank you** for reading my post! Feel free to react to this article, I am also available on [Twitter](https://twitter.com/PierreZ) or [Bluesky](https://bsky.app/profile/pierrezemb.fr) if needed.
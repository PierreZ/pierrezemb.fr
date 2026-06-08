+++
title = "Markdown syntax guide"
date = 2025-06-20
description = "A kitchen-sink article: every prose element the theme styles — headings, tables, lists, code, blockquotes, footnotes."

[taxonomies]
tags = ["markdown", "reference"]
+++

A sample of the Markdown syntax usable in Zola content, doubling as a check that
every basic HTML element is styled by the theme.

## Headings

The HTML `<h1>`–`<h6>` elements represent six levels of section headings.

# H1
## H2
### H3
#### H4
##### H5
###### H6

## Paragraph

Xerum, quo qui aut unt expliquam qui dolut labo. Aque venitatiusda cum, voluptionse
latur sitiae dolessi aut parist aut dollo enim qui voluptate ma dolestendit peritin re
plis aut quas inctum laceat est volestemque commosa as cus endigna tectur, offic to cor
sequas etum rerum idem sintibus eiur?

## Blockquotes

#### Blockquote without attribution

> Tiam, ad mint andaepu dandae nostion secatur sequo quae.
> **Note** that you can use *Markdown syntax* within a blockquote.

#### Blockquote with attribution

> Don't communicate by sharing memory, share memory by communicating.
> — <cite>Rob Pike[^1]</cite>

[^1]: Excerpted from Rob Pike's talk during Gopherfest, November 18, 2015.

## Tables

  Name | Age
------ | ---
   Bob | 27
 Alice | 23

#### Inline Markdown within tables

| Italics   | Bold     | Code   |
| --------- | -------- | ------ |
| *italics* | **bold** | `code` |

## Code blocks

```rust
fn main() {
    // a deterministic greeting
    let seed: u64 = 0x4f2a91e;
    println!("hello from seed {seed:#x}");
}
```

## List types

#### Ordered list

1. First item
2. Second item
3. Third item

#### Unordered list

* List item
* Another item
* And another item

#### Nested list

* Fruit
  * Apple
  * Orange
  * Banana
* Dairy
  * Milk
  * Cheese

## Other elements — abbr, sub, sup, kbd, mark

<abbr title="Deterministic Simulation Testing">DST</abbr> finds bugs reproducibly.

H<sub>2</sub>O and X<sup>n</sup> + Y<sup>n</sup> = Z<sup>n</sup>.

Press <kbd><kbd>CTRL</kbd>+<kbd>C</kbd></kbd> to send SIGINT.

Most <mark>invariants</mark> are checked after every simulated step.

---
title: "Building distributed, multi-tenant databases with FoundationDB and Rust"
date: 2024-07-05T01:22:36+01:00
draft: false

---

## Abstract

It is commonly accepted that it is not advisable to develop certain types of software in-house, notably cryptography, but this also applies to another critical area: databases. When you add constraints such as scalability, resilience or multi-tenancy, the development of such software becomes particularly complex, where the slightest error can compromise the integrity of the data.

Despite the difficulties, two years ago, at Clever Cloud, a European cloud hosting company, we started to undertake the creation of our own distributed and multi-tenant database. To accomplish this task, we rely entirely on Rust and FoundationDB, an open-source technology widely used by Apple, notably to store all iCloud data.

In this deep-dive, we will discuss the particular challenges of writing a database in Rust, covering aspects such as data organization, encoding/decoding, indexing and querying. Next, we will discuss the challenges of validation and durability using a massive failure simulation framework that we have made open-source.

## Occurences

* SunnyTech 2024

## Ressources

* [slides](https://docs.google.com/presentation/d/1WttaWC-VF1aSbNw_-7yLLz3cAcxSMYYO227QYGC3qoE/edit?usp=sharing)
* [replay](https://www.youtube.com/watch?v=Q_8CRjf3M24)

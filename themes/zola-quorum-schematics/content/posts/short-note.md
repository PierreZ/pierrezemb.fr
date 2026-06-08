+++
title = "A short note on naming seeds"
date = 2025-09-12
description = "Why every failing run in a deterministic test deserves a name, not just a number."

[taxonomies]
tags = ["dst", "correctness"]

[extra]
# Syndicated post: point search engines at the original to avoid duplicate-content
# penalties. The theme emits <link rel="canonical"> from this.
canonical = "https://example.com/posts/a-short-note-on-naming-seeds/"
+++

A seed is a name. `0x4f2a91e` is not noise — it is a reproducible universe in which your
system already failed once. Treat it like a fixture: commit it, label it, and never let
it pass silently again.

That is the whole note.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is Pierre Zemb's personal website/blog built with **Zola**, a fast static site generator written in Rust. The site focuses on software engineering as Pierre's main subject and passion, covering distributed systems, programming languages (especially Rust), databases, testing methodologies, and deep technical explorations.

## Technology Stack

- **Static Site Generator**: Zola
- **Theme**: zola-quorum-schematics (custom blueprint/terminal theme, vendored in `themes/`)
- **Development Environment**: Nix Flakes
- **Deployment**: `./deploy.sh` builds the site and pushes it to the PierreZ/portfolio repo, which is served by Clever Cloud (Apache behind the Sozu proxy)
- **Content Format**: Markdown with TOML frontmatter

## Essential Commands

### Development
```bash
# Enter Nix development environment (provides Zola; theme is vendored in themes/)
nix develop

# Start local development server (includes drafts)
zola serve

# Build static site to public/ directory
zola build

# Check site for errors (DO NOT RUN - checks 500+ external links, very slow)
# zola check
```

### Deployment
```bash
# Build and push the site to PierreZ/portfolio (served by Clever Cloud)
./deploy.sh
```

## Architecture & Structure

### Content Organization
- `/content/posts/`: Blog posts in Markdown
- `/content/`: Root pages (contact.md, talks.md, podcasts.md)
- `/static/images/[post-name]/`: Images for specific posts
- `/templates/`: Custom HTML templates extending the theme
- `/themes/zola-quorum-schematics/`: vendored theme, tracked in-repo
- `/public/`: Generated static site (gitignored)

### Key Configuration
- **config.toml**: Main site configuration
  - Base URL: https://pierrezemb.fr
  - Features: RSS feeds, search index, syntax highlighting, table of contents
  - Custom width: 1200px
  - Tag-based taxonomy system

### Customizations
- **Theme color**: `#15324d`; two color schemes (blueprint / cyanotype) with a manual toggle
- **Shortcodes**: `{% mermaid %}`, `{% youtube %}`, `{% quote %}`, `{% note %}`
- **Analytics**: Plausible.io integration (per-site script, see `[extra.plausible]`)
- **Favicon**: full icon set in `static/` (svg + ico + 16/32 PNG + apple-touch + android-chrome), enabled via `[extra.favicon] legacy = true`

## Writing Content

### Post Frontmatter Template
```toml
+++
title = "Post Title"
description = "One-sentence description for social media"
date = 2025-01-01
draft = true  # Remove when ready to publish
[taxonomies]
tags = ["distributed-systems", "foundationdb", "rust", "testing"]
+++
```

### Images
Store in `/static/images/[post-name]/`. Reference as `![Alt text](/images/post-name/image.png)`

### Common Tags
Primary: `distributed-systems`, `foundationdb`, `rust`, `testing`, `observability`, `software-engineering`, `programming`, `async`, `database` • Meta: `personal`, `notes-about`, `diving-into` • Languages: `rust`, `java` • Tools: `tokio`, `kafka`, `etcd`, `hbase` • Concepts: `algorithms`, `consensus`, `simulation`, `deterministic`, `metaprogramming`

## Blogging Style Guide

### Voice

Write like a senior colleague sharing production-scarred experience over coffee. The conversational feel comes from being *in* the story, naming what was operated, debugged, and contributed to. It does not come from decorating sentences with verbal tics. Authority comes from "I was there". Warmth comes from honest acknowledgment of what was hard or what did not work.

### Sentence rhythm

Target around 30 words per sentence. Build paragraphs that flow, where one sentence leads into the next, but keep the connection plain, with commas and simple words like because and so, not subordinate clauses or a balanced setup-and-payoff rhythm. The failure mode is polish, not flow, so do not over-correct by chopping the prose into short clipped sentences, a run of short declaratives reads as ad copy. A paragraph runs as long as the idea needs, often 3 to 6 sentences but longer when one thought genuinely carries that far. Do not split a continuous explanation into stubs just to keep paragraphs short, and do not pad a finished idea to make a paragraph longer. Never use em dashes or semicolons for style. Avoid elaborate subordinate clauses. English is not the first language, and the simple sentence structure is a deliberate constraint, not an accident.

Do not prescribe sentence-length variance as a pattern. Short sentences happen when an idea is short. Codifying "punch sentences" produces mechanical rhythm that reads as AI.

Never stack short sentences into a staccato run. A chain of three-to-five-word sentences back to back reads as ad copy, not as a person explaining something. The worst offender is the list-as-sentences pattern, like "You have seen the tutorials. Build Redis in a weekend. Write your own database in 500 lines. They are not lying." Fold that into one flowing sentence with commas: "You have seen the tutorials that promise Redis in a weekend or your own database in 500 lines, and they are not lying." One short sentence to land a point is fine. Four in a row is a tell.

Default to flowing prose. Explanations belong in connected paragraphs where one sentence sets up the next, not in bullet lists or stacks of one-line stub paragraphs. When you catch yourself writing three short paragraphs that each name one example, that is usually one paragraph that walks through the examples in prose. Reach for a list or a table only when the content is genuinely enumerable, like a set of options, a side-by-side comparison, or ordered steps. Prose is the carrier of the argument, and a list is the exception you justify, not the default.

Typical AI cadence:
> Distributed systems are notoriously difficult to test. Many engineers struggle with this. It's worth noting that traditional unit tests often fall short. Let's explore why.

In Pierre's voice:
> When I was on call for our HBase cluster at OVHcloud, the bug that took the longest to debug was a network partition that left the cluster in an inconsistent state. The restart hit a NullPointerException we had never seen, even though it was already patched upstream. That night taught me that the tests we write only cover what we already imagined.

### Personal stake in every claim

This is the most distinctive rule of the voice. Every claim is grounded in something specific: a system operated (HBase 250+ nodes, 70-machine Hadoop, 800 GB JVM heaps), an incident debugged (the August 2024 Pulsar metastable spiral, the Hadoop NPE on recovery), a paper with venue and year (OSDI 2018 on partition failures, HotOS 2021 on metastable failures), a named person (Kyle Kingsbury, Peter Alvaro, Marc Bowes, Charity Majors), or code with a commit hash. Never "studies have shown" or "many engineers find". Cite specifics or do not cite at all.

### Concrete over abstract

Numbers are exact: 2.5M writes/sec, 6.5M reads/sec, 500M timeseries, 13-hour incident, 80% catastrophic, 648 test combinations. Never "hundreds of", never "a lot".

Systems are named: HBase, Hadoop, Kafka, Pulsar, BookKeeper, ETCD, FoundationDB. Never "a distributed database".

Dates are real: "August 2024 outage", "OSDI 2018", "September 2010". The reader always knows which, when, how much.

Use bold for key terms and named concepts. Never italics.

### Narrative structure

**Opening hooks** that work:
- Incident: "One of the most memorable incidents happened when..."
- Conversation: "I keep having the same conversation with..."
- Discovery: "While working on X, I discovered..."

**Story arc per topic**: setup, problem, action, realization. A network partition put the Hadoop cluster in an inconsistent state, the restart hit a known NullPointerException, we pulled the patch from a newer HDFS, recompiled, rolled across 70 machines, and got lucky. The arc is what carries the reader. Never dump abstract concepts without grounding them in a concrete instance first.

**Question-driven transitions** are narrative pivots, not pedagogy. "How do we test that?", "What happened?", "But where does FDB actually shine?" all work. "Let me explain X" or "Think of this as Y" do not. The question marks where the next idea begins. It does not announce that an explanation is coming.

**Analogies grounded in physical reality**: the difference between dev and production is like learning to drive versus driving in Paris. A network-partitioned cluster is a turtle on its back. Writing a database from scratch is like writing crypto, with many ways to mess up.

**References integrated mid-sentence** with commit hashes, venues, and names. "As [this OSDI 2018 study of 136 partition failures](link) found, 80% were catastrophic". "using [foundationdb-simulation](https://github.com/.../tree/4ed057a/...)". Cross-link related posts to build a knowledge web. Never create a "Further Reading" or "Resources" section.

**Code examples**: Context, Code, Explanation. Comments explain WHY, not WHAT.

**Endings** close with a question or invitation to share experience: "Do you think your datastore has gone through the same tests?"

### Warmth without speech tics

The conversational feel comes from:

- **Direct second-person engagement**: "Imagine maintaining 4000 tests."
- **First-person ownership**: "I refuse to ship serious software without simulation."
- **Self-deprecation**: "I spent more hours than I want to admit on G1 GC tuning", "we cheated and reused FoundationDB's simulator", "le chat noir".
- **Strong opinions stated flat, without hedge**: "FDB is the sanest distributed system I have ever operated.", "Rust is my favorite language, and that comes from someone who spent years writing Java and Go."
- **Named patterns and failures**: "simulation-driven development", "metastable failure spiral", "the 15-minute hang", "the correctness decade".

It does NOT come from "actually", "well", "you see", "the thing is", or "in fact" sprinkled as connectors. Those are speech buffers. They belong to spoken talks, not written posts.

### "I" vs "we"

Use "I" for personal stake, opinion, and learning. Use "we" for team work and shared decisions at Clever Cloud. Do not drift into corporate "we" when stating a personal view.

### Post types

- **Regular posts**: single topic, any length, standalone insights.
- **"Diving Into" series**: deep code exploration, 4k+ words, heavy GitHub links with commit hashes, Mermaid diagrams.
- **"Notes About" series**: curated collection of links, videos, and quotes on a topic, opens with a series meta-intro.

### Anti-patterns

Phrases to avoid:
- Filler: "delve into", "dive deep", "in the world of", "it's worth noting".
- AI tells: "Let's explore", "In essence", "Ultimately", "It's important to note", "leverages", "utilizes", "robust" as filler adjective, "seamless", "powerful", "comprehensive".
- Speech-tic anchors as decoration at sentence starts: "actually", "basically", "you see", "the thing is", "in fact". Allowed only when they carry real meaning.
- Hedge stacking: "could potentially", "might possibly arguably". Make the claim or do not make it.

Patterns to avoid:
- Em dashes, semicolons for style, overly complex sentences.
- Meta-commentary: "In this post, I will...", "This is the mental model I wish I'd had", "Once you see it, you can't unsee it".
- Filler sentences that sound insightful but say nothing: "The pattern is clear", "This is the danger zone", "Understanding this changes how you design every data structure".
- Vague numbers ("hundreds of") and reference lists at the end.
- Closing paragraphs that re-summarize what was just said.
- Telling the reader how to read ("I'd suggest reading that sentence twice", "let that sink in").
- Rhetorical balance and rhythm: the balanced antithesis ("a mock cannot do X, while a fake does Y"), and the setup-pivot-payoff three-beat (a clause, then a "but", then a "so" that resolves it). These give a sentence a tidy cadence that reads as AI. State it flat instead.
- Quotable closers and crafted lines: "earns the right to lie", "a ghost you saw once in CI", "a seed number you can drop in a ticket". Lines built to be quoted. The voice describes the mechanism, it does not perform.
- Decorative micro-metaphors and personification dropped into a sentence, like giving code intent or reaching for a small image where a plain statement does the job. This is not the earned physical analogy above, which carries a whole concept. A sprinkled image inside a sentence is a tell.
- Smoothing a draft when editing it: do not upgrade the author's plain, comma-joined sentences into subordinated grammar or rhetorical pivots, and do not chop them into short clipped ones either. Fix typos and grammar, keep the flow and the plainness.

### Standard footer
```markdown
---

Feel free to reach out with any questions or to share your experiences with [topic]. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
```
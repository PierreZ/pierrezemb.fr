# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is Pierre Zemb's personal website/blog built with **Zola**, a fast static site generator written in Rust. The site focuses on software engineering as Pierre's main subject and passion, covering distributed systems, programming languages (especially Rust), databases, testing methodologies, and deep technical explorations.

## Technology Stack

- **Static Site Generator**: Zola (not Hugo - README is outdated)
- **Theme**: zola-bearblog (minimalist Bear Blog aesthetic)
- **Development Environment**: Nix Flakes
- **Deployment**: GitHub Pages via separate repository (PierreZ/portfolio)
- **Content Format**: Markdown with TOML frontmatter

## Essential Commands

### Development
```bash
# Enter Nix development environment (sets up Zola + theme)
nix develop

# Start local development server (includes drafts)
zola serve

# Build static site to public/ directory
zola build

# Check site for errors
zola check
```

### Deployment
```bash
# Deploy to GitHub Pages (PierreZ/portfolio repository)
./deploy.sh
```

## Architecture & Structure

### Content Organization
- `/content/posts/`: Blog posts in Markdown
- `/content/`: Root pages (contact.md, talks.md, podcasts.md)
- `/static/images/[post-name]/`: Images for specific posts
- `/templates/`: Custom HTML templates extending the theme
- `/public/`: Generated static site (gitignored)

### Key Configuration
- **config.toml**: Main site configuration
  - Base URL: https://pierrezemb.fr
  - Features: RSS feeds, search index, syntax highlighting, table of contents
  - Custom width: 1200px
  - Tag-based taxonomy system

### Customizations
- **Dark theme**: Green accent color (#00d992)
- **Shortcodes**: `{% mermaid %}`, `{% youtube %}`, `{% latest %}`
- **Analytics**: Plausible.io integration
- **Icons**: Font Awesome 6.6.0 and Feather icons

## Writing Content

### Post Frontmatter Template
```toml
+++
title = "Post Title"
description = "One-sentence description for social media"
date = 2025-01-01
[taxonomies]
tags = ["distributed-systems", "foundationdb", "rust", "testing"]
+++
```

### Common Tags
Primary: `distributed-systems`, `foundationdb`, `rust`, `testing`, `observability`, `software-engineering`, `programming`, `async`, `database` • Meta: `personal`, `notes-about`, `diving-into` • Languages: `rust`, `java` • Tools: `tokio`, `kafka`, `etcd`, `hbase` • Concepts: `algorithms`, `consensus`, `simulation`, `deterministic`, `metaprogramming`

## Blogging Style Guide

### Writing Voice
- **Conversational but technically precise**: "Let me share...", "You might think...", direct questions to reader
- **Personal experience first**: Start with production incidents, on-call stories, or specific problems you've encountered, but also include code discoveries, library explorations, and engineering insights
- **Concrete over abstract**: Real numbers, actual tools, specific failure modes, code examples, and working implementations rather than theoretical concepts
- **Strategic **bold** for emphasis**: Never italics or em dashes (too formal)

### Your Vocabulary (Use These)
- "on-call shifts", "production incidents", "operational burden", "the trick is...", "the real value comes from..."
- "Here's what I've learned", "Let me share a memorable incident", "After years of...", "In my experience..."
- "But the problems run deeper", "The breakthrough wasn't...", "This isn't theoretical"
- "While implementing...", "The elegance of...", "This pattern emerges...", "Let's explore the internals..."
- "The abstraction breaks down when...", "The design trade-off here is...", "What I found surprising..."
- "The community has been exploring...", "After diving into the source code...", "The performance characteristics..."
- "But here's the catch..." (signals complexity)
- "Can the cluster handle this?" (rhetorical questions to engage readers)
- "This changes how you think about..." (meta-observations)
- "The same code runs in both..." (explains elegance)
- "Do you think your datastore has gone through the same tests?" (provocative questions)

### Anti-patterns (Avoid These)
- Generic AI phrases: "delve into", "dive deep", "in the world of", "furthermore", "moreover", "it's worth noting"
- Academic language: "crystallized", "sensing", em dashes, overly formal transitions
- Explaining what you're about to explain: "In this post, I will..."
- Code without operational context or real-world connection

### Article Structure Templates

**Incident-driven posts:**
1. Open with specific production story or on-call incident
2. Explain the technical context and what went wrong
3. Deep dive into the underlying concepts
4. Extract practical lessons and actionable takeaways

**Exploration posts:**
1. "While working on X, I discovered Y" or "I keep having the same conversation..."
2. Present the problem with concrete examples
3. Walk through your analysis or solution
4. Connect to broader principles

**Opinion/analysis posts:**
1. Make a bold claim about industry practices
2. Support with production evidence and real examples  
3. Address counterarguments with nuance
4. End with practical recommendations

**Technical exploration posts:**
1. "While implementing X, I discovered the internals of Y" or "Let's explore how Z actually works"
2. Walk through the technical details with code examples
3. Explain the design decisions and trade-offs
4. Connect to broader software engineering principles

**Software engineering practice posts:**
1. Present a development challenge or methodology question
2. Compare different approaches with concrete examples
3. Share lessons learned from real implementations
4. Provide actionable insights for other engineers

### Post Series Formats

**"Diving Into" Series:**
- Deep technical exploration of system internals
- Opens with debugging context: "While debugging X, I discovered..."
- Heavy code examples with GitHub source links (include commit hashes)
- Uses Mermaid diagrams for architecture and protocol flows
- Length: 4,000-10,000 words

**"Notes About" Series:**
- Curated collection of links, videos, and quotes
- Opens with meta-introduction: "[Notes About](/tags/notes/) is a blogpost series..."
- Minimal code, heavy on external references
- Educational reference compilation
- Length: 2,000-3,500 words

### Reference & Link Style

- **GitHub links**: Include specific commit hashes or tags, not just repo URLs
- **Papers**: Full title, year, and direct link: `["Paper Title" (2018)](url)`
- **YouTube**: Embed with `{{ youtube(id="...") }}`, always with context
- **Internal links**: Cross-link related posts extensively (creates knowledge web)
- **No "Further Reading" sections**: Weave references into the narrative

### Technical Writing Rules
- **Always include real context**: Code examples from actual systems, not toy examples - whether production deployments or personal projects
- **Use tables for comparisons**: You excel at structured comparisons of frameworks, algorithms, and approaches
- **Include specific numbers**: "70+ node cluster", "85% utilization", "3 AM debugging", "13k lines of code", "5 million downloads"
- **Reference real systems**: FoundationDB, HBase, Kafka, etcd - systems you've operated, Rust crates you've built, open source projects you've contributed to
- **Connect to practical reality**: How does this affect on-call? What breaks at scale? How does this improve developer experience? What are the performance implications?

### Code Examples Style
```rust
// Brief, practical comments that explain WHY, not what
sometimes_assert!(
    server_bind_fails,
    self.bind_result.is_err(),
    "Server bind should sometimes fail during chaos testing"
);
```

### Post Examples

**Typical opening (incident-driven):**
> "One of the most memorable incidents happened when a network partition completely disrupted a 70+ node Apache Hadoop cluster..."

**Technical explanation style:**
> "Connection pool exhaustion is a classic way to kill your entire application: if you support 100 connections and 95 are active, you're in danger."

**Opinion style:**
> "The difference between shipped and operated software is the difference between something you can run and forget, and something that demands ongoing, hands-on care."

### Standard Footer
```markdown
---

Feel free to reach out with any questions or to share your experiences with [topic]. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
```
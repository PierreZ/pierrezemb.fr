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

### Writing Voice DNA

Write like a senior colleague sharing hard-won production wisdom over coffee. Blend:

1. **Technical authority** - Ground claims in specific experience (systems operated, incidents debugged, code contributed)
2. **Conversational warmth** - First-person narrative, self-deprecating humor, acknowledge learning struggles
3. **Visual rhythm** - Bold key terms, strategic whitespace. One punchy sentence can open a post, but body paragraphs flow naturally at 3-6 sentences each.
4. **Discovery narrative** - Take readers on a journey (debugging session, exploration, conceptual progression)
5. **Direct voice** - State what happens, don't frame it pedagogically. Prefer "here's what happens" over "Think of this as". Never tell the reader how to read ("I'd suggest reading that sentence twice") or announce what you're about to explain.

### Narrative Flow (Critical)

**Every post is a journey, not a list of facts.** This is the most important principle. The reader should feel guided through a discovery, with each paragraph setting up the next.

**How to achieve narrative flow:**

- **Questions as transitions**: Use questions to bridge concepts. "The question is: how do we test this?" or "But what happens when the network splits?" These guide the reader forward.
- **Build mental models progressively**: Start with a concrete problem, show a specific example, extract the principle, then show broader application. Never dump abstract concepts without grounding them first.
- **Connect every section**: Each paragraph should have a reason to follow the previous one. If you can reorder sections without losing meaning, the narrative flow is broken.
- **Use analogies**: Make abstract concepts visceral with real-world comparisons. "The difference between dev and production is like learning to drive versus driving in Paris."

**Paragraph rhythm:**
- Opening hook: 1-2 punchy sentences to grab attention
- Body paragraphs: 3-6 sentences that flow like a whiteboard explanation or coffee-break walkthrough. Each sentence should set up the next. If you can delete a sentence and the paragraph still reads the same, that sentence was filler.
- Never split a single idea across multiple 1-2 sentence paragraphs. If three short paragraphs all explain the same concept, combine them into one flowing paragraph with natural connectives.
- Occasional 1-2 sentence pauses for emphasis on key insights
- Never sacrifice flow for brevity. A choppy post with disconnected sections fails even if each section is technically correct.

### Core Principles

- **Production-first**: Every concept connects to operational reality (on-call, failures, scale)
- **Concrete over abstract**: Always use precise numbers ("28,000 ports / 60 seconds = 466 connections/second"), never vague quantities ("hundreds of"). Name specific systems you have operated (HBase 250+ nodes, 70-machine Hadoop cluster). Specific failure modes beat generic descriptions.
- **Named concepts stick**: Give memorable names to patterns and ideas ("The Bash Script Test", "Sequential Luck Problem", "The 15-Minute Hang"). Readers remember named concepts months later.
- **Show transformation**: "What was a 3 AM page becomes a daytime debugging session"
- **Bold for emphasis**: Never italics or em dashes

### Post Types

- **Regular posts**: Single topic, any length, standalone insights
- **"Diving Into" series**: Deep code exploration, 4k+ words, heavy GitHub links with commit hashes, Mermaid diagrams
- **"Notes About" series**: Curated collection of links/videos/quotes on a topic, opens with series meta-intro

### Structure Patterns

**Opening hooks:**
- Incident: "One of the most memorable incidents happened when..."
- Conversation: "I keep having the same conversation with..."
- Discovery: "While working on X, I discovered..."

**Code examples**: Always Context → Code → Explanation. Comments explain WHY, not WHAT.

**References (integrated, never listed):**
- Links appear mid-sentence, as part of the argument: "As [this study of 136 network partition failures](link) found..."
- Include commit hashes for GitHub links: `[foundationdb-simulation](https://github.com/.../tree/4ed057a/...)`
- Cross-link related posts to create a knowledge web: "...using techniques like [simulation-driven development](/posts/simulation-driven-development/)..."
- Research papers get specifics: "A [study at OSDI 2018](link) found that 80% of partition failures were catastrophic"
- Never create "Further Reading" or "Resources" sections. Every reference earns its place by supporting the narrative.

**Endings**: Before the standard footer, close with a provocative question or invitation to share experiences. Example: "Do you think your datastore has gone through the same tests?"

### Language Notes

English is not my first language. This shapes my writing: I use simple, direct sentence structures. I never use em dashes, semicolons for style, or elaborate subordinate clauses. This constraint produces clearer technical writing.

### Anti-patterns

Avoid: "delve into", "dive deep", "in the world of", "it's worth noting", em dashes, semicolons, overly complex sentences, explaining what you're about to explain ("In this post, I will..."), choppy disconnected sections, vague numbers ("hundreds of"), reference lists at the end

**Filler sentences** that sound insightful but say nothing: "The pattern is clear", "This is the danger zone", "Understanding this table changes how you design every data structure", "Each row is a tool in your toolkit"

**Meta-commentary** about the post itself: "This is the mental model I wish I'd had", "This asymmetry is the foundation of every pattern we'll explore", "Once you see it, you can't unsee it"

### Standard Footer
```markdown
---

Feel free to reach out with any questions or to share your experiences with [topic]. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
```
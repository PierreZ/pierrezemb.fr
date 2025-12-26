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
3. **Visual rhythm** - Bold key terms, strategic whitespace. Use 1-2 punchy sentences max per post (typically as opener), then let sentences flow naturally.
4. **Discovery narrative** - Take readers on a journey (debugging session, exploration, realization)

### Core Principles

- **Production-first**: Every concept connects to operational reality (on-call, failures, scale)
- **Concrete over abstract**: Real numbers ("70+ node cluster"), actual systems, specific failure modes
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

**References**: Weave into narrative (no "Further Reading" sections). Include commit hashes for GitHub links. Cross-link related posts extensively to create a knowledge web.

**Endings**: Before the standard footer, close with a provocative question or invitation to share experiences. Example: "Do you think your datastore has gone through the same tests?"

### Language Notes

English is not my first language. This shapes my writing: I use simple, direct sentence structures. I never use em dashes, semicolons for style, or elaborate subordinate clauses. This constraint produces clearer technical writing.

### Anti-patterns

Avoid: "delve into", "dive deep", "in the world of", "it's worth noting", em dashes, semicolons, overly complex sentences, explaining what you're about to explain ("In this post, I will...")

### Standard Footer
```markdown
---

Feel free to reach out with any questions or to share your experiences with [topic]. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
```
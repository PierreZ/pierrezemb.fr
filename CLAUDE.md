# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is Pierre Zemb's personal website/blog built with **Zola**, a fast static site generator written in Rust. The site focuses on distributed systems and technical content.

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

### Creating Blog Posts
```bash
# Create new post file in content/posts/
touch content/posts/descriptive-slug-name.md
# File naming: lowercase with hyphens for spaces (e.g., diving-into-etcd.md)

# For talks: Edit the existing content/talks.md file directly
# For podcasts: Edit the existing content/podcasts.md file directly
```

### Post Frontmatter
```toml
+++
title = "Post Title"
description = "Post description"
date = 2024-01-01
[taxonomies]
tags = ["tag1", "tag2"]
[extra]
toc = false  # Optional: hide table of contents
+++
```

## Blogging Style Guide

### Writing Tone
- **Professional yet Personal**: Balance technical expertise with personal reflection
- **Measured Enthusiasm**: Use occasional emojis sparingly (😎, 🚀, 🤯)
- **Educational Focus**: Explain complex concepts accessibly, share lessons learned
- **Humble and Approachable**: Acknowledge learning from others and making mistakes

### Post Structure
- **Length**: Medium-form (2000-8000 words) for regular posts, longer for deep dives
- **Opening**: Start with compelling story, problem statement, or personal anecdote
- **Sections**: Use clear ## headers for main sections, ### for subsections
- **Progressive Disclosure**: Build from basic concepts to advanced details

### Technical Content
- **Code Examples**: Include functional, real-world code snippets with syntax highlighting
- **Languages**: Primarily Rust, Java, Go, Python, shell scripts
- **Visual Aids**: Use Mermaid diagrams, screenshots in `/static/images/[post-name]/`
- **Cross-references**: Link to related posts, documentation, external resources

### Core Topics
- Distributed systems (FoundationDB, HBase, Kafka, etcd)
- Rust programming and ecosystem
- System reliability and simulation-driven development
- DevOps and infrastructure (NixOS, Kubernetes)
- Career reflections and professional growth

### Language Conventions
- **Primary Language**: English for all recent posts
- **Technical Precision**: Use correct terminology while explaining clearly
- **Simple vocabulary**: Avoid overly complex or formal words (e.g., prefer "made clear" over "crystallized", "thinking about" over "sensing")
  - Exception: Keep established technical terms like "non-deterministic", "deterministic", "distributed systems", etc.
- **Formatting**:
  - **Bold** for key concepts
  - `Inline code` for technical terms, commands, file names
  - > Blockquotes for external quotes and important callouts
  - Use semicolon `;` instead of em dash `—` for separation

### Common Tags
- Primary: `distributed-systems`, `foundationdb`, `rust`, `testing`
- Meta: `personal`, `notes-about`, `diving-into`
- Technology-specific: Database and language names

### Post Endings
Include standard footer:
```markdown
---

Feel free to reach out with any questions or to share your experiences with [topic]. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
```

### Series Formats
- **"Notes About"**: Comprehensive resource compilations
- **"Diving Into"**: Deep technical explorations
- **Experience Reports**: Retrospectives on tools and practices

## Important Notes

- The site uses Zola, not Hugo (README needs updating)
- Theme is managed via Nix Flakes, not git submodules
- Deployment pushes to a separate GitHub repository
- No automated testing or linting configured
- Images should be placed in `/static/images/[post-name]/` for organization
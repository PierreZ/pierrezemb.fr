# Pierre Zemb's Personal Website

## Quick Start

```bash
# Enter development environment
nix develop

# Start local development server
zola serve

# Build the site
zola build
```

## Writing Content

### Create a new blog post
```bash
# Create a new post in content/posts/
# File naming: descriptive-slug-name.md (lowercase, hyphens for spaces)
touch content/posts/my-new-post.md
```

### Create a new talk
```bash
# Add talk content directly to content/talks.md
# Talks are maintained in a single page
```

## Deployment

```bash
# Build and push to PierreZ/portfolio; served by Clever Cloud
./deploy.sh
```

## Technology Stack

- **Static Site Generator**: [Zola](https://www.getzola.org/)
- **Theme**: zola-quorum-schematics (custom, vendored in `themes/`)
- **Development Environment**: Nix Flakes
- **Hosting**: Clever Cloud (built site pushed to PierreZ/portfolio)

## Additional Resources

- **Export HTML to Markdown**: [Dillinger.io](https://dillinger.io/)
- **Development guidance**: See [CLAUDE.md](./CLAUDE.md) for detailed development and content guidelines
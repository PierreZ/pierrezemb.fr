+++
title = "about"
description = "A standalone page — no post chrome, no consistency badge."

[extra]
hide_table_of_contents = true
+++

This is a **standalone page**, not a blog post. It renders through the same
`page.html` template but takes the non-post branch: the breadcrumb is `~ / about`
(not `~ / blog / …`), and there is no date / reading-time / seed / consistency
meta-row — those only make sense for articles.

It also sets `hide_table_of_contents = true` in its front matter, so even though
this page has several headings, no table of contents is rendered.

## Why this exists

To prove that pages like *talks*, *podcasts*, or *contact* migrate cleanly onto the
theme without inheriting article-only furniture.

## Contact

Plain text links, no icon fonts, no CDN — e.g. [github](https://github.com/PierreZ).

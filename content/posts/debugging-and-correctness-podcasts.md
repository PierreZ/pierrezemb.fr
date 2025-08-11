+++
title = "Two Podcast Episodes on Topics Developers Rarely Talk About"
slug = "debugging-and-correctness-podcasts"
date = 2025-08-11
description = "Two podcast episodes—one from Oxide and one from Antithesis—on debugging at the limits and building correctness into systems from day one."
draft = false
[taxonomies]
tags = ["distributed-systems", "debugging", "correctness", "podcasts", "simulation"]
+++

I was listening to a couple of podcasts the other day and stumbled across two episodes that were so compelling I had to stop my chores and listen. They dive into corners of software engineering that most developers barely think about; not because they’re unimportant, but because they appear in the hard corners of engineering:

* catastrophic data corruption,
* correctness work done before a single line is shipped. 

The first is [Adventures in Data Corruption](https://oxide-and-friends.transistor.fm/episodes/adventures-in-data-corruption) from *Oxide and Friends*. Two years ago, the Oxide team ran into data corruption during what should have been a routine network transfer. The debugging journey that followed went from packet traces to CPU speculation quirks, peeling back the stack layer by layer, hardware, kernel, network, application, asking hard questions at each step. What I love here is the combination of clear storytelling and the rapid-fire hypotheses: they make an assumption, test it, discard it, and immediately move to the next, pulling you along in the investigation until the root cause finally clicks into place. 

The second is [Scaling Correctness: Marc Brooker on a Decade of Formal Methods at AWS](https://x.com/AntithesisHQ/status/1953097721205710918) of *The BugBash Podcast* by Antithesis. Marc Brooker, who has spent nearly 17 years building core AWS services like S3 and Lambda, shares the company’s decade-long journey with formal methods, from heavyweight tools like TLA+ to the *lightweight* approaches that any team can adopt like [simulation-based testing](/tags/simulation). At AWS, they’ve learned that investing in correctness up front not only improves reliability but actually speeds up delivery. They also touch on deterministic simulation testing, the challenge of verifying UIs and control planes, and the role AI might play in the future of verification. 

I’ve been paged way too many times for metastable failures, data corruption, network meltdowns, or NTP drift in production. These days, I’d rather tackle the correctness part *before* those alarms go off. Every new layer I build is designed to be simulated to explore failure modes in a controlled environment before they can hurt real users.

But when things fall apart anyway, and spoilers **they will**, developers have the opportunity to truly understand their software. Being responsible for the systems you build means you’re the one getting paged, and it’s in those moments of crisis that the sharpest debugging skills are forged.

So don’t just bookmark them. Put them at the top of your queue. Listen. And maybe, the next time your system misbehaves, you’ll be ready.  

---

Feel free to reach out with any questions or to share your experiences with debugging and correctness. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
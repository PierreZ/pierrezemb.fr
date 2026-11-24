+++
title = "Moonpool 0.9: no longer a hobby project"
description = "TODO: one sentence for social media"
date = 2026-11-24
path = "posts/moonpool-0-9"
draft = true
[taxonomies]
tags = ["moonpool", "rust", "simulation", "deterministic", "testing", "distributed-systems", "personal"]
+++

<!--
SECTION 1: THE HOBBY TRAIL

Purpose: your personal stake, and the release announced in the first paragraph.

Main ideas:
- Moonpool 0.9.0 is out. Say it early, then tell the story.
- You called it a hobby four times, with dates:
  - Sept 2025, /posts/testing-prevention-vs-discovery/: "Moonpool is definitely hobby-grade"
  - Dec 2025, /posts/2025-year-in-review/: "Maybe it becomes something others can use. Maybe it stays a hobby project."
  - May 2026, /posts/bugbash-2026/: "my own hobby-grade DST framework in Rust"
  - 2026-11-15, moonpool commit 8134be33: the README stops saying hobby-grade
- Why you started: learning how FoundationDB and TigerBeetle do DST, inspiration
  from the Antithesis folks. Link /posts/diving-into-foundationdb-simulation/.

Only you can provide: how it felt to have a framework nobody else used.

Nuance: the API is still unstable, no backward-compatibility policy. Say it plainly here.

Transition: what changed between May and November?
-->

<!--
SECTION 2: OTHER PEOPLE'S CODE

Purpose: show moonpool is used for real work, and that you are happy about it.

Evidence (all public):
- Sozu (https://github.com/sozu-proxy/sozu): moonpool became its only UDP simulator
  on 2026-06-29 (d3e93b76), then an H2 core simulation (#1485), swarm testing (#1306),
  backend selection (#1710), a simulation-sweep workflow.
- Magnetar (https://github.com/CleverCloud/magnetar), sans-I/O Pulsar client, on moonpool
  since May 2026: a daily sweep files one issue per failing seed, and every PR replays
  known failing seeds (ADR-0047). "I can't repro is not a close reason."
- Florentin Dubois, upstream PRs to moonpool: #113 poll_write_vectored, #116 no-progress
  detector (Magnetar pinned a [patch] to that branch while waiting), #150 build on stable
  Rust without tokio_unstable (issue #151: "adoption barrier for stable-pinned consumers").
- Unnamed internal systems at Clever Cloud, in both the data plane and the control plane.
  One sentence, no names.

TODO (waiting on Florentin): one bug a moonpool seed actually found in Sozu or Magnetar,
and the mechanism it needed. Do NOT use Sozu #1630 (HPACK) or magnetar e93deee7 unless
confirmed: the commits say review and a differential test found them.

Only you can provide: the first time you saw moonpool find a bug in someone else's code.

Transition, the joke: moonpool got less hobby-grade, so you needed a new hobby, and you
started Paros (https://github.com/PierreZ/paros, 2026-06-15) to learn Paxos and push
moonpool further. Keep it to one or two plain sentences.
(Alternative placement suggested by Fable: just before the ending.)
-->

<!--
SECTION 3: WHAT MOONPOOL DOES DIFFERENTLY

Purpose: the second subject. Fair to turmoil and madsim.

Open with the fair framing: all three are deterministic and seeded, and all three ask you
to change your code (turmoil's own net/fs types, madsim's --cfg madsim with swapped and
patched crates, moonpool's provider traits). madsim has buggify. turmoil has a real
filesystem model now (unstable). Say whether you used them on a real system.

Then the table (checked against turmoil 0.7.2 and madsim 0.2.34, November 2026).
Verify each cell again before publishing, especially turmoil's unreleased fs features.

| | turmoil | madsim | moonpool |
|---|---|---|---|
| Production runtimes | tokio | tokio | tokio, compio |
| Storage faults | torn writes, I/O errors, corruption (unstable) | none | torn, misdirected, sync and writeback errors, aimed |
| Node faults | crash, bounce | kill, restart, pause | reboot, crash, wipe, correlated outages |
| Gray failures | no | no | yes |
| Hooks in the code | barriers, test-driven | buggify, one global switch | named buggify, hint!, vetoes, shard gate |
| Guided exploration | no | no | assertions, fork-based explorer, coverage |
| Swarm testing | no | no | yes |
| wasm | not found | not found | yes |

Three subsections, prose, one concrete example each:

3a. The simulator searches
- sometimes/always assertions as guidance, not only invariants. Book chapter
  "Invariants vs Discovery vs Guidance". Fork-based explorer, sancov coverage.
- Swarm testing: a random subset of fault families per seed (Sozu adopted it, #1306).
- Link /posts/testing-prevention-vs-discovery/ for the basics instead of re-explaining.

3b. The code collaborates with the simulator
- buggify with named sites and per-seed activation (buggify_named!, set_activation).
- hint!: "the code names a moment, it never names a fault". Contrast with FDB's
  `if (buggify()) throw please_reboot()`. Snippet from book/src/part3-building/29-hints.md:
    storage.sync().await?;
    hint!("batch durable, not sent").await;
    send(messages).await;
  No-op in production (one thread-local read), possible kill in simulation.
- The story: paros #488 (fix a735d31a, 2026-10-11). The moment "entry lands, metainfo
  does not" was never named. It crashed 0 times in 2,000 seeds. A 10,000-seed hunt on an
  unrelated branch (#478) found it by luck (witness seed 4532891387820985116), oracle
  "matchmaker: a restart never invents or alters a registration". Naming the moment with
  hint! made it common.
- Reverse direction: the harness tells the simulator what not to break (HintVeto, the
  shard gate). One sentence.

3c. Faults that come from real hardware
- fsyncgate: https://danluu.com/fsyncgate/ (Craig Ringer, 2018-03-28; Tom Lane: "Surely
  you jest."), then https://www.usenix.org/conference/atc20/presentation/rebello (ATC 2020,
  PostgreSQL, LMDB, LevelDB, SQLite, Redis: "none are sufficient").
- Your journal: #569 made the simulation able to inject writeback errors, #564 fixed the
  bug it found (a restart read a failed batch from the page cache as live). All six crash
  loops fail without the fix.
- Misdirection, aimed faults, replicated patterns, gray failures: one sentence.
- Phrase as what moonpool models, not what others lack.

Writing watch: no balanced antithesis ("X does this, while Y does that"). State it flat.

Transition: all of this rests on the provider traits.
-->

<!--
SECTION 4: SAME CODE EVERYWHERE

Purpose: the provider design, made visible.

Main ideas:
- Six provider traits (time, task, network, random, storage, system).
- The same code runs on tokio (tokio-providers), on compio (compio-providers,
  thread-per-core io_uring, !Send code through the Local* traits), in the simulator,
  and in the browser.
- wasm: with sim providers there is no syscall on the path, so a distributed system
  compiles to wasm32. Embed the replicated register player
  (moonpool website/site/src/pages/embed/register.astro) and invite the reader to change
  the seed. TODO: the embed URL and how the theme handles an iframe.

Nuance: code that bypasses the providers is not simulated, there is no deterministic
hypervisor.

Only you can provide: does anything run on compio in production?

Transition: what 0.9 ships.
-->

<!--
SECTION 5: WHAT 0.9 SHIPS

Purpose: the release, short. Not a changelog.

- 393 commits since 0.8.0 (2026-07-09), 13 published crates.
- Core: CPU and gray failures, correlated outages, aimed storage faults, hint!,
  moonpool-walk (seeded random walk over sans-I/O state machines, coverage-driven,
  requested by paros #1199).
- Experimental: moonpool-rpc, moonpool-journal, and the moonpool-tla prototype (check a
  run's trace against a TLA+ spec with TLC).
- Deleted: #540 removed JWT, load balancing, the IP allow list and the metric query layer
  because nothing used them.
- Link the book's "State of Moonpool" page for the rest.
-->

<!--
SECTION 6: ENDING

- Back to the 2025 line, plainly. No crafted closer, no summary.
- An invitation to try it and report what breaks, as a question.
-->

---

Feel free to reach out with any questions or to share your experiences with deterministic simulation. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

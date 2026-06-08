+++
title = "BugBash 2026, or how the correctness decade has started"
date = 2026-05-05
description = "Two days in D.C. with the correctness niche — the year LLM code made simulation mandatory."

[taxonomies]
tags = ["simulation", "correctness", "llm"]
+++

BugBash 2026 was two days in Washington D.C., organized by Antithesis, dedicated to
extracting reliable software from the slop factory. Despite being a conference about
simulation, formal methods and property-based testing, almost everyone was asking a
single question: how can we trust `LLM-generated` code?

## The gap agents opened

Steve Klabnik named the problem in his keynote, *Steel, Rust, and truth*:

{% quote(author="Steve Klabnik", source="Steel, Rust, and truth") %}
We said "good enough" because we wrote it, we understood it, we tried it.
AI broke all three.
{% end %}

At Clever Cloud, we saw it firsthand: once we ran our Materia layers through
FoundationDB's simulator, it found bugs that neither humans nor agents had anticipated.

## The loop that closes the gap

The shape of the loop is simple, and it is the same one FoundationDB has used for
fifteen years: generate a workload, run it under a deterministic scheduler, inject
faults, and assert invariants at every step.

```rust
fn step(sim: &mut Sim, seed: u64) -> Result<(), Violation> {
    let mut rng = Rng::seeded(seed);
    let workload = Workload::generate(&mut rng);
    for event in sim.schedule(workload) {
        sim.apply(event)?;
        sim.check_invariants()?; // linearizability, no lost writes, ...
    }
    Ok(())
}
```

The key property: a single `u64` seed reproduces the **entire** run, faults included.
A failing seed is a perfect, replayable bug report.

{% note(title="why determinism") %}
If the scheduler is deterministic, every flake becomes a fixture. You stop chasing
"could not reproduce" and start bisecting seeds.
{% end %}

## From tribe to requirement

For a decade, deterministic simulation testing was a tribe — a handful of databases
and a lot of evangelism. In 2026 it stopped being optional, because the volume of
machine-written code outran the human capacity to review it.

### What changed in practice

- Review budgets did not grow; code volume did.
- "It compiles and the demo works" stopped being evidence of anything.
- The cheapest oracle we have left is an invariant checked under fault injection.

## Understanding lives in behaviors

The uncomfortable lesson is that understanding does not live in the source — it lives
in the *behaviors* the system exhibits under stress. A test suite that never partitions
the network has never met your system.

## Sixty years of preparation

Property-based testing, model checking, and simulation are not new. They are sixty
years of preparation for exactly this moment, when generation became cheap and trust
became expensive.

## The correctness decade

So the bet is simple: the next ten years belong to whoever can turn "good enough"
back into something you can *check*. The correctness decade has started.

+++
title = "Diving Into Coverage-Guided Fuzzing"
description = "How a 600-line Rust fuzzer discovers a 3-byte crash sequence in 9,000 iterations instead of 16 million"
date = 2026-03-05
draft = true
[taxonomies]
tags = ["rust", "fuzzing", "testing", "simulation", "diving-into"]
+++

> [Diving Into](/tags/diving-into/) is a blogpost series where we are digging a specific part of the project's codebase. In this episode, we will dig into the implementation behind coverage-guided fuzzing.

I have spent a lot of time building [simulation tests](/posts/simulation-driven-development/). Sometimes I throw random operations at the system with different seeds, hoping something breaks. Sometimes I manually craft failure scenarios based on intuition about what might go wrong. The interesting bugs always hide behind specific combinations of inputs, and random testing finds the easy ones. The hard ones need guidance.

[Antithesis](https://antithesis.com/) solves this by using **coverage-guided fuzzing** to steer their simulation framework. After each test input, they observe which code paths were executed and push the next mutation toward branches never taken before. Instead of bruteforcing the input space, coverage becomes the compass.

I built [rust-mini-fuzzer](https://github.com/PierreZ/rust-mini-fuzzer) to understand how this works. A function that crashes only on a specific 3-byte sequence: 9,000 iterations to find it with coverage guidance, instead of the 16 million a random fuzzer would need.

## The target

Here is the function we are fuzzing. It panics only when the first three bytes are `F`, `U`, `Z` in sequence:

```rust
#[inline(never)]
pub fn target(data: &[u8]) -> &'static str {
    if data.len() < 3 {
        return "too-short";
    }
    if data[0] == b'F' {
        if data[1] == b'U' {
            if data[2] == b'Z' {
                panic!("BOOM! Found the magic sequence: FUZ");
            }
            return "partial-FU";
        }
        return "partial-F";
    }
    "miss"
}
```

Look at the nesting. A random fuzzer must guess all three bytes simultaneously. Each byte has 256 possible values, and the three checks are independent, so the probability of a random 3-byte input hitting the panic is **1 in 256 x 256 x 256 = 1 in 16,777,216**. On average, the fuzzer needs 16 million attempts before stumbling on `['F', 'U', 'Z']` by pure luck.

But a fuzzer that observes which branches were taken breaks this into three independent searches. First it discovers an input where `data[0] == b'F'` (new branch covered, ~1 in 256 attempts). That input enters the corpus. Next mutation round, it starts from that `F` input and finds `data[1] == b'U'` (~1 in 256 again). Then `data[2] == b'Z'` (~1 in 256). The expected total: **256 + 256 + 256 = 768 attempts**, not 16 million.

**Coverage turns a multiplicative problem into an additive one.**

## The feedback loop

The entire fuzzer is a single loop:

{% mermaid() %}
graph TD
    A[Corpus] -->|pick random input| B[Mutate]
    B -->|insert/flip/erase byte| C[Run Target]
    C -->|observe| D[Coverage Counters]
    D -->|new coverage?| E{Novel?}
    E -->|yes| A
    E -->|no| F[Discard]
{% end %}

Pick an input from the corpus. Mutate it. Run the target. Check if the mutated input triggered any new coverage. If yes, add it to the corpus. If the target panicked, we found a crash. Repeat. The corpus starts with a single seed input and grows as the fuzzer discovers inputs that exercise new behavior.

The mutation strategy is deliberately simple: three operations chosen at random. **Insert** a random byte, **flip** a random byte, or **erase** a random byte. No grammar, no structure awareness. The coverage feedback does the steering, so the mutations can afford to be dumb. But how does the fuzzer actually observe which branches were taken?

## Getting coverage from the compiler

LLVM's [SanitizerCoverage](https://clang.llvm.org/docs/SanitizerCoverage.html) pass injects a counter increment at every **control-flow edge**. An edge is not a line of code or a branch. It is a transition between basic blocks in the control flow graph. Here is the control flow graph of our target function:

{% mermaid() %}
graph TD
    A{"if data.len() < 3"} -->|true| B["return too-short"]
    A -->|false| C{"if data[0] == b'F'"}
    C -->|true| D{"if data[1] == b'U'"}
    C -->|false| E["return miss"]
    D -->|true| F{"if data[2] == b'Z'"}
    D -->|false| G["return partial-F"]
    F -->|true| H["panic!"]
    F -->|false| I["return partial-FU"]
{% end %}

Each arrow is an edge that LLVM instruments with its own counter. Count the arrows: 8 edges from the branches we wrote, plus LLVM splits [critical edges](https://en.wikipedia.org/wiki/Control_flow_graph#Special_edges) (transitions that skip intermediate blocks) by inserting dummy blocks. This is why our simple function produces 10 instrumented edges, not the handful you might expect from reading the source. After running the target, each counter tells you how many times that edge was taken, giving us 10 bytes of coverage data per execution.

LLVM fires two callbacks during static initialization, before `main()` even runs. The first, `__sanitizer_cov_8bit_counters_init`, receives a pointer to the counter array. The second, `__sanitizer_cov_pcs_init`, receives a parallel **PC table** that maps each counter index back to a code address, useful for printing human-readable edge names when reporting crashes. Between every fuzzer iteration, we zero the counters with `reset()`, run the target, then `snapshot()` the counters before they get wiped for the next round.

The tricky part is **selective instrumentation**. If you instrument the fuzzer itself, its own mutation and formatting code pollutes the coverage metrics. The [project](https://github.com/PierreZ/rust-mini-fuzzer) uses a three-crate workspace:

{% mermaid() %}
graph TB
    subgraph "Instrumented"
        FT[fuzz-target]
    end
    subgraph "NOT instrumented"
        SR[sancov-rt<br/>coverage runtime]
        MF[mini-fuzzer<br/>fuzzer engine]
    end
    MF -->|calls| FT
    MF -->|reads counters| SR
    FT -.->|LLVM callbacks| SR
{% end %}

A `RUSTC_WRAPPER` script injects the SanitizerCoverage flags only when compiling `fuzz_target`. The [sancov-rt](https://github.com/PierreZ/rust-mini-fuzzer/blob/main/sancov-rt/src/lib.rs) crate implements the callbacks and provides safe APIs to reset, snapshot, and classify the counters. The [mini-fuzzer](https://github.com/PierreZ/rust-mini-fuzzer/blob/main/mini-fuzzer/src/main.rs) engine stays clean.

So after each run we have 10 counters. The obvious next step: compare them to what we saw before. Any counter at a new value means new coverage, right? Not quite.

## From raw counts to useful signal

An edge hit 37 times versus 38 times is not meaningfully different, but a naive comparison would flag it as "new coverage." The corpus would explode with nearly identical inputs that discovered nothing real.

**[AFL](https://lcamtuf.coredump.cx/afl/)** (American Fuzzy Lop), the coverage-guided fuzzer written by Michal Zalewski, solved this with a simple insight: **bucket** the raw counts into coarse classes. The technique maps each 8-bit counter value through a [lookup table](https://github.com/PierreZ/rust-mini-fuzzer/blob/main/sancov-rt/src/lib.rs#L175):

| Raw count | Bucket | Meaning         |
|-----------|--------|-----------------|
| 0         | 0      | never executed  |
| 1         | 1      | once            |
| 2         | 2      | twice           |
| 3         | 4      | a few times     |
| 4-7       | 8      | small loop      |
| 8-15      | 16     | moderate loop   |
| 16-31     | 32     | many iterations |
| 32-127    | 64     | heavy loop      |
| 128-255   | 128    | very heavy loop |

After each snapshot, every counter goes through this table:

```rust
pub fn classify_counts(buf: &mut [u8]) {
    for b in buf.iter_mut() {
        *b = COUNT_CLASS_LOOKUP[*b as usize];
    }
}
```

Now 37 and 38 both map to bucket 64. But 7 (bucket 8) and 8 (bucket 16) are genuinely different behaviors: the loop crossed a threshold. **Bucketing filters noise while preserving signal.**

But when is an input worth keeping?

## Detecting novelty: max-reduce

The simplest approach is binary: track which edges have been seen, flag any new edge. But this misses inputs that exercise **known edges more deeply** (a loop that now iterates 20 times instead of 5).

The [max-reduce strategy from LibAFL](https://github.com/AFLplusplus/LibAFL) tracks the **highest bucket ever seen** for each edge. An input is novel if any edge reaches a higher bucket than previously observed:

```rust
pub fn has_new_coverage(&mut self, current: &[u8]) -> bool {
    let mut dominated = true;
    for (i, &val) in current.iter().enumerate() {
        if val == 0 {
            continue; // skip unexecuted edges
        }
        if i < self.history.len() && val > self.history[i] {
            self.history[i] = val;
            dominated = false;
        }
    }
    !dominated
}
```

This catches both new edges (bucket goes from 0 to 1) and deeper exploration of known edges (bucket goes from 16 to 32). Our target has no loops, so in this example every new corpus entry comes from a new edge. But in a target with loops, an input that hits a loop body 20 times (bucket 32) is genuinely different from one that hits it 5 times (bucket 8). The binary approach would ignore the longer input because the edge was already "seen." Max-reduce keeps it. The corpus evolves toward both **breadth and depth**.

## Watching it work

The mutation function is three operations, nothing fancy:

```rust
fn mutate(base: &[u8], rng: &mut impl Rng) -> Vec<u8> {
    let mut buf = base.to_vec();
    let strategy = if buf.is_empty() {
        0
    } else {
        rng.random_range(0..3u8)
    };

    match strategy {
        0 => {
            // Insert a random byte
            let pos = rng.random_range(0..=buf.len());
            let val: u8 = rng.random();
            buf.insert(pos, val);
        }
        1 => {
            // Flip a random byte
            let pos = rng.random_range(0..buf.len());
            buf[pos] = rng.random();
        }
        2 => {
            // Erase a random byte
            let pos = rng.random_range(0..buf.len());
            buf.remove(pos);
        }
        _ => unreachable!(),
    }
    buf
}
```

The corpus starts from a 3-byte seed of zeroes and grows toward inputs that probe deeper branches. Running against our target:

```
[sancov] 8-bit counters registered: 10 edges
[init] 10 edges instrumented

#0       NEW  input="[0x00, 0x00, '-']" (3B)   corpus=2  edges=2/10  (20.0%)
#3       NEW  input="[0x00, 0x00]" (2B)         corpus=3  edges=3/10  (30.0%)
#1876    NEW  input="['F', 0x00, 0x00]" (3B)    corpus=4  edges=4/10  (40.0%)
#6743    NEW  input="['F', 'U', 0x00]" (3B)     corpus=5  edges=5/10  (50.0%)
#9066    CRASH! input="['F', 'U', 'Z', 0x00]" (4B)
```

In the first 3 iterations, coverage jumps to 30% as the fuzzer discovers the length check and the `"miss"` branch. Then a **plateau**: from iteration #3 to #1876, about 1,800 mutations, and none of them produce `data[0] == b'F'`. The fuzzer is not stuck, it is doing honest work, flipping and inserting random bytes, but `'F'` is one specific value out of 256.

At iteration 1876, a mutation finally lands `'F'` at position 0. The `if data[0] == b'F'` branch fires for the first time. New edge, into the corpus. Now the fuzzer has a starting point with `'F'` already in place. 4,800 mutations later, one of its descendants flips position 1 to `'U'`. One edge deeper. Then `'Z'` at position 2, iteration 9,066: **crash found**.

Notice that the output tracks two numbers: **corpus** size and **edges** covered. In this run they grow together because each new corpus entry happens to discover a new edge. But they measure different things. A corpus entry is any input that triggered new coverage, which can mean a new edge **or** a deeper bucket on a known edge (thanks to max-reduce). Edges covered just counts how many distinct edges were hit at least once. In more complex targets, the corpus can grow much faster than the edge count as the fuzzer discovers inputs that exercise known loops more deeply.

The fuzzer found the crash at 50% coverage: 5 out of 10 edges. The remaining 5 are structural edges that LLVM inserted for transitions between blocks (function entry, return paths, fallthrough edges). **You do not need 100% coverage to find bugs.** Coverage guidance found the crash by exploring just the edges on the path to the panic.

Three searches of ~256, not one search of 16 million. The multiplicative problem, solved additively.

## From bytes to distributed systems

This same loop works beyond byte buffers. Tools like [Antithesis](https://antithesis.com/) extend it to **distributed systems**: instead of mutating bytes, they mutate scheduling decisions, network events, and failure injections across a cluster of real processes. The input space is no longer "bytes fed to a function" but "the sequence of everything that can happen to a distributed system." The core primitive is the same: observe coverage, steer toward unexplored territory, find bugs that no amount of [manual testing would catch](/posts/testing-prevention-vs-discovery/).

The full source is on [GitHub](https://github.com/PierreZ/rust-mini-fuzzer), no dependencies beyond `rand` and `backtrace`. What would happen to your system under millions of randomized scenarios, with coverage guidance steering every mutation toward the code paths you have never tested?

---

Feel free to reach out with any questions or to share your experiences with fuzzing and simulation testing. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

+++
title = "Three Years of Nix and NixOS: The Good, the Bad, and the Ugly"
description = "A review of Nix/NixOS after using it on all my machines for three years. I'll cover what works, what doesn't, and why it's the first OS that's stuck with me."
date = 2025-07-02T00:37:27+01:00
[taxonomies]
tags = ["nixos", "nix", "linux", "devops"]
+++

For years, I was a serial distro-hopper, working my way through Ubuntu, Arch, Gentoo, Exherbo, Void Linux, Fedora, Pop!_OS, and Manjaro. Every few months, a new Linux distribution would catch my eye, and I’d spend a weekend migrating my setup, hoping to find the perfect fit. That cycle broke three years ago when I switched to NixOS. It has since become the foundation for all my Linux machines, not because it’s perfect, but because it fundamentally changes the contract between the user and the operating system.

It's important to distinguish between **Nix**, the powerful package manager that can run on any Linux distro (and even macOS), and **NixOS**, the full immutable operating system built around it. This post is a review of my three years with both—the good, the bad, and the ugly.

## The Good

### Declarative and Atomic System Management on NixOS

The core promise of NixOS is that your entire system is configured from a set of files, which you can store in a Git repository. Every change is a commit, giving you a complete, auditable history of your system's state. This makes setting up a new machine trivial: I clone my repository, run one command, and my entire setup is replicated perfectly. No more manually copying dotfiles or running install scripts.

This declarative approach also makes the system incredibly robust. I once broke a laptop running Exherbo right before an on-call shift, and it was a nightmare to fix. With NixOS, that fear is gone. Every `nixos-rebuild switch` creates a new "generation" of the system. If an update breaks something, you simply reboot and select the previous generation from the boot menu. This atomic update mechanism makes you fearless about making and testing changes.

### System Crafting as a First-Class Citizen

On NixOS, customizing your system is not an afterthought—it's a core feature. While the Nix package manager gives you fine-grained control over packages, NixOS uses this power to make deep system modifications simple. For example, building a custom ISO with your SSH keys pre-installed is just a few lines of configuration. This philosophy extends to packages: you can use pre-built binaries for most things, but easily build a package from source with your own patches when you need to.

### Sandboxed Development Environments

A powerful feature of **Nix** (the package manager) is the ability to define per-project development environments using a `flake.nix` file. When you enter the project directory, `direnv` can automatically load a shell with all the specific tools and libraries you need for that project—a specific version of Rust, Node.js, or any other dependency. This completely solves the problem of conflicting dependencies between projects. Each project is perfectly isolated, and you can be sure that you and your colleagues are using the exact same environment.

My favorite tip is to add `if has nix; then use nix; fi` to the `.envrc` file, so the environment is only loaded for team members who have Nix installed, avoiding errors for everyone else.

### Built-in VM-Based Testing

A great, underrated **NixOS** feature is the built-in testing framework. You can write tests that spin up lightweight virtual machines with their own configurations to test your setup. I saw this firsthand when I recently packaged `fdbserver`. It took me about 30 minutes to get a test running that spins up a full FoundationDB cluster across multiple VMs. The setup is still basic—it doesn't even use systemd—but it was more than enough to validate the packaging. You can see the test definition [here](https://github.com/foundationdb-rs/overlay/blob/main/tests/cluster.nix). Being able to build that kind of complex integration test so quickly is something I've only found in NixOS.

## The Bad

### The Friction of Simple Changes on NixOS

On a normal system, if you want to add a shell alias, you edit `.bashrc` and you're done. In NixOS, there are no quick edits. You have to find the right option in your configuration, add the line, and then rebuild your system. This is great for keeping your configuration tracked, but it adds a lot of friction to simple tasks.

### A Steep and Isolated Learning Curve

Learning the Nix ecosystem is a big commitment. The ideas are very different from other Linux systems, so your existing knowledge doesn't help much. You have to learn the Nix language, how derivations work, and now Flakes. It takes a few months before you feel productive.

### Incompatibility with the Wider Ecosystem

Because NixOS doesn't use the standard Filesystem Hierarchy Standard (FHS), you can't just download a pre-compiled binary and expect it to work. It will fail to run because it can't find its shared libraries in places like `/lib` or `/usr/lib`. The Nix way to solve this is to use `patchelf` to modify the binary and tell it where to find its dependencies inside the `/nix/store`.

A similar problem occurs with "impure" build tools. For example, the standard Protobuf plugin for Gradle tries to download the `protoc` compiler during the build. To make this work in a pure Nix environment, you have to disable this feature and instead provide `protoc` through the Nix derivation.

While these tools provide a solution, they are another hurdle to overcome. For a deep dive on patching binaries, Sander van der Burg's post on [deploying prebuilt binaries with Nix](https://sandervanderburg.blogspot.com/2015/10/deploying-prebuilt-binary-software-with.html) is an excellent resource.

### Handling Hardcoded Build Environments

Sometimes, you can't override impure behavior. Certain libraries, particularly in the cryptography space, might have build scripts that are hardcoded to look for dependencies in standard locations like `/usr/lib`. In these cases, your only option is to fall back on [`buildFHSUserEnv`](https://ryantm.github.io/nixpkgs/builders/special/fhs-environments/) to create a sandboxed environment that simulates a traditional filesystem. It's a powerful tool, but it feels like a workaround and highlights the gap between the pure world of Nix and how many other tools work.

## The Ugly

### The Nix Language Barrier

The Nix language itself is the hardest part. It’s a functional language that feels very different from most programming languages. Simple things can be hard to figure out, and you often have to look up how to do basic operations.

LLMs have made this much easier. Before they were widely available, I spent countless hours searching for similar packages on GitHub to figure out how to solve a specific problem. Now, you can ask for a code snippet and get something that works. But needing an AI to help with basic packaging shows how hard the language is to learn.

## Conclusion

So, what's the verdict? The scales may seem evenly balanced between praise and frustration, yet I wouldn't switch away from NixOS. The learning curve is a mountain, and the daily friction can be grating. But the payoff—the absolute, ironclad guarantee of reproducibility—is a superpower.

As someone who builds and tests complex distributed systems, I spend my days fighting entropy. NixOS provides a sane foundation where the environment is a solved problem. The fear of a broken update before an on-call shift is gone. The hours spent debugging "works on my machine" issues have vanished. Setting up a new machine is a 15-minute, one-command affair.

NixOS demands a significant upfront investment for long-term peace of mind. It trades short-term convenience for long-term stability and control. It's not for everyone, but if you're a developer or systems engineer who sees your OS as a critical part of your toolkit—one that should be as reliable and version-controlled as your code—then the tough road of NixOS is absolutely worth it.

### A Gentler Start: Try Nix First

If this article makes you curious but wary of diving headfirst into a full OS migration, there’s good news: you don’t have to. You can get a taste of Nix’s power on your existing macOS or Linux setup.

By installing just the Nix package manager, you can start creating reproducible development environments using `nix-shell` or Nix Flakes. This lets you manage project-specific dependencies without conflicts and share a consistent setup with your team. It's a fantastic way to learn the Nix language and experience its benefits in a familiar environment before committing to NixOS.

I’ve found it incredibly useful to have dependencies managed the same way between Linux and macOS. This website, for example, is built using the same Flake to pull Zola, and it works identically on my Linux laptop and my Mac.

---

Feel free to reach out with any questions or to share your experiences with NixOS. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
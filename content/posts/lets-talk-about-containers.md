+++
title = "Let’s talk about containers"
date = "2016-01-04T18:52:19.698Z"
[extra]
canonical = "https://medium.com/@PierreZ/let-s-talk-about-containers-1f11ee68c470"
[taxonomies]
tags= ["docker", "container"]
+++

**update 2019:** this is a repost on my own blog. original article can be read on [medium](https://medium.com/@pierrez/let-s-talk-about-containers-1f11ee68c470).

---

*English is not my first language, so the whole story may have some mistakes… corrections and fixes will be greatly appreciated. I’m also still a student, so my point of view could be far from “production ready”, be gentle ;-)*

In the last two years, there’s been a technology that became really hype. It was the graal for easy deployments, easy applications management. Let’s talk about containers.

### “Write once, run everywhere”

![image](/images/lets-talk-about-containers/1.jpeg)

When I first heard about containers, I was working as a part-time internship for a french bank as a developer in a Ops team. I was working around [Hadoop](https://hadoop.apache.org/) and monitoring systems, and I was wondering “How should I properly deploy my work?”. It was a java app, running into the official Java version provided by my company. **I couldn’t just give it to my colleagues** **and leave them do some vaudou stuff because they are the Ops team**. I remembered saying to myself ”fortunately, all the features that I need are in this official java version, I don’t need the latest JRE. I just need to bundle everything into a jar and done”. But what if it wasn’t? What if I had to explain to my colleagues that I need the new JRE for a really small app written by an intern? Or I needed another non-standard library during runtime?

The important thing here at the time was that, at any time, **I could deploy it on another server that had Java, because everything is bundled into that big fat jar file**. After all, “**write once, run everywhere**” was the slogan created by Sun Microsystems to illustrate the cross-platform benefits of the Java language. That is a real commodity, and this is the first thing that strike me with Docker.

### Docker hype

I will always remember my chat with my colleagues about it. I was like this:

![image](/images/lets-talk-about-containers/2.jpeg)

## And they were more like

![image](/images/lets-talk-about-containers/3.jpeg)

Ops knew about containers since the dawn of time, so why such hype now? I think that “write once, run everywhere” is the true slogan of Docker, because you can run docker containers in any environments that has Docker. **You want to try the latest datastore/SaaS app that you found on Hacker News or Reddit? There’s a Dockerfile for that**. And that is super cool. So everyone started to get interested in Docker, myself included. But the real benefit is that many huge companies like Google admits that containers are the way they are deploying apps. **They don’t care what type of applications they are deploying or where it’s running, it’s just running somewhere.** That’s all that matters. By unifying the packages, you can automatize and deliver whatever you want somewhere. Do you really care if it’s on a specific machine? No you don’t. That’s a powerful way to think infrastructure more like a bunch of compute or storage power, and not individual machines.

### Let’s create a container

That’s not a secret: I love [Go](https://golang.org/). It’s in my opinion a very nice programming language [that you should really try](https://medium.com/@PierreZ/why-you-really-should-give-golang-a-try-6b577092d725). So let’s say that I’m creating a go app, and then ship it with Docker. So I’ll use the officiel Docker image right? **Then I end up with a 700MB container to ship a 10MB app**… I thought that containers were supposed to be small… Why? because it’s based on a full OS, with go compiler and so on. To run a single binary, there’s no need to have the whole Go compiler stack.

That was really bothering me. At this point, if the container is holding everything, why not use a VM? Why do we need to bundle Ubuntu into the container? From a outside point-of-view, running a container in interactive mode is much like a virtual machines right? **At the time of writing, Docker’s official image for Ubuntu was pulled more than 36,000,000 time**. That’s huge! And disturbing. Do you really need for example “ls, chmod, chown, sudo” into a container?

There is another huge impact on having a full distribution on a container: Security. **You now have to watch not only for CVEs (Common Vulnerabilities and Exposures) on the packages in your host distribution, but also in your container**! After all, based on this [presentation](https://docs.google.com/presentation/d/1toUKgqLyy1b-pZlDgxONLduiLmt2yaLR0GliBB7b3L0/pub?start=false&amp;loop=false#slide=id.ge614ec624_2_70), 66.6% of analyzed images on Quay.io are vulnerable to [Ghost](https://community.qualys.com/blogs/laws-of-vulnerabilities/2015/01/27/the-ghost-vulnerability), and 80% to [Heartbleed](http://heartbleed.com/). That is quite scary… So adding this nightmare doesn’t seems the solution.

### So what should I put into my container?

I looked a lot around the internet, I saw things like [docker-alpine](https://github.com/gliderlabs/docker-alpine) or [baseimage-docker] (<https://github.com/phusion/baseimage-docker)which> are cool, but in fact, the answer was on Docker’s website… Here’s the [official sentence] (<https://www.docker.com/what-docker)that> explains the difference between containers and virtual machines:

> “Containers include the application and all of its dependencies, but share the kernel with other containers.”

This specific sentence triggers something in my head. When you execute a program on your UNIX system, the system creates a special environment for that program. This environment contains everything needed for the system to run the program as if no other program were running on the system. It’s exactly the same! **So a container should be abstract not as a Virtual machines, but as a UNIX process!**

* application + dependencies represent the image
* Runtime environment like token/password will be passed through env vars for example

### Static compilation

![image](/images/lets-talk-about-containers/4.png)

Meet Go

Here’s an interesting fact: Go, the open-source programming language pushed by Google **supports statically apps**, what a coincidence! That means that this statically app will be directly talking to the kernel. **Our Docker image can be empty**, except for the binary and needed files like configuration. There’s a strange image on Docker that you might have seen, which is called “scratch”:

> You can use Docker’s reserved, minimal image, scratch, as a starting point for building containers. Using the scratch “image” signals to the build process that you want the next command in the Dockerfile to be the first filesystem layer in your image. While scratch appears in Docker’s repository on the hub, you can’t pull it, run it, or tag any image with the name scratch. Instead, you can refer to it in your Dockerfile.

That means that our Dockerfile now looks like this:

```docker
FROM scratch  
ADD hello /  
CMD [/hello]
```

So now, I have finally (I think) the right abstraction for a container! **We have a container containing only our app**. Can we go even further? The most interesting thing that I learned from (quickly) reading [*Large-scale cluster management at Google with Borg*](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/43438.pdf) is this:

> Borg programs are statically linked to reduce dependencies on their runtime environment, and structured as packages of binaries and data files, whose installation is orchestrated by Borg.

Here’s the (final) answer! By trully coming back to the UNIX process point-of-view, we can abstract containers as Unix processes. Bu we still need to handle them. So **the role of Docker would be more like a Operating System builder** (nice name found by [Quentin ADAM](https://medium.com/u/58ea5a89aaae)).As a conclusion, I think that Docker true success was to show developers that they can sandbox their apps easily, and now it’s our work to build better software, and learning new design patterns.

Please, Feel free to react to this article, you can reach me on [Twitter](https://twitter.com/PierreZ), Or visite my [website](https://pierrezemb.fr).

+++
title = "What Can Go Wrong With TCP"
description = "A developer's guide to network failures: zombie connections, retry storms, half-open sockets, connection pool pitfalls, and the silent drops that break distributed systems"
date = 2025-12-18
draft = true
[taxonomies]
tags = ["networking", "tcp", "distributed-systems", "linux"]
+++

One of my most memorable production incidents started with a simple observation: requests to an upstream service were hanging for exactly 15 minutes before failing. We blamed the remote service. We opened tickets. We had meetings. Weeks later, someone finally ran `sysctl net.ipv4.tcp_retries2` and discovered the truth. The remote service had crashed. TCP was faithfully retrying for 924 seconds before giving up. The defaults betrayed us.

TCP promises reliable, ordered delivery. What it does not promise is **fast failure detection**. The protocol was designed for a world where network hiccups were temporary and patience was a virtue. Modern distributed systems need something different. They need to know when a connection is dead, and they need to know now.

A [study of 136 network partition failures](https://www.usenix.org/conference/osdi18/presentation/alquraan) across 25 distributed systems found that **80% had catastrophic effects**: data loss, reappearance of deleted data, broken locks, system crashes. Even worse, 29% of these failures came from **partial partitions** where nodes disagree about which servers are reachable. Most systems are not tested for this.

Here is what will break.

## Zombie Connections

Your application holds a connection to a database. The database server crashes. No graceful shutdown, no FIN packet, just power gone. Your application does not know. It sits there, connection open, waiting for a response that will never come.

TCP keepalive is supposed to detect this. By default, it waits **7200 seconds** (two hours) before sending the first probe. Then it sends 9 probes, 75 seconds apart. Your application will not discover the connection is dead for over two hours. The [tcp(7) man page](https://man7.org/linux/man-pages/man7/tcp.7.html) documents these defaults, and [RFC 1122](https://datatracker.ietf.org/doc/html/rfc1122#page-101) specifies that keepalive must default to off or use intervals of at least two hours.

The Linux kernel parameters [`tcp_keepalive_time`, `tcp_keepalive_intvl`, and `tcp_keepalive_probes`](https://man7.org/linux/man-pages/man7/tcp.7.html) control this behavior. Most production systems tune these aggressively. But most developers deploying their first service do not know these parameters exist.

## The 15-Minute Hang

When a packet goes unacknowledged, TCP retransmits. The retransmission timeout (RTO) starts around 200ms and doubles after each failed attempt, up to a maximum of 120 seconds. The [`tcp_retries2`](https://docs.kernel.org/networking/ip-sysctl.html) parameter defaults to **15 retries**.

Do the math: 0.2 + 0.4 + 0.8 + 1.6 + 3.2 + 6.4 + 12.8 + 25.6 + 51.2 + 102.4 + 120×5 = **924 seconds**. Over 15 minutes. Cloudflare has [an excellent deep dive](https://blog.cloudflare.com/when-tcp-sockets-refuse-to-die/) into this behavior and how they tune it for their edge network.

Your HTTP client has a 30-second timeout? TCP does not care. The kernel is still retrying underneath. The socket is not closed. Your timeout fires, you try to close the connection, but the kernel holds onto it. You open a new connection. Same destination. Same problem. Now you have two zombie connections. This is how connection pool exhaustion cascades into full system failure.

[RFC 6298](https://datatracker.ietf.org/doc/html/rfc6298) specifies the RTO calculation. The formula looks innocent: `RTO = SRTT + max(G, 4*RTTVAR)`. The exponential backoff looks reasonable in isolation. Put them together under packet loss and you get applications that appear frozen while the kernel patiently waits.

## Port Exhaustion

Every outbound TCP connection needs a source port. Linux defaults to the ephemeral port range 32768-60999, giving you roughly **28,000 ports**. When a connection closes, it enters [TIME_WAIT state](https://vincent.bernat.ch/en/blog/2014-tcp-time-wait-state-linux) for 60 seconds (2×MSL) to handle delayed packets.

Simple arithmetic: 28,000 ports divided by 60 seconds equals **466 connections per second** before you exhaust available ports. Hit this limit and you see `EADDRNOTAVAIL` errors. New connections fail. Not because the remote service is down, but because your own kernel ran out of ports.

The symptom is confusing. Connections to service A fail. Connections to service B also fail. Everything fails. The problem is not any specific destination. The problem is your source ports are gone. Vincent Bernat's [deep dive into TIME_WAIT](https://vincent.bernat.ch/en/blog/2014-tcp-time-wait-state-linux) explains why this state exists and what you can safely do about it.

High-throughput services tune [`ip_local_port_range`](https://docs.kernel.org/networking/ip-sysctl.html) to expand the available range and enable `tcp_tw_reuse` for outbound connections. Connection pools help by reusing established connections instead of constantly opening new ones.

## The 40ms Mystery

You profile your service. A simple HTTP POST takes 40-200ms even though the server responds in 2ms. The network is local. Nothing explains the latency.

Two algorithms are fighting. **[Nagle's algorithm](https://en.wikipedia.org/wiki/Nagle%27s_algorithm)** buffers small writes, waiting for an ACK before sending more data. **[Delayed ACK](https://en.wikipedia.org/wiki/TCP_delayed_acknowledgment)** holds acknowledgments for up to 40ms, hoping to piggyback them on response data. When your application sends HTTP headers in one write and the body in another, Nagle waits for an ACK. The server waits 40ms before ACKing because it has nothing to piggyback on. Your application waits 40ms for permission to send the body. John Nagle himself [explained this interaction](https://news.ycombinator.com/item?id=10607422) on Hacker News.

The fix is `TCP_NODELAY`, which disables Nagle's algorithm. Most modern HTTP libraries set this by default. But if you are building something custom, or using an older library, this interaction will find you.

## The Silent Drop

The worst failures are the silent ones. Your SYN packet leaves. Nothing comes back. No RST. No ICMP unreachable. No error in any log. The packet just vanishes.

One common cause: **[conntrack table exhaustion](https://docs.kernel.org/networking/nf_conntrack-sysctl.html)**. Linux tracks connection state for NAT and stateful firewalling. The `nf_conntrack_max` parameter limits how many entries this table can hold. When it fills, the kernel drops new connection attempts silently.

Run `dmesg | grep "table full"` and you might find your answer. The message `nf_conntrack: table full, dropping packet` appears nowhere else. Not in application logs. Not in standard monitoring. Just in the kernel ring buffer, waiting for someone to look. The [Kubernetes documentation](https://kubernetes.io/docs/concepts/services-networking/service/#proxy-mode-iptables) warns about this failure mode for high-traffic services.

Firewalls have similar state tables with similar failure modes. A dedicated firewall appliance with a 512K connection limit and 120-second UDP timeout can handle roughly 4,300 new connections per second. Exceed that and packets vanish.

## Path MTU Black Holes

Ping works. Small HTTP requests work. Large file transfers hang forever.

[Path MTU Discovery](https://en.wikipedia.org/wiki/Path_MTU_Discovery) relies on ICMP "Fragmentation Needed" messages to learn the maximum packet size along a route. When a router cannot forward a packet because it is too large, it sends this ICMP message back to the sender. The sender then tries smaller packets.

But many firewalls block all ICMP. The "Fragmentation Needed" message never arrives. The sender keeps trying large packets. They keep getting dropped. The connection hangs. [RFC 8899](https://datatracker.ietf.org/doc/html/rfc8899) describes this problem and the PLPMTUD solution.

This pattern appears constantly with VPNs (IPsec adds 50-60 bytes of overhead), cloud network overlays (VXLAN encapsulation), and any path through aggressive corporate firewalls. The [kernel parameter](https://docs.kernel.org/networking/ip-sysctl.html) `tcp_mtu_probing` enables [RFC 4821](https://datatracker.ietf.org/doc/html/rfc4821) PLPMTUD, which discovers MTU without relying on ICMP.

## Connection Pooling Gone Wrong

You use a connection pool to avoid the overhead of establishing new connections. Smart. But pools introduce their own failure modes.

**Stale connections** sit in the pool while the server restarts. Your next request grabs a connection that the server no longer recognizes. You get a RST, an exception, maybe a retry. If you are lucky. If you are unlucky, the connection is half-open: your side thinks it is connected, the server has no record of it. Your write succeeds (it goes into the kernel buffer), but the response never comes.

**Health checks that lie** make this worse. Your pool pings connections periodically. The ping succeeds. But the ping is tiny. It does not hit the MTU black hole. It does not trigger the slow query that times out. The connection looks healthy. Application requests fail.

**Timeout mismatches** between your pool and infrastructure create [502 errors](https://adamcrowder.net/posts/node-express-api-and-aws-alb-502/). AWS Application Load Balancer has a [default idle timeout of 60 seconds](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/application-load-balancers.html#connection-idle-timeout). If your backend closes connections at 55 seconds, the ALB sometimes sends a request to a connection the backend just closed. The backend sends RST. The ALB returns 502 Bad Gateway. The fix: your backend idle timeout must **exceed** the load balancer timeout.

## Half-Open Connections

Your code calls `write()`. It returns successfully. You assume the data was sent. It was not.

`write()` returns when data is copied to the kernel send buffer. Not when the data reaches the network. Not when the peer receives it. Not when the peer acknowledges it. The peer could have crashed. The network could be partitioned. The kernel happily accepts your bytes into the void.

This is why [half-open connections](https://blog.stephencleary.com/2009/05/detection-of-half-open-dropped.html) are insidious. One side thinks the connection is alive. The other side is gone. Your writes succeed until the send buffer fills. Then `write()` blocks. Or returns `EAGAIN`. Or your async runtime times out. The failure appears far from the actual problem.

The only way to **know** data was received is application-level acknowledgment. TCP ACKs mean the kernel received it. They do not mean your application processed it. If you need confirmation, build it into your protocol.

## Backpressure and Slow Readers

You write faster than the peer can read. The send buffer fills. What happens next depends on your code.

**Blocking sockets** block. Your thread stops. If you have one thread per connection, you now have one fewer thread. If all threads block on slow readers, your server stops accepting new connections. One slow client takes down your service.

**Non-blocking sockets** return `EAGAIN` or `EWOULDBLOCK`. Now you have a choice. You can buffer the data yourself (memory grows unbounded until you OOM). You can drop the data (now you need application-level retransmission). You can close the connection (harsh but safe). There is no good answer. The [fundamental law](https://ferd.ca/queues-don-t-fix-overload.html) is that queues do not fix overload. They just move the problem.

Slow readers also cause **head-of-line blocking**. TCP guarantees in-order delivery. If packet 3 is lost, packets 4, 5, and 6 wait in the kernel buffer even though they arrived fine. Your application sees nothing until packet 3 is retransmitted. One lost packet stalls the entire stream.

## Retry Storms

Your service calls another service. That service is slow. Your client times out and retries. Three retries by default. Seems reasonable.

But you have three layers of services. Each layer retries three times. A single slow request at the bottom becomes **27 requests** at the top. Your retry logic just amplified a minor slowdown into a distributed denial-of-service attack against your own infrastructure. [Amazon documented this pattern](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) and recommends retry budgets: no more than 10% of your requests should be retries.

Even worse: retries during partial outages. Half your backends are down. Requests to healthy backends succeed. Requests to dead backends timeout and retry, hitting healthy backends, which are now overloaded, which makes them slow, which triggers more retries. This is how a partial failure becomes a complete outage.

The fix is **[circuit breakers](https://martinfowler.com/bliki/CircuitBreaker.html)**. After N failures, stop trying. Wait. Probe occasionally. Only resume traffic when the downstream is healthy. Your HTTP client probably does not do this by default.

## Beyond TCP

TCP is just one layer where networks fail silently.

**DNS caching** creates its own class of failures. The JVM [caches DNS lookups forever](https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/jvm-ttl-dns.html) by default when a SecurityManager is installed. You update a DNS record. The JVM never sees it. Even without the forever cache, **negative caching** can bite you. Query a domain before the record exists and the NXDOMAIN response gets cached. Creating the record does not clear the cache.

**Gray failures** are the hardest to detect. [Microsoft Research documented](https://www.microsoft.com/en-us/research/wp-content/uploads/2017/06/paper-1.pdf) this pattern: a component appears healthy to monitoring but is failing for applications. Health checks pass because they use small packets. Application traffic fails because it uses large packets that hit the MTU black hole. The load balancer sees a healthy backend. Users see timeouts.

**Clock skew** breaks distributed coordination. Quartz clocks [drift by about 10⁻⁶ seconds per second](https://medium.com/@shavinanjitha/the-timeless-challenge-synchronizing-clocks-in-distributed-systems-6bfd32cdebe4), roughly 1 second every 11-12 days. Even after NTP synchronization, 10ms skew commonly remains. Leases expire early on the node with the fast clock. They never expire on the node with the slow clock. Split-brain follows. Google built [TrueTime](https://cloud.google.com/spanner/docs/true-time-external-consistency) with atomic clocks to bound this uncertainty to under 7ms.

## Why This Matters

Every failure mode described here is something I wanted to simulate. When you build distributed systems, you need to know how they behave under failure. Not just clean failures where processes crash and connections close gracefully. The ugly failures. The zombie connections. The 15-minute hangs. The silent drops.

That is why I built [Moonpool](https://github.com/PierreZ/moonpool), a Rust port of FoundationDB's [deterministic simulation framework](/posts/diving-into-foundationdb-simulation/). Same application code runs in production with real TCP and in simulation with injected chaos. Partitions, latency spikes, bit flips, connection clogging. All deterministic, all reproducible.

If you have ever debugged a network failure you could not reproduce, simulation testing is for you.

---

Feel free to reach out with any questions or to share your own TCP war stories. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).

+++
title = "A Practical Guide to Application Metrics: Where to Put Your Instrumentation"
description = "A comprehensive guide on where and how to instrument metrics in your applications, covering everything from API endpoints to background jobs"
date = 2025-09-24
[taxonomies]
tags = ["observability", "metrics", "monitoring", "distributed-systems"]
+++

I keep having the same conversation with junior developers. They're building their first production service, and they ask: "Where should I put metrics in my application?" Then, inevitably: "What should I actually measure?"

After mentoring dozens of engineers and running distributed systems for years, I've learned these aren't just beginner questions. Even experienced developers struggle with metrics placement because most of us learned observability as an afterthought, not as a core design principle.

I've been on both sides: deploying services with no metrics and scrambling at 3 AM to understand what broke, and also building comprehensive monitoring that caught issues before users noticed. The difference isn't just about sleep quality; it's about building systems you can actually operate with confidence.

This post gives you a practical framework for where to instrument your applications. No theory, just patterns I've learned from years of production incidents.

## The Five Essential Metric Types

> **Quick note on naming:** Throughout this post, I use dots (`.`) as metric separators like `api.requests.total`. This works perfectly for us because we're heavy [Warp 10](https://warp10.io/) users, and Warp 10 handles dots beautifully. If you're using Prometheus or other systems that prefer underscores, just replace the dots with underscores (`api_requests_total`). The patterns remain the same!

All useful application metrics fall into five categories. Understanding these helps you decide what to instrument and where:

**1. Operational Counters** track discrete events in your system. Every time something happens (a request arrives, a job finishes, an error occurs), you increment a counter. The most critical insight here is measuring both success and failure paths. Most developers remember to count successful operations but forget the errors, leaving them blind when things break. Examples include `api.requests.total`, `db.queries.executed`, `auth.failures.count`, `payments.declined.count`, `jobs.started`, and `cache.evictions`. Always include labels like `method`, `endpoint`, `error_type` to provide context.

**2. Resource Utilization** answers "how much of X am I using right now?" These are your early warning system for capacity problems. Track current values with gauges, cumulative usage with counters. The key is monitoring resources before they're completely exhausted. A connection pool might support 100 connections, but if 95 are active, you're in trouble. Monitor `memory.used.bytes`, `db.connections.active`, `cache.size.entries`, `thread_pool.active_threads`, and `disk.space.available.bytes`. Watch for patterns like steadily increasing memory usage or connection counts approaching pool limits.

**3. Performance and Latency** shows how fast (or slow) things are running. Users feel latency immediately, making these often your most-watched dashboards. Always include units in metric names (`.ms`, `.seconds`, `.bytes`) to make dashboards self-documenting. Track `api.response_time.ms`, `db.query.duration.ms`, `jobs.processing_time.seconds`, and `external_api.call.duration.ms`. Monitor percentiles (p50, p95, p99) not just averages: a 1ms average with a 5-second p99 indicates serious problems.

**4. Data Volume and Throughput** tracks data flow through your system. These metrics are crucial for capacity planning and spotting bottlenecks before they cause user-visible problems. Monitor both input and output rates to understand processing efficiency. Focus on `queue.messages.consumed`, `network.bytes.sent`, `database.rows.processed`, `file_processor.files.completed`, and `batch_processor.records.per_batch`. Compare input vs output rates to identify accumulating backlogs.

**5. Business Logic** captures domain-specific metrics that relate to your actual business value. These are often the most valuable metrics for understanding how your application is really being used and whether technical problems are affecting business outcomes. Track `orders.placed`, `users.registered`, `searches.executed`, `documents.uploaded`, and `subscriptions.activated`. Don't underestimate these: they're what your executives care about and often reveal problems that technical metrics miss.

| Type | Examples | Key Insight |
|------|----------|-------------|
| Operational | `api.requests.total`, `auth.failures` | Track success AND failure paths |
| Resource | `memory.used.bytes`, `db.connections.active` | Early warning for capacity issues |
| Performance | `api.response_time.ms`, `db.query.duration.ms` | Users feel latency immediately |
| Throughput | `queue.messages.consumed`, `network.bytes.sent` | Understand data flow patterns |
| Business | `orders.placed`, `users.login` | What executives actually care about |

## Where to Instrument: A Component Guide

### API Endpoints and HTTP Requests

Your application's front door deserves comprehensive monitoring. Every HTTP request tells a story from arrival to completion, and you want to capture that entire narrative, not just the happy path. Track `api.requests.total` with labels for `method`, `endpoint`, and `status_code` to understand usage patterns. Monitor `api.response_time.ms` to show user experience, and `api.errors.count` with `error_type` labels to reveal reliability issues. Include `auth.failures.count` with `failure_reason` to catch security problems, and `api.concurrent_requests` to identify when you're approaching capacity limits. The common mistake is only instrumenting successful requests; the real value comes from measuring what happens when things go wrong: network timeouts, validation errors, service dependencies failing.

### Database Layer  

Database calls are often your biggest bottleneck and cause more production incidents than any other component. For connection management, track `db.connections.active` (critical for pool management), `db.connections.idle` (available connections), and `db.connections.wait_time.ms` (time threads wait for connections). Monitor query performance with `db.queries.executed` (including `operation_type` and `table` labels), `db.query.duration.ms` (with percentile tracking), `db.slow_queries.count` (queries exceeding thresholds), and `db.query.rows_affected` (rows returned or modified). For error monitoring, track `db.errors.count` by `error_type` (timeout, deadlock, constraint violation) and `db.connection_errors.count` for connection failures. Connection pool exhaustion is a classic way to kill your entire application: if you support 100 connections and 95 are active, you're in danger. Start alerting when you hit 85% utilization.

### Message Queues and Background Processing

Message queues often hide subtle bugs that manifest as slowly growing delays or stuck processing. Track data flow in both directions to catch issues early. For producers, monitor `queue.messages.produced` (with `topic` and `producer_id` labels), `queue.messages.failed` (with detailed `error_type` labels), `queue.producer.wait_time.ms` (time waiting for producer availability), and `queue.batch_size` (messages sent per batch). For consumers, track `queue.messages.consumed` (successfully processed), `queue.processing.time.ms` (per-message duration), `queue.processing.errors` (failures with `error_type` and recovery action), `jobs.queue.depth` (messages waiting), and `consumer.lag.ms` (how far behind real-time). Background jobs need additional metrics: `jobs.started`, `jobs.completed`, `jobs.failed` (with failure reason), `jobs.retry.count`, and `jobs.execution_time.seconds`. Growing queue depth usually means you're processing jobs slower than they're being created, leading to increasing delays and eventual system overload. Consumer lag helps you understand if you're keeping up with real-time processing needs.

### Caching and Locks

For cache performance, track `cache.requests.total` (with `operation` labels for get, set, delete), `cache.hits` and `cache.misses` (for calculating hit ratio), `cache.size.entries` (current cached items), `cache.size.bytes` (memory usage), `cache.evictions` (items removed with `eviction_reason`), and `cache.operation.duration.ms` (time for operations). Hit ratio below 80% usually indicates problems: either you're caching the wrong things, cache TTL is too short, or your working set exceeds cache capacity.

For lock and synchronization, monitor `locks.acquire.duration.ms` (time from requesting to getting lock), `locks.held.duration.ms` (how long locks are held), `locks.contention.count` (threads waiting), and `locks.timeouts.count` (failed acquisitions within timeout). Lock contention can kill your entire application, but it stays invisible without metrics. I've debugged more performance issues with lock metrics than almost any other single type. High acquisition times mean contention; long hold times suggest you're doing too much work while holding the lock.

## Real-World Instrumentation Patterns

### The Request Lifecycle Pattern

For every user-facing operation, track the complete journey from entry to exit. This means instrumenting not just the success path, but every branch your code can take. Increment `api.requests.received` the moment a request hits your service, track `auth.attempts.count` and `auth.failures.count` separately to show both volume and failure rate, monitor `authorization.decisions.count` with labels for `granted` vs `denied`, measure `business_logic.duration.ms` to isolate your application logic performance, and record final `response.status_code` distribution to understand your error patterns. Most developers instrument the happy path but forget edge cases. A request that fails authentication never reaches your business logic, but it still uses resources and affects user experience. The real value comes from measuring what happens when things go wrong: network timeouts, validation errors, service dependencies failing.

### The Resource Exhaustion Pattern

Systems fail when they run out of resources. The trick is measuring resources before they're completely exhausted, giving you time to react. For connection pools, track `db.connections.active` vs `db.connections.max` and don't wait until you hit 100% utilization: start alerting at 85%. Monitor `db.connections.wait_time.ms` because long waits indicate you're close to exhaustion even if you haven't hit the limit. For memory pressure, monitor both `memory.heap.used.bytes` and `gc.frequency.per_minute` since high GC frequency often predicts memory pressure before OutOfMemory errors occur. Track `memory.allocation.rate.bytes_per_second` to understand if your allocation rate is sustainable. For queue management, a growing `jobs.queue.depth` indicates you're processing work slower than it arrives, eventually leading to timeouts and system overload. Track `queue.processing.rate.per_second` and `queue.arrival.rate.per_second`: the relationship between these rates tells you if you're keeping up. For disk space, track `disk.available.bytes` and `disk.usage.rate.bytes_per_hour`. Linear growth can be predicted and prevented, while sudden spikes indicate immediate problems.

### The Business Context Pattern

Technical metrics tell you *what* is happening; business metrics tell you *why* it matters. Always pair technical instrumentation with business context to understand the real impact of technical problems. Track `api.errors.count` alongside `orders.lost.count` to understand how technical problems affect sales, monitor `payment_service.response_time.ms` alongside `checkout.abandonment.rate` to see if slow payments drive users away, and measure `search.response_time.ms` alongside `search.result_clicks.count` to understand if slow search reduces engagement. For user experience correlation, pair `cache.misses.count` with `page.load.time.ms` to quantify cache performance impact, track `db.slow_queries.count` alongside `user.session.duration.minutes` to see if database performance affects user retention, and monitor `auth.failures.count` with `support.tickets.count` to predict support load from technical issues. For capacity planning, correlate `server.cpu.usage.percent` with `concurrent.users.count` to understand scaling requirements, track `memory.usage.bytes` alongside `active.sessions.count` to predict memory needs, and monitor `network.bandwidth.used.mbps` with `file.uploads.count` to plan infrastructure scaling. This pairing helps you understand the business impact of technical problems and prioritize fixes based on actual user and revenue impact.

### The Error Classification Pattern

Not all errors are created equal. Classify errors by their impact and actionability to build appropriate response strategies. User errors (4xx) like `auth.invalid_credentials`, `validation.missing_field`, or `resource.not_found` are usually not your fault, but track patterns to identify UX issues. High rates might indicate confusing interfaces or inadequate client-side validation; alert on unusual spikes that might indicate attacks or system confusion. System errors (5xx) like `db.connection_timeout`, `service.unavailable`, or `memory.exhausted` are your responsibility to fix immediately. They're always actionable and usually indicate infrastructure or code problems that should trigger immediate alerts and investigation. External dependency errors like `payment_gateway.timeout`, `third_party_api.rate_limited`, or `cdn.unavailable` are outside your direct control but affect users. They require fallback strategies and user communication, and help predict when to escalate with external providers. Distinguish transient errors (`network.timeout`, `rate_limit.exceeded` that often resolve themselves) from persistent errors (`config.invalid`, `database.schema_mismatch` that require immediate intervention). Each category needs different alerting strategies, escalation procedures, and response timeframes: user errors might warrant daily review, system errors need immediate alerts, external errors require monitoring trends and fallback activation.

## Best Practices for Production Metrics

### Naming Conventions That Scale

Consistent naming prevents the confusion that kills metrics adoption. Use a clear hierarchy: `<system>.<component>.<operation>.<metric_type>`. Examples include `api.auth.requests.count`, `db.user_queries.duration.ms`, `cache.metadata.hits.total`, and `queue.order_processing.messages.consumed`. Standardize your suffixes: `.count/.total` for event counters, `.current/.active` for current gauge values, `.duration/.ms/.seconds` for time measurements, `.bytes/.mb/.gb` for data volume, `.errors/.failures` for error counters, and `.ratio/.rate` for ratios and rates. Avoid mixing naming styles (`requestCount` vs `request_total`), ambiguous units (`response_time` without units), and inconsistent hierarchies (`api_requests` vs `requests.api`). This consistency pays off during 3 AM troubleshooting when you don't want to waste mental energy remembering naming schemes.

### Critical Mistakes to Avoid

The biggest mistake is using unbounded values as labels. Don't tag metrics with user IDs, session tokens, IP addresses, or other unlimited values; your metrics system will eventually explode from too many unique series. Use `api.requests{user_type="premium", region="us-west"}` instead of `api.requests{user_id="12345", session="abc123xyz"}`. Always instrument failure cases, not just success paths. Track both `payments.succeeded` AND `payments.failed` with error type labels, monitor `auth.attempts` alongside `auth.failures` to understand failure rates, and count `file.uploads.completed` and `file.uploads.failed` to see processing reliability. Every metric has a cost in storage, network bandwidth, and cognitive load. If you can't explain why a metric matters for operations or business decisions, skip it. Ask yourself: "Would this metric help me during an incident?" Metrics that stop updating can be worse than no metrics at all. Always include heartbeat or health check metrics to verify your instrumentation is working; track `metrics.last_updated.timestamp` to detect collection failures.

## A Note on Histograms (Or: Why They're Not Here)

I know what some of you are thinking: "Where are the histograms?" After all, this is a comprehensive guide to application metrics, and histograms are everywhere in monitoring discussions. Well, I deliberately left them out, and here's why.

Prometheus histograms are fundamentally broken in ways that make them more dangerous than useful. The core problem is what I call the bucket pre-configuration paradox: you must define bucket boundaries before you know your data distribution. As LinuxCzar eloquently put it in his ["tale of woe"](https://linuxczar.net/blog/2017/06/15/prometheus-histogram-2/), this creates an impossible choice between accuracy (many buckets) and operability (few buckets). Get it wrong, and you either lose precision or crash your Prometheus server with [cardinality explosion](https://github.com/prometheus/prometheus/discussions/10598).

But the problems run deeper. You [mathematically cannot aggregate percentiles](https://www.solarwinds.com/blog/why-percentiles-dont-work-the-way-you-think) across instances because the underlying event data is lost. The linear interpolation algorithm produces [significant estimation errors](https://prometheus.io/docs/practices/histograms/), and Prometheus's scraping architecture introduces [data corruption](https://github.com/prometheus/prometheus/issues/1887) where histogram buckets update inconsistently. The [operational burden](https://chronosphere.io/learn/histograms-for-complex-systems/) never ends: every performance improvement potentially invalidates your bucket choices, forcing constant manual reconfiguration.

> [Pierre Chapuis](https://bsky.app/profile/catwell.info) [pointed out](https://bsky.app/profile/catwell.info/post/3lzxliivegs2k) the root cause I missed: Prometheus implements an outdated 2005 algorithm from Cormode et al. for histogram summaries and quantiles. There are much better algorithms available now, including improved versions from the same authors. Check out [this paper](https://cs.uwaterloo.ca/~kdaudjee/Daudjee_Sketches.pdf) for a good overview of modern sketch algorithms. The estimation errors and operational problems I described are symptoms of using this old algorithm.

Instead, I prefer the combination of simple counters and gauges paired with distributed tracing. Trace-derived global metrics give you actual data distributions without guessing bucket boundaries, eliminate the aggregation problem by preserving request context, and adapt automatically as your system evolves. You get better insights with less operational overhead, which seems like a better deal to me.

## Quick Reference: Metrics by Component

| Component | Essential Metrics | Purpose | Key Labels |
|-----------|-------------------|---------|------------|
| **API Endpoints** | `api.requests.total`<br>`api.response_time.ms`<br>`api.errors.count`<br>`auth.failures.count` | Track every request lifecycle<br>Monitor user-facing performance<br>Catch errors before users complain<br>Security monitoring | `method`, `endpoint`, `status_code`<br>`endpoint`, `user_type`<br>`error_type`, `endpoint`<br>`failure_reason` |
| **Database** | `db.connections.active`<br>`db.queries.executed`<br>`db.query.duration.ms`<br>`db.errors.count`<br>`db.slow_queries.count` | Prevent connection exhaustion<br>Track database usage patterns<br>Identify performance bottlenecks<br>Monitor database health<br>Catch expensive queries | `pool_name`<br>`operation_type`, `table`<br>`operation_type`, `table`<br>`error_type`, `operation`<br>`table`, `query_type` |
| **Message Queues** | `queue.messages.produced`<br>`queue.messages.consumed`<br>`queue.processing.time.ms`<br>`queue.processing.errors`<br>`jobs.queue.depth` | Track producer health<br>Monitor consumer throughput<br>Identify processing bottlenecks<br>Catch processing failures<br>Detect backlog buildup | `topic`, `producer_id`<br>`topic`, `consumer_group`<br>`topic`, `message_type`<br>`error_type`, `topic`<br>`queue_name`, `priority` |
| **Cache** | `cache.requests.total`<br>`cache.hits`<br>`cache.misses`<br>`cache.size.entries`<br>`cache.evictions` | Monitor cache usage<br>Track cache effectiveness<br>Identify cache problems<br>Monitor memory usage<br>Understand eviction patterns | `cache_type`, `operation`<br>`cache_type`, `key_prefix`<br>`cache_type`, `miss_reason`<br>`cache_type`<br>`cache_type`, `eviction_reason` |
| **Locks** | `locks.acquire.duration.ms`<br>`locks.held.duration.ms`<br>`locks.contention.count` | Detect lock contention<br>Find locks held too long<br>Monitor thread blocking | `lock_name`, `thread_type`<br>`lock_name`, `operation`<br>`lock_name` |
| **Business** | `orders.placed`<br>`users.login`<br>`payments.processed`<br>`feature.usage.count`<br>`workflow.state_changes` | Business KPI tracking<br>User activity monitoring<br>Revenue stream health<br>Feature adoption metrics<br>Process flow monitoring | `user_type`, `order_value_range`<br>`user_type`, `login_method`<br>`payment_method`, `amount_range`<br>`feature_name`, `user_segment`<br>`workflow_name`, `from_state`, `to_state` |

## Conclusion

Effective metrics instrumentation isn't about collecting everything; it's about collecting the right things in the right places. Start with the five essential metric types, instrument your critical components, and build from there.

Think about metrics as part of your application design, not an afterthought. When writing code, ask yourself: "How will I know if this is working correctly in production?" The answer guides your instrumentation decisions.

The best observability system helps you sleep better at night. If your metrics aren't giving you confidence in your system's health, you're measuring the wrong things.

---

Feel free to reach out with any questions or to share your experiences with application metrics. You can find me on [Twitter](https://twitter.com/PierreZ), [Bluesky](https://bsky.app/profile/pierrezemb.fr) or through my [website](https://pierrezemb.fr).
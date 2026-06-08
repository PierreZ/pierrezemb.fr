+++
title = "Dual leader election under clock skew"
date = 2025-11-30
description = "A bug the simulator found that neither humans nor agents anticipated."

[taxonomies]
tags = ["consensus", "raft", "bugs"]
+++

Two leaders, same term, both certain they had won. The simulator produced it in seconds;
a human would have argued for a week that it was impossible.

## The setup

A five-node Raft group, with one knob the production code never exercised: clocks that
drift independently. The election timeout was computed against a *local* monotonic clock,
but the lease check trusted a *wall* clock.

{% quote(author="Leslie Lamport") %}
A distributed system is one in which the failure of a computer you didn't even know
existed can render your own computer unusable.
{% end %}

## The window

When node A's wall clock ran fast, its lease appeared expired to itself but still valid
to node B. Both granted votes in overlapping windows. The fix was boring — derive the
lease from the same clock as the timeout — but the *finding* was only possible because
the simulator was allowed to skew time at will.

## Takeaway

Clock skew is not an edge case you add later. It is a dimension of the input space, and
if your tests cannot reach it, your system has never been tested there.

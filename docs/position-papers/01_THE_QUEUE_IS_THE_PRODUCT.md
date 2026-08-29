# The Queue Is the Product

## A position paper from SHITLIST

### Teamwork for the team that's working for free.

---

## Executive summary

Modern project-management software has become very good at representing work.

It can model initiatives, programs, portfolios, epics, stories, sub-tasks, dependencies, estimates, sprints, roadmaps, custom workflows, capacity, velocity, goals, dashboards, approvals, reports, and nearly every other organizational abstraction a company can invent.

That is not the same thing as helping a team answer the question:

> **What do we need to deal with next?**

SHITLIST begins with a different assumption:

> The most important project-management interface is not the board, sprint, roadmap, dashboard, or report. It is the team's ordered queue of work.

A team should be able to look at one screen and understand:

1. what matters most,
2. who owns it,
3. what is blocked,
4. what has no owner,
5. and what changed.

Everything else is secondary.

This paper argues that many small and technical teams have been over-served by project-management software and under-served by operational clarity.

SHITLIST is an open-source attempt to reverse that.

---

# 1. The project-management inversion

Project-management systems originally existed to make work easier to coordinate.

Over time, the representation of work became increasingly sophisticated.

That sophistication created a strange inversion:

> Teams now spend meaningful time maintaining the system that exists to help them spend less time coordinating work.

For large organizations, some of that complexity can be justified. A regulated multinational program with hundreds of dependencies may genuinely need formal process.

A five-person startup does not.

An open-source maintainer does not.

A three-person engineering team trying to get a demo out by Friday does not.

Yet all three are frequently handed software designed around assumptions inherited from much larger organizations.

The result is administrative drag disguised as operational maturity.

---

# 2. Work is not an ontology problem

Most work items can be represented with a surprisingly small set of facts:

```text
TITLE
DESCRIPTION
PRIORITY
OWNER
STATUS
BLOCKED BY
DONE WHEN
LINKS
HISTORY
```

A team generally does not fail because it lacked one more level in the issue hierarchy.

It fails because:

- nobody knew the thing was urgent,
- everybody thought somebody else owned it,
- a blocker sat unnoticed,
- the definition of done was unclear,
- or the team's attention was split across too many places.

Those are coordination failures.

SHITLIST is designed around making coordination failures visible.

---

# 3. The five questions

The product exists to answer five questions.

## 3.1 What matters right now?

Priority must be visible and comprehensible.

SHITLIST deliberately starts with four levels:

```text
P0 — the team should care about this now
P1 — next up
P2 — normal backlog
P3 — low urgency / eventually
```

No arbitrary scoring formula is required.

No estimation ritual is required.

No conversion from Fibonacci points into team velocity is required.

A priority is not a prediction of effort.

It is a statement about attention.

## 3.2 Who owns it?

Ownership should be explicit.

Not "the backend team."

Not "engineering."

Not "everyone."

A person.

If no person owns it, the system should say so visibly.

Unowned work is not neutral information. It is operational risk.

## 3.3 What is blocked?

Blocked work should not disappear into a status dropdown.

A block is a team-level condition.

The system should make two things obvious:

```text
WHAT IS BLOCKED?
WHY IS IT BLOCKED?
```

A task cannot enter `BLOCKED` without a reason.

That requirement is intentionally small and intentionally strict.

## 3.4 What has nobody picked up?

Important unowned work should feel uncomfortable.

A queue that shows:

```text
P0  Production auth broken      —      UNOWNED
```

is communicating something useful before anyone opens a report.

This is the kind of signal SHITLIST prioritizes.

## 3.5 What changed?

History matters because coordination depends on shared memory.

SHITLIST records task events as an immutable activity history with before/after snapshots and actor identity.

Examples:

```text
created
priority_changed
assigned
claimed
started
blocked
unblocked
sent_to_review
completed
reopened
edited
```

The goal is not bureaucracy.

The goal is to make the team state explainable.

---

# 4. The queue is not a kanban board

Kanban boards are useful.

They are also often treated as the default visual language for work whether or not they answer the team's real question.

SHITLIST's default view is an ordered queue.

Example:

```text
P0  Production authentication broken     Zack       BLOCKED
P0  Ship staging                         Jon        DOING
P1  Customer demo access                 Sharon     READY
P1  Review execution adapter             Phillip    REVIEW
P2  Deployment documentation             —          UNOWNED
```

The central design principle is:

> **Sorting is part of the workflow.**

The application should have a deterministic, explainable opinion about what deserves attention.

A first-pass order can remain simple:

1. higher priority first,
2. active and blocking work before untouched work,
3. older work becomes more visible inside the same bucket,
4. completed work falls out of the active queue.

The system may become more sophisticated over time.

It should not become mysterious.

---

# 5. Semantic actions instead of workflow administration

The backend already exposes explicit actions:

```text
TAKE
START
BLOCK
REVIEW
DONE
```

This is more meaningful than allowing every state transition through a generic update request.

A semantic action communicates intent.

`BLOCK` means something.

It can require a reason.

It can generate a specific history event.

It can eventually trigger a notification.

It can be audited.

That is product behavior, not merely CRUD.

---

# 6. No ceremony by default

SHITLIST intentionally does not begin with:

- epics,
- initiatives,
- story points,
- sprints,
- planning poker,
- Gantt charts,
- time tracking,
- workload forecasting,
- OKRs,
- whiteboards,
- custom workflows,
- arbitrary status editors,
- AI-generated priority decisions.

This is not because those concepts can never be useful.

It is because every abstraction has a maintenance cost.

SHITLIST should add an abstraction only when repeated real-world use demonstrates that the cost is justified.

The default posture is restraint.

---

# 7. Team-centric, not manager-centric

A large portion of project-management software is optimized for observing work.

SHITLIST should be optimized for participating in it.

The same interface used by a team lead should be useful to an engineer, strategist, designer, or volunteer contributor.

Personal views are filters over shared reality:

```text
TEAM / ALL
TEAM / JON
TEAM / ZACK
TEAM / SHARON
TEAM / UNOWNED
TEAM / BLOCKED
TEAM / DONE
```

There is no separate private task universe that competes with the team board.

The team owns the queue.

Individuals own work within it.

---

# 8. Team pulse over management reporting

SHITLIST should summarize operational pressure rather than manufacture executive theater.

A useful team pulse looks like:

```text
2 CRITICAL
3 BLOCKED
4 UNOWNED
4 IN REVIEW
12 DONE / 7 DAYS
```

The current backend already exposes this model through a team pulse endpoint.

This is not intended to become a warehouse of productivity metrics.

It is intended to answer:

> **Where is attention required?**

---

# 9. Open source is part of the product philosophy

SHITLIST is aimed first at teams with limited money, limited time, and enough technical ability to self-host if needed.

That includes:

- early startups,
- open-source teams,
- side projects,
- volunteer groups,
- hackathon teams,
- technical nonprofits,
- internal skunkworks.

For this audience, open source is not simply a distribution tactic.

It aligns with the product promise:

> You should not need procurement, a sales call, or a per-seat budget to know what your team needs to do next.

The open-source edition should therefore be useful on its own.

Not crippleware.

Not a demo.

Not a hostage negotiation for SSO.

---

# 10. What SHITLIST is not

SHITLIST is not trying to become a complete enterprise work-management operating system.

It is not trying to replicate every Jira feature.

It is not trying to create a new agile methodology.

It is not trying to use AI to determine what a team should care about.

It is not trying to become a wiki, whiteboard, chat client, roadmap suite, OKR system, or HR platform.

The product wins if teams say:

> **"Holy shit, this is all we actually needed."**

It loses if teams eventually require consultants to administer it.

---

# Conclusion

Project-management software has spent decades becoming better at describing organizations.

SHITLIST is interested in something smaller:

> helping a team know what to do.

The queue is the product.

Keep the queue sacred.

# SHITLIST

## Executive Brief

### Teamwork for the team that's working for free.

---

## What it is

SHITLIST is an open-source, team-focused work queue for small engineering teams, startups, open-source projects, side projects, and other groups with more work than project-management budget.

It is deliberately not a feature-for-feature Jira clone.

Its core proposition is:

> **The team should be able to understand what matters, who owns it, what is blocked, what is unowned, and what changed in seconds.**

The primary interface is an ordered team queue rather than a workflow-administration system.

---

## Why it exists

Modern project-management products are powerful, but their power often introduces administrative overhead that small teams do not need.

SHITLIST takes the opposite approach.

The canonical work item stays small:

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

Default priorities:

```text
P0 P1 P2 P3
```

Default states:

```text
READY
DOING
BLOCKED
REVIEW
DONE
```

No mandatory sprints.

No story points.

No epics by default.

No workflow designer.

No AI deciding team priorities.

---

## Core product idea

The queue is the product.

Example:

```text
P0  Production authentication broken     Zack       BLOCKED
P0  Ship staging                         Jon        DOING
P1  Customer demo access                 Sharon     READY
P1  Review execution adapter             Phillip    REVIEW
P2  Deployment documentation             —          UNOWNED
```

Sorting is part of the workflow.

The team should have one shared source of truth and a deterministic view of what deserves attention.

---

## Current implementation

The prototype has already moved into a real multi-user architecture.

Completed:

- PostgreSQL persistence
- migration system
- users
- teams
- team membership
- tasks
- immutable task event history
- Postgres-backed sessions
- email/password authentication with bcrypt
- register/login/logout/me
- team creation/listing APIs
- task CRUD
- semantic task actions: take, start, block, review, done
- block reason enforcement
- team pulse endpoint
- frontend authentication
- Render Blueprint deployment with PostgreSQL
- Docker Compose

Known gaps:

- task history is not yet surfaced in the UI,
- semantic action buttons are not yet fully exposed in the UI,
- full keyboard interaction is not yet complete,
- create-team UI is not yet complete,
- Dockerfile is not yet complete,
- onboarding/import/export/release polish remains.

---

## Open-source model

Community should remain genuinely useful:

- unlimited users,
- teams,
- queue,
- task history,
- API,
- self-hosting,
- Docker,
- basic integration primitives.

Hosted SHITLIST should monetize convenience:

- managed hosting,
- backups,
- upgrades,
- OAuth,
- notifications,
- attachments,
- managed integrations.

Enterprise can later monetize enterprise-specific needs:

- SAML / SSO,
- SCIM,
- audit export,
- retention controls,
- managed on-prem support.

---

## Strategic differentiation

SHITLIST should not compete on the number of objects it can model.

It should compete on the amount of project-management software a team no longer has to think about.

Useful positioning:

> **The team's shit, in the order you need to deal with it.**

> **Bring your work. Leave the bureaucracy.**

> **Your sprint planning meeting could have been a queue.**

> **A task should take less time to create than to do.**

---

## Primary risk

The largest product risk is feature inflation.

If SHITLIST absorbs every request for epics, custom workflows, time tracking, estimation, roadmaps, Gantt charts, labels, and OKRs, it eventually recreates the product category it is trying to simplify.

Product restraint is therefore a core design requirement.

---

## Near-term release target

The next meaningful milestone is:

> A stranger can clone SHITLIST, run one command, create an account, create a team, invite another person, add a task, claim it, block it, move it through review, finish it, and see exactly what happened afterward.

That is enough for a credible open-source v0.1.

Everything else should prove that it deserves to exist.

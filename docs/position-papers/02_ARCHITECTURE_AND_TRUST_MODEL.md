# SHITLIST Architecture & Trust Model

## A technical brief

---

## Executive summary

SHITLIST is designed to be operationally boring.

The initial architecture favors:

- one application service,
- one PostgreSQL database,
- explicit migrations,
- server-side authorization,
- conventional session authentication,
- semantic task actions,
- immutable task event history,
- and self-hosting without infrastructure archaeology.

This document describes the current implementation, the security model it should enforce, and the constraints that should guide the open-source release.

---

# 1. Design goals

The architecture should optimize for:

1. easy self-hosting,
2. understandable failure modes,
3. minimal infrastructure dependencies,
4. straightforward backups,
5. explicit authorization boundaries,
6. auditable task state transitions,
7. conventional tooling over novelty.

The architecture should not require Redis, Kafka, Elasticsearch, Kubernetes, a service mesh, or multiple deployable microservices unless a demonstrated product requirement eventually demands them.

---

# 2. Current system

The implementation currently includes:

```text
Browser
  |
  v
Node application
  |
  +-- Authentication
  +-- Team API
  +-- Task API
  +-- Semantic task actions
  +-- Team pulse
  +-- Migration runner
  |
  v
PostgreSQL
```

The primary relational objects are:

```text
users
teams
team_members
tasks
task_events
session
_migrations
```

---

# 3. Persistence

PostgreSQL is the source of truth.

The original JSON persistence layer has been removed.

Benefits include multi-user consistency, relational membership enforcement, transactional task updates, durable event history, conventional backup/restore tooling, and easier hosted and self-hosted deployment.

---

# 4. Migrations

Migrations run automatically during application startup and are tracked in `_migrations`.

The release model should preserve several properties:

- migrations are ordered,
- migrations are idempotently tracked,
- a migration failure prevents unsafe application startup,
- applied migrations are never silently rewritten,
- destructive migrations require explicit care.

For self-hosting, startup behavior should be understandable from logs.

---

# 5. Authentication

Current authentication uses email/password credentials, bcrypt password hashing, server-side sessions, session records stored in PostgreSQL, and cookies used to identify the active session.

For public release, the security baseline should include:

```text
HttpOnly cookies
Secure cookies in production
appropriate SameSite policy
session expiration
server-side logout invalidation
high-entropy session identifiers
basic login/register rate limiting
sane password minimums
```

OAuth may be added later, with GitHub as the most obvious early provider.

---

# 6. Authorization

Authentication answers:

> Who are you?

Authorization must answer:

> Are you allowed to touch this team's shit?

Every team-scoped request must verify team membership on the server.

The frontend is never an authorization boundary.

The most important negative test in the system is simple:

> Alice modifies a team or task ID in a request. Can she read or mutate Bob's team's data?

The correct answer must always be no.

Recommended release-gate tests include:

- non-member cannot list team tasks,
- non-member cannot fetch task,
- non-member cannot update task,
- non-member cannot invoke semantic action,
- non-member cannot view task events,
- member cannot cross team boundary by changing task ID,
- unauthenticated request cannot access private team data.

---

# 7. Task state

Tasks use a constrained default state model:

```text
READY
DOING
BLOCKED
REVIEW
DONE
```

Task updates exist alongside semantic operations:

```text
TAKE
START
BLOCK
REVIEW
DONE
```

Semantic operations should be preferred when the transition itself carries meaning.

Example: `BLOCK` requires a reason.

The backend can therefore guarantee that a blocked task always contains useful blocker context.

---

# 8. Task event history

Task events provide an immutable-ish operational history.

Each event should contain:

```text
task_id
actor_user_id
event_type
before_json
after_json
created_at
```

This allows the application to reconstruct who assigned the task, when the priority changed, who blocked it, what the blocker reason was, who completed it, and how the task changed over time.

This is preferable to relying on free-form comments as the only team memory.

---

# 9. Team pulse

The current API exposes team-level operational counts including:

```text
critical
blocked
unowned
review
done / 7d
```

These metrics should remain derived from canonical task state.

Avoid introducing separate counters that can drift.

---

# 10. Deployment model

Two deployment paths are already represented:

## Render

A Render Blueprint defines PostgreSQL, the web service, and application environment.

## Docker Compose

Docker Compose defines the intended self-hosted topology.

A missing Dockerfile remains a known gap.

The v0.1 self-hosting goal should be:

```bash
docker compose up -d
```

followed by a functioning application with automatic migration.

---

# 11. Docker requirements

The application Dockerfile should:

- use a maintained Node LTS base,
- install production dependencies,
- avoid unnecessary build tooling in the final image,
- run as a non-root user,
- expose the application port,
- start with the normal production command,
- handle SIGTERM cleanly.

The application should gracefully close the PostgreSQL pool on shutdown.

---

# 12. Backups and recovery

Self-hosters should receive explicit instructions for `pg_dump`, restore, persistent volume configuration, environment-variable backup, and upgrade procedure.

A project-management tool contains operational memory.

Losing it is not funny.

Backup guidance is therefore part of the product.

---

# 13. Security posture

SHITLIST should not claim compliance certifications it does not possess.

The technical security story should instead be specific:

- conventional bcrypt authentication,
- server-side sessions,
- PostgreSQL persistence,
- team-scoped authorization,
- immutable event history,
- explicit migration tracking,
- open-source inspectability,
- minimal infrastructure surface.

Future enterprise capabilities may include SAML, SCIM, configurable retention, audit export, and deployment controls.

Those are future capabilities, not present claims.

---

# 14. Architectural restraint

The architectural equivalent of "do not rebuild Jira" is:

> Do not build distributed systems problems before the product has distributed-systems scale.

A single application plus PostgreSQL can support a substantial amount of real-world use.

The architecture should become more complex only when measured constraints require it.

---

# Conclusion

SHITLIST should be easy to understand operationally because the product itself argues for reducing coordination complexity.

The architecture should practice the same discipline as the interface.

One service.

One database.

Explicit state.

Explicit authorization.

Visible history.

Boring is a feature.

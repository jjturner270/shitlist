# Escaping Jira Without Rebuilding Jira

## A migration and adoption brief

---

## Executive summary

The easiest way to build an open-source Jira alternative is to copy Jira's object model and remove the license fee.

That is also the easiest way to rebuild the problem.

SHITLIST takes a different approach.

Migration should preserve the information teams still need while deliberately discarding process complexity that exists only because the previous tool supported it.

The goal is not lossless Jira emulation.

The goal is useful continuity.

---

# 1. The migration trap

A migrating team often asks:

> Can the new tool represent everything in the old tool?

That sounds reasonable.

It is usually the wrong question.

If the old system contains 17 statuses, 9 issue types, nested epics, unused custom fields, stale sprints, contradictory labels, abandoned automation, and workflows nobody can explain, then reproducing all of it is not migration.

It is preservation of organizational sediment.

SHITLIST should instead ask:

> What information does the team still need to perform the work?

---

# 2. Minimal Jira mapping

A first Jira CSV importer can map:

```text
summary      -> title
description  -> description
priority     -> nearest SHITLIST priority
assignee     -> owner
status       -> nearest SHITLIST status
```

Optional useful fields:

```text
issue key    -> import metadata
issue URL    -> links
created      -> preserved timestamp when practical
updated      -> preserved timestamp when practical
```

Everything else should require a reason.

---

# 3. Priority mapping

Jira priority schemes vary.

SHITLIST should reduce them to:

```text
P0
P1
P2
P3
```

Example mapping:

```text
Highest / Blocker / Critical -> P0
High                         -> P1
Medium                       -> P2
Low / Lowest                 -> P3
```

The importer should show the mapping before applying it.

Teams should be able to adjust it.

They should not be asked to create an equivalent seven-level priority taxonomy.

---

# 4. Status mapping

Jira workflows may contain many states.

SHITLIST has five:

```text
READY
DOING
BLOCKED
REVIEW
DONE
```

Example mapping:

```text
Open / To Do / Selected for Development -> READY
In Progress                             -> DOING
Blocked / On Hold                       -> BLOCKED
Code Review / QA / Review               -> REVIEW
Done / Closed / Resolved                -> DONE
```

Ambiguous statuses should be surfaced during import.

The system should prefer a small explicit mapping step over inventing hidden behavior.

---

# 5. Epics and hierarchy

SHITLIST should not introduce epics merely because Jira exports contain them.

Initial migration behavior can preserve the original epic name or key as import metadata.

If real users repeatedly demonstrate a need for grouping, SHITLIST can later introduce a deliberately smaller concept.

The product should not inherit hierarchy by accident.

---

# 6. Story points

Do not import story points as active product behavior.

If preserving them is useful for archival context, store them in import metadata or an attached note.

Do not add a story-point field to the canonical task model merely to achieve migration parity.

---

# 7. Comments

Some Jira comments contain technical decisions, reproduction steps, customer context, approval records, and links not represented elsewhere.

A later importer may preserve comments as historical import records.

They should not automatically justify turning SHITLIST into a discussion platform.

---

# 8. Migration UX

The ideal experience is:

```text
1. Upload Jira CSV.
2. Review detected columns.
3. Review priority mapping.
4. Review status mapping.
5. Resolve unknown users.
6. Preview import.
7. Import.
```

The result should show:

```text
412 tasks imported
27 users matched
6 users unresolved
14 statuses collapsed into 5
9 fields preserved as import metadata
0 epics recreated
```

That final line is a feature.

---

# 9. The migration promise

The positioning should be:

> **Bring your work. Leave the bureaucracy.**

Not:

> Perfect Jira compatibility.

A useful campaign line:

> Upload your export. Keep the tasks. Lose the anthropology project.

---

# 10. GitHub Issues

GitHub Issues should be the second important import path.

For technical teams, the mapping is straightforward:

```text
issue title        -> title
issue body         -> description
assignee           -> owner
open/closed        -> READY/DONE
labels             -> import metadata
linked PR          -> links
```

Again, imported labels should not automatically force a native label system.

---

# 11. Export matters too

An open-source product should make leaving easy.

SHITLIST should eventually provide JSON export, CSV export, task event export, and team backup documentation.

A system that claims to reduce project-management captivity should not create a new one.

---

# Conclusion

Migration is where SHITLIST's product discipline will be tested.

The temptation will be to add every concept required to make imports lossless.

Resist it.

Preserve the work.

Preserve the context that matters.

Discard the bureaucracy.

Do not rebuild Jira on the way out.

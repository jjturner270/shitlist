# SHITLIST

A team-focused work queue for people who need to know:

- what matters right now,
- who owns it,
- what is blocked,
- and what nobody has picked up.

No sprints. No story points. No workflow priesthood.

## Run locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:10000
```

## Deploy on Render

### Fast path: Blueprint

1. Push this folder to a GitHub repo.
2. In Render, choose **New → Blueprint**.
3. Connect the repo.
4. Render will read `render.yaml`.
5. Deploy.

The app exposes:

```text
GET /health
```

for Render's health check.

### Important: persistence

The app stores data in:

```text
./data/tasks.json
```

That is intentionally dead simple for a prototype.

On a normal Render web service, the filesystem is ephemeral. The board will work, but data can reset when the instance is replaced or redeployed.

For durable team use, attach a Render persistent disk and set:

```text
DATA_DIR=/var/data
```

Then mount the disk at:

```text
/var/data
```

The server already supports this environment variable; no code changes are required.

If you want to move to Postgres later, the frontend API surface is small enough that the storage layer can be swapped without redesigning the app.

## API

```text
GET    /api/board
POST   /api/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
POST   /api/tasks/:id/take
POST   /api/tasks/:id/done
PUT    /api/team
```

## Product rules

The task model is intentionally small:

```text
TITLE
DESCRIPTION
PRIORITY
OWNER
STATUS
BLOCKED BY
DONE WHEN
LINKS
```

Priorities:

```text
P0 P1 P2 P3
```

Statuses:

```text
READY
DOING
BLOCKED
REVIEW
DONE
```

Keyboard:

```text
/   focus quick-add
N   new task
```

## Suggested next changes

Before treating this as production software, the first things to add are:

1. authentication,
2. actual users/team membership,
3. Postgres or a Render persistent disk,
4. audit history,
5. notifications,
6. links/comments only if the team proves it needs them.

Do not add Jira because you successfully escaped Jira.

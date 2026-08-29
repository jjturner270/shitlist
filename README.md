# SHITLIST

A team-focused work queue for people who need to know:

- what matters right now,
- who owns it,
- what is blocked,
- and what nobody has picked up.

No sprints. No story points. No workflow priesthood.

## Quick start (Docker)

```bash
docker compose up -d
```

Open:

```text
http://localhost:10000
```

Create an account. You get your own team. Add work. Take it. Block it. Review it. Finish it. Everyone in the team sees exactly what happened.

### Commands

```bash
make up       # build + start
make down     # stop
make logs     # tail app logs
make backup   # dump postgres to backups/
make restore f=backups/shitlist-20260828-120000.sql  # restore a dump
```

## Run locally (without Docker)

Requirements: Node 20+, PostgreSQL 16+.

```bash
createdb shitlist
psql -d shitlist -c "CREATE USER shitlist WITH PASSWORD 'shitlist';"
psql -d shitlist -c "GRANT ALL PRIVILEGES ON DATABASE shitlist TO shitlist;"
cp .env.example .env
npm install
npm start
```

The app runs migrations on boot. Open `http://localhost:10000`.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | no | `10000` | HTTP port |
| `DATABASE_URL` | prod | `postgres://shitlist:shitlist@localhost:5432/shitlist` | Postgres connection string |
| `SESSION_SECRET` | prod | dev-only default | Signing key for session cookies. Set a long random value in production. |
| `NODE_ENV` | no | - | `production` enables `Secure` cookies and strict env validation. |

## Deploy on Render

### Fast path: Blueprint

1. Push this folder to a GitHub repo.
2. In Render, choose **New → Blueprint**.
3. Connect the repo.
4. Render reads `render.yaml`, creates the web service and a PostgreSQL database, and wires `DATABASE_URL` automatically.

### Health check

```text
GET /health
```

Returns `200` when the app and database are both up, `503` when the database is unreachable.

## Data

PostgreSQL. Migrations live in `migrations/` and run automatically on boot, tracked in the `_migrations` table.

### Backup / restore

```bash
# backup
make backup

# restore
make restore f=backups/shitlist-YYYYMMDD-HHMMSS.sql
```

On Render, use the Render Postgres backup UI or `pg_dump` against the connection string.

## API

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

POST   /api/teams
GET    /api/teams

GET    /api/board
PUT    /api/team
GET    /api/pulse

POST   /api/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id

POST   /api/tasks/:id/take
POST   /api/tasks/:id/start
POST   /api/tasks/:id/block     { "reason": "..." }
POST   /api/tasks/:id/review
POST   /api/tasks/:id/done

GET    /api/tasks/:id/events

POST   /api/import/csv         { "csv": "<jira csv text>" }
```

Every endpoint is scoped to your team. You cannot read or mutate another team's work.

## Keyboard

```text
/        focus quick add
N        new task
J / K    next / previous task
ENTER    open task
T        take task
S        start
B        block
R        review
D        done
ESC      close
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
HISTORY
```

Priorities: `P0 P1 P2 P3`. Statuses: `READY DOING BLOCKED REVIEW DONE`.

The primary interface is a sorted team queue, not a kanban board. DONE falls out. Blocked work is impossible to hide. Unowned work looks uncomfortable.

## Security notes

- Sessions are stored in Postgres; cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Login/register are rate limited (20 attempts / 10 min per IP).
- Passwords must be at least 8 characters, hashed with bcrypt.
- All task/team routes check server-side team membership.

## Contributing

Keep the queue sacred. If a feature does not improve "what matters now, who owns it, what is blocked, what nobody picked up, what changed" — it needs a very strong reason to exist.

Do not add Jira because you successfully escaped Jira.

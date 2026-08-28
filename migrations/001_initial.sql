CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  priority        TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0','P1','P2','P3')),
  owner           TEXT NOT NULL DEFAULT '',
  owner_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'READY' CHECK (status IN ('READY','DOING','BLOCKED','REVIEW','DONE')),
  blocked_by      TEXT NOT NULL DEFAULT '',
  done_when       TEXT NOT NULL DEFAULT '',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS tasks_team_id_idx ON tasks(team_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);

CREATE TABLE IF NOT EXISTS task_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,
  before_json JSONB,
  after_json  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_events_task_id_idx ON task_events(task_id);

CREATE TABLE IF NOT EXISTS "session" (
  sid        TEXT NOT NULL PRIMARY KEY,
  sess       JSONB NOT NULL,
  expire     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS session_expire_idx ON "session"(expire);

INSERT INTO teams (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Product Team', 'product')
ON CONFLICT DO NOTHING;
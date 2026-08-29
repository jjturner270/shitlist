import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { pool, query, runMigrations, waitForDb, closePool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const SESSION_SECRET = process.env.SESSION_SECRET || "shitlist-dev-secret-change-in-production";
const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : IS_PROD;

const PgStore = connectPgSimple(session);

app.set("trust proxy", 1);

app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE
  }
}));

function rateLimit(ms, max) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    const window = hits.get(key);
    if (!window || window.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + ms });
      return next();
    }
    window.count += 1;
    if (window.count > max) {
      return res.status(429).json({ error: "too many attempts, slow down" });
    }
    next();
  };
}

const PRIORITIES = ["P0", "P1", "P2", "P3"];
const STATUSES = ["READY", "DOING", "BLOCKED", "REVIEW", "DONE"];

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genInviteKey() {
  const rand = crypto.randomBytes(8);
  let key = "";
  for (let i = 0; i < 8; i++) key += INVITE_ALPHABET[rand[i] % INVITE_ALPHABET.length];
  return key;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "authentication required" });
  }
  next();
}

async function requireTeam(req, res, next) {
  try {
    const user = await query("SELECT current_team_id FROM users WHERE id = $1", [req.session.userId]);
    const currentId = user.rows[0]?.current_team_id;
    const result = currentId
      ? await query(
          "SELECT t.* FROM teams t JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1 WHERE t.id = $2",
          [req.session.userId, currentId]
        )
      : await query(
          "SELECT t.* FROM teams t JOIN team_members tm ON tm.team_id = t.id WHERE tm.user_id = $1 ORDER BY t.created_at LIMIT 1",
          [req.session.userId]
        );
    if (!result.rows.length) {
      return res.status(404).json({ error: "no team found" });
    }
    req.team = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

async function recordEvent(taskId, actorUserId, eventType, before, after) {
  await query(
    `INSERT INTO task_events (task_id, actor_user_id, event_type, before_json, after_json) VALUES ($1,$2,$3,$4,$5)`,
    [taskId, actorUserId, eventType, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]
  );
}

// ─── Auth routes ────────────────

const authLimiter = rateLimit(10 * 60 * 1000, 20);

app.post("/api/auth/register", authLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "password must be at least 8 characters" });
    }
    if (typeof email !== "string" || !email.includes("@") || email.length > 254) {
      return res.status(400).json({ error: "invalid email" });
    }

    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length) return res.status(409).json({ error: "email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const displayName = (name || "").trim() || email.split("@")[0];
    const user = await query(
      "INSERT INTO users (email, password, display_name) VALUES ($1,$2,$3) RETURNING id, email, display_name",
      [email, hash, displayName]
    );

    const slug = "team-" + user.rows[0].id.slice(0, 8);
    const team = await query(
      "INSERT INTO teams (name, slug, invite_key) VALUES ($1,$2,$3) RETURNING *",
      [displayName + "'s Team", slug, genInviteKey()]
    );
    await query(
      "INSERT INTO team_members (team_id, user_id, role) VALUES ($1,$2,'admin')",
      [team.rows[0].id, user.rows[0].id]
    );
    await query("UPDATE users SET current_team_id = $1 WHERE id = $2", [team.rows[0].id, user.rows[0].id]);

    req.session.userId = user.rows[0].id;
    req.session.displayName = displayName;
    res.status(201).json({ id: user.rows[0].id, email, display_name: displayName });
  } catch (err) {
    next(err);
  }
});

app.post("/api/auth/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });

    const result = await query("SELECT * FROM users WHERE email = $1", [email]);
    if (!result.rows.length) return res.status(401).json({ error: "invalid email or password" });

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "invalid email or password" });

    req.session.userId = user.id;
    req.session.displayName = user.display_name;
    res.json({ id: user.id, email: user.email, display_name: user.display_name });
  } catch (err) {
    next(err);
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", async (req, res, next) => {
  if (!req.session.userId) return res.json({ user: null });
  try {
    const result = await query("SELECT id, email, display_name FROM users WHERE id = $1", [req.session.userId]);
    if (!result.rows.length) {
      req.session.destroy(() => {});
      return res.json({ user: null });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── Team routes ──────────────

app.post("/api/teams", requireAuth, async (req, res, next) => {
  try {
    const name = (req.body.name || "").trim().slice(0, 120);
    if (!name) return res.status(400).json({ error: "team name required" });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") + "-" + crypto.randomBytes(3).toString("hex");
    const result = await query(
      "INSERT INTO teams (name, slug, invite_key) VALUES ($1,$2,$3) RETURNING *",
      [name, slug, genInviteKey()]
    );
    await query(
      "INSERT INTO team_members (team_id, user_id, role) VALUES ($1,$2,'admin')",
      [result.rows[0].id, req.session.userId]
    );
    await query("UPDATE users SET current_team_id = $1 WHERE id = $2", [result.rows[0].id, req.session.userId]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.constraint?.includes("teams_slug_key")) {
      return res.status(409).json({ error: "team slug already exists" });
    }
    next(err);
  }
});

app.get("/api/teams", requireAuth, async (req, res, next) => {
  try {
    const user = await query("SELECT current_team_id FROM users WHERE id = $1", [req.session.userId]);
    const result = await query(
      "SELECT t.id, t.name, t.slug, t.invite_key, tm.role FROM teams t JOIN team_members tm ON tm.team_id = t.id WHERE tm.user_id = $1 ORDER BY t.name",
      [req.session.userId]
    );
    res.json({ teams: result.rows, current: user.rows[0]?.current_team_id || null });
  } catch (err) {
    next(err);
  }
});

app.post("/api/teams/join", requireAuth, async (req, res, next) => {
  try {
    const key = (req.body.key || "").trim().toUpperCase();
    if (!key) return res.status(400).json({ error: "invite key required" });

    const team = await query("SELECT * FROM teams WHERE invite_key = $1", [key]);
    if (!team.rows.length) return res.status(404).json({ error: "no team found for that key" });

    const already = await query(
      "SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2",
      [team.rows[0].id, req.session.userId]
    );
    if (!already.rows.length) {
      await query(
        "INSERT INTO team_members (team_id, user_id, role) VALUES ($1,$2,'member')",
        [team.rows[0].id, req.session.userId]
      );
    }
    await query("UPDATE users SET current_team_id = $1 WHERE id = $2", [team.rows[0].id, req.session.userId]);
    res.json({ team: { id: team.rows[0].id, name: team.rows[0].name, slug: team.rows[0].slug } });
  } catch (err) {
    next(err);
  }
});

app.post("/api/teams/switch", requireAuth, async (req, res, next) => {
  try {
    const teamId = req.body.team_id;
    if (!teamId) return res.status(400).json({ error: "team_id required" });
    const member = await query(
      "SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2",
      [teamId, req.session.userId]
    );
    if (!member.rows.length) return res.status(403).json({ error: "not a member of that team" });
    await query("UPDATE users SET current_team_id = $1 WHERE id = $2", [teamId, req.session.userId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── Board (legacy) ─────────

app.get("/api/board", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const tasks = await query(
      "SELECT id, title, description, priority, owner, status, blocked_by, done_when, created_at, updated_at, completed_at FROM tasks WHERE team_id = $1 ORDER BY created_at",
      [req.team.id]
    );
    res.json({
      team: req.team.name,
      inviteKey: req.team.invite_key,
      tasks: tasks.rows.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        owner: t.owner,
        status: t.status,
        blockedBy: t.blocked_by,
        doneWhen: t.done_when,
        links: [],
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }))
    });
  } catch (err) {
    next(err);
  }
});

app.put("/api/team", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const name = (req.body.team || "").trim().slice(0, 120);
    if (!name) return res.status(400).json({ error: "team name required" });
    await query("UPDATE teams SET name = $1, updated_at = now() WHERE id = $2", [name, req.team.id]);
    res.json({ team: name });
  } catch (err) {
    next(err);
  }
});

// ─── Task CRUD ──────────

app.post("/api/tasks", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const { title, description, priority, owner, status, blockedBy, doneWhen } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: "title is required" });

    const taskStatus = STATUSES.includes(status) ? status : "READY";
    const taskPriority = PRIORITIES.includes(priority) ? priority : "P2";
    const blockedBy_ = taskStatus === "BLOCKED" ? (blockedBy || "") : "";

    const result = await query(
      `INSERT INTO tasks (team_id, title, description, priority, owner, status, blocked_by, done_when, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.team.id, title.trim(), (description || "").trim(), taskPriority, (owner || "").trim(), taskStatus, blockedBy_, (doneWhen || "").trim(), req.session.userId]
    );

    await recordEvent(result.rows[0].id, req.session.userId, "created", null, result.rows[0]);

    const t = result.rows[0];
    res.status(201).json({
      id: t.id, title: t.title, description: t.description, priority: t.priority,
      owner: t.owner, status: t.status, blockedBy: t.blocked_by, doneWhen: t.done_when,
      links: [], createdAt: t.created_at, updatedAt: t.updated_at
    });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/tasks/:id", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const existing = await query("SELECT * FROM tasks WHERE id = $1 AND team_id = $2", [req.params.id, req.team.id]);
    if (!existing.rows.length) return res.status(404).json({ error: "task not found" });

    const before = existing.rows[0];
    const { title, description, priority, owner, status, blockedBy, doneWhen } = req.body;

    const task = {
      title: title !== undefined ? (title || "").trim() : before.title,
      description: description !== undefined ? (description || "").trim() : before.description,
      priority: priority !== undefined ? (PRIORITIES.includes(priority) ? priority : before.priority) : before.priority,
      owner: owner !== undefined ? (owner || "").trim() : before.owner,
      status: status !== undefined ? (STATUSES.includes(status) ? status : before.status) : before.status,
      blocked_by: (blockedBy !== undefined ? blockedBy : before.blocked_by) || "",
      done_when: doneWhen !== undefined ? doneWhen : before.done_when
    };

    if (task.status !== "BLOCKED") task.blocked_by = "";

    const result = await query(
      `UPDATE tasks SET title=$1, description=$2, priority=$3, owner=$4, status=$5, blocked_by=$6, done_when=$7,
       updated_at=now(), completed_at=CASE WHEN $5='DONE' AND completed_at IS NULL THEN now() ELSE completed_at END
       WHERE id=$8 AND team_id=$9 RETURNING *`,
      [task.title, task.description, task.priority, task.owner, task.status, task.blocked_by, task.done_when, req.params.id, req.team.id]
    );

    await recordEvent(req.params.id, req.session.userId, "edited", before, result.rows[0]);

    const t = result.rows[0];
    res.json({
      id: t.id, title: t.title, description: t.description, priority: t.priority,
      owner: t.owner, status: t.status, blockedBy: t.blocked_by, doneWhen: t.done_when,
      links: [], createdAt: t.created_at, updatedAt: t.updated_at
    });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/tasks/:id", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const result = await query("DELETE FROM tasks WHERE id = $1 AND team_id = $2 RETURNING *", [req.params.id, req.team.id]);
    if (!result.rows.length) return res.status(404).json({ error: "task not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── Task actions ──────────────

app.post("/api/tasks/:id/take", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const who = (req.body.owner || "").trim() || req.session.displayName;
    if (!who) return res.status(400).json({ error: "owner name required" });

    const existing = await query("SELECT * FROM tasks WHERE id = $1 AND team_id = $2", [req.params.id, req.team.id]);
    if (!existing.rows.length) return res.status(404).json({ error: "task not found" });

    const before = existing.rows[0];
    const newStatus = before.status === "READY" ? "DOING" : before.status;
    const result = await query(
      `UPDATE tasks SET owner=$1, status=$2, owner_user_id=$3, updated_at=now() WHERE id=$4 AND team_id=$5 RETURNING *`,
      [who, newStatus, req.session.userId, req.params.id, req.team.id]
    );

    await recordEvent(req.params.id, req.session.userId, "claimed", before, result.rows[0]);

    const t = result.rows[0];
    res.json({ id: t.id, title: t.title, owner: t.owner, status: t.status, blockedBy: t.blocked_by });
  } catch (err) {
    next(err);
  }
});

app.post("/api/tasks/:id/start", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const existing = await query("SELECT * FROM tasks WHERE id = $1 AND team_id = $2", [req.params.id, req.team.id]);
    if (!existing.rows.length) return res.status(404).json({ error: "task not found" });

    const before = existing.rows[0];
    const result = await query(
      "UPDATE tasks SET status='DOING', updated_at=now() WHERE id=$1 AND team_id=$2 RETURNING *",
      [req.params.id, req.team.id]
    );
    await recordEvent(req.params.id, req.session.userId, "started", before, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post("/api/tasks/:id/block", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const reason = (req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "blocker reason is required" });

    const existing = await query("SELECT * FROM tasks WHERE id = $1 AND team_id = $2", [req.params.id, req.team.id]);
    if (!existing.rows.length) return res.status(404).json({ error: "task not found" });

    const before = existing.rows[0];
    const result = await query(
      "UPDATE tasks SET status='BLOCKED', blocked_by=$1, updated_at=now() WHERE id=$2 AND team_id=$3 RETURNING *",
      [reason, req.params.id, req.team.id]
    );
    await recordEvent(req.params.id, req.session.userId, "blocked", before, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post("/api/tasks/:id/review", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const existing = await query("SELECT * FROM tasks WHERE id = $1 AND team_id = $2", [req.params.id, req.team.id]);
    if (!existing.rows.length) return res.status(404).json({ error: "task not found" });

    const before = existing.rows[0];
    const result = await query(
      "UPDATE tasks SET status='REVIEW', updated_at=now() WHERE id=$1 AND team_id=$2 RETURNING *",
      [req.params.id, req.team.id]
    );
    await recordEvent(req.params.id, req.session.userId, "sent_to_review", before, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post("/api/tasks/:id/done", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const existing = await query("SELECT * FROM tasks WHERE id = $1 AND team_id = $2", [req.params.id, req.team.id]);
    if (!existing.rows.length) return res.status(404).json({ error: "task not found" });

    const before = existing.rows[0];
    const result = await query(
      "UPDATE tasks SET status='DONE', blocked_by='', completed_at=now(), updated_at=now() WHERE id=$1 AND team_id=$2 RETURNING *",
      [req.params.id, req.team.id]
    );
    await recordEvent(req.params.id, req.session.userId, "completed", before, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ─── Events ─────────

app.get("/api/tasks/:id/events", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const task = await query("SELECT id FROM tasks WHERE id = $1 AND team_id = $2", [req.params.id, req.team.id]);
    if (!task.rows.length) return res.status(404).json({ error: "task not found" });

    const result = await query(
      `SELECT e.*, u.display_name AS actor_name
       FROM task_events e
       LEFT JOIN users u ON u.id = e.actor_user_id
       WHERE e.task_id = $1
       ORDER BY e.created_at DESC
       LIMIT 100`,
       [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ─── Pulse ───────────

app.get("/api/pulse", requireAuth, requireTeam, async (req, res, next) => {
  try {
    const tasks = await query("SELECT priority, owner, status, completed_at FROM tasks WHERE team_id = $1", [req.team.id]);
    const all = tasks.rows;
    const open = all.filter(t => t.status !== "DONE");
    const pulse = {
      critical: open.filter(t => t.priority === "P0").length,
      blocked: all.filter(t => t.status === "BLOCKED").length,
      unowned: all.filter(t => !t.owner && t.status !== "DONE").length,
      review: all.filter(t => t.status === "REVIEW").length,
      done7d: all.filter(t => {
        if (t.status !== "DONE" || !t.completed_at) return false;
        return Date.now() - new Date(t.completed_at).getTime() <= 7 * 86400000;
      }).length
    };
    res.json(pulse);
  } catch (err) {
    next(err);
  }
});

// ─── Health ──────────────

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "shitlist", db: "up", time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, service: "shitlist", db: "down", time: new Date().toISOString() });
  }
});

// ─── Error handler ─────────

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.status ? err.message : "internal server error"
  });
});

// ─── Boot ─────────────

const REQUIRED_ENV = ["DATABASE_URL", "SESSION_SECRET"];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length && process.env.NODE_ENV === "production") {
  console.error("boot failed: missing required environment variables: " + missing.join(", "));
  process.exit(1);
}

try {
  await waitForDb();
  await runMigrations();
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`shitlist listening on :${PORT}`);
  });

  const shutdown = () => {
    console.log("shutting down...");
    server.close(async () => {
      try { await closePool(); } catch {}
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} catch (err) {
  console.error("boot failed:", err.message || err);
  process.exit(1);
}
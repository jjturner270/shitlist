import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "tasks.json");

app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

const PRIORITIES = ["P0", "P1", "P2", "P3"];
const STATUSES = ["READY", "DOING", "BLOCKED", "REVIEW", "DONE"];

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const seed = {
      team: "Product Team",
      tasks: [
        {
          id: "001",
          title: "Fix approval restoration",
          description: "Approval state disappears after runtime restoration. Reproduce it, identify the ownership boundary, and fix the regression.",
          priority: "P0",
          owner: "Jon",
          status: "DOING",
          blockedBy: "",
          doneWhen: "Approval survives restart; existing tests pass; regression coverage exists.",
          links: [],
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 23 * 60 * 1000).toISOString()
        },
        {
          id: "002",
          title: "Production auth failures",
          description: "Track down the current auth failures in production and identify whether the regression is in config, token handling, or deployment.",
          priority: "P0",
          owner: "Zack",
          status: "BLOCKED",
          blockedBy: "Waiting on production credentials",
          doneWhen: "Root cause identified and fix deployed or handed off with a concrete next action.",
          links: [],
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 70 * 60 * 1000).toISOString()
        },
        {
          id: "003",
          title: "GEO demo access",
          description: "Make sure the business team can get into the current GEO demo without engineering intervention.",
          priority: "P1",
          owner: "Sharon",
          status: "READY",
          blockedBy: "",
          doneWhen: "Credentials work and the demo flow can be completed from a clean session.",
          links: [],
          createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "004",
          title: "Review execution adapter",
          description: "Review the execution adapter changes for edge cases, failure normalization, and anything that could break runtime continuity.",
          priority: "P1",
          owner: "Phillip",
          status: "REVIEW",
          blockedBy: "",
          doneWhen: "Review completed with comments resolved or explicit follow-up tasks created.",
          links: [],
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "005",
          title: "Update deployment docs",
          description: "Document the current deploy path so somebody other than the person who built it can ship it.",
          priority: "P2",
          owner: "",
          status: "READY",
          blockedBy: "",
          doneWhen: "A teammate can deploy from the docs without asking for missing steps.",
          links: [],
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    };
    await writeStore(seed);
  }
}

async function readStore() {
  await ensureStore();
  return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
}

async function writeStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE);
}

function nextId(tasks) {
  const max = tasks.reduce((n, t) => Math.max(n, Number(t.id) || 0), 0);
  return String(max + 1).padStart(3, "0");
}

function normalizeTask(input, existing = {}) {
  const now = new Date().toISOString();
  const task = {
    ...existing,
    title: String(input.title ?? existing.title ?? "").trim().slice(0, 180),
    description: String(input.description ?? existing.description ?? "").trim().slice(0, 4000),
    priority: PRIORITIES.includes(input.priority) ? input.priority : (existing.priority || "P2"),
    owner: String(input.owner ?? existing.owner ?? "").trim().slice(0, 80),
    status: STATUSES.includes(input.status) ? input.status : (existing.status || "READY"),
    blockedBy: String(input.blockedBy ?? existing.blockedBy ?? "").trim().slice(0, 500),
    doneWhen: String(input.doneWhen ?? existing.doneWhen ?? "").trim().slice(0, 1500),
    links: Array.isArray(input.links)
      ? input.links.map(v => String(v).trim()).filter(Boolean).slice(0, 10)
      : (existing.links || []),
    updatedAt: now
  };

  if (!task.title) {
    const err = new Error("title is required");
    err.status = 400;
    throw err;
  }

  if (task.status !== "BLOCKED") task.blockedBy = "";
  return task;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "shitlist", time: new Date().toISOString() });
});

app.get("/api/board", async (_req, res, next) => {
  try {
    res.json(await readStore());
  } catch (err) {
    next(err);
  }
});

app.post("/api/tasks", async (req, res, next) => {
  try {
    const store = await readStore();
    const task = normalizeTask(req.body);
    task.id = nextId(store.tasks);
    task.createdAt = new Date().toISOString();
    store.tasks.push(task);
    await writeStore(store);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

app.patch("/api/tasks/:id", async (req, res, next) => {
  try {
    const store = await readStore();
    const index = store.tasks.findIndex(t => t.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "task not found" });

    const updated = normalizeTask(req.body, store.tasks[index]);
    store.tasks[index] = updated;
    await writeStore(store);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    const store = await readStore();
    const before = store.tasks.length;
    store.tasks = store.tasks.filter(t => t.id !== req.params.id);
    if (store.tasks.length === before) return res.status(404).json({ error: "task not found" });
    await writeStore(store);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

app.post("/api/tasks/:id/take", async (req, res, next) => {
  try {
    const owner = String(req.body.owner || "").trim();
    if (!owner) return res.status(400).json({ error: "owner is required" });

    const store = await readStore();
    const task = store.tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: "task not found" });

    task.owner = owner.slice(0, 80);
    if (task.status === "READY") task.status = "DOING";
    task.updatedAt = new Date().toISOString();
    await writeStore(store);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

app.post("/api/tasks/:id/done", async (req, res, next) => {
  try {
    const store = await readStore();
    const task = store.tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: "task not found" });

    task.status = "DONE";
    task.blockedBy = "";
    task.updatedAt = new Date().toISOString();
    await writeStore(store);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

app.put("/api/team", async (req, res, next) => {
  try {
    const team = String(req.body.team || "").trim().slice(0, 120);
    if (!team) return res.status(400).json({ error: "team is required" });
    const store = await readStore();
    store.team = team;
    await writeStore(store);
    res.json({ team });
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.status ? err.message : "internal server error",
    requestId: crypto.randomUUID()
  });
});

await ensureStore();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`shitlist listening on :${PORT}`);
});

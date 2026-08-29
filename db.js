import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || "postgres://shitlist:shitlist@localhost:5432/shitlist";

export const pool = new pg.Pool({ connectionString: DATABASE_URL });

pool.on("error", err => {
  console.error("pg pool error", err);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function waitForDb(maxAttempts = 30, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.log(`db not ready (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

export async function runMigrations() {
  const dir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(dir).sort();

  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      run_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  for (const file of files) {
    if (!file.endsWith(".sql")) continue;

    const { rows } = await query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
    if (rows.length) continue;

    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await query(sql);
    await query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
    console.log(`migrated: ${file}`);
  }
}

export async function closePool() {
  await pool.end();
}
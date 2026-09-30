// Storage for the carpool data. Everything is small JSON documents stored by key.
//
//  - On Vercel: Turso. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN; the table is created on first use.
//  - Upstash Redis also works (KV_REST_API_URL and KV_REST_API_TOKEN), if Turso isn't set.
//  - When developing locally (no database settings): JSON files in ./.localdata
import "server-only";
import { createClient } from "@libsql/client";
import fs from "node:fs/promises";
import path from "node:path";

export interface Store {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

function fileStore(dir: string): Store {
  const file = (key: string) => path.join(dir, encodeURIComponent(key) + ".json");
  return {
    async get<T>(key: string) {
      try { return JSON.parse(await fs.readFile(file(key), "utf8")) as T; } catch { return null; }
    },
    async set(key, value) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(file(key), JSON.stringify(value, null, 2)); },
    async del(key) { try { await fs.unlink(file(key)); } catch {} },
  };
}

// Upstash Redis over its REST API. Plain fetch, no extra package needed.
function redisStore(url: string, token: string): Store {
  const PREFIX = "carpool:";
  const cmd = async (...args: string[]) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!res.ok || data.error) throw new Error(`Redis error: ${data.error || res.status}`);
    return data.result;
  };
  return {
    async get<T>(key: string) {
      const v = await cmd("GET", PREFIX + key);
      return v == null ? null : (JSON.parse(String(v)) as T);
    },
    async set(key, value) { await cmd("SET", PREFIX + key, JSON.stringify(value)); },
    async del(key) { await cmd("DEL", PREFIX + key); },
  };
}

// Turso (libSQL): one table of key -> JSON text.
function tursoStore(url: string, authToken?: string): Store {
  const db = createClient({ url, authToken });
  let ready: Promise<unknown> | null = null;
  const init = () => (ready ??= db.execute("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)").catch((err) => { ready = null; throw err; }));
  return {
    async get<T>(key: string) {
      await init();
      const { rows } = await db.execute({ sql: "SELECT value FROM kv WHERE key = ?", args: [key] });
      return rows.length ? (JSON.parse(String(rows[0].value)) as T) : null;
    },
    async set(key, value) {
      await init();
      await db.execute({ sql: "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [key, JSON.stringify(value)] });
    },
    async del(key) { await init(); await db.execute({ sql: "DELETE FROM kv WHERE key = ?", args: [key] }); },
  };
}

let cached: Store | null = null;

export function store(): Store {
  if (cached) return cached;
  const e = process.env;
  const url = e.KV_REST_API_URL || e.UPSTASH_REDIS_REST_URL;
  const token = e.KV_REST_API_TOKEN || e.UPSTASH_REDIS_REST_TOKEN;
  if (e.TURSO_DATABASE_URL) cached = tursoStore(e.TURSO_DATABASE_URL, e.TURSO_AUTH_TOKEN);
  else if (url && token) cached = redisStore(url, token);
  else if (e.NODE_ENV !== "production" || e.LOCAL_STORE_DIR) cached = fileStore(e.LOCAL_STORE_DIR || path.join(process.cwd(), ".localdata"));
  else throw new Error("No database configured. In Vercel, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (Settings → Environment Variables), then redeploy.");
  return cached;
}

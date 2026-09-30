// Storage for the carpool data. Everything is small JSON documents stored by key.
//
//  - On Vercel: Upstash Redis. Add "Upstash for Redis" from the Vercel Marketplace and
//    connect it to the project; it sets KV_REST_API_URL and KV_REST_API_TOKEN.
//  - When developing locally (no Redis settings): JSON files in ./.localdata
import "server-only";
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

let cached: Store | null = null;

export function store(): Store {
  if (cached) return cached;
  const e = process.env;
  const url = e.KV_REST_API_URL || e.UPSTASH_REDIS_REST_URL;
  const token = e.KV_REST_API_TOKEN || e.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) cached = redisStore(url, token);
  else if (e.NODE_ENV !== "production" || e.LOCAL_STORE_DIR) cached = fileStore(e.LOCAL_STORE_DIR || path.join(process.cwd(), ".localdata"));
  else throw new Error("No database configured. On Vercel, connect Upstash for Redis to this project (it sets KV_REST_API_URL and KV_REST_API_TOKEN).");
  return cached;
}

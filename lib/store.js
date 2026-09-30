// Storage layer. On Vercel this uses Upstash Redis (connect it from the Vercel Marketplace).
// For local development/testing, set LOCAL_STORE_DIR and it uses JSON files on disk.
import fs from "node:fs/promises";
import path from "node:path";

let storePromise;

async function fileStore(dir) {
  await fs.mkdir(dir, { recursive: true });
  const file = (key) => path.join(dir, encodeURIComponent(key) + ".json");
  return {
    async get(key) {
      try { return JSON.parse(await fs.readFile(file(key), "utf8")); }
      catch { return null; }
    },
    async set(key, value) { await fs.writeFile(file(key), JSON.stringify(value, null, 2)); },
    async del(key) { try { await fs.unlink(file(key)); } catch {} },
  };
}

async function redisStore() {
  // The Vercel Marketplace integration may inject either naming scheme.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("No storage configured: connect Upstash Redis (KV_REST_API_URL/TOKEN) or set LOCAL_STORE_DIR");
  const { Redis } = await import("@upstash/redis");
  const r = new Redis({ url, token });
  const k = (key) => `carpool:${key}`;
  return {
    get: (key) => r.get(k(key)),         // values are JSON-(de)serialized by the client
    set: (key, value) => r.set(k(key), value),
    del: (key) => r.del(k(key)),
  };
}

export function store() {
  if (!storePromise) {
    storePromise = process.env.LOCAL_STORE_DIR
      ? fileStore(path.resolve(process.env.LOCAL_STORE_DIR))
      : redisStore();
    storePromise.catch(() => { storePromise = undefined; }); // retry on the next request
  }
  return storePromise;
}

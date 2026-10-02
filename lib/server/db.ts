// The carpool database: Turso (libSQL), one table per kind of data (see SCHEMA).
//
//  - On Vercel: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Tables are created on first use.
//  - When developing locally (no database settings): a SQLite file at ./.localdata/carpool.db
//
// Every table has an auto-generated numeric `id`, and tables point at each other by those ids.
// The first time the tables are empty they're filled from the old `kv` table (JSON documents by key,
// how the data used to be stored) if it has data, otherwise from seed.ts. The kv table is left as a backup.
import "server-only";
import { createClient, type Client, type InStatement } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { normEmail } from "./auth";
import { SEED_CONFIG, SEED_NEEDS, SEED_RIDES, type OldConfig, type OldRide } from "./seed";
import { ALL_SCHOOLS, LEGS, NEED_VALUES, type KidNeeds, type Need } from "../types";

const ID = "id INTEGER PRIMARY KEY AUTOINCREMENT";
const NEED = "need TEXT NOT NULL CHECK (need IN ('both', 'dropoff', 'pickup', 'none'))";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (${ID},
    title TEXT NOT NULL, school TEXT NOT NULL, location TEXT NOT NULL, rehearsal TEXT NOT NULL,
    dropoff_note TEXT NOT NULL, pickup_note TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (${ID},
    email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
    is_admin INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS kids (${ID},
    name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS kid_parents (${ID},
    kid_id INTEGER NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE (kid_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS rehearsal_dates (${ID},
    date TEXT NOT NULL UNIQUE, note TEXT NOT NULL DEFAULT '',
    flag TEXT NOT NULL DEFAULT '' CHECK (flag IN ('', 'confirm', 'cancelled')))`,
  `CREATE TABLE IF NOT EXISTS important_dates (${ID},
    date TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS kid_usual_needs (${ID},
    kid_id INTEGER NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    weekday TEXT NOT NULL, ${NEED},
    UNIQUE (kid_id, weekday))`,
  `CREATE TABLE IF NOT EXISTS kid_need_overrides (${ID},
    kid_id INTEGER NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    rehearsal_id INTEGER NOT NULL REFERENCES rehearsal_dates(id) ON DELETE CASCADE,
    ${NEED},
    UNIQUE (kid_id, rehearsal_id))`,
  // A driver is a signed-in user (driver_id) or someone an admin added by name (guest_name).
  `CREATE TABLE IF NOT EXISTS cars (${ID},
    rehearsal_id INTEGER NOT NULL REFERENCES rehearsal_dates(id) ON DELETE CASCADE,
    leg TEXT NOT NULL CHECK (leg IN ('dropoff', 'pickup')),
    driver_id INTEGER REFERENCES users(id),
    guest_name TEXT, guest_phone TEXT,
    seats INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 10),
    added_by_id INTEGER REFERENCES users(id),
    CHECK ((driver_id IS NULL) <> (guest_name IS NULL)),
    UNIQUE (rehearsal_id, leg, driver_id))`,
  // rehearsal_id and leg are copied from the car so a kid can only be in one car per trip.
  `CREATE TABLE IF NOT EXISTS car_kids (${ID},
    car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    kid_id INTEGER NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    rehearsal_id INTEGER NOT NULL, leg TEXT NOT NULL,
    UNIQUE (car_id, kid_id),
    UNIQUE (rehearsal_id, leg, kid_id))`,
  `CREATE TABLE IF NOT EXISTS used_links (${ID}, token TEXT NOT NULL UNIQUE, used_at INTEGER NOT NULL)`,
];

export const isConstraintError = (err: unknown) => /SQLITE_CONSTRAINT/.test(String((err as { code?: string })?.code ?? err));

function connect(): Client {
  const e = process.env;
  if (e.TURSO_DATABASE_URL) return createClient({ url: e.TURSO_DATABASE_URL, authToken: e.TURSO_AUTH_TOKEN });
  if (e.NODE_ENV !== "production" || e.LOCAL_STORE_DIR) {
    const dir = e.LOCAL_STORE_DIR || path.join(process.cwd(), ".localdata");
    fs.mkdirSync(dir, { recursive: true });
    return createClient({ url: "file:" + path.join(dir, "carpool.db") });
  }
  throw new Error("No database configured. In Vercel, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (Settings → Environment Variables), then redeploy.");
}

let ready: Promise<Client> | null = null;

export function db(): Promise<Client> {
  return (ready ??= (async () => {
    const c = connect();
    await c.execute("PRAGMA foreign_keys = ON"); // Turso has this on; local files need it set
    await c.batch(SCHEMA, "write");
    const { rows } = await c.execute("SELECT 1 FROM settings");
    if (!rows.length) await fill(c);
    await upgrade(c);
    await firstAdmins(c);
    return c;
  })().catch((err) => { ready = null; throw err; }));
}

// Changes made after the tables were first created (CREATE TABLE IF NOT EXISTS leaves existing tables alone).
// Each runs once, the first time its column is missing. New databases are filled from the seed first, then upgraded.
async function upgrade(c: Client) {
  const columns = async (table: string) => (await c.execute(`PRAGMA table_info(${table})`)).rows.map((r) => String(r.name));
  if (!(await columns("kids")).includes("regular_day")) {
    await c.execute("ALTER TABLE kids ADD COLUMN regular_day TEXT NOT NULL DEFAULT ''");
  }
  if (!(await columns("rehearsal_dates")).includes("all_schools")) await c.batch([
    "ALTER TABLE rehearsal_dates ADD COLUMN all_schools INTEGER NOT NULL DEFAULT 0",
    // Until now every Wednesday was a combined all-school rehearsal, and usual needs were kept by weekday.
    "UPDATE rehearsal_dates SET all_schools = 1 WHERE strftime('%w', date) = '3'",
    `UPDATE kid_usual_needs SET weekday = '${ALL_SCHOOLS}' WHERE weekday = 'Wednesday'`,
    // Each regular Tuesday gets a Wednesday for kids whose regular day is Wednesday.
    "INSERT OR IGNORE INTO rehearsal_dates (date, note) SELECT date(date, '+1 day'), 'Wednesday (Non Park View day)' FROM rehearsal_dates WHERE strftime('%w', date) = '2'",
  ], "write");
  // Notes used to end with a reminder to confirm the rehearsal; drop it. Matches nothing once it's gone.
  await c.execute("UPDATE rehearsal_dates SET note = replace(replace(note, ' • Confirm whether rehearsal is held', ''), ' • Confirm rehearsal', '') WHERE note LIKE '%Confirm%rehearsal%'");
}

// Admins are users with is_admin = 1, managed in Admin. ADMIN_EMAILS only matters while nobody is an admin
// (a new database), so there's always someone who can sign in and set things up.
async function firstAdmins(c: Client) {
  const emails = (process.env.ADMIN_EMAILS || "").split(",").map(normEmail).filter((e) => e.includes("@"));
  if (!emails.length || (await c.execute("SELECT 1 FROM users WHERE is_admin = 1 LIMIT 1")).rows.length) return;
  await c.batch(emails.map((e) => ({
    sql: "INSERT INTO users (email, is_admin) VALUES (?, 1) ON CONFLICT (email) DO UPDATE SET is_admin = 1",
    args: [e],
  })), "write");
}

// ---------- first run: copy the old JSON documents (or the seed) into the tables ----------

interface Docs {
  config: OldConfig;
  needs: Record<string, KidNeeds>;
  rides: Record<string, OldRide>;
  users: Record<string, { name?: string; phone?: string }>;
  kidinfo: Record<string, { address?: string; notes?: string }>;
  usedlinks: Record<string, { at?: number }>;
}

async function readKv(c: Client): Promise<Docs | null> {
  const { rows: t } = await c.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'kv'");
  if (!t.length) return null;
  const docs = { needs: {}, rides: {}, users: {}, kidinfo: {}, usedlinks: {} } as Docs;
  const { rows } = await c.execute("SELECT key, value FROM kv");
  for (const r of rows) {
    const key = String(r.key), value = JSON.parse(String(r.value));
    const [kind, ...rest] = key.split("/");
    const id = rest.join("/");
    if (key === "config") docs.config = value;
    else if (kind in docs && kind !== "config" && id) (docs[kind as Exclude<keyof Docs, "config">] as Record<string, unknown>)[id] = value;
  }
  return docs.config ? docs : null;
}

async function fill(c: Client) {
  const seed: Docs = {
    config: structuredClone(SEED_CONFIG), needs: SEED_NEEDS, rides: SEED_RIDES, users: {}, kidinfo: {}, usedlinks: {},
  };
  try {
    await c.batch(importStatements((await readKv(c)) || seed), "write");
  } catch (err) {
    // Another request filled the tables at the same moment.
    if (!isConstraintError(err) || !(await c.execute("SELECT 1 FROM settings")).rows.length) throw err;
  }
}

// Rows that other rows point at get their ids assigned here, so the whole copy is one batch.
function importStatements({ config: cfg, needs, rides, users, kidinfo, usedlinks }: Docs): InStatement[] {
  // Older copies stored the rehearsal site as the school.
  let { school, location } = cfg;
  if (location === undefined) {
    location = SEED_CONFIG.location!;
    if (school === location) school = SEED_CONFIG.school;
  }
  const s: InStatement[] = [{
    sql: "INSERT INTO settings (id, title, school, location, rehearsal, dropoff_note, pickup_note) VALUES (1, ?, ?, ?, ?, ?, ?)",
    args: [cfg.title, school, location, cfg.rehearsal, cfg.dropoffNote, cfg.pickupNote],
  }];

  // Everyone mentioned anywhere becomes a user. Drivers without a profile keep the name on their signup.
  const people = new Map<string, { id: number; name: string; phone: string; admin: boolean }>();
  const person = (email: string) => {
    const e = normEmail(email);
    if (!people.has(e)) people.set(e, { id: people.size + 1, name: users[e]?.name || "", phone: users[e]?.phone || "", admin: false });
    return people.get(e)!;
  };
  for (const e of Object.keys(users)) person(e);
  for (const e of cfg.admins || []) person(e).admin = true;
  for (const k of cfg.kids) for (const e of k.parents || []) person(e);
  for (const r of Object.values(rides)) for (const leg of LEGS) for (const d of r[leg] || []) {
    if (!d.email.startsWith("guest:")) { const p = person(d.email); p.name ||= d.name; }
    if (d.addedBy) person(d.addedBy);
  }
  for (const [email, p] of people) s.push({ sql: "INSERT INTO users (id, email, name, phone, is_admin) VALUES (?, ?, ?, ?, ?)", args: [p.id, email, p.name, p.phone, p.admin ? 1 : 0] });

  const dateIds = new Map<string, number>();
  for (const d of cfg.dates) {
    if (dateIds.has(d.id)) continue;
    dateIds.set(d.id, dateIds.size + 1);
    s.push({ sql: "INSERT INTO rehearsal_dates (id, date, note, flag) VALUES (?, ?, ?, ?)", args: [dateIds.get(d.id)!, d.id, d.note || "", d.flag || ""] });
  }
  for (const d of cfg.importantDates || []) s.push({ sql: "INSERT INTO important_dates (date, title, detail) VALUES (?, ?, ?)", args: [d.date, d.title, d.detail || ""] });

  const kidIds = new Map<string, number>();
  cfg.kids.forEach((k, i) => {
    const id = i + 1;
    kidIds.set(k.id, id);
    s.push({ sql: "INSERT INTO kids (id, name, address, notes, position) VALUES (?, ?, ?, ?, ?)", args: [id, k.name, kidinfo[k.id]?.address || "", kidinfo[k.id]?.notes || "", i] });
    [...new Set((k.parents || []).map(normEmail))].forEach((e, j) =>
      s.push({ sql: "INSERT INTO kid_parents (kid_id, user_id, position) VALUES (?, ?, ?)", args: [id, person(e).id, j] }));
  });

  // Needs, cars and riders for kids or dates that no longer exist are dropped.
  for (const [slug, n] of Object.entries(needs)) {
    const kid = kidIds.get(slug);
    if (!kid) continue;
    for (const [day, v] of Object.entries(n.usual || {})) if (NEED_VALUES.includes(v as Need))
      s.push({ sql: "INSERT INTO kid_usual_needs (kid_id, weekday, need) VALUES (?, ?, ?)", args: [kid, day, v] });
    for (const [date, v] of Object.entries(n.overrides || {})) if (dateIds.has(date) && NEED_VALUES.includes(v as Need))
      s.push({ sql: "INSERT INTO kid_need_overrides (kid_id, rehearsal_id, need) VALUES (?, ?, ?)", args: [kid, dateIds.get(date)!, v] });
  }
  let carId = 0;
  for (const [date, r] of Object.entries(rides)) {
    const rehearsal = dateIds.get(date);
    if (!rehearsal) continue;
    for (const leg of LEGS) {
      const seated = new Set<number>(), drivers = new Set<string>();
      for (const d of r[leg] || []) {
        const guest = d.email.startsWith("guest:");
        if (!guest && drivers.has(normEmail(d.email))) continue;
        drivers.add(normEmail(d.email));
        const id = ++carId;
        s.push({
          sql: "INSERT INTO cars (id, rehearsal_id, leg, driver_id, guest_name, guest_phone, seats, added_by_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          args: [id, rehearsal, leg, guest ? null : person(d.email).id, guest ? d.name || "Driver" : null, guest ? d.phone || "" : null,
            Math.max(1, Math.min(10, d.seats || 1)), d.addedBy ? person(d.addedBy).id : null],
        });
        for (const slug of d.kids) {
          const kid = kidIds.get(slug);
          if (!kid || seated.has(kid)) continue;
          seated.add(kid);
          s.push({ sql: "INSERT INTO car_kids (car_id, kid_id, rehearsal_id, leg) VALUES (?, ?, ?, ?)", args: [id, kid, rehearsal, leg] });
        }
      }
    }
  }
  for (const [token, u] of Object.entries(usedlinks)) s.push({ sql: "INSERT INTO used_links (token, used_at) VALUES (?, ?)", args: [token, u.at || Date.now()] });
  return s;
}

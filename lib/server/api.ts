// All server logic for /api/*. app/api/[...path]/route.ts passes every request here.
import "server-only";
import type { Client, InStatement, Row } from "@libsql/client";
import { db, isConstraintError } from "./db";
import {
  makeLinkToken, readLinkToken, makeSessionCookie, clearSessionCookie, sessionEmail, normEmail,
} from "./auth";
import {
  ALL_SCHOOLS, DEFAULT_REGULAR_DAY, LEGS, NEED_VALUES as NEEDS, REGULAR_DAYS,
  type Config, type Driver, type KidInfo, type KidNeeds, type Leg, type LegState, type Need, type Rehearsal, type RehearsalDate, type Ride,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Body = Record<string, any>;
interface Profile { name: string; phone: string }
// A driver as stored: the cars row id is kept for updates but never sent to the browser.
type Car = Driver & { id: number };
type CarRide = Record<Leg, Car[]>;

// Show the sign-in link on the page instead of emailing it (local development only).
const showDevLink = () => process.env.DEV_SHOW_LINK === "true" || (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY);

// ---------- helpers ----------
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
const fail = (status: number, error: string) => json({ error }, status);
const clean = (s: unknown, max = 200) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const str = (v: unknown) => (v == null ? "" : String(v));
// The school's time zone, for deciding which rehearsals are still upcoming.
const SCHOOL_TZ = "America/Chicago";
const weekdayOf = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

// ---------- reading ----------
// The site config plus each rehearsal date's row id (the API identifies rehearsals by their date).
type Cfg = Config & { rehearsalId: Record<string, number> };

async function loadConfig(c: Client): Promise<Cfg> {
  const [settings, kids, parents, admins, dates, important] = await c.batch([
    "SELECT * FROM settings ORDER BY id LIMIT 1",
    "SELECT id, name FROM kids ORDER BY position, id",
    "SELECT kp.kid_id, u.email FROM kid_parents kp JOIN users u ON u.id = kp.user_id ORDER BY kp.position, kp.id",
    "SELECT email FROM users WHERE is_admin = 1 ORDER BY email",
    "SELECT id, date, note, flag, all_schools FROM rehearsal_dates ORDER BY date",
    "SELECT date, title, detail FROM important_dates ORDER BY date, id",
  ], "read");
  const st = settings.rows[0];
  return {
    title: str(st.title), school: str(st.school), location: str(st.location), rehearsal: str(st.rehearsal),
    dropoffNote: str(st.dropoff_note), pickupNote: str(st.pickup_note),
    kids: kids.rows.map((k) => ({ id: Number(k.id), name: str(k.name), parents: parents.rows.filter((p) => p.kid_id === k.id).map((p) => str(p.email)) })),
    admins: admins.rows.map((a) => str(a.email)),
    dates: dates.rows.map((d) => ({ id: str(d.date), weekday: weekdayOf(str(d.date)), note: str(d.note), flag: str(d.flag) as RehearsalDate["flag"], allSchools: Number(d.all_schools) === 1 })),
    importantDates: important.rows.map((d) => ({ date: str(d.date), title: str(d.title), detail: str(d.detail) })),
    rehearsalId: Object.fromEntries(dates.rows.map((d) => [str(d.date), Number(d.id)])),
  };
}

async function loadNeeds(c: Client, cfg: Config, kidId?: number): Promise<Record<number, KidNeeds>> {
  const [usual, overrides, kids] = await c.batch([
    { sql: "SELECT kid_id, weekday, need FROM kid_usual_needs" + (kidId ? " WHERE kid_id = ?" : ""), args: kidId ? [kidId] : [] },
    {
      sql: "SELECT o.kid_id, r.date, o.need FROM kid_need_overrides o JOIN rehearsal_dates r ON r.id = o.rehearsal_id" + (kidId ? " WHERE o.kid_id = ?" : ""),
      args: kidId ? [kidId] : [],
    },
    { sql: "SELECT id, regular_day FROM kids" + (kidId ? " WHERE id = ?" : ""), args: kidId ? [kidId] : [] },
  ], "read");
  const needs: Record<number, KidNeeds> = {};
  for (const k of cfg.kids) if (!kidId || k.id === kidId) needs[k.id] = { usual: {}, overrides: {}, regularDay: "" };
  for (const r of kids.rows) { const n = needs[Number(r.id)]; if (n) n.regularDay = str(r.regular_day); }
  for (const r of usual.rows) { const n = needs[Number(r.kid_id)]; if (n) n.usual[str(r.weekday)] = str(r.need) as Need; }
  for (const r of overrides.rows) { const n = needs[Number(r.kid_id)]; if (n) n.overrides[str(r.date)] = str(r.need) as Need; }
  return needs;
}

const emptyRide = (): CarRide => ({ dropoff: [], pickup: [] });

function toCar(r: Row, kids: number[]): Car {
  const id = Number(r.id);
  const addedBy = r.added_by ? { addedBy: str(r.added_by) } : {};
  if (r.driver_id == null) return { id, email: `guest:${id}`, name: str(r.guest_name), phone: str(r.guest_phone), seats: Number(r.seats), kids, ...addedBy };
  return { id, email: str(r.driver_email), name: str(r.driver_name) || str(r.driver_email), seats: Number(r.seats), kids, ...addedBy };
}

// Cars for every rehearsal date (or just one), keyed by date.
async function loadRides(c: Client, cfg: Config, date?: string): Promise<Record<string, CarRide>> {
  const where = date ? " WHERE r.date = ?" : "";
  const args = date ? [date] : [];
  const [cars, riders] = await c.batch([
    {
      sql: `SELECT c.*, r.date, u.email AS driver_email, u.name AS driver_name, a.email AS added_by
        FROM cars c JOIN rehearsal_dates r ON r.id = c.rehearsal_id
        LEFT JOIN users u ON u.id = c.driver_id LEFT JOIN users a ON a.id = c.added_by_id${where} ORDER BY c.id`,
      args,
    },
    { sql: `SELECT ck.car_id, ck.kid_id FROM car_kids ck JOIN rehearsal_dates r ON r.id = ck.rehearsal_id${where} ORDER BY ck.id`, args },
  ], "read");
  const rides: Record<string, CarRide> = {};
  for (const d of cfg.dates) if (!date || d.id === date) rides[d.id] = emptyRide();
  for (const r of cars.rows) {
    const ride = rides[str(r.date)];
    if (ride) ride[str(r.leg) as Leg].push(toCar(r, riders.rows.filter((k) => k.car_id === r.id).map((k) => Number(k.kid_id))));
  }
  return rides;
}

async function loadUsers(c: Client): Promise<Record<string, Profile>> {
  const { rows } = await c.execute("SELECT email, name, phone FROM users");
  return Object.fromEntries(rows.map((u) => [str(u.email), { name: str(u.name), phone: str(u.phone) }]));
}

// Admins are the users marked is_admin (ADMIN_EMAILS only sets up the first ones; see db.ts).
const isAdmin = (cfg: Config, email: string) => (cfg.admins || []).map(normEmail).includes(email);
const kidsOf = (cfg: Config, email: string) => cfg.kids.filter((k) => (k.parents || []).map(normEmail).includes(email)).map((k) => k.id);
const isAllowed = (cfg: Config, email: string) => isAdmin(cfg, email) || kidsOf(cfg, email).length > 0;

// A kid's usual rides cover every all-school rehearsal and the regular rehearsals on their regular day.
// A change for a single week applies on any date.
function resolveNeed(needs: KidNeeds | undefined, date: RehearsalDate): Need {
  if (!needs) return "none";
  if (needs.overrides?.[date.id]) return needs.overrides[date.id];
  if (!date.allSchools && date.weekday !== (needs.regularDay || DEFAULT_REGULAR_DAY)) return "none";
  return needs.usual?.[date.allSchools ? ALL_SCHOOLS : date.weekday] || "none";
}
const needsLeg = (need: Need, leg: Leg) => need === "both" || need === leg;

function buildSchedule(cfg: Config, needs: Record<number, KidNeeds>, rides: Record<string, Ride | CarRide>): Rehearsal[] {
  return cfg.dates.map((d) => {
    const r = rides[d.id] || emptyRide();
    const legs = {} as Record<Leg, LegState>;
    for (const leg of LEGS) {
      const assigned = new Set(r[leg].flatMap((dr) => dr.kids));
      const needing = cfg.kids.filter((k) => needsLeg(resolveNeed(needs[k.id], d), leg)).map((k) => k.id);
      const drivers = r[leg].map((dr: Driver & { id?: number }) => { const out = { ...dr }; delete out.id; return out; });
      legs[leg] = { drivers, needing, stillNeed: needing.filter((k) => !assigned.has(k)) };
    }
    return { ...d, ...legs };
  });
}

async function sendMagicLink(email: string, link: string, cfg: Config) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log(`[magic link for ${email}] ${link}`); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || "Band Carpool <onboarding@resend.dev>",
      to: [email],
      subject: `Your sign-in link for ${cfg.title}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px">
        <h2 style="color:#1d2f5e">${cfg.title}</h2>
        <p>Tap the button below to sign in. The link works once and expires in 20 minutes.</p>
        <p><a href="${link}" style="display:inline-block;background:#f2b705;color:#1d2f5e;padding:12px 20px;border-radius:6px;font-weight:bold;text-decoration:none">Sign in</a></p>
        <p style="color:#666;font-size:13px">If you didn't ask for this, you can ignore this email.</p></div>`,
      text: `Sign in to ${cfg.title}: ${link}\n\nThis link works once and expires in 20 minutes.`,
    }),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text());
}

// ---------- router ----------
export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api/, "") || "/";
  const method = req.method;
  const c = await db();
  const cfg = await loadConfig(c);
  const body: Body = method === "POST" ? await req.json().catch(() => ({})) : {};

  // ----- public routes -----
  if (route === "/login" && method === "POST") {
    const email = normEmail(body.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, "Please enter a valid email address.");
    // Only admins and parents listed in Admin can sign in; nobody else is sent an email.
    if (!isAllowed(cfg, email)) return fail(403, "That email isn't on the parent list. Ask the carpool coordinator to add you.");
    const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "";
    const base = (process.env.SITE_URL || process.env.URL || vercelUrl || url.origin).replace(/\/$/, "");
    const link = `${base}/api/verify?t=${makeLinkToken(email)}`;
    await sendMagicLink(email, link, cfg);
    return json({ ok: true, devLink: showDevLink() ? link : undefined });
  }

  if (route === "/verify" && method === "GET") {
    const p = readLinkToken(url.searchParams.get("t"));
    const redirect = (to: string, cookie?: string) => new Response(null, { status: 302, headers: { location: to, ...(cookie ? { "set-cookie": cookie } : {}) } });
    if (!p) return redirect("/?login=expired");
    if (!isAllowed(cfg, p.e)) return redirect("/?login=denied");
    const used = await c.execute({ sql: "INSERT INTO used_links (token, used_at) VALUES (?, ?) ON CONFLICT DO NOTHING", args: [String(p.n), Date.now()] });
    if (!used.rowsAffected) return redirect("/?login=used");
    return redirect("/", makeSessionCookie(p.e));
  }

  if (route === "/logout" && method === "POST") return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });

  // ----- signed-in routes -----
  const email = sessionEmail(req);
  if (!email || !isAllowed(cfg, email)) return fail(401, "Please sign in.");
  const admin = isAdmin(cfg, email);
  const mine = kidsOf(cfg, email);
  const me = (await c.execute({ sql: "SELECT name, phone FROM users WHERE email = ?", args: [email] })).rows[0];
  const profile: Profile = { name: str(me?.name), phone: str(me?.phone) };

  if (route === "/state" && method === "GET") {
    const [needs, rides, users, info] = await Promise.all([
      loadNeeds(c, cfg), loadRides(c, cfg), loadUsers(c), c.execute("SELECT id, address, notes FROM kids"),
    ]);
    const user = (e: string) => users[normEmail(e)] || { name: "", phone: "" };
    const people: Record<string, { name: string; phone: string }> = {};
    for (const r of Object.values(rides)) for (const l of LEGS) for (const d of r[l]) if (!d.email.startsWith("guest:")) people[d.email] = user(d.email);
    // Home addresses: shown to the child's parents, admins, and anyone driving (or who added) a car that child rides in.
    const canSee = new Set(admin ? cfg.kids.map((k) => k.id) : mine);
    for (const r of Object.values(rides)) for (const l of LEGS) for (const d of r[l])
      if (d.email === email || d.addedBy === email) d.kids.forEach((k) => canSee.add(k));
    const kidInfo: Record<number, KidInfo> = {};
    for (const id of canSee) {
      const kid = cfg.kids.find((k) => k.id === id);
      if (!kid) continue;
      const row = info.rows.find((r) => Number(r.id) === id);
      kidInfo[id] = { address: str(row?.address), notes: str(row?.notes), parents: (kid.parents || []).map((e) => ({ ...user(e), email: normEmail(e) })) };
    }
    return json({
      me: { email, name: profile.name, phone: profile.phone, isAdmin: admin, kids: mine },
      kidInfo,
      config: {
        title: cfg.title, school: cfg.school, location: cfg.location, rehearsal: cfg.rehearsal, dropoffNote: cfg.dropoffNote, pickupNote: cfg.pickupNote,
        kids: cfg.kids.map((k) => (admin ? k : { id: k.id, name: k.name })),
        admins: admin ? cfg.admins : undefined,
        importantDates: cfg.importantDates,
      },
      needs: Object.fromEntries(Object.entries(needs).filter(([k]) => admin || mine.includes(Number(k)))),
      schedule: buildSchedule(cfg, needs, rides),
      people,
    });
  }

  if (route === "/kidinfo" && method === "POST") {
    const kid = cfg.kids.find((k) => k.id === Number(body.kidId));
    if (!kid) return fail(404, "Child not found.");
    if (!admin && !mine.includes(kid.id)) return fail(403, "You can only change your own child's address.");
    await c.execute({ sql: "UPDATE kids SET address = ?, notes = ? WHERE id = ?", args: [clean(body.address, 200), clean(body.notes, 200), kid.id] });
    return json({ ok: true });
  }

  if (route === "/profile" && method === "POST") {
    const next = { name: clean(body.name, 60), phone: clean(body.phone, 30) };
    if (!next.name) return fail(400, "Please enter your name.");
    // Driver names come from here, so signups show the new name without being rewritten.
    await c.execute({
      sql: "INSERT INTO users (email, name, phone) VALUES (?, ?, ?) ON CONFLICT (email) DO UPDATE SET name = excluded.name, phone = excluded.phone",
      args: [email, next.name, next.phone],
    });
    return json({ ok: true });
  }

  if (route === "/needs" && method === "POST") {
    const kid = cfg.kids.find((k) => k.id === Number(body.kidId));
    if (!kid) return fail(404, "Child not found.");
    if (!admin && !mine.includes(kid.id)) return fail(403, "You can only change rides for your own child.");
    const writes: InStatement[] = [];
    if (body.usual) for (const [day, v] of Object.entries(body.usual as Record<string, Need>)) {
      if (!(day === ALL_SCHOOLS || REGULAR_DAYS.includes(day)) || !NEEDS.includes(v)) return fail(400, "Invalid value.");
      writes.push({ sql: "INSERT INTO kid_usual_needs (kid_id, weekday, need) VALUES (?, ?, ?) ON CONFLICT (kid_id, weekday) DO UPDATE SET need = excluded.need", args: [kid.id, day, v] });
    }
    if (body.regularDay !== undefined) {
      if (!REGULAR_DAYS.includes(body.regularDay)) return fail(400, "Invalid value.");
      writes.push({ sql: "UPDATE kids SET regular_day = ? WHERE id = ?", args: [body.regularDay, kid.id] });
    }
    if (body.overrides) for (const [date, v] of Object.entries(body.overrides as Record<string, Need | null | "">)) {
      if (!cfg.dates.some((d) => d.id === date)) return fail(400, "Unknown date.");
      const rehearsal = cfg.rehearsalId[date];
      if (v === null || v === "") writes.push({ sql: "DELETE FROM kid_need_overrides WHERE kid_id = ? AND rehearsal_id = ?", args: [kid.id, rehearsal] });
      else if (NEEDS.includes(v)) writes.push({ sql: "INSERT INTO kid_need_overrides (kid_id, rehearsal_id, need) VALUES (?, ?, ?) ON CONFLICT (kid_id, rehearsal_id) DO UPDATE SET need = excluded.need", args: [kid.id, rehearsal, v] });
      else return fail(400, "Invalid value.");
    }
    if (writes.length) await c.batch(writes, "write");
    const needs = (await loadNeeds(c, cfg, kid.id))[kid.id];
    // Take the child out of any upcoming car for a ride they no longer need (e.g. switched to "No ride needed").
    const today = new Date().toLocaleDateString("en-CA", { timeZone: SCHOOL_TZ });
    const seats = await c.execute({
      sql: "SELECT ck.id, r.date, ck.leg FROM car_kids ck JOIN rehearsal_dates r ON r.id = ck.rehearsal_id WHERE ck.kid_id = ? AND r.date >= ?",
      args: [kid.id, today],
    });
    const leave = seats.rows.filter((r) => {
      const d = cfg.dates.find((x) => x.id === str(r.date));
      return d && !needsLeg(resolveNeed(needs, d), str(r.leg) as Leg);
    });
    if (leave.length) await c.batch(leave.map((r) => ({ sql: "DELETE FROM car_kids WHERE id = ?", args: [r.id] })), "write");
    return json({ ok: true, needs });
  }

  if (route.startsWith("/rides/") && method === "POST") {
    const date = cfg.dates.find((d) => d.id === body.date);
    const leg = body.leg as Leg;
    if (!date || !LEGS.includes(leg)) return fail(400, "Invalid rehearsal or leg.");
    const cars = (await loadRides(c, cfg, date.id))[date.id][leg];
    const rehearsal = cfg.rehearsalId[date.id];
    const action = route.slice("/rides/".length);

    // Who may change a car: its driver, the parent who added it, or an admin.
    const canManage = (drv: Car) => drv.email === email || drv.addedBy === email || admin;
    const seatsOf = (v: unknown) => Math.max(1, Math.min(10, parseInt(String(v), 10) || 0));

    try {
      if (action === "drive") {
        const seats = seatsOf(body.seats);
        const target = normEmail(body.driver || email);
        const existing = cars.find((d) => d.email === target);
        if (existing) {
          if (!canManage(existing)) return fail(403, "You can only change your own car.");
          if (existing.kids.length > seats) return fail(400, `That car already has ${existing.kids.length} kids. Remove some before lowering seats.`);
          await c.execute({ sql: "UPDATE cars SET seats = ? WHERE id = ?", args: [seats, existing.id] });
        } else {
          if (target !== email) return fail(404, "Driver not found.");
          if (!profile.name) return fail(400, "Add your name first (your initials, top right → My info).");
          await c.execute({
            sql: "INSERT INTO cars (rehearsal_id, leg, driver_id, seats) VALUES (?, ?, (SELECT id FROM users WHERE email = ?), ?) ON CONFLICT DO NOTHING",
            args: [rehearsal, leg, email, seats],
          });
        }
      } else if (action === "add-driver") {
        if (!admin) return fail(403, "Only admins can add a driver for someone else. Use I can drive to sign yourself up.");
        // Add another parent as a driver (e.g. someone who offered by text).
        const name = clean(body.name, 60);
        if (!name) return fail(400, "Enter the driver's name.");
        await c.batch([
          { sql: "INSERT INTO users (email) VALUES (?) ON CONFLICT DO NOTHING", args: [email] },
          {
            sql: "INSERT INTO cars (rehearsal_id, leg, guest_name, guest_phone, seats, added_by_id) VALUES (?, ?, ?, ?, ?, (SELECT id FROM users WHERE email = ?))",
            args: [rehearsal, leg, name, clean(body.phone, 30), seatsOf(body.seats), email],
          },
        ], "write");
      } else if (action === "withdraw") {
        const target = normEmail(body.email || email);
        const drv = cars.find((d) => d.email === target);
        if (drv && !canManage(drv)) return fail(403, "You can only remove yourself or drivers you added.");
        if (drv) await c.batch([
          { sql: "DELETE FROM car_kids WHERE car_id = ?", args: [drv.id] },
          { sql: "DELETE FROM cars WHERE id = ?", args: [drv.id] },
        ], "write");
      } else if (action === "claim") {
        const kid = cfg.kids.find((k) => k.id === Number(body.kidId));
        if (!kid) return fail(404, "Child not found.");
        const driverEmail = normEmail(body.driver || email);
        const drv = cars.find((d) => d.email === driverEmail);
        if (!drv) return fail(400, "Sign up to drive first.");
        // A parent can always take their own child out of a car; adding a child still needs the car's driver (or an admin).
        if (!canManage(drv) && !(body.add === false && mine.includes(kid.id))) return fail(403, "You can only change your own car.");
        if (body.add === false) await c.execute({ sql: "DELETE FROM car_kids WHERE car_id = ? AND kid_id = ?", args: [drv.id, kid.id] });
        else {
          const other = cars.find((d) => d.kids.includes(kid.id));
          if (other && other !== drv) return fail(409, `${kid.name} is already riding with ${other.name}.`);
          if (!drv.kids.includes(kid.id)) {
            if (drv.kids.length >= drv.seats) return fail(409, "That car is full.");
            await c.execute({ sql: "INSERT INTO car_kids (car_id, kid_id, rehearsal_id, leg) VALUES (?, ?, ?, ?)", args: [drv.id, kid.id, rehearsal, leg] });
          }
        }
      } else return fail(404, "Not found.");
    } catch (err) {
      // Someone else changed the same car at the same moment (e.g. put this kid in another car).
      if (isConstraintError(err)) return fail(409, "That ride just changed. Please refresh and try again.");
      throw err;
    }
    return json({ ok: true });
  }

  // ----- admin routes -----
  if (route === "/admin/config" && method === "POST") {
    if (!admin) return fail(403, "Admins only.");
    const next: Config = { ...cfg };
    for (const f of ["title", "school", "location", "rehearsal", "dropoffNote", "pickupNote"] as const) if (body[f] !== undefined) next[f] = clean(body[f], 120);
    if (Array.isArray(body.kids)) {
      const seen = new Set<number>();
      next.kids = body.kids.filter((k: any) => clean(k.name)).map((k: any) => {
        // Existing kids keep their id; anything else is a new kid (id 0 until the database assigns one).
        const id = cfg.kids.some((c) => c.id === Number(k.id)) && !seen.has(Number(k.id)) ? Number(k.id) : 0;
        seen.add(id);
        return { id, name: clean(k.name, 40), parents: [...new Set<string>((k.parents || []).map(normEmail).filter((e: string) => e.includes("@")))].slice(0, 4) };
      });
    }
    if (Array.isArray(body.admins)) next.admins = [...new Set<string>(body.admins.map(normEmail).filter((e: string) => e.includes("@")))];
    if (Array.isArray(body.dates)) next.dates = [...new Map<string, RehearsalDate>(body.dates
      .filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(d.id))
      .map((d: any): [string, RehearsalDate] => [d.id, { id: d.id, weekday: weekdayOf(d.id), note: clean(d.note), flag: d.flag === "confirm" ? "confirm" : d.flag === "cancelled" ? "cancelled" : "", allSchools: d.allSchools === true }])).values()]
      .sort((a: RehearsalDate, b: RehearsalDate) => a.id.localeCompare(b.id));
    if (Array.isArray(body.importantDates)) next.importantDates = body.importantDates
      .filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && clean(d.title))
      .map((d: any) => ({ date: d.date, title: clean(d.title, 80), detail: clean(d.detail) }))
      .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
    // Don't let an admin lock everyone out.
    if (!isAdmin(next, email)) return fail(400, "You can't remove yourself as an admin.");

    const w: InStatement[] = [{
      sql: "UPDATE settings SET title = ?, school = ?, location = ?, rehearsal = ?, dropoff_note = ?, pickup_note = ?",
      args: [next.title, next.school, next.location, next.rehearsal, next.dropoffNote, next.pickupNote],
    }];
    // Removing a kid removes their needs, parent links and seats in cars.
    for (const k of cfg.kids) if (!next.kids.some((n) => n.id === k.id)) {
      for (const t of ["car_kids", "kid_need_overrides", "kid_usual_needs", "kid_parents"]) w.push({ sql: `DELETE FROM ${t} WHERE kid_id = ?`, args: [k.id] });
      w.push({ sql: "DELETE FROM kids WHERE id = ?", args: [k.id] });
    }
    next.kids.forEach((k, i) => {
      // A new kid's id is the newest one in the table: ids only go up, and the batch runs as one transaction.
      const kidId = k.id ? { sql: "?", args: [k.id] } : { sql: "(SELECT max(id) FROM kids)", args: [] };
      if (k.id) w.push({ sql: "UPDATE kids SET name = ?, position = ? WHERE id = ?", args: [k.name, i, k.id] });
      else w.push({ sql: "INSERT INTO kids (name, position) VALUES (?, ?)", args: [k.name, i] });
      w.push({ sql: `DELETE FROM kid_parents WHERE kid_id = ${kidId.sql}`, args: kidId.args });
      (k.parents || []).forEach((e, j) => w.push(
        { sql: "INSERT INTO users (email) VALUES (?) ON CONFLICT DO NOTHING", args: [e] },
        { sql: `INSERT INTO kid_parents (kid_id, user_id, position) VALUES (${kidId.sql}, (SELECT id FROM users WHERE email = ?), ?)`, args: [...kidId.args, e, j] },
      ));
    });
    w.push({ sql: "UPDATE users SET is_admin = 0 WHERE is_admin = 1", args: [] });
    for (const e of next.admins) w.push({ sql: "INSERT INTO users (email, is_admin) VALUES (?, 1) ON CONFLICT (email) DO UPDATE SET is_admin = 1", args: [e] });
    // Removing a rehearsal date removes its cars and any week-specific ride changes.
    for (const d of cfg.dates) if (!next.dates.some((n) => n.id === d.id)) {
      for (const t of ["car_kids", "cars", "kid_need_overrides"]) w.push({ sql: `DELETE FROM ${t} WHERE rehearsal_id = ?`, args: [cfg.rehearsalId[d.id]] });
      w.push({ sql: "DELETE FROM rehearsal_dates WHERE id = ?", args: [cfg.rehearsalId[d.id]] });
    }
    for (const d of next.dates) w.push({ sql: "INSERT INTO rehearsal_dates (date, note, flag, all_schools) VALUES (?, ?, ?, ?) ON CONFLICT (date) DO UPDATE SET note = excluded.note, flag = excluded.flag, all_schools = excluded.all_schools", args: [d.id, d.note, d.flag, d.allSchools ? 1 : 0] });
    w.push({ sql: "DELETE FROM important_dates", args: [] });
    for (const d of next.importantDates) w.push({ sql: "INSERT INTO important_dates (date, title, detail) VALUES (?, ?, ?)", args: [d.date, d.title, d.detail] });
    await c.batch(w, "write");
    return json({ ok: true });
  }

  if (route === "/admin/export.csv" && method === "GET") {
    if (!admin) return fail(403, "Admins only.");
    const [needs, rides] = await Promise.all([loadNeeds(c, cfg), loadRides(c, cfg)]);
    const sched = buildSchedule(cfg, needs, rides);
    const name = (id: number) => cfg.kids.find((k) => k.id === id)?.name || String(id);
    const q = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["Date", "Day", "Notes", "Drop-off still need", "Drop-off drivers", "Pickup still need", "Pickup drivers"]];
    for (const d of sched) rows.push([
      d.id, d.weekday, d.note,
      d.dropoff.stillNeed.map(name).join(", "),
      d.dropoff.drivers.map((x) => `${x.name} (${x.seats} seats: ${x.kids.map(name).join(", ")})`).join("; "),
      d.pickup.stillNeed.map(name).join(", "),
      d.pickup.drivers.map((x) => `${x.name} (${x.seats} seats: ${x.kids.map(name).join(", ")})`).join("; "),
    ]);
    return new Response(rows.map((r) => r.map(q).join(",")).join("\n"), {
      headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="carpool.csv"' },
    });
  }

  return fail(404, "Not found.");
}

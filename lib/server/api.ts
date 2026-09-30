// All server logic for /api/*. app/api/[...path]/route.ts passes every request here.
import "server-only";
import { store, type Store } from "./store";
import {
  makeLinkToken, readLinkToken, makeSessionCookie, clearSessionCookie, sessionEmail, normEmail,
} from "./auth";
import { SEED_CONFIG, SEED_NEEDS, SEED_RIDES } from "./seed";
import {
  LEGS, NEED_VALUES as NEEDS,
  type Config, type Driver, type KidInfo, type KidNeeds, type Leg, type LegState, type Need, type Rehearsal, type RehearsalDate, type Ride,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Body = Record<string, any>;
interface Profile { name?: string; phone?: string }

// Show the sign-in link on the page instead of emailing it (local development only).
const showDevLink = () => process.env.DEV_SHOW_LINK === "true" || (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY);

// ---------- helpers ----------
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
const fail = (status: number, error: string) => json({ error }, status);
const clean = (s: unknown, max = 200) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const envAdmins = () => (process.env.ADMIN_EMAILS || "").split(",").map(normEmail).filter(Boolean);

async function getConfig(s: Store): Promise<Config> {
  let cfg = await s.get<Config>("config");
  if (!cfg) {
    // First run: load starting data from the sheet.
    cfg = structuredClone(SEED_CONFIG);
    await s.set("config", cfg);
    for (const [kid, n] of Object.entries(SEED_NEEDS)) await s.set(`needs/${kid}`, n);
    for (const [date, r] of Object.entries(SEED_RIDES)) await s.set(`rides/${date}`, r);
  }
  // Older copies stored the rehearsal site as the school. Split them.
  if (cfg.location === undefined) {
    cfg.location = SEED_CONFIG.location;
    if (cfg.school === SEED_CONFIG.location) cfg.school = SEED_CONFIG.school;
    await s.set("config", cfg);
  }
  return cfg;
}

const isAdmin = (cfg: Config, email: string) => [...envAdmins(), ...(cfg.admins || []).map(normEmail)].includes(email);
const kidsOf = (cfg: Config, email: string) => cfg.kids.filter((k) => (k.parents || []).map(normEmail).includes(email)).map((k) => k.id);
const isAllowed = (cfg: Config, email: string) => isAdmin(cfg, email) || kidsOf(cfg, email).length > 0;

function resolveNeed(needs: KidNeeds | undefined, date: RehearsalDate): Need {
  if (!needs) return "none";
  return needs.overrides?.[date.id] || needs.usual?.[date.weekday] || "none";
}
const needsLeg = (need: Need, leg: Leg) => need === "both" || need === leg;
const emptyRide = (): Ride => ({ dropoff: [], pickup: [] });

async function loadAll(s: Store, cfg: Config) {
  const needs: Record<string, KidNeeds> = {};
  await Promise.all(cfg.kids.map(async (k) => { needs[k.id] = (await s.get<KidNeeds>(`needs/${k.id}`)) || { usual: {}, overrides: {} }; }));
  const rides: Record<string, Ride> = {};
  await Promise.all(cfg.dates.map(async (d) => { rides[d.id] = (await s.get<Ride>(`rides/${d.id}`)) || emptyRide(); }));
  return { needs, rides };
}

function buildSchedule(cfg: Config, needs: Record<string, KidNeeds>, rides: Record<string, Ride>): Rehearsal[] {
  return cfg.dates.map((d) => {
    const r = rides[d.id] || emptyRide();
    const legs = {} as Record<Leg, LegState>;
    for (const leg of LEGS) {
      const assigned = new Set(r[leg].flatMap((dr) => dr.kids));
      const needing = cfg.kids.filter((k) => needsLeg(resolveNeed(needs[k.id], d), leg)).map((k) => k.id);
      legs[leg] = { drivers: r[leg], needing, stillNeed: needing.filter((k) => !assigned.has(k)) };
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
  const s = await store();
  const cfg = await getConfig(s);
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
    const usedKey = `usedlinks/${p.n}`;
    if (await s.get(usedKey)) return redirect("/?login=used");
    if (!isAllowed(cfg, p.e)) return redirect("/?login=denied");
    await s.set(usedKey, { at: Date.now() });
    return redirect("/", makeSessionCookie(p.e));
  }

  if (route === "/logout" && method === "POST") return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });

  // ----- signed-in routes -----
  const email = sessionEmail(req);
  if (!email || !isAllowed(cfg, email)) return fail(401, "Please sign in.");
  const admin = isAdmin(cfg, email);
  const mine = kidsOf(cfg, email);
  const profile = (await s.get<Profile>(`users/${email}`)) || {};

  if (route === "/state" && method === "GET") {
    const { needs, rides } = await loadAll(s, cfg);
    const people: Record<string, { name: string; phone: string }> = {};
    const emails = new Set(Object.values(rides).flatMap((r) => LEGS.flatMap((l) => r[l].map((d) => d.email))));
    await Promise.all([...emails].map(async (e) => { const u = (await s.get<Profile>(`users/${e}`)) || {}; people[e] = { name: u.name || "", phone: u.phone || "" }; }));
    // Home addresses: shown to the child's parents, admins, and anyone driving (or who added) a car that child rides in.
    const canSee = new Set(admin ? cfg.kids.map((k) => k.id) : mine);
    for (const r of Object.values(rides)) for (const l of LEGS) for (const d of r[l])
      if (d.email === email || d.addedBy === email) d.kids.forEach((k) => canSee.add(k));
    const kidInfo: Record<string, KidInfo> = {};
    await Promise.all([...canSee].map(async (id) => {
      const kid = cfg.kids.find((k) => k.id === id);
      if (!kid) return;
      const info = (await s.get<{ address?: string; notes?: string }>(`kidinfo/${id}`)) || {};
      const parents = await Promise.all((kid.parents || []).map(async (e) => { const u = (await s.get<Profile>(`users/${normEmail(e)}`)) || {}; return { name: u.name || "", phone: u.phone || "", email: normEmail(e) }; }));
      kidInfo[id] = { address: info.address || "", notes: info.notes || "", parents };
    }));
    return json({
      me: { email, name: profile.name || "", phone: profile.phone || "", isAdmin: admin, kids: mine },
      kidInfo,
      config: {
        title: cfg.title, school: cfg.school, location: cfg.location, rehearsal: cfg.rehearsal, dropoffNote: cfg.dropoffNote, pickupNote: cfg.pickupNote,
        kids: cfg.kids.map((k) => (admin ? k : { id: k.id, name: k.name })),
        admins: admin ? cfg.admins : undefined,
        envAdmins: admin ? envAdmins() : undefined,
        importantDates: cfg.importantDates,
      },
      needs: Object.fromEntries(Object.entries(needs).filter(([k]) => admin || mine.includes(k))),
      schedule: buildSchedule(cfg, needs, rides),
      people,
    });
  }

  if (route === "/kidinfo" && method === "POST") {
    const kid = cfg.kids.find((k) => k.id === body.kidId);
    if (!kid) return fail(404, "Child not found.");
    if (!admin && !mine.includes(kid.id)) return fail(403, "You can only change your own child's address.");
    await s.set(`kidinfo/${kid.id}`, { address: clean(body.address, 200), notes: clean(body.notes, 200) });
    return json({ ok: true });
  }

  if (route === "/profile" && method === "POST") {
    const next = { name: clean(body.name, 60), phone: clean(body.phone, 30) };
    if (!next.name) return fail(400, "Please enter your name.");
    await s.set(`users/${email}`, next);
    // keep driver names on existing signups current
    for (const d of cfg.dates) {
      const r = await s.get<Ride>(`rides/${d.id}`);
      if (!r) continue;
      let changed = false;
      for (const leg of LEGS) for (const dr of r[leg]) if (dr.email === email && dr.name !== next.name) { dr.name = next.name; changed = true; }
      if (changed) await s.set(`rides/${d.id}`, r);
    }
    return json({ ok: true });
  }

  if (route === "/needs" && method === "POST") {
    const kid = cfg.kids.find((k) => k.id === body.kidId);
    if (!kid) return fail(404, "Child not found.");
    if (!admin && !mine.includes(kid.id)) return fail(403, "You can only change rides for your own child.");
    const n = (await s.get<KidNeeds>(`needs/${kid.id}`)) || { usual: {}, overrides: {} };
    if (body.usual) for (const [day, v] of Object.entries(body.usual as Record<string, Need>)) {
      if (!cfg.dates.some((d) => d.weekday === day) || !NEEDS.includes(v)) return fail(400, "Invalid value.");
      n.usual[day] = v;
    }
    if (body.overrides) for (const [date, v] of Object.entries(body.overrides as Record<string, Need | null | "">)) {
      if (!cfg.dates.some((d) => d.id === date)) return fail(400, "Unknown date.");
      if (v === null || v === "") delete n.overrides[date];
      else if (NEEDS.includes(v)) n.overrides[date] = v;
      else return fail(400, "Invalid value.");
    }
    await s.set(`needs/${kid.id}`, n);
    return json({ ok: true, needs: n });
  }

  if (route.startsWith("/rides/") && method === "POST") {
    const date = cfg.dates.find((d) => d.id === body.date);
    const leg = body.leg as Leg;
    if (!date || !LEGS.includes(leg)) return fail(400, "Invalid rehearsal or leg.");
    const r = (await s.get<Ride>(`rides/${date.id}`)) || emptyRide();
    const action = route.slice("/rides/".length);

    // Who may change a car: its driver, the parent who added it, or an admin.
    const canManage = (drv: Driver) => drv.email === email || drv.addedBy === email || admin;
    const seatsOf = (v: unknown) => Math.max(1, Math.min(10, parseInt(String(v), 10) || 0));

    if (action === "drive") {
      const seats = seatsOf(body.seats);
      const target = normEmail(body.driver || email);
      const existing = r[leg].find((d) => d.email === target);
      if (existing) {
        if (!canManage(existing)) return fail(403, "You can only change your own car.");
        if (existing.kids.length > seats) return fail(400, `That car already has ${existing.kids.length} kids. Remove some before lowering seats.`);
        existing.seats = seats;
      } else {
        if (target !== email) return fail(404, "Driver not found.");
        if (!profile.name) return fail(400, "Add your name first (your initials, top right → My info).");
        r[leg].push({ email, name: profile.name, seats, kids: [] });
      }
    } else if (action === "add-driver") {
      if (!admin) return fail(403, "Only admins can add a driver for someone else. Use I can drive to sign yourself up.");
      // Add another parent as a driver (e.g. someone who offered by text).
      const name = clean(body.name, 60);
      if (!name) return fail(400, "Enter the driver's name.");
      r[leg].push({ email: `guest:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, phone: clean(body.phone, 30), seats: seatsOf(body.seats), kids: [], addedBy: email });
    } else if (action === "withdraw") {
      const target = normEmail(body.email || email);
      const drv = r[leg].find((d) => d.email === target);
      if (drv && !canManage(drv)) return fail(403, "You can only remove yourself or drivers you added.");
      r[leg] = r[leg].filter((d) => d.email !== target);
    } else if (action === "claim") {
      const kid = cfg.kids.find((k) => k.id === body.kidId);
      if (!kid) return fail(404, "Child not found.");
      const driverEmail = normEmail(body.driver || email);
      const drv = r[leg].find((d) => d.email === driverEmail);
      if (!drv) return fail(400, "Sign up to drive first.");
      if (!canManage(drv)) return fail(403, "You can only change your own car.");
      if (body.add === false) drv.kids = drv.kids.filter((k) => k !== kid.id);
      else {
        const other = r[leg].find((d) => d.kids.includes(kid.id));
        if (other && other !== drv) return fail(409, `${kid.name} is already riding with ${other.name}.`);
        if (!drv.kids.includes(kid.id)) {
          if (drv.kids.length >= drv.seats) return fail(409, "That car is full.");
          drv.kids.push(kid.id);
        }
      }
    } else return fail(404, "Not found.");

    await s.set(`rides/${date.id}`, r);
    return json({ ok: true });
  }

  // ----- admin routes -----
  if (route === "/admin/config" && method === "POST") {
    if (!admin) return fail(403, "Admins only.");
    const slug = (n: unknown) => clean(n, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kid";
    const next: Config = { ...cfg };
    for (const f of ["title", "school", "location", "rehearsal", "dropoffNote", "pickupNote"] as const) if (body[f] !== undefined) next[f] = clean(body[f], 120);
    if (Array.isArray(body.kids)) {
      const used = new Set<string>();
      next.kids = body.kids.filter((k: any) => clean(k.name)).map((k: any) => {
        let id = k.id && cfg.kids.some((c) => c.id === k.id) ? k.id : slug(k.name);
        while (used.has(id)) id += "-2";
        used.add(id);
        return { id, name: clean(k.name, 40), parents: (k.parents || []).map(normEmail).filter((e: string) => e.includes("@")).slice(0, 4) };
      });
    }
    if (Array.isArray(body.admins)) next.admins = body.admins.map(normEmail).filter((e: string) => e.includes("@"));
    if (Array.isArray(body.dates)) next.dates = body.dates
      .filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(d.id))
      .map((d: any): RehearsalDate => ({ id: d.id, weekday: new Date(d.id + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }), note: clean(d.note), flag: d.flag === "confirm" ? "confirm" : d.flag === "cancelled" ? "cancelled" : "" }))
      .sort((a: RehearsalDate, b: RehearsalDate) => a.id.localeCompare(b.id));
    if (Array.isArray(body.importantDates)) next.importantDates = body.importantDates
      .filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && clean(d.title))
      .map((d: any) => ({ date: d.date, title: clean(d.title, 80), detail: clean(d.detail) }))
      .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
    // Don't let an admin lock everyone out.
    if (!isAdmin(next, email)) return fail(400, "You can't remove yourself as an admin.");
    await s.set("config", next);
    return json({ ok: true });
  }

  if (route === "/admin/export.csv" && method === "GET") {
    if (!admin) return fail(403, "Admins only.");
    const { needs, rides } = await loadAll(s, cfg);
    const sched = buildSchedule(cfg, needs, rides);
    const name = (id: string) => cfg.kids.find((k) => k.id === id)?.name || id;
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

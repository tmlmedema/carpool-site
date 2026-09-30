// Loads the starting data in lib/seed.js (copied from the Google Sheet) into the database.
import { normEmail } from "../auth.js";
import { SEED_CONFIG, SEED_NEEDS, SEED_RIDES } from "../seed.js";
import type { Db } from "./index";
import * as t from "./schema";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STATUS = { "": "scheduled", confirm: "needs_confirmation", cancelled: "cancelled" } as const;

type Need = (typeof t.NEEDS)[number];
type Leg = (typeof t.LEGS)[number];

/**
 * Creates the band carpool from the seed data and returns its id.
 * `adminEmails` become admin members (the sign-in allowlist now lives in the database).
 */
export async function seedCarpool(db: Db, { adminEmails = [] as string[] } = {}) {
  const cfg = SEED_CONFIG;

  return db.transaction(async (tx) => {
    const [carpool] = await tx.insert(t.carpools).values({
      name: cfg.title,
      school: cfg.school,
      rehearsalNote: cfg.rehearsal,
      dropoffNote: cfg.dropoffNote,
      pickupNote: cfg.pickupNote,
    }).returning({ id: t.carpools.id });
    const carpoolId = carpool.id;

    // Members: admins first, then every parent listed on a kid.
    const roles = new Map<string, "admin" | "parent">();
    for (const e of [...adminEmails, ...cfg.admins]) roles.set(normEmail(e), "admin");
    for (const k of cfg.kids) for (const e of k.parents as string[]) if (!roles.has(normEmail(e))) roles.set(normEmail(e), "parent");
    if (roles.size) await tx.insert(t.carpoolMembers).values([...roles].map(([email, role]) => ({ carpoolId, email, role })));

    // Kids get new ids; keep a map from the old slug ids used in the seed data.
    const kidIds = new Map<string, string>();
    for (const k of cfg.kids) {
      const [row] = await tx.insert(t.kids).values({ carpoolId, name: k.name }).returning({ id: t.kids.id });
      kidIds.set(k.id, row.id);
      for (const e of k.parents as string[]) await tx.insert(t.kidGuardians).values({ kidId: row.id, carpoolId, email: normEmail(e) });
    }

    const rehearsalIds = new Map<string, string>();
    for (const d of cfg.dates) {
      const [row] = await tx.insert(t.rehearsals).values({
        carpoolId, date: d.id, note: d.note, status: STATUS[d.flag as keyof typeof STATUS],
      }).returning({ id: t.rehearsals.id });
      rehearsalIds.set(d.id, row.id);
    }

    if (cfg.importantDates.length) {
      await tx.insert(t.importantDates).values(cfg.importantDates.map((d) => ({ carpoolId, ...d })));
    }

    for (const [slug, needs] of Object.entries(SEED_NEEDS)) {
      const kidId = kidIds.get(slug)!;
      for (const [day, need] of Object.entries(needs.usual)) {
        await tx.insert(t.usualNeeds).values({ kidId, weekday: WEEKDAYS.indexOf(day), need: need as Need });
      }
      for (const [date, need] of Object.entries(needs.overrides as Record<string, Need>)) {
        await tx.insert(t.needOverrides).values({ kidId, rehearsalId: rehearsalIds.get(date)!, need });
      }
    }

    for (const [date, legs] of Object.entries(SEED_RIDES)) {
      for (const leg of t.LEGS) {
        for (const dr of (legs as Record<Leg, typeof legs.dropoff>)[leg]) {
          const email = normEmail(dr.email);
          await tx.insert(t.users).values({ email, name: dr.name }).onConflictDoNothing();
          const user = await tx.query.users.findFirst({ where: (u, { eq }) => eq(u.email, email), columns: { id: true } });
          const [driver] = await tx.insert(t.drivers).values({
            rehearsalId: rehearsalIds.get(date)!, leg, userId: user!.id, seats: dr.seats,
          }).returning({ id: t.drivers.id, rehearsalId: t.drivers.rehearsalId });
          for (const kid of dr.kids) {
            await tx.insert(t.rideAssignments).values({ driverId: driver.id, rehearsalId: driver.rehearsalId, leg, kidId: kidIds.get(kid)! });
          }
        }
      }
    }

    return carpoolId;
  });
}

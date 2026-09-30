// Schema + seed checks against a throwaway SQLite file: `npm run test:db`.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { and, count, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { createDb, type Db } from "../lib/db";
import * as t from "../lib/db/schema";
import { seedCarpool } from "../lib/db/seed-carpool";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "carpool-db-"));
let db: Db;
let carpoolId: string;

/** Expects the promise to fail with a database error whose message (or cause) matches. */
async function rejectsWith(p: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(p, (e: Error & { cause?: unknown }) => {
    assert.match(`${e.message} ${String(e.cause ?? "")}`, pattern);
    return true;
  });
}

const kidId = async (name: string) =>
  (await db.query.kids.findFirst({ where: eq(t.kids.name, name) }))!.id;
const rehearsalId = async (date: string) =>
  (await db.query.rehearsals.findFirst({ where: eq(t.rehearsals.date, date) }))!.id;
async function newDriver(email: string, date: string, leg: "dropoff" | "pickup", seats: number) {
  const [u] = await db.insert(t.users).values({ email, name: email }).returning();
  const [d] = await db.insert(t.drivers).values({ rehearsalId: await rehearsalId(date), leg, userId: u.id, seats }).returning();
  return d;
}

before(async () => {
  db = createDb({ url: `file:${path.join(dir, "test.db")}`, authToken: undefined });
  await migrate(db, { migrationsFolder: "drizzle" });
  carpoolId = await seedCarpool(db, { adminEmails: ["jill@snacksdesign.com"] });
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("setup", () => {
  test("foreign keys are enforced", async () => {
    const [row] = await db.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);
    assert.equal(row.foreign_keys, 1);
  });

  test("seed loads the sheet data", async () => {
    const n = async (table: SQLiteTable) => (await db.select({ n: count() }).from(table))[0].n;
    assert.equal(await n(t.carpools), 1);
    assert.equal(await n(t.kids), 3);
    assert.equal(await n(t.rehearsals), 30);
    assert.equal(await n(t.importantDates), 5);
    assert.equal(await n(t.usualNeeds), 6);
    assert.equal(await n(t.needOverrides), 1);
    assert.equal(await n(t.drivers), 2);
    assert.equal(await n(t.rideAssignments), 3);
    const admin = await db.query.carpoolMembers.findFirst({ where: eq(t.carpoolMembers.email, "jill@snacksdesign.com") });
    assert.equal(admin?.role, "admin");
    const oct13 = await db.query.rehearsals.findFirst({ where: eq(t.rehearsals.date, "2026-10-13") });
    assert.equal(oct13?.status, "needs_confirmation");
    const tue = await db.query.usualNeeds.findFirst({ where: and(eq(t.usualNeeds.kidId, await kidId("Will")), eq(t.usualNeeds.weekday, 2)) });
    assert.equal(tue?.need, "both");
  });
});

describe("ride rules", () => {
  test("a kid can't be in two cars for the same leg", async () => {
    // Seed: Jill drives James and Will to drop-off on Oct 13.
    const d = await newDriver("pat@example.com", "2026-10-13", "dropoff", 4);
    await rejectsWith(
      db.insert(t.rideAssignments).values({ driverId: d.id, rehearsalId: d.rehearsalId, leg: "dropoff", kidId: await kidId("James") }),
      /UNIQUE constraint failed/,
    );
    // …but the same kid can ride with someone else on the other leg.
    const p = await newDriver("sam@example.com", "2026-10-13", "pickup", 4);
    await db.insert(t.rideAssignments).values({ driverId: p.id, rehearsalId: p.rehearsalId, leg: "pickup", kidId: await kidId("James") });
  });

  test("an assignment must match its driver's rehearsal and leg", async () => {
    const d = await newDriver("lee@example.com", "2026-10-20", "dropoff", 4);
    await rejectsWith(
      db.insert(t.rideAssignments).values({ driverId: d.id, rehearsalId: d.rehearsalId, leg: "pickup", kidId: await kidId("Victoria") }),
      /FOREIGN KEY constraint failed/,
    );
  });

  test("a car can't take more kids than its seats", async () => {
    const d = await newDriver("kim@example.com", "2026-10-27", "pickup", 1);
    const ride = (name: string) => kidId(name).then((kid) => db.insert(t.rideAssignments).values({ driverId: d.id, rehearsalId: d.rehearsalId, leg: "pickup", kidId: kid }));
    await ride("Will");
    await rejectsWith(ride("Victoria"), /car_full/);
  });

  test("seats can't drop below the kids already in the car", async () => {
    // Seed: Jill has 2 kids for drop-off on Oct 13. (Another test adds a second driver there, so match on Jill.)
    const jill = await db.query.users.findFirst({ where: eq(t.users.email, "jill@snacksdesign.com") });
    const d = await db.query.drivers.findFirst({
      where: and(eq(t.drivers.rehearsalId, await rehearsalId("2026-10-13")), eq(t.drivers.leg, "dropoff"), eq(t.drivers.userId, jill!.id)),
    });
    await rejectsWith(db.update(t.drivers).set({ seats: 1 }).where(eq(t.drivers.id, d!.id)), /seats_below_riders/);
    await db.update(t.drivers).set({ seats: 2 }).where(eq(t.drivers.id, d!.id));
  });

  test("seats must be 1–8 and legs must be valid", async () => {
    await rejectsWith(newDriver("max@example.com", "2026-11-10", "dropoff", 9), /CHECK constraint failed/);
    const [u] = await db.insert(t.users).values({ email: "leg@example.com" }).returning();
    await rejectsWith(
      db.insert(t.drivers).values({ rehearsalId: await rehearsalId("2026-11-10"), leg: "lunch" as "pickup", userId: u.id, seats: 2 }),
      /CHECK constraint failed/,
    );
  });

  test("removing a driver frees their kids", async () => {
    const d = await newDriver("ana@example.com", "2026-11-17", "dropoff", 3);
    await db.insert(t.rideAssignments).values({ driverId: d.id, rehearsalId: d.rehearsalId, leg: "dropoff", kidId: await kidId("Will") });
    await db.delete(t.drivers).where(eq(t.drivers.id, d.id));
    assert.equal((await db.select({ n: count() }).from(t.rideAssignments).where(eq(t.rideAssignments.driverId, d.id)))[0].n, 0);
  });
});

describe("membership rules", () => {
  test("guardians must be members of the kid's carpool", async () => {
    const victoria = await kidId("Victoria");
    await rejectsWith(
      db.insert(t.kidGuardians).values({ kidId: victoria, carpoolId, email: "stranger@example.com" }),
      /FOREIGN KEY constraint failed/,
    );
    await db.insert(t.carpoolMembers).values({ carpoolId, email: "vic.parent@example.com" });
    await db.insert(t.kidGuardians).values({ kidId: victoria, carpoolId, email: "vic.parent@example.com" });
    // Removing the member removes their guardianship too.
    await db.delete(t.carpoolMembers).where(eq(t.carpoolMembers.email, "vic.parent@example.com"));
    assert.equal((await db.select({ n: count() }).from(t.kidGuardians).where(eq(t.kidGuardians.email, "vic.parent@example.com")))[0].n, 0);
  });

  test("rehearsal dates must be YYYY-MM-DD and unique per carpool", async () => {
    await rejectsWith(db.insert(t.rehearsals).values({ carpoolId, date: "10/6/2026" }), /CHECK constraint failed/);
    await rejectsWith(db.insert(t.rehearsals).values({ carpoolId, date: "2026-10-06" }), /UNIQUE constraint failed/);
  });

  test("deleting a carpool removes everything under it", async () => {
    await db.delete(t.carpools).where(eq(t.carpools.id, carpoolId));
    for (const table of [t.kids, t.rehearsals, t.drivers, t.rideAssignments, t.usualNeeds, t.carpoolMembers]) {
      assert.equal((await db.select({ n: count() }).from(table))[0].n, 0);
    }
  });
});

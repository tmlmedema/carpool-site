// Seeds the database with the band carpool from lib/seed.js.
//   npm run db:seed            # skips if a carpool already exists
//   npm run db:seed -- --reset # deletes all carpools (and everything under them) first
// Uses TURSO_DATABASE_URL: the local file from .env.development, or pass NODE_ENV=production
// with Turso credentials in .env.production.local to seed the real database.
import "./load-env"; // first, so the imports below see the env
import { createDb } from "../lib/db";
import { carpools } from "../lib/db/schema";
import { seedCarpool } from "../lib/db/seed-carpool";

const db = createDb();
const existing = await db.select({ id: carpools.id, name: carpools.name }).from(carpools);

if (existing.length && !process.argv.includes("--reset")) {
  console.log(`Skipped: the database already has ${existing.length} carpool(s): ${existing.map((c) => c.name).join(", ")}.`);
  console.log("Run with --reset to delete them and seed again.");
  process.exit(0);
}
if (existing.length) {
  await db.delete(carpools);
  console.log(`Deleted ${existing.length} carpool(s).`);
}

const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
const id = await seedCarpool(db, { adminEmails });
console.log(`Seeded carpool ${id} (${process.env.TURSO_DATABASE_URL}).${adminEmails.length ? ` Admins: ${adminEmails.join(", ")}` : ""}`);

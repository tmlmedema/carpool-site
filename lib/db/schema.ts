// Database schema (Turso / libSQL, via Drizzle). Generate migrations with `npm run db:generate`.
//
// Rules the database enforces on its own, so they hold even when two parents tap at once:
//   - a kid rides in at most one car per rehearsal leg (unique index on ride_assignments)
//   - a kid's assignment always matches its driver's rehearsal and leg (composite foreign key)
//   - a car never holds more kids than its seats (triggers in the custom migration in drizzle/)
//   - guardians must be members of the kid's carpool (composite foreign key)
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

export const LEGS = ["dropoff", "pickup"] as const;
export const NEEDS = ["both", "dropoff", "pickup", "none"] as const;
export const ROLES = ["admin", "parent"] as const;
export const REHEARSAL_STATUSES = ["scheduled", "needs_confirmation", "cancelled"] as const;

const oneOf = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);
const isoDate = (column: string) => sql.raw(`${column} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`);

// ---------- people ----------

// Column names match the Auth.js Drizzle adapter's user table, plus `phone`.
// Emails are stored lowercase everywhere.
export const users = sqliteTable("users", {
  id: id(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  phone: text("phone"),
});

// ---------- carpools ----------

// One carpool group, e.g. "4th Grade Band Carpool".
export const carpools = sqliteTable("carpools", {
  id: id(),
  name: text("name").notNull(),
  school: text("school").notNull().default(""),
  rehearsalNote: text("rehearsal_note").notNull().default(""),
  dropoffNote: text("dropoff_note").notNull().default(""),
  pickupNote: text("pickup_note").notNull().default(""),
  createdAt: createdAt(),
});

// The sign-in allowlist: only emails listed here can use a carpool.
// Keyed by email (not user id) so admins can add parents before they have ever signed in.
export const carpoolMembers = sqliteTable("carpool_members", {
  carpoolId: text("carpool_id").notNull().references(() => carpools.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role", { enum: ROLES }).notNull().default("parent"),
}, (t) => [
  primaryKey({ columns: [t.carpoolId, t.email] }),
  index("carpool_members_email_idx").on(t.email),
  check("carpool_members_role_check", oneOf("role", ROLES)),
]);

export const kids = sqliteTable("kids", {
  id: id(),
  carpoolId: text("carpool_id").notNull().references(() => carpools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
}, (t) => [
  index("kids_carpool_idx").on(t.carpoolId),
  unique("kids_id_carpool_unique").on(t.id, t.carpoolId), // target for the guardians foreign key
]);

// Which members can manage which kid's rides.
export const kidGuardians = sqliteTable("kid_guardians", {
  kidId: text("kid_id").notNull(),
  carpoolId: text("carpool_id").notNull(),
  email: text("email").notNull(),
}, (t) => [
  primaryKey({ columns: [t.kidId, t.email] }),
  index("kid_guardians_email_idx").on(t.email),
  foreignKey({ columns: [t.kidId, t.carpoolId], foreignColumns: [kids.id, kids.carpoolId] }).onDelete("cascade"),
  foreignKey({ columns: [t.carpoolId, t.email], foreignColumns: [carpoolMembers.carpoolId, carpoolMembers.email] })
    .onDelete("cascade").onUpdate("cascade"),
]);

// ---------- calendar ----------

export const rehearsals = sqliteTable("rehearsals", {
  id: id(),
  carpoolId: text("carpool_id").notNull().references(() => carpools.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD, local to the carpool
  note: text("note").notNull().default(""),
  status: text("status", { enum: REHEARSAL_STATUSES }).notNull().default("scheduled"),
}, (t) => [
  unique("rehearsals_carpool_date_unique").on(t.carpoolId, t.date),
  check("rehearsals_date_check", isoDate("date")),
  check("rehearsals_status_check", oneOf("status", REHEARSAL_STATUSES)),
]);

export const importantDates = sqliteTable("important_dates", {
  id: id(),
  carpoolId: text("carpool_id").notNull().references(() => carpools.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
}, (t) => [
  index("important_dates_carpool_date_idx").on(t.carpoolId, t.date),
  check("important_dates_date_check", isoDate("date")),
]);

// ---------- ride needs ----------

// A kid's usual need for each weekday (0 = Sunday … 6 = Saturday, like Date#getDay).
export const usualNeeds = sqliteTable("usual_needs", {
  kidId: text("kid_id").notNull().references(() => kids.id, { onDelete: "cascade" }),
  weekday: integer("weekday").notNull(),
  need: text("need", { enum: NEEDS }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.kidId, t.weekday] }),
  check("usual_needs_weekday_check", sql.raw("weekday between 0 and 6")),
  check("usual_needs_need_check", oneOf("need", NEEDS)),
]);

// A one-off change for a single rehearsal; replaces the usual need for that date.
export const needOverrides = sqliteTable("need_overrides", {
  kidId: text("kid_id").notNull().references(() => kids.id, { onDelete: "cascade" }),
  rehearsalId: text("rehearsal_id").notNull().references(() => rehearsals.id, { onDelete: "cascade" }),
  need: text("need", { enum: NEEDS }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.kidId, t.rehearsalId] }),
  check("need_overrides_need_check", oneOf("need", NEEDS)),
]);

// ---------- rides ----------

// A parent offering seats for one leg of one rehearsal.
export const drivers = sqliteTable("drivers", {
  id: id(),
  rehearsalId: text("rehearsal_id").notNull().references(() => rehearsals.id, { onDelete: "cascade" }),
  leg: text("leg", { enum: LEGS }).notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seats: integer("seats").notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique("drivers_rehearsal_leg_user_unique").on(t.rehearsalId, t.leg, t.userId),
  unique("drivers_id_rehearsal_leg_unique").on(t.id, t.rehearsalId, t.leg), // target for the assignments foreign key
  check("drivers_leg_check", oneOf("leg", LEGS)),
  check("drivers_seats_check", sql.raw("seats between 1 and 8")),
]);

// A kid riding in a driver's car. rehearsal_id and leg are copied from the driver
// (the composite foreign key keeps them in sync) so the unique index can stop double-booking.
export const rideAssignments = sqliteTable("ride_assignments", {
  driverId: text("driver_id").notNull(),
  rehearsalId: text("rehearsal_id").notNull(),
  leg: text("leg", { enum: LEGS }).notNull(),
  kidId: text("kid_id").notNull().references(() => kids.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.driverId, t.kidId] }),
  unique("ride_assignments_one_car_per_leg").on(t.rehearsalId, t.leg, t.kidId),
  foreignKey({ columns: [t.driverId, t.rehearsalId, t.leg], foreignColumns: [drivers.id, drivers.rehearsalId, drivers.leg] })
    .onDelete("cascade"),
]);

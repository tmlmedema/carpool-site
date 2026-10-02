// Starting data, copied from the "4th Grade Band Carpool Signup" Google Sheet.
// This is loaded once, the first time the site runs. After that, edit everything
// from the Admin page on the site.

import type { KidNeeds, RehearsalDate } from "../types";

// The data is in the format the site first stored it in (kids identified by a name-based id like "james").
// lib/server/db.ts copies it, or a site's older saved data in the same format, into the database tables.
export interface OldConfig {
  title: string; school: string; location?: string; rehearsal: string; dropoffNote: string; pickupNote: string;
  kids: { id: string; name: string; parents?: string[] }[];
  admins?: string[];
  dates: Omit<RehearsalDate, "allSchools">[]; // db.ts marks the all-school dates after copying
  importantDates?: { date: string; title: string; detail: string }[];
}
export interface OldDriver { email: string; name: string; seats: number; kids: string[]; phone?: string; addedBy?: string }
export type OldRide = Record<"dropoff" | "pickup", OldDriver[]>;

const d = (id: string, weekday: string, note = "", flag: RehearsalDate["flag"] = ""): OldConfig["dates"][number] => ({ id, weekday, note, flag });

export const SEED_CONFIG: OldConfig = {
  title: "4th Grade Band Carpool",
  school: "Park View Elementary School",
  location: "Glenn Westlake Middle School",
  rehearsal: "Rehearsal 4:00–5:00 PM",
  dropoffNote: "Arrive no earlier than 3:45 PM",
  pickupNote: "Pick up by 5:15 PM",
  kids: [
    { id: "james", name: "James", parents: [] },
    { id: "will", name: "Will", parents: [] },
    { id: "victoria", name: "Victoria", parents: [] },
  ],
  admins: [],
  dates: [
    d("2026-10-06", "Tuesday", "First rehearsal"),
    d("2026-10-13", "Tuesday", "NO SCHOOL – School Improvement Day", "confirm"),
    d("2026-10-20", "Tuesday"),
    d("2026-10-27", "Tuesday"),
    d("2026-11-03", "Tuesday", "NO SCHOOL – General Election Day", "confirm"),
    d("2026-11-10", "Tuesday"),
    d("2026-11-17", "Tuesday"),
    d("2026-11-24", "Tuesday", "NO SCHOOL – Conferences", "confirm"),
    d("2026-12-01", "Tuesday"),
    d("2026-12-08", "Tuesday"),
    d("2026-12-16", "Wednesday", "All 6 schools"),
    d("2027-01-06", "Wednesday", "All 6 schools"),
    d("2027-01-13", "Wednesday", "All 6 schools"),
    d("2027-01-26", "Tuesday", "Regular Tuesday schedule resumes"),
    d("2027-02-02", "Tuesday"),
    d("2027-02-09", "Tuesday"),
    d("2027-02-16", "Tuesday"),
    d("2027-02-23", "Tuesday"),
    d("2027-03-02", "Tuesday"),
    d("2027-03-09", "Tuesday"),
    d("2027-03-16", "Tuesday"),
    d("2027-03-23", "Tuesday"),
    d("2027-03-30", "Tuesday"),
    d("2027-04-06", "Tuesday"),
    d("2027-04-14", "Wednesday", "EARLY RELEASE – Elementary dismissal 1:15 PM • Rehearsal at 4:00 PM", "confirm"),
    d("2027-04-21", "Wednesday", "All 6 schools"),
    d("2027-04-28", "Wednesday", "All 6 schools"),
    d("2027-05-05", "Wednesday", "All 6 schools"),
    d("2027-05-12", "Wednesday", "All 6 schools"),
    d("2027-05-19", "Wednesday", "All 6 schools • LAST REHEARSAL"),
  ],
  importantDates: [
    { date: "2026-10-06", title: "First rehearsal", detail: "At Glenn Westlake Middle School, 4:00–5:00 PM" },
    { date: "2026-12-16", title: "Combined rehearsals begin", detail: "Wednesdays with all 6 schools through Jan 13" },
    { date: "2027-01-20", title: "Winter Concert", detail: "7:00 PM • Glenbard East High School" },
    { date: "2027-01-26", title: "Tuesday rehearsals resume", detail: "Regular Tuesday schedule" },
    { date: "2027-04-10", title: "Pancake Day", detail: "7:30 AM–12:00 PM • GWMS Cafeteria" },
    { date: "2027-04-14", title: "Early release day", detail: "Elementary dismissal 1:15 PM • Rehearsal still at 4:00 PM" },
    { date: "2027-05-10", title: "Spring Concert", detail: "7:00 PM • Glenbard East High School" },
    { date: "2027-05-19", title: "Last rehearsal", detail: "All 6 schools" },
  ],
};

// Ride needs: "both" | "dropoff" | "pickup" | "none"
export const SEED_NEEDS: Record<string, KidNeeds> = {
  james: { usual: { Tuesday: "both", Wednesday: "dropoff" }, overrides: {} },
  will: { usual: { Tuesday: "both", Wednesday: "pickup" }, overrides: {} },
  victoria: { usual: { Tuesday: "both", Wednesday: "both" }, overrides: { "2026-10-13": "none" } },
};

// Driver signups already in the sheet.
export const SEED_RIDES: Record<string, OldRide> = {
  "2026-10-06": { dropoff: [{ email: "jill@snacksdesign.com", name: "Jill", seats: 4, kids: ["james"] }], pickup: [] },
  "2026-10-13": { dropoff: [{ email: "jill@snacksdesign.com", name: "Jill", seats: 4, kids: ["james", "will"] }], pickup: [] },
};

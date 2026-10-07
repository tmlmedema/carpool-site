// Date and display helpers for the browser.
import { DEFAULT_REGULAR_DAY, type Driver, type KidNeeds, type Leg, type Need, type RehearsalDate } from "../types";

export const NEED_LABEL: Record<Need, string> = {
  both: "Drop-off & pickup",
  dropoff: "Drop-off only",
  pickup: "Pickup only",
  none: "No ride needed",
};
export const LEG_LABEL: Record<Leg, string> = { dropoff: "Drop-off", pickup: "Pickup" };
export const SEATS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const parse = (id: string) => new Date(id + "T12:00:00");
export const fmt = (id: string, opts: Intl.DateTimeFormatOptions) => parse(id).toLocaleDateString("en-US", opts);
export const longDate = (id: string) => fmt(id, { weekday: "long", month: "long", day: "numeric" });
export const shortDate = (id: string) => fmt(id, { weekday: "short", month: "short", day: "numeric" });
/** The Saturday ending the week (Sunday to Saturday) that a date falls in, as YYYY-MM-DD. */
export function weekEndOf(id: string): string {
  const d = parse(id);
  d.setDate(d.getDate() + 6 - d.getDay());
  return d.toLocaleDateString("en-CA");
}

export function todayId(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const isPast = (id: string) => id < todayId();
/** A rehearsal is over (hidden from lists) once its date has passed, or at 10 PM on the day itself. */
export const isOver = (id: string) => isPast(id) || (id === todayId() && new Date().getHours() >= 22);

/** A child goes to their regular day's rehearsals, every all-school rehearsal, and any other week a ride was asked for. */
export function goesTo(n: KidNeeds | undefined, d: RehearsalDate): boolean {
  const ov = n?.overrides[d.id];
  return (!!ov && ov !== "none") || d.allSchools || d.weekday === (n?.regularDay || DEFAULT_REGULAR_DAY);
}

export const openSeats = (drivers: Driver[]) => drivers.reduce((t, x) => t + Math.max(0, x.seats - x.kids.length), 0);

export function initials(nameOrEmail: string): string {
  const base = nameOrEmail.split("@")[0].replace(/[._-]+/g, " ").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export const mapsLink = (addr: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
export function routeLink(addrs: string[]): string {
  if (!addrs.length) return "";
  const dest = encodeURIComponent(addrs[addrs.length - 1]);
  const way = addrs.length > 1 ? `&waypoints=${encodeURIComponent(addrs.slice(0, -1).join("|"))}` : "";
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${dest}${way}`;
}

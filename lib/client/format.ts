// Date and display helpers for the browser.
import type { Leg, Need, Rehearsal, Driver } from "../types";

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

export const openSeats = (drivers: Driver[]) => drivers.reduce((t, x) => t + Math.max(0, x.seats - x.kids.length), 0);

/** More kids still need a ride than there are open seats on this leg. */
export const legShort = (d: Rehearsal, leg: Leg) => d[leg].stillNeed.length > openSeats(d[leg].drivers);
export const needsDriver = (d: Rehearsal) => legShort(d, "dropoff") || legShort(d, "pickup");

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

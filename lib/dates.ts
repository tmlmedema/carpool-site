// Date helpers. Rehearsal ids are YYYY-MM-DD; parse at noon so time zones never shift the day.
const parse = (id: string) => new Date(id + "T12:00:00");

export const fmt = (id: string, opts: Intl.DateTimeFormatOptions) => parse(id).toLocaleDateString("en-US", opts);
export const longDate = (id: string) => fmt(id, { weekday: "long", month: "long", day: "numeric" });

export function todayId() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const isPast = (id: string) => id < todayId();

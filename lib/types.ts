// Shared types used by both the server (API routes) and the browser (pages).

export type Need = "both" | "dropoff" | "pickup" | "none";
export type Leg = "dropoff" | "pickup";
export const LEGS: Leg[] = ["dropoff", "pickup"];
export const NEED_VALUES: Need[] = ["both", "dropoff", "pickup", "none"];
// Each child rehearses on one regular day (Tuesday until a parent picks), plus every all-school rehearsal.
export const REGULAR_DAYS = ["Tuesday", "Wednesday"];
export const DEFAULT_REGULAR_DAY = "Tuesday";
export const ALL_SCHOOLS = "all"; // the usual-needs key for all-school rehearsals

export interface Kid {
  id: number;
  name: string;
  parents?: string[]; // only sent to admins
}

export interface RehearsalDate {
  id: string; // YYYY-MM-DD
  weekday: string; // "Tuesday"
  note: string;
  flag: "" | "confirm" | "cancelled";
  allSchools: boolean; // a combined rehearsal every child goes to, whatever their regular day
}

export interface ImportantDate {
  date: string;
  title: string;
  detail: string;
}

export interface Config {
  title: string;
  school: string;
  location: string;
  rehearsal: string;
  dropoffNote: string;
  pickupNote: string;
  kids: Kid[];
  admins: string[];
  dates: RehearsalDate[];
  importantDates: ImportantDate[];
}

export interface KidNeeds {
  usual: Record<string, Need>; // keyed by regular weekday, or ALL_SCHOOLS
  overrides: Record<string, Need>; // keyed by date id
  regularDay?: string; // weekday the child usually rehearses; "" until a parent picks one
}

export interface Driver {
  email: string; // "guest:..." for drivers an admin added
  name: string;
  seats: number;
  kids: number[]; // kid ids
  phone?: string;
  addedBy?: string;
}

export interface Ride {
  dropoff: Driver[];
  pickup: Driver[];
}

export interface LegState {
  drivers: Driver[];
  needing: number[];
  stillNeed: number[];
}

export interface Rehearsal extends RehearsalDate {
  dropoff: LegState;
  pickup: LegState;
}

export interface KidInfo {
  address: string;
  notes: string;
  parents: { name: string; phone: string; email: string }[];
}

export interface PortalState {
  me: { email: string; name: string; phone: string; isAdmin: boolean; kids: number[] };
  kidInfo: Record<number, KidInfo>;
  config: Omit<Config, "dates" | "admins"> & { admins?: string[] };
  needs: Record<number, KidNeeds>;
  schedule: Rehearsal[];
  people: Record<string, { name: string; phone: string }>;
}

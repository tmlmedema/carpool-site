// Shared types used by both the server (API routes) and the browser (pages).

export type Need = "both" | "dropoff" | "pickup" | "none";
export type Leg = "dropoff" | "pickup";
export const LEGS: Leg[] = ["dropoff", "pickup"];
export const NEED_VALUES: Need[] = ["both", "dropoff", "pickup", "none"];

export interface Kid {
  id: string;
  name: string;
  parents?: string[]; // only sent to admins
}

export interface RehearsalDate {
  id: string; // YYYY-MM-DD
  weekday: string; // "Tuesday"
  note: string;
  flag: "" | "confirm" | "cancelled";
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
  usual: Record<string, Need>; // keyed by weekday
  overrides: Record<string, Need>; // keyed by date id
}

export interface Driver {
  email: string; // "guest:..." for drivers an admin added
  name: string;
  seats: number;
  kids: string[];
  phone?: string;
  addedBy?: string;
}

export interface Ride {
  dropoff: Driver[];
  pickup: Driver[];
}

export interface LegState {
  drivers: Driver[];
  needing: string[];
  stillNeed: string[];
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
  me: { email: string; name: string; phone: string; isAdmin: boolean; kids: string[] };
  kidInfo: Record<string, KidInfo>;
  config: Omit<Config, "dates" | "admins"> & { admins?: string[]; envAdmins?: string[] };
  needs: Record<string, KidNeeds>;
  schedule: Rehearsal[];
  people: Record<string, { name: string; phone: string }>;
}

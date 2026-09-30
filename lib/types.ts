// Shape of GET /api/state (see lib/api.js).
export type Need = "both" | "dropoff" | "pickup" | "none";
export type Leg = "dropoff" | "pickup";

export interface Kid { id: string; name: string; parents?: string[] }
export interface Driver { email: string; name: string; seats: number; kids: string[] }
export interface LegState { drivers: Driver[]; needing: string[]; stillNeed: string[] }
export interface Rehearsal {
  id: string;
  weekday: string;
  note: string;
  flag: "" | "confirm" | "cancelled";
  dropoff: LegState;
  pickup: LegState;
}
export interface ImportantDate { date: string; title: string; detail: string }
export interface KidNeeds { usual: Record<string, Need>; overrides: Record<string, Need> }

export interface PortalState {
  me: { email: string; name: string; phone: string; isAdmin: boolean; kids: string[] };
  config: {
    title: string;
    school: string;
    rehearsal: string;
    dropoffNote: string;
    pickupNote: string;
    kids: Kid[];
    admins?: string[];
    envAdmins?: string[];
    importantDates: ImportantDate[];
  };
  needs: Record<string, KidNeeds>;
  schedule: Rehearsal[];
  people: Record<string, { name: string; phone: string }>;
}

export const NEED_LABEL: Record<Need, string> = {
  both: "Drop-off & pickup",
  dropoff: "Drop-off only",
  pickup: "Pickup only",
  none: "No ride needed",
};
export const LEG_LABEL: Record<Leg, string> = { dropoff: "Drop-off", pickup: "Pickup" };

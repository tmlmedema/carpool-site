"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSignedIn } from "@/components/PortalProvider";
import type { PortalState } from "@/lib/types";

const SITE_FIELDS = [
  ["title", "Site title"],
  ["school", "School"],
  ["rehearsal", "Rehearsal time"],
  ["dropoffNote", "Drop-off note"],
  ["pickupNote", "Pickup note"],
] as const;
type SiteField = (typeof SITE_FIELDS)[number][0];

// Editable rows need a stable React key that survives edits to their fields.
let nextKey = 0;
const keyed = <T,>(row: T) => ({ ...row, key: nextKey++ });
type Keyed<T> = T & { key: number };
type KidRow = Keyed<{ id: string; name: string; parents: string }>;
type DateRow = Keyed<{ id: string; note: string; flag: string }>;
type ImpRow = Keyed<{ date: string; title: string; detail: string }>;

const splitEmails = (s: string) => s.split(/[,\s;]+/).filter(Boolean);

export default function AdminPage() {
  const { S, version } = useSignedIn();
  const router = useRouter();
  useEffect(() => { if (!S.me.isAdmin) router.replace("/"); }, [S.me.isAdmin, router]);
  if (!S.me.isAdmin) return null;
  // Re-seed the form from the server after every save.
  return <AdminForm key={version} S={S} />;
}

function AdminForm({ S }: { S: PortalState }) {
  const { act } = useSignedIn();
  const c = S.config;
  const [kids, setKids] = useState<KidRow[]>(() => c.kids.map((k) => keyed({ id: k.id, name: k.name, parents: (k.parents || []).join(", ") })));
  const [admins, setAdmins] = useState((c.admins || []).join(", "));
  const [dates, setDates] = useState<DateRow[]>(() => S.schedule.map((d) => keyed({ id: d.id, note: d.note, flag: d.flag })));
  const [imp, setImp] = useState<ImpRow[]>(() => c.importantDates.map((d) => keyed({ ...d })));
  const [site, setSite] = useState(() => Object.fromEntries(SITE_FIELDS.map(([f]) => [f, c[f]])) as Record<SiteField, string>);

  function editor<R extends { key: number }>(setRows: React.Dispatch<React.SetStateAction<R[]>>) {
    return {
      set: (key: number, field: keyof R, value: string) => setRows((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r))),
      remove: (key: number) => setRows((rows) => rows.filter((r) => r.key !== key)),
    };
  }
  const kidEd = editor(setKids), dateEd = editor(setDates), impEd = editor(setImp);

  const save = () => act("/admin/config", {
    kids: kids.map((k) => ({ id: k.id, name: k.name, parents: splitEmails(k.parents) })),
    admins: splitEmails(admins),
    dates: dates.map(({ id, note, flag }) => ({ id, note, flag })),
    importantDates: imp.map(({ date, title, detail }) => ({ date, title, detail })),
    ...site,
  }, "All changes saved");

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <h2>Admin</h2>
          <p className="muted" style={{ margin: 0 }}>Only parents whose email is listed here (or admins) can sign in.</p>
        </div>
        <div className="row">
          <a className="btn ghost" href="/api/admin/export.csv">Download schedule (CSV)</a>
          <button className="btn gold" onClick={save}>Save all changes</button>
        </div>
      </div>

      <div className="card">
        <h3>Kids &amp; parent emails</h3>
        {kids.map((k) => (
          <div className="edit-row edit-kids" key={k.key}>
            <input placeholder="Child's first name" aria-label="Child name" value={k.name} onChange={(e) => kidEd.set(k.key, "name", e.target.value)} />
            <input placeholder="Parent emails, separated by commas" aria-label="Parent emails" value={k.parents} onChange={(e) => kidEd.set(k.key, "parents", e.target.value)} />
            <button className="btn link" onClick={() => kidEd.remove(k.key)}>Remove</button>
          </div>
        ))}
        <button className="btn small ghost" onClick={() => setKids([...kids, keyed({ id: "", name: "", parents: "" })])}>+ Add child</button>
      </div>

      <div className="card">
        <h3>Admins</h3>
        <div className="field">
          <label htmlFor="admins">Admin emails (comma separated)</label>
          <input id="admins" value={admins} onChange={(e) => setAdmins(e.target.value)} />
        </div>
        {!!c.envAdmins?.length && <p className="muted">Always admin (set in Vercel): {c.envAdmins.join(", ")}</p>}
      </div>

      <div className="card">
        <h3>Rehearsal dates</h3>
        {dates.map((d) => (
          <div className="edit-row edit-dates" key={d.key}>
            <input type="date" aria-label="Date" value={d.id} onChange={(e) => dateEd.set(d.key, "id", e.target.value)} />
            <input placeholder="Note (optional)" aria-label="Note" value={d.note} onChange={(e) => dateEd.set(d.key, "note", e.target.value)} />
            <select aria-label="Status" value={d.flag} onChange={(e) => dateEd.set(d.key, "flag", e.target.value)}>
              <option value="">Normal</option>
              <option value="confirm">Needs confirming</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button className="btn link" onClick={() => dateEd.remove(d.key)}>Remove</button>
          </div>
        ))}
        <button className="btn small ghost" onClick={() => setDates([...dates, keyed({ id: "", note: "", flag: "" })])}>+ Add rehearsal</button>
      </div>

      <div className="card">
        <h3>Important dates</h3>
        {imp.map((d) => (
          <div className="edit-row edit-imp" key={d.key}>
            <input type="date" aria-label="Date" value={d.date} onChange={(e) => impEd.set(d.key, "date", e.target.value)} />
            <input placeholder="Title" aria-label="Title" value={d.title} onChange={(e) => impEd.set(d.key, "title", e.target.value)} />
            <input placeholder="Details" aria-label="Details" value={d.detail} onChange={(e) => impEd.set(d.key, "detail", e.target.value)} />
            <button className="btn link" onClick={() => impEd.remove(d.key)}>Remove</button>
          </div>
        ))}
        <button className="btn small ghost" onClick={() => setImp([...imp, keyed({ date: "", title: "", detail: "" })])}>+ Add date</button>
      </div>

      <div className="card">
        <h3>Site text</h3>
        <div className="grid-2">
          {SITE_FIELDS.map(([f, label]) => (
            <div className="field" key={f}>
              <label htmlFor={`s-${f}`}>{label}</label>
              <input id={`s-${f}`} value={site[f]} onChange={(e) => setSite({ ...site, [f]: e.target.value })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

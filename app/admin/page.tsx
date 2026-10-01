"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSignedIn } from "@/lib/client/portal";
import type { ImportantDate, RehearsalDate } from "@/lib/types";

interface KidRow { id: number | null; name: string; parents: string } // id is null for a new child
type DateRow = Pick<RehearsalDate, "id" | "note" | "flag">;
const TEXT_FIELDS = [
  ["title", "Site title"], ["school", "School"], ["location", "Rehearsal location"],
  ["rehearsal", "Rehearsal time"], ["dropoffNote", "Drop-off note"], ["pickupNote", "Pickup note"],
] as const;
type TextField = (typeof TEXT_FIELDS)[number][0];

const splitList = (s: string) => s.split(/[,\s;]+/).filter(Boolean);

export default function AdminPage() {
  const { S, act } = useSignedIn();
  const router = useRouter();
  const c = S.config;

  const [kids, setKids] = useState<KidRow[]>(() => c.kids.map((k) => ({ id: k.id, name: k.name, parents: (k.parents || []).join(", ") })));
  const [admins, setAdmins] = useState((c.admins || []).join(", "));
  const [dates, setDates] = useState<DateRow[]>(() => S.schedule.map((d) => ({ id: d.id, note: d.note, flag: d.flag })));
  const [imp, setImp] = useState<ImportantDate[]>(() => c.importantDates.map((d) => ({ ...d })));
  const [text, setText] = useState<Record<TextField, string>>(() => Object.fromEntries(TEXT_FIELDS.map(([f]) => [f, c[f] || ""])) as Record<TextField, string>);

  useEffect(() => { if (!S.me.isAdmin) router.replace("/"); }, [S.me.isAdmin, router]);
  if (!S.me.isAdmin) return null;

  const update = <T,>(list: T[], set: (v: T[]) => void, i: number, patch: Partial<T>) => set(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const remove = <T,>(list: T[], set: (v: T[]) => void, i: number) => set(list.filter((_, j) => j !== i));

  const save = () => act("/admin/config", {
    kids: kids.map((k) => ({ id: k.id, name: k.name, parents: splitList(k.parents) })),
    admins: splitList(admins),
    dates,
    importantDates: imp,
    ...text,
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
        {kids.map((k, i) => (
          <div className="edit-row edit-kids" key={i}>
            <input placeholder="Child's first name" aria-label="Child name" value={k.name} onChange={(e) => update(kids, setKids, i, { name: e.target.value })} />
            <input placeholder="Parent emails, separated by commas" aria-label="Parent emails" value={k.parents} onChange={(e) => update(kids, setKids, i, { parents: e.target.value })} />
            <button className="btn link" onClick={() => remove(kids, setKids, i)}>Remove</button>
          </div>
        ))}
        <button className="btn small ghost" onClick={() => setKids([...kids, { id: null, name: "", parents: "" }])}>+ Add child</button>
      </div>

      <div className="card">
        <h3>Admins</h3>
        <div className="field"><label htmlFor="admins">Admin emails (comma separated)</label><input id="admins" value={admins} onChange={(e) => setAdmins(e.target.value)} /></div>
      </div>

      <div className="card">
        <h3>Rehearsal dates</h3>
        {dates.map((d, i) => (
          <div className="edit-row edit-dates" key={i}>
            <input type="date" aria-label="Date" value={d.id} onChange={(e) => update(dates, setDates, i, { id: e.target.value })} />
            <input placeholder="Note (optional)" aria-label="Note" value={d.note} onChange={(e) => update(dates, setDates, i, { note: e.target.value })} />
            <select aria-label="Status" value={d.flag} onChange={(e) => update(dates, setDates, i, { flag: e.target.value as DateRow["flag"] })}>
              <option value="">Normal</option><option value="confirm">Needs confirming</option><option value="cancelled">Cancelled</option>
            </select>
            <button className="btn link" onClick={() => remove(dates, setDates, i)}>Remove</button>
          </div>
        ))}
        <button className="btn small ghost" onClick={() => setDates([...dates, { id: "", note: "", flag: "" }])}>+ Add rehearsal</button>
      </div>

      <div className="card">
        <h3>Important dates</h3>
        {imp.map((d, i) => (
          <div className="edit-row edit-imp" key={i}>
            <input type="date" aria-label="Date" value={d.date} onChange={(e) => update(imp, setImp, i, { date: e.target.value })} />
            <input placeholder="Title" aria-label="Title" value={d.title} onChange={(e) => update(imp, setImp, i, { title: e.target.value })} />
            <input placeholder="Details" aria-label="Details" value={d.detail} onChange={(e) => update(imp, setImp, i, { detail: e.target.value })} />
            <button className="btn link" onClick={() => remove(imp, setImp, i)}>Remove</button>
          </div>
        ))}
        <button className="btn small ghost" onClick={() => setImp([...imp, { date: "", title: "", detail: "" }])}>+ Add date</button>
      </div>

      <div className="card">
        <h3>Site text</h3>
        <div className="grid-2">
          {TEXT_FIELDS.map(([f, label]) => (
            <div className="field" key={f}><label htmlFor={`s-${f}`}>{label}</label><input id={`s-${f}`} value={text[f]} onChange={(e) => setText({ ...text, [f]: e.target.value })} /></div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { useSignedIn } from "@/lib/client/portal";
import { fmt, isPast, NEED_LABEL, shortDate } from "@/lib/client/format";
import { ALL_SCHOOLS, DEFAULT_REGULAR_DAY, NEED_VALUES, REGULAR_DAYS, type Leg, type Need, type Rehearsal } from "@/lib/types";

export default function MyChildPage() {
  const { S, act } = useSignedIn();
  const kids = S.me.isAdmin ? S.config.kids.map((k) => k.id) : S.me.kids;
  const [picked, setPicked] = useState(kids[0]);
  const sel = kids.includes(picked) ? picked : kids[0];


  if (!kids.length) {
    return <div className="wrap page"><h2>My Child&apos;s Rides</h2><div className="card">Your email isn&apos;t linked to a child yet. Ask the coordinator to add you.</div></div>;
  }

  const kidName = (id: number) => S.config.kids.find((k) => k.id === id)?.name || id;
  const n = S.needs[sel] || { usual: {}, overrides: {} };
  const regularDay = n.regularDay || DEFAULT_REGULAR_DAY;
  const otherDay = REGULAR_DAYS.find((day) => day !== regularDay)!;
  // Usual rides cover all-school rehearsals and the regular day; other dates only get a ride when changed for that week.
  const usualFor = (d: Rehearsal) => (d.allSchools ? n.usual[ALL_SCHOOLS] : d.weekday === regularDay ? n.usual[regularDay] : undefined) || "none";

  // All-school rehearsal dates as ranges, starting a new range after a break of more than four weeks.
  const md = (id: string) => fmt(id, { month: "short", day: "numeric" });
  const runs: string[][] = [];
  for (const id of S.schedule.filter((d) => d.allSchools).map((d) => d.id)) {
    const run = runs[runs.length - 1];
    if (run && Date.parse(id) - Date.parse(run[run.length - 1]) <= 28 * 864e5) run.push(id);
    else runs.push([id]);
  }
  const allSchoolDates = runs.map((r) => (r.length > 1 ? `${md(r[0])} – ${md(r[r.length - 1])}` : md(r[0]))).join(", ");

  const cover = (d: Rehearsal, leg: Leg) => {
    const dr = d[leg].drivers.find((x) => x.kids.includes(sel));
    if (dr) return <span className="tag ok">{dr.name}</span>;
    if (d[leg].needing.includes(sel)) return <span className="tag warn">Needs driver</span>;
    return <span className="muted">—</span>;
  };

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <h2>My Child&apos;s Rides</h2>
          <p className="muted" style={{ margin: 0 }}>Set the usual rides once and every week fills in. Change any single week below.</p>
        </div>
        {kids.length > 1 && (
          <select aria-label="Child" style={{ width: "auto" }} value={sel} onChange={(e) => setPicked(Number(e.target.value))}>
            {kids.map((k) => <option key={k} value={k}>{kidName(k)}</option>)}
          </select>
        )}
      </div>

      <div className="card">
        <h3>{kidName(sel)}&apos;s usual rides</h3>
        <div className="field">
          <label id="regular-day">Regular rehearsal day</label>
          <div className="day-switch">
            <span className={regularDay === "Tuesday" ? "on" : ""}>Tuesdays</span>
            <button type="button" role="switch" className="switch" aria-labelledby="regular-day" aria-checked={regularDay === "Wednesday"}
              onClick={() => act("/needs", { kidId: sel, regularDay: otherDay }, `Regular day set to ${otherDay}s`)} />
            <span className={regularDay === "Wednesday" ? "on" : ""}>Wednesdays</span>
          </div>
        </div>
        <UsualRow label={`${regularDay} rehearsals`} need={n.usual[regularDay]} onPick={(v) => act("/needs", { kidId: sel, usual: { [regularDay]: v } }, "Usual rides updated")} />
        <UsualRow label={`All school Wednesday rehearsals${allSchoolDates && ` (${allSchoolDates})`}`} need={n.usual[ALL_SCHOOLS]}
          onPick={(v) => act("/needs", { kidId: sel, usual: { [ALL_SCHOOLS]: v } }, "Usual rides updated")} />
      </div>

      <div className="card">
        <h3>{kidName(sel)}&apos;s home address</h3>
        <p className="muted" style={{ marginTop: 0 }}>Only drivers who have {kidName(sel)} in their car can see this.</p>
        <AddressForm key={`${sel}|${S.kidInfo[sel]?.address}|${S.kidInfo[sel]?.notes}`} kidId={sel} />
      </div>

      <div className="card">
        <h3>Week by week</h3>
        <div className="table-wrap">
          <table className="week-table">
            <thead><tr><th>Date</th><th>Ride needed</th><th>Drop-off</th><th>Pickup</th></tr></thead>
            <tbody>
              {S.schedule.filter((d) => !isPast(d.id)).map((d) => {
                const ov = n.overrides[d.id];
                const usual = usualFor(d);
                return (
                  <tr key={d.id} className={ov ? "override" : ""}>
                    <td className="wk-date"><Link href={`/schedule?d=${d.id}`} aria-label={`Open ${shortDate(d.id)} on the schedule`}><b>{shortDate(d.id)}</b></Link>{d.note && <div className="muted" style={{ fontSize: ".8rem" }}>{d.note}</div>}</td>
                    <td className="wk-need">
                      <select aria-label={`Ride needed ${d.id}`} value={ov || ""} onChange={(e) => act("/needs", { kidId: sel, overrides: { [d.id]: e.target.value || null } }, "Week updated")}>
                        <option value="">Usual ({NEED_LABEL[usual]})</option>
                        {NEED_VALUES.map((v) => <option key={v} value={v}>{NEED_LABEL[v]}</option>)}
                      </select>
                    </td>
                    <td className="wk-leg" data-label="Drop-off">{cover(d, "dropoff")}</td>
                    <td className="wk-leg" data-label="Pickup">{cover(d, "pickup")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UsualRow({ label, need, onPick }: { label: string; need?: Need; onPick: (v: Need) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="seg" role="group" aria-label={`Usual ride, ${label}`}>
        {NEED_VALUES.map((v) => <button key={v} className={(need || "none") === v ? "on" : ""} onClick={() => onPick(v)}>{NEED_LABEL[v]}</button>)}
      </div>
    </div>
  );
}

function AddressForm({ kidId }: { kidId: number }) {
  const { S, act } = useSignedIn();
  const [addr, setAddr] = useState(S.kidInfo[kidId]?.address || "");
  const [notes, setNotes] = useState(S.kidInfo[kidId]?.notes || "");
  return (
    <form className="grid-2" onSubmit={(e) => { e.preventDefault(); act("/kidinfo", { kidId, address: addr, notes }, "Address saved"); }}>
      <div className="field"><label htmlFor="addr">Address for rides</label><input id="addr" maxLength={200} autoComplete="street-address" placeholder="123 Main St, Lombard" value={addr} onChange={(e) => setAddr(e.target.value)} /></div>
      <div className="field"><label htmlFor="addr-notes">Notes for drivers (optional)</label><input id="addr-notes" maxLength={200} placeholder="Side door, text when outside" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div><button className="btn gold" type="submit">Save address</button></div>
    </form>
  );
}

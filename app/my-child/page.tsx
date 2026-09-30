"use client";
import { useState } from "react";
import { useSignedIn } from "@/lib/client/portal";
import { isPast, NEED_LABEL, shortDate } from "@/lib/client/format";
import { NEED_VALUES, type Leg, type Rehearsal } from "@/lib/types";

export default function MyChildPage() {
  const { S, act } = useSignedIn();
  const kids = S.me.isAdmin ? S.config.kids.map((k) => k.id) : S.me.kids;
  const [picked, setPicked] = useState(kids[0]);
  const sel = kids.includes(picked) ? picked : kids[0];


  if (!kids.length) {
    return <div className="wrap page"><h2>My Child&apos;s Rides</h2><div className="card">Your email isn&apos;t linked to a child yet. Ask the coordinator to add you.</div></div>;
  }

  const kidName = (id: string) => S.config.kids.find((k) => k.id === id)?.name || id;
  const n = S.needs[sel] || { usual: {}, overrides: {} };
  const weekdays = [...new Set(S.schedule.map((d) => d.weekday))];

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
          <select aria-label="Child" style={{ width: "auto" }} value={sel} onChange={(e) => setPicked(e.target.value)}>
            {kids.map((k) => <option key={k} value={k}>{kidName(k)}</option>)}
          </select>
        )}
      </div>

      <div className="card">
        <h3>{kidName(sel)}&apos;s usual rides</h3>
        {weekdays.map((day) => (
          <div className="field" key={day}>
            <label>{day} rehearsals</label>
            <div className="seg" role="group" aria-label={`Usual ${day} ride`}>
              {NEED_VALUES.map((v) => (
                <button key={v} className={(n.usual[day] || "none") === v ? "on" : ""}
                  onClick={() => act("/needs", { kidId: sel, usual: { [day]: v } }, "Usual rides updated")}>{NEED_LABEL[v]}</button>
              ))}
            </div>
          </div>
        ))}
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
                const usual = n.usual[d.weekday] || "none";
                return (
                  <tr key={d.id} className={ov ? "override" : ""}>
                    <td className="wk-date"><b>{shortDate(d.id)}</b>{d.note && <div className="muted" style={{ fontSize: ".8rem" }}>{d.note}</div>}</td>
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

function AddressForm({ kidId }: { kidId: string }) {
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

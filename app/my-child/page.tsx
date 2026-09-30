"use client";

import { useState } from "react";
import { useSignedIn } from "@/components/PortalProvider";
import { fmt, isPast } from "@/lib/dates";
import { NEED_LABEL, type Leg, type Need, type Rehearsal } from "@/lib/types";

const NEEDS = Object.keys(NEED_LABEL) as Need[];

export default function MyChildPage() {
  const { S, act, kidName, showPast, setShowPast } = useSignedIn();
  const [picked, setPicked] = useState<string>();
  const kids = S.me.isAdmin ? S.config.kids.map((k) => k.id) : S.me.kids;

  if (!kids.length) {
    return (
      <div className="wrap page">
        <h2>My Child&apos;s Rides</h2>
        <div className="card">Your email isn&apos;t linked to a child yet. Ask the coordinator to add you.</div>
      </div>
    );
  }

  const sel = picked && kids.includes(picked) ? picked : kids[0];
  const n = S.needs[sel] || { usual: {}, overrides: {} };
  const weekdays = [...new Set(S.schedule.map((d) => d.weekday))];

  const cover = (d: Rehearsal, leg: Leg) => {
    const dr = d[leg].drivers.find((x) => x.kids.includes(sel));
    if (dr) return <span className="tag ok">{dr.name}</span>;
    return d[leg].needing.includes(sel) ? <span className="tag warn">Needs driver</span> : <span className="muted">—</span>;
  };

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <h2>My Child&apos;s Rides</h2>
          <p className="muted" style={{ margin: 0 }}>Set the usual rides once and every week fills in. Change any single week below.</p>
        </div>
        {kids.length > 1 && (
          <select style={{ width: "auto" }} aria-label="Child" value={sel} onChange={(e) => setPicked(e.target.value)}>
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
              {NEEDS.map((v) => (
                <button key={v} className={(n.usual[day] || "none") === v ? "on" : ""}
                  onClick={() => act("/needs", { kidId: sel, usual: { [day]: v } }, "Usual rides updated")}>
                  {NEED_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Week by week</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Ride needed</th><th>Drop-off</th><th>Pickup</th></tr></thead>
            <tbody>
              {S.schedule.filter((d) => showPast || !isPast(d.id)).map((d) => {
                const ov = n.overrides[d.id];
                const usual = n.usual[d.weekday] || "none";
                return (
                  <tr key={d.id} className={ov ? "override" : ""}>
                    <td>
                      <b>{fmt(d.id, { weekday: "short", month: "short", day: "numeric" })}</b>
                      {d.note && <div className="muted" style={{ fontSize: ".8rem" }}>{d.note}</div>}
                    </td>
                    <td>
                      <select aria-label={`Ride needed ${d.id}`} value={ov || ""}
                        onChange={(e) => act("/needs", { kidId: sel, overrides: { [d.id]: e.target.value || null } }, "Week updated")}>
                        <option value="">Usual ({NEED_LABEL[usual]})</option>
                        {NEEDS.map((v) => <option key={v} value={v}>{NEED_LABEL[v]}</option>)}
                      </select>
                    </td>
                    <td>{cover(d, "dropoff")}</td>
                    <td>{cover(d, "pickup")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p><button className={"chip-toggle" + (showPast ? " on" : "")} onClick={() => setShowPast(!showPast)}>Show past rehearsals</button></p>
      </div>
    </div>
  );
}

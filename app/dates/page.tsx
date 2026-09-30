"use client";

import { useSignedIn } from "@/components/PortalProvider";
import { DateBadge } from "@/components/RehearsalCard";
import { fmt, isPast } from "@/lib/dates";

export default function DatesPage() {
  const { S } = useSignedIn();
  return (
    <div className="wrap page">
      <h2>Important Dates</h2>
      <div className="card">
        <ul className="date-list">
          {S.config.importantDates.length ? S.config.importantDates.map((d) => (
            <li key={d.date + d.title}>
              <DateBadge id={d.date} />
              <div><strong>{d.title}</strong><div className="muted">{d.detail}</div></div>
            </li>
          )) : <li>No dates yet.</li>}
        </ul>
      </div>
      <h2>All rehearsals</h2>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Notes</th></tr></thead>
            <tbody>
              {S.schedule.map((d) => (
                <tr key={d.id} className={isPast(d.id) ? "past" : ""}>
                  <td>{fmt(d.id, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</td>
                  <td>{d.note}{d.flag === "confirm" && <> <span className="tag warn">Confirm</span></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

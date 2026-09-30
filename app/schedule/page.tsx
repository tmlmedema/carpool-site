"use client";

import { useState } from "react";
import { useSignedIn } from "@/components/PortalProvider";
import { RehearsalCard } from "@/components/RehearsalCard";
import { isPast } from "@/lib/dates";

export default function SchedulePage() {
  const { S, showPast, setShowPast } = useSignedIn();
  const [onlyMine, setOnlyMine] = useState(false);

  let list = S.schedule.filter((d) => showPast || !isPast(d.id));
  if (onlyMine) list = list.filter((d) => (["dropoff", "pickup"] as const).some((l) => d[l].stillNeed.length || d[l].drivers.some((x) => x.email === S.me.email)));

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <h2>Carpool Schedule</h2>
          <p className="muted" style={{ margin: 0 }}>Offer seats with <b>I can drive</b>, then tap a red name to add that child to your car.</p>
        </div>
        <div className="filters">
          <button className={"chip-toggle" + (onlyMine ? " on" : "")} onClick={() => setOnlyMine(!onlyMine)}>Needs drivers / my drives</button>
          <button className={"chip-toggle" + (showPast ? " on" : "")} onClick={() => setShowPast(!showPast)}>Show past rehearsals</button>
        </div>
      </div>
      {list.length ? list.map((d) => <RehearsalCard key={d.id} d={d} />) : <div className="card">Nothing to show with these filters.</div>}
    </div>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { useSignedIn } from "@/lib/client/portal";
import { goesTo, isPast, weekEndOf } from "@/lib/client/format";
import { RehearsalCard, UpcomingRow } from "@/components/Rehearsal";

// "Only show my child's schedule" is on until a parent turns it off; the choice is remembered in this browser.
const onlyMineKey = (email: string) => `onlyMyChild:${email}`;
function readOnlyMine(email: string) {
  try { return localStorage.getItem(onlyMineKey(email)) !== "off"; } catch { return true; }
}

export default function HomePage() {
  const { S } = useSignedIn();
  const c = S.config;
  const hasKids = S.me.kids.length > 0;
  const [onlyMine, setOnlyMine] = useState(() => readOnlyMine(S.me.email));
  const toggleOnlyMine = () => {
    const on = !onlyMine;
    setOnlyMine(on);
    try { localStorage.setItem(onlyMineKey(S.me.email), on ? "on" : "off"); } catch {}
  };

  const shown = S.schedule.filter((d) => !isPast(d.id) && (!hasKids || !onlyMine || S.me.kids.some((k) => goesTo(S.needs[k], d))));
  const next = shown[0];
  // The next rehearsal and any others later that week (Sunday to Saturday), like a Tuesday and Wednesday.
  const weekEnd = next ? weekEndOf(next.id) : "";
  const thisWeek = shown.filter((d) => d.id <= weekEnd);
  const upcoming = shown.filter((d) => d.id > weekEnd).slice(0, 4);
  const kidNames = S.me.kids.map((id) => c.kids.find((k) => k.id === id)?.name || id);

  return (
    <>
      <section className="hero hero-compact">
        <div className="wrap">
          <p className="hero-copy">
            {c.location && <><b>{c.location}</b><br /></>}
            {[c.rehearsal, c.dropoffNote, c.pickupNote].filter(Boolean).join(" • ")}
          </p>
        </div>
      </section>
      <div className="wrap">
        <div className="cta-row">
          <Link className="cta" href="/schedule"><h3>Carpool<br />Schedule</h3><span className="more">Sign up to drive.</span></Link>
          <Link className="cta" href="/my-child"><h3>My Child&apos;s<br />Rides</h3><span className="more">{kidNames.length ? `Set rides for ${kidNames.join(" & ")}.` : "Set ride needs."}</span></Link>
          <Link className="cta" href="/dates"><h3>Important<br />Dates</h3><span className="more">See the calendar.</span></Link>
        </div>
        <div className="section-head">
          <h2 className="section-title">This week</h2>
          {hasKids && (
            <label className="switch-label">
              Only show my child&apos;s schedule
              <button type="button" role="switch" className="switch" aria-checked={onlyMine} onClick={toggleOnlyMine} />
            </label>
          )}
        </div>
        {thisWeek.length ? thisWeek.map((d) => <RehearsalCard key={d.id} d={d} />)
          : <div className="card">{hasKids && onlyMine ? "Your child has no more rehearsals this season." : "No more rehearsals this season."}</div>}
        {upcoming.length > 0 && (
          <>
            <div className="section-head"><h2 className="section-title">Upcoming rehearsals</h2></div>
            <div className="card upcoming">{upcoming.map((d) => <UpcomingRow key={d.id} d={d} />)}</div>
            <p className="upcoming-foot"><Link className="btn gold" href="/schedule?f=all">View full schedule</Link></p>
          </>
        )}
      </div>
    </>
  );
}

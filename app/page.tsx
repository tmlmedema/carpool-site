"use client";
import Link from "next/link";
import { useSignedIn } from "@/lib/client/portal";
import { isPast, longDate, weekEndOf } from "@/lib/client/format";
import { LegStatus, RehearsalCard, UpcomingRow } from "@/components/Rehearsal";

export default function HomePage() {
  const { S } = useSignedIn();
  const c = S.config;
  const next = S.schedule.find((d) => !isPast(d.id));
  // The next rehearsal and any others later that week (Sunday to Saturday), like a Tuesday and Wednesday.
  const weekEnd = next ? weekEndOf(next.id) : "";
  const thisWeek = next ? S.schedule.filter((d) => d.id >= next.id && d.id <= weekEnd) : [];
  const upcoming = next ? S.schedule.filter((d) => d.id > weekEnd).slice(0, 4) : [];
  const kidNames = S.me.kids.map((id) => c.kids.find((k) => k.id === id)?.name || id);

  return (
    <>
      <section className="hero hero-compact">
        <div className="wrap">
          <p className="hero-copy">
            {c.location && <><b>{c.location}</b><br /></>}
            {[c.rehearsal, c.dropoffNote, c.pickupNote].filter(Boolean).join(" • ")}
          </p>
          {next ? (
            <div className={thisWeek.length > 1 ? "next-box next-multi" : "next-box"}>
              <span className="next-label">{thisWeek.length > 1 ? "Next rehearsals" : "Next rehearsal"}</span>
              <div className="next-items">
                {thisWeek.map((d) => (
                  <div className="next-item" key={d.id}>
                    <strong>{longDate(d.id)}</strong>
                    {d.note && <span className="next-note">{d.note}</span>}
                    <span className="next-status">
                      <span>Drop-off <LegStatus d={d} leg="dropoff" /></span>
                      <span>Pickup <LegStatus d={d} leg="pickup" /></span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="next-box">No more rehearsals this season.</div>}
        </div>
      </section>
      <div className="wrap">
        <div className="cta-row">
          <Link className="cta" href="/schedule"><h3>Carpool<br />Schedule</h3><span className="more">Sign up to drive.</span></Link>
          <Link className="cta" href="/my-child"><h3>My Child&apos;s<br />Rides</h3><span className="more">{kidNames.length ? `Set rides for ${kidNames.join(" & ")}.` : "Set ride needs."}</span></Link>
          <Link className="cta" href="/dates"><h3>Important<br />Dates</h3><span className="more">See the calendar.</span></Link>
        </div>
        {next && <><h2 className="section-title">This week</h2>{thisWeek.map((d) => <RehearsalCard key={d.id} d={d} />)}</>}
        {upcoming.length > 0 && (
          <>
            <div className="upcoming-head"><h2 className="section-title">Upcoming rehearsals</h2></div>
            <div className="card upcoming">{upcoming.map((d) => <UpcomingRow key={d.id} d={d} />)}</div>
            <p className="upcoming-foot"><Link className="btn gold" href="/schedule">View full schedule</Link></p>
          </>
        )}
      </div>
    </>
  );
}

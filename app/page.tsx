"use client";

import Link from "next/link";
import { useSignedIn } from "@/components/PortalProvider";
import { HeroArt } from "@/components/HeroArt";
import { LegStatus, RehearsalCard } from "@/components/RehearsalCard";
import { isPast, longDate } from "@/lib/dates";

export default function HomePage() {
  const { S, kidName } = useSignedIn();
  const next = S.schedule.find((d) => !isPast(d.id));
  const myKids = S.me.kids;

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <div className="eyebrow">{S.config.school}</div>
            <h1>{S.config.title}</h1>
            <p>{S.config.rehearsal} • {S.config.dropoffNote} • {S.config.pickupNote}</p>
            {next ? (
              <div className="next-box">
                Next rehearsal: <strong>{longDate(next.id)}</strong>
                {next.note && <><br /><span>{next.note}</span></>}
                <br />Drop-off: <LegStatus d={next} leg="dropoff" /> &nbsp; Pickup: <LegStatus d={next} leg="pickup" />
              </div>
            ) : (
              <div className="next-box">No more rehearsals this season.</div>
            )}
          </div>
          <HeroArt />
        </div>
      </section>
      <div className="wrap">
        <div className="cta-row">
          <Link className="cta" href="/schedule">
            <div className="icon">🚗</div><h3>Carpool Schedule</h3>
            <p>Offer seats and pick up kids who still need a ride.</p>
          </Link>
          <Link className="cta" href="/my-child">
            <div className="icon">🎺</div><h3>My Child&apos;s Rides</h3>
            <p>{myKids.length ? `Set usual rides for ${myKids.map(kidName).join(" & ")}.` : "Set your child's usual rides and weekly changes."}</p>
          </Link>
          <Link className="cta" href="/dates">
            <div className="icon">📅</div><h3>Important Dates</h3>
            <p>No-school days, early release and the last rehearsal.</p>
          </Link>
        </div>
        {next && <><h2>This week</h2><RehearsalCard d={next} /></>}
      </div>
    </>
  );
}

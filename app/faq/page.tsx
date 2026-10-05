"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useSignedIn } from "@/lib/client/portal";

type QA = { q: string; a: ReactNode };

export default function FaqPage() {
  const { S } = useSignedIn();
  const c = S.config;
  const times = [c.rehearsal, c.dropoffNote, c.pickupNote].filter(Boolean).join(". ");

  const sections: [string, QA[]][] = [
    ["Rehearsals", [
      { q: "Where and when are rehearsals?", a: <>{c.location || "Glenn Westlake Middle School"}. {times}.</> },
      { q: "Is my child on Tuesdays or Wednesdays?", a: <>Each child has one regular rehearsal day. Every child starts on Tuesdays. If yours rehearses on Wednesdays (Non Park View days), switch <b>Regular rehearsal day</b> on <Link href="/my-child">My Child&apos;s Schedule</Link>.</> },
      { q: "What are all school Wednesday rehearsals?", a: <>Combined rehearsals that every child goes to, whatever their regular day. Their dates are listed next to <b>All school Wednesday rehearsals</b> on <Link href="/my-child">My Child&apos;s Schedule</Link>, and every rehearsal is on <Link href="/dates">Important Dates</Link>.</> },
      { q: "What if a rehearsal is cancelled?", a: <>It shows a <b>Cancelled</b> tag on the home page and the schedule.</> },
    ]],
    ["My child's rides", [
      { q: "How do I tell drivers my child needs a ride?", a: <>On <Link href="/my-child">My Child&apos;s Schedule</Link>, pick the usual rides for regular-day rehearsals and for all school Wednesdays: <b>Drop-off &amp; pickup</b>, <b>Drop-off only</b>, <b>Pickup only</b>, or <b>No ride needed</b>. Every week fills in from there.</> },
      { q: "My plans changed for one week. What do I do?", a: <>Under <b>Week by week</b>, change the <b>Ride needed</b> menu for that date. Changed weeks are highlighted. Pick <b>Usual</b> to go back.</> },
      { q: "How do I know who's driving my child?", a: <>The <b>Week by week</b> table shows the driver&apos;s name for each drop-off and pickup. A blue <b>Needs driver</b> tag means no one has your child yet; tap it to open that date on the schedule.</> },
      { q: "Who can see my address?", a: <>Only your family, the coordinators, and drivers who have your child in their car. Add it, plus any notes for drivers, on <Link href="/my-child">My Child&apos;s Schedule</Link>.</> },
    ]],
    ["Driving", [
      { q: "How do I sign up to drive?", a: <>On the <Link href="/schedule">Carpool Schedule</Link>, choose how many seats you have and tap <b>I can drive</b> for drop-off or pickup. You need your name saved first.</> },
      { q: "How do I add kids to my car?", a: <>Under <b>Still needs a ride</b>, tap a blue name to put that child in your car. Tap the × next to a name to take them out.</> },
      { q: "What does “Driver needed” mean?", a: <>More kids still need a ride than there are open seats. A yellow <b>I can drive</b> button marks where help is needed most.</> },
      { q: "I can't drive anymore. How do I drop out?", a: <>Tap <b>I can&apos;t drive</b> under your name. Any kids in your car go back on the <b>Still needs a ride</b> list, so please also text the families.</> },
      { q: "Where are the addresses for the kids in my car?", a: <>Tap <b>Addresses &amp; contacts</b> on your car for each child&apos;s address, parent phone, and a <b>Route all stops in Maps</b> link.</> },
      { q: "How do I see only the days I drive?", a: <>Tap <Link href="/schedule?f=mine">My rides</Link>. The schedule also has <b>My child&apos;s schedule</b> and <b>All</b> filters.</> },
    ]],
    ["Your account", [
      { q: "How do I sign in?", a: <>Enter your email and we&apos;ll send a sign-in link that works for 20 minutes. Only emails on the parent list can sign in. You stay signed in on that device for 60 days.</> },
      { q: "My email isn't on the parent list.", a: <>Ask a coordinator to add it. Two parents can each have their own email linked to the same child.</> },
      { q: "How do I change my name or phone?", a: <>Tap your initials in the top corner, then <b>My info</b>. Other parents see your name and phone when you drive.</> },
      { q: "Can I share this site?", a: <>Please don&apos;t share kids&apos; names or contact info outside the group.</> },
    ]],
  ];

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <h2>FAQ</h2>
          <p className="muted" style={{ margin: 0 }}>Quick answers about rides, driving, and signing in.</p>
        </div>
      </div>
      {sections.map(([title, items]) => (
        <div className="card faq" key={title}>
          <h3>{title}</h3>
          {items.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      ))}
    </div>
  );
}

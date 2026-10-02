"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSignedIn } from "@/lib/client/portal";
import { goesTo, isPast } from "@/lib/client/format";
import { RehearsalCard } from "@/components/Rehearsal";
import { LEGS, type Rehearsal } from "@/lib/types";

type Filter = "all" | "kids" | "mine";
const FILTERS: [Filter, string][] = [["all", "All"], ["kids", "My child's schedule"], ["mine", "My rides"]];
const EMPTY: Record<Filter, string> = {
  all: "No rehearsals to show.",
  mine: "You haven't signed up to drive for any upcoming rehearsals yet. Tap I can drive on a rehearsal to volunteer.",
  kids: "Your child doesn't have any upcoming rehearsals.",
};

export default function SchedulePage() {
  return <Suspense fallback={<div className="wrap loading">Loading…</div>}><ScheduleFromUrl /></Suspense>;
}

// /schedule?f=mine (menu button), /schedule?f=all (home page) and /schedule?d=2026-10-13 (upcoming list).
// Keyed on the query so following one of those links again resets the view.
function ScheduleFromUrl() {
  const params = useSearchParams();
  const f = params.get("f") as Filter | null;
  return <Schedule key={params.toString()} jumpTo={params.get("d")} initialFilter={f && f in EMPTY ? f : null} />;
}

// Opens on My child's schedule for parents, All for everyone else (and when jumping to a date).
function Schedule({ jumpTo, initialFilter }: { jumpTo: string | null; initialFilter: Filter | null }) {
  const { S } = useSignedIn();
  const [filter, setFilter] = useState<Filter>(jumpTo ? "all" : initialFilter ?? (S.me.kids.length ? "kids" : "all"));
  const [highlight, setHighlight] = useState<string | null>(jumpTo);

  useEffect(() => {
    if (!jumpTo) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`r-${jumpTo}`);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    const t = setTimeout(() => setHighlight(null), 2200);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [jumpTo]);

  // Rehearsals where you signed up to drive (either leg).
  const isMine = (d: Rehearsal) => LEGS.some((l) => d[l].drivers.some((x) => x.email === S.me.email));

  const hasKids = S.me.kids.length > 0;
  const isKids = (d: Rehearsal) => S.me.kids.some((k) => goesTo(S.needs[k], d));

  let list = S.schedule.filter((d) => !isPast(d.id));
  if (filter === "mine") list = list.filter(isMine);
  if (filter === "kids") list = list.filter(isKids);

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <h2>Carpool Schedule</h2>
          <p className="muted" style={{ margin: 0 }}>Offer seats with <b>I can drive</b>, then tap a blue name to add that child to a car.</p>
        </div>
        <div className="filters">
          <div className="seg filter-seg" role="tablist" aria-label="Filter rehearsals">
            {FILTERS.filter(([id]) => id !== "kids" || hasKids).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      {list.length ? list.map((d) => <RehearsalCard key={d.id} d={d} highlight={highlight === d.id} />) : <div className="card">{EMPTY[filter]}</div>}
    </div>
  );
}

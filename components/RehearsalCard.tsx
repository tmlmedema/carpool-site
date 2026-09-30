"use client";

import { useState } from "react";
import { fmt, isPast, longDate } from "@/lib/dates";
import { LEG_LABEL, type Leg, type Rehearsal } from "@/lib/types";
import { useSignedIn } from "./PortalProvider";

const SEAT_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export function DateBadge({ id }: { id: string }) {
  return (
    <div className="datebadge">
      <small>{fmt(id, { month: "short" })}</small>
      <b>{fmt(id, { day: "numeric" })}</b>
      <small>{fmt(id, { weekday: "short" })}</small>
    </div>
  );
}

export function LegStatus({ d, leg }: { d: Rehearsal; leg: Leg }) {
  const n = d[leg].stillNeed.length;
  if (n) return <span className="tag warn">{n} still need{n === 1 ? "s" : ""} a ride</span>;
  return <span className="tag ok">{d[leg].needing.length ? "Covered" : "No riders"}</span>;
}

export function RehearsalCard({ d }: { d: Rehearsal }) {
  const past = isPast(d.id);
  return (
    <article className={"card rehearsal" + (past ? " past" : "")}>
      <div className="rh-head">
        <DateBadge id={d.id} />
        <div className="rh-title">
          <strong>{longDate(d.id)}</strong>
          {d.flag === "confirm" && <span className="tag warn">Confirm rehearsal</span>}
          {d.flag === "cancelled" && <span className="tag warn">Cancelled</span>}
          {d.note && <div className="muted">{d.note}</div>}
        </div>
      </div>
      <div className="legs">
        <LegBlock d={d} leg="dropoff" past={past} />
        <LegBlock d={d} leg="pickup" past={past} />
      </div>
    </article>
  );
}

function LegBlock({ d, leg, past }: { d: Rehearsal; leg: Leg; past: boolean }) {
  const { S, act, kidName, openProfile } = useSignedIn();
  const [offerSeats, setOfferSeats] = useState(4);
  const L = d[leg];
  const date = d.id;
  const me = L.drivers.find((x) => x.email === S.me.email);
  const canClaim = !!me && !past && me.kids.length < me.seats;

  const drive = () => {
    if (!S.me.name) return openProfile(true);
    act("/rides/drive", { date, leg, seats: offerSeats }, "Thanks! You're signed up to drive.");
  };
  const withdraw = (email: string) => {
    if (window.confirm("Remove this driver? Their kids will go back on the 'still needs a ride' list."))
      act("/rides/withdraw", { date, leg, email }, "Driver removed");
  };

  return (
    <div className="leg">
      <h4>
        {LEG_LABEL[leg]}{" "}
        <span style={{ textTransform: "none", letterSpacing: 0 }}>({leg === "dropoff" ? S.config.dropoffNote : S.config.pickupNote})</span>
      </h4>
      <div className="need-line">
        <b>Still needs a ride:</b>{" "}
        {L.stillNeed.length ? L.stillNeed.map((k) => canClaim ? (
          <button key={k} className="kid need" title="Add to my car"
            onClick={() => act("/rides/claim", { date, leg, kidId: k, add: true }, `${kidName(k)} added to your car`)}>
            + {kidName(k)}
          </button>
        ) : (
          <span key={k} className="kid need">{kidName(k)}</span>
        )) : <span className="muted">Everyone covered</span>}
      </div>

      {L.drivers.map((x) => {
        const mine = x.email === S.me.email;
        const canEdit = (mine || S.me.isAdmin) && !past;
        const p = S.people[x.email] || {};
        return (
          <div key={x.email} className={"driver" + (mine ? " me" : "")}>
            <div className="driver-top">
              <strong>{x.name || p.name || x.email}{mine ? " (you)" : ""}</strong>
              <span className="seats">
                {x.kids.length}/{x.seats} seats
                {p.phone && <> • <a href={`tel:${p.phone}`}>{p.phone}</a></>}
              </span>
            </div>
            <div>
              {x.kids.length ? x.kids.map((k) => (
                <span key={k} className="kid">
                  {kidName(k)}
                  {canEdit && (
                    <button className="x" aria-label={`Remove ${kidName(k)}`}
                      onClick={() => act("/rides/claim", { date, leg, kidId: k, driver: x.email, add: false }, "Removed")}>×</button>
                  )}
                </span>
              )) : <span className="muted" style={{ fontSize: ".88rem" }}>No kids yet</span>}
            </div>
            {canEdit && (
              <div className="drive-form">
                {mine && (
                  <>
                    <select aria-label="Seats" value={x.seats} onChange={(e) => act("/rides/drive", { date, leg, seats: e.target.value }, "Seats updated")}>
                      {SEAT_OPTIONS.map((n) => <option key={n}>{n}</option>)}
                    </select>
                    <span className="seats">seats</span>
                  </>
                )}
                <button className="btn link" onClick={() => withdraw(x.email)}>{mine ? "I can't drive" : "Remove driver"}</button>
              </div>
            )}
          </div>
        );
      })}

      {!me && !past && (
        <div className="drive-form">
          <select aria-label="Seats" value={offerSeats} onChange={(e) => setOfferSeats(Number(e.target.value))}>
            {SEAT_OPTIONS.map((n) => <option key={n}>{n}</option>)}
          </select>
          <button className="btn small gold" onClick={drive}>I can drive ({LEG_LABEL[leg].toLowerCase()})</button>
        </div>
      )}
    </div>
  );
}

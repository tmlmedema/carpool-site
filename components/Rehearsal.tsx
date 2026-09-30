"use client";
// Rehearsal pieces: date badge, status tags, the full rehearsal card, and the upcoming-list row.
import Link from "next/link";
import { useState } from "react";
import { useSignedIn } from "@/lib/client/portal";
import { fmt, isPast, LEG_LABEL, longDate, mapsLink, openSeats, routeLink, SEATS } from "@/lib/client/format";
import type { Driver, Leg, Rehearsal } from "@/lib/types";
import { ProfileForm } from "./ProfileForm";

export function DateBadge({ id }: { id: string }) {
  return (
    <div className="datebadge">
      <small>{fmt(id, { month: "short" })}</small>
      <b>{fmt(id, { day: "numeric" })}</b>
      <small>{fmt(id, { weekday: "short" })}</small>
    </div>
  );
}

export function FlagTag({ flag }: { flag: Rehearsal["flag"] }) {
  if (flag === "confirm") return <span className="tag warn">Confirm rehearsal</span>;
  if (flag === "cancelled") return <span className="tag warn">Cancelled</span>;
  return null;
}

export function LegStatus({ d, leg }: { d: Rehearsal; leg: Leg }) {
  const n = d[leg].stillNeed.length;
  if (n) return <span className="tag warn">{n} still need{n === 1 ? "s" : ""} a ride</span>;
  return <span className="tag ok">{d[leg].needing.length ? "Covered" : "No riders"}</span>;
}

export function UpcomingRow({ d }: { d: Rehearsal }) {
  return (
    <Link className="up-row" href={`/schedule?d=${d.id}`} aria-label={`Open ${longDate(d.id)} on the schedule`}>
      <DateBadge id={d.id} />
      <span className="up-main">
        <strong>{longDate(d.id)}</strong>
        <FlagTag flag={d.flag} />
        {d.note && <span className="muted">{d.note}</span>}
      </span>
      <span className="up-status">
        <span>Drop-off <LegStatus d={d} leg="dropoff" /></span>
        <span>Pickup <LegStatus d={d} leg="pickup" /></span>
      </span>
    </Link>
  );
}

export function RehearsalCard({ d, highlight = false }: { d: Rehearsal; highlight?: boolean }) {
  const past = isPast(d.id);
  return (
    <article className={`card rehearsal${past ? " past" : ""}${highlight ? " jump" : ""}`} data-date={d.id} id={`r-${d.id}`}>
      <div className="rh-head">
        <DateBadge id={d.id} />
        <div className="rh-title">
          <strong>{longDate(d.id)}</strong>
          <FlagTag flag={d.flag} />
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
  const { S, act, confirm, showDialog } = useSignedIn();
  const [offerSeats, setOfferSeats] = useState(4);
  const L = d[leg];
  const kidName = (id: string) => S.config.kids.find((k) => k.id === id)?.name || id;
  const me = L.drivers.find((x) => x.email === S.me.email);
  const manages = (x: Driver) => x.email === S.me.email || x.addedBy === S.me.email || S.me.isAdmin;
  // Tapping a name puts the child in your car, or else in a car you manage, if it has room.
  const target = [me, ...L.drivers.filter((x) => x !== me && manages(x))].find((x): x is Driver => !!x && x.kids.length < x.seats);
  const open = openSeats(L.drivers);
  const short = L.stillNeed.length - open;
  const note = leg === "dropoff" ? S.config.dropoffNote : S.config.pickupNote;

  const drive = () => {
    if (!S.me.name) return showDialog((close) => <ProfileForm first onDone={close} />);
    act("/rides/drive", { date: d.id, leg, seats: offerSeats }, "Thanks! You're signed up to drive.");
  };

  return (
    <div className="leg">
      <h4>{LEG_LABEL[leg]} <span>({note})</span></h4>
      <div className="need-line">
        <b>Still needs a ride:</b>{" "}
        {L.stillNeed.length ? L.stillNeed.map((k) => target && !past ? (
          <button key={k} className="kid need" title={`Add to ${target === me ? "my car" : `${target.name}'s car`}`}
            onClick={() => act("/rides/claim", { date: d.id, leg, kidId: k, driver: target.email, add: true }, `${kidName(k)} added`)}>
            + {kidName(k)}
          </button>
        ) : <span key={k} className="kid need">{kidName(k)}</span>) : <span className="muted">Everyone covered</span>}
      </div>

      {!past && L.stillNeed.length > 0 && (short > 0 ? (
        <div className="leg-alert">
          {L.drivers.length ? "Another driver needed" : "Driver needed"}: {L.stillNeed.length} {L.stillNeed.length === 1 ? "child still needs" : "kids still need"} a ride
          {L.drivers.length ? (open ? ` and there ${open === 1 ? "is" : "are"} only ${open} open seat${open === 1 ? "" : "s"}` : " and every car is full") : ""}.
        </div>
      ) : (
        <div className="leg-note">{open} open seat{open === 1 ? "" : "s"}. Drivers, tap a name to add that child to a car.</div>
      ))}

      {L.drivers.map((x) => {
        const mine = x.email === S.me.email;
        const canEdit = manages(x) && !past;
        const p = S.people[x.email];
        const phone = p?.phone || x.phone || "";
        return (
          <div key={x.email} className={`driver${mine ? " me" : ""}`}>
            <div className="driver-top">
              <strong>
                {x.name || p?.name || "Driver"}
                {mine ? " (you)" : x.addedBy === S.me.email ? <span className="added-by">added by you</span> : null}
              </strong>
              <span className="seats">{x.kids.length}/{x.seats} seats{phone ? ` • ${phone}` : ""}</span>
            </div>
            <div>
              {x.kids.length ? x.kids.map((k) => (
                <span key={k} className="kid">
                  {kidName(k)}
                  {canEdit && <button className="x" aria-label={`Remove ${kidName(k)}`} onClick={() => act("/rides/claim", { date: d.id, leg, kidId: k, driver: x.email, add: false }, "Removed")}>×</button>}
                </span>
              )) : <span className="muted" style={{ fontSize: ".88rem" }}>No kids yet</span>}
            </div>
            {canEdit && (
              <div className="drive-form">
                <select aria-label="Seats" value={x.seats} onChange={(e) => act("/rides/drive", { date: d.id, leg, driver: x.email, seats: Number(e.target.value) }, "Seats updated")}>
                  {SEATS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="seats">seats</span>
                <button className="btn link" onClick={async () => {
                  if (await confirm("Remove this driver?", 'Any kids in this car go back on the "still needs a ride" list.', "Remove driver"))
                    act("/rides/withdraw", { date: d.id, leg, email: x.email }, "Driver removed");
                }}>{mine ? "I can't drive" : "Remove driver"}</button>
              </div>
            )}
            {manages(x) && x.kids.length > 0 && (
              <button className="btn small ghost addr-btn" onClick={() => showDialog((close) => <AddressesDialog d={d} leg={leg} car={x} close={close} />)}>
                Addresses &amp; contacts
              </button>
            )}
          </div>
        );
      })}

      {!past && (!me || S.me.isAdmin) && (
        <div className="drive-form leg-actions">
          {!me && (
            <>
              <select aria-label="Seats" value={offerSeats} onChange={(e) => setOfferSeats(Number(e.target.value))}>
                {SEATS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button className={`btn small ${short > 0 || !L.drivers.length ? "gold" : "ghost"}`} onClick={drive}>I can drive</button>
            </>
          )}
          {S.me.isAdmin && (
            <button className={`btn small ${me && short > 0 ? "gold" : "ghost"}`} onClick={() => showDialog((close) => <AddDriverForm date={d.id} leg={leg} close={close} />)}>
              + Add another driver
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddDriverForm({ date, leg, close }: { date: string; leg: Leg; close: () => void }) {
  const { act } = useSignedIn();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [seats, setSeats] = useState(4);
  return (
    <form onSubmit={(e) => { e.preventDefault(); close(); act("/rides/add-driver", { date, leg, name, phone, seats }, "Driver added. Tap a name to put a child in their car."); }}>
      <h2>Add another driver</h2>
      <p className="muted">{LEG_LABEL[leg]} on {longDate(date)}. Use this for a parent who offered to drive but isn&apos;t signing up themselves.</p>
      <div className="field"><label htmlFor="ad-name">Driver&apos;s name</label><input id="ad-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <div className="field"><label htmlFor="ad-phone">Phone (optional)</label><input id="ad-phone" type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="field"><label htmlFor="ad-seats">Seats for kids</label>
        <select id="ad-seats" style={{ width: "auto" }} value={seats} onChange={(e) => setSeats(Number(e.target.value))}>{SEATS.map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </div>
      <div className="row"><button className="btn gold" type="submit">Add driver</button><button className="btn ghost" type="button" onClick={close}>Cancel</button></div>
    </form>
  );
}

function AddressesDialog({ d, leg, car, close }: { d: Rehearsal; leg: Leg; car: Driver; close: () => void }) {
  const { S } = useSignedIn();
  const kidName = (id: string) => S.config.kids.find((k) => k.id === id)?.name || id;
  const addrs = car.kids.map((k) => S.kidInfo[k]?.address).filter((a): a is string => !!a);
  const route = routeLink(addrs);
  return (
    <div>
      <h2>Addresses &amp; contacts</h2>
      <p className="muted">{car.name}&apos;s car • {LEG_LABEL[leg]} on {longDate(d.id)}</p>
      <ul className="addr-list">
        {car.kids.map((k) => {
          const info = S.kidInfo[k] || { address: "", notes: "", parents: [] };
          const parents = info.parents.filter((p) => p.name || p.phone);
          return (
            <li key={k} className="addr-item">
              <strong>{kidName(k)}</strong>
              {info.address
                ? <><span className="addr">{info.address}</span><a href={mapsLink(info.address)} target="_blank" rel="noopener">Open in Maps</a></>
                : <span className="muted">No address yet. Ask the family to add it under My Child&apos;s Rides.</span>}
              {info.notes && <span className="muted">Note: {info.notes}</span>}
              {parents.length > 0 && <span className="muted">Parent: {parents.map((p) => [p.name, p.phone].filter(Boolean).join(" · ")).join("; ")}</span>}
            </li>
          );
        })}
      </ul>
      <div className="row">
        {route && <a className="btn gold" href={route} target="_blank" rel="noopener">Route all stops in Maps</a>}
        <button className="btn ghost" onClick={close}>Close</button>
      </div>
    </div>
  );
}

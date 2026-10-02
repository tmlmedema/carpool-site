"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, usePortal } from "@/lib/client/portal";

export function ProfileForm({ first = false, onDone }: { first?: boolean; onDone: () => void }) {
  const { S, refresh, toast } = usePortal();
  const [name, setName] = useState(S?.me.name || "");
  const [phone, setPhone] = useState(S?.me.phone || "");
  const router = useRouter();
  // First sign-in for a parent: after saving, go set up their child's rides or skip it.
  const offerRides = first && !!S?.me.kids.length;
  const [setUpRides, setSetUpRides] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/profile", { name, phone });
          onDone();
          await refresh();
          toast("Saved");
          if (setUpRides) router.push("/my-child");
        } catch (err) { toast((err as Error).message, true); }
      }}
    >
      <h2>{first ? "Welcome! Tell us who you are" : "My info"}</h2>
      <p className="muted">Other parents see your name and phone when you sign up to drive.</p>
      <div className="field"><label htmlFor="pf-name">Your name</label><input id="pf-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <div className="field"><label htmlFor="pf-phone">Mobile phone (optional)</label><input id="pf-phone" type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="row">
        {offerRides ? (
          <>
            <button className="btn gold" type="submit" onClick={() => setSetUpRides(true)}>Set up my child&apos;s rides</button>
            <button className="btn ghost" type="submit" onClick={() => setSetUpRides(false)}>Skip for now</button>
          </>
        ) : <button className="btn gold" type="submit">Save</button>}
        {!first && <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>}
      </div>
    </form>
  );
}

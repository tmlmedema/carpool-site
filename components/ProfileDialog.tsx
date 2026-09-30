"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  first: boolean;
  me: { name: string; phone: string };
  onSave: (name: string, phone: string) => Promise<boolean>;
  onClose: () => void;
}

export function ProfileDialog({ first, me, onSave, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone);

  useEffect(() => { ref.current?.showModal(); }, []);

  return (
    <dialog ref={ref} onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (await onSave(name, phone)) ref.current?.close();
      }}>
        <h2>{first ? "Welcome! Tell us who you are" : "My info"}</h2>
        <p className="muted">Other parents see your name and phone when you sign up to drive.</p>
        <div className="field">
          <label htmlFor="pf-name">Your name</label>
          <input id="pf-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pf-phone">Mobile phone (optional)</label>
          <input id="pf-phone" type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn gold" type="submit">Save</button>
          {!first && <button className="btn ghost" type="button" onClick={() => ref.current?.close()}>Cancel</button>}
        </div>
      </form>
    </dialog>
  );
}

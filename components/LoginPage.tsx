"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { HeroArt } from "./HeroArt";

const LOGIN_MESSAGES: Record<string, string> = {
  expired: "That sign-in link has expired. Request a new one below.",
  used: "That sign-in link was already used. Request a new one below.",
  denied: "That email isn't on the parent list. Ask the carpool coordinator to add you.",
};

export function LoginPage() {
  // Set by /api/verify when a magic link fails. Only rendered client-side, after the state fetch.
  const [linkMsg] = useState(() => LOGIN_MESSAGES[new URLSearchParams(location.search).get("login") ?? ""]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sentTo: string; devLink?: string } | { error: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ devLink?: string }>("/login", { email });
      setResult({ sentTo: email, devLink: r.devLink });
    } catch (err) {
      setResult({ error: (err as Error).message });
    }
    setBusy(false);
  }

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <div className="eyebrow">Parent Portal</div>
            <h1>4th Grade Band Carpool</h1>
            <p>Sign up to drive, set your child&apos;s ride needs, and see who&apos;s covering each rehearsal.</p>
          </div>
          <HeroArt />
        </div>
      </section>
      <div className="wrap page">
        <div className="card login-card">
          <h2>Parent sign in</h2>
          <p className="muted">Enter the email the coordinator has on file. We&apos;ll email you a one-time sign-in link, no password needed.</p>
          {linkMsg && <div className="notice error">{linkMsg}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn gold" type="submit" disabled={busy}>Email me a sign-in link</button>
          </form>
          {result && "error" in result && <div className="notice error">{result.error}</div>}
          {result && "sentTo" in result && (
            <>
              <div className="notice">
                Check your inbox. If <b>{result.sentTo}</b> is on the parent list, a sign-in link is on its way. It expires in 20 minutes.
              </div>
              {result.devLink && <p className="muted">Local preview: <a href={result.devLink} id="dev-link">open sign-in link</a></p>}
            </>
          )}
        </div>
      </div>
    </>
  );
}

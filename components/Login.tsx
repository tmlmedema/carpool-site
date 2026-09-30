"use client";
import { useState } from "react";
import { api, usePortal } from "@/lib/client/portal";
import HeroTitle from "./HeroTitle";

const LOGIN_MESSAGES: Record<string, string> = {
  expired: "That sign-in link has expired. Request a new one below.",
  used: "That sign-in link was already used. Request a new one below.",
  denied: "That email isn't on the parent list. Ask the carpool coordinator to add you.",
};

interface LoginResult { ok: boolean; devLink?: string }

export default function Login() {
  const { refresh } = usePortal();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [result, setResult] = useState<LoginResult | null>(null);
  const [err, setErr] = useState("");
  // Messages from /api/verify redirects (?login=expired etc.). Login only renders in the browser.
  const [linkMsg] = useState(() => {
    const q = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("login");
    return (q && LOGIN_MESSAGES[q]) || "";
  });

  return (
    <>
      <section className="hero hero-login">
        <div className="wrap">
          <HeroTitle school="Park View Elementary School" title="4th Grade Band Carpool" />
          <p className="hero-copy">Sign up to drive, set your child&apos;s ride needs, and see who&apos;s covering each rehearsal.</p>
        </div>
      </section>
      <div className="wrap page">
        <div className="card login-card">
          <h2>Parent sign in</h2>
          <p className="muted">Enter the email the coordinator has on file. We&apos;ll email you a one-time sign-in link, no password needed.</p>
          {linkMsg && <div className="notice error">{linkMsg}</div>}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true); setErr(""); setResult(null);
              try {
                const r = await api<LoginResult>("/login", { email });
                setSentTo(email); setResult(r);
              } catch (ex) { setErr((ex as Error).message); }
              setBusy(false);
            }}
          >
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn gold" type="submit" disabled={busy}>Email me a sign-in link</button>
          </form>
          {err && <div className="notice error">{err}</div>}
          {result && (
            <>
              <div className="notice">Check your inbox. A sign-in link is on its way to <b>{sentTo}</b>. It expires in 20 minutes.</div>
              {result.devLink && (
                <p className="muted">
                  Local preview:{" "}
                  <a
                    href={result.devLink}
                    id="dev-link"
                    onClick={async (e) => {
                      e.preventDefault();
                      await fetch(result.devLink!, { credentials: "same-origin" });
                      window.history.replaceState(null, "", window.location.pathname);
                      refresh();
                    }}
                  >open sign-in link</a>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

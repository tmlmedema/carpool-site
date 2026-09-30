"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePortal } from "./PortalProvider";
import { LoginPage } from "./LoginPage";

// Shown before sign-in, when the site config isn't loaded yet.
const DEFAULTS = {
  title: "4th Grade Band Carpool",
  school: "Glenn Westlake Middle School",
  rehearsal: "Rehearsal 4:00–5:00 PM",
  dropoffNote: "Arrive no earlier than 3:45 PM",
  pickupNote: "Pick up by 5:15 PM",
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Carpool Schedule" },
  { href: "/my-child", label: "My Child's Rides" },
  { href: "/dates", label: "Important Dates" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { S, status, error, openProfile, signOut } = usePortal();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const c = S?.config ?? DEFAULTS;
  const nav = S?.me.isAdmin ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;

  useEffect(() => { document.title = c.title; }, [c.title]);

  return (
    <>
      <div className="topbar">
        <div className="wrap topbar-inner">
          <span>{c.school}</span>
          <span>
            {S && (
              <>
                Signed in as {S.me.name || S.me.email}{" "}
                <button onClick={() => openProfile()}>My info</button>
                <button onClick={signOut}>Sign out</button>
              </>
            )}
          </span>
        </div>
      </div>

      <header className="site-header">
        <div className="wrap header-inner">
          <Link href="/" className="brand">
            <img src="/logo.svg" alt="" width={64} height={64} />
            <span>
              <strong>{c.title}</strong>
              <small>Parent Portal</small>
            </span>
          </Link>
          <button className="menu-btn" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </div>
        <nav className={"main-nav" + (menuOpen ? " open" : "")} hidden={!S}>
          <div className="wrap">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={pathname === n.href ? "active" : ""} onClick={() => setMenuOpen(false)}>
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main id="app" aria-live="polite">
        {status === "loading" && <div className="wrap loading">Loading…</div>}
        {status === "signedOut" && <LoginPage />}
        {status === "error" && <div className="wrap page"><div className="notice error">{error}</div></div>}
        {status === "ready" && children}
      </main>

      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <img src="/logo.svg" alt="" width={48} height={48} />
            <p><strong>{c.title}</strong><br />{c.school}</p>
          </div>
          <div>
            <h4>Rehearsal</h4>
            <p>{c.rehearsal}<br />{c.dropoffNote}<br />{c.pickupNote}</p>
          </div>
          <div>
            <h4>Quick Links</h4>
            <p>
              <Link href="/schedule">Carpool Schedule</Link><br />
              <Link href="/my-child">My Child&apos;s Rides</Link><br />
              <Link href="/dates">Important Dates</Link>
            </p>
          </div>
        </div>
        <div className="wrap footer-note">Private parent portal. Please don&apos;t share kids&apos; names or contact info outside the group.</div>
      </footer>
    </>
  );
}

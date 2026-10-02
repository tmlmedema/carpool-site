"use client";
// Header, footer and the sign-in gate around every page.
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePortal } from "@/lib/client/portal";
import { initials } from "@/lib/client/format";
import Login from "./Login";
import { ProfileForm } from "./ProfileForm";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Carpool Schedule" },
  { href: "/my-child", label: "My Child's Schedule" },
  { href: "/dates", label: "Important Dates" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const { S, status, error, showDialog } = usePortal();
  const signedIn = status === "ready" && !!S;
  const c = S?.config;

  useEffect(() => { document.body.classList.toggle("signed-out", status === "signedOut"); }, [status]);
  useEffect(() => { if (c?.title) document.title = c.title; }, [c?.title]);

  // First sign-in: ask for the parent's name.
  const asked = useRef(false);
  useEffect(() => {
    if (signedIn && !S.me.name && !asked.current) {
      asked.current = true;
      showDialog((close) => <ProfileForm first onDone={close} />);
    }
  }, [signedIn, S, showDialog]);

  return (
    <>
      <Header />
      <main aria-live="polite">
        {status === "loading" && <div className="wrap loading">Loading…</div>}
        {status === "error" && <div className="wrap page"><div className="notice error">{error}</div></div>}
        {status === "signedOut" && <Login />}
        {signedIn && children}
      </main>
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <Image src="/logo.svg" alt="" width={48} height={48} unoptimized />
            <p><strong>{c?.title || "4th Grade Band Carpool"}</strong><br />{c?.school || "Park View Elementary School"}</p>
          </div>
          <div>
            <h4>Rehearsal</h4>
            <p>
              {(c ? [c.location, c.rehearsal, c.dropoffNote, c.pickupNote] : ["Glenn Westlake Middle School", "Rehearsal 4:00–5:00 PM", "Arrive no earlier than 3:45 PM", "Pick up by 5:15 PM"])
                .filter(Boolean).map((line, i) => <span key={i}>{line}<br /></span>)}
            </p>
          </div>
          <div>
            <h4>Quick Links</h4>
            <p>{NAV.slice(1).map((n) => <span key={n.href}><Link href={n.href}>{n.label}</Link><br /></span>)}</p>
          </div>
        </div>
        <div className="wrap footer-note">Private parent portal. Please don&apos;t share kids&apos; names or contact info outside the group.</div>
      </footer>
    </>
  );
}

function Header() {
  const { S, status } = usePortal();
  const signedIn = status === "ready" && !!S;
  const pathname = usePathname();
  // The phone menu belongs to the page it was opened on, so it closes on navigation.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuOpen = menuFor === pathname;
  const setMenuOpen = (open: boolean | ((o: boolean) => boolean)) =>
    setMenuFor((cur) => ((typeof open === "function" ? open(cur === pathname) : open) ? pathname : null));

  // Lock page scroll while the menu is open; Esc closes it.
  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuFor(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const school = S?.config.school.replace(/ School$/, "") || "Park View Elementary";
  const links = S?.me.isAdmin ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link href="/" className="brand">
          <Image src="/logo.svg" alt="" width={44} height={44} unoptimized priority />
          <span>
            <small>{school}</small>
            <strong>{S?.config.title || "4th Grade Band Carpool"}</strong>
          </span>
        </Link>
        {signedIn && <AccountMenu />}
        {signedIn && (
          <button className="menu-btn" aria-label={menuOpen ? "Close menu" : "Menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? "✕" : "☰"}
          </button>
        )}
        {signedIn && (
          <nav className={`main-nav${menuOpen ? " open" : ""}`} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setMenuOpen(false); }}>
            {links.map((n) => (
              <Link key={n.href} href={n.href} className={pathname === n.href ? "active" : ""}>{n.label}</Link>
            ))}
            <Link href="/schedule?f=mine" className="btn gold nav-cta">My rides</Link>
          </nav>
        )}
      </div>
    </header>
  );
}

function AccountMenu() {
  const { S, signOut, showDialog } = usePortal();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const onClick = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!S) return null;
  const who = S.me.name || S.me.email;
  return (
    <div className="account" ref={box}>
      <button className="avatar" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${who}`} onClick={() => setOpen((o) => !o)}>
        {initials(who)}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-who"><strong>{S.me.name || "Add your name"}</strong><span>{S.me.email}</span></div>
          <button role="menuitem" ref={firstItem} onClick={() => { setOpen(false); showDialog((close) => <ProfileForm onDone={close} />); }}>My info</button>
          <button role="menuitem" onClick={() => { setOpen(false); signOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

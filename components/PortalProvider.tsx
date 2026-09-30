"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client-api";
import type { PortalState } from "@/lib/types";
import { ProfileDialog } from "./ProfileDialog";

type Status = "loading" | "ready" | "signedOut" | "error";

interface PortalContext {
  S: PortalState | null;
  status: Status;
  error: string;
  /** Bumps on every successful state load; use as a `key` to reset forms. */
  version: number;
  act: (path: string, body: unknown, okMsg?: string) => Promise<boolean>;
  toast: (msg: string, isError?: boolean) => void;
  openProfile: (first?: boolean) => void;
  signOut: () => Promise<void>;
  showPast: boolean;
  setShowPast: (v: boolean) => void;
}

const Ctx = createContext<PortalContext | null>(null);

export function usePortal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortal must be used inside <PortalProvider>");
  return ctx;
}

/** For pages that only render once signed in (the Shell gates them). */
export function useSignedIn() {
  const ctx = usePortal();
  if (!ctx.S) throw new Error("useSignedIn called before state loaded");
  const S = ctx.S;
  const kidName = (id: string) => S.config.kids.find((k) => k.id === id)?.name || id;
  return { ...ctx, S, kidName };
}

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [S, setS] = useState<PortalState | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [showPast, setShowPast] = useState(false);
  const [profile, setProfile] = useState<{ first: boolean } | null>(null);
  const [toastState, setToastState] = useState<{ msg: string; isError: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((msg: string, isError = false) => {
    setToastState({ msg, isError });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    const next = await api<PortalState>("/state");
    setS(next);
    setStatus("ready");
    setVersion((v) => v + 1);
    return next;
  }, []);

  const boot = useCallback(async () => {
    try {
      const next = await refresh();
      if (location.search.includes("login=")) history.replaceState(null, "", location.pathname);
      if (!next.me.name) setProfile({ first: true });
    } catch (e) {
      setS(null);
      if (e instanceof ApiError && e.status === 401) setStatus("signedOut");
      else { setError((e as Error).message); setStatus("error"); }
    }
  }, [refresh]);

  useEffect(() => { boot(); }, [boot]);

  const act = useCallback(async (path: string, body: unknown, okMsg?: string) => {
    try {
      await api(path, body);
      await refresh();
      if (okMsg) toast(okMsg);
      return true;
    } catch (e) {
      toast((e as Error).message, true);
      if (e instanceof ApiError && e.status === 401) boot();
      return false;
    }
  }, [refresh, toast, boot]);

  const signOut = useCallback(async () => {
    await api("/logout", {});
    setS(null);
    setStatus("signedOut");
    router.push("/");
  }, [router]);

  const saveProfile = async (name: string, phone: string) => {
    try {
      await api("/profile", { name, phone });
      await refresh();
      toast("Saved");
      return true;
    } catch (e) {
      toast((e as Error).message, true);
      return false;
    }
  };

  return (
    <Ctx.Provider value={{
      S, status, error, version, act, toast, signOut, showPast, setShowPast,
      openProfile: (first = false) => setProfile({ first }),
    }}>
      {children}
      <div className={"toast" + (toastState?.isError ? " error" : "")} role="status" hidden={!toastState}>{toastState?.msg}</div>
      {profile && S && (
        <ProfileDialog first={profile.first} me={S.me} onSave={saveProfile} onClose={() => setProfile(null)} />
      )}
    </Ctx.Provider>
  );
}

"use client";
// App-wide state: who is signed in, the carpool data, and shared UI (toasts, dialogs).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { PortalState } from "../types";

type Status = "loading" | "signedOut" | "ready" | "error";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, body === undefined
    ? { credentials: "same-origin", cache: "no-store" }
    : { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || "Something went wrong.", res.status);
  return data as T;
}

interface Toast { msg: string; error: boolean; id: number }
type DialogRender = (close: () => void) => ReactNode;

interface PortalCtx {
  S: PortalState | null;
  status: Status;
  error: string;
  refresh: () => Promise<void>;
  /** Run an action, reload the data, and show a toast. Resolves true on success. */
  act: (path: string, body: unknown, okMsg?: string) => Promise<boolean>;
  toast: (msg: string, error?: boolean) => void;
  showDialog: (render: DialogRender) => void;
  closeDialog: () => void;
  confirm: (title: string, text: string, okLabel: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<PortalCtx | null>(null);
export const usePortal = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePortal must be used inside <PortalProvider>");
  return c;
};
/** For pages that only render when signed in. */
export const useSignedIn = () => {
  const c = usePortal();
  return { ...c, S: c.S as PortalState };
};

export function PortalProvider({ children }: { children: ReactNode }) {
  const [S, setS] = useState<PortalState | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [toastState, setToast] = useState<Toast | null>(null);
  const [dialog, setDialog] = useState<DialogRender | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setS(await api<PortalState>("/state"));
      setStatus("ready");
    } catch (e) {
      setS(null);
      if (e instanceof ApiError && e.status === 401) setStatus("signedOut");
      else { setError((e as Error).message); setStatus("error"); }
    }
  }, []);

  // Initial load (state updates happen in the promise callbacks).
  useEffect(() => {
    let alive = true;
    api<PortalState>("/state").then(
      (data) => { if (alive) { setS(data); setStatus("ready"); } },
      (e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) setStatus("signedOut");
        else { setError((e as Error).message); setStatus("error"); }
      },
    );
    return () => { alive = false; };
  }, []);

  const toast = useCallback((msg: string, err = false) => {
    setToast({ msg, error: err, id: Date.now() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const act = useCallback(async (path: string, body: unknown, okMsg?: string) => {
    try {
      await api(path, body);
      await refresh();
      if (okMsg) toast(okMsg);
      return true;
    } catch (e) {
      toast((e as Error).message, true);
      if (e instanceof ApiError && e.status === 401) refresh();
      return false;
    }
  }, [refresh, toast]);

  const closeDialog = useCallback(() => setDialog(null), []);
  const showDialog = useCallback((render: DialogRender) => setDialog(() => render), []);

  const confirm = useCallback((title: string, text: string, okLabel: string) => new Promise<boolean>((resolve) => {
    showDialog((close) => (
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); close(); resolve(true); }}>
        <h2>{title}</h2>
        <p className="muted">{text}</p>
        <div className="row">
          <button className="btn gold" type="submit">{okLabel}</button>
          <button className="btn ghost" type="button" onClick={() => { close(); resolve(false); }}>Cancel</button>
        </div>
      </form>
    ));
  }), [showDialog]);

  const signOut = useCallback(async () => {
    await api("/logout", {});
    setS(null);
    setStatus("signedOut");
  }, []);

  return (
    <Ctx.Provider value={{ S, status, error, refresh, act, toast, showDialog, closeDialog, confirm, signOut }}>
      {children}
      <Modal open={!!dialog} onClose={closeDialog}>{dialog?.(closeDialog)}</Modal>
      {toastState && <div className={`toast${toastState.error ? " error" : ""}`} role="status" key={toastState.id}>{toastState.msg}</div>}
    </Ctx.Provider>
  );
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return <dialog ref={ref} onClose={onClose}>{open ? children : null}</dialog>;
}

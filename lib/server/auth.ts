// Magic-link and session tokens, signed with HMAC-SHA256 (no auth library needed).
import "server-only";
import crypto from "node:crypto";

const LINK_TTL_MS = 20 * 60 * 1000; // sign-in links expire after 20 minutes
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // stay signed in for 60 days
export const COOKIE = "carpool_session";

function secret(): string {
  const s = process.env.SESSION_SECRET || (process.env.NODE_ENV !== "production" ? "local-dev-secret-local-dev-secret-123456" : "");
  if (s.length < 32) throw new Error("SESSION_SECRET must be set (32+ random characters).");
  return s;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (data: string) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");

interface Payload { k: "link" | "sess"; e: string; n?: string; exp: number }

function makeToken(p: Payload): string {
  const body = b64(JSON.stringify(p));
  return `${body}.${sign(body)}`;
}

function readToken(token: string | null | undefined, kind: Payload["k"]): Payload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = sign(body);
  if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    if (p.k !== kind || typeof p.exp !== "number" || Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}

export const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();

export const makeLinkToken = (email: string) =>
  makeToken({ k: "link", e: normEmail(email), n: crypto.randomBytes(12).toString("hex"), exp: Date.now() + LINK_TTL_MS });
export const readLinkToken = (t: string | null) => readToken(t, "link");

const secureFlag = () => (process.env.NODE_ENV === "production" ? "; Secure" : "");

export function makeSessionCookie(email: string): string {
  const token = makeToken({ k: "sess", e: normEmail(email), exp: Date.now() + SESSION_TTL_MS });
  return `${COOKIE}=${token}; Path=/; HttpOnly${secureFlag()}; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
}
export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly${secureFlag()}; SameSite=Lax; Max-Age=0`;

export function sessionEmail(req: Request): string | null {
  const raw = req.headers.get("cookie") || "";
  const m = raw.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!m) return null;
  const p = readToken(m.slice(COOKIE.length + 1), "sess");
  return p ? p.e : null;
}

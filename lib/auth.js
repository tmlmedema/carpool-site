// Magic-link + session tokens, signed with HMAC-SHA256 (no external libraries).
import crypto from "node:crypto";

const LINK_TTL_MS = 20 * 60 * 1000;            // magic links expire after 20 minutes
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // stay signed in for 60 days
export const COOKIE = "carpool_session";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET env var must be set (32+ random characters)");
  return s;
}

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");

function makeToken(payload) {
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function readToken(token, kind) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (p.k !== kind || typeof p.exp !== "number" || Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}

export const normEmail = (e) => String(e || "").trim().toLowerCase();

export function makeLinkToken(email) {
  return makeToken({ k: "link", e: normEmail(email), n: crypto.randomBytes(12).toString("hex"), exp: Date.now() + LINK_TTL_MS });
}
export const readLinkToken = (t) => readToken(t, "link");

// Local dev runs on plain http, where some browsers (Safari) drop Secure cookies.
const secure = () => (process.env.NODE_ENV === "production" ? "; Secure" : "");

export function makeSessionCookie(email) {
  const token = makeToken({ k: "sess", e: normEmail(email), exp: Date.now() + SESSION_TTL_MS });
  return `${COOKIE}=${token}; Path=/; HttpOnly${secure()}; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
}
export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly${secure()}; SameSite=Lax; Max-Age=0`;

export function sessionEmail(req) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!m) return null;
  const p = readToken(m.slice(COOKIE.length + 1), "sess");
  return p ? p.e : null;
}

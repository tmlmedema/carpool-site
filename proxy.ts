import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { MAINTENANCE_HTML } from "@/lib/maintenance";

// Maintenance mode: set MAINTENANCE_MODE=1 to close the site. Pages show the maintenance page and the API refuses
// requests, both with 503 so browsers and crawlers know it's temporary.
//
// Bypass: set MAINTENANCE_BYPASS to a long secret, then visit any page with ?bypass=<secret>. That browser gets a
// cookie that lets it see the site for a week. Changing the secret locks those browsers out again.
const BYPASS_COOKIE = "carpool_maint_bypass";
const BYPASS_TTL_S = 7 * 24 * 60 * 60;

// The cookie holds a hash of the secret, not the secret itself.
const hash = (s: string) => crypto.createHash("sha256").update(`maintenance-bypass:${s}`).digest("base64url");
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function proxy(request: NextRequest) {
  if (!["1", "true", "on"].includes((process.env.MAINTENANCE_MODE || "").toLowerCase())) return NextResponse.next();

  const secret = process.env.MAINTENANCE_BYPASS || "";
  if (secret) {
    const url = request.nextUrl;
    const given = url.searchParams.get("bypass");
    if (given !== null && same(given, secret)) {
      // Set the cookie and redirect to the same page without the secret in the address bar.
      url.searchParams.delete("bypass");
      const res = NextResponse.redirect(url);
      res.cookies.set(BYPASS_COOKIE, hash(secret), {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: BYPASS_TTL_S,
      });
      return res;
    }
    const cookie = request.cookies.get(BYPASS_COOKIE)?.value;
    if (cookie && same(cookie, hash(secret))) return NextResponse.next();
  }

  const headers = { "Cache-Control": "no-store", "Retry-After": "3600" };
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "The carpool site is down for maintenance. Please try again later." }, { status: 503, headers });
  }
  return new NextResponse(MAINTENANCE_HTML, { status: 503, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}

export const config = {
  // Everything except Next's build assets and the logo the maintenance page uses.
  matcher: ["/((?!_next/static|_next/image|logo.svg).*)"],
};

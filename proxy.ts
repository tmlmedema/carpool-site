import { NextResponse, type NextRequest } from "next/server";
import { MAINTENANCE_HTML } from "@/lib/maintenance";

// Maintenance mode: set MAINTENANCE_MODE=1 to close the site. Pages show the maintenance page and the API refuses
// requests, both with 503 so browsers and crawlers know it's temporary.
export function proxy(request: NextRequest) {
  if (!["1", "true", "on"].includes((process.env.MAINTENANCE_MODE || "").toLowerCase())) return NextResponse.next();

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

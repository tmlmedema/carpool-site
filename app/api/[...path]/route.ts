// Every /api/* request (login, rides, admin, ...) is handled by lib/server/api.ts.
import { handle } from "@/lib/server/api";

async function handler(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export { handler as GET, handler as POST };

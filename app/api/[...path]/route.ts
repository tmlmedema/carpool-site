// Every /api/* request goes through the router in lib/api.js.
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

async function route(req: Request): Promise<Response> {
  try {
    return await handle(req);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export { route as GET, route as POST };

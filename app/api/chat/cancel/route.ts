import { guard } from "@/lib/auth";
import { errorMessage, getClient, NO_KEY_MESSAGE } from "@/lib/chatServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  let id = "";
  try {
    id = (await req.json())?.id || "";
  } catch {
    /* gol */
  }
  if (!/^resp_[A-Za-z0-9_-]+$/.test(id)) return Response.json({ error: "Id invalid." }, { status: 400 });
  const client = getClient();
  if (!client) return Response.json({ error: NO_KEY_MESSAGE }, { status: 500 });
  try {
    await client.responses.cancel(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e) });
  }
}

import { guard } from "@/lib/auth";
import { errorMessage, eventForResponse, getClient, NO_KEY_MESSAGE } from "@/lib/chatServer";
import { defaultEffort, defaultModel } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fallback fără stream: întoarce {pending:true} sau evenimentul final (done/error). */
export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  if (!/^resp_[A-Za-z0-9_-]+$/.test(id)) return Response.json({ error: "Id invalid." }, { status: 400 });
  const model = defaultModel(url.searchParams.get("model") || undefined);
  const effort = defaultEffort(url.searchParams.get("effort") || undefined);
  const client = getClient();
  if (!client) return Response.json({ error: NO_KEY_MESSAGE }, { status: 500 });
  try {
    const r = await client.responses.retrieve(id, { include: ["file_search_call.results"] });
    const ev = await eventForResponse(client, r, model, effort);
    return Response.json(ev ?? { pending: true, status: r.status });
  } catch (e) {
    return Response.json({ type: "error", message: errorMessage(e) });
  }
}

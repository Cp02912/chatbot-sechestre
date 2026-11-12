import OpenAI from "openai";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { getConfig } from "@/lib/config";
import { authEnabled, guard } from "@/lib/auth";
import { NO_KEY_MESSAGE, errorMessage, getClient } from "@/lib/chatServer";
import { isEffort, isModelId } from "@/lib/models";
import type { Filters } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function buildFilters(f?: Filters) {
  const parts: Array<Record<string, unknown>> = [];
  if (f?.from && DATE_RE.test(f.from)) {
    parts.push({ type: "gte", key: "data_ts", value: Math.floor(Date.parse(f.from + "T00:00:00Z") / 1000) });
  }
  if (f?.to && DATE_RE.test(f.to)) {
    parts.push({ type: "lte", key: "data_ts", value: Math.floor(Date.parse(f.to + "T23:59:59Z") / 1000) });
  }
  if (f?.materie === "penal" || f?.materie === "civil") {
    parts.push({ type: "eq", key: "materie", value: f.materie });
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return { type: "and", filters: parts };
}

export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  const { model, effort } = getConfig();
  return Response.json({ model, effort, auth: authEnabled() });
}

/** Pornește răspunsul în fundal (background mode) și întoarce imediat id-ul. */
export async function POST(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;

  let body: { message?: string; previousResponseId?: string; filters?: Filters; model?: unknown; effort?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cerere invalidă." }, { status: 400 });
  }
  const message = (body.message || "").trim();
  if (!message) return Response.json({ error: "Mesajul este gol." }, { status: 400 });

  const cfg = getConfig();
  if (body.model !== undefined && !isModelId(body.model)) {
    return Response.json({ error: "Model necunoscut." }, { status: 400 });
  }
  if (body.effort !== undefined && !isEffort(body.effort)) {
    return Response.json({ error: "Nivel de efort necunoscut." }, { status: 400 });
  }
  const model = body.model ?? cfg.model;
  const effort = body.effort ?? cfg.effort;

  const client = getClient();
  if (!client) return Response.json({ error: NO_KEY_MESSAGE }, { status: 500 });

  const filters = buildFilters(body.filters);
  try {
    const resp = await client.responses.create({
      model,
      instructions: SYSTEM_PROMPT,
      input: message,
      previous_response_id: body.previousResponseId || undefined,
      reasoning: { effort },
      tools: [
        {
          type: "file_search",
          vector_store_ids: [cfg.vectorStoreId],
          max_num_results: cfg.maxResults,
          ...(filters ? { filters: filters as never } : {}),
        },
      ],
      include: ["file_search_call.results"],
      background: true,
      store: true,
      stream: false,
    });
    return Response.json({ responseId: resp.id, model, effort });
  } catch (e) {
    const status = e instanceof OpenAI.APIError && e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return Response.json({ error: errorMessage(e) }, { status });
  }
}

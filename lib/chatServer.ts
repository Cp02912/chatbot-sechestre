import OpenAI from "openai";
import { getApiKey } from "@/lib/config";
import { getDocMetaMany, type DocMeta } from "@/lib/docIndex";
import { computeCost, getModel } from "@/lib/models";
import type { Marker, Source, StreamEvent, Usage } from "@/lib/types";

export function getClient(): OpenAI | null {
  const apiKey = getApiKey();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

export const NO_KEY_MESSAGE =
  "Lipsește cheia OpenAI. Setează OPENAI_API_KEY în .env.local (sau în Netlify) ori OPENAI_KEY în ../script.env.";

export function errorMessage(e: unknown): string {
  if (e instanceof OpenAI.APIError) {
    const inner = (e.error as { message?: string } | undefined)?.message;
    const msg = typeof inner === "string" && inner ? inner : e.message;
    return `Eroare OpenAI${e.status ? ` (${e.status})` : ""}: ${msg}`;
  }
  const m = e instanceof Error ? e.message : String(e);
  return `A apărut o eroare: ${m}`;
}

type Annot = { type: string; file_id?: string; filename?: string; index?: number };
type SearchResult = { file_id?: string; filename?: string; score?: number; text?: string };

/** true dacă răspunsul nu mai poate evolua */
export function isTerminal(r: OpenAI.Responses.Response): boolean {
  return r.status === "completed" || r.status === "failed" || r.status === "cancelled" || r.status === "incomplete";
}

export function failureMessage(r: OpenAI.Responses.Response): string {
  switch (r.status) {
    case "failed":
      return `Eroare OpenAI: ${r.error?.message || "răspunsul a eșuat"}`;
    case "cancelled":
      return "Răspunsul a fost anulat.";
    case "incomplete": {
      const reason = r.incomplete_details?.reason;
      return `Răspuns incomplet${reason ? ` (${reason})` : ""}. Încearcă o întrebare mai restrânsă sau un efort mai mic.`;
    }
    default:
      return "Răspunsul nu s-a finalizat.";
  }
}

/**
 * Transformă un răspuns OpenAI într-un eveniment final: `done` (completed), `error` (failed/cancelled/incomplete)
 * sau null (încă în desfășurare).
 */
export async function eventForResponse(
  client: OpenAI,
  response: OpenAI.Responses.Response,
  model: string,
  effort: string,
): Promise<StreamEvent | null> {
  if (!isTerminal(response)) return null;
  if (response.status !== "completed") return { type: "error", message: failureMessage(response) };

  // rezultatele file_search lipsesc dacă stream-ul nu le-a purtat: le cerem separat
  let resp = response;
  const needResults = (r: OpenAI.Responses.Response) =>
    (r.output || []).some((i) => i.type === "file_search_call" && !i.results);
  if (needResults(resp)) {
    try {
      const full = await client.responses.retrieve(resp.id, { include: ["file_search_call.results"] });
      if (full && full.status === "completed") resp = full;
    } catch {
      /* rămânem cu ce avem */
    }
  }

  let text = "";
  const cites: Array<{ index: number; file_id: string; filename: string }> = [];
  const results: SearchResult[] = [];
  for (const item of resp.output || []) {
    if (item.type === "file_search_call" && item.results) results.push(...item.results);
    if (item.type === "message") {
      for (const part of item.content) {
        if (part.type !== "output_text") continue;
        const offset = text.length;
        for (const a of (part.annotations || []) as Annot[]) {
          if (a.type === "file_citation" && a.file_id) {
            const idx = Math.min(Math.max(a.index ?? part.text.length, 0), part.text.length);
            cites.push({ index: offset + idx, file_id: a.file_id, filename: a.filename || "" });
          }
        }
        text += part.text;
      }
    }
  }

  const order: string[] = [];
  const names: Record<string, string> = {};
  for (const c of cites) {
    if (!order.includes(c.file_id)) {
      order.push(c.file_id);
      names[c.file_id] = c.filename;
    }
  }

  let metas: Record<string, DocMeta> = {};
  if (order.length) {
    try {
      metas = (await getDocMetaMany(order)) || {};
    } catch {
      metas = {};
    }
  }

  const sources: Source[] = order.map((fileId, i) => {
    const m = metas[fileId];
    const seen = new Set<string>();
    const excerpts = results
      .filter((r) => r.file_id === fileId && r.text)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .filter((r) => {
        const key = (r.text as string).slice(0, 200);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3)
      .map((r) => {
        const t = (r.text as string).trim();
        return { text: t.length > 600 ? t.slice(0, 599).trimEnd() + "…" : t, score: r.score };
      });
    return {
      n: i + 1,
      fileId,
      title: m?.title || names[fileId] || "Document",
      subtitle: m?.subtitle || "",
      meta: m || undefined,
      excerpts,
    };
  });

  const seenMarker = new Set<string>();
  const markers: Marker[] = cites
    .map((c) => ({ index: c.index, n: order.indexOf(c.file_id) + 1 }))
    .filter((m) => {
      const k = `${m.index}:${m.n}`;
      if (seenMarker.has(k)) return false;
      seenMarker.add(k);
      return true;
    })
    .sort((a, b) => a.index - b.index || a.n - b.n);

  let usage: Usage | null = null;
  const u = resp.usage;
  const info = getModel(model);
  if (u && info) {
    const fileSearchCalls = (resp.output || []).filter((i) => i.type === "file_search_call").length;
    const raw = {
      input: u.input_tokens ?? 0,
      cached: u.input_tokens_details?.cached_tokens ?? 0,
      output: u.output_tokens ?? 0,
      fileSearchCalls,
    };
    usage = {
      ...raw,
      reasoning: u.output_tokens_details?.reasoning_tokens ?? 0,
      total: u.total_tokens ?? raw.input + raw.output,
      costUsd: computeCost(raw, info),
      model,
      effort,
    };
  }

  return { type: "done", responseId: resp.id, text, sources, markers, usage };
}

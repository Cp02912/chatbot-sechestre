import OpenAI from "openai";
import { guard } from "@/lib/auth";
import { eventForResponse, errorMessage, getClient, NO_KEY_MESSAGE } from "@/lib/chatServer";
import { defaultEffort, defaultModel } from "@/lib/models";
import type { StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function maxSeconds(): number {
  const n = parseFloat(process.env.MAX_STREAM_SECONDS || "");
  return Number.isFinite(n) && n > 0 ? n : 20;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/**
 * Redă (maxim MAX_STREAM_SECONDS) evenimentele unui răspuns din fundal ca NDJSON.
 * La expirare emite {type:"continue", after} și clientul se reconectează.
 */
export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  if (!/^resp_[A-Za-z0-9_-]+$/.test(id)) return Response.json({ error: "Id invalid." }, { status: 400 });
  const afterParam = parseInt(url.searchParams.get("after") || "0", 10);
  const startAfter = Number.isFinite(afterParam) && afterParam > 0 ? afterParam : 0;
  const model = defaultModel(url.searchParams.get("model") || undefined);
  const effort = defaultEffort(url.searchParams.get("effort") || undefined);

  const client = getClient();
  if (!client) return Response.json({ error: NO_KEY_MESSAGE }, { status: 500 });

  const encoder = new TextEncoder();
  const abort = new AbortController(); // oprește conexiunea upstream (NU anulează răspunsul din fundal)
  req.signal.addEventListener("abort", () => abort.abort());
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    abort.abort();
  }, maxSeconds() * 1000);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastSeq = startAfter;
      let lastStatus = "";
      const send = (ev: StreamEvent) => {
        if (closed) return;
        if (ev.type === "status") {
          if (ev.status === lastStatus) return;
          lastStatus = ev.status;
        }
        try {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        clearTimeout(timer);
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* deja închis */
        }
      };
      const fin = (ev: StreamEvent) => {
        send(ev);
        close();
      };

      // Fallback: dacă stream-ul nu poate fi redeschis, sondăm răspunsul necontinuu.
      const pollUntilDeadline = async () => {
        while (!abort.signal.aborted) {
          const r = await client.responses.retrieve(id, { include: ["file_search_call.results"] }, { signal: abort.signal });
          const ev = await eventForResponse(client, r, model, effort);
          if (ev) return fin(ev);
          const items = r.output || [];
          const writing = items.some((i) => i.type === "message");
          const searching = items.some((i) => i.type === "file_search_call");
          send({ type: "status", status: writing ? "writing" : searching ? "searching" : "thinking" });
          await sleep(1500, abort.signal);
        }
        if (timedOut) fin({ type: "continue", after: lastSeq });
        else close();
      };

      try {
        let events: AsyncIterable<OpenAI.Responses.ResponseStreamEvent>;
        try {
          events = await client.responses.retrieve(
            id,
            { stream: true, include: ["file_search_call.results"], ...(startAfter ? { starting_after: startAfter } : {}) },
            { signal: abort.signal },
          );
        } catch (e) {
          if (abort.signal.aborted) throw e;
          if (e instanceof OpenAI.APIError && (e.status === 400 || e.status === 404 || e.status === 405 || e.status === 422)) {
            if (e.status === 404 && /not found/i.test(e.message)) return fin({ type: "error", message: errorMessage(e) });
            return await pollUntilDeadline();
          }
          throw e;
        }

        let wrote = false;
        let terminal: OpenAI.Responses.Response | null = null;
        for await (const ev of events) {
          const seq = (ev as { sequence_number?: number }).sequence_number;
          switch (ev.type) {
            case "response.created":
            case "response.in_progress":
            case "response.queued":
              send({ type: "status", status: "thinking" });
              break;
            case "response.file_search_call.in_progress":
            case "response.file_search_call.searching":
              send({ type: "status", status: "searching" });
              break;
            case "response.output_text.delta":
              if (!wrote) {
                wrote = true;
                send({ type: "status", status: "writing" });
              }
              send({ type: "delta", text: ev.delta, seq });
              break;
            case "response.completed":
            case "response.failed":
            case "response.incomplete":
              terminal = ev.response;
              break;
            case "error":
              return fin({ type: "error", message: `Eroare OpenAI: ${ev.message}` });
            default:
              break;
          }
          if (typeof seq === "number") lastSeq = Math.max(lastSeq, seq);
          if (terminal) break;
        }

        if (abort.signal.aborted) {
          if (timedOut) return fin({ type: "continue", after: lastSeq });
          return close();
        }

        // Stream încheiat: stabilim starea reală
        const r = terminal ?? (await client.responses.retrieve(id, { include: ["file_search_call.results"] }));
        const ev = await eventForResponse(client, r, model, effort);
        if (ev) return fin(ev);
        return fin({ type: "continue", after: lastSeq });
      } catch (e) {
        if (abort.signal.aborted) {
          if (timedOut) return fin({ type: "continue", after: lastSeq });
          return close();
        }
        fin({ type: "error", message: errorMessage(e) });
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

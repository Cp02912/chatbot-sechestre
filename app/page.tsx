"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import Sources from "@/components/Sources";
import FilterBar, { describeFilters } from "@/components/FilterBar";
import ModelSelectors from "@/components/ModelSelectors";
import UsageCounter, { ZERO, addTotals, type Totals } from "@/components/UsageCounter";
import { effortLabel, isEffort, isModelId, modelLabel, type Effort, type ModelId } from "@/lib/models";
import { fmtTok, fmtUsd } from "@/lib/format";
import type { ChatMessage, Filters, StreamEvent, Usage } from "@/lib/types";

const STORAGE_KEY = "hotarari-chat-v1";
const PREFS_KEY = "hotarari-prefs-v1";
const TOTAL_KEY = "hotarari-total-v1";
const INFLIGHT_KEY = "hotarari-inflight-v1";

type Inflight = { id: string; model: string; effort: string };

const EXAMPLES = [
  "Ce bunuri au fost sechestrate în cauzele din 2024 și la ce valoare?",
  "Listează confiscările speciale de vehicule dispuse în 2023",
  "Care este valoarea totală a sechestrelor aplicate în cauzele de corupere (art. 325 CP)?",
  "Rezumă hotărârea din dosarul 1-1423/2019: sechestre și confiscări",
  "În ce cauze s-a dispus ridicarea sechestrului și de ce?",
];

type Status = "thinking" | "searching" | "writing";
const STATUS_TEXT: Record<Status, string> = {
  searching: "Caut în documente",
  thinking: "Analizez",
  writing: "Scriu răspunsul",
};

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function Ellipsis() {
  return (
    <span className="dots" aria-hidden="true">
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prevId, setPrevId] = useState<string | undefined>();
  const [filters, setFilters] = useState<Filters>({});
  const [model, setModel] = useState<ModelId>("gpt-6-luna");
  const [effort, setEffort] = useState<Effort>("high");
  const [allTotals, setAllTotals] = useState<Totals>(ZERO);
  const [showFilters, setShowFilters] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("thinking");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);
  const lastUserText = useRef<string>("");
  const inflightRef = useRef<Inflight | null>(null);
  const resumedRef = useRef(false);
  const [authOn, setAuthOn] = useState(false);

  // încărcare din localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.messages)) setMessages(d.messages);
        if (typeof d.prevId === "string") setPrevId(d.prevId);
        if (d.filters && typeof d.filters === "object") setFilters(d.filters);
      }
    } catch {
      /* ignorat */
    }
    try {
      const t = JSON.parse(localStorage.getItem(TOTAL_KEY) || "null");
      if (t && typeof t.costUsd === "number") setAllTotals({ ...ZERO, ...t });
    } catch {
      /* ignorat */
    }
    let saved: { model?: unknown; effort?: unknown } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    } catch {
      /* ignorat */
    }
    if (saved && (isModelId(saved.model) || isEffort(saved.effort))) {
      if (isModelId(saved.model)) setModel(saved.model);
      if (isEffort(saved.effort)) setEffort(saved.effort);
    } else {
      // prima rulare: valorile implicite din server (.env)
      fetch("/api/chat")
        .then((r) => r.json())
        .then((d) => {
          if (isModelId(d.model)) setModel(d.model);
          if (isEffort(d.effort)) setEffort(d.effort);
        })
        .catch(() => {});
    }
    setLoaded(true);
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setAuthOn(!!d.auth))
      .catch(() => {});

    // reluare după reîncărcarea paginii
    try {
      const inf = JSON.parse(localStorage.getItem(INFLIGHT_KEY) || "null");
      const chat = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const msgs: ChatMessage[] = Array.isArray(chat?.messages) ? chat.messages : [];
      const last = msgs[msgs.length - 1];
      if (inf?.id && last?.role === "user" && !resumedRef.current) {
        resumedRef.current = true;
        lastUserText.current = last.text;
        inflightRef.current = inf;
        const ac = new AbortController();
        abortRef.current = ac;
        setStatus("thinking");
        setBusy(true);
        follow(inf, ac);
      } else if (inf) {
        localStorage.removeItem(INFLIGHT_KEY);
      }
    } catch {
      /* ignorat */
    }
  }, []);

  const savePrefs = (m: ModelId, e: Effort) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ model: m, effort: e }));
    } catch {
      /* ignorat */
    }
  };
  const changeModel = (m: ModelId) => {
    setModel(m);
    savePrefs(m, effort);
  };
  const changeEffort = (e: Effort) => {
    setEffort(e);
    savePrefs(model, e);
  };
  const resetAll = () => {
    setAllTotals(ZERO);
    try {
      localStorage.removeItem(TOTAL_KEY);
    } catch {
      /* ignorat */
    }
  };

  // salvare
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, prevId, filters }));
    } catch {
      /* ignorat */
    }
  }, [messages, prevId, filters, loaded]);

  // textarea auto-grow
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  // auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, partial, status, error, busy]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const setInflight = (v: Inflight | null) => {
    inflightRef.current = v;
    try {
      if (v) localStorage.setItem(INFLIGHT_KEY, JSON.stringify(v));
      else localStorage.removeItem(INFLIGHT_KEY);
    } catch {
      /* ignorat */
    }
  };

  /** Urmărește un răspuns din fundal: reconectări la `continue`, retry cu backoff, apoi sondare la 2s. */
  const follow = useCallback(async (fl: Inflight, ac: AbortController) => {
    let acc = "";
    let after = 0;
    let netFail = 0;
    let finished = false;
    let polling = false;
    let pollFail = 0;
    const qs = (extra: string) =>
      `id=${encodeURIComponent(fl.id)}&model=${encodeURIComponent(fl.model)}&effort=${encodeURIComponent(fl.effort)}${extra}`;

    const handle = (ev: StreamEvent): "continue" | undefined => {
      if (ev.type === "status") setStatus(ev.status);
      else if (ev.type === "delta") {
        if (typeof ev.seq === "number") {
          if (ev.seq <= after) return; // deja primit
          after = ev.seq;
        }
        acc += ev.text;
        setPartial(acc);
      } else if (ev.type === "continue") {
        after = Math.max(after, ev.after);
        return "continue";
      } else if (ev.type === "done") {
        finished = true;
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: "assistant",
            text: ev.text,
            sources: ev.sources,
            markers: ev.markers,
            model: fl.model,
            effort: fl.effort,
            usage: ev.usage,
          },
        ]);
        setPrevId(ev.responseId);
        if (ev.usage) {
          const u: Usage = ev.usage;
          setAllTotals((t) => {
            const n = addTotals(t, u);
            try {
              localStorage.setItem(TOTAL_KEY, JSON.stringify(n));
            } catch {
              /* ignorat */
            }
            return n;
          });
        }
        setPartial("");
        setInflight(null);
      } else if (ev.type === "error") {
        finished = true;
        setError(ev.message);
        setPartial("");
        setInflight(null);
      }
    };

    const fatal = (msg: string) => {
      finished = true;
      setError(msg);
      setInflight(null);
    };

    try {
      while (!finished && !ac.signal.aborted) {
        if (polling) {
          await new Promise((r) => setTimeout(r, 2000));
          if (ac.signal.aborted) break;
          try {
            const r = await fetch(`/api/chat/poll?${qs("")}`, { signal: ac.signal });
            if (r.status === 401) {
              window.location.href = "/login";
              return;
            }
            const j = await r.json();
            pollFail = 0;
            if (j.type === "done" || j.type === "error") handle(j as StreamEvent);
            else if (j.pending) setStatus("thinking");
          } catch (e) {
            if ((e as Error).name === "AbortError") break;
            if (++pollFail > 30) fatal("Conexiunea cu serverul s-a pierdut. Încearcă din nou.");
          }
          continue;
        }
        try {
          const res = await fetch(`/api/chat/stream?${qs(after ? `&after=${after}` : "")}`, { signal: ac.signal });
          if (res.status === 401) {
            window.location.href = "/login";
            return;
          }
          if (!res.ok || !res.body) {
            let msg = `Eroare server (${res.status}).`;
            try {
              const j = await res.json();
              if (j?.error) msg = j.error;
            } catch {
              /* ignorat */
            }
            if (res.status < 500) return fatal(msg);
            throw new Error(msg);
          }
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          let continued = false;
          const line = (l: string) => {
            if (!l.trim()) return;
            try {
              if (handle(JSON.parse(l)) === "continue") continued = true;
            } catch {
              /* linie coruptă */
            }
          };
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const parts = buf.split("\n");
            buf = parts.pop() || "";
            parts.forEach(line);
          }
          buf += dec.decode();
          line(buf);
          if (finished) break;
          if (!continued) throw new Error("Conexiune întreruptă");
          netFail = 0;
        } catch (e) {
          if ((e as Error).name === "AbortError" || ac.signal.aborted) break;
          if (++netFail > 3) polling = true;
          else await new Promise((r) => setTimeout(r, 600 * 2 ** (netFail - 1)));
        }
      }
    } finally {
      if (ac.signal.aborted && !finished) {
        // oprit de utilizator: păstrăm textul parțial, consum necunoscut
        if (acc) {
          setMessages((m) => [
            ...m,
            {
              id: uid(),
              role: "assistant",
              text: acc,
              sources: [],
              markers: [],
              model: fl.model,
              effort: fl.effort,
              usage: null,
            },
          ]);
        }
        setPartial("");
      }
      setBusy(false);
      if (abortRef.current === ac) abortRef.current = null;
    }
  }, []);

  const run = useCallback(
    async (text: string, addUser: boolean) => {
      lastUserText.current = text;
      stickRef.current = true;
      setError(null);
      setPartial("");
      setStatus("thinking");
      setBusy(true);
      if (addUser) setMessages((m) => [...m, { id: uid(), role: "user", text }]);

      const ac = new AbortController();
      abortRef.current = ac;
      let fl: Inflight;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, previousResponseId: prevId, filters, model, effort }),
          signal: ac.signal,
        });
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.responseId) throw new Error(j?.error || `Eroare server (${res.status}).`);
        fl = { id: j.responseId, model: j.model, effort: j.effort };
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message || "Eroare de rețea.");
        setBusy(false);
        abortRef.current = null;
        return;
      }
      setInflight(fl);
      await follow(fl, ac);
    },
    [prevId, filters, model, effort, follow],
  );

  const send = (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setInput("");
    run(t, true);
  };

  const cancelRemote = () => {
    const fl = inflightRef.current;
    if (!fl) return;
    setInflight(null);
    fetch("/api/chat/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fl.id }),
    }).catch(() => {});
  };

  const stop = () => {
    abortRef.current?.abort();
    cancelRemote();
  };

  const logout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      /* ignorat */
    }
    window.location.href = "/login";
  };

  const reset = () => {
    abortRef.current?.abort();
    cancelRemote();
    setMessages([]);
    setPrevId(undefined);
    setPartial("");
    setError(null);
    setInput("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignorat */
    }
  };

  const goToSource = (msgId: string, n: number) => {
    const el = document.getElementById(`${msgId}-src-${n}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("src-flash");
    setTimeout(() => el.classList.remove("src-flash"), 1600);
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignorat */
    }
  };

  const activeFilters = describeFilters(filters);
  const convTotals = messages.reduce<Totals>(
    (t, m) => (m.role === "assistant" && m.usage ? addTotals(t, m.usage) : t),
    ZERO,
  );
  const unknownCount = messages.filter((m) => m.role === "assistant" && m.usage === null).length;
  const empty = loaded && messages.length === 0 && !busy;

  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="shrink-0 border-b border-[var(--border)] bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-[760px] px-4">
          <div className="relative flex items-center justify-between py-2 text-sm">
            <button
              type="button"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
              className="py-1 text-[var(--muted)] hover:text-[var(--fg)]"
            >
              Filtre{activeFilters && !showFilters ? " •" : ""}
            </button>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <ModelSelectors
                  model={model}
                  effort={effort}
                  onModel={changeModel}
                  onEffort={changeEffort}
                  disabled={busy}
                />
              </div>
              <UsageCounter
                conv={convTotals}
                all={allTotals}
                unknownCount={unknownCount}
                onResetAll={resetAll}
                onLogout={authOn ? logout : undefined}
              />
              <button
                type="button"
                onClick={reset}
                className="whitespace-nowrap py-1 text-xs text-[var(--muted)] hover:text-[var(--fg)] sm:text-sm"
              >
                Conversație nouă
              </button>
            </div>
          </div>
          {showFilters && (
            <FilterBar filters={filters} onChange={setFilters} disabled={busy}>
              <ModelSelectors
                labels
                model={model}
                effort={effort}
                onModel={changeModel}
                onEffort={changeEffort}
                disabled={busy}
              />
            </FilterBar>
          )}
          {!showFilters && activeFilters && (
            <div className="pb-2 text-xs text-[var(--muted)]">Filtre active: {activeFilters}</div>
          )}
        </div>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-4 py-6">
          {empty && (
            <div className="pt-6">
              <p className="text-sm text-[var(--muted)]">
                Întreabă despre sechestre și confiscări în hotărârile din colecție.
              </p>
              <ul className="mt-4 space-y-1">
                {EXAMPLES.map((ex) => (
                  <li key={ex}>
                    <button
                      type="button"
                      onClick={() => send(ex)}
                      className="py-1.5 text-left text-[15px] leading-snug text-[var(--accent)] hover:underline underline-offset-2"
                    >
                      {ex}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-7">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-[var(--bubble)] px-4 py-2">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id}>
                  <Markdown text={m.text} markers={m.markers} onCite={(n) => goToSource(m.id, n)} />
                  <Sources sources={m.sources} prefix={m.id} />
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <button
                      type="button"
                      onClick={() => copy(m.id, m.text)}
                      className="text-xs text-[var(--muted)] hover:text-[var(--fg)]"
                    >
                      {copied === m.id ? "Copiat" : "Copiază"}
                    </button>
                    {m.model && (
                      <span className="text-[11px] text-[var(--muted)] tabular-nums">
                        {modelLabel(m.model)} · {effortLabel(m.effort || "")} ·{" "}
                        {m.usage ? `${fmtTok(m.usage.total)} tok · ${fmtUsd(m.usage.costUsd)}` : "necunoscut"}
                      </span>
                    )}
                  </div>
                </div>
              ),
            )}

            {busy && (
              <div>
                {partial && <Markdown text={partial} />}
                <p className="mt-3 text-sm text-[var(--muted)]" role="status">
                  {STATUS_TEXT[status]}
                  <Ellipsis />
                </p>
              </div>
            )}

            {error && !busy && (
              <p className="text-sm" style={{ color: "var(--err)" }} role="alert">
                {error}{" "}
                <button
                  type="button"
                  onClick={() => run(lastUserText.current, false)}
                  className="ml-1 underline underline-offset-2"
                >
                  Reîncearcă
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <form
        className="shrink-0 border-t border-[var(--border)] bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="mx-auto flex w-full max-w-[760px] items-end gap-3 px-4">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Scrie o întrebare…"
            aria-label="Întrebare"
            className="min-h-[42px] flex-1 resize-none rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[16px] leading-6 placeholder:text-[#9ca3af] disabled:bg-[#fafafa]"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="h-[42px] shrink-0 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--fg)] hover:bg-[var(--bubble)]"
            >
              Oprește
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-[42px] shrink-0 rounded-lg border border-[var(--fg)] bg-[var(--fg)] px-3 text-sm text-white disabled:border-[var(--border)] disabled:bg-white disabled:text-[#9ca3af]"
            >
              Trimite
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

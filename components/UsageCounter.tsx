"use client";

import { useEffect, useRef, useState } from "react";
import { fmtTok, fmtUsd } from "@/lib/format";

export type Totals = {
  input: number;
  cached: number;
  output: number;
  reasoning: number;
  total: number;
  fileSearchCalls: number;
  costUsd: number;
};

export const ZERO: Totals = { input: 0, cached: 0, output: 0, reasoning: 0, total: 0, fileSearchCalls: 0, costUsd: 0 };

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    input: a.input + b.input,
    cached: a.cached + b.cached,
    output: a.output + b.output,
    reasoning: a.reasoning + b.reasoning,
    total: a.total + b.total,
    fileSearchCalls: a.fileSearchCalls + b.fileSearchCalls,
    costUsd: a.costUsd + b.costUsd,
  };
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--muted)]">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}

function Block({ t }: { t: Totals }) {
  return (
    <div className="space-y-0.5">
      <Row k="Intrare" v={`${fmtTok(t.input)} tok`} />
      <Row k="din care din cache" v={`${fmtTok(t.cached)} tok`} />
      <Row k="Ieșire" v={`${fmtTok(t.output)} tok`} />
      <Row k="din care raționament" v={`${fmtTok(t.reasoning)} tok`} />
      <Row k="Căutări în documente" v={fmtTok(t.fileSearchCalls)} />
      <Row k="Cost" v={fmtUsd(t.costUsd)} />
    </div>
  );
}

export default function UsageCounter({
  conv,
  all,
  unknownCount,
  onResetAll,
  onLogout,
}: {
  conv: Totals;
  all: Totals;
  unknownCount: number;
  onResetAll: () => void;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("touchstart", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="whitespace-nowrap py-1 text-xs tabular-nums text-[var(--muted)] hover:text-[var(--fg)]"
      >
        {fmtTok(conv.total)} tok · {fmtUsd(conv.costUsd)}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Consum"
          className="absolute right-0 top-full z-10 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded border border-[var(--border)] bg-white p-3 text-xs shadow-sm"
        >
          <div className="mb-1 font-medium">Această conversație</div>
          <Block t={conv} />
          {unknownCount > 0 && (
            <p className="mt-1 text-[var(--muted)]">
              {unknownCount} {unknownCount === 1 ? "răspuns oprit" : "răspunsuri oprite"}: consum necunoscut, neinclus.
            </p>
          )}
          <div className="mb-1 mt-3 flex items-baseline justify-between border-t border-[var(--border)] pt-2">
            <span className="font-medium">Total general</span>
            <button type="button" onClick={onResetAll} className="text-[var(--accent)] underline underline-offset-2">
              Resetează totalul
            </button>
          </div>
          <Block t={all} />
          <p className="mt-3 text-[11px] leading-snug text-[var(--muted)]">
            Estimare după prețurile standard OpenAI; factura reală poate diferi.
          </p>
          {onLogout && (
            <button type="button" onClick={onLogout} className="mt-2 text-[var(--muted)] underline underline-offset-2">
              Ieși
            </button>
          )}
        </div>
      )}
    </div>
  );
}

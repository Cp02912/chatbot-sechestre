"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Marker } from "@/lib/types";

/** Inserează marcajele de citare ca linkuri speciale (#cite-N) în textul markdown. */
export function withMarkers(text: string, markers: Marker[]): string {
  if (!markers.length) return text;
  const groups = new Map<number, number[]>();
  for (const m of markers) {
    let idx = Math.min(Math.max(m.index, 0), text.length);
    // nu rupe structura (ex. rânduri de tabel): retrage markerul înainte de newline-uri
    while (idx > 0 && (text[idx - 1] === "\n" || text[idx - 1] === " ")) idx--;
    // rând de tabel: marcajul intră în ultima celulă, nu după bara de final
    const ls = text.lastIndexOf("\n", idx - 1) + 1;
    const line = text.slice(ls, idx);
    if (/^\s*\|/.test(line) && /\|\s*$/.test(line)) {
      idx = ls + line.replace(/\|\s*$/, "").trimEnd().length;
    }
    const arr = groups.get(idx) || [];
    if (!arr.includes(m.n)) arr.push(m.n);
    groups.set(idx, arr);
  }
  let out = text;
  for (const idx of [...groups.keys()].sort((a, b) => b - a)) {
    const ins = groups
      .get(idx)!
      .sort((a, b) => a - b)
      .map((n) => `[${n}](#cite-${n})`)
      .join("");
    out = out.slice(0, idx) + ins + out.slice(idx);
  }
  return out;
}

export default function Markdown({
  text,
  markers = [],
  onCite,
}: {
  text: string;
  markers?: Marker[];
  onCite?: (n: number) => void;
}) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const m = href?.match(/^#cite-(\d+)$/);
            if (m) {
              const n = Number(m[1]);
              return (
                <button type="button" className="cite" onClick={() => onCite?.(n)} aria-label={`Sursa ${n}`}>
                  [{n}]
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="table-wrap">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {withMarkers(text, markers)}
      </ReactMarkdown>
    </div>
  );
}

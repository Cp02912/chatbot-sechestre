"use client";

import type { Source } from "@/lib/types";

export default function Sources({ sources, prefix }: { sources: Source[]; prefix: string }) {
  if (!sources.length) return null;
  return (
    <section className="mt-6 border-t border-[var(--border)] pt-3" aria-label="Surse">
      <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Surse</h3>
      <ol className="mt-2 space-y-3">
        {sources.map((s) => (
          <li key={s.n} id={`${prefix}-src-${s.n}`} className="-mx-2 rounded px-2 py-1 text-sm scroll-mt-4">
            <div className="flex gap-2">
              <span className="shrink-0 text-[var(--muted)]">{s.n}.</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold leading-snug break-words">{s.title}</div>
                {s.subtitle && (
                  <div className="text-[var(--muted)] leading-snug break-words">{s.subtitle}</div>
                )}
                {s.excerpts.length > 0 && (
                  <details className="mt-1">
                    <summary className="inline-block cursor-pointer text-xs text-[var(--muted)] hover:text-[var(--fg)]">
                      Fragmente
                    </summary>
                    <div className="mt-1 space-y-2">
                      {s.excerpts.map((e, i) => (
                        <blockquote
                          key={i}
                          className="border-l-2 border-[var(--border)] pl-3 text-xs leading-relaxed text-[#4b5563] whitespace-pre-wrap break-words"
                        >
                          {e.text}
                        </blockquote>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

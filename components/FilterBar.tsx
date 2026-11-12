"use client";

import type { Filters } from "@/lib/types";

export function describeFilters(f: Filters): string {
  const parts: string[] = [];
  const fmt = (d: string) => d.split("-").reverse().join(".");
  if (f.from && f.to) parts.push(`${fmt(f.from)} – ${fmt(f.to)}`);
  else if (f.from) parts.push(`din ${fmt(f.from)}`);
  else if (f.to) parts.push(`până la ${fmt(f.to)}`);
  if (f.materie) parts.push(f.materie);
  return parts.join(" · ");
}

const field =
  "mt-1 block w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-[16px] text-[var(--fg)]";

export default function FilterBar({
  filters,
  onChange,
  disabled,
  children,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  disabled?: boolean;
  /** controale suplimentare (afișate doar pe mobil) */
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 border-b border-[var(--border)] pb-3 pt-1 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <label className="text-xs text-[var(--muted)]">
        Perioada de la
        <input
          type="date"
          className={field}
          value={filters.from || ""}
          max={filters.to || undefined}
          disabled={disabled}
          onChange={(e) => onChange({ ...filters, from: e.target.value || undefined })}
        />
      </label>
      <label className="text-xs text-[var(--muted)]">
        până la
        <input
          type="date"
          className={field}
          value={filters.to || ""}
          min={filters.from || undefined}
          disabled={disabled}
          onChange={(e) => onChange({ ...filters, to: e.target.value || undefined })}
        />
      </label>
      <label className="col-span-1 text-xs text-[var(--muted)]">
        Materie
        <select
          className={field}
          value={filters.materie || ""}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...filters, materie: (e.target.value || undefined) as Filters["materie"] })
          }
        >
          <option value="">toate</option>
          <option value="penal">penal</option>
          <option value="civil">civil</option>
        </select>
      </label>
      {children && <div className="col-span-2 grid grid-cols-2 gap-3 sm:hidden">{children}</div>}
      <button
        type="button"
        onClick={() => onChange({})}
        disabled={disabled}
        className="justify-self-start py-1.5 text-sm text-[var(--accent)] underline underline-offset-2 sm:justify-self-end"
      >
        Resetează
      </button>
    </div>
  );
}

"use client";

import { EFFORTS, MODELS, isEffort, isModelId, type Effort, type ModelId } from "@/lib/models";

const sel =
  "rounded border border-[var(--border)] bg-white px-1.5 py-1 text-[16px] sm:text-xs text-[var(--muted)] hover:text-[var(--fg)]";

export default function ModelSelectors({
  model,
  effort,
  onModel,
  onEffort,
  disabled,
  labels,
}: {
  model: ModelId;
  effort: Effort;
  onModel: (m: ModelId) => void;
  onEffort: (e: Effort) => void;
  disabled?: boolean;
  labels?: boolean;
}) {
  return (
    <>
      <label className={labels ? "text-xs text-[var(--muted)]" : "flex items-center"}>
        {labels && "Model"}
        <select
          aria-label="Model"
          className={sel + (labels ? " mt-1 block w-full py-1.5" : "")}
          value={model}
          disabled={disabled}
          onChange={(e) => isModelId(e.target.value) && onModel(e.target.value)}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className={labels ? "text-xs text-[var(--muted)]" : "flex items-center"}>
        {labels && "Efort"}
        <select
          aria-label="Efort"
          className={sel + (labels ? " mt-1 block w-full py-1.5" : "")}
          value={effort}
          disabled={disabled}
          onChange={(e) => isEffort(e.target.value) && onEffort(e.target.value)}
        >
          {EFFORTS.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

// Sursă unică de adevăr pentru modele, prețuri și niveluri de efort (server + client).
export type ModelId = "gpt-6-luna" | "gpt-6.1-terra";
export type Effort = "low" | "medium" | "high";

export type ModelInfo = {
  id: ModelId;
  label: string;
  /** USD per 1M tokeni */
  input: number;
  cachedInput: number;
  output: number;
};

export const MODELS: ModelInfo[] = [
  { id: "gpt-6-luna", label: "Luna", input: 0.1, cachedInput: 0.01, output: 0.5 },
  { id: "gpt-6.1-terra", label: "Terra", input: 1.0, cachedInput: 0.05, output: 5.0 },
];

export const EFFORTS: { id: Effort; label: string }[] = [
  { id: "low", label: "scăzut" },
  { id: "medium", label: "mediu" },
  { id: "high", label: "ridicat" },
];

/** $2.50 / 1000 apeluri file_search */
export const FILE_SEARCH_PER_CALL = 0.0025;

export const isModelId = (v: unknown): v is ModelId => MODELS.some((m) => m.id === v);
export const isEffort = (v: unknown): v is Effort => EFFORTS.some((e) => e.id === v);

export const getModel = (id: string): ModelInfo | undefined => MODELS.find((m) => m.id === id);
export const modelLabel = (id: string) => getModel(id)?.label ?? id;
export const effortLabel = (id: string) => EFFORTS.find((e) => e.id === id)?.label ?? id;

export function defaultModel(envValue?: string): ModelId {
  return isModelId(envValue) ? envValue : "gpt-6-luna";
}
export function defaultEffort(envValue?: string): Effort {
  return isEffort(envValue) ? envValue : "high";
}

export type RawUsage = {
  input: number;
  cached: number;
  output: number;
  fileSearchCalls: number;
};

/** cost = (input − cached)·in + cached·cachedIn + output·out + apeluri·preț (reasoning e deja în output). */
export function computeCost(u: RawUsage, model: ModelInfo): number {
  const cached = Math.min(Math.max(u.cached, 0), u.input);
  return (
    ((u.input - cached) * model.input + cached * model.cachedInput + u.output * model.output) / 1_000_000 +
    u.fileSearchCalls * FILE_SEARCH_PER_CALL
  );
}

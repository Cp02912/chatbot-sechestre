export type Filters = { from?: string; to?: string; materie?: "penal" | "civil" };

export type Excerpt = { text: string; score?: number };

export type SourceMeta = {
  fileId: string;
  fileName: string;
  title: string;
  subtitle: string;
  tipAct?: string;
  instanta?: string;
  dosar?: string;
  data?: string;
  materie?: string;
  articol?: string;
  parti?: string;
};

export type Source = {
  n: number;
  fileId: string;
  title: string;
  subtitle: string;
  meta?: SourceMeta;
  excerpts: Excerpt[];
};

export type Marker = { index: number; n: number };

export type Usage = {
  input: number;
  cached: number;
  output: number;
  reasoning: number;
  total: number;
  fileSearchCalls: number;
  costUsd: number;
  model: string;
  effort: string;
};

export type StreamEvent =
  | { type: "status"; status: "searching" | "thinking" | "writing" }
  | { type: "continue"; after: number }
  | { type: "delta"; text: string; seq?: number }
  | { type: "done"; responseId: string; text: string; sources: Source[]; markers: Marker[]; usage: Usage | null }
  | { type: "error"; message: string };

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      sources: Source[];
      markers: Marker[];
      model?: string;
      effort?: string;
      /** null = necunoscut (ex. răspuns oprit) */
      usage?: Usage | null;
    };

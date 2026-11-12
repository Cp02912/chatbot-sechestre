import fs from "node:fs";
import path from "node:path";
import { defaultEffort, defaultModel } from "./models";

function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
  } catch {
    /* fișier lipsă */
  }
  return out;
}

export function getApiKey(): string | undefined {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const fallback = parseEnvFile(path.resolve(process.cwd(), "..", "script.env"));
  return fallback.OPENAI_KEY || undefined;
}

export function getConfig() {
  const max = parseInt(process.env.FILE_SEARCH_MAX_RESULTS || "", 10);
  return {
    vectorStoreId: process.env.VECTOR_STORE_ID || "vs_6af4275e8db48191aa5098c97dbcd2e0",
    model: defaultModel(process.env.OPENAI_MODEL),
    effort: defaultEffort(process.env.REASONING_EFFORT),
    maxResults: Number.isFinite(max) && max > 0 ? Math.min(max, 50) : 30,
  };
}

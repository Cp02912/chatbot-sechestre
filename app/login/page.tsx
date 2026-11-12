"use client";

import { useState } from "react";

export default function LoginPage() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (r.ok) {
        window.location.href = "/";
        return;
      }
      setErr(r.status === 401 ? "Parolă incorectă." : "Autentificarea a eșuat. Încearcă din nou.");
    } catch {
      setErr("Nu mă pot conecta la server.");
    }
    setBusy(false);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[360px] flex-col justify-center px-4">
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm text-[var(--muted)]">
          Parolă
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[16px] text-[var(--fg)]"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !pw}
            className="h-[42px] rounded-lg border border-[var(--fg)] bg-[var(--fg)] px-4 text-sm text-white disabled:border-[var(--border)] disabled:bg-white disabled:text-[#9ca3af]"
          >
            Intră
          </button>
          {err && (
            <span className="text-sm" style={{ color: "var(--err)" }} role="alert">
              {err}
            </span>
          )}
        </div>
      </form>
    </main>
  );
}

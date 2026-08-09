"use client";

import React, { useState } from "react";

export default function PurgeButton() {
  const [purging, setPurging] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handlePurge() {
    setPurging(true);
    setResult(null);
    try {
      const res = await fetch("/api/purge", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult((body && body.error) || `Purge failed: ${res.statusText}`);
      } else {
        setResult(body.message || "Purge executed successfully.");
      }
    } catch (err: unknown) {
      setResult(err instanceof Error ? err.message : "Purge failed");
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handlePurge}
        disabled={purging}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs shrink-0"
      >
        {purging ? "Running purge..." : "Run Retention Purge Trigger"}
      </button>
      {result && <div className="text-xs text-slate-600">{result}</div>}
    </div>
  );
}

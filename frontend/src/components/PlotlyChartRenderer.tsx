"use client";

import React, { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { PlotlyChartSpec } from "@/lib/api";

const SERIES_COLORS = [
  "#7657F6",
  "#22C58B",
  "#A78BFA",
  "#F5B942",
  "#38BDF8",
  "#F16B75",
];

export interface PlotlyChartRendererProps {
  spec: PlotlyChartSpec | null | undefined;
}

export function PlotlyChartRenderer({ spec }: PlotlyChartRendererProps) {
  // Always compute chart model unconditionally (Rules of Hooks compliance)
  const parsed = useMemo(() => {
    if (!spec || !Array.isArray(spec.data) || spec.data.length === 0) {
      return null;
    }

    const trace = spec.data[0] || {};
    const traceType = String(trace.type || "bar").toLowerCase();
    const layoutTitle =
      spec.layout && typeof spec.layout.title === "object" && spec.layout.title !== null
        ? String((spec.layout.title as Record<string, unknown>).text || "")
        : typeof spec.layout?.title === "string"
          ? spec.layout.title
          : "";

    if (traceType === "pie") {
      const labels = Array.isArray(trace.labels) ? trace.labels.map(String) : [];
      const values = Array.isArray(trace.values) ? trace.values.map(Number) : [];
      const total = values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0) || 1;
      const items = labels.map((label, idx) => {
        const val = Number.isFinite(values[idx]) ? values[idx] : 0;
        return {
          label,
          value: val,
          percent: Math.round((val / total) * 100),
          color: SERIES_COLORS[idx % SERIES_COLORS.length],
        };
      });
      return { kind: "pie" as const, title: layoutTitle, items, maxValue: total };
    }

    const xValues = Array.isArray(trace.x) ? trace.x.map(String) : [];
    const yValues = Array.isArray(trace.y) ? trace.y.map(Number) : [];
    const maxVal = Math.max(...yValues.filter(Number.isFinite), 1);
    const items = xValues.map((label, idx) => {
      const val = Number.isFinite(yValues[idx]) ? yValues[idx] : 0;
      return {
        label,
        value: val,
        percent: Math.max(2, Math.round((val / maxVal) * 100)),
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
      };
    });

    return { kind: traceType === "scatter" || traceType === "line" ? ("line" as const) : ("bar" as const), title: layoutTitle, items, maxValue: maxVal };
  }, [spec]);

  if (!parsed || parsed.items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 px-4 py-8 text-center flex flex-col items-center gap-2">
        <BarChart3 className="h-5 w-5 text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-muted)]">
          No chartable numeric series found in query result.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
          {parsed.title || "Query Visualization"}
        </h4>
        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
          {parsed.kind} · {parsed.items.length} pts
        </span>
      </div>

      {parsed.kind === "pie" ? (
        <div className="space-y-3">
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-[var(--bg-elevated)]">
            {parsed.items.map((item, idx) => (
              <div
                key={`${item.label}-${idx}`}
                style={{ width: `${Math.max(item.percent, 2)}%`, backgroundColor: item.color }}
                title={`${item.label}: ${item.value.toLocaleString()} (${item.percent}%)`}
              />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {parsed.items.map((item, idx) => (
              <div
                key={`${item.label}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-elevated)]/50 border border-[var(--border-subtle)] px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[var(--text-secondary)] truncate">{item.label}</span>
                </div>
                <span className="font-mono font-semibold text-[var(--text-primary)] shrink-0">
                  {item.value.toLocaleString()} ({item.percent}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {parsed.items.slice(0, 15).map((item, idx) => (
            <div key={`${item.label}-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs gap-3">
                <span className="text-[var(--text-secondary)] truncate max-w-[65%]">
                  {item.label}
                </span>
                <span className="font-mono font-medium text-[var(--text-primary)] tabular-nums">
                  {item.value.toLocaleString()}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${item.percent}%`,
                    backgroundColor: idx === 0 ? "#7657F6" : item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

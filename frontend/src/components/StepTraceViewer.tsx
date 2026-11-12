"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Clock, Terminal, Wrench } from "lucide-react";
import { AgentStepTrace } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { Badge } from "./common/Badge";

export interface StepTraceViewerProps {
  traces: AgentStepTrace[];
}

export function StepTraceViewer({ traces }: StepTraceViewerProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });

  if (!traces || traces.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 px-4 py-6 text-center text-xs text-[var(--text-muted)]">
        No execution telemetry steps were emitted for this run.
      </div>
    );
  }

  const toggleStep = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="space-y-2.5">
      {traces.map((trace, idx) => {
        const isOpen = Boolean(expanded[idx]);
        const hasDetails = Boolean(
          trace.thought_content || trace.tool_input || trace.tool_output,
        );

        return (
          <div
            key={trace.id || `trace-${idx}`}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => hasDetails && toggleStep(idx)}
              className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors ${
                hasDetails ? "hover:bg-[var(--bg-elevated)]/60 cursor-pointer" : "cursor-default"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-6 w-6 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[11px] font-mono font-semibold text-[var(--text-secondary)] shrink-0">
                  {trace.step_index ?? idx + 1}
                </span>
                <Badge
                  variant={trace.tool_name ? "accent" : "neutral"}
                  size="xs"
                >
                  {trace.step_type}
                </Badge>
                {trace.tool_name && (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-[var(--text-primary)] truncate">
                    <Wrench className="h-3 w-3 text-[#A78BFA] shrink-0" />
                    {trace.tool_name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {trace.duration_ms !== null && trace.duration_ms !== undefined && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--text-muted)]">
                    <Clock className="h-3 w-3" />
                    {formatDuration(trace.duration_ms)}
                  </span>
                )}
                {hasDetails && (
                  isOpen ? (
                    <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                  )
                )}
              </div>
            </button>

            {isOpen && hasDetails && (
              <div className="px-4 pb-4 pt-2 border-t border-[var(--border-subtle)] space-y-3 bg-[var(--bg-canvas)]/40">
                {trace.thought_content && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Reasoning
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                      {trace.thought_content}
                    </p>
                  </div>
                )}

                {trace.tool_input && Object.keys(trace.tool_input).length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      <Terminal className="h-3 w-3" />
                      Tool Input
                    </div>
                    <pre className="rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] p-3 text-[11px] font-mono text-[var(--text-secondary)] overflow-x-auto">
                      {JSON.stringify(trace.tool_input, null, 2)}
                    </pre>
                  </div>
                )}

                {trace.tool_output && Object.keys(trace.tool_output).length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      <Terminal className="h-3 w-3" />
                      Tool Output
                    </div>
                    <pre className="rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] p-3 text-[11px] font-mono text-[var(--text-secondary)] overflow-x-auto max-h-60">
                      {JSON.stringify(trace.tool_output, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

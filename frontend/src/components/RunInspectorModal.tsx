"use client";

import React, { useEffect, useState } from "react";
import { Activity, Clock, FileText } from "lucide-react";
import { AgentRun, AgentStepTrace, api } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/format";
import { AlertBanner } from "./common/AlertBanner";
import { StatusBadge } from "./common/Badge";
import { Button } from "./common/Button";
import { Modal } from "./common/Modal";
import { Skeleton } from "./common/Skeleton";
import { StepTraceViewer } from "./StepTraceViewer";

export interface RunInspectorModalProps {
  run: AgentRun | null;
  agentName?: string;
  onClose: () => void;
}

export function RunInspectorModal({
  run,
  agentName,
  onClose,
}: RunInspectorModalProps) {
  const [traces, setTraces] = useState<AgentStepTrace[]>([]);
  const [loadingTraces, setLoadingTraces] = useState(false);

  useEffect(() => {
    if (!run) return;
    let mounted = true;
    setLoadingTraces(true);
    api
      .getRunTraces(run.id)
      .then((data) => {
        if (mounted) setTraces(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (mounted) setTraces([]);
      })
      .finally(() => {
        if (mounted) setLoadingTraces(false);
      });
    return () => {
      mounted = false;
    };
  }, [run]);

  if (!run) return null;

  return (
    <Modal
      open={Boolean(run)}
      onClose={onClose}
      title={agentName ? `${agentName} Execution` : "Execution Run Inspector"}
      description={`Run ID: ${run.id}`}
      icon={Activity}
      badge={<StatusBadge status={run.status} />}
      maxWidth="xl"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-[var(--bg-elevated)]/60 border border-[var(--border-subtle)] p-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              Timestamp
            </div>
            <div className="mt-1 text-xs font-medium text-[var(--text-primary)]">
              {formatDateTime(run.created_at)}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--bg-elevated)]/60 border border-[var(--border-subtle)] p-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              Latency
            </div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-mono font-medium text-[var(--text-primary)]">
              <Clock className="h-3.5 w-3.5 text-[#A78BFA]" />
              {formatDuration(run.duration_ms)}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--bg-elevated)]/60 border border-[var(--border-subtle)] p-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              Citations
            </div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
              <FileText className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              {run.sources?.length || 0} sources
            </div>
          </div>
        </div>

        {run.error_message && (
          <AlertBanner variant="error" title="Execution Error" message={run.error_message} />
        )}

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Input / Prompt
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] p-4 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
            {run.question || "—"}
          </div>
        </div>

        {run.answer && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Output / Response
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto overscroll-contain custom-scroll">
              {run.answer}
            </div>
          </div>
        )}

        {run.sources && run.sources.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Retrieved Contexts ({run.sources.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {run.sources.map((src, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-3 text-xs space-y-1"
                >
                  <div className="font-medium text-[var(--text-primary)] truncate">
                    {src.title || src.filename || `Source #${idx + 1}`}
                  </div>
                  {src.excerpt && (
                    <p className="text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                      {src.excerpt}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Step Telemetry Trace
          </div>
          {loadingTraces ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <StepTraceViewer traces={traces} />
          )}
        </div>
      </div>
    </Modal>
  );
}


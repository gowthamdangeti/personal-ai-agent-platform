"use client";

import React, { useState } from "react";
import { Bot, Send, ShieldAlert, User } from "lucide-react";
import { AgentStepTrace, api, HITLApprovalRequest } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { AlertBanner } from "./common/AlertBanner";
import { Badge, StatusBadge } from "./common/Badge";
import { Button } from "./common/Button";
import { TextareaInput } from "./common/FormControls";
import { HITLReviewModal } from "./HITLReviewModal";
import { StepTraceViewer } from "./StepTraceViewer";

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
  durationMs?: number;
  traces?: AgentStepTrace[];
}

export function AgentChatStream({
  slug,
  agentName,
}: {
  slug: string;
  agentName?: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingHitl, setPendingHitl] = useState<HITLApprovalRequest | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = prompt.trim();
    if (!clean || loading) return;

    setError(null);
    setPrompt("");
    const userTurnId = `user-${Date.now()}`;
    setTurns((prev) => [...prev, { id: userTurnId, role: "user", content: clean }]);
    setLoading(true);

    try {
      const res = await api.runUniversalAgent(slug, clean, {}, false);
      let traces: AgentStepTrace[] = [];
      if (res.run_id) {
        try {
          traces = await api.getRunTraces(res.run_id);
        } catch {
          traces = [];
        }
      }

      if (res.status === "suspended_hitl") {
        try {
          const pending = await api.listPendingHitl();
          const match = pending.find((p) => p.run_id === res.run_id) || pending[0] || null;
          if (match) setPendingHitl(match);
        } catch {
          // Non-fatal
        }
      }

      setTurns((prev) => [
        ...prev,
        {
          id: res.run_id || `assistant-${Date.now()}`,
          role: "assistant",
          content: res.answer || "Execution completed.",
          status: res.status,
          durationMs: res.duration_ms,
          traces,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent execution failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-col overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[#A78BFA]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {agentName || slug} Conversation
          </span>
        </div>
        <Badge variant="accent" size="xs">
          Interactive Stream
        </Badge>
      </div>

      <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto overscroll-contain custom-scroll">
        {turns.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-8">
            Send a prompt below to run {agentName || slug} and inspect real-time execution traces.
          </p>
        ) : (
          turns.map((turn) => (
            <div key={turn.id} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div
                  className={`h-6 w-6 rounded-md flex items-center justify-center ${
                    turn.role === "user"
                      ? "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                      : "bg-[#7657F6]/15 text-[#A78BFA]"
                  }`}
                >
                  {turn.role === "user" ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </div>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {turn.role === "user" ? "You" : agentName || slug}
                </span>
                {turn.status && <StatusBadge status={turn.status} size="xs" />}
                {turn.durationMs !== undefined && (
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {formatDuration(turn.durationMs)}
                  </span>
                )}
              </div>

              <div className="pl-8 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {turn.content}
              </div>

              {turn.status === "suspended_hitl" && (
                <div className="pl-8">
                  <Badge variant="warning" size="xs">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Action paused pending HITL approval
                  </Badge>
                </div>
              )}

              {turn.traces && turn.traces.length > 0 && (
                <div className="pl-8">
                  <StepTraceViewer traces={turn.traces} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="px-5 pb-3">
          <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/60 flex items-end gap-3"
      >
        <div className="flex-1">
          <TextareaInput
            rows={2}
            placeholder={`Ask ${agentName || slug}...`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <Button type="submit" loading={loading} icon={Send} disabled={!prompt.trim()}>
          Send
        </Button>
      </form>

      <HITLReviewModal
        request={pendingHitl}
        onClose={() => setPendingHitl(null)}
        onResolved={() => setPendingHitl(null)}
      />
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, History, RefreshCw, Search, Sparkles } from "lucide-react";
import { Agent, AgentRun, api } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/format";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { SelectInput, TextInput } from "@/components/common/FormControls";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/Skeleton";
import { RunInspectorModal } from "@/components/RunInspectorModal";

const PAGE_SIZE = 12;

export default function ExecutionHistoryPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [runsRes, agentsRes] = await Promise.all([
        api.runs(50),
        api.listAgentsWithMetadata(),
      ]);
      setRuns(Array.isArray(runsRes) ? runsRes : []);
      setAgents(Array.isArray(agentsRes) ? agentsRes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load execution logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const agentLookup = useMemo(() => {
    const map: Record<string, Agent> = {};
    for (const agent of agents) map[agent.id] = agent;
    return map;
  }, [agents]);

  const filteredRuns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return runs.filter((run) => {
      const status = (run.status || "").toLowerCase();
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      const agentName = (
        (run.agent_id && (agentLookup[run.agent_id]?.metadata?.title || agentLookup[run.agent_id]?.name)) ||
        ""
      ).toLowerCase();
      return (
        run.id.toLowerCase().includes(q) ||
        (run.question || "").toLowerCase().includes(q) ||
        (run.answer || "").toLowerCase().includes(q) ||
        agentName.includes(q)
      );
    });
  }, [runs, search, statusFilter, agentLookup]);

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRuns.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Governance & Observability" }, { label: "Execution History" }]}
        title="Execution History & Audit Logs"
        icon={History}
        badge={
          <Badge variant="neutral" size="sm">
            {runs.length} Audited Executions
          </Badge>
        }
        description="Inspect agent invocations, step-by-step reasoning traces, tool payloads, citations, and execution latency."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={loading}
            onClick={() => void loadHistory()}
          >
            Refresh Logs
          </Button>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex-1 max-w-md">
          <TextInput
            icon={Search}
            placeholder="Search prompts, outputs, agent names, or run IDs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="w-52">
          <SelectInput
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by execution status"
          >
            <option value="all">All Execution Statuses</option>
            <option value="completed">Completed</option>
            <option value="suspended_hitl">Awaiting HITL</option>
            <option value="cancelled">Cancelled / Rejected</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </SelectInput>
        </div>
      </div>

      {/* Runs Table */}
      {loading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : filteredRuns.length === 0 ? (
        <EmptyState
          icon={History}
          title="No matching execution records"
          description="Adjust your search filter or trigger an agent run to populate audit telemetry."
          action={{
            label: "Clear Filters",
            onClick: () => {
              setSearch("");
              setStatusFilter("all");
            },
          }}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto overscroll-contain custom-scroll">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-4">Agent</th>
                  <th className="py-3.5 px-4">Prompt / Input</th>
                  <th className="py-3.5 px-4">Latency</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-6 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
                {pageRows.map((run) => {
                  const matchedAgent = run.agent_id ? agentLookup[run.agent_id] : undefined;
                  return (
                    <tr
                      key={run.id}
                      onClick={() => setSelectedRun(run)}
                      className="hover:bg-[var(--bg-elevated)]/30 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <StatusBadge status={run.status} size="xs" />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-semibold text-[var(--text-primary)]">
                        {matchedAgent?.metadata?.title || matchedAgent?.name || "Agent"}
                      </td>
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="truncate text-[var(--text-secondary)]">
                          {run.question || "—"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-[var(--text-muted)]">
                        {formatDuration(run.duration_ms)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-[var(--text-muted)]">
                        {formatDateTime(run.created_at)}
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={Eye}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRun(run);
                          }}
                        >
                          Trace
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)] bg-[var(--bg-card)]/40">
              <span>
                Showing <strong className="text-[var(--text-primary)]">{(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredRuns.length)}</strong> of {filteredRuns.length} runs
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ChevronLeft}
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="font-mono px-2 font-medium">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ChevronRight}
                  iconPosition="right"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <RunInspectorModal
        run={selectedRun}
        agentName={
          selectedRun?.agent_id
            ? agentLookup[selectedRun.agent_id]?.metadata?.title ||
              agentLookup[selectedRun.agent_id]?.name
            : undefined
        }
        onClose={() => setSelectedRun(null)}
      />
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  FileText,
  Key,
  Layers,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  Agent,
  AgentRun,
  api,
  HITLApprovalRequest,
  IntegrationCredential,
  Stats,
} from "@/lib/api";
import { getAgentDomainMeta } from "@/lib/agentRoutes";
import { formatDateTime, formatDuration } from "@/lib/format";
import { useAuth } from "@/providers/AuthProvider";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { MetricCard } from "@/components/common/MetricCard";
import { MetricCardSkeleton, Skeleton, TableSkeleton } from "@/components/common/Skeleton";
import { RunInspectorModal } from "@/components/RunInspectorModal";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentRuns, setRecentRuns] = useState<AgentRun[]>([]);
  const [pendingHitl, setPendingHitl] = useState<HITLApprovalRequest[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [statsRes, agentsRes, runsRes, hitlRes, intRes] = await Promise.all([
        api.stats(),
        api.listAgentsWithMetadata(),
        api.runs(12),
        api.listPendingHitl(),
        api.listIntegrations(),
      ]);
      setStats(statsRes);
      setAgents(Array.isArray(agentsRes) ? agentsRes : []);
      setRecentRuns(Array.isArray(runsRes) ? runsRes : []);
      setPendingHitl(Array.isArray(hitlRes) ? hitlRes : []);
      setIntegrations(Array.isArray(intRes) ? intRes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard telemetry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const agentLookup = useMemo(() => {
    const map: Record<string, Agent> = {};
    for (const agent of agents) map[agent.id] = agent;
    return map;
  }, [agents]);

  const runSummary = useMemo(() => {
    const total = recentRuns.length || 1;
    let completed = 0;
    let hitl = 0;
    let failed = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const run of recentRuns) {
      const s = (run.status || "").toLowerCase();
      if (["completed", "succeeded", "approved"].includes(s)) completed += 1;
      else if (["suspended_hitl", "pending"].includes(s)) hitl += 1;
      else if (["failed", "error", "rejected", "cancelled"].includes(s)) failed += 1;
      if (typeof run.duration_ms === "number" && run.duration_ms > 0) {
        totalLatency += run.duration_ms;
        latencyCount += 1;
      }
    }

    return {
      completed,
      hitl,
      failed,
      total: recentRuns.length,
      completedPct: Math.round((completed / total) * 100),
      hitlPct: Math.round((hitl / total) * 100),
      failedPct: Math.round((failed / total) * 100),
      avgLatency: latencyCount > 0 ? totalLatency / latencyCount : null,
    };
  }, [recentRuns]);

  const displayName =
    user?.full_name && user.full_name.trim().toLowerCase() !== "system"
      ? user.full_name
      : "Administrator";

  const pendingHitlItems = pendingHitl.filter((item) => item.status === "pending");

  return (
    <div className="space-y-8">
      {/* Control Plane Hero Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-subtle)] pb-7">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#7657F6]/12 border border-[#7657F6]/25 text-xs font-semibold text-[#A78BFA] shadow-2xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Autonomous Multi-Agent Control Plane</span>
          </div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[var(--text-primary)]">
            Welcome back, {displayName}
          </h1>
          <p className="text-[13.5px] text-[var(--text-secondary)] max-w-3xl leading-relaxed">
            Monitor autonomous specialized agents, RAG knowledge indexing, encrypted BYOK vault credentials, and human-in-the-loop governance gates.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => void loadDashboard()}
            loading={loading}
          >
            Refresh
          </Button>
          <Link href="/documents">
            <Button variant="secondary" size="sm" icon={FileText}>
              Knowledge
            </Button>
          </Link>
          <Link href="/agents">
            <Button variant="primary" size="sm" icon={Play}>
              Launch Agent
            </Button>
          </Link>
        </div>
      </div>

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      {/* Pending HITL Alert Banner */}
      {pendingHitlItems.length > 0 && (
        <AlertBanner
          variant="warning"
          title={`${pendingHitlItems.length} Action${pendingHitlItems.length === 1 ? "" : "s"} Awaiting Human Approval`}
          message="An autonomous agent paused a sensitive tool execution under strict HITL zero-trust governance."
          action={
            <Link href="/hitl-approvals">
              <Button size="sm" variant="secondary" icon={ShieldAlert}>
                Review Queue
              </Button>
            </Link>
          }
        />
      )}

      {/* Top 4 KPI Metrics Row */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <MetricCard
            title="Registered Agents"
            value={stats?.agents ?? agents.length}
            subtext="Specialized domain agents active"
            icon={Bot}
            variant="accent"
            href="/agents"
          />
          <MetricCard
            title="Indexed Documents"
            value={`${stats?.ready_documents ?? 0} / ${stats?.documents ?? 0}`}
            subtext="Vector chunks & FTS5 indexed"
            icon={Database}
            variant="success"
            href="/knowledge"
          />
          <MetricCard
            title="Total Executions"
            value={stats?.runs ?? 0}
            subtext={
              runSummary.avgLatency
                ? `Avg latency ${formatDuration(runSummary.avgLatency)}`
                : "Across all active pipelines"
            }
            icon={Activity}
            variant="default"
            href="/history"
          />
          <MetricCard
            title="Vault Integrations"
            value={integrations.length}
            subtext={
              pendingHitlItems.length > 0
                ? `${pendingHitlItems.length} gate checkpoint pending`
                : "Encrypted BYOK credentials"
            }
            icon={Key}
            variant={pendingHitlItems.length > 0 ? "warning" : "default"}
            href="/settings/integrations"
          />
        </div>
      )}

      {/* Main Grid: Agent Fleet (8 cols) + Telemetry & Vault Summary (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Specialized Agent Fleet Card */}
        <Card className="lg:col-span-8 flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>Specialized Agent Fleet</CardTitle>
              <CardDescription>
                Direct access to enterprise domain agents and interactive playgrounds
              </CardDescription>
            </div>
            <Link
              href="/agents"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A78BFA] hover:text-[#896EFF] transition-colors shrink-0"
            >
              View All Agents
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-24 w-full" />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <EmptyState
                icon={Bot}
                title="No agents registered"
                description="Run a database seed or verify backend API connectivity to populate your agent catalog."
                action={{ label: "Check Integrations", href: "/settings/integrations" }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {agents.slice(0, 8).map((agent) => {
                  const meta = getAgentDomainMeta(agent.slug, agent.kind, agent.metadata?.category);
                  const Icon = meta.icon;
                  const isHitl = Boolean(agent.metadata?.is_hitl);
                  const targetHref = meta.workspaceHref || `/agents/${agent.slug}`;

                  return (
                    <Link
                      key={agent.id}
                      href={targetHref}
                      className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 hover:bg-[var(--bg-elevated)] hover:border-[var(--border-strong)] p-4 flex items-start justify-between gap-3.5 transition-all duration-200 shadow-2xs hover:shadow-sm"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#7657F6]/16 to-[#7657F6]/5 border border-[#7657F6]/25 flex items-center justify-center text-[#A78BFA] shrink-0 group-hover:scale-105 transition-transform">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold text-[var(--text-primary)] group-hover:text-[#A78BFA] transition-colors truncate">
                            {agent.metadata?.title || agent.name}
                          </div>
                          <div className="text-[12px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                            {agent.metadata?.description || agent.description || meta.categoryLabel}
                          </div>
                        </div>
                      </div>
                      <Badge variant={isHitl ? "hitl" : "automated"} size="xs" dot>
                        {isHitl ? "STRICT HITL" : "AUTO"}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Execution Distribution & Vault Providers */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Execution Breakdown</CardTitle>
                <CardDescription>
                  Status distribution across last {recentRuns.length} runs
                </CardDescription>
              </div>
              <Layers className="h-4.5 w-4.5 text-[var(--text-muted)]" />
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : recentRuns.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                  Execute an agent to view live latency and status distribution.
                </p>
              ) : (
                <>
                  <div className="h-3 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden flex p-0.5 border border-[var(--border-subtle)]">
                    {runSummary.completedPct > 0 && (
                      <div
                        className="bg-[#22C58B] h-full rounded-full transition-all duration-300"
                        style={{ width: `${runSummary.completedPct}%` }}
                        title={`Completed: ${runSummary.completedPct}%`}
                      />
                    )}
                    {runSummary.hitlPct > 0 && (
                      <div
                        className="bg-[#F5B942] h-full rounded-full transition-all duration-300"
                        style={{ width: `${runSummary.hitlPct}%` }}
                        title={`Pending HITL: ${runSummary.hitlPct}%`}
                      />
                    )}
                    {runSummary.failedPct > 0 && (
                      <div
                        className="bg-[#F16B75] h-full rounded-full transition-all duration-300"
                        style={{ width: `${runSummary.failedPct}%` }}
                        title={`Failed: ${runSummary.failedPct}%`}
                      />
                    )}
                  </div>

                  <div className="space-y-2.5 text-xs pt-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium text-[var(--text-secondary)]">
                        <span className="h-2 w-2 rounded-full bg-[#22C58B] shadow-[0_0_6px_#22C58B]" />
                        Completed
                      </span>
                      <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                        {runSummary.completed} ({runSummary.completedPct}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium text-[var(--text-secondary)]">
                        <span className="h-2 w-2 rounded-full bg-[#F5B942] shadow-[0_0_6px_#F5B942]" />
                        Awaiting HITL / Pending
                      </span>
                      <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                        {runSummary.hitl} ({runSummary.hitlPct}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium text-[var(--text-secondary)]">
                        <span className="h-2 w-2 rounded-full bg-[#F16B75] shadow-[0_0_6px_#F16B75]" />
                        Failed / Cancelled
                      </span>
                      <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                        {runSummary.failed} ({runSummary.failedPct}%)
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Vault Providers</CardTitle>
                <CardDescription>Configured BYOK credentials</CardDescription>
              </div>
              <Link
                href="/settings/integrations"
                className="text-xs font-semibold text-[#A78BFA] hover:text-[#896EFF] transition-colors"
              >
                Manage Vault
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : integrations.length === 0 ? (
                <div className="text-xs text-[var(--text-muted)] py-3 text-center">
                  No BYOK keys configured yet.{" "}
                  <Link href="/settings/integrations" className="text-[#A78BFA] underline font-medium">
                    Add API key
                  </Link>
                </div>
              ) : (
                integrations.slice(0, 4).map((cred) => (
                  <div
                    key={cred.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 px-3.5 py-2.5 flex items-center justify-between gap-2.5 transition-colors hover:border-[var(--border-strong)]"
                  >
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                        {cred.name || cred.provider}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
                        {cred.category} · {cred.model_name || cred.provider}
                      </div>
                    </div>
                    <StatusBadge status={cred.connection_status} size="xs" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Executions Table */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recent Execution Activity</CardTitle>
            <CardDescription>
              Latest agent invocations with full reasoning trace inspection
            </CardDescription>
          </div>
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A78BFA] hover:text-[#896EFF] transition-colors"
          >
            Full Audit Log
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>

        {loading ? (
          <CardContent>
            <TableSkeleton rows={5} columns={5} />
          </CardContent>
        ) : recentRuns.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={Activity}
              title="No agent runs recorded"
              description="Launch an agent from the directory or a domain workspace to view live execution traces here."
              action={{ label: "Open Agent Directory", href: "/agents" }}
            />
          </CardContent>
        ) : (
          <div className="overflow-x-auto overscroll-contain custom-scroll">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-4">Agent</th>
                  <th className="py-3.5 px-4">Prompt / Input</th>
                  <th className="py-3.5 px-4">Latency</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
                {recentRuns.map((run) => {
                  const matchedAgent = run.agent_id ? agentLookup[run.agent_id] : undefined;
                  return (
                    <tr
                      key={run.id}
                      onClick={() => setSelectedRun(run)}
                      className="hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <StatusBadge status={run.status} size="xs" />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-semibold text-[var(--text-primary)]">
                        {matchedAgent?.metadata?.title || matchedAgent?.name || "Enterprise Agent"}
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
        )}
      </Card>

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
  
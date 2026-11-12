"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  History,
  Play,
  ShieldAlert,
  Sliders,
  Sparkles,
} from "lucide-react";
import {
  Agent,
  AgentRun,
  AgentStepTrace,
  api,
  HITLApprovalRequest,
  IntegrationCredential,
} from "@/lib/api";
import { getAgentDomainMeta } from "@/lib/agentRoutes";
import { formatDateTime, formatDuration } from "@/lib/format";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { FormGroup, SelectInput, TextareaInput } from "@/components/common/FormControls";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";
import { HITLReviewModal } from "@/components/HITLReviewModal";
import { StepTraceViewer } from "@/components/StepTraceViewer";

export default function AgentPlaygroundPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug || "";

  const [agent, setAgent] = useState<Agent | null>(null);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [llmProviders, setLlmProviders] = useState<IntegrationCredential[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);

  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [paramsJson, setParamsJson] = useState("{}");

  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [latestResult, setLatestResult] = useState<{
    run_id: string;
    status: string;
    answer?: string;
    sources?: any[];
    duration_ms?: number;
  } | null>(null);
  const [traces, setTraces] = useState<AgentStepTrace[]>([]);
  const [pendingHitl, setPendingHitl] = useState<HITLApprovalRequest | null>(null);

  const loadPlaygroundData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const [agentRes, agentsRes, integrationsRes, runsRes] = await Promise.all([
        api.getAgentBySlug(slug),
        api.listAgentsWithMetadata(),
        api.listIntegrations("llm"),
        api.runs(25),
      ]);

      setAgent(agentRes);
      setAllAgents(Array.isArray(agentsRes) ? agentsRes : []);

      // Filter strictly to active LLM category providers (never show Jira, DB, etc.)
      const strictLlms = (Array.isArray(integrationsRes) ? integrationsRes : []).filter(
        (cred) => cred.category === "llm" && cred.is_active,
      );
      setLlmProviders(strictLlms);

      const matchedRuns = (Array.isArray(runsRes) ? runsRes : []).filter(
        (r) => r.agent_id === agentRes.id,
      );
      setAgentRuns(matchedRuns.slice(0, 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent playground.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadPlaygroundData();
  }, [loadPlaygroundData]);

  const jsonValidationError = useMemo(() => {
    if (!paramsJson.trim()) return null;
    try {
      const parsed = JSON.parse(paramsJson);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return "Parameters must be a valid JSON object.";
      }
      return null;
    } catch {
      return "Invalid JSON syntax in parameters.";
    }
  }, [paramsJson]);

  const handleRunAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || jsonValidationError || executing) return;

    setExecuting(true);
    setError(null);
    setTraces([]);

    try {
      const parsedParams = paramsJson.trim() ? JSON.parse(paramsJson) : {};
      const res = await api.runUniversalAgent(
        slug,
        prompt.trim(),
        parsedParams,
        false,
        selectedProviderId || undefined,
      );
      setLatestResult(res);

      if (res.run_id) {
        try {
          const traceList = await api.getRunTraces(res.run_id);
          setTraces(Array.isArray(traceList) ? traceList : []);
        } catch {
          setTraces([]);
        }
      }

      if (res.status === "suspended_hitl") {
        try {
          const hitlQueue = await api.listPendingHitl();
          const match =
            hitlQueue.find((item) => item.run_id === res.run_id) || hitlQueue[0] || null;
          if (match) setPendingHitl(match);
        } catch {
          // Non-fatal
        }
      }

      void loadPlaygroundData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent execution failed.");
    } finally {
      setExecuting(false);
    }
  };

  const handleLoadHistoricalRun = async (run: AgentRun) => {
    setLatestResult({
      run_id: run.id,
      status: run.status,
      answer: run.answer || "",
      sources: run.sources || [],
      duration_ms: run.duration_ms || undefined,
    });
    try {
      const traceList = await api.getRunTraces(run.id);
      setTraces(Array.isArray(traceList) ? traceList : []);
    } catch {
      setTraces([]);
    }
  };

  const domainMeta = getAgentDomainMeta(slug, agent?.kind, agent?.metadata?.category);
  const AgentIcon = domainMeta.icon;
  const isHitl = Boolean(agent?.metadata?.is_hitl);

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[
          { label: "Overview", href: "/" },
          { label: "Agent Directory", href: "/agents" },
          { label: agent?.metadata?.title || agent?.name || slug },
        ]}
        title={agent?.metadata?.title || agent?.name || "Agent Playground"}
        icon={AgentIcon}
        badge={
          <div className="flex items-center gap-2">
            <Badge variant={isHitl ? "hitl" : "automated"} size="sm" dot>
              {isHitl ? "STRICT HITL" : "AUTOMATED"}
            </Badge>
            <Badge variant="neutral" size="sm">
              {domainMeta.categoryLabel}
            </Badge>
          </div>
        }
        description={
          agent?.metadata?.description ||
          agent?.description ||
          "Universal execution playground with BYOK provider override, runtime parameter injection, and live telemetry inspection."
        }
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            {allAgents.length > 0 && (
              <div className="w-60">
                <SelectInput
                  value={slug}
                  onChange={(e) => router.push(`/agents/${e.target.value}`)}
                  aria-label="Switch active agent"
                >
                  {allAgents.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.metadata?.title || item.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
            )}
            {domainMeta.workspaceHref && (
              <Link href={domainMeta.workspaceHref}>
                <Button variant="secondary" size="md" icon={ArrowUpRight} iconPosition="right">
                  {domainMeta.workspaceLabel || "Dedicated UI"}
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Left: Configuration & Runner */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Execution Configuration</CardTitle>
                <CardDescription>
                  Select a BYOK credential and dispatch an instruction prompt
                </CardDescription>
              </div>
              <Sliders className="h-4.5 w-4.5 text-[var(--text-muted)]" />
            </CardHeader>
            <CardContent>
              {loading && !agent ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <form onSubmit={handleRunAgent} className="space-y-4">
                  <FormGroup
                    label="BYOK LLM Provider Override"
                    description={
                      llmProviders.length > 0
                        ? "Filtered strictly to active LLM models configured in your Vault."
                        : "Using workspace default LLM provider (configure keys in Integration Vault)."
                    }
                  >
                    <SelectInput
                      value={selectedProviderId}
                      onChange={(e) => setSelectedProviderId(e.target.value)}
                    >
                      <option value="">Workspace Default LLM Provider</option>
                      {llmProviders.map((prov) => (
                        <option key={prov.id} value={prov.id}>
                          {prov.name || prov.provider} ({prov.model_name || prov.provider})
                          {prov.is_default ? " · Default" : ""}
                        </option>
                      ))}
                    </SelectInput>
                  </FormGroup>

                  <FormGroup label="Task / Instruction Prompt" required>
                    <TextareaInput
                      rows={5}
                      placeholder={`Describe the task for ${agent?.metadata?.title || slug}...`}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </FormGroup>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                    >
                      {showAdvanced ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      Advanced Runtime Parameters (JSON)
                    </button>

                    {showAdvanced && (
                      <div className="mt-3">
                        <FormGroup
                          label="Parameters JSON"
                          error={jsonValidationError || undefined}
                          description="Optional structured parameters forwarded to the agent engine."
                        >
                          <TextareaInput
                            monospace
                            rows={4}
                            value={paramsJson}
                            error={Boolean(jsonValidationError)}
                            onChange={(e) => setParamsJson(e.target.value)}
                          />
                        </FormGroup>
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    icon={Play}
                    loading={executing}
                    disabled={!prompt.trim() || Boolean(jsonValidationError)}
                  >
                    Execute Agent
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Recent Runs for this Agent */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recent Runs</CardTitle>
                <CardDescription>Click an execution to inspect response and traces</CardDescription>
              </div>
              <History className="h-4.5 w-4.5 text-[var(--text-muted)]" />
            </CardHeader>
            <CardContent className="space-y-2.5">
              {agentRuns.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">
                  No recent executions recorded for this agent.
                </p>
              ) : (
                agentRuns.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => void handleLoadHistoricalRun(run)}
                    className={`w-full text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                      latestResult?.run_id === run.id
                        ? "border-[#7657F6]/60 bg-[#7657F6]/14 shadow-xs"
                        : "border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/70 hover:bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={run.status} size="xs" />
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        {formatDuration(run.duration_ms)} · {formatDateTime(run.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-1 font-medium">
                      {run.question}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Execution Output & Telemetry */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Execution Output & Telemetry</CardTitle>
                <CardDescription>
                  Structured agent response, source citations, and tool trace timeline
                </CardDescription>
              </div>
              {latestResult && <StatusBadge status={latestResult.status} />}
            </CardHeader>
            <CardContent>
              {!latestResult ? (
                <EmptyState
                  icon={Cpu}
                  title="Ready for execution"
                  description="Enter a prompt on the left and run the agent to inspect its response, governance checkpoints, and step-by-step tool trace."
                />
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-[var(--text-muted)] border-b border-[var(--border-subtle)] pb-3.5">
                    <span className="font-mono bg-[var(--bg-elevated)]/60 px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                      Run ID: {latestResult.run_id}
                    </span>
                    {latestResult.duration_ms !== undefined && (
                      <span className="inline-flex items-center gap-1.5 font-mono font-medium text-[var(--text-secondary)]">
                        <Clock className="h-3.5 w-3.5 text-[#A78BFA]" />
                        {formatDuration(latestResult.duration_ms)}
                      </span>
                    )}
                  </div>

                  {latestResult.status === "suspended_hitl" && (
                    <AlertBanner
                      variant="warning"
                      title="Paused at Human-in-the-Loop Gate"
                      message="This execution requires manual operator review before finalizing its sensitive action."
                      action={
                        pendingHitl ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={ShieldAlert}
                            onClick={() => setPendingHitl(pendingHitl)}
                          >
                            Review Gate
                          </Button>
                        ) : (
                          <Link href="/hitl-approvals">
                            <Button size="sm" variant="secondary" icon={ShieldAlert}>
                              Open Approvals
                            </Button>
                          </Link>
                        )
                      }
                    />
                  )}

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Agent Response
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 sm:p-5 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto overscroll-contain custom-scroll">
                      {latestResult.answer || "No output body returned."}
                    </div>
                  </div>

                  {latestResult.sources && latestResult.sources.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Retrieved Citations ({latestResult.sources.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {latestResult.sources.map((src, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-3.5 text-xs space-y-1"
                          >
                            <div className="font-semibold text-[var(--text-primary)] truncate">
                              {src.title || src.filename || `Reference #${idx + 1}`}
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

                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Step Execution Trace ({traces.length})
                    </div>
                    <StepTraceViewer traces={traces} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <HITLReviewModal
        request={pendingHitl}
        onClose={() => setPendingHitl(null)}
        onResolved={() => {
          setPendingHitl(null);
          void loadPlaygroundData();
        }}
      />
    </div>
  );
}

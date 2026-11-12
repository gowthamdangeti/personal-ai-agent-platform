"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, GitBranch, Layers, Play, RefreshCw, Sparkles } from "lucide-react";
import { api, WorkflowDefinition, WorkflowExecution } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { FormGroup, TextareaInput, TextInput } from "@/components/common/FormControls";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";

const DEFAULT_DAG = JSON.stringify(
  {
    nodes: [
      { id: "ingest_research", agent_kind: "research", params: { depth: 1 } },
      { id: "extract_brief", agent_kind: "knowledge", params: { top_k: 4 } },
      { id: "qa_verify", agent_kind: "qa", params: { framework: "pytest" } },
    ],
    edges: [
      { source: "ingest_research", target: "extract_brief" },
      { source: "extract_brief", target: "qa_verify" },
    ],
  },
  null,
  2,
);

export default function WorkflowsPage() {
  const [workflowName, setWorkflowName] = useState("Research-to-Knowledge Pipeline");
  const [dagJson, setDagJson] = useState(DEFAULT_DAG);
  const [contextJson, setContextJson] = useState('{\n  "topic": "Enterprise AI governance"\n}');

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestOutput, setLatestOutput] = useState<{
    status: string;
    workflow_id: string;
    execution_id?: string;
    answer?: string;
  } | null>(null);

  const loadWorkflowsData = useCallback(async () => {
    setLoadingList(true);
    try {
      const [wfList, execList] = await Promise.all([
        api.listWorkflows(),
        api.listWorkflowExecutions(),
      ]);
      setWorkflows(Array.isArray(wfList) ? wfList : []);
      setExecutions(Array.isArray(execList) ? execList : []);
    } catch {
      // Non-blocking
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkflowsData();
  }, [loadWorkflowsData]);

  const parsedDag = useMemo(() => {
    try {
      const obj = JSON.parse(dagJson);
      if (!obj || typeof obj !== "object" || !Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
        return { error: "DAG must contain 'nodes' and 'edges' arrays.", nodes: [], edges: [] };
      }
      return {
        error: null,
        nodes: obj.nodes as Array<{ id: string; agent_kind: string; params?: Record<string, unknown> }>,
        edges: obj.edges as Array<{ source: string; target: string }>,
      };
    } catch {
      return { error: "Invalid JSON syntax in DAG definition.", nodes: [], edges: [] };
    }
  }, [dagJson]);

  const contextError = useMemo(() => {
    if (!contextJson.trim()) return null;
    try {
      const parsed = JSON.parse(contextJson);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return "Context must be a JSON object.";
      }
      return null;
    } catch {
      return "Invalid JSON syntax in runtime context.";
    }
  }, [contextJson]);

  const handleRunWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflowName.trim() || parsedDag.error || contextError || executing) return;

    setExecuting(true);
    setError(null);
    try {
      const parsedContext = contextJson.trim() ? JSON.parse(contextJson) : {};
      const res = await api.createWorkflow({
        name: workflowName.trim(),
        dag_schema: { nodes: parsedDag.nodes, edges: parsedDag.edges },
        context: parsedContext,
      });
      setLatestOutput(res);
      await loadWorkflowsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workflow orchestration failed.");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Operations & Automation" }, { label: "Workflow DAGs" }]}
        title="Multi-Agent Workflow Orchestrator"
        icon={Layers}
        badge={
          <Badge variant="accent" size="sm" dot>
            {parsedDag.nodes.length} Nodes · {parsedDag.edges.length} Edges
          </Badge>
        }
        description="Define topological agent pipelines in JSON, preview live graph dependencies, and run chained workflows."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={loadingList}
            onClick={() => void loadWorkflowsData()}
          >
            Refresh Runs
          </Button>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      {/* Live Visual DAG Topology Renderer */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Live Pipeline Graph Topology</CardTitle>
            <CardDescription>
              Dynamically rendered from your active DAG schema JSON definition
            </CardDescription>
          </div>
          <GitBranch className="h-4.5 w-4.5 text-[#A78BFA]" />
        </CardHeader>
        <CardContent>
          {parsedDag.error ? (
            <AlertBanner variant="warning" message={parsedDag.error} />
          ) : parsedDag.nodes.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Empty workflow graph"
              description="Add at least one node in the DAG schema below to visualize pipeline execution steps."
            />
          ) : (
            <div className="overflow-x-auto overscroll-contain custom-scroll py-2">
              <div className="flex items-center gap-3 min-w-max">
                {parsedDag.nodes.map((node, idx) => {
                  const outgoing = parsedDag.edges.filter((edge) => edge.source === node.id);
                  return (
                    <React.Fragment key={node.id || idx}>
                      <div className="rounded-xl border border-[#7657F6]/30 bg-[var(--bg-sidebar)]/90 px-4 py-3 min-w-[190px] space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-bold text-[#A78BFA]">
                            #{idx + 1}
                          </span>
                          <Badge variant="neutral" size="xs">
                            {node.agent_kind || "agent"}
                          </Badge>
                        </div>
                        <div className="text-xs font-bold font-mono text-[var(--text-primary)]">
                          {node.id}
                        </div>
                        {outgoing.length > 0 && (
                          <div className="text-[10.5px] text-[var(--text-muted)] font-mono">
                            → {outgoing.map((e) => e.target).join(", ")}
                          </div>
                        )}
                      </div>
                      {idx < parsedDag.nodes.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Left: DAG Definition & Context Input */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <div>
              <CardTitle>DAG Schema Blueprint</CardTitle>
              <CardDescription>Edit topological node graph and initial runtime context</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRunWorkflow} className="space-y-4">
              <FormGroup label="Workflow Name" required>
                <TextInput
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                />
              </FormGroup>

              <FormGroup
                label="DAG Definition JSON (Nodes & Edges)"
                error={parsedDag.error || undefined}
                required
              >
                <TextareaInput
                  monospace
                  rows={10}
                  error={Boolean(parsedDag.error)}
                  value={dagJson}
                  onChange={(e) => setDagJson(e.target.value)}
                />
              </FormGroup>

              <FormGroup
                label="Initial Context JSON Parameters"
                error={contextError || undefined}
              >
                <TextareaInput
                  monospace
                  rows={4}
                  error={Boolean(contextError)}
                  value={contextJson}
                  onChange={(e) => setContextJson(e.target.value)}
                />
              </FormGroup>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                icon={Play}
                loading={executing}
                disabled={
                  !workflowName.trim() ||
                  Boolean(parsedDag.error) ||
                  Boolean(contextError)
                }
              >
                Create & Execute Workflow
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Output, Saved Workflows & Execution Log */}
        <div className="lg:col-span-6 space-y-6">
          {latestOutput && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Latest Pipeline Output</CardTitle>
                  <CardDescription>Execution ID: {latestOutput.execution_id || latestOutput.workflow_id}</CardDescription>
                </div>
                <StatusBadge status={latestOutput.status} />
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 sm:p-5 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto overscroll-contain custom-scroll">
                  {latestOutput.answer || "Workflow executed."}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Saved Workflows ({workflows.length})</CardTitle>
                <CardDescription>Click a definition to load it into the DAG schema editor</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 max-h-64 overflow-y-auto overscroll-contain custom-scroll">
              {loadingList && workflows.length === 0 ? (
                <Skeleton className="h-20 w-full" />
              ) : workflows.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-5">
                  No workflows saved yet in this workspace.
                </p>
              ) : (
                workflows.map((wf) => (
                  <button
                    key={wf.id}
                    type="button"
                    onClick={() => {
                      setWorkflowName(wf.name);
                      setDagJson(JSON.stringify(wf.dag_schema, null, 2));
                    }}
                    className="w-full text-left rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 hover:bg-[var(--bg-elevated)] hover:border-[var(--border-strong)] p-3.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {wf.name}
                      </span>
                      <Badge variant="neutral" size="xs">
                        {wf.dag_schema?.nodes?.length || 0} nodes
                      </Badge>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-1.5 font-mono">
                      Created {formatDateTime(wf.created_at)}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Execution Log ({executions.length})</CardTitle>
                <CardDescription>Recent topological pipeline runs</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 max-h-64 overflow-y-auto overscroll-contain custom-scroll">
              {executions.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-5">
                  No workflow executions recorded yet.
                </p>
              ) : (
                executions.map((exec) => (
                  <div
                    key={exec.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-medium text-[var(--text-primary)] truncate">
                        {exec.id.slice(0, 16)}...
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Started {formatDateTime(exec.started_at)}
                      </div>
                    </div>
                    <StatusBadge status={exec.status} size="xs" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

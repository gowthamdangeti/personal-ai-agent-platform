"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { AgentRun, api, HITLApprovalRequest } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/format";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/Skeleton";
import { Tabs } from "@/components/common/Tabs";
import { HITLReviewModal } from "@/components/HITLReviewModal";
import { RunInspectorModal } from "@/components/RunInspectorModal";

export default function HitlApprovalsPage() {
  const [queue, setQueue] = useState<HITLApprovalRequest[]>([]);
  const [auditRuns, setAuditRuns] = useState<AgentRun[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<HITLApprovalRequest | null>(null);
  const [inspectRun, setInspectRun] = useState<AgentRun | null>(null);

  const loadGovernance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, runsRes] = await Promise.all([
        api.listPendingHitl(),
        api.runs(50),
      ]);
      setQueue(Array.isArray(pendingRes) ? pendingRes : []);
      const hitlRelated = (Array.isArray(runsRes) ? runsRes : []).filter((r) => {
        const s = (r.status || "").toLowerCase();
        return ["suspended_hitl", "cancelled", "rejected", "approved"].includes(s);
      });
      setAuditRuns(hitlRelated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load governance queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGovernance();
  }, [loadGovernance]);

  const pendingItems = queue.filter((q) => q.status === "pending");

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Governance & Observability" }, { label: "HITL Approvals" }]}
        title="Human-in-the-Loop Governance"
        icon={ShieldAlert}
        badge={
          <Badge variant={pendingItems.length > 0 ? "warning" : "success"} size="sm" dot>
            {pendingItems.length} Actions Pending Review
          </Badge>
        }
        description="Review, modify, approve, or reject suspended high-risk actions across procurement, finance, and IT operations."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={loading}
            onClick={() => void loadGovernance()}
          >
            Refresh Queue
          </Button>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      <Tabs
        items={[
          { id: "pending", label: "Pending Approvals", count: pendingItems.length, icon: ShieldAlert },
          { id: "audit", label: "Governance Audit Log", count: auditRuns.length, icon: ShieldCheck },
        ]}
        activeId={activeTab}
        onChange={setActiveTab}
      />

      {loading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : activeTab === "pending" ? (
        pendingItems.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All governance checkpoints clear"
            description="There are currently no suspended agent actions waiting for operator review or authorization."
          />
        ) : (
          <div className="space-y-4">
            {pendingItems.map((item) => (
              <Card key={item.id} className="p-6 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <StatusBadge status={item.status} size="xs" />
                      <span className="text-[13.5px] font-bold font-mono text-[var(--text-primary)]">
                        {item.action_type}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] font-mono">
                      Run ID: {item.run_id} · Requested {formatDateTime(item.created_at)}
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    icon={ShieldAlert}
                    onClick={() => setSelectedRequest(item)}
                  >
                    Review & Decide
                  </Button>
                </div>

                <pre className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 text-xs font-mono text-[var(--text-secondary)] overflow-x-auto overscroll-contain custom-scroll max-h-56 leading-relaxed">
                  {JSON.stringify(item.action_payload, null, 2)}
                </pre>
              </Card>
            ))}
          </div>
        )
      ) : auditRuns.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No HITL-governed runs logged yet"
          description="Executed actions that trigger strict HITL checkpoints will appear in this audit history."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto overscroll-contain custom-scroll">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-3.5 px-6">Decision Status</th>
                  <th className="py-3.5 px-4">Run ID</th>
                  <th className="py-3.5 px-4">Action Prompt</th>
                  <th className="py-3.5 px-4">Latency</th>
                  <th className="py-3.5 px-6">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
                {auditRuns.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => setInspectRun(run)}
                    className="hover:bg-[var(--bg-elevated)]/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      <StatusBadge status={run.status} size="xs" />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {run.id.slice(0, 10)}...
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="truncate text-[var(--text-secondary)] font-medium">{run.question}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {formatDuration(run.duration_ms)}
                    </td>
                    <td className="py-3.5 px-6 text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {formatDateTime(run.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <HITLReviewModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onResolved={() => {
          setSelectedRequest(null);
          void loadGovernance();
        }}
      />

      <RunInspectorModal
        run={inspectRun}
        onClose={() => setInspectRun(null)}
      />
    </div>
  );
}

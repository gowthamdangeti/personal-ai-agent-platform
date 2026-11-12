"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Play, RefreshCw, Server, ShieldAlert, Sparkles } from "lucide-react";
import { api, IncidentHypothesis, IncidentTicket } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import {
  FormGroup,
  SelectInput,
  TextareaInput,
  TextInput,
} from "@/components/common/FormControls";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/Skeleton";

export default function ItOperationsPage() {
  const [serviceName, setServiceName] = useState("");
  const [severity, setSeverity] = useState<"P1" | "P2" | "P3" | "P4">("P2");
  const [errorLogs, setErrorLogs] = useState("");

  const [incidents, setIncidents] = useState<IncidentTicket[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [diagnosing, setDiagnosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [diagnosis, setDiagnosis] = useState<{
    status: string;
    answer?: string;
    hypotheses: IncidentHypothesis[];
  } | null>(null);

  const loadIncidents = useCallback(async () => {
    setLoadingIncidents(true);
    try {
      const list = await api.listItIncidents();
      setIncidents(Array.isArray(list) ? list : []);
    } catch {
      // Non-blocking
    } finally {
      setLoadingIncidents(false);
    }
  }, []);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  const handleDiagnose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim() || !errorLogs.trim() || diagnosing) return;

    setDiagnosing(true);
    setError(null);
    try {
      const res = await api.diagnoseItIncident(
        serviceName.trim(),
        errorLogs.trim(),
        severity,
      );
      setDiagnosis({
        status: res.status,
        answer: res.answer,
        hypotheses: Array.isArray(res.hypotheses) ? res.hypotheses : [],
      });
      await loadIncidents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incident RCA execution failed.");
    } finally {
      setDiagnosing(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Operations & Automation" }, { label: "IT Operations" }]}
        title="IT Operations & Incident Triage"
        icon={Server}
        badge={
          <Badge variant="hitl" size="sm" dot>
            <ShieldAlert className="h-3 w-3 mr-1" />
            STRICT HITL REMEDIATION
          </Badge>
        }
        description="Analyze service stack traces, rank root-cause hypotheses, and guard production restarts behind human operator approval."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={loadingIncidents}
            onClick={() => void loadIncidents()}
          >
            Refresh Tickets
          </Button>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Left: Input Form */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Incident Telemetry Input</CardTitle>
              <CardDescription>Provide impacted microservice name, severity level, and stderr logs</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDiagnose} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormGroup label="Impacted Service" required>
                  <TextInput
                    placeholder="e.g. payment-gateway"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                  />
                </FormGroup>

                <FormGroup label="Incident Severity">
                  <SelectInput
                    value={severity}
                    onChange={(e) =>
                      setSeverity(e.target.value as "P1" | "P2" | "P3" | "P4")
                    }
                  >
                    <option value="P1">P1 · Critical Outage</option>
                    <option value="P2">P2 · High Impact</option>
                    <option value="P3">P3 · Degraded</option>
                    <option value="P4">P4 · Low Priority</option>
                  </SelectInput>
                </FormGroup>
              </div>

              <FormGroup label="Error Logs & Traceback" required>
                <TextareaInput
                  monospace
                  rows={8}
                  placeholder="Paste stderr logs, stack traces, pod eviction events, or unhandled exceptions..."
                  value={errorLogs}
                  onChange={(e) => setErrorLogs(e.target.value)}
                />
              </FormGroup>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                icon={Play}
                loading={diagnosing}
                disabled={!serviceName.trim() || !errorLogs.trim()}
              >
                Diagnose Incident Root Cause
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Diagnosis & Ticket History */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Root Cause Hypotheses</CardTitle>
                <CardDescription>Ranked failure diagnosis and recommended remediation steps</CardDescription>
              </div>
              {diagnosis && <StatusBadge status={diagnosis.status} />}
            </CardHeader>
            <CardContent>
              {!diagnosis ? (
                <EmptyState
                  icon={Server}
                  title="No active incident diagnosis"
                  description="Submit a service name and error logs on the left to inspect ranked RCA hypotheses and runbooks."
                />
              ) : (
                <div className="space-y-5">
                  {diagnosis.status === "suspended_hitl" && (
                    <AlertBanner
                      variant="warning"
                      title="Remediation Awaiting Operator Approval"
                      message="Automated remediation proposed by the SRE agent is paused pending human operator authorization."
                      action={
                        <Link href="/hitl-approvals">
                          <Button size="sm" variant="secondary">
                            Open Queue
                          </Button>
                        </Link>
                      }
                    />
                  )}

                  {diagnosis.hypotheses.length > 0 && (
                    <div className="space-y-3">
                      {diagnosis.hypotheses.map((item) => (
                        <div
                          key={item.rank}
                          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-4 space-y-2 transition-colors hover:border-[var(--border-strong)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13.5px] font-bold text-[var(--text-primary)]">
                              Hypothesis #{item.rank}: {item.hypothesis}
                            </span>
                            <Badge variant="accent" size="xs">
                              {Math.round(Number(item.confidence) * 100)}% Confidence
                            </Badge>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            Recommended Action: <span className="font-mono text-[#A78BFA] font-medium">{item.recommended_action}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {diagnosis.answer && (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 sm:p-5 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed max-h-[350px] overflow-y-auto overscroll-contain custom-scroll">
                      {diagnosis.answer}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Incident Ticket History ({incidents.length})</CardTitle>
                <CardDescription>Logged incidents evaluated by the SRE specialist</CardDescription>
              </div>
            </CardHeader>
            {loadingIncidents ? (
              <CardContent>
                <TableSkeleton rows={3} columns={4} />
              </CardContent>
            ) : incidents.length === 0 ? (
              <CardContent>
                <p className="text-xs text-[var(--text-muted)] text-center py-6">
                  No historical incident tickets recorded yet in this workspace.
                </p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto overscroll-contain custom-scroll">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="py-3.5 px-4">Severity</th>
                      <th className="py-3.5 px-4">Service</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
                    {incidents.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={ticket.severity === "P1" ? "danger" : "warning"}
                            size="xs"
                            dot
                          >
                            {ticket.severity}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[var(--text-primary)]">
                          {ticket.service_name}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={ticket.status} size="xs" />
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[var(--text-muted)]">
                          {formatDateTime(ticket.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

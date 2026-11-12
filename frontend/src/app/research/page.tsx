"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, ExternalLink, FileSearch, Play, RefreshCw, Sparkles } from "lucide-react";
import { api, ResearchProject } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { FormGroup, SelectInput, TextInput } from "@/components/common/FormControls";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";

export default function DeepResearchPage() {
  const [topic, setTopic] = useState("");
  const [depth, setDepth] = useState("2");
  const [reportFormat, setReportFormat] = useState<"executive_brief" | "comprehensive_report">(
    "comprehensive_report",
  );

  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeReport, setActiveReport] = useState<{
    title: string;
    content: string;
    status: string;
    sources: Array<{ title?: string; url?: string }>;
  } | null>(null);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const list = await api.listResearchProjects();
      setProjects(Array.isArray(list) ? list : []);
    } catch {
      // Non-blocking if initial list is empty/unavailable
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await api.researchTopic(topic.trim(), Number(depth) || 2, reportFormat);
      setActiveReport({
        title: topic.trim(),
        content: res.answer || "",
        status: res.status || "completed",
        sources: Array.isArray(res.sources) ? res.sources : [],
      });
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deep research execution failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Knowledge & Intelligence" }, { label: "Deep Research" }]}
        title="Multi-Hop Deep Research"
        icon={FileSearch}
        badge={
          <Badge variant="automated" size="sm" dot>
            Web + Internal Synthesis
          </Badge>
        }
        description="Execute multi-step market intelligence, technical due diligence, and competitive briefs with verifiable citations."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={loadingProjects}
            onClick={() => void loadProjects()}
          >
            Refresh Archive
          </Button>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Left: Form + Research Archive */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Research Directive</CardTitle>
                <CardDescription>Configure crawl depth and deliverable format</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResearch} className="space-y-4">
                <FormGroup label="Research Topic or Thesis" required>
                  <TextInput
                    placeholder="e.g. Zero-trust AI gateway architectures in regulated FinTech"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </FormGroup>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormGroup label="Search Depth">
                    <SelectInput value={depth} onChange={(e) => setDepth(e.target.value)}>
                      <option value="1">Depth 1 · Rapid Brief</option>
                      <option value="2">Depth 2 · Standard Synthesis</option>
                      <option value="3">Depth 3 · Exhaustive Audit</option>
                    </SelectInput>
                  </FormGroup>

                  <FormGroup label="Deliverable Format">
                    <SelectInput
                      value={reportFormat}
                      onChange={(e) =>
                        setReportFormat(
                          e.target.value as "executive_brief" | "comprehensive_report",
                        )
                      }
                    >
                      <option value="comprehensive_report">Comprehensive Report</option>
                      <option value="executive_brief">Executive Brief</option>
                    </SelectInput>
                  </FormGroup>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  icon={Play}
                  loading={running}
                  disabled={!topic.trim()}
                >
                  Start Research Pipeline
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Saved Research Projects</CardTitle>
                <CardDescription>Select an archived deliverable to inspect</CardDescription>
              </div>
              <BookOpen className="h-4.5 w-4.5 text-[var(--text-muted)]" />
            </CardHeader>
            <CardContent className="space-y-2.5 max-h-[360px] overflow-y-auto overscroll-contain custom-scroll">
              {loadingProjects && projects.length === 0 ? (
                <Skeleton className="h-24 w-full" />
              ) : projects.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">
                  No archived research briefs yet in this workspace.
                </p>
              ) : (
                projects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() =>
                      setActiveReport({
                        title: proj.title || proj.query,
                        content: proj.final_report_md || "Report content not yet persisted.",
                        status: proj.status,
                        sources: proj.sources_summary || [],
                      })
                    }
                    className="w-full text-left rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 hover:bg-[var(--bg-elevated)] hover:border-[var(--border-strong)] p-3.5 space-y-1.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {proj.title || proj.query}
                      </span>
                      <StatusBadge status={proj.status} size="xs" />
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono">
                      Depth {proj.depth} · {formatDateTime(proj.created_at)}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Synthesized Brief Output */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="truncate">
                  {activeReport?.title || "Synthesized Research Deliverable"}
                </CardTitle>
                <CardDescription>
                  Structured multi-source intelligence report with grounded citations
                </CardDescription>
              </div>
              {activeReport && <StatusBadge status={activeReport.status} />}
            </CardHeader>
            <CardContent>
              {!activeReport ? (
                <EmptyState
                  icon={FileSearch}
                  title="No active research report"
                  description="Launch a deep-dive topic on the left or select a previously saved project from the archive."
                />
              ) : (
                <div className="space-y-6">
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-5 sm:p-6 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed max-h-[580px] overflow-y-auto overscroll-contain custom-scroll">
                    {activeReport.content}
                  </div>

                  {activeReport.sources.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Referenced Sources ({activeReport.sources.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeReport.sources.map((src, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-3.5 text-xs flex items-start justify-between gap-2.5 transition-colors hover:border-[var(--border-strong)]"
                          >
                            <span className="font-semibold text-[var(--text-primary)] line-clamp-2">
                              {src.title || src.url || `Source #${idx + 1}`}
                            </span>
                            {src.url && (
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#A78BFA] hover:text-[#896EFF] shrink-0 p-1"
                                title="Open source URL"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, Play, RefreshCw, TestTube, Sparkles } from "lucide-react";
import { api, TestSuite } from "@/lib/api";
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
import { Skeleton } from "@/components/common/Skeleton";

export default function QaTestingPage() {
  const [targetService, setTargetService] = useState("checkout-api");
  const [framework, setFramework] = useState<"pytest" | "playwright" | "jest">("pytest");
  const [specOrDiff, setSpecOrDiff] = useState("");

  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loadingSuites, setLoadingSuites] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [activeSuite, setActiveSuite] = useState<{
    name: string;
    framework: string;
    code: string;
    summary?: string;
  } | null>(null);

  const loadSuites = useCallback(async () => {
    setLoadingSuites(true);
    try {
      const list = await api.listTestSuites();
      setSuites(Array.isArray(list) ? list : []);
    } catch {
      // Non-blocking
    } finally {
      setLoadingSuites(false);
    }
  }, []);

  useEffect(() => {
    void loadSuites();
  }, [loadSuites]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specOrDiff.trim() || !targetService.trim() || generating) return;

    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateTests(
        specOrDiff.trim(),
        framework,
        targetService.trim(),
      );
      setActiveSuite({
        name: `${targetService.trim()} (${framework})`,
        framework,
        code: res.spec_code || res.answer || "",
        summary: res.answer,
      });
      await loadSuites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test suite generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!activeSuite?.code) return;
    await navigator.clipboard.writeText(activeSuite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!activeSuite?.code) return;
    const ext =
      activeSuite.framework === "pytest"
        ? "py"
        : activeSuite.framework === "playwright"
          ? "spec.ts"
          : "test.ts";
    const blob = new Blob([activeSuite.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `generated_suite.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Operations & Automation" }, { label: "QA Testing" }]}
        title="QA Test Suite Generator"
        icon={TestTube}
        badge={
          <Badge variant="automated" size="sm" dot>
            Pytest · Playwright · Jest
          </Badge>
        }
        description="Synthesize deterministic end-to-end, contract, and edge-case test specifications from OpenAPI specs or git diffs."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={loadingSuites}
            onClick={() => void loadSuites()}
          >
            Refresh Suites
          </Button>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Left: Input Specification + Archive */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Specification & Target Service</CardTitle>
                <CardDescription>Describe endpoints, schema diff, or user flows</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormGroup label="Target Service" required>
                    <TextInput
                      placeholder="e.g. billing-service"
                      value={targetService}
                      onChange={(e) => setTargetService(e.target.value)}
                    />
                  </FormGroup>

                  <FormGroup label="Test Framework">
                    <SelectInput
                      value={framework}
                      onChange={(e) =>
                        setFramework(e.target.value as "pytest" | "playwright" | "jest")
                      }
                    >
                      <option value="pytest">Pytest (Python API)</option>
                      <option value="playwright">Playwright (E2E)</option>
                      <option value="jest">Jest (Unit / TS)</option>
                    </SelectInput>
                  </FormGroup>
                </div>

                <FormGroup label="API Spec, Diff, or Acceptance Criteria" required>
                  <TextareaInput
                    monospace
                    rows={8}
                    placeholder="Paste OpenAPI paths, PR diff, or endpoint requirements..."
                    value={specOrDiff}
                    onChange={(e) => setSpecOrDiff(e.target.value)}
                  />
                </FormGroup>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  icon={Play}
                  loading={generating}
                  disabled={!specOrDiff.trim() || !targetService.trim()}
                >
                  Generate Test Suite
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Generated Suite Archive ({suites.length})</CardTitle>
                <CardDescription>Previously generated test specifications</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 max-h-[340px] overflow-y-auto overscroll-contain custom-scroll">
              {loadingSuites && suites.length === 0 ? (
                <Skeleton className="h-20 w-full" />
              ) : suites.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">
                  No test suites generated yet in this workspace.
                </p>
              ) : (
                suites.map((suite) => (
                  <button
                    key={suite.id}
                    type="button"
                    onClick={() =>
                      setActiveSuite({
                        name: suite.name,
                        framework: suite.framework,
                        code: suite.spec_code,
                      })
                    }
                    className={`w-full text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                      activeSuite?.name === `${suite.target_service} · ${suite.name}`
                        ? "border-[#7657F6]/60 bg-[#7657F6]/14 shadow-xs"
                        : "border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 hover:bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {suite.target_service} · {suite.name}
                      </span>
                      <StatusBadge status={suite.status} size="xs" />
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)] mt-1.5">
                      {suite.framework} · {formatDateTime(suite.created_at)}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Code Preview & Export */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="truncate">
                  {activeSuite?.name || "Generated Test Code"}
                </CardTitle>
                <CardDescription>
                  Ready to copy or export directly into your continuous integration harness
                </CardDescription>
              </div>
              {activeSuite && (
                <div className="flex items-center gap-2.5 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copied ? Check : Copy}
                    onClick={() => void handleCopy()}
                  >
                    {copied ? "Copied" : "Copy Code"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    onClick={handleDownload}
                  >
                    Export
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!activeSuite ? (
                <EmptyState
                  icon={TestTube}
                  title="No test suite active"
                  description="Provide a service specification or code diff on the left to generate runnable tests."
                />
              ) : (
                <pre className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 sm:p-5 text-xs font-mono text-[var(--text-primary)] overflow-x-auto overscroll-contain custom-scroll max-h-[640px] leading-relaxed">
                  {activeSuite.code}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

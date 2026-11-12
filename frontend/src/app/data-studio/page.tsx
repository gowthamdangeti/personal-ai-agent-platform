"use client";

import React, { useEffect, useState } from "react";
import { Check, Copy, Database, Download, Play, Sparkles } from "lucide-react";
import { api, IntegrationCredential, PlotlyChartSpec } from "@/lib/api";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { FormGroup, SelectInput, TextareaInput } from "@/components/common/FormControls";
import { PageHeader } from "@/components/common/PageHeader";
import { PlotlyChartRenderer } from "@/components/PlotlyChartRenderer";

export default function DataStudioPage() {
  const [prompt, setPrompt] = useState("");
  const [chartType, setChartType] = useState("bar");
  const [connections, setConnections] = useState<IntegrationCredential[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const [result, setResult] = useState<{
    sql: string;
    row_count: number;
    data: Array<Record<string, unknown>>;
    chart: PlotlyChartSpec | null;
    answer?: string;
  } | null>(null);

  useEffect(() => {
    api
      .listIntegrations("database")
      .then((creds) => {
        const activeDbs = (Array.isArray(creds) ? creds : []).filter(
          (c) => c.category === "database" && c.is_active,
        );
        setConnections(activeDbs);
      })
      .catch(() => {});
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || running) return;

    setRunning(true);
    setError(null);
    try {
      const res = await api.textToSql(
        prompt.trim(),
        chartType,
        selectedConnectionId || undefined,
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Text-to-SQL query execution failed.");
    } finally {
      setRunning(false);
    }
  };

  const handleCopySql = async () => {
    if (!result?.sql) return;
    await navigator.clipboard.writeText(result.sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 1800);
  };

  const handleExportCsv = () => {
    if (!result?.data || result.data.length === 0) return;
    const headers = Object.keys(result.data[0]);
    const rows = [
      headers.join(","),
      ...result.data.map((row) =>
        headers.map((h) => JSON.stringify(row[h] ?? "")).join(","),
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "data_studio_export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = result?.data && result.data.length > 0 ? Object.keys(result.data[0]) : [];

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Operations & Automation" }, { label: "Data Studio SQL" }]}
        title="Analytical Data Studio (Text-to-SQL)"
        icon={Database}
        badge={
          <Badge variant="automated" size="sm" dot>
            Read-Only Guardrail
          </Badge>
        }
        description="Translate plain-English analytical questions into validated read-only SQL queries, charts, and CSV exports."
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Query Formulation Prompt</CardTitle>
            <CardDescription>Describe the metrics, cohort breakdown, or timeseries you want to inspect</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormGroup label="Target Database Connection">
                <SelectInput
                  value={selectedConnectionId}
                  onChange={(e) => setSelectedConnectionId(e.target.value)}
                >
                  <option value="">Platform Workspace SQLite</option>
                  {connections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name || conn.provider} ({conn.provider})
                    </option>
                  ))}
                </SelectInput>
              </FormGroup>

              <FormGroup label="Chart Visualization">
                <SelectInput value={chartType} onChange={(e) => setChartType(e.target.value)}>
                  <option value="bar">Bar Chart</option>
                  <option value="pie">Distribution Breakdown</option>
                  <option value="line">Series Plot</option>
                </SelectInput>
              </FormGroup>
            </div>

            <FormGroup label="Analytical Question in Plain English" required>
              <TextareaInput
                rows={3}
                placeholder="e.g. Show total agent runs grouped by status, or top vendors by purchase order amount..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </FormGroup>

            <div className="flex justify-end pt-1">
              <Button type="submit" icon={Play} loading={running} disabled={!prompt.trim()}>
                Generate & Execute SQL
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!result ? (
        <EmptyState
          icon={Database}
          title="No active query output"
          description="Ask an analytical question above to inspect generated SQL, charts, and tabular rows."
        />
      ) : (
        <div className="space-y-6">
          {/* Generated SQL Block */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Generated Read-Only SQL</CardTitle>
                <CardDescription>{result.row_count} rows returned</CardDescription>
              </div>
              <div className="flex items-center gap-2.5">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={copiedSql ? Check : Copy}
                  onClick={() => void handleCopySql()}
                >
                  {copiedSql ? "Copied" : "Copy SQL"}
                </Button>
                {result.data.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    onClick={handleExportCsv}
                  >
                    Export CSV
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 text-xs font-mono text-[#A78BFA] overflow-x-auto overscroll-contain custom-scroll leading-relaxed">
                {result.sql}
              </pre>
              {result.answer && (
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {result.answer}
                </p>
              )}
            </CardContent>
          </Card>

          {result.chart && <PlotlyChartRenderer spec={result.chart} />}

          {columns.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>Query Result Set</CardTitle>
                  <CardDescription>First {result.data.length} returned records</CardDescription>
                </div>
              </CardHeader>
              <div className="overflow-x-auto overscroll-contain custom-scroll">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {columns.map((col) => (
                        <th key={col} className="py-3.5 px-4 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-xs font-mono">
                    {result.data.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                        {columns.map((col) => (
                          <td
                            key={`${rIdx}-${col}`}
                            className="py-3 px-4 text-[var(--text-secondary)] whitespace-nowrap max-w-xs truncate"
                          >
                            {row[col] === null || row[col] === undefined ? "—" : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

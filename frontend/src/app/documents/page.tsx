"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, History, Play, RefreshCw, Upload, Sparkles } from "lucide-react";
import { api, DocumentItem, ExtractionRecord } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
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

const SCHEMA_PRESETS: Record<string, string> = {
  invoice_extraction: JSON.stringify(
    {
      invoice_number: "string",
      vendor_name: "string",
      invoice_date: "YYYY-MM-DD",
      total_amount: "number",
      currency: "string",
      line_items: ["object"],
    },
    null,
    2,
  ),
  contract_clauses: JSON.stringify(
    {
      parties: ["string"],
      effective_date: "YYYY-MM-DD",
      termination_notice_days: "number",
      liability_cap: "string",
      governing_law: "string",
    },
    null,
    2,
  ),
  general_extraction: JSON.stringify(
    {
      document_title: "string",
      key_entities: ["string"],
      summary: "string",
      action_required: "boolean",
    },
    null,
    2,
  ),
};

export default function DocumentProcessingPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [schemaName, setSchemaName] = useState("invoice_extraction");
  const [targetJsonText, setTargetJsonText] = useState(SCHEMA_PRESETS.invoice_extraction);

  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [extractionResult, setExtractionResult] = useState<{
    status: string;
    extraction_id?: string;
    answer?: string;
    extracted_data: Record<string, unknown>;
    confidence_scores?: Record<string, number>;
  } | null>(null);
  const [records, setRecords] = useState<ExtractionRecord[]>([]);

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const docs = await api.documents();
      const ready = (Array.isArray(docs) ? docs : []).filter((d) => d.status === "ready");
      setDocuments(Array.isArray(docs) ? docs : []);
      if (!selectedDocId && ready.length > 0) {
        setSelectedDocId(ready[0].id);
      } else if (!selectedDocId && docs.length > 0) {
        setSelectedDocId(docs[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    } finally {
      setLoadingDocs(false);
    }
  }, [selectedDocId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!selectedDocId) {
      setRecords([]);
      return;
    }
    api
      .listExtractionRecords(selectedDocId)
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]));
  }, [selectedDocId]);

  const jsonError = useMemo(() => {
    if (!targetJsonText.trim()) return null;
    try {
      const parsed = JSON.parse(targetJsonText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return "Target schema must be a JSON object.";
      }
      return null;
    } catch {
      return "Invalid JSON schema syntax.";
    }
  }, [targetJsonText]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const created = await api.upload(file);
      await loadDocuments();
      setSelectedDocId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || jsonError || extracting) return;

    setExtracting(true);
    setError(null);
    try {
      const parsedSchema = targetJsonText.trim() ? JSON.parse(targetJsonText) : undefined;
      const res = await api.extractDocumentData(
        selectedDocId,
        schemaName.trim() || "general_extraction",
        parsedSchema,
      );
      setExtractionResult(res);
      const refreshedRecords = await api.listExtractionRecords(selectedDocId);
      setRecords(Array.isArray(refreshedRecords) ? refreshedRecords : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Structured extraction failed.");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Knowledge & Intelligence" }, { label: "Document Processing" }]}
        title="Document Schema Extraction"
        icon={FileText}
        badge={
          <Badge variant="automated" size="sm" dot>
            Structured JSON
          </Badge>
        }
        description="Extract deterministic typed fields, confidence scores, and schema records from uploaded documents."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={loadingDocs}
              onClick={() => void loadDocuments()}
            >
              Refresh
            </Button>
            <label className="inline-block">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.txt,.md,.csv,.json,.docx"
                onChange={handleUpload}
                disabled={uploading}
              />
              <span className="inline-flex items-center justify-center h-8.5 px-3.5 text-xs font-semibold rounded-lg gap-2 bg-[#7657F6] hover:bg-[#896EFF] text-white border border-[#9A82FF]/40 cursor-pointer transition-all shadow-xs shadow-[#7657F6]/25">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload File"}
              </span>
            </label>
          </div>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Left: Extraction Configuration */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Extraction Parameters</CardTitle>
              <CardDescription>Choose target file and schema blueprint</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDocs && documents.length === 0 ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <form onSubmit={handleExtract} className="space-y-4">
                <FormGroup label="Target Document" required>
                  <SelectInput
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                  >
                    <option value="">Select a document...</option>
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.filename} ({formatBytes(doc.size_bytes, doc.byte_size)} · {doc.status})
                      </option>
                    ))}
                  </SelectInput>
                </FormGroup>

                <FormGroup label="Schema Template Blueprint">
                  <div className="flex flex-wrap gap-2 mb-2.5">
                    {Object.keys(SCHEMA_PRESETS).map((presetKey) => (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() => {
                          setSchemaName(presetKey);
                          setTargetJsonText(SCHEMA_PRESETS[presetKey]);
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          schemaName === presetKey
                            ? "bg-[#7657F6]/20 border-[#7657F6]/50 text-[#A78BFA] shadow-xs"
                            : "bg-[var(--bg-sidebar)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        {presetKey.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                  <TextInput
                    placeholder="Schema identifier (e.g. invoice_extraction)"
                    value={schemaName}
                    onChange={(e) => setSchemaName(e.target.value)}
                  />
                </FormGroup>

                <FormGroup
                  label="Target JSON Schema Blueprint"
                  error={jsonError || undefined}
                >
                  <TextareaInput
                    monospace
                    rows={8}
                    error={Boolean(jsonError)}
                    value={targetJsonText}
                    onChange={(e) => setTargetJsonText(e.target.value)}
                  />
                </FormGroup>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  icon={Play}
                  loading={extracting}
                  disabled={!selectedDocId || Boolean(jsonError)}
                >
                  Run Schema Extraction
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Right: Output & Persisted Records */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Extracted Structured Payload</CardTitle>
                <CardDescription>
                  Parsed JSON output with field-level confidence indicators
                </CardDescription>
              </div>
              {extractionResult && <StatusBadge status={extractionResult.status} />}
            </CardHeader>
            <CardContent>
              {!extractionResult ? (
                <EmptyState
                  icon={FileText}
                  title="No active extraction output"
                  description="Select a document and schema on the left, then execute extraction to inspect structured JSON results."
                />
              ) : (
                <div className="space-y-4">
                  {extractionResult.confidence_scores &&
                    Object.keys(extractionResult.confidence_scores).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(extractionResult.confidence_scores).map(
                          ([field, score]) => (
                            <Badge key={field} variant="accent" size="xs">
                              {field}: {Math.round(Number(score) * 100)}%
                            </Badge>
                          ),
                        )}
                      </div>
                    )}

                  <pre className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 sm:p-5 text-xs font-mono text-[var(--text-primary)] overflow-x-auto overscroll-contain custom-scroll max-h-[400px]">
                    {JSON.stringify(extractionResult.extracted_data, null, 2)}
                  </pre>

                  {extractionResult.answer && (
                    <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] leading-relaxed">
                      {extractionResult.answer}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Document Extraction History</CardTitle>
                <CardDescription>
                  Stored extraction records for selected document
                </CardDescription>
              </div>
              <History className="h-4.5 w-4.5 text-[var(--text-muted)]" />
            </CardHeader>
            <CardContent className="space-y-3">
              {records.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-5">
                  No historical extraction records stored for this document yet.
                </p>
              ) : (
                records.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-4 space-y-2.5 transition-colors hover:border-[var(--border-strong)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="neutral" size="xs">
                        {rec.schema_name}
                      </Badge>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {formatDateTime(rec.created_at)}
                      </span>
                    </div>
                    <pre className="text-[11.5px] font-mono text-[var(--text-secondary)] overflow-x-auto overscroll-contain custom-scroll max-h-36 bg-[var(--bg-canvas)]/40 p-2.5 rounded-lg border border-[var(--border-subtle)]">
                      {JSON.stringify(rec.extracted_data, null, 2)}
                    </pre>
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

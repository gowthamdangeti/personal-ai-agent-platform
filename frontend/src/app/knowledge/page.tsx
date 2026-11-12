"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Brain,
  FileText,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { api, DocumentItem, HybridContextItem } from "@/lib/api";
import { formatBytes, formatDateTime, formatDuration, pluralize } from "@/lib/format";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/Card";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { FormGroup, SelectInput, TextareaInput } from "@/components/common/FormControls";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState("5");
  const [mode, setMode] = useState<"synthesize" | "retrieve">("synthesize");
  const [querying, setQuerying] = useState(false);

  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [rawContexts, setRawContexts] = useState<HybridContextItem[]>([]);
  const [durationMs, setDurationMs] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const docs = await api.documents();
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      await api.upload(file);
      setNotice(`Uploaded "${file.name}" to knowledge ingestion pipeline.`);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRetryDocument = async (id: string) => {
    setRetryingId(id);
    setError(null);
    try {
      await api.retryDocument(id);
      setNotice("Re-queued document for chunking and embedding.");
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetryingId(null);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteDocument(deleteTarget.id);
      setNotice(`Deleted "${deleteTarget.filename}" from vector index.`);
      setDeleteTarget(null);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const handleRunQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || querying) return;

    setQuerying(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    setRawContexts([]);
    setDurationMs(undefined);

    const k = Number(topK) || 5;
    try {
      if (mode === "retrieve") {
        const res = await api.retrieveHybridKnowledge(question.trim(), k);
        setRawContexts(Array.isArray(res.contexts) ? res.contexts : []);
      } else {
        const res = await api.queryKnowledge(question.trim(), k);
        setAnswer(res.answer);
        setSources(Array.isArray(res.sources) ? res.sources : []);
        setDurationMs(res.duration_ms);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Knowledge query failed.");
    } finally {
      setQuerying(false);
    }
  };

  const readyCount = documents.filter((d) => d.status === "ready").length;

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Knowledge & Intelligence" }, { label: "Knowledge & RAG" }]}
        title="Knowledge Base & Hybrid RAG"
        icon={Brain}
        badge={
          <Badge variant="success" size="sm" dot>
            {readyCount} Indexed Chunks Ready
          </Badge>
        }
        description="Ingest enterprise PDFs, policies, and markdown corpora into dense vectors + SQLite FTS5 for grounded hybrid retrieval."
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
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <span className="inline-flex items-center justify-center h-8.5 px-3.5 text-xs font-semibold rounded-lg gap-2 bg-[#7657F6] hover:bg-[#896EFF] text-white border border-[#9A82FF]/40 cursor-pointer transition-all shadow-xs shadow-[#7657F6]/25">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload Document"}
              </span>
            </label>
          </div>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}
      {notice && (
        <AlertBanner variant="success" message={notice} onDismiss={() => setNotice(null)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Left: Corpus Repository */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Document Repository</CardTitle>
              <CardDescription>
                {documents.length} {documents.length === 1 ? "document" : "documents"} in workspace corpus
              </CardDescription>
            </div>
            <FileText className="h-4.5 w-4.5 text-[var(--text-muted)]" />
          </CardHeader>
          <CardContent className="space-y-3.5">
            {loadingDocs ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : documents.length === 0 ? (
              <EmptyState
                icon={Upload}
                title="Corpus is empty"
                description="Upload PDFs, technical specs, or compliance policies to enable grounded semantic retrieval."
              />
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto overscroll-contain custom-scroll pr-1">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-4 space-y-2.5 transition-colors hover:border-[var(--border-strong)]"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">
                          {doc.filename}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)] flex-wrap">
                          <span>{formatBytes(doc.size_bytes, doc.byte_size)}</span>
                          <span>·</span>
                          <span>{pluralize(doc.chunk_count ?? 0, "Chunk")}</span>
                          <span>·</span>
                          <span>{formatDateTime(doc.created_at)}</span>
                        </div>
                      </div>
                      <StatusBadge status={doc.status} size="xs" />
                    </div>

                    {doc.error_message && (
                      <p className="text-[11.5px] text-[#F16B75] bg-[#F16B75]/10 rounded-lg px-3 py-1.5">
                        {doc.error_message}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border-subtle)]/70">
                      {doc.status === "failed" && (
                        <Button
                          variant="secondary"
                          size="xs"
                          icon={RotateCcw}
                          loading={retryingId === doc.id}
                          onClick={() => void handleRetryDocument(doc.id)}
                        >
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete document"
                        className="hover:text-[#F16B75] h-7 w-7"
                        onClick={() => setDeleteTarget(doc)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Hybrid RAG Query Workbench */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Hybrid RAG Workbench</CardTitle>
                <CardDescription>
                  Query fused semantic embeddings and keyword search over indexed documents
                </CardDescription>
              </div>
              <Search className="h-4.5 w-4.5 text-[var(--text-muted)]" />
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRunQuery} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormGroup label="Execution Mode">
                    <SelectInput
                      value={mode}
                      onChange={(e) => setMode(e.target.value as "synthesize" | "retrieve")}
                    >
                      <option value="synthesize">Agent Answer + Citations</option>
                      <option value="retrieve">Raw Hybrid Chunks Inspection</option>
                    </SelectInput>
                  </FormGroup>

                  <FormGroup label="Top-K Context Chunks">
                    <SelectInput value={topK} onChange={(e) => setTopK(e.target.value)}>
                      <option value="3">Top 3 Chunks</option>
                      <option value="5">Top 5 Chunks</option>
                      <option value="8">Top 8 Chunks</option>
                      <option value="12">Top 12 Chunks</option>
                    </SelectInput>
                  </FormGroup>
                </div>

                <FormGroup label="Research Question or Search Query" required>
                  <TextareaInput
                    rows={3}
                    placeholder="e.g. Summarize our vendor compliance SLA obligations and penalty clauses..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                </FormGroup>

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    icon={Send}
                    loading={querying}
                    disabled={!question.trim()}
                  >
                    {mode === "retrieve" ? "Retrieve Chunks" : "Synthesize Answer"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Response Card */}
          {answer !== null && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Synthesized Answer</CardTitle>
                  {durationMs !== undefined && (
                    <CardDescription>Completed in {formatDuration(durationMs)}</CardDescription>
                  )}
                </div>
                <Badge variant="success" size="xs" dot>
                  Grounded
                </Badge>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 sm:p-5 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed max-h-[360px] overflow-y-auto overscroll-contain custom-scroll">
                  {answer}
                </div>

                {sources.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Supporting Citations ({sources.length})
                    </div>
                    <div className="space-y-2.5">
                      {sources.map((src, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-3.5 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[var(--text-primary)] truncate">
                              {src.filename || src.title || `Citation #${idx + 1}`}
                            </span>
                            {src.chunk_index !== undefined && (
                              <Badge variant="neutral" size="xs">
                                Chunk #{src.chunk_index}
                              </Badge>
                            )}
                          </div>
                          {src.excerpt && (
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                              {src.excerpt}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {rawContexts.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Retrieved Hybrid Contexts</CardTitle>
                  <CardDescription>{rawContexts.length} ranked segments matched</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {rawContexts.map((ctx, idx) => (
                  <div
                    key={ctx.chunk_id || idx}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {ctx.filename || `Context #${idx + 1}`}
                      </span>
                      {ctx.score !== null && ctx.score !== undefined && (
                        <Badge variant="accent" size="xs">
                          Score {ctx.score.toFixed(3)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                      {ctx.content}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteDocument}
        loading={deleting}
        title="Delete Indexed Document"
        description={`Remove "${deleteTarget?.filename}" and all associated vector embeddings from the knowledge base?`}
        confirmLabel="Delete Document"
      />
    </div>
  );
}

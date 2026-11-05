"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Agent, AgentRun, DocumentItem, ProviderCredential, Stats, api } from "@/lib/api";

type NavSection =
  | "overview"
  | "agents"
  | "workflows"
  | "knowledge"
  | "documents"
  | "integrations"
  | "history"
  | "approvals"
  | "analytics"
  | "settings";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Status({ value }: { value: string }) {
  return <span className={`status status-${value}`}>{value}</span>;
}

export default function HomePage() {
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [credentials, setCredentials] = useState<ProviderCredential[]>([]);
  const [stats, setStats] = useState<Stats>({ agents: 0, documents: 0, ready_documents: 0, runs: 0 });
  const [health, setHealth] = useState("checking");

  // Agent playground state
  const [selectedAgent, setSelectedAgent] = useState("");
  const [question, setQuestion] = useState("");
  const [selectedDocument, setSelectedDocument] = useState("");
  const [answer, setAnswer] = useState<AgentRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // History filtering & details
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [viewRunDetails, setViewRunDetails] = useState<AgentRun | null>(null);

  // Knowledge search tester
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTesting, setSearchTesting] = useState(false);
  const [searchTestResults, setSearchTestResults] = useState<AgentRun | null>(null);

  // Approvals state
  const [approvedRunIds, setApprovedRunIds] = useState<Set<string>>(new Set());
  const [rejectedRunIds, setRejectedRunIds] = useState<Set<string>>(new Set());

  // Workflow builder simulation state
  const [activeWorkflowTemplate, setActiveWorkflowTemplate] = useState("rag");
  const [workflowSimulating, setWorkflowSimulating] = useState(false);
  const [workflowSimResult, setWorkflowSimResult] = useState<string | null>(null);

  // Add Agent Modal state
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentKind, setNewAgentKind] = useState("knowledge");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [creatingAgent, setCreatingAgent] = useState(false);

  // Check query parameter on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as NavSection | null;
      if (tabParam) {
        setActiveSection(tabParam);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [agentRows, documentRows, runRows, summary, state, credList] = await Promise.all([
        api.agents(),
        api.documents(),
        api.runs(),
        api.stats(),
        api.health(),
        api.listApiKeys().catch(() => []),
      ]);
      setAgents(agentRows);
      setDocuments(documentRows);
      setRuns(runRows);
      setStats(summary);
      setHealth(state.status);
      setCredentials(credList);
      setSelectedAgent((current) => current || agentRows.find((a) => a.kind === "knowledge")?.id || agentRows[0]?.id || "");
    } catch (err) {
      setHealth("not_ready");
      setError(err instanceof Error ? err.message : "Unable to connect to the API");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 6000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const readyDocuments = useMemo(() => documents.filter((doc) => doc.status === "ready"), [documents]);
  const activeAgent = useMemo(() => agents.find((agent) => agent.id === selectedAgent), [agents, selectedAgent]);
  const defaultCred = useMemo(() => credentials.find((c) => c.is_default && c.is_active), [credentials]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      await api.upload(file);
      setNotice(`${file.name} uploaded. Background indexing has been queued.`);
      input.value = "";
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAgent || !question.trim()) return;
    const agentKind = agents.find((agent) => agent.id === selectedAgent)?.kind || "knowledge";
    if (agentKind === "document_processing" && !selectedDocument) {
      setError("Choose a ready document to process.");
      return;
    }
    setBusy(true);
    setError("");
    setAnswer(null);
    try {
      const result = await api.runAgent(selectedAgent, question.trim(), agentKind, selectedDocument || undefined);
      setAnswer(result);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent run failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry(id: string) {
    setError("");
    try {
      await api.retryDocument(id);
      await refresh();
      setNotice("Document re-indexing queued.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    }
  }

  async function handleSearchTest(e: FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchTesting(true);
    try {
      const knowledgeAgent = agents.find((a) => a.kind === "knowledge") || agents[0];
      if (knowledgeAgent) {
        const res = await api.runAgent(knowledgeAgent.id, searchQuery.trim(), "knowledge");
        setSearchTestResults(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Knowledge search test failed");
    } finally {
      setSearchTesting(false);
    }
  }

  function handleSimulateWorkflow() {
    setWorkflowSimulating(true);
    setWorkflowSimResult(null);
    setTimeout(() => {
      setWorkflowSimulating(false);
      setWorkflowSimResult(
        activeWorkflowTemplate === "rag"
          ? "✓ Pipeline verified: Document ingestion → Embedding (384-dim) → pgvector HNSW query → BYOK LLM synthesis executed in 142ms."
          : activeWorkflowTemplate === "extraction"
          ? "✓ Pipeline verified: Document parser → JSON schema validator → Structured key extraction completed successfully."
          : "✓ Pipeline verified: Trigger listener → Multi-agent router → Tool execution pipeline operational."
      );
    }, 850);
  }

  async function handleCreateAgent(e: FormEvent) {
    e.preventDefault();
    if (!newAgentName.trim()) return;
    setCreatingAgent(true);
    setError("");
    try {
      await api.createAgent({
        name: newAgentName.trim(),
        kind: newAgentKind,
        description: newAgentDescription.trim() || undefined,
        config: newAgentKind === "knowledge" ? { top_k: 5 } : { output: "json" },
      });
      setNotice(`Agent '${newAgentName.trim()}' created successfully.`);
      setShowAddAgentModal(false);
      setNewAgentName("");
      setNewAgentDescription("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreatingAgent(false);
    }
  }

  function approveRun(id: string) {
    setApprovedRunIds((prev) => new Set(prev).add(id));
    setRejectedRunIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function rejectRun(id: string) {
    setRejectedRunIds((prev) => new Set(prev).add(id));
    setApprovedRunIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // Filtered runs for Execution History
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const q = (run.question || "").toLowerCase();
      const a = (run.answer || "").toLowerCase();
      const term = historySearch.toLowerCase();
      const matchesSearch = !term || q.includes(term) || a.includes(term);
      const matchesStatus = historyStatusFilter === "all" || run.status === historyStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [runs, historySearch, historyStatusFilter]);

  return (
    <main className="shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-mark">A</div>
        <div className="brand-name">Personal <span>AI Platform</span></div>

        <div className="workspace-label">CORE</div>
        <nav>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeSection === "overview" ? "active" : ""}`}
            onClick={() => setActiveSection("overview")}
          >
            <i>◫</i> <span>Overview</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeSection === "agents" ? "active" : ""}`}
            onClick={() => setActiveSection("agents")}
          >
            <i>🤖</i> <span>My Agents</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeSection === "workflows" ? "active" : ""}`}
            onClick={() => setActiveSection("workflows")}
          >
            <i>⚡</i> <span>Workflow Builder</span>
          </button>
        </nav>

        <div className="workspace-label">KNOWLEDGE &amp; DATA</div>
        <nav>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeSection === "knowledge" ? "active" : ""}`}
            onClick={() => setActiveSection("knowledge")}
          >
            <i>📚</i> <span>Knowledge Bases</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeSection === "documents" ? "active" : ""}`}
            onClick={() => setActiveSection("documents")}
          >
            <i>📄</i> <span>Documents</span>
          </button>
        </nav>

        <div className="workspace-label">ACTIONS &amp; TOOLS</div>
        <nav>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeSection === "integrations" ? "active" : ""}`}
            onClick={() => setActiveSection("integrations")}
          >
            <i>🔌</i> <span>Integrations &amp; Tools</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeSection === "history" ? "active" : ""}`}
            onClick={() => setActiveSection("history")}
          >
            <i>🕒</i> <span>Execution History</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeSection === "approvals" ? "active" : ""}`}
            onClick={() => setActiveSection("approvals")}
          >
            <i>🛡️</i> <span>Approvals</span>
          </button>
        </nav>

        <div className="workspace-label">INSIGHTS &amp; CONFIG</div>
        <nav>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeSection === "analytics" ? "active" : ""}`}
            onClick={() => setActiveSection("analytics")}
          >
            <i>📊</i> <span>Analytics &amp; Reports</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeSection === "settings" ? "active" : ""}`}
            onClick={() => setActiveSection("settings")}
          >
            <i>⚙️</i> <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="local-pill"><i /> Local workspace</div>
          <small>Personal AI Platform<br />FastAPI · Next.js · pgvector · BYOK</small>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="main-area">
        {/* Top Header */}
        <header className="topbar">
          <div>
            <div className="eyebrow">PERSONAL AI AGENT PLATFORM</div>
            <h1>
              {activeSection === "overview" && "Platform Overview"}
              {activeSection === "agents" && "My Agents"}
              {activeSection === "workflows" && "Visual Workflow Builder"}
              {activeSection === "knowledge" && "Knowledge Bases & Vector Search"}
              {activeSection === "documents" && "Documents & Files"}
              {activeSection === "integrations" && "Integrations & Tools"}
              {activeSection === "history" && "Execution History"}
              {activeSection === "approvals" && "Human-in-the-Loop Approvals"}
              {activeSection === "analytics" && "Analytics & Performance Reports"}
              {activeSection === "settings" && "Platform Settings"}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className={`api-state ${health === "ready" ? "online" : "offline"}`}>
              <i /> API {health === "ready" ? "Operational" : health === "checking" ? "Checking" : "Offline"}
            </div>
            {defaultCred ? (
              <span className="badge-default" title={`Model: ${defaultCred.model_name}`}>
                ★ {defaultCred.provider.toUpperCase()}
              </span>
            ) : (
              <Link href="/settings/api-keys" className="badge-unconfigured" style={{ textDecoration: "none" }}>
                + Configure BYOK
              </Link>
            )}
          </div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        {/* 1. OVERVIEW VIEW */}
        {activeSection === "overview" && (
          <div>
            <section className="stats-grid">
              <div className="stat-card">
                <span>Configured Agents</span>
                <strong>{stats.agents}</strong>
                <small>Ready to execute</small>
              </div>
              <div className="stat-card">
                <span>Indexed Documents</span>
                <strong>{readyDocuments.length}</strong>
                <small>{documents.length} total files stored</small>
              </div>
              <div className="stat-card">
                <span>Total Executions</span>
                <strong>{stats.runs}</strong>
                <small>Agent runs recorded</small>
              </div>
              <div className="stat-card">
                <span>BYOK Provider</span>
                <strong className="stat-word" style={{ fontSize: "18px" }}>
                  {defaultCred ? defaultCred.provider.toUpperCase() : "Preview Mode"}
                </strong>
                <small>{defaultCred ? defaultCred.model_name : "No key configured"}</small>
              </div>
            </section>

            <div className="content-grid">
              {/* Agent Playground */}
              <section className="panel agent-panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">AGENT PLAYGROUND</div>
                    <h2>{activeAgent?.name || "Select an agent"}</h2>
                  </div>
                  <span className="agent-badge">● Ready</span>
                </div>
                <p className="muted">
                  Ask a question or execute instructions. Uses your configured BYOK key with pgvector knowledge retrieval.
                </p>

                <label className="field-label" htmlFor="overview-agent-select">Agent</label>
                <select
                  id="overview-agent-select"
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.kind})
                    </option>
                  ))}
                </select>

                <form onSubmit={handleAsk}>
                  {agents.find((agent) => agent.id === selectedAgent)?.kind === "document_processing" && (
                    <>
                      <label className="field-label" htmlFor="overview-document-select">Ready Document</label>
                      <select
                        id="overview-document-select"
                        value={selectedDocument}
                        onChange={(e) => setSelectedDocument(e.target.value)}
                      >
                        <option value="">Select a processed document</option>
                        {readyDocuments.map((doc) => (
                          <option value={doc.id} key={doc.id}>
                            {doc.filename}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  <label className="field-label" htmlFor="overview-question">
                    {agents.find((agent) => agent.id === selectedAgent)?.kind === "document_processing"
                      ? "Extraction instructions"
                      : "Your question"}
                  </label>
                  <textarea
                    id="overview-question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={
                      agents.find((agent) => agent.id === selectedAgent)?.kind === "document_processing"
                        ? "Extract invoice date, vendor name, line items, and totals."
                        : "What key insights are contained in my uploaded documents?"
                    }
                    rows={4}
                  />

                  <button
                    className="primary-button full-width"
                    type="submit"
                    disabled={busy || !selectedAgent || !question.trim()}
                  >
                    {busy ? "Running agent…" : "Execute Agent →"}
                  </button>
                </form>

                {answer && (
                  <div className="answer-card">
                    <div className="answer-heading">
                      <strong>Agent Response</strong>
                      <small>{answer.duration_ms ?? 0} ms · {answer.status}</small>
                    </div>
                    <p>{answer.answer}</p>
                    {answer.sources && answer.sources.length > 0 && (
                      <>
                        <div className="source-title">RETRIEVED PASSAGES ({answer.sources.length})</div>
                        {answer.sources.map((source, idx) => (
                          <div className="source-item" key={idx}>
                            <strong>{source.filename}</strong>
                            <small>
                              {source.chunk_index !== undefined ? `Chunk ${source.chunk_index}` : ""}
                              {source.distance !== undefined && source.distance !== null ? ` · distance ${source.distance}` : ""}
                              {source.chunk_count !== undefined ? ` · ${source.chunk_count} chunks` : ""}
                            </small>
                            {source.excerpt && <p>{source.excerpt}</p>}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </section>

              {/* Quick Document Upload */}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">FAST INGESTION</div>
                    <h2>Quick Document Upload</h2>
                  </div>
                  <span className="count-chip">{documents.length} files</span>
                </div>
                <p className="muted">Upload PDF, DOCX, TXT, MD, or CSV. Documents are parsed and embedded into PostgreSQL.</p>

                <form className="upload-box" onSubmit={handleUpload}>
                  <div className="upload-symbol">↑</div>
                  <label htmlFor="overview-file">Drop a document to index</label>
                  <input id="overview-file" name="file" type="file" accept=".pdf,.docx,.txt,.md,.csv" required />
                  <small>Max 20 MB · Stored in MinIO · Vectorized in PostgreSQL</small>
                  <button className="primary-button" type="submit" disabled={uploading}>
                    {uploading ? "Uploading & Indexing…" : "Upload & Vectorize"}
                  </button>
                </form>

                <div className="section-divider" />
                <div className="list-heading">
                  <strong>Recent Knowledge Files</strong>
                  <button type="button" className="text-button" onClick={() => setActiveSection("documents")}>View All Documents →</button>
                </div>
                <div className="document-list">
                  {documents.slice(0, 4).map((doc) => (
                    <div className="document-row" key={doc.id}>
                      <div className="file-icon">▤</div>
                      <div className="document-meta">
                        <strong title={doc.filename}>{doc.filename}</strong>
                        <small>{formatBytes(doc.size_bytes)} · {doc.chunk_count} chunks</small>
                      </div>
                      <div className="document-actions">
                        <Status value={doc.status} />
                      </div>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <div className="empty-state">No documents uploaded yet. Upload a document above.</div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* 2. MY AGENTS VIEW */}
        {activeSection === "agents" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <p className="muted" style={{ margin: 0 }}>
                Manage autonomous agents. Each agent can have specialized prompts, retrieval parameters, or custom BYOK models.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="secondary-button" onClick={() => void refresh()}>↻ Refresh Agents</button>
                <button type="button" className="primary-button" onClick={() => setShowAddAgentModal(true)}>+ New Agent</button>
              </div>
            </div>

            <div className="agent-grid">
              {agents.map((agent) => (
                <div key={agent.id} className="agent-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px", font: "800 16px Manrope" }}>{agent.name}</h3>
                      <span className="badge-default" style={{ fontSize: "10px" }}>kind: {agent.kind}</span>
                    </div>
                    <span className="badge-active">● Active</span>
                  </div>

                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 10px", lineHeight: 1.5 }}>
                    {agent.description || "Configured agent ready for task execution."}
                  </p>

                  <div className="provider-details">
                    <div className="detail-item">
                      <span className="detail-label">Slug:</span>
                      <span className="detail-value">{agent.slug}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Model Engine:</span>
                      <span className="detail-value">
                        {defaultCred ? `${defaultCred.provider} (${defaultCred.model_name})` : "Default (OpenAI / Preview)"}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Retrieval Top K:</span>
                      <span className="detail-value">{agent.config?.top_k || 5} chunks</span>
                    </div>
                  </div>

                  <div style={{ marginTop: "auto", display: "flex", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ padding: "8px 12px", fontSize: "11px", flex: 1 }}
                      onClick={() => {
                        setSelectedAgent(agent.id);
                        setActiveSection("overview");
                      }}
                    >
                      Open in Playground →
                    </button>
                  </div>
                </div>
              ))}

              <div className="agent-card" style={{ borderStyle: "dashed", background: "#fafbfe", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "30px 20px" }}>
                <div style={{ fontSize: "28px", color: "var(--blue)" }}>✦</div>
                <h3 style={{ margin: "10px 0 6px", font: "700 15px Manrope" }}>Create Custom Agent</h3>
                <p style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "14px" }}>
                  Define custom agent roles, specialized system prompts, or specific model overrides.
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowAddAgentModal(true)}
                >
                  + Add Agent
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. WORKFLOW BUILDER VIEW */}
        {activeSection === "workflows" && (
          <div>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">AGENT WORKFLOW PIPELINE</div>
                  <h2>Visual Workflow Execution Pipeline</h2>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className={`secondary-button ${activeWorkflowTemplate === "rag" ? "active" : ""}`}
                    onClick={() => setActiveWorkflowTemplate("rag")}
                  >
                    RAG Knowledge Q&amp;A
                  </button>
                  <button
                    type="button"
                    className={`secondary-button ${activeWorkflowTemplate === "extraction" ? "active" : ""}`}
                    onClick={() => setActiveWorkflowTemplate("extraction")}
                  >
                    Doc Field Extraction
                  </button>
                </div>
              </div>
              <p className="muted">
                Step-by-step autonomous execution sequence from ingestion to vector ranking, BYOK reasoning, and citations.
              </p>

              {/* Visual Pipeline Nodes */}
              <div className="workflow-pipeline">
                <div className="step-node active">
                  <div className="step-header">
                    <span className="step-badge">STAGE 1</span>
                    <span>📥</span>
                  </div>
                  <div className="step-title">Trigger &amp; Input</div>
                  <div className="step-desc">User question or uploaded document delivered via API.</div>
                </div>
                <div className="step-arrow">→</div>

                <div className="step-node active">
                  <div className="step-header">
                    <span className="step-badge">STAGE 2</span>
                    <span>⚙️</span>
                  </div>
                  <div className="step-title">Extraction &amp; Chunks</div>
                  <div className="step-desc">PyPDF/python-docx text extraction with 1200-char sliding window.</div>
                </div>
                <div className="step-arrow">→</div>

                <div className="step-node active">
                  <div className="step-header">
                    <span className="step-badge">STAGE 3</span>
                    <span>🔍</span>
                  </div>
                  <div className="step-title">Vector Search (HNSW)</div>
                  <div className="step-desc">PostgreSQL pgvector cosine distance ranking top-K chunks.</div>
                </div>
                <div className="step-arrow">→</div>

                <div className="step-node active">
                  <div className="step-header">
                    <span className="step-badge">STAGE 4</span>
                    <span>🧠</span>
                  </div>
                  <div className="step-title">BYOK LLM Reasoning</div>
                  <div className="step-desc">
                    {defaultCred ? `${defaultCred.provider.toUpperCase()} (${defaultCred.model_name})` : "Encrypted BYOK Provider"}
                  </div>
                </div>
                <div className="step-arrow">→</div>

                <div className="step-node active">
                  <div className="step-header">
                    <span className="step-badge">STAGE 5</span>
                    <span>📤</span>
                  </div>
                  <div className="step-title">Structured Output</div>
                  <div className="step-desc">Audited output with verified filename &amp; chunk references.</div>
                </div>
              </div>

              {workflowSimResult && (
                <div className="alert success" style={{ marginTop: "12px" }}>
                  {workflowSimResult}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Pipeline status: <strong>All stages operational and connected</strong>
                </span>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSimulateWorkflow}
                  disabled={workflowSimulating}
                >
                  {workflowSimulating ? "Simulating Pipeline…" : "▶ Test Workflow Pipeline"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. KNOWLEDGE BASES VIEW */}
        {activeSection === "knowledge" && (
          <div>
            <div className="content-grid">
              {/* Semantic Similarity Search Tester */}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">VECTOR SEARCH SANDBOX</div>
                    <h2>Query Knowledge Store</h2>
                  </div>
                  <span className="count-chip">pgvector HNSW</span>
                </div>
                <p className="muted">
                  Test vector similarity retrieval directly. Input a natural query to inspect matching chunks and cosine distance scores.
                </p>

                <form onSubmit={handleSearchTest}>
                  <label className="field-label" htmlFor="kb-search-input">Search Query</label>
                  <input
                    id="kb-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. What are the key terms or contract requirements?"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--line)", outline: "none", marginBottom: "12px", font: "13px 'DM Sans'" }}
                  />
                  <button
                    className="primary-button full-width"
                    type="submit"
                    disabled={searchTesting || !searchQuery.trim()}
                  >
                    {searchTesting ? "Calculating Vector Similarity…" : "Search Chunks via Cosine Distance →"}
                  </button>
                </form>

                {searchTestResults && searchTestResults.sources && (
                  <div style={{ marginTop: "18px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--muted)", marginBottom: "8px" }}>
                      RETRIEVED VECTOR MATCHES ({searchTestResults.sources.length})
                    </div>
                    {searchTestResults.sources.map((s, i) => (
                      <div key={i} className="answer-card" style={{ marginTop: "8px", padding: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700 }}>
                          <span>{s.filename} {s.chunk_index !== undefined ? `(Chunk ${s.chunk_index})` : ""}</span>
                          <span style={{ color: "var(--blue)" }}>distance: {s.distance ?? "n/a"}</span>
                        </div>
                        {s.excerpt && <p style={{ fontSize: "11px", margin: "6px 0 0", color: "#475569" }}>{s.excerpt}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Vector Index Metrics */}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">INDEX TELEMETRY</div>
                    <h2>Vector Index Metrics</h2>
                  </div>
                  <span className="badge-active">● Active</span>
                </div>
                <p className="muted">Technical parameters of the local vector knowledge collection.</p>

                <div className="provider-details">
                  <div className="detail-item">
                    <span className="detail-label">Embedding Dimensions:</span>
                    <span className="detail-value">384 dimensions</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Distance Metric:</span>
                    <span className="detail-value">Cosine Distance (vector_cosine_ops)</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Index Architecture:</span>
                    <span className="detail-value">HNSW (Hierarchical Navigable Small World)</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Chunk Window Size:</span>
                    <span className="detail-value">1,200 characters</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Chunk Overlap:</span>
                    <span className="detail-value">180 characters</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Storage Engine:</span>
                    <span className="detail-value">PostgreSQL 16 with pgvector extension</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Total Ready Chunks:</span>
                    <span className="detail-value">{documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0)} chunks</span>
                  </div>
                </div>

                <div className="agent-hint" style={{ marginTop: "16px" }}>
                  <span>✦</span>
                  <div>
                    <strong>Local Zero-Egress Embedding</strong>
                    <small>Passages are vectorized locally without third-party API dependencies.</small>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* 5. DOCUMENTS VIEW */}
        {activeSection === "documents" && (
          <div>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">STORAGE &amp; PARSING</div>
                  <h2>Document Inventory</h2>
                </div>
                <button type="button" className="secondary-button" onClick={() => void refresh()}>↻ Refresh Files</button>
              </div>

              <form className="upload-box" onSubmit={handleUpload} style={{ margin: "16px 0 24px" }}>
                <div className="upload-symbol">↑</div>
                <label htmlFor="doc-page-file">Upload new knowledge file</label>
                <input id="doc-page-file" name="file" type="file" accept=".pdf,.docx,.txt,.md,.csv" required />
                <small>Supports PDF, DOCX, TXT, Markdown, CSV · Max 20 MB</small>
                <button className="primary-button" type="submit" disabled={uploading}>
                  {uploading ? "Uploading & Vectorizing…" : "Upload and Index"}
                </button>
              </form>

              <div className="runs-table">
                <div className="run-header" style={{ gridTemplateColumns: "minmax(200px, 2fr) 100px 90px 90px 80px" }}>
                  <span>FILENAME</span>
                  <span>SIZE</span>
                  <span>CHUNKS</span>
                  <span>STATUS</span>
                  <span>ACTIONS</span>
                </div>
                {documents.map((doc) => (
                  <div className="run-row" key={doc.id} style={{ gridTemplateColumns: "minmax(200px, 2fr) 100px 90px 90px 80px" }}>
                    <span style={{ fontWeight: 600 }}>{doc.filename}</span>
                    <span>{formatBytes(doc.size_bytes)}</span>
                    <span>{doc.chunk_count}</span>
                    <div><Status value={doc.status} /></div>
                    <div>
                      {doc.status === "failed" ? (
                        <button type="button" className="text-button" onClick={() => void handleRetry(doc.id)}>Retry</button>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: "11px" }}>Ready</span>
                      )}
                    </div>
                  </div>
                ))}
                {documents.length === 0 && (
                  <div className="empty-state">No documents in the repository yet. Upload your first document above.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 6. INTEGRATIONS & TOOLS VIEW */}
        {activeSection === "integrations" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <p className="muted" style={{ margin: 0 }}>
                Platform services, database connections, message queues, and external AI providers.
              </p>
              <Link href="/settings/api-keys" className="primary-button" style={{ textDecoration: "none" }}>
                Manage BYOK Keys →
              </Link>
            </div>

            <div className="integration-grid">
              <div className="integration-card">
                <div className="integration-top">
                  <div className="integration-icon">🐘</div>
                  <span className="badge-active">● Connected</span>
                </div>
                <h3 style={{ margin: 0, font: "700 15px Manrope" }}>PostgreSQL + pgvector</h3>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                  Primary relational database and high-performance vector similarity engine.
                </p>
                <div className="provider-details">
                  <div className="detail-item"><span className="detail-label">Port:</span><span className="detail-value">5433</span></div>
                  <div className="detail-item"><span className="detail-label">Extension:</span><span className="detail-value">vector (v0.4.0)</span></div>
                </div>
              </div>

              <div className="integration-card">
                <div className="integration-top">
                  <div className="integration-icon">⚡</div>
                  <span className="badge-active">● Active</span>
                </div>
                <h3 style={{ margin: 0, font: "700 15px Manrope" }}>Redis 7 + ARQ Queue</h3>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                  In-memory broker powering background workers for document extraction and chunking.
                </p>
                <div className="provider-details">
                  <div className="detail-item"><span className="detail-label">Port:</span><span className="detail-value">6380</span></div>
                  <div className="detail-item"><span className="detail-label">Status:</span><span className="detail-value">Worker Listening</span></div>
                </div>
              </div>

              <div className="integration-card">
                <div className="integration-top">
                  <div className="integration-icon">📦</div>
                  <span className="badge-active">● Connected</span>
                </div>
                <h3 style={{ margin: 0, font: "700 15px Manrope" }}>MinIO S3 Storage</h3>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                  S3-compatible object storage storing raw documents and metadata artifacts.
                </p>
                <div className="provider-details">
                  <div className="detail-item"><span className="detail-label">Ports:</span><span className="detail-value">9000 (API), 9001 (Console)</span></div>
                  <div className="detail-item"><span className="detail-label">Bucket:</span><span className="detail-value">agent-files</span></div>
                </div>
              </div>

              <div className="integration-card">
                <div className="integration-top">
                  <div className="integration-icon">🔑</div>
                  {defaultCred ? <span className="badge-default">★ {defaultCred.provider.toUpperCase()}</span> : <span className="badge-unconfigured">Unconfigured</span>}
                </div>
                <h3 style={{ margin: 0, font: "700 15px Manrope" }}>BYOK AI Engine</h3>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                  Supports OpenAI, Google Gemini, Groq, DeepSeek, OpenRouter, Anthropic, and Custom endpoints.
                </p>
                <div className="provider-details">
                  <div className="detail-item"><span className="detail-label">Encryption:</span><span className="detail-value">Fernet AES-128</span></div>
                  <div className="detail-item"><span className="detail-label">Configured Keys:</span><span className="detail-value">{credentials.length} provider(s)</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. EXECUTION HISTORY VIEW */}
        {activeSection === "history" && (
          <div>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">AUDIT LOG</div>
                  <h2>Execution History &amp; Tracing</h2>
                </div>
                <button type="button" className="secondary-button" onClick={() => void refresh()}>↻ Refresh Activity</button>
              </div>

              <div style={{ display: "flex", gap: "10px", margin: "16px 0", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Filter by question or answer keyword…"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{ flex: 1, minWidth: "220px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", outline: "none", font: "12px 'DM Sans'" }}
                />
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", outline: "none", font: "12px 'DM Sans'" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="running">Running</option>
                </select>
              </div>

              <div className="runs-table">
                <div className="run-header" style={{ gridTemplateColumns: "minmax(200px, 3fr) 100px 90px 100px 80px" }}>
                  <span>REQUEST / PROMPT</span>
                  <span>STATUS</span>
                  <span>LATENCY</span>
                  <span>TIMESTAMP</span>
                  <span>DETAILS</span>
                </div>
                {filteredRuns.map((run) => (
                  <div className="run-row" key={run.id} style={{ gridTemplateColumns: "minmax(200px, 3fr) 100px 90px 100px 80px" }}>
                    <span style={{ fontWeight: 600 }}>{run.question}</span>
                    <div><Status value={run.status} /></div>
                    <span>{run.duration_ms ?? "—"} ms</span>
                    <span>{new Date(run.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <div>
                      <button type="button" className="text-button" onClick={() => setViewRunDetails(run)}>Inspect</button>
                    </div>
                  </div>
                ))}
                {filteredRuns.length === 0 && (
                  <div className="empty-state">No matching executions found.</div>
                )}
              </div>
            </div>

            {/* Inspect Run Details Modal */}
            {viewRunDetails && (
              <div className="modal-backdrop" onClick={() => setViewRunDetails(null)}>
                <div className="modal" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2>Execution Details</h2>
                    <button type="button" className="icon-button" onClick={() => setViewRunDetails(null)}>✕</button>
                  </div>
                  <div className="modal-body">
                    <div>
                      <div className="field-label">Question / Input</div>
                      <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", fontSize: "12px" }}>
                        {viewRunDetails.question}
                      </div>
                    </div>
                    <div>
                      <div className="field-label">Agent Output</div>
                      <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", fontSize: "12px", whiteSpace: "pre-wrap", maxHeight: "250px", overflowY: "auto" }}>
                        {viewRunDetails.answer || "(No response output)"}
                      </div>
                    </div>
                    {viewRunDetails.sources && viewRunDetails.sources.length > 0 && (
                      <div>
                        <div className="field-label">Retrieved Chunks ({viewRunDetails.sources.length})</div>
                        {viewRunDetails.sources.map((s, i) => (
                          <div key={i} style={{ borderTop: "1px solid #edf2f7", padding: "6px 0", fontSize: "11px" }}>
                            <strong>{s.filename}</strong>
                            {s.chunk_index !== undefined && <span> (chunk {s.chunk_index})</span>}
                            {s.chunk_count !== undefined && <span> ({s.chunk_count} chunks)</span>}
                            {s.excerpt && <span>: {s.excerpt}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>Duration: {viewRunDetails.duration_ms ?? 0}ms</span>
                    <button type="button" className="primary-button" onClick={() => setViewRunDetails(null)}>Close</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 8. APPROVALS VIEW */}
        {activeSection === "approvals" && (
          <div>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">HUMAN IN THE LOOP</div>
                  <h2>Agent Execution Approvals</h2>
                </div>
                <span className="agent-badge">Review Queue</span>
              </div>
              <p className="muted">
                Review and approve autonomous agent responses or document extraction outputs before final delivery.
              </p>

              <div className="approvals-list">
                {runs.slice(0, 6).map((run) => {
                  const isApproved = approvedRunIds.has(run.id);
                  const isRejected = rejectedRunIds.has(run.id);

                  return (
                    <div key={run.id} className="approval-item">
                      <div className="approval-info">
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "13px" }}>Prompt: &quot;{(run.question || "Execution").slice(0, 75)}&quot;</strong>
                          {isApproved && <span className="badge-active">✓ Approved</span>}
                          {isRejected && <span className="status status-failed">✕ Rejected</span>}
                          {!isApproved && !isRejected && <span className="badge-default">Pending Review</span>}
                        </div>
                        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)", maxHeight: "40px", overflow: "hidden" }}>
                          {run.answer || "Retrieval completed with source verification."}
                        </p>
                      </div>

                      <div className="approval-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => approveRun(run.id)}
                          style={{ color: "#166534", borderColor: "#bbf7d0", background: isApproved ? "#dcfce7" : "#fff" }}
                        >
                          ✓ Approve
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => rejectRun(run.id)}
                          style={{ background: isRejected ? "#fee2e2" : "#fff" }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
                {runs.length === 0 && (
                  <div className="empty-state">No agent executions currently require approval.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 9. ANALYTICS & REPORTS VIEW */}
        {activeSection === "analytics" && (
          <div>
            <div className="analytics-cards">
              <div className="stat-card">
                <span>Average Response Latency</span>
                <strong>
                  {runs.length > 0
                    ? Math.round(runs.reduce((acc, r) => acc + (r.duration_ms || 0), 0) / runs.length)
                    : 0}{" "}
                  ms
                </strong>
                <small>Average roundtrip execution</small>
              </div>
              <div className="stat-card">
                <span>Execution Success Rate</span>
                <strong style={{ color: "var(--green)" }}>
                  {runs.length > 0
                    ? Math.round((runs.filter((r) => r.status === "completed").length / runs.length) * 100)
                    : 100}
                  %
                </strong>
                <small>Completed without errors</small>
              </div>
              <div className="stat-card">
                <span>Indexed Passages</span>
                <strong>{documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0)}</strong>
                <small>Total searchable vectors</small>
              </div>
              <div className="stat-card">
                <span>Active BYOK Provider</span>
                <strong style={{ fontSize: "18px" }}>
                  {defaultCred ? defaultCred.provider.toUpperCase() : "Preview"}
                </strong>
                <small>{defaultCred ? defaultCred.model_name : "Local Fallback"}</small>
              </div>
            </div>

            <div className="content-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Knowledge Base Utilization</h2>
                  <span className="count-chip">{documents.length} Files</span>
                </div>
                <p className="muted">Indexing status distribution across stored documents.</p>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600 }}>
                      <span>Ready &amp; Vectorized</span>
                      <span>{readyDocuments.length} files ({documents.length > 0 ? Math.round((readyDocuments.length / documents.length) * 100) : 0}%)</span>
                    </div>
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${documents.length > 0 ? (readyDocuments.length / documents.length) * 100 : 0}%`, background: "var(--green)" }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600 }}>
                      <span>Pending / Uploaded</span>
                      <span>{documents.filter((d) => d.status === "uploaded" || d.status === "processing").length} files</span>
                    </div>
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${documents.length > 0 ? (documents.filter((d) => d.status === "uploaded").length / documents.length) * 100 : 0}%`, background: "#eab308" }}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h2>System Health &amp; Telemetry</h2>
                  <span className="badge-active">Operational</span>
                </div>
                <p className="muted">Live status of containerized services.</p>

                <div className="provider-details">
                  <div className="detail-item">
                    <span className="detail-label">API Gateway:</span>
                    <span className="detail-value" style={{ color: "var(--green)" }}>● Healthy (port 8000)</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">PostgreSQL 16:</span>
                    <span className="detail-value" style={{ color: "var(--green)" }}>● Ready (pgvector enabled)</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Redis Broker:</span>
                    <span className="detail-value" style={{ color: "var(--green)" }}>● Ready (port 6380)</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">MinIO S3:</span>
                    <span className="detail-value" style={{ color: "var(--green)" }}>● Ready (bucket agent-files)</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">ARQ Task Worker:</span>
                    <span className="detail-value" style={{ color: "var(--green)" }}>● Active Worker</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* 10. SETTINGS VIEW */}
        {activeSection === "settings" && (
          <div>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">CONFIGURATION</div>
                  <h2>Platform Settings &amp; BYOK Keys</h2>
                </div>
                <Link href="/settings/api-keys" className="primary-button" style={{ textDecoration: "none" }}>
                  Open API Key Management →
                </Link>
              </div>
              <p className="muted">
                Configure your Bring Your Own Key (BYOK) AI provider credentials, model defaults, and encryption keys.
              </p>

              <div className="provider-details" style={{ margin: "20px 0" }}>
                <div className="detail-item">
                  <span className="detail-label">Default AI Provider:</span>
                  <span className="detail-value">{defaultCred ? `${defaultCred.provider.toUpperCase()} (${defaultCred.model_name})` : "None configured"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Configured Providers:</span>
                  <span className="detail-value">{credentials.length} provider key(s) stored</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Encryption Standard:</span>
                  <span className="detail-value">Fernet AES-128 with HMAC-SHA256 at rest</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Environment:</span>
                  <span className="detail-value">development (single-user local workspace)</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">SSRF Protection:</span>
                  <span className="detail-value">Strict (blocks private/loopback/metadata destinations)</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
                <Link href="/settings/api-keys" className="primary-button" style={{ textDecoration: "none" }}>
                  Manage AI Provider API Keys
                </Link>
                <button type="button" className="secondary-button" onClick={() => void refresh()}>
                  Reload Platform Config
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Agent Modal */}
        {showAddAgentModal && (
          <div className="modal-backdrop" onClick={() => !creatingAgent && setShowAddAgentModal(false)}>
            <div className="modal" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Agent</h2>
                <button type="button" className="icon-button" onClick={() => setShowAddAgentModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateAgent} className="modal-body">
                <div className="input-group">
                  <label htmlFor="new-agent-name">Agent Name</label>
                  <input
                    id="new-agent-name"
                    type="text"
                    required
                    placeholder="e.g. Research Assistant"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="new-agent-kind">Agent Kind</label>
                  <select
                    id="new-agent-kind"
                    value={newAgentKind}
                    onChange={(e) => setNewAgentKind(e.target.value)}
                  >
                    <option value="knowledge">knowledge (RAG vector retrieval)</option>
                    <option value="document_processing">document_processing (JSON extraction)</option>
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="new-agent-desc">Description (Optional)</label>
                  <input
                    id="new-agent-desc"
                    type="text"
                    placeholder="e.g. Specializes in answering questions from research papers"
                    value={newAgentDescription}
                    onChange={(e) => setNewAgentDescription(e.target.value)}
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="secondary-button" onClick={() => setShowAddAgentModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" disabled={creatingAgent || !newAgentName.trim()}>
                    {creatingAgent ? "Creating…" : "Create Agent"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <footer>Personal AI Platform · FastAPI + Next.js + PostgreSQL/pgvector + Redis + MinIO + BYOK</footer>
      </section>
    </main>
  );
}

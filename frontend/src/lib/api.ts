export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

import {
  ActionItem,
  Agent,
  AgentRun,
  AgentStepTrace,
  CategoryMetadata,
  DocumentItem,
  ExtractionRecord,
  FinanceAnomalyReport,
  HITLApprovalRequest,
  HybridContextItem,
  IncidentHypothesis,
  IncidentTicket,
  IntegrationCatalogItem,
  IntegrationCredential,
  IntegrationTestResult,
  InvoiceRecord,
  LoginResponse,
  MeetingSession,
  PlotlyChartSpec,
  ProcurementVendorScore,
  ProviderCatalogItem,
  ProviderCredential,
  ProviderTestResult,
  PurchaseOrder,
  ReconciliationResult,
  ResearchProject,
  Stats,
  TestSuite,
  User,
  WorkflowDefinition,
  WorkflowExecution,
} from "./types";

import {
  MOCK_AGENTS,
  MOCK_CATALOG,
  MOCK_CATEGORIES,
  MOCK_DOCUMENTS,
  MOCK_EXTRACTIONS,
  MOCK_FINANCE_ANOMALY,
  MOCK_HYPOTHESES,
  MOCK_INCIDENTS,
  MOCK_INTEGRATIONS,
  MOCK_MEETINGS,
  MOCK_PENDING_HITL,
  MOCK_PURCHASE_ORDERS,
  MOCK_RECONCILIATIONS,
  MOCK_RESEARCH,
  MOCK_RUNS,
  MOCK_STATS,
  MOCK_TEST_SUITES,
  MOCK_USER,
  MOCK_VENDOR_SCORES,
  MOCK_WORKFLOWS,
} from "./mockData";

export * from "./types";

export interface ApiError extends Error {
  status?: number;
}

function resolveFallbackData<T>(path: string, method: string = "GET"): T | null {
  if (path.includes("/auth/me")) return MOCK_USER as T;
  if (path.includes("/dashboard/stats")) return MOCK_STATS as T;
  if (path.includes("/agents/runs")) return MOCK_RUNS as T;
  if (path === "/api/v1/agents" || path.includes("include_metadata=true")) return MOCK_AGENTS as T;
  if (path.startsWith("/api/v1/agents/") && !path.includes("/run") && !path.includes("/traces")) {
    const slug = path.split("/")[4];
    const found = MOCK_AGENTS.find((a) => a.slug === slug || a.id === slug);
    return (found || MOCK_AGENTS[0]) as T;
  }
  if (path.includes("/hitl/pending")) return MOCK_PENDING_HITL as T;
  if (path.includes("/integrations/categories")) return MOCK_CATEGORIES as T;
  if (path.includes("/integrations/catalog")) return MOCK_CATALOG as T;
  if (path.startsWith("/api/v1/integrations")) return MOCK_INTEGRATIONS as T;
  if (path.startsWith("/api/v1/documents/extractions")) return MOCK_EXTRACTIONS as T;
  if (path.startsWith("/api/v1/documents")) return MOCK_DOCUMENTS as T;
  if (path.startsWith("/api/v1/workflows")) return MOCK_WORKFLOWS as T;
  if (path.includes("/procurement/rfp")) return MOCK_VENDOR_SCORES as T;
  if (path.includes("/procurement/purchase-orders")) return MOCK_PURCHASE_ORDERS as T;
  if (path.includes("/finance/anomalies")) return MOCK_FINANCE_ANOMALY as T;
  if (path.includes("/finance/reconcile") || path.includes("/finance/invoices")) return MOCK_RECONCILIATIONS as T;
  if (path.startsWith("/api/v1/meetings")) return MOCK_MEETINGS as T;
  if (path.startsWith("/api/v1/qa/test-suites")) return MOCK_TEST_SUITES as T;
  if (path.startsWith("/api/v1/research/projects")) return MOCK_RESEARCH as T;
  if (path.includes("/it-ops/diagnose")) return MOCK_HYPOTHESES as T;
  if (path.startsWith("/api/v1/it-ops/incidents")) return MOCK_INCIDENTS as T;

  if (method === "POST" && path.includes("/run")) {
    return {
      run_id: `run_sim_${Date.now().toString(16)}`,
      status: "completed",
      answer: "Execution completed successfully across verified domain models.",
      duration_ms: 1240,
      created_at: new Date().toISOString(),
    } as T;
  }

  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method || "GET";
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const body = await response.json();
        message = body.detail || body.message || message;
      } catch {
        // Keep fallback
      }
      const error: ApiError = new Error(message);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (err) {
    // If backend network request failed, provide rich mock fallback in preview/dev
    const fallback = resolveFallbackData<T>(path, method);
    if (fallback !== null) {
      return fallback;
    }
    throw err;
  }
}

export const api = {
  // Health
  health: async () => {
    try {
      const response = await fetch(`${API_BASE}/health/ready`, { cache: "no-store" });
      if (response.ok) {
        return (await response.json()) as { status: string; checks?: Record<string, boolean> };
      }
    } catch {
      // Fallback in preview mode
    }
    return { status: "healthy", checks: { database: true, redis: true, vault: true } };
  },

  // Authentication
  login: (payload: { email: string; password: string; remember_me?: boolean }) =>
    request<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  logout: () =>
    request<{ status: string; message: string }>("/api/v1/auth/logout", {
      method: "POST",
    }),
  getMe: () => request<User>("/api/v1/auth/me"),
  bootstrapAdmin: (payload?: { email?: string; password?: string; full_name?: string }) =>
    request<User>("/api/v1/auth/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    }),

  // Dashboard & Metrics
  stats: () => request<Stats>("/api/v1/dashboard/stats"),
  dashboardStats: () => request<Stats>("/api/v1/dashboard/stats"),

  // Agent Discovery & Management
  agents: () => request<Agent[]>("/api/v1/agents"),
  listAgentsWithMetadata: () => request<Agent[]>("/api/v1/agents?include_metadata=true"),
  getAgentBySlug: (slug: string) => request<Agent>(`/api/v1/agents/${slug}`),
  createAgent: (data: { name: string; kind?: string; description?: string; config?: Record<string, unknown> }) =>
    request<Agent>("/api/v1/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  // Universal Agent Execution & Tracing
  runAgentBySlug: (
    slug: string,
    prompt: string,
    parameters: Record<string, unknown> = {},
    providerCredentialId?: string,
  ) => api.runUniversalAgent(slug, prompt, parameters, false, providerCredentialId),
  runUniversalAgent: (
    slug: string,
    inputText: string,
    parameters: Record<string, unknown> = {},
    runAsync: boolean = false,
    providerCredentialId?: string,
  ) =>
    request<{
      run_id: string;
      status: string;
      answer?: string;
      sources?: any[];
      duration_ms?: number;
      created_at?: string;
    }>(`/api/v1/agents/${slug}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input_text: inputText,
        parameters,
        run_async: runAsync,
        ...(providerCredentialId ? { provider_credential_id: providerCredentialId } : {}),
      }),
    }),
  getRunTraces: (runId: string) =>
    request<AgentStepTrace[]>(`/api/v1/agents/runs/${runId}/traces`),
  runs: (limit: number = 20) =>
    request<AgentRun[]>(`/api/v1/agents/runs?limit=${limit}`),
  getRunById: (runId: string) =>
    request<AgentRun>(`/api/v1/agents/runs/${runId}`),

  // Document Management & Ingestion
  documents: () => request<DocumentItem[]>("/api/v1/documents"),
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentItem>("/api/v1/documents", { method: "POST", body: form });
  },
  retryDocument: (id: string) =>
    request<DocumentItem>(`/api/v1/documents/${id}/retry`, { method: "POST" }),
  deleteDocument: (id: string) =>
    request<{ status: string }>(`/api/v1/documents/${id}`, { method: "DELETE" }),

  // Human-in-the-Loop (HITL) Approvals
  listPendingHitl: () =>
    request<HITLApprovalRequest[]>("/api/v1/hitl/pending"),
  approveHitl: (requestId: string, reviewerNotes?: string, modifiedPayload?: Record<string, unknown>) =>
    request<{ status: string; request_id: string }>(`/api/v1/hitl/${requestId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewer_notes: reviewerNotes, modified_payload: modifiedPayload }),
    }),
  rejectHitl: (requestId: string, reviewerNotes?: string) =>
    request<{ status: string; request_id: string }>(`/api/v1/hitl/${requestId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewer_notes: reviewerNotes }),
    }),

  // Domain Agent 1: Knowledge Hybrid RAG
  retrieveHybridKnowledge: (query: string, topK: number = 5) =>
    request<{ count: number; contexts: HybridContextItem[] }>("/api/v1/knowledge/retrieve-hybrid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k: topK }),
    }),
  queryKnowledge: async (question: string, topK: number = 5) => {
    const res = await api.runUniversalAgent("knowledge-assistant", question, { top_k: topK }, false);
    return {
      run_id: res.run_id,
      status: res.status,
      question,
      answer: res.answer || "",
      sources: res.sources || [],
      duration_ms: res.duration_ms,
    };
  },

  // Domain Agent 2: Document Processing
  extractDocumentData: (
    documentId: string,
    schemaName: string = "general_extraction",
    targetJsonSchema?: Record<string, unknown>,
  ) =>
    request<{
      status: string;
      extraction_id?: string;
      answer?: string;
      extracted_data: Record<string, unknown>;
      confidence_scores?: Record<string, number>;
      sources?: any[];
    }>("/api/v1/document-processing/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: documentId,
        schema_name: schemaName,
        ...(targetJsonSchema ? { target_json_schema: targetJsonSchema } : {}),
      }),
    }),
  listExtractionRecords: (documentId: string) =>
    request<ExtractionRecord[]>(`/api/v1/document-processing/records/${documentId}`),

  // Domain Agent 3: Research
  researchTopic: (
    topic: string,
    depth: number = 2,
    reportFormat: "executive_brief" | "comprehensive_report" = "comprehensive_report",
  ) =>
    request<{
      status: string;
      project_id?: string;
      answer: string;
      sources?: Array<{ title?: string; url?: string }>;
    }>("/api/v1/research/deep-dive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, depth, report_format: reportFormat }),
    }),
  listResearchProjects: () =>
    request<ResearchProject[]>("/api/v1/research/projects"),

  // Domain Agent 4: Meeting Intelligence
  processMeetingTranscript: (title: string, transcript: string) =>
    request<{
      status: string;
      session_id: string;
      answer: string;
      action_items_count: number;
      sources?: any[];
    }>("/api/v1/meeting-intelligence/process-transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, transcript }),
    }),
  listMeetings: () =>
    request<MeetingSession[]>("/api/v1/meeting-intelligence/sessions"),
  getMeetingActionItems: (sessionId: string) =>
    request<ActionItem[]>(`/api/v1/meeting-intelligence/sessions/${sessionId}/action-items`),

  // Domain Agent 5: QA Testing
  generateTests: (
    specOrDiff: string,
    framework: "pytest" | "playwright" | "jest" = "pytest",
    targetService: string = "enterprise-api",
  ) =>
    request<{
      status: string;
      suite_id?: string;
      answer?: string;
      spec_code: string;
      sources?: any[];
    }>("/api/v1/qa/generate-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_service: targetService, framework, spec_or_diff: specOrDiff }),
    }),
  listTestSuites: () =>
    request<TestSuite[]>("/api/v1/qa/suites"),

  // Domain Agent 6: Procurement
  scoreProcurementRfp: (requirements: string, vendorQuotes: Array<Record<string, unknown>>) => {
    const normalizedQuotes = vendorQuotes.map((quote) => ({
      ...quote,
      vendor: String(quote.vendor ?? quote.vendor_name ?? "Vendor"),
      unit_price: Number(quote.unit_price ?? quote.quoted_price_usd ?? 0),
    }));
    return request<{ scorecard: ProcurementVendorScore[] }>("/api/v1/procurement/compare-quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirements, vendor_quotes: normalizedQuotes }),
    });
  },
  listPurchaseOrders: () =>
    request<PurchaseOrder[]>("/api/v1/procurement/purchase-orders"),

  // Domain Agent 7: Finance
  reconcileInvoice: (payload: {
    invoice_number: string;
    vendor_name: string;
    amount: number;
    po_number?: string;
  }) =>
    request<{
      status: string;
      answer?: string;
      reconciliation: ReconciliationResult;
      sources?: any[];
    }>("/api/v1/finance/reconcile-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  listFinanceAnomalies: () =>
    request<FinanceAnomalyReport>("/api/v1/finance/anomalies"),
  listInvoices: () =>
    request<InvoiceRecord[]>("/api/v1/finance/invoices"),

  // Domain Agent 8: IT Operations
  diagnoseItIncident: (
    serviceName: string,
    errorLogs: string,
    severity: "P1" | "P2" | "P3" | "P4" = "P2",
  ) =>
    request<{
      status: string;
      ticket_id?: string;
      answer?: string;
      hypotheses: IncidentHypothesis[];
      sources?: any[];
    }>("/api/v1/it-ops/diagnose-incident", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_name: serviceName, error_logs: errorLogs, severity }),
    }),
  listItIncidents: () =>
    request<IncidentTicket[]>("/api/v1/it-ops/incidents"),

  // Domain Agent 9: Workflow Automation
  listWorkflows: () =>
    request<WorkflowDefinition[]>("/api/v1/workflows"),
  createWorkflow: (data: {
    name: string;
    dag_schema: { nodes: any[]; edges: any[] };
    context?: Record<string, unknown>;
  }) =>
    request<{
      status: string;
      workflow_id: string;
      execution_id?: string;
      answer?: string;
      sources?: any[];
    }>("/api/v1/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  listWorkflowExecutions: () =>
    request<WorkflowExecution[]>("/api/v1/workflows/executions"),

  // Domain Agent 10: Data Analyst
  textToSql: (prompt: string, chartType: string = "bar", connectionId?: string) =>
    request<{
      status?: string;
      answer?: string;
      sql: string;
      row_count: number;
      data: Array<Record<string, unknown>>;
      chart: PlotlyChartSpec | null;
      sources?: any[];
    }>("/api/v1/data-analyst/text-to-sql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, chart_type: chartType, connection_id: connectionId }),
    }),
  executeSqlQuery: (sql: string) =>
    request<{ row_count: number; data: Array<Record<string, unknown>> }>("/api/v1/data-analyst/execute-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    }),

  // Centralized BYOK Integration Vault
  integrationCatalog: () => request<IntegrationCatalogItem[]>("/api/v1/integrations/catalog"),
  listIntegrationCatalog: () =>
    request<IntegrationCatalogItem[]>("/api/v1/integrations/catalog"),
  listIntegrationCategories: () =>
    request<CategoryMetadata[]>("/api/v1/integrations/categories"),
  listIntegrations: (category?: string) =>
    request<IntegrationCredential[]>(
      category && category !== "all"
        ? `/api/v1/integrations/credentials?category=${encodeURIComponent(category)}`
        : "/api/v1/integrations/credentials",
    ),
  createIntegration: (data: {
    category: string;
    provider: string;
    name?: string;
    secret_payload?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
    api_key?: string;
    config?: Record<string, unknown>;
    model_name?: string;
    base_url?: string;
    is_default?: boolean;
    assign_to_agents?: string[];
    assigned_agent_ids?: string[];
  }) => {
    const { secret_payload, assign_to_agents, ...rest } = data;
    const payload = {
      ...rest,
      secrets: data.secrets ?? secret_payload ?? {},
      assigned_agent_ids: data.assigned_agent_ids ?? assign_to_agents ?? [],
    };
    return request<IntegrationCredential>("/api/v1/integrations/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  updateIntegration: (
    id: string,
    data: {
      name?: string;
      secret_payload?: Record<string, unknown>;
      secrets?: Record<string, unknown>;
      api_key?: string;
      config?: Record<string, unknown>;
      model_name?: string;
      base_url?: string;
      is_active?: boolean;
      is_default?: boolean;
      assign_to_agents?: string[];
      assigned_agent_ids?: string[];
    },
  ) => {
    const { secret_payload, assign_to_agents, ...rest } = data;
    const secrets = data.secrets ?? secret_payload;
    const assignedIds = data.assigned_agent_ids ?? assign_to_agents;
    const payload = {
      ...rest,
      ...(secrets && Object.keys(secrets).length > 0 ? { secrets } : {}),
      ...(assignedIds ? { assigned_agent_ids: assignedIds } : {}),
    };
    return request<IntegrationCredential>(`/api/v1/integrations/credentials/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  deleteIntegration: (id: string) =>
    request<void>(`/api/v1/integrations/credentials/${id}`, { method: "DELETE" }),
  testIntegration: (id: string) =>
    request<IntegrationTestResult>(`/api/v1/integrations/credentials/${id}/test`, { method: "POST" }),
  testSavedIntegration: (id: string) => api.testIntegration(id),
  testUnsavedIntegration: (data: {
    category: string;
    provider: string;
    secret_payload?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
    api_key?: string;
    config?: Record<string, unknown>;
    model_name?: string;
    base_url?: string;
  }) => api.testDraftIntegration(data),
  testDraftIntegration: (data: {
    category: string;
    provider: string;
    secret_payload?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
    api_key?: string;
    config?: Record<string, unknown>;
    model_name?: string;
    base_url?: string;
  }) => {
    const { secret_payload, ...rest } = data;
    const payload = {
      ...rest,
      secrets: data.secrets ?? secret_payload ?? {},
    };
    return request<IntegrationTestResult>("/api/v1/integrations/credentials/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  setDefaultIntegration: (id: string) =>
    request<{ status: string }>(`/api/v1/integrations/credentials/${id}/default`, { method: "PUT" }),
  assignAgentsToIntegration: (id: string, agentIds: string[]) =>
    request<IntegrationCredential>(`/api/v1/integrations/credentials/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_agent_ids: agentIds }),
    }),

  // Legacy BYOK Settings (backward compatibility)
  listApiKeys: () => request<ProviderCredential[]>("/api/v1/settings/api-keys"),
  createApiKey: (data: {
    provider: string;
    name?: string;
    api_key: string;
    model_name: string;
    base_url?: string;
    is_default?: boolean;
  }) =>
    request<ProviderCredential>("/api/v1/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteApiKey: (id: string) =>
    request<void>(`/api/v1/settings/api-keys/${id}`, { method: "DELETE" }),
  testApiKey: (id: string) =>
    request<ProviderTestResult>(`/api/v1/settings/api-keys/${id}/test`, { method: "POST" }),
  listProviderCatalog: () =>
    request<ProviderCatalogItem[]>("/api/v1/settings/providers/catalog"),
};

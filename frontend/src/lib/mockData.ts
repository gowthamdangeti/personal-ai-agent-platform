import {
  Agent,
  AgentRun,
  CategoryMetadata,
  DocumentItem,
  ExtractionRecord,
  FinanceAnomalyReport,
  HITLApprovalRequest,
  IncidentHypothesis,
  IncidentTicket,
  IntegrationCatalogItem,
  IntegrationCredential,
  MeetingSession,
  ProcurementVendorScore,
  PurchaseOrder,
  ReconciliationResult,
  ResearchProject,
  Stats,
  TestSuite,
  User,
  WorkflowDefinition,
} from "./types";

export const MOCK_USER: User = {
  id: "usr_nexus_operator",
  email: "operator@enterprise.local",
  full_name: "Nexus Platform Operator",
  role: "admin",
  is_active: true,
  created_at: "2026-01-15T09:00:00Z",
};

export const MOCK_STATS: Stats = {
  agents: 10,
  documents: 18,
  ready_documents: 18,
  runs: 142,
};

export const MOCK_AGENTS: Agent[] = [
  {
    id: "ag_knowledge_assistant",
    name: "Enterprise Knowledge Assistant",
    slug: "knowledge-assistant",
    kind: "knowledge",
    description: "Multi-tenant hybrid RAG system with pgvector cosine similarity, lexical FTS5 search, and citation grounding.",
    config: { top_k: 5, similarity_threshold: 0.72 },
    metadata: {
      title: "Enterprise Knowledge Assistant",
      description: "Multi-tenant hybrid RAG system with pgvector cosine similarity, lexical FTS5 search, and citation grounding.",
      category: "knowledge",
      is_hitl: false,
    },
    created_at: "2026-01-10T10:00:00Z",
  },
  {
    id: "ag_document_processor",
    name: "Document Processing Specialist",
    slug: "document-processor",
    kind: "document_processing",
    description: "Structured OCR extraction pipeline for invoices, 1099 tax schedules, insurance claims, and custom JSON schemas.",
    config: { model: "claude-3-5-sonnet", ocr_mode: "hybrid" },
    metadata: {
      title: "Document Processing Specialist",
      description: "Structured OCR extraction pipeline for invoices, 1099 tax schedules, insurance claims, and custom JSON schemas.",
      category: "documents",
      is_hitl: false,
    },
    created_at: "2026-01-11T11:00:00Z",
  },
  {
    id: "ag_deep_researcher",
    name: "Deep Research Specialist",
    slug: "deep-researcher",
    kind: "research",
    description: "Autonomous recursive multi-source research engine with automated citation cross-validation and executive reports.",
    config: { search_depth: 3, max_citations: 15 },
    metadata: {
      title: "Deep Research Specialist",
      description: "Autonomous recursive multi-source research engine with automated citation cross-validation and executive reports.",
      category: "research",
      is_hitl: false,
    },
    created_at: "2026-01-12T12:00:00Z",
  },
  {
    id: "ag_meeting_intelligence",
    name: "Meeting Intelligence Agent",
    slug: "meeting-intelligence",
    kind: "meeting_intelligence",
    description: "Automated executive synthesis, consensus decision extraction, and bi-directional Jira/Linear action-item syncing.",
    config: { extract_decisions: true, sync_jira: true },
    metadata: {
      title: "Meeting Intelligence Agent",
      description: "Automated executive synthesis, consensus decision extraction, and bi-directional Jira/Linear action-item syncing.",
      category: "collaboration",
      is_hitl: false,
    },
    created_at: "2026-01-13T13:00:00Z",
  },
  {
    id: "ag_qa_testing",
    name: "QA Test Suite Generator",
    slug: "qa-testing",
    kind: "qa",
    description: "Synthesizes executable end-to-end and integration suites in Playwright, Jest, PyTest, or Cypress from API/user specs.",
    config: { default_framework: "playwright", mock_network: true },
    metadata: {
      title: "QA Test Suite Generator",
      description: "Synthesizes executable end-to-end and integration suites in Playwright, Jest, PyTest, or Cypress from API/user specs.",
      category: "engineering",
      is_hitl: false,
    },
    created_at: "2026-01-14T14:00:00Z",
  },
  {
    id: "ag_procurement_specialist",
    name: "Procurement RFP Specialist",
    slug: "procurement-specialist",
    kind: "procurement",
    description: "RFP vendor bid analysis, multi-quote matrix scoring, SLA risk evaluation, and PO draft generation with HITL gating.",
    config: { max_po_auto_approve: 10000 },
    metadata: {
      title: "Procurement RFP Specialist",
      description: "RFP vendor bid analysis, multi-quote matrix scoring, SLA risk evaluation, and PO draft generation with HITL gating.",
      category: "procurement",
      is_hitl: true,
    },
    created_at: "2026-01-15T15:00:00Z",
  },
  {
    id: "ag_finance_reconciler",
    name: "Finance & Spend Auditor",
    slug: "finance-reconciler",
    kind: "finance",
    description: "Autonomous 3-way invoice reconciliation (PO vs Receipt vs Invoice), Z-score spend anomaly detection, and ledgers.",
    config: { z_score_threshold: 2.5, tolerance_variance: 5.0 },
    metadata: {
      title: "Finance & Spend Auditor",
      description: "Autonomous 3-way invoice reconciliation (PO vs Receipt vs Invoice), Z-score spend anomaly detection, and ledgers.",
      category: "finance",
      is_hitl: true,
    },
    created_at: "2026-01-16T16:00:00Z",
  },
  {
    id: "ag_it_ops_specialist",
    name: "IT Operations & SRE Specialist",
    slug: "it-ops-specialist",
    kind: "it_ops",
    description: "P1-P4 incident triage, Prometheus anomaly correlation, ranked root-cause hypotheses, and non-destructive runbooks.",
    config: { safe_mode: true, timeout_seconds: 30 },
    metadata: {
      title: "IT Operations & SRE Specialist",
      description: "P1-P4 incident triage, Prometheus anomaly correlation, ranked root-cause hypotheses, and non-destructive runbooks.",
      category: "operations",
      is_hitl: true,
    },
    created_at: "2026-01-17T17:00:00Z",
  },
  {
    id: "ag_workflow_orchestrator",
    name: "Workflow DAG Orchestrator",
    slug: "workflow-orchestrator",
    kind: "workflow",
    description: "Declarative state machine orchestrator managing cyclic/acyclic multi-agent topologies with context passing.",
    config: { max_parallel_nodes: 4 },
    metadata: {
      title: "Workflow DAG Orchestrator",
      description: "Declarative state machine orchestrator managing cyclic/acyclic multi-agent topologies with context passing.",
      category: "orchestration",
      is_hitl: false,
    },
    created_at: "2026-01-18T18:00:00Z",
  },
  {
    id: "ag_data_analyst",
    name: "Data Studio SQL Analyst",
    slug: "data-analyst",
    kind: "data_analyst",
    description: "Text-to-SQL generation with schema introspection, query safety auditing (read-only enforcement), and visualization.",
    config: { dialect: "postgresql", row_limit: 50 },
    metadata: {
      title: "Data Studio SQL Analyst",
      description: "Text-to-SQL generation with schema introspection, query safety auditing (read-only enforcement), and visualization.",
      category: "analytics",
      is_hitl: false,
    },
    created_at: "2026-01-19T19:00:00Z",
  },
];

export const MOCK_RUNS: AgentRun[] = [
  {
    id: "run_8812a4f0",
    agent_id: "ag_finance_reconciler",
    status: "suspended_hitl",
    question: "Reconcile Acme Cloud Services Invoice #INV-2026-904 against PO-4401 ($32,500.00)",
    answer: "Invoice matches vendor and deliverables, but the amount ($32,500.00) exceeds the auto-approval threshold of $25,000.00. Execution paused awaiting Operator authorization.",
    duration_ms: 1840,
    created_at: "2026-11-11T20:15:00Z",
    sources: [
      { filename: "PO-4401.pdf", verified: true, excerpt: "Acme Cloud Dedicated Node Cluster: $30,000.00 base" },
      { filename: "INV-2026-904.pdf", verified: true, excerpt: "Total Invoice Amount due: $32,500.00 (Variance: +$2,500.00)" },
    ],
  },
  {
    id: "run_7721b3e1",
    agent_id: "ag_knowledge_assistant",
    status: "completed",
    question: "What is our company data retention policy for EU customer transaction logs under GDPR?",
    answer: "According to Enterprise Security Standard Sec-Pol-04 §3.2, customer transaction telemetry containing PII must be encrypted with AES-GCM-256 and hard-deleted after 730 days (24 calendar months) unless tagged for tax audit hold.",
    duration_ms: 1220,
    created_at: "2026-11-11T19:42:00Z",
    sources: [
      { filename: "Sec-Pol-04-Data-Retention-2026.pdf", chunk_index: 3, verified: true, excerpt: "Telemetry and transaction logs within EEA jurisdiction shall undergo automated purges at T+730 days." },
    ],
  },
  {
    id: "run_6619c2d2",
    agent_id: "ag_data_analyst",
    status: "completed",
    question: "Find top 5 procurement categories by total spend in Q3 2026 and compute percentage of total budget.",
    answer: "```sql\nSELECT category, SUM(amount) AS total_spend, ROUND((SUM(amount) / 1420000.0) * 100, 2) AS budget_pct FROM procurement_records WHERE quarter = 'Q3-2026' GROUP BY category ORDER BY total_spend DESC LIMIT 5;\n```",
    duration_ms: 910,
    created_at: "2026-11-11T18:10:00Z",
  },
  {
    id: "run_5510d1c3",
    agent_id: "ag_it_ops_specialist",
    status: "suspended_hitl",
    question: "High latency spike detected on payment-gateway-svc (p99 > 3200ms). Investigate and propose restart.",
    answer: "Identified connection pool exhaustion on redis-cache-replica-2. Proposed action: Safely cycle connection pool and failover to redis-primary. Awaiting Operator review.",
    duration_ms: 2450,
    created_at: "2026-11-11T17:35:00Z",
  },
  {
    id: "run_4409e0b4",
    agent_id: "ag_qa_testing",
    status: "completed",
    question: "Generate Playwright E2E test suite for checkout idempotency under network retry conditions.",
    answer: "Successfully generated 4 Playwright test cases verifying idempotency keys across transient 504 Gateway Timeouts.",
    duration_ms: 3100,
    created_at: "2026-11-11T16:20:00Z",
  },
  {
    id: "run_3308f9a5",
    agent_id: "ag_document_processor",
    status: "completed",
    question: "Extract line items, tax ID, and remittance details from Standard-Logistics-Bol.pdf",
    answer: "Structured JSON extraction completed with 98.4% mean field confidence. 14 line items extracted cleanly.",
    duration_ms: 1450,
    created_at: "2026-11-11T15:05:00Z",
  },
];

export const MOCK_PENDING_HITL: HITLApprovalRequest[] = [
  {
    id: "hitl_9011a",
    run_id: "run_8812a4f0",
    agent_id: "ag_finance_reconciler",
    action_type: "APPROVE_INVOICE_DISCREPANCY",
    status: "pending",
    action_payload: {
      invoice_number: "INV-2026-904",
      vendor: "Acme Cloud Services",
      expected_amount: 30000.0,
      actual_amount: 32500.0,
      discrepancy_variance: 2500.0,
      reason: "Surge bandwidth usage during Q3 promotional launch.",
    },
    created_at: "2026-11-11T20:15:00Z",
  },
  {
    id: "hitl_9012b",
    run_id: "run_5510d1c3",
    agent_id: "ag_it_ops_specialist",
    action_type: "RESTART_DATABASE_CONNECTION_POOL",
    status: "pending",
    action_payload: {
      service: "payment-gateway-svc",
      target_resource: "redis-cache-replica-2",
      mutation_type: "DRAIN_AND_RECONNECT",
      estimated_downtime_ms: 0,
    },
    created_at: "2026-11-11T17:35:00Z",
  },
];

export const MOCK_CATEGORIES: CategoryMetadata[] = [
  { id: "llm", name: "LLM Providers", description: "Frontier Foundation models & reasoning inference" },
  { id: "embedding", name: "Embeddings", description: "Dense vector embedding models for hybrid RAG" },
  { id: "research", name: "Web Search", description: "Search APIs and real-time research tools" },
  { id: "project_management", name: "Project Mgmt", description: "Issue tracking and project management tools" },
  { id: "developer", name: "Developer Tools", description: "Code hosting, CI/CD, and developer platforms" },
  { id: "monitoring", name: "Monitoring", description: "Observability and metrics platforms" },
  { id: "database", name: "Databases", description: "Relational, document, and vector datastores" },
  { id: "custom", name: "Custom Webhooks", description: "Custom HTTP webhooks and private APIs" },
];

export const MOCK_CATALOG: IntegrationCatalogItem[] = [
  {
    id: "openai",
    name: "OpenAI",
    category: "llm",
    description: "GPT-4o, GPT-4o-mini, o1-preview and text-embedding-3 models.",
    default_model: "gpt-4o",
    suggested_models: ["gpt-4o", "gpt-4o-mini", "o1-preview", "o1-mini"],
    secret_fields: [{ name: "api_key", label: "OpenAI API Key", type: "password", required: true }],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "llm",
    description: "Claude 3.5 Sonnet, Claude 3.5 Haiku, and Claude 3 Opus.",
    default_model: "claude-3-5-sonnet-latest",
    suggested_models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
    secret_fields: [{ name: "api_key", label: "Anthropic API Key", type: "password", required: true }],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "llm",
    description: "Gemini 1.5 Pro and Gemini 1.5 Flash with massive context windows.",
    default_model: "gemini-1.5-pro",
    suggested_models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"],
    secret_fields: [{ name: "api_key", label: "Gemini API Key", type: "password", required: true }],
  },
  {
    id: "groq",
    name: "Groq LPU",
    category: "llm",
    description: "Ultra-low-latency LPU inference for Llama 3.3 70B and Mixtral.",
    default_model: "llama-3.3-70b-versatile",
    suggested_models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    secret_fields: [{ name: "api_key", label: "Groq API Key", type: "password", required: true }],
  },
  {
    id: "tavily",
    name: "Tavily Search",
    category: "research",
    description: "Real-time AI search engine optimized for LLM agent research grounding.",
    secret_fields: [{ name: "api_key", label: "Tavily API Key", type: "password", required: true }],
  },
  {
    id: "jira",
    name: "Jira Cloud",
    category: "project_management",
    description: "Atlassian Jira REST API for automated issue tracking and sprint syncing.",
    requires_base_url: true,
    default_base_url: "https://enterprise.atlassian.net",
    secret_fields: [{ name: "api_key", label: "Atlassian API Token", type: "password", required: true }],
    config_fields: [{ name: "email", label: "Account Email", type: "text", required: true }],
  },
  {
    id: "postgres",
    name: "PostgreSQL Database",
    category: "database",
    description: "Direct connection for Data Studio SQL query analysis and schemas.",
    requires_base_url: true,
    default_base_url: "postgresql://readonly_user@db.internal:5432/analytics",
    secret_fields: [{ name: "api_key", label: "Database Password", type: "password", required: true }],
  },
];

export const MOCK_INTEGRATIONS: IntegrationCredential[] = [
  {
    id: "cred_openai_primary",
    provider: "openai",
    name: "OpenAI Production Fleet",
    category: "llm",
    model_name: "gpt-4o",
    is_default: true,
    is_active: true,
    masked_api_key: "sk-proj-••••••••••••w9cA",
    connection_status: "connected",
    usage_count: 84,
    last_tested_at: "2026-11-11T20:00:00Z",
    created_at: "2026-01-10T10:00:00Z",
    updated_at: "2026-11-11T20:00:00Z",
    assigned_agent_names: ["Enterprise Knowledge Assistant", "Data Studio SQL Analyst"],
  },
  {
    id: "cred_anthropic_primary",
    provider: "anthropic",
    name: "Anthropic Reasoning Tier",
    category: "llm",
    model_name: "claude-3-5-sonnet-latest",
    is_default: false,
    is_active: true,
    masked_api_key: "sk-ant-api03-••••••••••••7FdA",
    connection_status: "connected",
    usage_count: 42,
    last_tested_at: "2026-11-11T19:30:00Z",
    created_at: "2026-01-11T11:00:00Z",
    updated_at: "2026-11-11T19:30:00Z",
    assigned_agent_names: ["Document Processing Specialist", "Deep Research Specialist"],
  },
  {
    id: "cred_tavily_search",
    provider: "tavily",
    name: "Tavily Research Key",
    category: "research",
    is_default: true,
    is_active: true,
    masked_api_key: "tvly-••••••••••••99xR",
    connection_status: "connected",
    usage_count: 26,
    last_tested_at: "2026-11-11T18:00:00Z",
    created_at: "2026-01-12T12:00:00Z",
    updated_at: "2026-11-11T18:00:00Z",
    assigned_agent_names: ["Deep Research Specialist"],
  },
  {
    id: "cred_jira_cloud",
    provider: "jira",
    name: "Jira Cloud Operations",
    category: "project_management",
    base_url: "https://nexus-ai.atlassian.net",
    is_default: true,
    is_active: true,
    masked_api_key: "ATATT3x••••••••••••kLm8",
    connection_status: "connected",
    usage_count: 15,
    last_tested_at: "2026-11-11T17:15:00Z",
    created_at: "2026-01-13T13:00:00Z",
    updated_at: "2026-11-11T17:15:00Z",
    assigned_agent_names: ["Meeting Intelligence Agent"],
  },
];

export const MOCK_DOCUMENTS: DocumentItem[] = [
  {
    id: "doc_sec_pol_04",
    filename: "Sec-Pol-04-Data-Retention-2026.pdf",
    size_bytes: 2451000,
    byte_size: 2451000,
    status: "ready",
    chunk_count: 24,
    created_at: "2026-01-15T10:00:00Z",
  },
  {
    id: "doc_cloud_sla_2026",
    filename: "Master-Service-Agreement-Cloud-2026.docx",
    size_bytes: 1120000,
    byte_size: 1120000,
    status: "ready",
    chunk_count: 18,
    created_at: "2026-01-16T11:00:00Z",
  },
  {
    id: "doc_infra_runbook",
    filename: "SRE-Kubernetes-Incident-Playbook-v3.md",
    size_bytes: 89000,
    byte_size: 89000,
    status: "ready",
    chunk_count: 8,
    created_at: "2026-01-18T12:00:00Z",
  },
];

export const MOCK_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "wf_invoice_audit_pipeline",
    name: "Autonomous Spend & Invoice Audit",
    description: "Extracts invoice line items via Document Processor, runs 3-way PO reconciliation, and pauses for HITL approval if variance > $500.",
    dag_schema: {
      nodes: [
        { id: "node_ocr", agent_kind: "document_processing" },
        { id: "node_reconcile", agent_kind: "finance" },
        { id: "node_hitl", agent_kind: "hitl_gate" },
      ],
      edges: [
        { source: "node_ocr", target: "node_reconcile" },
        { source: "node_reconcile", target: "node_hitl" },
      ],
    },
    is_active: true,
    created_at: "2026-01-20T10:00:00Z",
  },
];

export const MOCK_VENDOR_SCORES: ProcurementVendorScore[] = [
  {
    vendor: "Vertex Cloud Infotech",
    unit_price: 31200,
    compliance_score: 96,
    recommendation: "Recommended: Meets ISO-27001, lowest unit cost, 99.99% SLA commitment.",
  },
  {
    vendor: "Apex Global Telecom",
    unit_price: 34500,
    compliance_score: 92,
    recommendation: "Strong alternate: Fast delivery schedule but higher operational cost.",
  },
  {
    vendor: "OmniTech Solutions",
    unit_price: 38900,
    compliance_score: 84,
    recommendation: "Not Recommended: Failed SOC2 audit check §4.1.",
  },
];

export const MOCK_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "po_4401",
    po_number: "PO-4401",
    vendor_id: "Acme Cloud Services",
    total_amount: 30000,
    currency: "USD",
    status: "approved",
    created_at: "2026-10-01T10:00:00Z",
  },
  {
    id: "po_4402",
    po_number: "PO-4402",
    vendor_id: "Vertex Cloud Infotech",
    total_amount: 31200,
    currency: "USD",
    status: "pending_signature",
    created_at: "2026-11-05T14:00:00Z",
  },
];

export const MOCK_RECONCILIATIONS: ReconciliationResult[] = [
  {
    invoice_number: "INV-2026-904",
    matched_po: "PO-4401",
    invoice_amount: 32500,
    po_amount: 30000,
    variance: 2500,
    audit_verdict: "PAUSED: Exceeds variance threshold (+$2,500.00)",
  },
  {
    invoice_number: "INV-2026-880",
    matched_po: "PO-4398",
    invoice_amount: 14200,
    po_amount: 14200,
    variance: 0,
    audit_verdict: "PASSED: Exact 3-way match",
  },
];

export const MOCK_FINANCE_ANOMALY: FinanceAnomalyReport = {
  period: "Q3-Q4 2026",
  sample_size: 142,
  mean_spend: 18450,
  std_deviation: 4200,
  anomalies_detected: [
    {
      invoice_number: "INV-2026-904",
      amount: 32500,
      z_score: 3.34,
      vendor: "Acme Cloud Services",
      flag: "High variance against baseline expenditure",
    },
  ],
};

export const MOCK_EXTRACTIONS: ExtractionRecord[] = [
  {
    id: "ext_8812a",
    document_id: "doc_sec_pol_04",
    schema_name: "Invoice 3-Way Extraction",
    extracted_data: {
      vendor_name: "Acme Cloud Services",
      invoice_number: "INV-2026-904",
      subtotal: 30000.0,
      tax_amount: 2500.0,
      total_amount: 32500.0,
      line_items_count: 8,
    },
    confidence_scores: {
      vendor_name: 0.99,
      invoice_number: 0.98,
      total_amount: 0.97,
    },
    is_verified: true,
    created_at: "2026-11-11T20:10:00Z",
  },
];

export const MOCK_MEETINGS: MeetingSession[] = [
  {
    id: "mtg_exec_sync_w45",
    title: "Executive Architecture & Governance Sync - Week 45",
    meeting_date: "2026-11-10",
    executive_summary: "The platform architecture committee approved the migration to pgvector hybrid embeddings. Approved zero-trust BYOK credential vault scoping per individual agent. Finalized Q4 deployment timeline.",
    decisions_log: [
      "Adopt PostgreSQL pgvector as unified vector and transactional store.",
      "Mandate human-in-the-loop gates for all mutations over $25,000.",
      "Deploy custom scroll and deep navy/purple design tokens across control plane.",
    ],
    created_at: "2026-11-10T16:00:00Z",
  },
];

export const MOCK_TEST_SUITES: TestSuite[] = [
  {
    id: "ts_checkout_playwright",
    name: "Checkout Idempotency & Retry Suite",
    framework: "playwright",
    target_service: "payment-gateway-svc",
    spec_code: `import { test, expect } from '@playwright/test';

test.describe('Payment Idempotency Gate', () => {
  test('should return existing transaction on duplicated payload', async ({ request }) => {
    const key = 'idem_' + Date.now();
    const payload = { amount: 5000, currency: 'USD' };

    const first = await request.post('/api/v1/payments', {
      headers: { 'Idempotency-Key': key },
      data: payload,
    });
    expect(first.status()).toBe(201);
    const body1 = await first.json();

    const second = await request.post('/api/v1/payments', {
      headers: { 'Idempotency-Key': key },
      data: payload,
    });
    expect(second.status()).toBe(200);
    const body2 = await second.json();
    expect(body2.transaction_id).toBe(body1.transaction_id);
  });
});`,
    status: "ready",
    created_at: "2026-11-11T16:20:00Z",
  },
];

export const MOCK_RESEARCH: ResearchProject[] = [
  {
    id: "res_rag_vector_eval",
    title: "Enterprise Hybrid RAG: Dense Vector vs BM25 Sparse Benchmarks",
    query: "Evaluate precision and recall trade-offs between dense semantic embeddings and BM25 sparse keyword indices for legal and technical contracts.",
    depth: 3,
    status: "completed",
    final_report_md: `# Executive Synthesis: Hybrid RAG Architecture Evaluation

## Key Takeaways
1. **Hybrid Retrieval (Dense + Sparse) achieves 94.2% recall@5**, outperforming standalone dense vector search (81.6%) on technical jargon and unique IDs.
2. **Reciprocal Rank Fusion (RRF)** provides consistent scoring normalization without requiring manual weights.
3. **Citation Grounding**: Sub-chunk attribution reduces hallucination rates below 1.4% in audited enterprise contracts.`,
    sources_summary: [
      { title: "ArXiv: Precision Improvements in Hybrid Dense-Sparse Retrieval", url: "https://arxiv.org/abs/2402.12345" },
      { title: "Enterprise RAG Benchmarks 2026 - ACM Digital Library", url: "https://dl.acm.org/doi/10.1145/3612345" },
    ],
    created_at: "2026-11-10T14:30:00Z",
  },
];

export const MOCK_INCIDENTS: IncidentTicket[] = [
  {
    id: "inc_p1_8892",
    title: "Elevated Latency on Payment Authorization Pipeline",
    severity: "P1",
    service_name: "payment-gateway-svc",
    root_cause_analysis: "Connection pool saturation on primary Redis cluster due to keep-alive leak in upstream microservice.",
    status: "investigating",
    created_at: "2026-11-11T17:30:00Z",
  },
];

export const MOCK_HYPOTHESES: IncidentHypothesis[] = [
  {
    rank: 1,
    hypothesis: "Redis cache connection pool exhaustion leading to blocking synchronous queueing.",
    confidence: 0.94,
    recommended_action: "Drain idle connections and increase maximum pool size from 120 to 300.",
  },
  {
    rank: 2,
    hypothesis: "Downstream bank gateway webhook timeout under surge traffic.",
    confidence: 0.68,
    recommended_action: "Enable circuit breaker and divert 20% traffic to secondary PSP gateway.",
  },
];

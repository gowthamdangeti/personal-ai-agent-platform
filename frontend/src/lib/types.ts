export interface AgentMetadata {
  title?: string;
  description?: string;
  category?: string;
  is_hitl?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  slug: string;
  kind: string;
  description?: string | null;
  config?: { top_k?: number; output?: string; [key: string]: unknown };
  created_at?: string;
  metadata?: AgentMetadata;
}

export interface AgentStepTrace {
  id?: string;
  run_id?: string;
  step_index: number;
  step_type: string;
  tool_name?: string | null;
  tool_input?: Record<string, unknown> | null;
  tool_output?: Record<string, unknown> | null;
  thought_content?: string | null;
  duration_ms?: number | null;
  created_at?: string;
}

export interface HITLApprovalRequest {
  id: string;
  run_id: string;
  agent_id: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface AgentRun {
  id: string;
  agent_id?: string;
  status: string;
  question: string;
  answer?: string | null;
  sources?: Array<{
    document_id?: string;
    filename?: string;
    chunk_index?: number;
    chunk_count?: number;
    excerpt?: string;
    distance?: number | null;
    verified?: boolean;
    url?: string;
    title?: string;
  }>;
  error_message?: string | null;
  duration_ms?: number | null;
  created_at: string;
}

export interface ResearchProject {
  id: string;
  title: string;
  query: string;
  depth: number;
  status: string;
  final_report_md?: string | null;
  sources_summary?: Array<{ title: string; url: string }>;
  created_at: string;
}

export interface MeetingSession {
  id: string;
  title: string;
  meeting_date: string;
  executive_summary?: string | null;
  decisions_log?: string[];
  created_at: string;
}

export interface ActionItem {
  id: string;
  meeting_id: string;
  task_description: string;
  assignee_name?: string | null;
  due_date?: string | null;
  status: string;
  external_ticket_id?: string | null;
  created_at: string;
}

export interface TestSuite {
  id: string;
  name: string;
  framework: string;
  target_service: string;
  spec_code: string;
  status: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  total_amount: number;
  currency: string;
  status: string;
  line_items?: Array<Record<string, unknown>>;
  created_at: string;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  vendor_id: string;
  matched_po_id?: string | null;
  amount: number;
  status: string;
  created_at: string;
}

export interface IncidentTicket {
  id: string;
  title: string;
  severity: "P1" | "P2" | "P3" | "P4";
  service_name: string;
  root_cause_analysis?: string | null;
  status: string;
  created_at: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string | null;
  dag_schema: {
    nodes: Array<{ id: string; agent_kind: string; params?: Record<string, unknown> }>;
    edges: Array<{ source: string; target: string }>;
  };
  is_active: boolean;
  created_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: string;
  context_data?: Record<string, unknown>;
  started_at: string;
  completed_at?: string | null;
}

export interface ExtractionRecord {
  id: string;
  document_id: string;
  schema_name: string;
  extracted_data: Record<string, unknown>;
  confidence_scores?: Record<string, number> | null;
  is_verified?: boolean;
  created_at: string;
}

export interface ProcurementVendorScore {
  vendor: string;
  unit_price: number;
  compliance_score: number;
  recommendation: string;
  [key: string]: unknown;
}

export interface ReconciliationResult {
  invoice_number: string;
  matched_po?: string | null;
  invoice_amount: number;
  po_amount?: number | null;
  variance: number;
  audit_verdict: string;
}

export interface FinanceAnomalyReport {
  period: string;
  sample_size: number;
  mean_spend: number;
  std_deviation: number;
  anomalies_detected: Array<Record<string, unknown>>;
}

export interface IncidentHypothesis {
  rank: number;
  hypothesis: string;
  confidence: number;
  recommended_action: string;
}

export interface HybridContextItem {
  chunk_id?: string;
  document_id?: string;
  filename?: string;
  chunk_index?: number;
  content?: string;
  distance?: number | null;
  score?: number | null;
}

export interface PlotlyChartSpec {
  data: Array<Record<string, unknown>>;
  layout: Record<string, unknown>;
}

export interface DocumentItem {
  id: string;
  filename: string;
  size_bytes: number;
  byte_size?: number;
  status: string;
  chunk_count: number;
  error_message?: string | null;
  created_at: string;
}

export interface Stats {
  agents: number;
  documents: number;
  ready_documents: number;
  runs: number;
}

export interface ProviderCredential {
  id: string;
  provider: string;
  name?: string | null;
  masked_api_key: string;
  model_name: string;
  base_url?: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProviderCatalogItem {
  id: string;
  name: string;
  description: string;
  default_model: string;
  suggested_models: string[];
  requires_base_url: boolean;
  default_base_url?: string | null;
}

export interface ProviderTestResult {
  success: boolean;
  message: string;
  provider: string;
  model?: string | null;
  latency_ms?: number | null;
}

// ----------------------------------------------------
// Centralized BYOK Integration Vault Types
// ----------------------------------------------------

export type IntegrationCategory =
  | "llm"
  | "embedding"
  | "research"
  | "project_management"
  | "developer"
  | "monitoring"
  | "database"
  | "custom";

export interface FieldDefinition {
  name: string;
  label: string;
  type: "text" | "password" | "url" | "number" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  description?: string;
  options?: string[];
  default?: unknown;
}

export interface IntegrationCatalogItem {
  id: string;
  name: string;
  category: IntegrationCategory | string;
  description: string;
  supported_auth_methods?: string[];
  secret_fields?: FieldDefinition[];
  config_fields?: FieldDefinition[];
  default_config?: Record<string, unknown>;
  suggested_models?: string[];
  default_model?: string | null;
  default_base_url?: string | null;
  requires_base_url?: boolean;
}

export interface IntegrationCredential {
  id: string;
  category: IntegrationCategory | string;
  provider: string;
  name?: string | null;
  masked_api_key?: string | null;
  masked_secrets?: Record<string, string>;
  config?: Record<string, unknown>;
  model_name?: string | null;
  base_url?: string | null;
  scopes?: string[];
  is_active: boolean;
  is_default: boolean;
  connection_status: "untested" | "healthy" | "failed" | string;
  last_tested_at?: string | null;
  usage_count: number;
  last_used_at?: string | null;
  assigned_agent_ids?: string[];
  assigned_agent_names?: string[];
  created_at: string;
  updated_at: string;
}

export interface IntegrationTestResult {
  success: boolean;
  message: string;
  category: string;
  provider: string;
  latency_ms?: number | null;
  details?: Record<string, unknown>;
}

export interface CategoryMetadata {
  id: IntegrationCategory | string;
  name: string;
  description: string;
}


export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginResponse {
  status: string;
  message: string;
  user: User;
  token: string;
}

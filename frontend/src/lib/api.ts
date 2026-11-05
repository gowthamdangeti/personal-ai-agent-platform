export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, cache: "no-store" });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the HTTP fallback message.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type Agent = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  description?: string | null;
  config?: { top_k?: number; output?: string; [key: string]: unknown };
  created_at?: string;
};
export type DocumentItem = {
  id: string; filename: string; size_bytes: number; status: string;
  chunk_count: number; error_message?: string | null; created_at: string;
};
export type AgentRun = {
  id: string; status: string; question: string; answer?: string | null;
  sources: { filename: string; chunk_index?: number; chunk_count?: number; excerpt?: string; distance?: number | null }[];
  duration_ms?: number | null;
  created_at: string;
};
export type Stats = { agents: number; documents: number; ready_documents: number; runs: number };

export type ProviderCredential = {
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
};

export type ProviderCatalogItem = {
  id: string;
  name: string;
  description: string;
  default_model: string;
  suggested_models: string[];
  requires_base_url: boolean;
  default_base_url?: string | null;
};

export type ProviderTestResult = {
  success: boolean;
  message: string;
  provider: string;
  model?: string | null;
  latency_ms?: number | null;
};

export const api = {
  health: async () => {
    const response = await fetch(`${API_BASE}/health/ready`, { cache: "no-store" });
    return response.json() as Promise<{ status: string; checks?: Record<string, boolean> }>;
  },
  stats: () => request<Stats>("/api/v1/dashboard/stats"),
  agents: () => request<Agent[]>("/api/v1/agents"),
  createAgent: (data: { name: string; kind?: string; description?: string; config?: Record<string, unknown> }) =>
    request<Agent>("/api/v1/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  documents: () => request<DocumentItem[]>("/api/v1/documents"),
  runs: () => request<AgentRun[]>("/api/v1/agents/runs?limit=10"),
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentItem>("/api/v1/documents", { method: "POST", body: form });
  },
  retryDocument: (id: string) => request<DocumentItem>(`/api/v1/documents/${id}/retry`, { method: "POST" }),
  runAgent: (id: string, question: string, kind: string, documentId?: string) => request<AgentRun>(`/api/v1/agents/${id}/runs`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(kind === "document_processing"
      ? { document_id: documentId, instructions: question, fields: [] }
      : { question, top_k: 5 }),
  }),

  // BYOK Settings
  listApiKeys: () => request<ProviderCredential[]>("/api/v1/settings/api-keys"),
  createApiKey: (data: { provider: string; name?: string; api_key: string; model_name: string; base_url?: string; is_default?: boolean }) =>
    request<ProviderCredential>("/api/v1/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  updateApiKey: (id: string, data: { name?: string; api_key?: string; model_name?: string; base_url?: string; is_active?: boolean; is_default?: boolean }) =>
    request<ProviderCredential>(`/api/v1/settings/api-keys/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteApiKey: (id: string) =>
    request<void>(`/api/v1/settings/api-keys/${id}`, { method: "DELETE" }),
  testUnsavedKey: (data: { provider: string; api_key: string; model_name?: string; base_url?: string }) =>
    request<ProviderTestResult>("/api/v1/settings/api-keys/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  testSavedKey: (id: string) =>
    request<ProviderTestResult>(`/api/v1/settings/api-keys/${id}/test`, { method: "POST" }),
  setDefaultProvider: (provider_id: string) =>
    request<ProviderCredential>("/api/v1/settings/default-provider", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id }),
    }),
  providerCatalog: () => request<ProviderCatalogItem[]>("/api/v1/settings/providers/catalog"),
};

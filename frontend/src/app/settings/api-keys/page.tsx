"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  api,
  ProviderCatalogItem,
  ProviderCredential,
  ProviderTestResult,
} from "@/lib/api";

const FALLBACK_CATALOG: ProviderCatalogItem[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Official OpenAI models including GPT-4o, GPT-4o-mini, and reasoning models.",
    default_model: "gpt-4o-mini",
    suggested_models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo", "o3-mini"],
    requires_base_url: false,
    default_base_url: "https://api.openai.com/v1",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Google Gemini models with large context windows and multimodal capabilities.",
    default_model: "gemini-1.5-flash",
    suggested_models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
    requires_base_url: false,
    default_base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Ultra-fast LPU inference hosting open models like Llama 3 and Mixtral.",
    default_model: "llama-3.3-70b-versatile",
    suggested_models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    requires_base_url: false,
    default_base_url: "https://api.groq.com/openai/v1",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Advanced coding and reasoning models with exceptional price-performance.",
    default_model: "deepseek-chat",
    suggested_models: ["deepseek-chat", "deepseek-reasoner"],
    requires_base_url: false,
    default_base_url: "https://api.deepseek.com",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Unified gateway to hundreds of open-source and proprietary AI models.",
    default_model: "openai/gpt-4o-mini",
    suggested_models: [
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
      "meta-llama/llama-3.3-70b-instruct",
      "google/gemini-2.0-flash-exp:free",
    ],
    requires_base_url: false,
    default_base_url: "https://openrouter.ai/api/v1",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models specialized in nuanced analysis, complex writing, and coding.",
    default_model: "claude-3-5-sonnet-latest",
    suggested_models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
    requires_base_url: false,
    default_base_url: "https://api.anthropic.com/v1",
  },
  {
    id: "custom",
    name: "Custom (OpenAI-Compatible)",
    description: "Self-hosted vLLM, Ollama, LM Studio, LocalAI, or corporate gateways.",
    default_model: "default",
    suggested_models: ["default"],
    requires_base_url: true,
    default_base_url: null,
  },
];

export default function ApiKeysPage() {
  const [catalog, setCatalog] = useState<ProviderCatalogItem[]>(FALLBACK_CATALOG);
  const [credentials, setCredentials] = useState<ProviderCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Testing feedback states: map of credentialId -> ProviderTestResult
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<ProviderCredential | null>(null);
  const [modalProvider, setModalProvider] = useState("openai");
  const [modalName, setModalName] = useState("");
  const [modalApiKey, setModalApiKey] = useState("");
  const [modalModel, setModalModel] = useState("");
  const [modalCustomModel, setModalCustomModel] = useState("");
  const [modalBaseUrl, setModalBaseUrl] = useState("");
  const [modalIsDefault, setModalIsDefault] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<ProviderTestResult | null>(null);
  const [modalTesting, setModalTesting] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [catList, credList] = await Promise.all([
        api.providerCatalog().catch(() => FALLBACK_CATALOG),
        api.listApiKeys(),
      ]);
      setCatalog(catList);
      setCredentials(credList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const defaultCred = useMemo(
    () => credentials.find((c) => c.is_default && c.is_active),
    [credentials]
  );

  function openCreateModal(providerId?: string) {
    const prov = catalog.find((c) => c.id === providerId) || catalog[0];
    setEditingCred(null);
    setModalProvider(prov.id);
    setModalName("");
    setModalApiKey("");
    setModalModel(prov.default_model);
    setModalCustomModel("");
    setModalBaseUrl(prov.default_base_url || "");
    setModalIsDefault(credentials.length === 0);
    setShowKey(false);
    setModalTestResult(null);
    setModalOpen(true);
  }

  function openEditModal(cred: ProviderCredential) {
    const prov = catalog.find((c) => c.id === cred.provider) || catalog[0];
    setEditingCred(cred);
    setModalProvider(cred.provider);
    setModalName(cred.name || "");
    setModalApiKey(""); // never pre-fill saved key
    const isSuggested = prov.suggested_models.includes(cred.model_name);
    setModalModel(isSuggested ? cred.model_name : "custom_model_option");
    setModalCustomModel(isSuggested ? "" : cred.model_name);
    setModalBaseUrl(cred.base_url || "");
    setModalIsDefault(cred.is_default);
    setShowKey(false);
    setModalTestResult(null);
    setModalOpen(true);
  }

  async function handleTestSaved(cred: ProviderCredential) {
    setTestingId(cred.id);
    setError("");
    try {
      const result = await api.testSavedKey(cred.id);
      setTestResults((prev) => ({ ...prev, [cred.id]: result }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [cred.id]: {
          success: false,
          message: err instanceof Error ? err.message : "Connection test failed",
          provider: cred.provider,
        },
      }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleSetDefault(cred: ProviderCredential) {
    setError("");
    setNotice("");
    try {
      await api.setDefaultProvider(cred.id);
      setNotice(`Default provider updated to ${cred.provider.toUpperCase()} (${cred.model_name}).`);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set default provider");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    setError("");
    setNotice("");
    try {
      await api.deleteApiKey(deleteId);
      setNotice("API key deleted successfully.");
      setDeleteId(null);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete API key");
    }
  }

  async function handleModalTest() {
    if (!modalApiKey.trim() && !editingCred) {
      setModalTestResult({
        success: false,
        message: "Enter an API key to test.",
        provider: modalProvider,
      });
      return;
    }

    setModalTesting(true);
    setModalTestResult(null);

    const effectiveModel =
      modalModel === "custom_model_option" ? modalCustomModel.trim() : modalModel;

    try {
      if (editingCred && !modalApiKey.trim()) {
        // Test existing saved key
        const res = await api.testSavedKey(editingCred.id);
        setModalTestResult(res);
      } else {
        // Test unsaved key
        const res = await api.testUnsavedKey({
          provider: modalProvider,
          api_key: modalApiKey.trim(),
          model_name: effectiveModel,
          base_url: modalBaseUrl.trim() || undefined,
        });
        setModalTestResult(res);
      }
    } catch (err) {
      setModalTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection test failed",
        provider: modalProvider,
      });
    } finally {
      setModalTesting(false);
    }
  }

  async function handleModalSave(e: React.FormEvent) {
    e.preventDefault();
    const effectiveModel =
      (modalModel === "custom_model_option" ? modalCustomModel.trim() : modalModel) ||
      catalog.find((c) => c.id === modalProvider)?.default_model ||
      "default";

    if (!editingCred && !modalApiKey.trim()) {
      setError("Please provide an API key.");
      return;
    }

    setModalSubmitting(true);
    setError("");
    setNotice("");

    try {
      if (editingCred) {
        await api.updateApiKey(editingCred.id, {
          name: modalName.trim() || undefined,
          api_key: modalApiKey.trim() || undefined,
          model_name: effectiveModel,
          base_url: modalBaseUrl.trim() || undefined,
          is_default: modalIsDefault,
        });
        setNotice(`API key for ${modalProvider.toUpperCase()} updated successfully.`);
      } else {
        await api.createApiKey({
          provider: modalProvider,
          name: modalName.trim() || undefined,
          api_key: modalApiKey.trim(),
          model_name: effectiveModel,
          base_url: modalBaseUrl.trim() || undefined,
          is_default: modalIsDefault,
        });
        setNotice(`API key for ${modalProvider.toUpperCase()} saved securely.`);
      }
      setModalOpen(false);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save credential");
    } finally {
      setModalSubmitting(false);
    }
  }

  const selectedCatalogItem = useMemo(
    () => catalog.find((c) => c.id === modalProvider) || catalog[0],
    [catalog, modalProvider]
  );

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand-mark">A</div>
        <div className="brand-name">Personal <span>AI Platform</span></div>

        <div className="workspace-label">CORE</div>
        <nav>
          <Link className="sidebar-nav-btn" href="/?tab=overview">
            <i>◫</i> <span>Overview</span>
          </Link>
          <Link className="sidebar-nav-btn" href="/?tab=agents">
            <i>🤖</i> <span>My Agents</span>
          </Link>
          <Link className="sidebar-nav-btn" href="/?tab=workflows">
            <i>⚡</i> <span>Workflow Builder</span>
          </Link>
        </nav>

        <div className="workspace-label">KNOWLEDGE &amp; DATA</div>
        <nav>
          <Link className="sidebar-nav-btn" href="/?tab=knowledge">
            <i>📚</i> <span>Knowledge Bases</span>
          </Link>
          <Link className="sidebar-nav-btn" href="/?tab=documents">
            <i>📄</i> <span>Documents</span>
          </Link>
        </nav>

        <div className="workspace-label">ACTIONS &amp; TOOLS</div>
        <nav>
          <Link className="sidebar-nav-btn" href="/?tab=integrations">
            <i>🔌</i> <span>Integrations &amp; Tools</span>
          </Link>
          <Link className="sidebar-nav-btn" href="/?tab=history">
            <i>🕒</i> <span>Execution History</span>
          </Link>
          <Link className="sidebar-nav-btn" href="/?tab=approvals">
            <i>🛡️</i> <span>Approvals</span>
          </Link>
        </nav>

        <div className="workspace-label">INSIGHTS &amp; CONFIG</div>
        <nav>
          <Link className="sidebar-nav-btn" href="/?tab=analytics">
            <i>📊</i> <span>Analytics &amp; Reports</span>
          </Link>
          <Link className="sidebar-nav-btn active" href="/settings/api-keys">
            <i>⚙️</i> <span>Settings</span>
          </Link>
        </nav>

        <div className="sidebar-bottom">
          <div className="local-pill"><i /> Local workspace</div>
          <small>Personal AI Agent Platform<br />FastAPI · Next.js · pgvector · BYOK</small>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div>
            <div className="eyebrow">SETTINGS &amp; CREDENTIALS</div>
            <h1>API Key Management (BYOK)</h1>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button className="secondary-button" onClick={() => void refreshData()} disabled={loading}>
              ↻ Refresh
            </button>
            <button className="primary-button" onClick={() => openCreateModal()}>
              + Add API Key
            </button>
          </div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        <div className="panel" style={{ padding: "18px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "1px" }}>ACTIVE DEFAULT PROVIDER</div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "4px" }}>
                {defaultCred ? (
                  <>
                    <span style={{ textTransform: "uppercase", color: "var(--blue)" }}>{defaultCred.provider}</span>
                    <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: "13px", marginLeft: "8px" }}>
                      model: <strong>{defaultCred.model_name}</strong>
                    </span>
                  </>
                ) : (
                  <span style={{ color: "#d97706" }}>No BYOK provider configured (falling back to preview mode or global env)</span>
                )}
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "var(--muted)", maxWidth: "480px" }}>
              All keys are stored securely using <strong>Fernet symmetric encryption</strong> in PostgreSQL and decrypted strictly in-memory during agent execution.
            </div>
          </div>
        </div>

        <div className="provider-grid">
          {catalog.map((item) => {
            const configuredList = credentials.filter((c) => c.provider.toLowerCase() === item.id.toLowerCase());
            const cred = configuredList[0];
            const isConfigured = Boolean(cred);
            const isDefault = Boolean(cred?.is_default && cred?.is_active);
            const testResult = cred ? testResults[cred.id] : null;

            return (
              <div key={item.id} className={`provider-card ${isDefault ? "is-default" : ""}`}>
                <div className="provider-header">
                  <div className="provider-identity">
                    <div className={`provider-avatar avatar-${item.id}`}>
                      {item.id === "openai" ? "AI" : item.id === "gemini" ? "G" : item.id === "groq" ? "GQ" : item.id === "deepseek" ? "DS" : item.id === "openrouter" ? "OR" : item.id === "anthropic" ? "C" : "CU"}
                    </div>
                    <div className="provider-info">
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                    </div>
                  </div>
                  <div className="badges-row">
                    {isDefault && <span className="badge-default">★ Default</span>}
                    {isConfigured ? (
                      <span className="badge-active">● Active</span>
                    ) : (
                      <span className="badge-unconfigured">Not configured</span>
                    )}
                  </div>
                </div>

                <div className="provider-details">
                  <div className="detail-item">
                    <span className="detail-label">Model:</span>
                    <span className="detail-value" title={cred?.model_name || item.default_model}>
                      {cred?.model_name || item.default_model}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">API Key:</span>
                    {isConfigured ? (
                      <span className="masked-key">{cred.masked_api_key}</span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "11px" }}>Unconfigured</span>
                    )}
                  </div>
                  {item.requires_base_url && (
                    <div className="detail-item">
                      <span className="detail-label">Base URL:</span>
                      <span className="detail-value" title={cred?.base_url || "Custom endpoint"}>
                        {cred?.base_url || "Required"}
                      </span>
                    </div>
                  )}
                  {isConfigured && (
                    <div className="detail-item">
                      <span className="detail-label">Updated:</span>
                      <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                        {new Date(cred.updated_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {testResult && (
                  <div className={`test-result-box ${testResult.success ? "success" : "error"}`}>
                    <span>{testResult.success ? "✓" : "⚠"}</span>
                    <span>{testResult.message}</span>
                  </div>
                )}

                <div className="provider-actions">
                  <div className="provider-actions-left">
                    {isConfigured ? (
                      <>
                        <button
                          className="secondary-button"
                          onClick={() => void handleTestSaved(cred)}
                          disabled={testingId === cred.id}
                        >
                          {testingId === cred.id ? "Testing…" : "Test Connection"}
                        </button>
                        {!isDefault && (
                          <button
                            className="text-button"
                            onClick={() => void handleSetDefault(cred)}
                            style={{ fontSize: "11px" }}
                          >
                            Set Default
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        className="primary-button"
                        onClick={() => openCreateModal(item.id)}
                        style={{ padding: "8px 12px", fontSize: "11px" }}
                      >
                        + Configure Key
                      </button>
                    )}
                  </div>
                  <div className="provider-actions-right">
                    {isConfigured && (
                      <>
                        <button
                          className="secondary-button"
                          onClick={() => openEditModal(cred)}
                          style={{ padding: "8px 10px", fontSize: "11px" }}
                        >
                          Edit
                        </button>
                        <button
                          className="danger-button"
                          onClick={() => setDeleteId(cred.id)}
                          style={{ padding: "8px 10px", fontSize: "11px" }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "30px", padding: "16px 20px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #edf2f7", fontSize: "12px", color: "var(--muted)", lineHeight: 1.6 }}>
          <strong>Security Notice:</strong> BYOK encryption uses Fernet with the server key. Keys are never transmitted in frontend logs, URL parameters, or browser storage. In single-user development mode, all keys are saved to your local database container.
        </div>
      </section>

      {/* Add / Edit API Key Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => !modalSubmitting && setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCred ? `Edit ${modalProvider.toUpperCase()} Key` : "Add AI Provider API Key"}</h2>
              <button className="icon-button" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleModalSave} className="modal-body">
              <div className="input-group">
                <label htmlFor="modal-provider-select">Provider</label>
                <select
                  id="modal-provider-select"
                  value={modalProvider}
                  disabled={Boolean(editingCred)}
                  onChange={(e) => {
                    const provId = e.target.value;
                    setModalProvider(provId);
                    const catItem = catalog.find((c) => c.id === provId);
                    if (catItem) {
                      setModalModel(catItem.default_model);
                      setModalBaseUrl(catItem.default_base_url || "");
                    }
                    setModalTestResult(null);
                  }}
                >
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="modal-name-input">Key Label (Optional)</label>
                <input
                  id="modal-name-input"
                  type="text"
                  placeholder="e.g. My Personal Key"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label htmlFor="modal-key-input">
                  API Key {editingCred && <small>(Leave blank to keep existing key)</small>}
                </label>
                <div className="key-input-wrapper">
                  <input
                    id="modal-key-input"
                    type={showKey ? "text" : "password"}
                    placeholder={
                      editingCred
                        ? `Current: ${editingCred.masked_api_key}`
                        : modalProvider === "anthropic"
                        ? "sk-ant-..."
                        : modalProvider === "gemini"
                        ? "AIza..."
                        : modalProvider === "groq"
                        ? "gsk_..."
                        : "sk-..."
                    }
                    value={modalApiKey}
                    onChange={(e) => setModalApiKey(e.target.value)}
                    required={!editingCred}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="toggle-visibility-btn"
                    onClick={() => setShowKey(!showKey)}
                    title={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                </div>
                <small>Key will be encrypted with Fernet and never shown in plain text again.</small>
              </div>

              <div className="input-group">
                <label htmlFor="modal-model-select">Model</label>
                <select
                  id="modal-model-select"
                  value={modalModel}
                  onChange={(e) => setModalModel(e.target.value)}
                >
                  {selectedCatalogItem.suggested_models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="custom_model_option">Other / Custom Model...</option>
                </select>
              </div>

              {modalModel === "custom_model_option" && (
                <div className="input-group">
                  <label htmlFor="modal-custom-model-input">Custom Model Name</label>
                  <input
                    id="modal-custom-model-input"
                    type="text"
                    placeholder="e.g. meta-llama/Llama-3-70b-chat-hf"
                    value={modalCustomModel}
                    onChange={(e) => setModalCustomModel(e.target.value)}
                    required
                  />
                </div>
              )}

              {(selectedCatalogItem.requires_base_url || modalProvider === "custom") && (
                <div className="input-group">
                  <label htmlFor="modal-base-url">Base URL (Required for Custom)</label>
                  <input
                    id="modal-base-url"
                    type="url"
                    placeholder="https://api.together.xyz/v1"
                    value={modalBaseUrl}
                    onChange={(e) => setModalBaseUrl(e.target.value)}
                    required={modalProvider === "custom"}
                  />
                  <small>Must be a public, valid HTTP/HTTPS endpoint. Private/local IPs are blocked for SSRF protection.</small>
                </div>
              )}

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={modalIsDefault}
                  onChange={(e) => setModalIsDefault(e.target.checked)}
                />
                <span>Set as default provider for all agents</span>
              </label>

              {modalTestResult && (
                <div className={`test-result-box ${modalTestResult.success ? "success" : "error"}`}>
                  <span>{modalTestResult.success ? "✓" : "⚠"}</span>
                  <span>{modalTestResult.message}</span>
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handleModalTest()}
                  disabled={modalTesting || modalSubmitting || (!modalApiKey.trim() && !editingCred)}
                >
                  {modalTesting ? "Testing…" : "Test Connection"}
                </button>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setModalOpen(false)}
                    disabled={modalSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={modalSubmitting || modalTesting}
                  >
                    {modalSubmitting ? "Saving…" : "Save API Key"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="modal-backdrop" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button className="icon-button" onClick={() => setDeleteId(null)}>✕</button>
            </div>
            <p className="muted" style={{ margin: "10px 0 20px" }}>
              Are you sure you want to permanently delete this API key? Agents relying on this provider will fall back to other active credentials or preview mode.
            </p>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setDeleteId(null)}>
                Cancel
              </button>
              <button className="danger-button" onClick={() => void handleDeleteConfirm()}>
                Delete Key
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


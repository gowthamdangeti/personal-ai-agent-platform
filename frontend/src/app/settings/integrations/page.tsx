"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  Edit3,
  Eye,
  EyeOff,
  GitBranch,
  Globe,
  Kanban,
  Key,
  LucideIcon,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Webhook,
  Zap,
} from "lucide-react";
import {
  Agent,
  api,
  CategoryMetadata,
  FieldDefinition,
  IntegrationCatalogItem,
  IntegrationCredential,
  IntegrationTestResult,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import {
  FormGroup,
  SelectInput,
  TextareaInput,
  TextInput,
} from "@/components/common/FormControls";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { CardGridSkeleton } from "@/components/common/Skeleton";
import { Tabs } from "@/components/common/Tabs";

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  all: Key,
  llm: Sparkles,
  embedding: Cpu,
  research: Globe,
  project_management: Kanban,
  developer: GitBranch,
  monitoring: Activity,
  database: Database,
  custom: Webhook,
};

function getProviderIcon(category: string, provider?: string): LucideIcon {
  const p = (provider || "").toLowerCase();
  if (p.includes("openai") || p.includes("anthropic") || p.includes("gemini") || p.includes("groq")) {
    return Sparkles;
  }
  if (p.includes("jira") || p.includes("linear")) return Kanban;
  if (p.includes("github") || p.includes("gitlab")) return GitBranch;
  if (p.includes("postgres") || p.includes("sql") || p.includes("snowflake")) return Database;
  if (p.includes("slack") || p.includes("webhook")) return Webhook;
  if (p.includes("tavily") || p.includes("serper") || p.includes("exa")) return Globe;
  return CATEGORY_ICON_MAP[category] || Bot;
}

export default function IntegrationsVaultPage() {
  const [categories, setCategories] = useState<CategoryMetadata[]>([]);
  const [catalog, setCatalog] = useState<IntegrationCatalogItem[]>([]);
  const [credentials, setCredentials] = useState<IntegrationCredential[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IntegrationCredential | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<IntegrationCredential | null>(null);
  const [modalCategory, setModalCategory] = useState("llm");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [credName, setCredName] = useState("");
  const [modelName, setModelName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [secretsForm, setSecretsForm] = useState<Record<string, string>>({});
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [assignedAgentIds, setAssignedAgentIds] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [savingModal, setSavingModal] = useState(false);
  const [testingDraft, setTestingDraft] = useState(false);
  const [draftTestResult, setDraftTestResult] = useState<IntegrationTestResult | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadVaultData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, catalogRes, credsRes, agentsRes] = await Promise.all([
        api.listIntegrationCategories(),
        api.listIntegrationCatalog(),
        api.listIntegrations(),
        api.listAgentsWithMetadata(),
      ]);
      setCategories(Array.isArray(catRes) ? catRes : []);
      setCatalog(Array.isArray(catalogRes) ? catalogRes : []);
      setCredentials(Array.isArray(credsRes) ? credsRes : []);
      setAgents(Array.isArray(agentsRes) ? agentsRes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integration vault.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVaultData();
  }, [loadVaultData]);

  const tabItems = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of credentials) {
      counts[c.category] = (counts[c.category] || 0) + 1;
    }

    const dynamicCats =
      categories.length > 0
        ? categories
        : [
            { id: "llm", name: "LLM Providers", description: "" },
            { id: "embedding", name: "Embeddings", description: "" },
            { id: "research", name: "Web Search", description: "" },
            { id: "project_management", name: "Project Mgmt", description: "" },
            { id: "developer", name: "Developer Tools", description: "" },
            { id: "monitoring", name: "Monitoring", description: "" },
            { id: "database", name: "Databases", description: "" },
            { id: "custom", name: "Custom", description: "" },
          ];

    return [
      { id: "all", label: "All Integrations", count: credentials.length, icon: Key },
      ...dynamicCats.map((cat) => ({
        id: cat.id,
        label: cat.name,
        count: counts[cat.id] || 0,
        icon: CATEGORY_ICON_MAP[cat.id] || Key,
      })),
    ];
  }, [categories, credentials]);

  const filteredCredentials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return credentials.filter((c) => {
      if (activeTab !== "all" && c.category !== activeTab) return false;
      if (!q) return true;
      return (
        (c.name || "").toLowerCase().includes(q) ||
        c.provider.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.model_name || "").toLowerCase().includes(q)
      );
    });
  }, [credentials, activeTab, searchQuery]);

  const providersInCategory = useMemo(
    () => catalog.filter((item) => item.category === modalCategory),
    [catalog, modalCategory],
  );

  const activeCatalogItem = useMemo(
    () =>
      catalog.find(
        (item) => item.id === selectedProvider && item.category === modalCategory,
      ) || catalog.find((item) => item.id === selectedProvider),
    [catalog, selectedProvider, modalCategory],
  );

  const applyProviderDefaults = (item: IntegrationCatalogItem | undefined) => {
    if (!item) return;
    setModelName(item.default_model || item.suggested_models?.[0] || "");
    setBaseUrl(item.default_base_url || "");
    const nextConfig: Record<string, string> = {};
    for (const field of item.config_fields || []) {
      const def = field.default ?? item.default_config?.[field.name];
      if (def !== undefined && def !== null) nextConfig[field.name] = String(def);
    }
    setConfigForm(nextConfig);
    setSecretsForm({});
  };

  const openAddModal = () => {
    const startCategory = activeTab !== "all" ? activeTab : categories[0]?.id || "llm";
    const matching = catalog.filter((c) => c.category === startCategory);
    const firstProvider = matching[0] || catalog[0];

    setEditingCred(null);
    setModalCategory(startCategory);
    setSelectedProvider(firstProvider?.id || "");
    setCredName("");
    setAssignedAgentIds([]);
    setIsDefault(false);
    setRevealedSecrets({});
    setDraftTestResult(null);
    setModalError(null);
    applyProviderDefaults(firstProvider);
    setModalOpen(true);
  };

  const openEditModal = (cred: IntegrationCredential) => {
    setEditingCred(cred);
    setModalCategory(cred.category);
    setSelectedProvider(cred.provider);
    setCredName(cred.name || "");
    setModelName(cred.model_name || "");
    setBaseUrl(cred.base_url || "");
    setAssignedAgentIds(cred.assigned_agent_ids || []);
    setIsDefault(Boolean(cred.is_default));
    setSecretsForm({});
    const cfg: Record<string, string> = {};
    if (cred.config) {
      for (const [k, v] of Object.entries(cred.config)) {
        cfg[k] = String(v ?? "");
      }
    }
    setConfigForm(cfg);
    setRevealedSecrets({});
    setDraftTestResult(null);
    setModalError(null);
    setModalOpen(true);
  };

  const handleCategoryChangeInModal = (nextCat: string) => {
    setModalCategory(nextCat);
    const matching = catalog.filter((item) => item.category === nextCat);
    const first = matching[0];
    setSelectedProvider(first?.id || "");
    setDraftTestResult(null);
    applyProviderDefaults(first);
  };

  const handleProviderChangeInModal = (nextProviderId: string) => {
    setSelectedProvider(nextProviderId);
    const found = catalog.find(
      (item) => item.id === nextProviderId && item.category === modalCategory,
    );
    setDraftTestResult(null);
    applyProviderDefaults(found);
  };

  const buildPayloadSecrets = () => {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(secretsForm)) {
      if (v.trim()) cleaned[k] = v.trim();
    }
    return cleaned;
  };

  const handleTestDraft = async () => {
    setModalError(null);
    setDraftTestResult(null);
    setTestingDraft(true);
    try {
      const secrets = buildPayloadSecrets();
      const res = await api.testDraftIntegration({
        category: modalCategory,
        provider: selectedProvider,
        secrets,
        api_key: secrets.api_key,
        config: configForm,
        model_name: modelName || undefined,
        base_url: baseUrl || undefined,
      });
      setDraftTestResult(res);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Connection verification failed.");
    } finally {
      setTestingDraft(false);
    }
  };

  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const secrets = buildPayloadSecrets();

    if (!editingCred && (activeCatalogItem?.secret_fields?.length || 0) > 0) {
      const missingReq = (activeCatalogItem?.secret_fields || []).find(
        (f) => f.required && !secrets[f.name],
      );
      if (missingReq) {
        setModalError(`${missingReq.label} is required.`);
        return;
      }
    }

    setSavingModal(true);
    try {
      if (editingCred) {
        await api.updateIntegration(editingCred.id, {
          name: credName.trim() || undefined,
          ...(Object.keys(secrets).length > 0 ? { secrets } : {}),
          api_key: secrets.api_key || undefined,
          config: configForm,
          model_name: modelName.trim() || undefined,
          base_url: baseUrl.trim() || undefined,
          is_default: isDefault,
          assigned_agent_ids: assignedAgentIds,
        });
        setBannerSuccess(`Updated integration "${credName || editingCred.provider}".`);
      } else {
        await api.createIntegration({
          category: modalCategory,
          provider: selectedProvider,
          name: credName.trim() || undefined,
          secrets,
          api_key: secrets.api_key || undefined,
          config: configForm,
          model_name: modelName.trim() || undefined,
          base_url: baseUrl.trim() || undefined,
          is_default: isDefault,
          assigned_agent_ids: assignedAgentIds,
        });
        setBannerSuccess(`Registered "${credName || selectedProvider}" in encrypted vault.`);
      }
      setModalOpen(false);
      await loadVaultData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to save integration.");
    } finally {
      setSavingModal(false);
    }
  };

  const handleTestSaved = async (cred: IntegrationCredential) => {
    setTestingId(cred.id);
    setError(null);
    try {
      const res = await api.testIntegration(cred.id);
      setBannerSuccess(
        `${cred.name || cred.provider}: ${res.message}${res.latency_ms ? ` (${res.latency_ms}ms)` : ""}`,
      );
      await loadVaultData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setTestingId(null);
    }
  };

  const handleSetDefault = async (cred: IntegrationCredential) => {
    setError(null);
    try {
      await api.setDefaultIntegration(cred.id);
      setBannerSuccess(`Set "${cred.name || cred.provider}" as default for ${cred.category}.`);
      await loadVaultData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set default integration.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteIntegration(deleteTarget.id);
      setBannerSuccess(`Removed "${deleteTarget.name || deleteTarget.provider}" from vault.`);
      setDeleteTarget(null);
      await loadVaultData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete integration.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleAgentAssignment = (agentId: string) => {
    setAssignedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    );
  };

  const renderFieldInput = (
    field: FieldDefinition,
    value: string,
    onChange: (val: string) => void,
    isSecret: boolean,
  ) => {
    const isRevealed = Boolean(revealedSecrets[field.name]);
    if (field.type === "select" && field.options) {
      return (
        <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select {field.label}</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </SelectInput>
      );
    }
    if (field.type === "textarea") {
      return (
        <TextareaInput
          rows={3}
          monospace={isSecret}
          placeholder={field.placeholder || (editingCred && isSecret ? "Leave blank to keep existing secret" : "")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    return (
      <div className="relative">
        <TextInput
          type={isSecret && !isRevealed ? "password" : field.type === "number" ? "number" : "text"}
          placeholder={
            editingCred && isSecret
              ? "Leave blank to retain encrypted secret"
              : field.placeholder || ""
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={isSecret ? "pr-10" : ""}
        />
        {isSecret && (
          <button
            type="button"
            onClick={() =>
              setRevealedSecrets((prev) => ({ ...prev, [field.name]: !prev[field.name] }))
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            aria-label={isRevealed ? "Hide secret" : "Reveal secret"}
          >
            {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Configuration" }, { label: "Integration Vault" }]}
        title="BYOK Integration Vault"
        icon={Key}
        badge={
          <Badge variant="accent" size="sm">
            {credentials.length} Configured
          </Badge>
        }
        description="Centrally manage encrypted LLM keys, search providers, issue trackers, databases, and per-agent tool bindings."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={loading}
              onClick={() => void loadVaultData()}
            >
              Refresh
            </Button>
            <Button variant="primary" size="sm" icon={Plus} onClick={openAddModal}>
              Add Integration
            </Button>
          </div>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}
      {bannerSuccess && (
        <AlertBanner
          variant="success"
          message={bannerSuccess}
          onDismiss={() => setBannerSuccess(null)}
        />
      )}

      {/* Search + Category Tabs */}
      <div className="space-y-4">
        <div className="max-w-md">
          <TextInput
            icon={Search}
            placeholder="Filter credentials by provider, alias, model, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Tabs items={tabItems} activeId={activeTab} onChange={setActiveTab} />
      </div>

      {/* Credentials Grid */}
      {loading ? (
        <CardGridSkeleton count={6} />
      ) : filteredCredentials.length === 0 ? (
        <EmptyState
          icon={Key}
          title={
            activeTab === "all"
              ? "No integrations configured yet"
              : `No ${tabItems.find((t) => t.id === activeTab)?.label || activeTab} integrations`
          }
          description="Add your first encrypted API key or service credential to unlock live LLM routing and external tool execution."
          action={{ label: "Add Integration", onClick: openAddModal }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCredentials.map((cred) => {
            const Icon = getProviderIcon(cred.category, cred.provider);
            const maskedKey =
              cred.masked_api_key ||
              Object.values(cred.masked_secrets || {})[0] ||
              "••••••••";

            return (
              <Card
                key={cred.id}
                className="p-5 flex flex-col justify-between gap-4 hover:border-[var(--border-strong)] transition-all"
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-[10px] bg-[#7657F6]/15 border border-[#7657F6]/30 flex items-center justify-center text-[#A78BFA] shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                            {cred.name || cred.provider}
                          </h3>
                          {cred.is_default && (
                            <Badge variant="accent" size="xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs font-mono text-[var(--text-muted)] truncate">
                          {cred.provider} · {cred.category}
                        </div>
                      </div>
                    </div>

                    <StatusBadge status={cred.connection_status || "untested"} size="xs" />
                  </div>

                  <div className="rounded-lg bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--text-muted)]">Secret</span>
                      <span className="font-mono text-[var(--text-secondary)] truncate max-w-[180px]">
                        {maskedKey}
                      </span>
                    </div>
                    {cred.model_name && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-muted)]">Model</span>
                        <span className="font-mono text-[var(--text-primary)] truncate max-w-[180px]">
                          {cred.model_name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--text-muted)]">Usage</span>
                      <span className="font-mono text-[var(--text-secondary)]">
                        {cred.usage_count} runs · {formatDateTime(cred.last_tested_at)}
                      </span>
                    </div>
                  </div>

                  {cred.assigned_agent_names && cred.assigned_agent_names.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {cred.assigned_agent_names.slice(0, 3).map((agentName) => (
                        <Badge key={agentName} variant="neutral" size="xs">
                          {agentName}
                        </Badge>
                      ))}
                      {cred.assigned_agent_names.length > 3 && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          +{cred.assigned_agent_names.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Zap}
                      loading={testingId === cred.id}
                      onClick={() => void handleTestSaved(cred)}
                    >
                      Test
                    </Button>
                    {!cred.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Set as default for category"
                        onClick={() => void handleSetDefault(cred)}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit integration"
                      onClick={() => openEditModal(cred)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete integration"
                      className="hover:text-[#F16B75]"
                      onClick={() => setDeleteTarget(cred)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Integration Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCred ? `Edit ${editingCred.name || editingCred.provider}` : "Register BYOK Integration"}
        description="Credentials are encrypted at rest before being stored in the platform vault."
        icon={Key}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveIntegration} className="space-y-4">
          {modalError && <AlertBanner variant="error" message={modalError} />}

          {draftTestResult && (
            <AlertBanner
              variant={draftTestResult.success ? "success" : "error"}
              title={draftTestResult.success ? "Connection Verified" : "Connection Check Failed"}
              message={`${draftTestResult.message}${
                draftTestResult.latency_ms ? ` (${draftTestResult.latency_ms}ms)` : ""
              }`}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormGroup label="Category" required>
              <SelectInput
                value={modalCategory}
                disabled={Boolean(editingCred)}
                onChange={(e) => handleCategoryChangeInModal(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </SelectInput>
            </FormGroup>

            <FormGroup label="Provider" required>
              <SelectInput
                value={selectedProvider}
                disabled={Boolean(editingCred)}
                onChange={(e) => handleProviderChangeInModal(e.target.value)}
              >
                {providersInCategory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectInput>
            </FormGroup>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormGroup label="Credential Alias" description="Helpful label shown in selectors">
              <TextInput
                placeholder={`e.g. Production ${activeCatalogItem?.name || selectedProvider}`}
                value={credName}
                onChange={(e) => setCredName(e.target.value)}
              />
            </FormGroup>

            {(activeCatalogItem?.suggested_models?.length || modalCategory === "llm" || modalCategory === "embedding") && (
              <FormGroup label="Model Name">
                {activeCatalogItem?.suggested_models && activeCatalogItem.suggested_models.length > 0 ? (
                  <SelectInput value={modelName} onChange={(e) => setModelName(e.target.value)}>
                    {activeCatalogItem.suggested_models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </SelectInput>
                ) : (
                  <TextInput
                    placeholder="e.g. gpt-4o, llama-3.3-70b-versatile"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                  />
                )}
              </FormGroup>
            )}
          </div>

          {(activeCatalogItem?.requires_base_url || baseUrl) && (
            <FormGroup label="Endpoint Base URL">
              <TextInput
                type="url"
                placeholder={activeCatalogItem?.default_base_url || "https://api.example.com/v1"}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </FormGroup>
          )}

          {/* Dynamic Secret Fields */}
          {activeCatalogItem?.secret_fields && activeCatalogItem.secret_fields.length > 0 ? (
            <div className="space-y-3 pt-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Secret Credentials
              </div>
              <div className="grid grid-cols-1 gap-3">
                {activeCatalogItem.secret_fields.map((field) => (
                  <FormGroup
                    key={field.name}
                    label={field.label}
                    required={!editingCred && field.required}
                    description={field.description}
                  >
                    {renderFieldInput(
                      field,
                      secretsForm[field.name] || "",
                      (val) => setSecretsForm((prev) => ({ ...prev, [field.name]: val })),
                      true,
                    )}
                  </FormGroup>
                ))}
              </div>
            </div>
          ) : (
            <FormGroup label="API Key / Secret Token" required={!editingCred}>
              {renderFieldInput(
                { name: "api_key", label: "API Key", type: "password", required: true },
                secretsForm.api_key || "",
                (val) => setSecretsForm((prev) => ({ ...prev, api_key: val })),
                true,
              )}
            </FormGroup>
          )}

          {/* Dynamic Config Fields */}
          {activeCatalogItem?.config_fields && activeCatalogItem.config_fields.length > 0 && (
            <div className="space-y-3 pt-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Additional Configuration
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeCatalogItem.config_fields.map((field) => (
                  <FormGroup
                    key={field.name}
                    label={field.label}
                    required={field.required}
                    description={field.description}
                  >
                    {renderFieldInput(
                      field,
                      configForm[field.name] || "",
                      (val) => setConfigForm((prev) => ({ ...prev, [field.name]: val })),
                      false,
                    )}
                  </FormGroup>
                ))}
              </div>
            </div>
          )}

          {/* Agent Scoping */}
          {agents.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-[13px] font-medium text-[var(--text-primary)]">
                Scope to Specific Agents (Optional)
              </div>
              <div className="flex flex-wrap gap-2">
                {agents.map((agent) => {
                  const selected = assignedAgentIds.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAgentAssignment(agent.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? "bg-[#7657F6]/15 border-[#7657F6]/40 text-[#A78BFA]"
                          : "bg-[var(--bg-sidebar)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {selected && <CheckCircle2 className="h-3 w-3" />}
                      {agent.metadata?.title || agent.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-strong)] bg-[var(--bg-input)] text-[#7657F6] focus:ring-[#7657F6]"
            />
            Set as default provider for the {modalCategory} category
          </label>

          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Zap}
              loading={testingDraft}
              onClick={() => void handleTestDraft()}
            >
              Test Connection
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={savingModal}>
                {editingCred ? "Save Changes" : "Save Credential"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Revoke Integration Credential"
        description={`Are you sure you want to permanently delete "${
          deleteTarget?.name || deleteTarget?.provider
        }"? Any agents pinned directly to this credential will fall back to workspace defaults.`}
        confirmLabel="Revoke Credential"
      />
    </div>
  );
}

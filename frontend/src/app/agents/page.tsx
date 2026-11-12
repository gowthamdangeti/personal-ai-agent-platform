"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  LayoutGrid,
  List,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Agent, api } from "@/lib/api";
import { getAgentDomainMeta } from "@/lib/agentRoutes";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { SelectInput, TextInput } from "@/components/common/FormControls";
import { PageHeader } from "@/components/common/PageHeader";
import { CardGridSkeleton } from "@/components/common/Skeleton";
import { Tabs } from "@/components/common/Tabs";

export default function AgentDirectoryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [policyFilter, setPolicyFilter] = useState<"all" | "automated" | "hitl">("all");
  const [sortBy, setSortBy] = useState<"name" | "category" | "policy">("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    let mounted = true;
    api
      .listAgentsWithMetadata()
      .then((data) => {
        if (mounted) setAgents(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load agents.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const agent of agents) {
      const cat = agent.metadata?.category || agent.kind || "general";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return [
      { id: "all", label: "All Agents", count: agents.length },
      ...Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cat, count]) => ({
          id: cat,
          label: cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          count,
        })),
    ];
  }, [agents]);

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = agents.filter((agent) => {
      const cat = agent.metadata?.category || agent.kind || "general";
      const isHitl = Boolean(agent.metadata?.is_hitl);
      if (categoryFilter !== "all" && cat !== categoryFilter) return false;
      if (policyFilter === "hitl" && !isHitl) return false;
      if (policyFilter === "automated" && isHitl) return false;
      if (!q) return true;

      const title = (agent.metadata?.title || agent.name || "").toLowerCase();
      const desc = (agent.metadata?.description || agent.description || "").toLowerCase();
      const slug = (agent.slug || "").toLowerCase();
      return title.includes(q) || desc.includes(q) || slug.includes(q);
    });

    return [...list].sort((a, b) => {
      if (sortBy === "policy") {
        return Number(Boolean(b.metadata?.is_hitl)) - Number(Boolean(a.metadata?.is_hitl));
      }
      if (sortBy === "category") {
        const ca = a.metadata?.category || a.kind || "";
        const cb = b.metadata?.category || b.kind || "";
        return ca.localeCompare(cb);
      }
      return (a.metadata?.title || a.name).localeCompare(b.metadata?.title || b.name);
    });
  }, [agents, search, categoryFilter, policyFilter, sortBy]);

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Agent Directory" }]}
        title="Enterprise Agent Directory"
        icon={Bot}
        badge={
          <Badge variant="accent" size="sm">
            {agents.length} Active Specialists
          </Badge>
        }
        description="Discover, configure, and launch specialized enterprise agents across RAG, IT operations, finance, and automated governance."
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      {/* Filter & Toolbar Bar */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="flex-1 max-w-md">
            <TextInput
              icon={Search}
              placeholder="Search agents by capability, name, or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-44">
              <SelectInput
                value={policyFilter}
                onChange={(e) => setPolicyFilter(e.target.value as "all" | "automated" | "hitl")}
                aria-label="Filter by governance policy"
              >
                <option value="all">All Governance Policies</option>
                <option value="automated">Automated Only</option>
                <option value="hitl">Strict HITL Only</option>
              </SelectInput>
            </div>

            <div className="w-44">
              <SelectInput
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | "category" | "policy")}
                aria-label="Sort agents"
              >
                <option value="name">Sort: Name (A–Z)</option>
                <option value="category">Sort: Category</option>
                <option value="policy">Sort: Policy (HITL First)</option>
              </SelectInput>
            </div>

            <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid View"
                className={`h-8.5 w-8.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="List View"
                className={`h-8.5 w-8.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === "list"
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <Tabs
          items={categories}
          activeId={categoryFilter}
          onChange={setCategoryFilter}
        />
      </div>

      {/* Results Grid / List */}
      {loading ? (
        <CardGridSkeleton count={6} />
      ) : filteredAgents.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching agents found"
          description="Try adjusting your search keyword or clearing the category and governance filters."
          action={{
            label: "Reset Filters",
            onClick: () => {
              setSearch("");
              setCategoryFilter("all");
              setPolicyFilter("all");
            },
          }}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAgents.map((agent) => {
            const meta = getAgentDomainMeta(agent.slug, agent.kind, agent.metadata?.category);
            const Icon = meta.icon;
            const isHitl = Boolean(agent.metadata?.is_hitl);

            return (
              <Card
                key={agent.id}
                interactive
                className="p-6 flex flex-col justify-between gap-5 group"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#7657F6]/18 to-[#7657F6]/5 border border-[#7657F6]/25 flex items-center justify-center text-[#A78BFA] shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant={isHitl ? "hitl" : "automated"} size="xs" dot>
                      {isHitl ? "STRICT HITL" : "AUTOMATED"}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight group-hover:text-[#A78BFA] transition-colors">
                      {agent.metadata?.title || agent.name}
                    </h3>
                    <p className="mt-1.5 text-[13px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                      {agent.metadata?.description ||
                        agent.description ||
                        "Configured enterprise execution agent with telemetry logging."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <Badge variant="neutral" size="xs">
                      {meta.categoryLabel}
                    </Badge>
                    <span className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-elevated)]/60 px-2 py-0.5 rounded-md border border-[var(--border-subtle)]">
                      {agent.slug}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2.5">
                  {meta.workspaceHref ? (
                    <Link
                      href={meta.workspaceHref}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {meta.workspaceLabel}
                      <ArrowUpRight className="h-3.5 w-3.5 text-[#A78BFA]" />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Universal Runner
                    </span>
                  )}

                  <Link href={`/agents/${agent.slug}`}>
                    <Button variant="primary" size="sm" icon={Play}>
                      Playground
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="divide-y divide-[var(--border-subtle)] overflow-hidden">
          {filteredAgents.map((agent) => {
            const meta = getAgentDomainMeta(agent.slug, agent.kind, agent.metadata?.category);
            const Icon = meta.icon;
            const isHitl = Boolean(agent.metadata?.is_hitl);

            return (
              <div
                key={agent.id}
                className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--bg-elevated)]/35 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <div className="h-11 w-11 rounded-xl bg-[#7657F6]/14 border border-[#7657F6]/25 flex items-center justify-center text-[#A78BFA] shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[14.5px] font-semibold text-[var(--text-primary)]">
                        {agent.metadata?.title || agent.name}
                      </span>
                      <Badge variant={isHitl ? "hitl" : "automated"} size="xs" dot>
                        {isHitl ? "STRICT HITL" : "AUTOMATED"}
                      </Badge>
                      <Badge variant="neutral" size="xs">
                        {meta.categoryLabel}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs sm:text-[13px] text-[var(--text-secondary)] truncate max-w-2xl">
                      {agent.metadata?.description || agent.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {meta.workspaceHref && (
                    <Link href={meta.workspaceHref}>
                      <Button variant="secondary" size="sm" icon={ArrowUpRight}>
                        Workspace
                      </Button>
                    </Link>
                  )}
                  <Link href={`/agents/${agent.slug}`}>
                    <Button variant="primary" size="sm" icon={Play}>
                      Playground
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

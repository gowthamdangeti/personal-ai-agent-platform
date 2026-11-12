import {
  Bot,
  Brain,
  Database,
  FileCheck,
  FileSearch,
  FileText,
  Layers,
  LucideIcon,
  PieChart,
  Server,
  TestTube,
  Video,
} from "lucide-react";

export interface AgentDomainMeta {
  workspaceHref?: string;
  workspaceLabel?: string;
  icon: LucideIcon;
  categoryLabel: string;
}

const SLUG_META: Record<string, AgentDomainMeta> = {
  "knowledge-assistant": {
    workspaceHref: "/knowledge",
    workspaceLabel: "Knowledge Workspace",
    icon: Brain,
    categoryLabel: "Knowledge & RAG",
  },
  "document-processor": {
    workspaceHref: "/documents",
    workspaceLabel: "Extraction Studio",
    icon: FileText,
    categoryLabel: "Document Processing",
  },
  "deep-researcher": {
    workspaceHref: "/research",
    workspaceLabel: "Research Studio",
    icon: FileSearch,
    categoryLabel: "Research",
  },
  "meeting-intelligence": {
    workspaceHref: "/meetings",
    workspaceLabel: "Meeting Intelligence",
    icon: Video,
    categoryLabel: "Collaboration",
  },
  "qa-testing": {
    workspaceHref: "/qa",
    workspaceLabel: "QA Suite Generator",
    icon: TestTube,
    categoryLabel: "Engineering QA",
  },
  "procurement-specialist": {
    workspaceHref: "/procurement",
    workspaceLabel: "Procurement Matrix",
    icon: FileCheck,
    categoryLabel: "Procurement",
  },
  "finance-reconciler": {
    workspaceHref: "/finance",
    workspaceLabel: "Finance & Audit",
    icon: PieChart,
    categoryLabel: "Finance",
  },
  "it-ops-specialist": {
    workspaceHref: "/it-operations",
    workspaceLabel: "Incident Console",
    icon: Server,
    categoryLabel: "IT Operations",
  },
  "workflow-orchestrator": {
    workspaceHref: "/workflows",
    workspaceLabel: "Workflow DAGs",
    icon: Layers,
    categoryLabel: "Orchestration",
  },
  "data-analyst": {
    workspaceHref: "/data-studio",
    workspaceLabel: "Data Studio SQL",
    icon: Database,
    categoryLabel: "Analytics",
  },
};

export function getAgentDomainMeta(slug: string, kind?: string, metadataCategory?: string): AgentDomainMeta {
  if (SLUG_META[slug]) return SLUG_META[slug];

  const key = (kind || slug || "").toLowerCase();
  for (const [knownSlug, meta] of Object.entries(SLUG_META)) {
    if (key.includes(knownSlug.split("-")[0])) {
      return meta;
    }
  }

  return {
    icon: Bot,
    categoryLabel: metadataCategory
      ? metadataCategory.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Enterprise Agent",
  };
}


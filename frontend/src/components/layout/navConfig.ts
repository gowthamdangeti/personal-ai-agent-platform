import {
  Activity,
  Bot,
  Brain,
  Database,
  FileCheck,
  FileSearch,
  FileText,
  History,
  Key,
  Layers,
  LucideIcon,
  PieChart,
  Server,
  ShieldAlert,
  TestTube,
  Video,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "hitl";
}

export interface NavGroup {
  id: string;
  title: string;
  collapsible?: boolean;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    title: "Overview",
    collapsible: false,
    items: [
      { label: "Dashboard", href: "/", icon: Activity },
      { label: "Agent Directory", href: "/agents", icon: Bot },
    ],
  },
  {
    id: "intelligence",
    title: "Knowledge & Intelligence",
    collapsible: true,
    items: [
      { label: "Knowledge & RAG", href: "/knowledge", icon: Brain },
      { label: "Document Processing", href: "/documents", icon: FileText },
      { label: "Deep Research", href: "/research", icon: FileSearch },
      { label: "Meeting Intelligence", href: "/meetings", icon: Video },
    ],
  },
  {
    id: "operations",
    title: "Operations & Automation",
    collapsible: true,
    items: [
      { label: "QA Testing", href: "/qa", icon: TestTube },
      { label: "Procurement RFP", href: "/procurement", icon: FileCheck },
      { label: "Finance & Audit", href: "/finance", icon: PieChart },
      { label: "IT Operations", href: "/it-operations", icon: Server },
      { label: "Workflow DAGs", href: "/workflows", icon: Layers },
      { label: "Data Studio SQL", href: "/data-studio", icon: Database },
    ],
  },
  {
    id: "governance",
    title: "Governance & Observability",
    collapsible: true,
    items: [
      { label: "HITL Approvals", href: "/hitl-approvals", icon: ShieldAlert, badgeKey: "hitl" },
      { label: "Execution History", href: "/history", icon: History },
    ],
  },
  {
    id: "settings",
    title: "Configuration",
    collapsible: false,
    items: [
      { label: "Integration Vault", href: "/settings/integrations", icon: Key },
    ],
  },
];

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function getBreadcrumbsForPath(pathname: string): BreadcrumbSegment[] {
  if (!pathname || pathname === "/") {
    return [{ label: "Platform", href: "/" }, { label: "Dashboard" }];
  }

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href !== "/" && pathname === item.href) {
        return [
          { label: group.title },
          { label: item.label },
        ];
      }
    }
  }

  if (pathname.startsWith("/agents/")) {
    const slug = pathname.replace("/agents/", "").split("/")[0];
    const formattedSlug = slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return [
      { label: "Overview", href: "/" },
      { label: "Agent Directory", href: "/agents" },
      { label: formattedSlug || "Playground" },
    ];
  }

  if (pathname.startsWith("/settings")) {
    return [
      { label: "Configuration" },
      { label: "Integration Vault", href: "/settings/integrations" },
    ];
  }

  const parts = pathname.split("/").filter(Boolean);
  return [
    { label: "Platform", href: "/" },
    ...parts.map((part) => ({
      label: part.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    })),
  ];
}


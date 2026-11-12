"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Moon, ShieldAlert, Sun, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { getBreadcrumbsForPath } from "./navConfig";

interface TopbarProps {
  onOpenMobileMenu: () => void;
  pendingHitlCount?: number;
}

export function Topbar({ onOpenMobileMenu, pendingHitlCount = 0 }: TopbarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [healthStatus, setHealthStatus] = useState<"checking" | "healthy" | "degraded" | "offline">("checking");

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const res = await api.health();
        if (!mounted) return;
        setHealthStatus(res.status === "ok" || res.status === "ready" || res.status === "healthy" ? "healthy" : "degraded");
      } catch {
        if (mounted) setHealthStatus("offline");
      }
    };
    void checkHealth();
    const timer = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const breadcrumbs = getBreadcrumbsForPath(pathname);
  const displayName =
    user?.full_name && user.full_name.trim().toLowerCase() !== "system"
      ? user.full_name
      : "Administrator";

  const statusMeta = {
    checking: { dot: "bg-[var(--text-muted)]", label: "Checking API", border: "border-[var(--border-subtle)]" },
    healthy: { dot: "bg-[#22C58B] shadow-[0_0_8px_#22C58B]", label: "System Ready", border: "border-[#22C58B]/30" },
    degraded: { dot: "bg-[#F5B942] shadow-[0_0_8px_#F5B942]", label: "Degraded", border: "border-[#F5B942]/30" },
    offline: { dot: "bg-[#F16B75] shadow-[0_0_8px_#F16B75]", label: "API Offline", border: "border-[#F16B75]/30" },
  }[healthStatus];

  return (
    <header className="h-15 sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/85 backdrop-blur-xl flex items-center shrink-0">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Left: Mobile toggle + Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="lg:hidden h-9 w-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0 transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>

          <nav className="flex items-center gap-1.5 text-xs sm:text-[13px] min-w-0 overflow-hidden select-none">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={`${crumb.label}-${idx}`}>
                {idx > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0 opacity-60" />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors truncate font-medium"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Right: Status Pills, HITL Queue, Theme Toggle, Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {pendingHitlCount > 0 && (
            <Link
              href="/hitl-approvals"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#F5B942]/35 bg-[#F5B942]/12 px-3 py-1 text-xs font-semibold text-[#F5B942] hover:bg-[#F5B942]/20 transition-all shadow-xs"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{pendingHitlCount} Pending HITL</span>
              <span className="sm:hidden">{pendingHitlCount}</span>
            </Link>
          )}

          <div
            className={`hidden sm:inline-flex items-center gap-2 rounded-full border ${statusMeta.border} bg-[var(--bg-card)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]`}
            title={`Backend health: ${statusMeta.label}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
            <span>{statusMeta.label}</span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle color theme"
            className="h-8.5 w-8.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all cursor-pointer shadow-xs"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="hidden md:flex items-center gap-2.5 pl-2.5 border-l border-[var(--border-subtle)]">
            <div className="h-7.5 w-7.5 rounded-lg bg-[#7657F6]/20 border border-[#7657F6]/30 flex items-center justify-center text-[11px] font-semibold text-[#A78BFA]">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="text-xs font-medium text-[var(--text-secondary)] max-w-[130px] truncate">
              {displayName}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

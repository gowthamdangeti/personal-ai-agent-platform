"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { NAV_GROUPS } from "./navConfig";

interface AppSidebarProps {
  pendingHitlCount?: number;
}

export function AppSidebar({ pendingHitlCount = 0 }: AppSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isRouteActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const displayName =
    user?.full_name && user.full_name.trim().toLowerCase() !== "system"
      ? user.full_name
      : "Administrator";

  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 h-full overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] transition-all duration-200 select-none ${
        collapsed ? "w-[70px]" : "w-[264px]"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0 bg-[var(--bg-sidebar)]">
        <Link
          href="/"
          className={`flex items-center gap-3 min-w-0 group ${
            collapsed ? "justify-center w-full" : ""
          }`}
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7657F6] to-[#5939D5] flex items-center justify-center text-white shrink-0 shadow-sm shadow-[#7657F6]/30 group-hover:scale-105 transition-transform duration-200">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)] truncate">
                  NexusAI
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-[#7657F6]/15 text-[#A78BFA] border border-[#7657F6]/25">
                  OS
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] truncate">
                Agent Control Plane
              </div>
            </div>
          )}
        </Link>

        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="px-2 pt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            className="h-8 w-11 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation Tree - Independent Scroll Container */}
      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scroll px-3 py-4 space-y-6">
        {NAV_GROUPS.map((group) => {
          const isGroupCollapsed = Boolean(collapsedGroups[group.id]) && !collapsed;

          return (
            <div key={group.id} className="space-y-1">
              {!collapsed ? (
                group.collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full px-2 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-150 ${
                        isGroupCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {group.title}
                  </div>
                )
              ) : (
                <div className="mx-2 my-2 border-t border-[var(--border-subtle)]" />
              )}

              {!isGroupCollapsed && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isRouteActive(item.href);
                    const badgeCount = item.badgeKey === "hitl" ? pendingHitlCount : 0;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-all duration-150 ${
                          collapsed ? "justify-center px-0 py-2.5" : ""
                        } ${
                          active
                            ? "bg-[#7657F6]/14 text-[var(--text-primary)] font-semibold shadow-xs"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/75"
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#7657F6] shadow-[0_0_8px_#7657F6]" />
                        )}
                        <Icon
                          className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                            active
                              ? "text-[#A78BFA]"
                              : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                          }`}
                        />
                        {!collapsed && (
                          <span className="truncate flex-1">{item.label}</span>
                        )}
                        {!collapsed && badgeCount > 0 && (
                          <span className="rounded-md bg-[#F5B942]/15 border border-[#F5B942]/30 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#F5B942] tabular-nums">
                            {badgeCount}
                          </span>
                        )}
                        {collapsed && badgeCount > 0 && (
                          <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-[#F5B942] ring-2 ring-[var(--bg-sidebar)]" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Account Footer - Always Accessible */}
      <div className="p-3 border-t border-[var(--border-subtle)] shrink-0 bg-[var(--bg-sidebar)]">
        {collapsed ? (
          <button
            type="button"
            onClick={() => void logout()}
            title="Sign out"
            className="w-full h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[#F16B75] hover:bg-[#F16B75]/10 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <div className="rounded-xl bg-[var(--bg-card)]/80 border border-[var(--border-subtle)] p-2.5 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8.5 w-8.5 rounded-lg bg-[#7657F6]/20 border border-[#7657F6]/30 flex items-center justify-center text-xs font-semibold text-[#A78BFA] shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                  {displayName}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] truncate">
                  {user?.email || "Enterprise Operator"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              title="Sign out"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[#F16B75] hover:bg-[#F16B75]/10 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

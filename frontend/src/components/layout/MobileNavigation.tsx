"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cpu, LogOut, X } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { NAV_GROUPS } from "./navConfig";

interface MobileNavigationProps {
  open: boolean;
  onClose: () => void;
  pendingHitlCount?: number;
}

export function MobileNavigation({
  open,
  onClose,
  pendingHitlCount = 0,
}: MobileNavigationProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.classList.add("overflow-hidden");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("overflow-hidden");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const isRouteActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const displayName =
    user?.full_name && user.full_name.trim().toLowerCase() !== "system"
      ? user.full_name
      : "Administrator";

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-[280px] max-w-[85vw] h-full bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] flex flex-col shadow-2xl">
        <div className="h-14 px-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="h-8 w-8 rounded-lg bg-[#7657F6] flex items-center justify-center text-white">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">NexusAI</div>
              <div className="text-[11px] text-[var(--text-muted)]">Control Plane</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isRouteActive(item.href);
                  const badgeCount = item.badgeKey === "hitl" ? pendingHitlCount : 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-[#7657F6]/12 text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/65"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#7657F6]" />
                      )}
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? "text-[#A78BFA]" : "text-[var(--text-muted)]"
                        }`}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="rounded-md bg-[#F5B942]/15 border border-[#F5B942]/30 px-1.5 py-0.5 text-[10px] font-semibold text-[#F5B942]">
                          {badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] truncate">
              {user?.email || "Authenticated"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#F16B75] hover:bg-[#F16B75]/10 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

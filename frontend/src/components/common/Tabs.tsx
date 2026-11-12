"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, activeId, onChange, className = "" }: TabsProps) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl bg-[var(--bg-card)]/90 border border-[var(--border-subtle)] p-1 overflow-x-auto max-w-full custom-scroll ${className}`}
      role="tablist"
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-[13px] font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
              isActive
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-strong)] shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 border border-transparent"
            }`}
          >
            {Icon && (
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive ? "text-[#A78BFA]" : "text-[var(--text-muted)]"
                }`}
              />
            )}
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums ${
                  isActive
                    ? "bg-[#7657F6]/25 text-[#A78BFA] border border-[#7657F6]/30"
                    : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

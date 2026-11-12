"use client";

import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[var(--bg-elevated)]/80 ${className}`}
    />
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2.5 flex-1">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-10 w-10 rounded-[10px]" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 flex gap-4">
        {Array.from({ length: columns }).map((_, idx) => (
          <Skeleton key={idx} className="h-3.5 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="px-5 py-4 flex items-center gap-4">
            {Array.from({ length: columns }).map((__, colIdx) => (
              <Skeleton
                key={colIdx}
                className={`h-4 flex-1 ${colIdx === 0 ? "max-w-[140px]" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4"
        >
          <div className="flex items-start justify-between">
            <Skeleton className="h-10 w-10 rounded-[10px]" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
          <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}


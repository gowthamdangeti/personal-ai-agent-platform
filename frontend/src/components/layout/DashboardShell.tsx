"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Cpu } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { AppSidebar } from "./AppSidebar";
import { MobileNavigation } from "./MobileNavigation";
import { Topbar } from "./Topbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingHitlCount, setPendingHitlCount] = useState(0);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const handleCloseMobile = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!user || pathname === "/login") return;
    let mounted = true;
    const fetchHitlCount = async () => {
      try {
        const items = await api.listPendingHitl();
        if (mounted && Array.isArray(items)) {
          setPendingHitlCount(items.filter((item) => item.status === "pending").length || items.length);
        }
      } catch {
        // Non-blocking background poll
      }
    };
    void fetchHitlCount();
    const timer = setInterval(fetchHitlCount, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [user, pathname]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col items-center justify-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-[#7657F6]/15 border border-[#7657F6]/30 flex items-center justify-center text-[#A78BFA] animate-pulse">
          <Cpu className="h-5 w-5" />
        </div>
        <p className="text-xs font-medium tracking-wide text-[var(--text-muted)]">
          Initializing control plane...
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-dvh h-screen w-full overflow-hidden flex bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <AppSidebar pendingHitlCount={pendingHitlCount} />
      <MobileNavigation
        open={mobileMenuOpen}
        onClose={handleCloseMobile}
        pendingHitlCount={pendingHitlCount}
      />

      <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col overflow-hidden">
        <Topbar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          pendingHitlCount={pendingHitlCount}
        />
        <div
          ref={mainScrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain custom-scroll"
        >
          <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 pb-20">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

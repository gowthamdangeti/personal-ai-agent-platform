"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Key } from "lucide-react";

export default function ApiKeysRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/integrations");
  }, [router]);

  return (
    <div className="py-24 text-center text-xs font-mono text-[var(--text-muted)] space-y-3">
      <div className="w-10 h-10 rounded-xl bg-[#7657F6]/20 text-[#A78BFA] border border-[#7657F6]/30 flex items-center justify-center mx-auto animate-pulse">
        <Key className="w-5 h-5" />
      </div>
      <p>Redirecting to Centralized BYOK Integration Vault...</p>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { Cpu, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { FormGroup, TextInput } from "@/components/common/FormControls";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@enterprise.local");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await login(email.trim(), password, rememberMe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async () => {
    setError(null);
    setNotice(null);
    setBootstrapping(true);
    try {
      const user = await api.bootstrapAdmin();
      setEmail(user.email || "admin@enterprise.local");
      setNotice("Initial administrator provisioned. Check backend startup settings or enter password to sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bootstrap unavailable (admin may already exist).");
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scroll bg-[var(--bg-canvas)] text-[var(--text-primary)] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Enterprise Brand Panel */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between p-12 border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#7657F6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#7657F6] to-[#5939D5] flex items-center justify-center text-white shadow-lg shadow-[#7657F6]/25">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              NexusAI Platform
            </div>
            <div className="text-xs text-[var(--text-muted)] font-mono">
              Enterprise Multi-Agent Control Plane
            </div>
          </div>
        </div>

        <div className="max-w-lg space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7657F6]/30 bg-[#7657F6]/10 px-3.5 py-1 text-xs font-semibold text-[#A78BFA] shadow-[0_0_12px_rgba(118,87,246,0.15)]">
            <ShieldCheck className="h-4 w-4" />
            Zero-Trust Governance &amp; BYOK Vault
          </div>
          <h1 className="text-3xl xl:text-4xl font-bold tracking-tight leading-tight text-[var(--text-primary)]">
            Orchestrate specialized enterprise AI agents with human-in-the-loop control.
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Unified execution tracing, encrypted BYOK provider management, hybrid RAG knowledge ingestion, and strict approval policies across finance, IT operations, procurement, and analytics.
          </p>

          <div className="grid grid-cols-2 gap-3.5 pt-2">
            {[
              { title: "10 Domain Agents", desc: "RAG, Extraction, Research, Finance, QA & SRE" },
              { title: "HITL Governance", desc: "Pause high-risk mutations before execution" },
              { title: "Encrypted Vault", desc: "Scope LLM & tool secrets per agent" },
              { title: "Full Telemetry", desc: "Step-by-step tool inputs, outputs & latency" },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/80 p-4 hover:border-[var(--border-strong)] transition-colors"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)]">{item.title}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-[var(--text-muted)] relative z-10">
          Session cookies are HTTP-only and authenticated against the local control plane API.
        </div>
      </div>

      {/* Right Sign In Form */}
      <div className="lg:col-span-6 xl:col-span-5 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#7657F6] to-[#5939D5] flex items-center justify-center text-white shadow-lg shadow-[#7657F6]/25">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold text-[var(--text-primary)]">NexusAI</div>
              <div className="text-xs text-[var(--text-muted)]">Enterprise AI Agent Platform</div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              Sign in to workspace
            </h2>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              Authenticate with your operator credentials to access the agent fleet.
            </p>
          </div>

          {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}
          {notice && <AlertBanner variant="info" message={notice} onDismiss={() => setNotice(null)} />}

          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormGroup label="Email Address" required>
                <TextInput
                  type="email"
                  icon={Mail}
                  placeholder="admin@enterprise.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </FormGroup>

              <FormGroup label="Password" required>
                <TextInput
                  type="password"
                  icon={Lock}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </FormGroup>

              <label className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border-strong)] bg-[var(--bg-input)] text-[#7657F6] focus:ring-[#7657F6]"
                />
                Keep this session signed in
              </label>

              <Button type="submit" loading={loading} className="w-full" size="lg">
                Sign In
              </Button>
            </form>
          </Card>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/50 p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)]">
                First-time local setup?
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Initialize the bootstrap administrator if not yet created.
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={Sparkles}
              loading={bootstrapping}
              onClick={handleBootstrap}
            >
              Bootstrap
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

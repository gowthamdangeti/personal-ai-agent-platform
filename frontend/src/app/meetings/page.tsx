"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CheckSquare,
  ExternalLink,
  Kanban,
  Play,
  RefreshCw,
  Video,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { ActionItem, api, MeetingSession } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { FormGroup, TextareaInput, TextInput } from "@/components/common/FormControls";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";

export default function MeetingIntelligencePage() {
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");

  const [sessions, setSessions] = useState<MeetingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<MeetingSession | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [jiraConfigured, setJiraConfigured] = useState<boolean>(false);

  const [loadingSessions, setLoadingSessions] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestSummary, setLatestSummary] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const [meetingsRes, pmCreds] = await Promise.all([
        api.listMeetings(),
        api.listIntegrations("project_management"),
      ]);
      const sessionList = Array.isArray(meetingsRes) ? meetingsRes : [];
      setSessions(sessionList);
      setJiraConfigured(
        (Array.isArray(pmCreds) ? pmCreds : []).some(
          (c) => c.provider.toLowerCase().includes("jira") && c.is_active,
        ),
      );
      if (sessionList.length > 0 && !selectedSession) {
        setSelectedSession(sessionList[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meeting sessions.");
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedSession]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!selectedSession?.id) {
      setActionItems([]);
      return;
    }
    api
      .getMeetingActionItems(selectedSession.id)
      .then((items) => setActionItems(Array.isArray(items) ? items : []))
      .catch(() => setActionItems([]));
  }, [selectedSession]);

  const handleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !transcript.trim() || processing) return;

    setProcessing(true);
    setError(null);
    try {
      const res = await api.processMeetingTranscript(title.trim(), transcript.trim());
      setLatestSummary(res.answer);
      const updated = await api.listMeetings();
      const list = Array.isArray(updated) ? updated : [];
      setSessions(list);
      const created = list.find((s) => s.id === res.session_id) || list[0] || null;
      if (created) setSelectedSession(created);
      setTitle("");
      setTranscript("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcript processing failed.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Knowledge & Intelligence" }, { label: "Meeting Intelligence" }]}
        title="Meeting Intelligence & Action Sync"
        icon={Video}
        badge={
          <Badge variant={jiraConfigured ? "success" : "neutral"} size="sm" dot>
            {jiraConfigured ? "Jira Vault Active" : "Jira Integration Ready"}
          </Badge>
        }
        description="Distill raw meeting transcripts into executive summaries, architectural decisions, and assignable action items."
        actions={
          <div className="flex items-center gap-2.5">
            {!jiraConfigured && (
              <Link href="/settings/integrations">
                <Button variant="secondary" size="sm" icon={Kanban}>
                  Configure Jira
                </Button>
              </Link>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={loadingSessions}
              onClick={() => void loadWorkspace()}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Left: Submit Transcript + Session List */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Ingest Meeting Transcript</CardTitle>
                <CardDescription>
                  Extract decisions, summaries, and action items automatically
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProcess} className="space-y-4">
                <FormGroup label="Meeting Title" required>
                  <TextInput
                    placeholder="e.g. Q4 Infrastructure Reliability Sync"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </FormGroup>

                <FormGroup label="Raw Meeting Transcript" required>
                  <TextareaInput
                    rows={7}
                    placeholder="Paste speaker notes, meeting chat, or raw transcript lines..."
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                  />
                </FormGroup>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  icon={Play}
                  loading={processing}
                  disabled={!title.trim() || !transcript.trim()}
                >
                  Process Transcript
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Processed Sessions ({sessions.length})</CardTitle>
                <CardDescription>Select a session to inspect extracted outcomes</CardDescription>
              </div>
              <Calendar className="h-4.5 w-4.5 text-[var(--text-muted)]" />
            </CardHeader>
            <CardContent className="space-y-2.5 max-h-[360px] overflow-y-auto overscroll-contain custom-scroll">
              {loadingSessions && sessions.length === 0 ? (
                <Skeleton className="h-24 w-full" />
              ) : sessions.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">
                  No meeting transcripts processed yet.
                </p>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      setSelectedSession(session);
                      setLatestSummary(null);
                    }}
                    className={`w-full text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                      selectedSession?.id === session.id
                        ? "border-[#7657F6]/60 bg-[#7657F6]/14 shadow-xs"
                        : "border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 hover:bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                      {session.title}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
                      {formatDateTime(session.meeting_date || session.created_at)}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Summary & Action Items */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="truncate">
                  {selectedSession?.title || "Meeting Summary & Decisions"}
                </CardTitle>
                <CardDescription>
                  {selectedSession
                    ? `Recorded ${formatDateTime(selectedSession.meeting_date || selectedSession.created_at)}`
                    : "Select or submit a transcript to inspect decisions"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedSession && !latestSummary ? (
                <EmptyState
                  icon={Video}
                  title="No session selected"
                  description="Submit a meeting transcript on the left or choose an existing session to inspect executive summaries and action items."
                />
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Executive Summary
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 sm:p-5 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed max-h-[340px] overflow-y-auto overscroll-contain custom-scroll">
                      {selectedSession?.executive_summary || latestSummary || "No summary stored."}
                    </div>
                  </div>

                  {selectedSession?.decisions_log && selectedSession.decisions_log.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Decisions Log ({selectedSession.decisions_log.length})
                      </div>
                      <ul className="space-y-2">
                        {selectedSession.decisions_log.map((dec, idx) => (
                          <li
                            key={idx}
                            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 px-4 py-2.5 text-xs text-[var(--text-secondary)] leading-relaxed"
                          >
                            {dec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Extracted Action Items ({actionItems.length})
                      </div>
                    </div>
                    {actionItems.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                        No structured action items attached to this session.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {actionItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-4 flex items-start justify-between gap-3.5 transition-colors hover:border-[var(--border-strong)]"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <CheckSquare className="h-4.5 w-4.5 text-[#A78BFA] shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[var(--text-primary)] leading-relaxed">
                                  {item.task_description}
                                </p>
                                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--text-muted)] flex-wrap">
                                  <span>Owner: <strong className="text-[var(--text-secondary)]">{item.assignee_name || "Unassigned"}</strong></span>
                                  {item.due_date && <span>· Due {item.due_date}</span>}
                                  {item.external_ticket_id && (
                                    <span className="inline-flex items-center gap-1 text-[#A78BFA] font-mono font-medium">
                                      <ExternalLink className="h-3 w-3" />
                                      {item.external_ticket_id}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <StatusBadge status={item.status} size="xs" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

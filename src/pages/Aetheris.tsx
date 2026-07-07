import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowUp, BarChart3, Brain, Calendar, Check, CheckCircle2, ChevronDown, Clock, ClipboardList,
  FileText, History as HistoryIcon, Layers, Loader2, MessageSquare, Newspaper, Paperclip, PanelRightClose,
  PanelRightOpen, Plus, RotateCcw, Settings2, SlidersHorizontal, Sparkles, Target, Trash2, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import Markdown from "@/components/Markdown";
import { applyAction, describeAction, parseActions, type AetherisAction } from "@/lib/ai/actions";
import { readAttachment, withAttachments, type FileAttachment } from "@/lib/ai/attachments";
import { deriveTitle, loadSessions, newSession, saveSessions, type ChatSession, type UiMessage } from "@/lib/ai/chatSessions";
import { loadHistory, logHistory, markUndone, type HistoryEntry } from "@/lib/ai/actionHistory";
import { buildSystemPrompt } from "@/lib/ai/context";
import { streamChat, type ChatMessage } from "@/lib/ai/providers";
import { isConfigured, loadAiSettings, modelOf, saveAiSettings, PROVIDER_LABELS, type AiSettings } from "@/lib/ai/settings";
import { PRIORITY_HEX } from "@/components/board/priority";
import { useBoard } from "@/lib/board/store";
import { TASK_PRIORITIES, type BoardData } from "@/lib/board/types";
import { generateDigest } from "@/lib/digest/generator";
import { getDigest, setDigest } from "@/lib/digest/store";
import type { Digest, ReportCard } from "@/lib/digest/types";
import { useDateFormat, useI18n, useT } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type TabView = "overview" | "analysis" | "history" | "digest";

function initSessionState(): { sessions: ChatSession[]; activeId: string } {
  const stored = loadSessions();
  const sessions = stored.length ? stored : [newSession()];
  return { sessions, activeId: sessions[0].id };
}

export default function Aetheris() {
  const { data, replaceBoard } = useBoard();
  const t = useT();
  const { bcp47 } = useI18n();
  const fmt = useDateFormat();
  const L = t.kairos.aetheris;

  const [settings, setSettings] = useState<AiSettings>(loadAiSettings);
  const [{ sessions, activeId }, setSessionState] = useState(initSessionState);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AetherisAction[] | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [tab, setTab] = useState<TabView>("overview");
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [digest, setDigestState] = useState<Digest | null>(() => getDigest());
  const [digestGenerating, setDigestGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef<BoardData>(data);
  dataRef.current = data;

  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0];

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [activeSession?.messages, streamingText]);

  useEffect(() => {
    if (!getDigest()) {
      const fresh = generateDigest(dataRef.current);
      setDigest(fresh);
      setDigestState(fresh);
    }
    // Runs once on mount so a first-time visit already has a digest; after
    // that the user refreshes explicitly via the tab's "Atualizar" button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isConfigured(settings)) {
    return (
      <div className="kairos-card mx-auto mt-16 flex max-w-md flex-col items-center px-8 py-14 text-center">
        <Sparkles className="h-10 w-10 text-secondary" />
        <h2 className="font-display mt-5 text-2xl text-primary">{L.emptyTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{L.emptyDesc}</p>
        <Button asChild className="mt-6 bg-primary text-primary-foreground hover:bg-primary-deep">
          <Link to="/settings"><Settings2 className="mr-1.5 h-4 w-4" /> {L.emptyCta}</Link>
        </Button>
        <p className="mt-3 text-[11px] text-muted-foreground">{L.emptyNote}</p>
      </div>
    );
  }

  function setSessions(updater: (prev: ChatSession[]) => ChatSession[]) {
    setSessionState((st) => ({ ...st, sessions: updater(st.sessions) }));
  }

  function setActiveSession(id: string) {
    setSessionState((st) => ({ ...st, activeId: id }));
    setProposal(null);
  }

  function createSession() {
    const s = newSession();
    setSessionState((st) => ({ sessions: [s, ...st.sessions], activeId: s.id }));
    setProposal(null);
    setDraft("");
  }

  function deleteSession(id: string) {
    setSessionState((st) => {
      const remaining = st.sessions.filter((s) => s.id !== id);
      const list = remaining.length ? remaining : [newSession()];
      return { sessions: list, activeId: st.activeId === id ? list[0].id : st.activeId };
    });
  }

  function patchAi(patch: Partial<AiSettings>) {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveAiSettings(next);
      return next;
    });
  }

  function applyActions(actions: AetherisAction[]) {
    const before = dataRef.current;
    let board = before;
    const errors: string[] = [];
    const descriptions: string[] = [];
    let applied = 0;
    for (const action of actions) {
      const result = applyAction(board, action);
      if (typeof result === "string") errors.push(result);
      else {
        descriptions.push(describeAction(board, action, t.kairos));
        board = result;
        applied += 1;
      }
    }
    if (applied > 0) {
      replaceBoard(board);
      setHistory(logHistory(before, descriptions));
    }
    if (errors.length) toast(L.skippedActions(errors.length), { description: errors[0] });
    else if (applied > 0) toast(L.appliedChanges(applied));
    setProposal(null);
  }

  function undoEntry(entry: HistoryEntry) {
    replaceBoard(entry.boardBefore);
    setHistory(markUndone(entry.id));
  }

  function generateDigestNow() {
    setDigestGenerating(true);
    const next = generateDigest(dataRef.current);
    setDigest(next);
    setDigestState(next);
    setDigestGenerating(false);
  }

  function digestCardText(card: ReportCard): { title: string; body?: string } {
    switch (card.kind) {
      case "overdue":
        return { title: L.digestOverdueTitle(card.count), body: L.digestListSuffix(card.sample.join(", ")) };
      case "dueSoon":
        return { title: L.digestDueSoonTitle(card.count), body: L.digestListSuffix(card.sample.join(", ")) };
      case "stale":
        return { title: L.digestStaleTitle(card.count), body: L.digestStaleSuffix(card.sample.join(", ")) };
      case "completed":
        return { title: L.digestCompletedTitle(card.count), body: L.digestCompletedBody };
      case "imbalance":
        return { title: L.digestImbalanceTitle(card.projectName), body: L.digestImbalanceBody(card.overdueCount) };
    }
  }

  async function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files?.length) {
      for (const file of Array.from(files)) {
        const result = await readAttachment(file);
        if ("error" in result) {
          const [kind, name] = result.error.split(":");
          if (kind === "toolarge") toast(L.fileTooLarge(name));
          else if (kind === "unsupported") toast(L.fileUnsupported(name));
          else toast(L.fileFailed(name));
        } else {
          setAttachments((prev) => [...prev, result]);
        }
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function send() {
    const text = draft.trim();
    if ((!text && attachments.length === 0) || streamingText !== null || !activeSession) return;
    setDraft("");
    const pendingAttachments = attachments;
    setAttachments([]);
    setProposal(null);
    const sessionId = activeSession.id;
    const displayText = text || pendingAttachments.map((a) => a.name).join(", ");
    const nextMessages: UiMessage[] = [...activeSession.messages, { role: "user", content: displayText }];
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: s.title || deriveTitle(displayText), messages: nextMessages } : s)));
    setStreamingText("");

    const today = new Date().toISOString().slice(0, 10);
    const payloadMessages = nextMessages.slice(-12);
    const lastIndex = payloadMessages.length - 1;
    payloadMessages[lastIndex] = { ...payloadMessages[lastIndex], content: withAttachments(text, pendingAttachments) };
    const chat: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(dataRef.current, today) },
      ...payloadMessages,
    ];

    try {
      const reply = await streamChat(settings, chat, (delta) => setStreamingText((s) => (s ?? "") + delta));
      const { prose, actions } = parseActions(reply);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, messages: [...s.messages, { role: "assistant", content: prose || "…" }] } : s)));
      if (actions.length > 0) {
        if (settings.autonomy === "auto") applyActions(actions);
        else setProposal(actions);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, messages: [...s.messages, { role: "assistant", content: `${L.errorPrefix(PROVIDER_LABELS[settings.provider])} ${message}` }] } : s)));
    } finally {
      setStreamingText(null);
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const activeTasks = data.tasks.filter((tk) => !tk.archivedAt);
  const activeProjects = data.projects.filter((p) => !p.archivedAt);
  const doneCount = activeTasks.filter((tk) => tk.status === "done").length;
  const overdueTasks = activeTasks.filter((tk) => tk.dueDate && tk.dueDate < todayStr && tk.status !== "done");
  const dueSoon = activeTasks
    .filter((tk) => tk.dueDate && tk.status !== "done")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 6);
  const byProject = activeProjects
    .map((project) => ({ project, count: activeTasks.filter((tk) => tk.projectId === project.id && tk.status !== "done").length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const score = activeTasks.length === 0 ? 0 : Math.round((doneCount / activeTasks.length) * 100);
  const openTasks = activeTasks.filter((tk) => tk.status !== "done");
  const byPriority = TASK_PRIORITIES.filter((p) => p !== "none").map((p) => ({
    priority: p,
    count: openTasks.filter((tk) => tk.priority === p).length,
  }));
  const maxPriorityCount = Math.max(1, ...byPriority.map((b) => b.count));

  const chips = [
    { icon: Brain, label: L.chipAnalyze, prompt: L.chipAnalyzePrompt },
    { icon: Clock, label: L.chipOverdue, prompt: L.chipOverduePrompt },
    { icon: Target, label: L.chipPlan, prompt: L.chipPlanPrompt },
    { icon: Sparkles, label: L.chipSuggest, prompt: L.chipSuggestPrompt },
    { icon: FileText, label: L.digest, prompt: L.digestPrompt },
  ];

  const digestSeverityIcon = { warning: AlertTriangle, insight: Newspaper, positive: CheckCircle2 } as const;
  const digestWarningCount = digest?.cards.filter((c) => c.severity === "warning").length ?? 0;

  const tabs: { key: TabView; label: string; icon: typeof ClipboardList; count: number }[] = [
    { key: "overview", label: L.tabOverview, icon: ClipboardList, count: dueSoon.length },
    { key: "analysis", label: L.tabAnalysis, icon: BarChart3, count: overdueTasks.length },
    { key: "history", label: L.tabHistory, icon: HistoryIcon, count: history.filter((h) => !h.undone).length },
    { key: "digest", label: L.tabDigest, icon: Newspaper, count: digestWarningCount },
  ];

  return (
    <div className="flex h-full w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex h-full w-full max-w-3xl min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-1 pb-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex max-w-[220px] items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-sm font-medium text-primary transition-colors hover:bg-secondary/10">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-secondary" />
                  <span className="truncate">{activeSession?.title || L.newChat}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onSelect={createSession} className="cursor-pointer gap-2 text-xs">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{L.newChat}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground/60">
                  {L.sessionsCount(sessions.length)}
                </DropdownMenuLabel>
                {sessions.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onSelect={() => setActiveSession(s.id)}
                    className={cn("cursor-pointer gap-2 text-xs", s.id === activeId && "bg-accent")}
                  >
                    <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{s.title || L.newChat}</span>
                    <span className="num shrink-0 text-[9px] text-muted-foreground/50">{s.messages.length}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      className="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => setShowSidebar((v) => !v)}
              className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/10 hover:text-primary lg:flex"
            >
              {showSidebar ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              {showSidebar ? L.hidePanel : L.showPanel}
            </button>
          </div>

          <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pb-4 pr-1">
            {activeSession && activeSession.messages.length === 0 && streamingText === null && (
              <div className="kairos-card p-5 text-sm leading-relaxed text-muted-foreground">
                {L.welcomeLead}
                <ul className="mt-2 space-y-1">
                  {L.welcomeExamples.map((ex) => <li key={ex}><em>{ex}</em></li>)}
                </ul>
                <p className="mt-2">{L.welcomeNote}</p>
              </div>
            )}
            {activeSession?.messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "kairos-card text-card-foreground",
                )}
              >
                {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
              </div>
            ))}
            {streamingText !== null && (
              <div className="kairos-card max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed text-card-foreground">
                {streamingText ? <Markdown text={streamingText} /> : <Loader2 className="h-4 w-4 animate-spin text-secondary" />}
              </div>
            )}

            {proposal && (
              <div className="rounded-xl border border-secondary/40 bg-card p-4 shadow-soft">
                <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{L.proposedChanges}</div>
                <ul className="mt-2 space-y-1.5">
                  {proposal.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-card-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                      {describeAction(dataRef.current, a, t.kairos)}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => applyActions(proposal)} className="bg-primary text-primary-foreground hover:bg-primary-deep">
                    <Check className="mr-1.5 h-3.5 w-3.5" /> {L.apply}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                    <X className="mr-1.5 h-3.5 w-3.5" /> {L.dismiss}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="kairos-card p-2">
            <div className="flex items-center gap-1.5 px-1 pb-1.5 pt-0.5">
              <div className="flex min-w-0 gap-1.5 overflow-x-auto">
                {chips.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => setDraft(chip.prompt)}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-border/50 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-secondary/30 hover:text-primary"
                  >
                    <chip.icon className="h-3 w-3" /> {chip.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      title={L.aiBehavior}
                      aria-label={L.aiBehavior}
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full transition-colors",
                        settings.autonomy === "auto"
                          ? "bg-secondary/15 text-secondary hover:bg-secondary/20"
                          : "bg-secondary/5 text-muted-foreground/60 hover:bg-secondary/10 hover:text-muted-foreground",
                      )}
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <div className="px-3 pb-3 pt-3">
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">{L.aiBehavior}</p>
                      <div className="space-y-0.5" role="radiogroup" aria-label={L.aiBehavior}>
                        {([
                          { value: "suggest", label: L.autonomySuggestLabel, desc: L.autonomySuggestDesc },
                          { value: "auto", label: L.autonomyAutoLabel, desc: L.autonomyAutoDesc },
                        ] as const).map(({ value, label, desc }) => {
                          const active = settings.autonomy === value;
                          return (
                            <button
                              key={value}
                              role="radio"
                              aria-checked={active}
                              onClick={() => patchAi({ autonomy: value })}
                              className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors", active ? "bg-secondary/15" : "hover:bg-secondary/5")}
                            >
                              <span className={cn("h-2 w-2 shrink-0 rounded-full border-2 transition-colors", active ? "border-secondary bg-secondary" : "border-muted-foreground/30")} />
                              <div className="min-w-0">
                                <div className={cn("text-xs font-medium leading-none", active ? "text-secondary" : "text-primary/80")}>{label}</div>
                                <div className="mt-0.5 text-[10px] leading-none text-muted-foreground/50">{desc}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-1 pb-1.5">
                {attachments.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span className="max-w-[10rem] truncate">{a.name}</span>
                    <button
                      onClick={() => removeAttachment(a.id)}
                      aria-label={`${t.common.remove} ${a.name}`}
                      className="grid h-3.5 w-3.5 place-items-center rounded-full text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 px-1 pb-1">
              <input ref={fileInputRef} type="file" accept=".csv,.json,.md,.txt,text/csv,application/json,text/markdown,text/plain" multiple hidden onChange={(e) => void pickFiles(e)} />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={L.attachFile}
                title={L.attachFile}
                onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder={L.placeholder}
                rows={1}
                className="max-h-40 min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button
                size="icon"
                aria-label={L.send}
                onClick={() => void send()}
                disabled={(!draft.trim() && attachments.length === 0) || streamingText !== null}
                className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary-deep"
              >
                {streamingText !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/40">
            Kairos · by Vinicius · {L.poweredBy(PROVIDER_LABELS[settings.provider], modelOf(settings))}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "hidden shrink-0 overflow-hidden border-l border-border/60 transition-all duration-300 ease-in-out lg:block",
          showSidebar ? "w-80 opacity-100" : "w-0 opacity-0",
        )}
      >
        <div className="h-full w-80 overflow-y-auto p-4">
          <div className="mb-4 flex flex-wrap gap-1">
            {tabs.map((tabDef) => (
              <button
                key={tabDef.key}
                onClick={() => setTab(tabDef.key)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-medium uppercase tracking-wider transition-colors",
                  tab === tabDef.key
                    ? "border-secondary/40 bg-secondary/15 text-secondary"
                    : "border-transparent text-muted-foreground hover:border-secondary/20 hover:bg-secondary/5 hover:text-primary",
                )}
              >
                <tabDef.icon className="h-3 w-3" />
                {tabDef.label}
                {tabDef.count > 0 && <span className="rounded-full bg-secondary/30 px-1 text-[9px] text-secondary">{tabDef.count}</span>}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-3">
              <div className="kairos-card p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  <Calendar className="h-3 w-3 text-secondary" /> {L.overviewDueSoon}
                </div>
                {dueSoon.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-muted-foreground/50">{L.overviewNoDue}</p>
                ) : (
                  <div className="space-y-1.5">
                    {dueSoon.map((tk) => {
                      const project = data.projects.find((p) => p.id === tk.projectId);
                      const overdue = !!tk.dueDate && tk.dueDate < todayStr;
                      return (
                        <div
                          key={tk.id}
                          className="flex items-center gap-2 rounded px-2 py-1.5"
                          style={{
                            backgroundColor: overdue ? "rgba(178,58,46,0.12)" : `${project?.color ?? "#999"}16`,
                            border: `1px solid ${overdue ? "rgba(178,58,46,0.35)" : `${project?.color ?? "#999"}33`}`,
                          }}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: project?.color ?? "#999" }} />
                          <span className="flex-1 truncate text-[11px] text-card-foreground">{tk.title}</span>
                          <span className="num shrink-0 text-[9px] text-muted-foreground/50">{tk.dueDate ? fmt.short(tk.dueDate) : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="kairos-card p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  <Layers className="h-3 w-3 text-secondary" /> {L.overviewProjects}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {byProject.map(({ project, count }) => (
                    <div key={project.id} className="flex items-center gap-1.5 rounded px-2 py-1" style={{ backgroundColor: `${project.color}16`, border: `1px solid ${project.color}33` }}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: project.color }} />
                      <span className="max-w-[6rem] truncate text-[10px] text-card-foreground">{project.name}</span>
                      <span className="num text-[9px] text-muted-foreground/50">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "analysis" && (
            <div className="space-y-3">
              <div className="kairos-card p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{L.analysisScore}</div>
                <div className="font-display num mt-1 text-2xl text-primary">{score}%</div>
              </div>
              <div className="kairos-card p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{L.analysisOverdue}</div>
                <div className="font-display num mt-1 text-2xl text-primary">{overdueTasks.length}</div>
              </div>

              <div className="kairos-card p-3">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">{L.analysisByPriority}</div>
                <div className="space-y-1.5">
                  {byPriority.map(({ priority, count }) => (
                    <div key={priority} className="flex items-center gap-2">
                      <span className="w-14 shrink-0 truncate text-[10px] text-muted-foreground/70">{t.kairos.priority[priority]}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(count / maxPriorityCount) * 100}%`, backgroundColor: PRIORITY_HEX[priority] ?? "#999" }}
                        />
                      </div>
                      <span className="num w-4 shrink-0 text-right text-[10px] text-muted-foreground/60">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="kairos-card p-3">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">{L.analysisByProject}</div>
                <div className="space-y-1.5">
                  {byProject.map(({ project, count }) => (
                    <div key={project.id} className="flex items-center gap-2">
                      <span className="max-w-[6rem] flex-1 truncate text-[10px] text-muted-foreground/70">{project.name}</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/40">
                        <div className="h-full rounded-full" style={{ width: `${(count / Math.max(1, byProject[0]?.count ?? 1)) * 100}%`, backgroundColor: project.color }} />
                      </div>
                      <span className="num w-4 shrink-0 text-right text-[10px] text-muted-foreground/60">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-2">
              {history.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-muted-foreground/50">{L.historyEmpty}</p>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="kairos-card p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="num text-[9px] text-muted-foreground/50">
                        {new Intl.DateTimeFormat(bcp47, { dateStyle: "short", timeStyle: "short" }).format(new Date(h.timestamp))}
                      </span>
                      {h.undone ? (
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40">{L.historyUndone}</span>
                      ) : (
                        <button onClick={() => undoEntry(h)} className="text-[10px] font-medium text-secondary hover:underline">{L.historyUndo}</button>
                      )}
                    </div>
                    <ul className="space-y-0.5">
                      {h.descriptions.map((d, i) => <li key={i} className="text-[11px] text-muted-foreground">{d}</li>)}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "digest" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                {digest ? (
                  <span className="num text-[9px] text-muted-foreground/50">
                    {L.digestGeneratedAt(new Intl.DateTimeFormat(bcp47, { dateStyle: "short", timeStyle: "short" }).format(new Date(digest.generatedAt)))}
                  </span>
                ) : <span />}
                <button
                  onClick={() => generateDigestNow()}
                  disabled={digestGenerating}
                  className="flex items-center gap-1 text-[10px] font-medium text-secondary hover:underline disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" /> {digestGenerating ? L.digestGenerating : digest ? L.digestRegenerate : L.digestGenerate}
                </button>
              </div>

              {digest && digest.cards.length === 0 && (
                <div className="kairos-card flex items-center gap-2 p-3 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-secondary" /> {L.digestAllClear}
                </div>
              )}

              {digest && digest.cards.map((card, i) => {
                const { title, body } = digestCardText(card);
                const Icon = digestSeverityIcon[card.severity];
                return (
                  <div key={i} className="kairos-card p-3">
                    <div className="flex items-start gap-2">
                      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", card.severity === "warning" ? "text-destructive" : card.severity === "positive" ? "text-secondary" : "text-muted-foreground")} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-card-foreground">{title}</div>
                        {body && <p className="mt-0.5 text-[10px] text-muted-foreground">{body}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

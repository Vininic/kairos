import { useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Moon, Sparkles, Sun, Trash2, Upload } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import {
  DEFAULT_MODELS, PROVIDER_LABELS, loadAiSettings, saveAiSettings,
  type AiAutonomy, type AiProvider, type AiSettings,
} from "@/lib/ai/settings";
import { useAuth } from "@/lib/auth";
import { emptyBoard, type BoardData } from "@/lib/board/types";
import { migrate } from "@/lib/board/service";
import { exportBoardMarkdown, importMarkdown } from "@/lib/board/markdown";
import { exportToXLSX, importXlsx } from "@/lib/board/xlsx";
import { useBoard } from "@/lib/board/store";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { cn } from "@/lib/utils";

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="kairos-card p-6">
      <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{eyebrow}</div>
      <h2 className="font-display mt-1 text-2xl text-primary">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { session } = useAuth();
  const { data, replaceBoard } = useBoard();
  const { theme, setTheme } = useTheme();
  const { locale } = useI18n();
  const t = useT();
  const L = t.kairos.settings;
  const [ai, setAi] = useState<AiSettings>(loadAiSettings);
  const [pendingImport, setPendingImport] = useState<BoardData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cloud = !!session?.email;

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    try {
      const name = file.name.toLowerCase();
      const board = name.endsWith(".xlsx")
        ? await importXlsx(await file.arrayBuffer())
        : name.endsWith(".md")
        ? importMarkdown(await file.text(), data)
        : migrate(JSON.parse(await file.text()));
      if (board.projects.length === 0 && board.tasks.length === 0) {
        toast(L.importNothing, { description: L.importNothingDesc });
        return;
      }
      setPendingImport(board);
    } catch {
      toast(L.importFailed, { description: L.importFailedDesc });
    }
  }

  function patchAi(patch: Partial<AiSettings>) {
    setAi((s) => {
      const next = { ...s, ...patch };
      saveAiSettings(next);
      return next;
    });
  }

  function download(content: BlobPart, type: string, ext: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kairos-board-${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    download(JSON.stringify(data, null, 2), "application/json", "json");
  }

  function exportMarkdown() {
    download(exportBoardMarkdown(data), "text/markdown", "md");
  }

  async function exportXlsx() {
    await exportToXLSX(data, locale, `kairos-board-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{L.eyebrow}</div>
        <h1 className="font-display mt-1.5 text-4xl text-primary">{L.title}</h1>
      </header>

      <Section eyebrow={L.appearanceEyebrow} title={L.appearanceTitle}>
        <div className="flex gap-2">
          {([
            { value: "light", label: L.parchment, icon: Sun },
            { value: "dark", label: L.twilight, icon: Moon },
          ] as const).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
                theme === value ? "border-secondary/60 bg-secondary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </Section>

      <Section eyebrow={L.aetherisEyebrow} title={L.aetherisTitle}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.provider}</Label>
            <Select value={ai.provider} onValueChange={(v) => patchAi({ provider: v as AiProvider, model: "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => (
                  <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-model" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.model}</Label>
            <Input id="ai-model" value={ai.model} onChange={(e) => patchAi({ model: e.target.value })} placeholder={DEFAULT_MODELS[ai.provider]} disabled={ai.provider === "gemini-hosted" || ai.provider === "openrouter-hosted"} />
          </div>
          {ai.provider === "gemini-hosted" || ai.provider === "openrouter-hosted" ? (
            <div className="flex items-center gap-2 rounded-md border border-secondary/30 bg-secondary/10 p-3 text-xs text-muted-foreground sm:col-span-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-secondary" />
              {L.hostedNote}
            </div>
          ) : ai.provider !== "ollama" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ai-key" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.apiKey}</Label>
              <Input id="ai-key" type="password" value={ai.apiKey} onChange={(e) => patchAi({ apiKey: e.target.value })} placeholder={L.apiKeyPlaceholder} />
            </div>
          ) : (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ai-url" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.ollamaUrl}</Label>
              <Input id="ai-url" value={ai.baseUrl} onChange={(e) => patchAi({ baseUrl: e.target.value })} placeholder="http://localhost:11434" />
            </div>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{L.autonomy}</Label>
            <Select value={ai.autonomy} onValueChange={(v) => patchAi({ autonomy: v as AiAutonomy })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="suggest">{L.autonomySuggest}</SelectItem>
                <SelectItem value="auto">{L.autonomyAuto}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-secondary" />
          {L.keysNote}
        </p>
      </Section>

      <Section eyebrow={L.dataEyebrow} title={L.dataTitle}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson}>
            <Download className="mr-1.5 h-4 w-4" /> {L.exportJson}
          </Button>
          <Button variant="outline" onClick={exportMarkdown}>
            <FileText className="mr-1.5 h-4 w-4" /> {L.exportMarkdown}
          </Button>
          <Button variant="outline" onClick={() => void exportXlsx()}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> {L.exportXlsx}
          </Button>
          <input ref={fileRef} type="file" accept=".json,.md,.xlsx,application/json,text/markdown,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => void onImportFile(e)} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> {L.importFile}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="mr-1.5 h-4 w-4" /> {L.resetBoard}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{L.resetTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {L.resetDesc.replace("{cloud}", cloud ? L.resetCloudSuffix : "")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { replaceBoard(emptyBoard()); toast(L.boardReset); }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {L.resetBoard}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={!!pendingImport} onOpenChange={(open) => { if (!open) setPendingImport(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{L.importTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {L.importDescPrefix} {pendingImport?.projects.length ?? 0} {L.projectWord(pendingImport?.projects.length ?? 0)} {L.importDescMiddle}{" "}
                  {pendingImport?.tasks.length ?? 0} {L.taskWord(pendingImport?.tasks.length ?? 0)}. {L.importDescSuffix.replace("{cloud}", cloud ? L.importCloudSuffix : "")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (pendingImport) replaceBoard(pendingImport);
                    setPendingImport(null);
                    toast(L.boardImported);
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary-deep"
                >
                  {L.importAndReplace}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>
    </div>
  );
}

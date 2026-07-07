import { Link, useLocation } from "react-router-dom";
import { CircleHelp, LayoutGrid, Settings2, Sparkles } from "lucide-react";
import { KairosMark } from "@/components/KairosLogo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Progress } from "@/components/ui/progress";
import { projectStats } from "@/lib/board/service";
import { useBoard } from "@/lib/board/store";
import { useT } from "@/lib/i18n/I18nProvider";

/** Suite-style persistent top bar — mirrors Chronos' `components/dashboard/Topbar.tsx`
 *  placement convention: language and theme controls live here, on every page,
 *  never inside the sidebar. Also carries a route-aware breadcrumb + board
 *  stats, so the bar earns its keep instead of sitting empty. */
export default function Topbar() {
  const location = useLocation();
  const { data } = useBoard();
  const t = useT();

  const boardMatch = /^\/projects\/([^/]+)$/.exec(location.pathname);
  const project = boardMatch ? data.projects.find((p) => p.id === boardMatch[1]) : null;

  const today = new Date().toISOString().slice(0, 10);
  const totalOverdue = data.tasks.filter((tk) => !tk.archivedAt && tk.dueDate && tk.dueDate < today && tk.status !== "done").length;

  const crumb =
    location.pathname === "/projects" ? { icon: LayoutGrid, label: t.kairos.nav.allProjects } :
    location.pathname === "/aetheris" ? { icon: Sparkles, label: t.kairos.nav.aetheris } :
    location.pathname === "/settings" ? { icon: Settings2, label: t.kairos.nav.settings } :
    location.pathname === "/about" ? { icon: CircleHelp, label: t.kairos.nav.about } :
    null;

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/70 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-secondary md:hidden">
        <KairosMark className="h-3.5 w-3.5" /> Kairos
      </div>

      {project ? (
        <div className="hidden min-w-0 items-center gap-2 lg:flex">
          <Link to="/projects" className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary">
            {t.kairos.nav.allProjects}
          </Link>
          <span className="shrink-0 text-muted-foreground/40">/</span>
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: project.color }} />
          <span className="truncate text-sm font-medium text-primary">{project.name}</span>
          {(() => {
            const stats = projectStats(data, project.id, today);
            const pct = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);
            return (
              <span className="num ml-2 flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                {stats.overdue > 0 && <span className="font-medium text-destructive">{stats.overdue} {t.kairos.board.overdue}</span>}
                <span>{stats.done}/{stats.total}</span>
                <Progress value={pct} aria-label={t.common.percentComplete(pct)} className="h-1.5 w-28" />
              </span>
            );
          })()}
        </div>
      ) : crumb ? (
        <div className="hidden items-center gap-1.5 text-sm font-medium text-primary lg:flex">
          <crumb.icon className="h-3.5 w-3.5 text-secondary" /> {crumb.label}
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-3">
        {!project && totalOverdue > 0 && (
          <span className="num hidden items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive sm:flex">
            {totalOverdue} {t.kairos.board.overdue}
          </span>
        )}
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}

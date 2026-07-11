import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { CircleHelp, Cloud, LayoutGrid, Menu, MonitorSmartphone, PanelLeftClose, Settings2, Sparkles } from "lucide-react";
import Logo, { KairosMark } from "@/components/KairosLogo";
import ProfileDialog from "@/components/ProfileDialog";
import Topbar from "@/components/Topbar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { useBoard } from "@/lib/board/store";
import { useT } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/** Opens the single suite-account profile — the one place identity, board
 *  snapshot and data live, not a Settings sub-page. */
function UserBlock({ collapsed, onOpen }: { collapsed: boolean; onOpen: () => void }) {
  const { session } = useAuth();
  const t = useT();
  if (!session) return null;
  const cloud = !!session.email;
  const initial = session.name.trim().charAt(0).toUpperCase() || "K";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-2.5 text-left transition-colors hover:bg-sidebar-accent",
        collapsed && "justify-center border-0 bg-transparent p-0 hover:bg-transparent",
      )}
    >
      <div className="font-display grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rosegold font-semibold text-primary-deep">
        {initial}
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-sidebar-foreground">{session.name}</div>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/55">
            {cloud ? <Cloud className="h-2.5 w-2.5" /> : <MonitorSmartphone className="h-2.5 w-2.5" />}
            {cloud ? t.common.suiteAccount : t.common.thisBrowser}
          </div>
        </div>
      )}
    </button>
  );
}

export default function AppLayout() {
  const { data } = useBoard();
  const { session } = useAuth();
  const t = useT();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const projects = data.projects.filter((p) => !p.archivedAt);
  const initial = session?.name.trim().charAt(0).toUpperCase() || "K";

  // Aetheris and the kanban board need a real height chain (flex-1/h-full
  // stretch to fill the viewport) rather than the padded "grow with content,
  // footer below" shape every other page uses. A min-height wrapper breaks
  // that chain — percentage/flex-1 heights inside it can't resolve to a
  // definite size — so these two routes skip it entirely, mirroring how
  // Chronos' DashboardLayout special-cases its own Aetheris route.
  const isAetheris = location.pathname === "/aetheris";
  const isBoard = /^\/projects\/[^/]+$/.test(location.pathname);
  const fullHeight = isAetheris || isBoard;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
      isActive
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      collapsed && "justify-center px-0",
    );

  // Independent of the desktop sidebar's `collapsed` state — the drawer
  // always shows full labels regardless of what the (hidden, on mobile)
  // desktop sidebar is currently doing.
  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
      isActive
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
    );

  const system = [
    { to: "/settings", label: t.kairos.nav.settings, icon: Settings2 },
    { to: "/about", label: t.kairos.nav.about, icon: CircleHelp },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out md:flex",
          collapsed ? "w-[72px]" : "w-60",
        )}
      >
        <div className={cn("flex items-center pt-5 pb-4", collapsed ? "justify-center px-0" : "justify-between px-5")}>
          {!collapsed && <Logo variant="light" />}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? t.kairos.nav.expand : t.kairos.nav.collapse}
            className="grid h-7 w-7 place-items-center rounded-md text-sidebar-foreground/40 transition-all duration-300 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/70"
          >
            <PanelLeftClose className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")} />
          </button>
        </div>
        {!collapsed && <div className="horizon-rule mx-4" />}

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className={cn("mb-2 px-3 text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/50", collapsed && "hidden")}>
            {t.kairos.nav.boards}
          </div>
          <NavLink to="/projects" end className={navClass} title={collapsed ? t.kairos.nav.allProjects : undefined}>
            <LayoutGrid className="h-4 w-4 shrink-0 text-secondary-soft" />
            {!collapsed && <span className="flex-1">{t.kairos.nav.allProjects}</span>}
          </NavLink>
          {projects.map((p) => (
            <NavLink key={p.id} to={`/projects/${p.id}`} className={navClass} title={collapsed ? p.name : undefined}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
              {!collapsed && <span className="truncate">{p.name}</span>}
            </NavLink>
          ))}
          <NavLink to="/aetheris" className={navClass} title={collapsed ? t.kairos.nav.aetheris : undefined}>
            <Sparkles className="h-4 w-4 shrink-0 text-secondary-soft" />
            {!collapsed && <span>{t.kairos.nav.aetheris}</span>}
          </NavLink>

          <div className={cn("mb-2 mt-7 px-3 text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/50", collapsed && "hidden")}>
            {t.kairos.nav.system}
          </div>
          {system.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navClass} title={collapsed ? label : undefined}>
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 pt-2">
          <UserBlock collapsed={collapsed} onOpen={() => setProfileOpen(true)} />
        </div>
      </aside>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header — hamburger opens the full nav drawer below; the
            quick-access icons stay for one-tap access to the two busiest
            destinations, profile always visible. */}
        <header className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label={t.kairos.nav.openMenu}
              onClick={() => setMobileNavOpen(true)}
              className="grid h-8 w-8 place-items-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent"
            >
              <Menu className="h-5 w-5" />
            </button>
            <NavLink to="/projects"><Logo variant="light" /></NavLink>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/aetheris" aria-label={t.kairos.nav.aetheris} className="grid h-8 w-8 place-items-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent">
              <Sparkles className="h-4 w-4" />
            </NavLink>
            <NavLink to="/settings" aria-label={t.kairos.nav.settings} className="grid h-8 w-8 place-items-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent">
              <Settings2 className="h-4 w-4" />
            </NavLink>
            <button
              type="button"
              aria-label={t.kairos.nav.profile}
              onClick={() => setProfileOpen(true)}
              className="font-display grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rosegold text-xs font-semibold text-primary-deep"
            >
              {initial}
            </button>
          </div>
        </header>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="flex w-72 flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
            <SheetTitle className="sr-only">{t.kairos.nav.boards}</SheetTitle>
            <div className="px-5 pb-4 pt-5">
              <Logo variant="light" />
            </div>
            <div className="horizon-rule mx-4" />
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <div className="mb-2 px-3 text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/50">
                {t.kairos.nav.boards}
              </div>
              <NavLink to="/projects" end onClick={() => setMobileNavOpen(false)} className={mobileNavClass}>
                <LayoutGrid className="h-4 w-4 shrink-0 text-secondary-soft" />
                <span className="flex-1">{t.kairos.nav.allProjects}</span>
              </NavLink>
              {projects.map((p) => (
                <NavLink key={p.id} to={`/projects/${p.id}`} onClick={() => setMobileNavOpen(false)} className={mobileNavClass}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="truncate">{p.name}</span>
                </NavLink>
              ))}
              <NavLink to="/aetheris" onClick={() => setMobileNavOpen(false)} className={mobileNavClass}>
                <Sparkles className="h-4 w-4 shrink-0 text-secondary-soft" />
                <span>{t.kairos.nav.aetheris}</span>
              </NavLink>

              <div className="mb-2 mt-7 px-3 text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/50">
                {t.kairos.nav.system}
              </div>
              {system.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setMobileNavOpen(false)} className={mobileNavClass}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Topbar />

        <main className={cn("kairos-surface flex-1 overflow-y-auto", fullHeight && "flex flex-col overflow-hidden")}>
          {fullHeight ? (
            <div className="flex h-full flex-col overflow-hidden">
              <div className={cn("flex-1 min-h-0", isBoard && "p-5 lg:p-8")}>
                <Outlet />
              </div>
              {isBoard && (
                <footer className="flex shrink-0 items-center justify-center gap-2 py-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  <KairosMark className="h-3.5 w-3.5 text-secondary" />
                  {t.common.appName} · {t.common.suite}
                </footer>
              )}
            </div>
          ) : (
            <div className="flex min-h-full flex-col">
              <div className="flex-1 p-5 lg:p-8">
                <Outlet />
              </div>
              <footer className="flex items-center justify-center gap-2 py-6 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <KairosMark className="h-3.5 w-3.5 text-secondary" />
                {t.common.appName} · {t.common.suite}
              </footer>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

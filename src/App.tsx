import { Component, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/lib/theme/ThemeProvider";
import { I18nProvider, useI18n, type Locale } from "@/lib/i18n/I18nProvider";
import { AuthProvider, useAuth } from "@/lib/auth";
import { BoardProvider } from "@/lib/board/store";
import { useBoardSync } from "@/lib/sync/boardSync";
import { pullSuitePrefs, pushSuitePrefs } from "@/lib/prefs";
import AppLayout from "@/components/AppLayout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Projects from "@/pages/Projects";
import Board from "@/pages/Board";
import Aetheris from "@/pages/Aetheris";
import Settings from "@/pages/Settings";
import About from "@/pages/About";
import NotFound from "@/pages/NotFound";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 40, fontFamily: "monospace" }}><h2>Something went wrong</h2><pre style={{ whiteSpace: "pre-wrap", color: "red" }}>{this.state.error.stack ?? this.state.error.message}</pre></div>;
    }
    return this.props.children;
  }
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { session } = useAuth();
  return session ? children : <Navigate to="/login" replace />;
}

/** Mirrors the board to the shared suite backend when signed in with a cloud
 *  account. Renders nothing; must live inside AuthProvider. */
function BoardSyncMount() {
  useBoardSync();
  return null;
}

function SyncPrefs() {
  const { isCloud } = useAuth();
  const { setTheme } = useTheme();
  const { setLocale } = useI18n();

  useEffect(() => {
    if (!isCloud) return;
    let cancelled = false;
    void pullSuitePrefs().then((prefs) => {
      if (cancelled) return;
      if (prefs?.theme) setTheme(prefs.theme);
      if (prefs?.locale && (prefs.locale === "pt" || prefs.locale === "en"))
        setLocale(prefs.locale as Locale);
    });
    return () => { cancelled = true; };
  }, [isCloud, setTheme, setLocale]);

  return null;
}

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <AuthProvider>
              <BoardProvider>
                <BoardSyncMount />
                <SyncPrefs />
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/projects/:projectId" element={<Board />} />
                    <Route path="/aetheris" element={<Aetheris />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/about" element={<About />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BoardProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Cloud, Loader2, MonitorSmartphone } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/ui/sonner";
import Logo, { KairosMark } from "@/components/KairosLogo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/I18nProvider";

type Mode = "local" | "cloud";

export default function Login() {
  const { signIn, isCloud } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const L = t.kairos.login;
  const [mode, setMode] = useState<Mode>("local");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function enterLocal(e: React.FormEvent) {
    e.preventDefault();
    void signIn(name.trim() || "Visitor");
    navigate("/projects");
  }

  async function enterCloud(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast(L.needsEmailPass);
      return;
    }
    setLoading(true);
    try {
      const err = await signIn(name.trim() || undefined, email.trim(), password);
      if (typeof err === "string") {
        toast(err);
        return;
      }
      navigate("/projects");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-dusk relative flex flex-col p-10 text-primary-foreground">
        <div className="flex items-center justify-between">
          <Logo variant="light" />
          <div className="flex items-center gap-2">
            <LanguageToggle variant="dark" />
            <ThemeToggle variant="dark" />
          </div>
        </div>
        <div className="grid flex-1 place-items-center">
          <KairosMark className="h-52 w-52 max-w-full text-secondary-soft animate-float-slow" />
        </div>
      </div>

      <div className="kairos-surface flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">{L.eyebrow}</div>
          <h1 className="font-display mt-2 text-4xl text-primary">{L.title}</h1>

          {isCloud && (
            <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setMode("local")}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${mode === "local" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
              >
                <MonitorSmartphone className="h-3.5 w-3.5" /> {L.modeLocal}
              </button>
              <button
                type="button"
                onClick={() => setMode("cloud")}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${mode === "cloud" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
              >
                <Cloud className="h-3.5 w-3.5" /> {L.modeCloud}
              </button>
            </div>
          )}

          <p className="mt-3 text-sm text-muted-foreground">
            {mode === "cloud" ? L.cloudBlurb : L.localBlurb}
          </p>

          {mode === "local" ? (
            <form className="mt-7 space-y-5" onSubmit={enterLocal}>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {L.name}
                </Label>
                <Input
                  id="name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={L.namePlaceholder}
                  className="h-11 border-border bg-card"
                />
              </div>
              <Button type="submit" className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary-deep">
                {L.enter} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form className="mt-7 space-y-4" onSubmit={enterCloud}>
              <div className="space-y-2">
                <Label htmlFor="cloud-name" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {L.cloudNameLabel} <span className="normal-case tracking-normal">{L.cloudNameHint}</span>
                </Label>
                <Input id="cloud-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={L.cloudNamePlaceholder} className="h-11 border-border bg-card" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {L.email}
                </Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 border-border bg-card" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {L.password}
                </Label>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 border-border bg-card" />
              </div>
              <Button type="submit" disabled={loading} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary-deep">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{L.cloudSubmit} <ArrowRight className="ml-1.5 h-4 w-4" /></>}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

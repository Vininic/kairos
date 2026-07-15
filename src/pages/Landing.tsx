import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import KairosGem3D from "@/components/KairosGem3D";
import Logo, { KairosMark } from "@/components/KairosLogo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/I18nProvider";

const CHRONOS_URL = "https://github.com/Vininic/chronos-the-art-of-time";

export default function Landing() {
  const t = useT();
  const L = t.kairos.landing;

  const SUITE = [
    { n: "Chronos", live: true, href: CHRONOS_URL },
    { n: "Kairos", live: true, href: "/projects" },
    { n: "Pluto", live: true, href: "https://pluto-suite.vercel.app" },
    { n: "Hermes", live: true, href: "https://hermes-seven-delta.vercel.app" },
  ].map((app, i) => ({ ...app, r: L.suiteApps[i].role, d: L.suiteApps[i].desc }));

  return (
    <div className="kairos-surface min-h-screen">
      <header className="container flex items-center justify-between py-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#system" className="transition hover:text-foreground">{L.navSystem}</a>
          <a href="#suite" className="transition hover:text-foreground">{L.navSuite}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <Link to="/projects">
            <Button className="h-10 bg-primary px-5 text-primary-foreground hover:bg-primary-deep">
              {L.openApp} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <section className="container grid items-center gap-8 pb-20 pt-12 lg:grid-cols-12">
        <div className="animate-fade-up lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            {L.eyebrow}
          </div>
          <h1 className="font-display mt-6 text-[56px] leading-[1.0] text-balance text-primary md:text-[76px]">
            {L.heroTitle1} <span className="italic text-secondary">{L.heroTitle2}</span>.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            {L.heroLead}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/projects">
              <Button className="h-12 bg-primary px-7 text-primary-foreground hover:bg-primary-deep">
                {L.ctaOpenBoard} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <a href={CHRONOS_URL} target="_blank" rel="noreferrer">
              <Button variant="outline" className="h-12 px-6">{L.ctaMeetChronos}</Button>
            </a>
          </div>
        </div>
        <div className="relative h-[420px] md:h-[520px] lg:col-span-5">
          <div className="bg-dusk absolute inset-0 overflow-hidden rounded-[28px] shadow-elevated">
            <KairosGem3D className="absolute inset-0" />
          </div>
        </div>
      </section>

      <section id="system" className="container border-t py-20">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">{L.systemEyebrow}</div>
          <h2 className="font-display mt-3 text-4xl text-balance text-primary">{L.systemTitle}</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {L.systemCards.map((c) => (
            <article key={c.t} className="kairos-card p-6">
              <h3 className="font-display text-lg text-primary">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{L.privacyEyebrow}</div>
          <p className="mt-2 text-sm text-muted-foreground">{L.privacyLead}</p>
        </div>
      </section>

      <section id="suite" className="container border-t py-20">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">{L.suiteEyebrow}</div>
          <h2 className="font-display mt-3 text-4xl text-balance text-primary">{L.suiteTitle}</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {SUITE.map((p) => {
            const card = (
              <div
                className={`relative h-full overflow-hidden rounded-2xl p-6 ${
                  p.live ? "bg-dusk border border-secondary/20 shadow-elevated" : "border bg-card text-primary"
                }`}
              >
                <div className={`text-xs uppercase tracking-[0.22em] ${p.live ? "text-secondary-soft" : "opacity-70"}`}>{p.r}</div>
                <div className={`font-display mt-2 text-3xl ${p.live ? "text-sidebar-foreground" : ""}`}>{p.n}</div>
                <p className={`mt-3 text-sm ${p.live ? "text-sidebar-foreground/70" : "text-muted-foreground"}`}>{p.d}</p>
                <div className="mt-6 text-xs">
                  {p.live ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 font-medium text-primary-deep">{L.live}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-muted-foreground">{L.inAtelier}</span>
                  )}
                </div>
              </div>
            );
            if (!p.href) return <div key={p.n}>{card}</div>;
            return p.href.startsWith("/") ? (
              <Link key={p.n} to={p.href} className="block h-full">{card}</Link>
            ) : (
              <a key={p.n} href={p.href} target="_blank" rel="noreferrer" className="block h-full">{card}</a>
            );
          })}
        </div>
      </section>

      <footer className="border-t bg-card/60">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 md:flex-row">
          <Logo />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <KairosMark className="h-3.5 w-3.5 text-secondary" />
            {L.footerRights} · {L.footerAuthor}
          </div>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <a href="https://github.com/Vininic" target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { Boxes, Cloud, Code2, ExternalLink, Github, HelpCircle, Layers3, Linkedin, Mail } from "lucide-react";
import { KairosMark } from "@/components/KairosLogo";
import { useT } from "@/lib/i18n/I18nProvider";

const GITHUB_URL = "https://github.com/Vininic";
const LINKEDIN_URL = "https://www.linkedin.com/in/vin%C3%ADcius-nicoluci-esp%C3%ADndola-564069321/";
const EMAIL = "vininicespindola@gmail.com";

const STACK_ICONS = [
  <Code2 className="h-5 w-5" key="code" />,
  <Layers3 className="h-5 w-5" key="layers" />,
  <Boxes className="h-5 w-5" key="boxes" />,
  <Cloud className="h-5 w-5" key="cloud" />,
];

export default function About() {
  const t = useT();
  const L = t.kairos.about;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{L.eyebrow}</div>
        <h1 className="font-display mt-1.5 text-4xl text-primary">{L.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{L.lead}</p>
      </header>

      <section className="kairos-card flex items-start gap-5 p-6">
        <KairosMark className="mt-1 h-12 w-12 shrink-0 text-secondary" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{L.projectEyebrow}</div>
          <h2 className="font-display mt-1 text-2xl text-primary">{L.projectTitle}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{L.projectLead}</p>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {L.stack.map((c, i) => (
          <div key={c.name} className="kairos-card p-6">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">{STACK_ICONS[i] ?? STACK_ICONS[0]}</div>
            <h3 className="font-display mt-3 text-lg text-primary">{c.name}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
          </div>
        ))}
      </div>

      <section className="kairos-card mt-8 p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{L.linksEyebrow}</div>
        <h2 className="font-display mt-1 text-2xl text-primary">{L.linksTitle}</h2>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="rounded-md border border-border/60 bg-surface-raised p-3 transition-colors hover:border-secondary/40">
            <div className="flex items-center gap-2 text-primary"><Github className="h-4 w-4" /> GitHub <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" /></div>
            <p className="mt-1 text-xs text-muted-foreground">{L.githubDesc}</p>
            <p className="num mt-1 text-[11px] text-secondary">github.com/Vininic</p>
          </a>
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="rounded-md border border-border/60 bg-surface-raised p-3 transition-colors hover:border-secondary/40">
            <div className="flex items-center gap-2 text-primary"><Linkedin className="h-4 w-4" /> LinkedIn <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" /></div>
            <p className="mt-1 text-xs text-muted-foreground">{L.linkedinDesc}</p>
            <p className="mt-1 text-[11px] text-secondary">Vinícius Nicoluci Espíndola</p>
          </a>
          <a href={`mailto:${EMAIL}`} className="rounded-md border border-border/60 bg-surface-raised p-3 transition-colors hover:border-secondary/40">
            <div className="flex items-center gap-2 text-primary"><Mail className="h-4 w-4" /> Email <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" /></div>
            <p className="mt-1 text-xs text-muted-foreground">{L.emailDesc}</p>
            <p className="num mt-1 text-[11px] text-secondary">{EMAIL}</p>
          </a>
        </div>
      </section>

      <section className="kairos-card mt-8 p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{L.faqEyebrow}</div>
        <h2 className="font-display mt-1 text-2xl text-primary">{L.faqTitle}</h2>
        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          {L.faq.map((item) => (
            <div key={item.q} className="flex gap-3">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              <div>
                <p className="text-sm font-medium text-primary">{item.q}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

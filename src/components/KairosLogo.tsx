import { cn } from "@/lib/utils";

/** The Kairos mark — a kite diamond with the god's forelock.
 *  Kairos, the opportune moment, is seized by the forelock or not at all;
 *  it replaces the Chronos hourglass as the suite-sibling emblem. */
export function KairosMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cn("h-6 w-6", className)} aria-hidden>
      <path d="M32 16 L47 33 L32 50 L17 33 Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 16 C35.5 10.5 41.5 9 46 11" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

interface LogoProps {
  /** "light" for dark surfaces (sidebar, login panel); "dark" for parchment. */
  variant?: "light" | "dark";
  className?: string;
}

export default function Logo({ variant = "dark", className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <KairosMark className={variant === "light" ? "text-secondary-soft" : "text-secondary"} />
      <span
        className={cn(
          "font-display text-xl leading-none",
          variant === "light" ? "text-sidebar-foreground" : "text-primary",
        )}
      >
        Kairos
      </span>
    </div>
  );
}

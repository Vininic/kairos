import { Pipette } from "lucide-react";
import { PALETTE } from "@/lib/color";
import { useT } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}

/** Suite palette swatches plus a free custom color — the same "named materials
 *  first, any hue allowed" approach as Chronos categories. */
export default function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const t = useT();
  const isPreset = PALETTE.some((p) => p.hex.toLowerCase() === value.toLowerCase());
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {PALETTE.map((p) => (
        <button
          key={p.hex}
          type="button"
          title={p.name}
          aria-label={p.name}
          aria-pressed={p.hex.toLowerCase() === value.toLowerCase()}
          onClick={() => onChange(p.hex)}
          className={cn(
            "h-6 w-6 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            p.hex.toLowerCase() === value.toLowerCase()
              ? "scale-110 ring-2 ring-ring ring-offset-2 ring-offset-background"
              : "hover:scale-105",
          )}
          style={{ background: p.hex }}
        />
      ))}
      <label
        title={t.common.customColor}
        className={cn(
          "relative grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-border text-muted-foreground transition-transform hover:scale-105",
          !isPreset && "scale-110 ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
        style={!isPreset ? { background: value, color: "white" } : undefined}
      >
        <Pipette className="h-3 w-3" />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={t.common.customColor}
        />
      </label>
    </div>
  );
}

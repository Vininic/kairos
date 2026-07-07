/** Color helpers shared with the Chronos block language: cards are tinted with
 *  a translucent wash of their color, never striped. Alpha uses hex suffixes
 *  ("1A" ≈ 10%, "4D" ≈ 30%) so plain hex colors stay cheap to compose. */

export function toCssColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const t = color.trim();
  if (t.startsWith("#") || t.startsWith("rgb") || t.startsWith("hsl")) return t;
  return t;
}

export function alpha(color: string, opacity: string): string {
  if (color.startsWith("#")) return color + opacity;
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `, ${parseInt(opacity, 16) / 255})`);
  return color;
}

/** The suite palette — named materials, not arbitrary hues. Presets for
 *  projects and labels; a native color input covers everything else. */
export const PALETTE: { name: string; hex: string }[] = [
  { name: "Verdigris", hex: "#3E8A80" },
  { name: "Viridian", hex: "#18443A" },
  { name: "Ochre", hex: "#B7863B" },
  { name: "Ember", hex: "#C2542C" },
  { name: "Garnet", hex: "#9C3541" },
  { name: "Crimson", hex: "#A63446" },
  { name: "Rose", hex: "#B96A82" },
  { name: "Plum", hex: "#7D4E8C" },
  { name: "Indigo", hex: "#35558E" },
  { name: "Sky", hex: "#4A8AB5" },
  { name: "Moss", hex: "#6D8A3C" },
  { name: "Slate", hex: "#5E6B77" },
  { name: "Ink", hex: "#232B33" },
];

export const DEFAULT_PROJECT_COLOR = "#B96A82";

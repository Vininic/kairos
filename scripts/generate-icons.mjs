// Generates the PWA icon set from the Kairos mark (kite + forelock).
// Run: node scripts/generate-icons.mjs   (re-run after any identity change)
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const INK = "#1A0B1E";        // twilight plum — sidebar/dusk background
const STROKE = "#E7A9BE";     // rose-gold soft

/** The mark at `scale` of the canvas (maskable icons need a ~80% safe zone). */
function markSvg(size, scale) {
  const s = (size * scale) / 64; // the mark's native viewBox is 64
  const offset = (size - 64 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${INK}"/>
    <g transform="translate(${offset} ${offset}) scale(${s})">
      <path d="M32 16 L47 33 L32 50 L17 33 Z" fill="none" stroke="${STROKE}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M32 16 C35.5 10.5 41.5 9 46 11" fill="none" stroke="${STROKE}" stroke-width="3.5" stroke-linecap="round"/>
    </g>
  </svg>`;
}

await mkdir("public", { recursive: true });
const jobs = [
  { file: "public/pwa-192x192.png", size: 192, scale: 0.86 },
  { file: "public/pwa-512x512.png", size: 512, scale: 0.86 },
  { file: "public/pwa-maskable-512x512.png", size: 512, scale: 0.6 },
];
for (const { file, size, scale } of jobs) {
  await sharp(Buffer.from(markSvg(size, scale))).png().toFile(file);
  console.log("wrote", file);
}

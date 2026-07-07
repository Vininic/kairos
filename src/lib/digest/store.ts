import type { Digest } from "./types";

const STORAGE_KEY = "kairos.digest-store.v1";

export function getDigest(): Digest | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function setDigest(digest: Digest): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(digest));
  } catch {}
}

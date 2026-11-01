import { useSyncExternalStore } from "react";
import { setProductName } from "../i18n/translate.js";
import { applyBrandingToDocument } from "./applyBranding.js";
import { fetchPublicBranding, type PublicBranding } from "./branding.api.js";
import { lintelPublicBranding } from "./lintelBranding.js";

/**
 * The branding every screen shows. Loaded once before the admin draws anything (see
 * main.tsx), and replaced when someone saves Settings → Branding, so the sidebar, the
 * tab title and the accent colour change straight away.
 */

const REMEMBERED_KEY = "lintel.branding";

let current: PublicBranding = rememberedBranding() ?? lintelPublicBranding;
const listeners = new Set<() => void>();

export function currentBranding(): PublicBranding {
  return current;
}

export function showBranding(branding: PublicBranding): void {
  current = branding;
  setProductName(branding.productName);
  applyBrandingToDocument(branding);
  remember(branding);
  for (const listener of listeners) listener();
}

/** Fetches the branding; keeps the last one known when the server can't be reached. */
export async function loadBranding(): Promise<void> {
  showBranding(current);
  try {
    showBranding(await fetchPublicBranding());
  } catch {
    // The admin's own error screens explain an unreachable server; keep the last look.
  }
}

export function useBranding(): PublicBranding {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

/**
 * Remembered between visits, so a branded admin doesn't flash Lintel's violet while the
 * branding loads.
 */
function remember(branding: PublicBranding): void {
  try {
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(branding));
  } catch {
    // Private browsing can refuse storage; the branding still loads every time.
  }
}

function rememberedBranding(): PublicBranding | null {
  try {
    const stored = localStorage.getItem(REMEMBERED_KEY);
    return stored ? (JSON.parse(stored) as PublicBranding) : null;
  } catch {
    return null;
  }
}

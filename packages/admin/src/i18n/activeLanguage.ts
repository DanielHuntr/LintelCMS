import { useSyncExternalStore } from "react";
import {
  type Catalogue,
  closestInterfaceLanguage,
  type InterfaceLanguage,
  interfaceLanguages,
} from "./interfaceLanguages.js";

/**
 * The language the admin is speaking right now. `t()` reads it on every call, so changing
 * it and re-rendering (see InterfaceLanguageProvider) is enough to switch every screen.
 */
interface ActiveLanguage {
  language: InterfaceLanguage;
  catalogue: Catalogue;
  /** The locale Intl formats with: plural rules, numbers, dates. */
  formattingLocale: string;
}

let active: ActiveLanguage = {
  language: interfaceLanguages[0] as InterfaceLanguage,
  catalogue: {},
  formattingLocale: "en",
};
const listeners = new Set<() => void>();

export function activeLanguage(): ActiveLanguage {
  return active;
}

/**
 * Loads a language's messages and switches to it. Codes the admin has no words for fall
 * back to the closest it has, so a site default of "fr-CA" works once French is added.
 */
export async function switchInterfaceLanguage(code: string | null | undefined): Promise<void> {
  const language = closestInterfaceLanguage(code);
  if (language.code === active.language.code) {
    applyToDocument(language);
    return;
  }
  const catalogue = await language.loadCatalogue().catch(() => ({}));
  active = { language, catalogue, formattingLocale: language.formattingLocale ?? language.code };
  applyToDocument(language);
  for (const listener of listeners) listener();
}

/** The page's lang and dir, so screen readers pronounce it right and the layout mirrors. */
function applyToDocument(language: InterfaceLanguage): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language.code;
  document.documentElement.dir = language.direction;
}

export function subscribeToInterfaceLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The active language's code, re-rendering when it changes. */
export function useInterfaceLanguageCode(): string {
  return useSyncExternalStore(subscribeToInterfaceLanguage, () => active.language.code);
}

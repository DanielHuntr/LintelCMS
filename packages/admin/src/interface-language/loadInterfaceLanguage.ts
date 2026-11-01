import { switchInterfaceLanguage } from "../i18n/activeLanguage.js";
import { fetchInterfaceLanguage } from "./interfaceLanguage.api.js";

const REMEMBERED_KEY = "lintel.interfaceLanguage";

/**
 * Asks the server which language to speak (the person's, else the site's) and switches
 * to it. Run before the admin first draws, and again after signing in or out. Remembered
 * between visits, so the admin doesn't flash English before it loads.
 */
export async function loadInterfaceLanguage(): Promise<void> {
  await switchInterfaceLanguage(rememberedLanguage());
  try {
    const { active } = await fetchInterfaceLanguage();
    rememberLanguage(active);
    await switchInterfaceLanguage(active);
  } catch {
    // An unreachable server is explained by the admin's own error screens.
  }
}

export function rememberLanguage(code: string): void {
  try {
    localStorage.setItem(REMEMBERED_KEY, code);
  } catch {
    // Storage can be refused; the language still loads from the server.
  }
}

function rememberedLanguage(): string | null {
  try {
    return localStorage.getItem(REMEMBERED_KEY);
  } catch {
    return null;
  }
}

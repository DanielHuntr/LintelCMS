import { Fragment, type ReactNode } from "react";
import { useInterfaceLanguageCode } from "../i18n/activeLanguage.js";

/**
 * Draws the admin again from the top when the language changes, so every `t()` call
 * picks up the new words. Changing language is rare, so starting screens afresh is fine.
 */
export function InterfaceLanguageProvider({ children }: { children: ReactNode }) {
  const code = useInterfaceLanguageCode();
  return <Fragment key={code}>{children}</Fragment>;
}

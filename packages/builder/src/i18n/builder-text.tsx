import { createContext, type ReactNode, useContext } from "react";
import { type BuilderStringKey, builderStrings } from "./builder-strings.js";

/**
 * The builder's words come from the app it sits in: the admin passes its own `t()`, whose list
 * includes `builderStrings`, so the builder is translated and renamed with the rest of the
 * admin. On its own (in tests) it uses the English list directly.
 */
export type Translate = (
  key: BuilderStringKey,
  values?: Readonly<Record<string, string | number>>,
) => string;

export const englishText: Translate = (key, values) => {
  const text: string = builderStrings[key];
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  );
};

const BuilderTextContext = createContext<Translate>(englishText);

export function BuilderTextProvider({ text, children }: { text: Translate; children: ReactNode }) {
  return <BuilderTextContext.Provider value={text}>{children}</BuilderTextContext.Provider>;
}

export function useBuilderText(): Translate {
  return useContext(BuilderTextContext);
}

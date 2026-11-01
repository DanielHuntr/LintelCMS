import { createContext, createElement, useContext, type ReactNode } from "react";
import { motionEditorStrings, type MotionEditorStringKey } from "./motionEditorStrings.js";

/**
 * The studio's words. It ships English, and a host app can pass its own `translate`
 * (the admin passes its `t()`, which includes these strings), so the studio is translated
 * and renamed along with the rest of the admin.
 */

export type StringValues = Readonly<Record<string, string | number>>;
export type Translate = (key: MotionEditorStringKey, values?: StringValues) => string;

export const translateInEnglish: Translate = (key, values) => {
  const text: string = motionEditorStrings[key];
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  );
};

const TranslateContext = createContext<Translate>(translateInEnglish);

export function TranslateProvider({
  translate,
  children,
}: {
  translate: Translate | undefined;
  children: ReactNode;
}) {
  return createElement(
    TranslateContext.Provider,
    { value: translate ?? translateInEnglish },
    children,
  );
}

export function useTranslate(): Translate {
  return useContext(TranslateContext);
}

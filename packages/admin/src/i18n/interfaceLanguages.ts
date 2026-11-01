import { accentText, bracketMessage, mirrorText } from "./pseudoLocales.js";

/** A translation: string key → ICU message. Keys it leaves out are shown in English. */
export type Catalogue = Readonly<Record<string, string>>;

export interface InterfaceLanguage {
  /** A language tag, such as "en", "fr" or "pt-BR". */
  code: string;
  /** The language's name in itself ("Français"), so people can find their own. */
  nativeName: string;
  direction: "ltr" | "rtl";
  /** The locale for plural rules, numbers and dates, when it differs from `code`. */
  formattingLocale?: string;
  /** For testing translations only: hidden unless pseudo-languages are switched on. */
  isPseudo?: boolean;
  /** The translated messages. English is the source, so it has none. */
  loadCatalogue: () => Promise<Catalogue>;
  /** Pseudo-languages change the words of each message (see pseudoLocales.ts). */
  transformText?: (text: string) => string;
  transformMessage?: (message: string) => string;
}

const noTranslations = async (): Promise<Catalogue> => ({});

/**
 * Every language the admin can speak, in one visible list. To add a translation, put its
 * messages in catalogues/<code>.json and add a line here, such as:
 *
 *   { code: "fr", nativeName: "Français", direction: "ltr",
 *     loadCatalogue: async () => (await import("./catalogues/fr.json")).default },
 *
 * docs: packages/docs/src/content/docs/building/translating.md
 */
export const interfaceLanguages: readonly InterfaceLanguage[] = [
  { code: "en", nativeName: "English", direction: "ltr", loadCatalogue: noTranslations },
  {
    code: "en-XA",
    nativeName: "Accented English (for testing)",
    direction: "ltr",
    formattingLocale: "en",
    isPseudo: true,
    loadCatalogue: noTranslations,
    transformText: accentText,
    transformMessage: bracketMessage,
  },
  {
    code: "ar-XB",
    nativeName: "Right-to-left English (for testing)",
    direction: "rtl",
    formattingLocale: "ar",
    isPseudo: true,
    loadCatalogue: noTranslations,
    transformText: mirrorText,
  },
];

export const SOURCE_LANGUAGE = "en";

/** Pseudo-languages are for developers and translators: on in development, or when asked for. */
export function showsPseudoLanguages(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_PSEUDO_LANGUAGES === "true";
}

/** The languages people can choose from. */
export function choosableInterfaceLanguages(): InterfaceLanguage[] {
  return interfaceLanguages.filter((language) => !language.isPseudo || showsPseudoLanguages());
}

/**
 * The closest language the admin speaks: "fr-CA" falls back to "fr", and anything with no
 * translation at all to English.
 */
export function closestInterfaceLanguage(code: string | null | undefined): InterfaceLanguage {
  const choosable = choosableInterfaceLanguages();
  const lowerCase = (code ?? "").toLowerCase();
  const exact = choosable.find((language) => language.code.toLowerCase() === lowerCase);
  const base = choosable.find(
    (language) => language.code.toLowerCase() === lowerCase.split("-")[0],
  );
  const english = interfaceLanguages[0] as InterfaceLanguage;
  return exact ?? base ?? english;
}

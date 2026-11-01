import { formattingLocale } from "../i18n/formatting.js";

/**
 * Languages offered when adding one to the site, so most people can pick from a list rather
 * than know a language code. Anything else can still be typed as a code.
 */
export const commonLocaleCodes = [
  "en-GB",
  "en-US",
  "fr-FR",
  "fr-CA",
  "de-DE",
  "es-ES",
  "es-MX",
  "it-IT",
  "pt-PT",
  "pt-BR",
  "nl-NL",
  "sv-SE",
  "da-DK",
  "nb-NO",
  "fi-FI",
  "pl-PL",
  "cs-CZ",
  "el-GR",
  "tr-TR",
  "uk-UA",
  "ar",
  "he",
  "hi-IN",
  "ja-JP",
  "ko-KR",
  "zh-CN",
  "zh-TW",
  "cy-GB",
  "ga-IE",
] as const;

/** "French (Canada)" for "fr-CA", in the admin's own language. */
export function describeLanguage(code: string): string {
  try {
    return new Intl.DisplayNames([formattingLocale()], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

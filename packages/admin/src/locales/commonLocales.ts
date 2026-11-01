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

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

/** "French (Canada)" for "fr-CA". The API names new languages the same way. */
export function describeLanguage(code: string): string {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}

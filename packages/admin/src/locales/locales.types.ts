/** One of the site's languages. Matches the API's `Locale`. */
export interface Locale {
  code: string;
  name: string;
  isDefault: boolean;
  entryCount: number;
}

export interface LocaleList {
  defaultLocale: string;
  locales: Locale[];
}

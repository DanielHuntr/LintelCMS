import { useQuery } from "@tanstack/react-query";
import { listLocales } from "./locales.api.js";

export const localeKeys = { locales: () => ["locales"] as const };

/** The site's languages. Changes only in Settings, so it is kept for the whole visit. */
export function useLocales() {
  return useQuery({ queryKey: localeKeys.locales(), queryFn: listLocales, staleTime: 60_000 });
}

/** The name of a language for people, falling back to its code while the list loads. */
export function useLocaleName(): (code: string) => string {
  const { data } = useLocales();
  return (code) => data?.locales?.find((locale) => locale.code === code)?.name ?? code;
}

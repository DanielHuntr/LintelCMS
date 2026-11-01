/**
 * A plugin's own words, used the way the admin uses `t()`:
 *
 *   const t = createTranslator({ "bookings.title": "Bookings", "bookings.count": "{count} today" });
 *   t("bookings.count", { count: 3 })   // "3 today"; a misspelt key is a type error
 *
 * Keeping every string in one object lets a plugin be translated, as the admin is.
 */
export function createTranslator<const Strings extends Record<string, string>>(strings: Strings) {
  return function translate(
    key: keyof Strings & string,
    values?: Readonly<Record<string, string | number>>,
  ): string {
    const text = strings[key] ?? key;
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      name in values ? String(values[name]) : placeholder,
    );
  };
}

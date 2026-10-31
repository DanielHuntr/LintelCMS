import { t, type StringKey } from "../i18n/strings.js";

/** Stands in for a section whose screens haven't been built yet. */
export function ComingSoonPage({ title }: { title: StringKey }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t(title)}</h1>
      <p className="mt-2 text-stone-600">{t("section.comingSoon")}</p>
    </section>
  );
}

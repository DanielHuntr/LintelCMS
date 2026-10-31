import { t } from "../i18n/strings.js";

export function DashboardPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
      <p className="mt-2 text-stone-600">{t("dashboard.intro")}</p>
    </section>
  );
}

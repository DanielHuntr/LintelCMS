import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { ComponentSpecimens } from "./ComponentSpecimens.js";

type ColorScheme = "light" | "dark";

/**
 * A development-only page that shows every base component, once in light and once in dark,
 * so the design system can be reviewed in one place. It is not in the sidebar.
 */
export function DesignReviewPage() {
  return (
    <main className="min-h-screen bg-background text-label">
      <div className="px-10 pt-14">
        <LargeTitle title={t("designReview.title")} subtitle={t("designReview.intro")} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2">
        <SchemeColumn scheme="light" />
        <SchemeColumn scheme="dark" />
      </div>
    </main>
  );
}

function SchemeColumn({ scheme }: { scheme: ColorScheme }) {
  return (
    // data-color-scheme forces this column's tokens, whatever the device's setting (see styles.css).
    <section
      data-color-scheme={scheme}
      aria-label={t(scheme === "light" ? "designReview.light" : "designReview.dark")}
      className="flex flex-col gap-12 bg-background px-10 pt-6 pb-20 text-label"
    >
      <p className="text-title">
        {t(scheme === "light" ? "designReview.light" : "designReview.dark")}
      </p>
      <ComponentSpecimens />
    </section>
  );
}

import { Lock } from "lucide-react";
import { Card } from "../design/Card.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { t } from "../i18n/strings.js";

/** Shown in place of a screen someone's role doesn't include, when they type its address. */
export function NotAvailablePage() {
  return (
    <>
      <LargeTitle title={t("layout.notAvailable.title")} />
      <Card>
        <EmptyState
          size="page"
          icon={Lock}
          title={t("layout.notAvailable.heading")}
          description={t("layout.notAvailable.description")}
          action={
            <LinkButton to="/" variant="tinted">
              {t("plugins.backToDashboard")}
            </LinkButton>
          }
        />
      </Card>
    </>
  );
}

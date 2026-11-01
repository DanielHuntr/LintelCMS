import { Hourglass } from "lucide-react";
import { Card } from "../design/Card.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t, type StringKey } from "../i18n/strings.js";
import { Page } from "../design/Page.js";

/** Stands in for a section whose screens haven't been built yet. */
export function ComingSoonPage({ title }: { title: StringKey }) {
  return (
    <Page width="wide">
      <LargeTitle title={t(title)} />
      <Card>
        <EmptyState
          size="page"
          icon={Hourglass}
          title={t("section.comingSoonTitle")}
          description={t("section.comingSoon")}
        />
      </Card>
    </Page>
  );
}

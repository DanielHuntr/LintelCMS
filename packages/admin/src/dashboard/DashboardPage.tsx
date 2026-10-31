import {
  Clock,
  FileStack,
  KeyRound,
  ListTodo,
  Paintbrush,
  PenLine,
  ShoppingBag,
} from "lucide-react";
import { Badge } from "../design/Badge.js";
import { Card } from "../design/Card.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";

/** The home screen. Each card is a placeholder until its feature is built. */
export function DashboardPage() {
  return (
    <>
      <LargeTitle title={t("dashboard.title")} subtitle={t("dashboard.intro")} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={t("dashboard.recentEdits.title")}>
          <EmptyState
            icon={PenLine}
            title={t("dashboard.recentEdits.emptyTitle")}
            description={t("dashboard.recentEdits.emptyDescription")}
          />
        </Card>

        <Card title={t("dashboard.tasks.title")}>
          <EmptyState
            icon={ListTodo}
            title={t("dashboard.tasks.emptyTitle")}
            description={t("dashboard.tasks.emptyDescription")}
          />
        </Card>

        <Card title={t("dashboard.sales.title")}>
          <EmptyState
            icon={ShoppingBag}
            title={t("dashboard.sales.emptyTitle")}
            description={t("dashboard.sales.emptyDescription")}
          />
        </Card>

        <Card title={t("dashboard.whatsNew.title")}>
          <WhatsNewList />
        </Card>
      </div>
    </>
  );
}

/**
 * Roadmap highlights. The negative margins line the icons up with the card title and let the
 * separators run to the card's right edge, as rows do in iOS.
 */
function WhatsNewList() {
  return (
    <ul className="-mr-5 -mb-2 -ml-4">
      <GroupedListRow
        icon={Paintbrush}
        label={t("dashboard.whatsNew.designTitle")}
        description={t("dashboard.whatsNew.designDescription")}
        accessory={<Badge tone="accent">{t("badge.new")}</Badge>}
      />
      <GroupedListRow
        icon={KeyRound}
        label={t("dashboard.whatsNew.signInTitle")}
        description={t("dashboard.whatsNew.signInDescription")}
        accessory={<Badge tone="accent">{t("badge.new")}</Badge>}
      />
      <GroupedListRow
        icon={FileStack}
        iconTone="neutral"
        label={t("dashboard.whatsNew.contentTitle")}
        description={t("dashboard.whatsNew.contentDescription")}
        accessory={
          <Badge>
            <Clock aria-hidden="true" className="mr-1 size-3" />
            {t("badge.planned")}
          </Badge>
        }
      />
    </ul>
  );
}

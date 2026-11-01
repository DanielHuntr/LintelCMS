import { helpPages } from "@lintel/docs/help";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { t } from "../i18n/strings.js";

/** Every "Using Lintel" page, in the docs' order. */
export function HelpTopicList({ onOpenPage }: { onOpenPage: (slug: string) => void }) {
  return (
    <GroupedList header={t("help.topicsTitle")}>
      {helpPages.map((page) => (
        <GroupedListRow
          key={page.slug}
          label={page.title}
          description={page.description}
          wrapsText
          onSelect={() => onOpenPage(page.slug)}
        />
      ))}
    </GroupedList>
  );
}

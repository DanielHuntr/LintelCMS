import { helpPages } from "@lintel/docs/help";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { t } from "../i18n/strings.js";

interface HelpTopicListProps {
  onOpenPage: (slug: string) => void;
  /** 3 inside the help panel, under its own h2. */
  headingLevel?: 2 | 3;
}

/** Every "Using Lintel" page, in the docs' order. */
export function HelpTopicList({ onOpenPage, headingLevel = 2 }: HelpTopicListProps) {
  return (
    <GroupedList header={t("help.topicsTitle")} headingLevel={headingLevel}>
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

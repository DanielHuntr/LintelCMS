import type { Collection, Entry } from "./content.types.js";
import { ParentPagePicker } from "./ParentPagePicker.js";
import { PublishingSection } from "./PublishingSection.js";
import { RevisionHistory } from "./RevisionHistory.js";
import { TranslationsSection } from "./TranslationsSection.js";

interface EntrySidePanelProps {
  id: string;
  collection: Collection;
  entry: Entry | undefined;
  /** The language the entry is written in. Undefined is the site's main language. */
  locale: string | undefined;
  parentId: string | null;
  onParentChange: (parentId: string | null) => void;
  canPublish: boolean;
  isWorking: boolean;
  onUnpublish: () => void;
  onSchedule: (publishAt: string) => void;
  onRestore: (revisionId: string) => Promise<void>;
}

/** Everything about the entry that isn't its content: status, place in the tree, history. */
export function EntrySidePanel({
  id,
  collection,
  entry,
  locale,
  parentId,
  onParentChange,
  canPublish,
  isWorking,
  onUnpublish,
  onSchedule,
  onRestore,
}: EntrySidePanelProps) {
  return (
    <aside
      id={id}
      aria-label={collection.name}
      className="sticky top-20 flex flex-col self-start overflow-hidden rounded-card bg-surface"
    >
      <PublishingSection
        entry={entry}
        canPublish={canPublish}
        isWorking={isWorking}
        onUnpublish={onUnpublish}
        onSchedule={onSchedule}
      />
      <TranslationsSection collectionHandle={collection.handle} entry={entry} locale={locale} />
      {collection.structure === "tree" && (
        <ParentPagePicker
          collectionHandle={collection.handle}
          locale={locale}
          entryId={entry?.id}
          parentId={parentId}
          onChange={onParentChange}
        />
      )}
      <RevisionHistory entryId={entry?.id} isWorking={isWorking} onRestore={onRestore} />
    </aside>
  );
}

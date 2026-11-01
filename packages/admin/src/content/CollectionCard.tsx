import { Link } from "@tanstack/react-router";
import { FileStack, List, Newspaper, type LucideIcon } from "lucide-react";
import { t, tCount } from "../i18n/strings.js";
import type { Collection, CollectionStructure } from "./content.types.js";
import { formatDateTime, formatRelativeTime } from "./relativeTime.js";

/** An icon for each structure, so pages, posts and simple lists are told apart at a glance. */
const structureIcons: Record<CollectionStructure, LucideIcon> = {
  tree: FileStack,
  dated: Newspaper,
  flat: List,
};

/** One collection on the overview: a card that opens its entries. */
export function CollectionCard({ collection, now }: { collection: Collection; now: number }) {
  const Icon = structureIcons[collection.structure] ?? List;

  return (
    <li>
      <Link
        to="/content/$collection"
        params={{ collection: collection.handle }}
        className="group flex h-full flex-col gap-5 rounded-card bg-surface p-5 transition duration-200 ease-standard hover:shadow-float focus-visible:focus-ring motion-safe:active:scale-[0.99]"
      >
        <span className="flex size-10 items-center justify-center rounded-[10px] bg-accent/12 text-accent">
          <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-headline text-label">{collection.name}</span>
          <span className="text-footnote text-label-secondary">
            {tCount(
              { one: "entries.count.one", other: "entries.count.other" },
              collection.entryCount,
            )}
          </span>
        </span>
        <span className="mt-auto text-caption text-label-tertiary">
          <time dateTime={collection.updatedAt} title={formatDateTime(collection.updatedAt)}>
            {t("content.updated", { time: formatRelativeTime(collection.updatedAt, now) })}
          </time>
        </span>
      </Link>
    </li>
  );
}

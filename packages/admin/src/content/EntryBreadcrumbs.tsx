import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEntryPath } from "../content-tree/contentTree.queries.js";
import { t } from "../i18n/strings.js";
import type { Collection } from "./content.types.js";

interface EntryBreadcrumbsProps {
  collection: Collection;
  /** Undefined for a new entry: it has no place yet beyond its section. */
  entryId: string | undefined;
  title: string;
}

/** The page's name, after its section and the pages above it (the name alone on a phone). */
export function EntryBreadcrumbs({ collection, entryId, title }: EntryBreadcrumbsProps) {
  const path = useEntryPath(entryId);
  const ancestors = Array.isArray(path.data?.path) ? path.data.path.slice(0, -1) : [];

  return (
    <nav aria-label={t("workspace.breadcrumbs")} className="min-w-0 max-w-full">
      <ol className="flex min-w-0 items-center gap-1 text-footnote text-label-secondary">
        <li className="shrink-0 max-md:hidden">
          <Link
            to="/content/$collection"
            params={{ collection: collection.handle }}
            className="rounded-[4px] hover:text-label focus-visible:focus-ring"
          >
            {collection.name}
          </Link>
        </li>
        {ancestors.map((step) => (
          <li key={step.id} className="flex min-w-0 items-center gap-1 max-md:hidden">
            <ChevronRight aria-hidden="true" strokeWidth={2} className="size-3 shrink-0" />
            <Link
              to="/content/$collection/$entryId"
              params={{ collection: step.collection.handle, entryId: step.id }}
              className="truncate rounded-[4px] hover:text-label focus-visible:focus-ring"
            >
              {step.title || t("tree.untitled")}
            </Link>
          </li>
        ))}
        <li className="flex min-w-0 items-center gap-1" aria-current="page">
          <ChevronRight
            aria-hidden="true"
            strokeWidth={2}
            className="size-3 shrink-0 max-md:hidden"
          />
          <span className="truncate text-body font-semibold text-label">
            {title || t("editor.untitled")}
          </span>
        </li>
      </ol>
    </nav>
  );
}

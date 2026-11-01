import { Link } from "@tanstack/react-router";
import { ChevronRight, Ellipsis } from "lucide-react";
import { useState } from "react";
import type { Collection, Entry } from "../content/content.types.js";
import { EntrySlugInput } from "../content/EntrySlugInput.js";
import { EntryStatusBadge } from "../content/EntryStatusBadge.js";
import { EntryTitleInput } from "../content/EntryTitleInput.js";
import type { ViewPageTarget } from "../content/viewPage.js";
import { useEntryPath } from "../content-tree/contentTree.queries.js";
import type { EntryInfo, TreeNode } from "../content-tree/contentTree.types.js";
import { TreeActionsMenu } from "../content-tree/TreeActionsMenu.js";
import { useActionItems } from "../content-tree/useActionItems.js";
import { Badge } from "../design/Badge.js";
import { t } from "../i18n/strings.js";

interface WorkspaceHeaderProps {
  collection: Collection;
  entry: Entry;
  title: string;
  slug: string;
  titleLabel: string | undefined;
  fieldErrors: Readonly<Record<string, string>>;
  viewPage: ViewPageTarget | undefined;
  info: EntryInfo | undefined;
  onTitleChange: (title: string) => void;
  onSlugChange: (slug: string) => void;
}

/**
 * The top of the workspace: where the entry is (breadcrumbs from its section down), its
 * name as an inline-editable heading, its address and status, and its actions.
 */
export function WorkspaceHeader({
  collection,
  entry,
  title,
  slug,
  titleLabel,
  fieldErrors,
  viewPage,
  info,
  onTitleChange,
  onSlugChange,
}: WorkspaceHeaderProps) {
  const path = useEntryPath(entry.id);
  const ancestors = path.data?.path.slice(0, -1) ?? [];
  const node: TreeNode = {
    id: entry.id,
    title,
    slug: entry.slug,
    status: entry.status,
    hasUnpublishedChanges: entry.hasUnpublishedChanges,
    scheduledFor: entry.scheduledFor,
    updatedAt: entry.updatedAt,
    parentId: entry.parentId,
    locale: entry.locale,
    collection: { handle: collection.handle, name: collection.name },
    childCount: info?.childCount ?? 0,
    childrenAsCollection: info?.childrenAsCollection ?? false,
  };
  const actions = useActionItems({ kind: "entry", node }).filter(
    // Those are the workspace's own tabs and buttons.
    (action) => !["preview", "history", "info", "openList"].includes(action.key),
  );
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const isChanged = entry.status === "published" && entry.hasUnpublishedChanges;

  return (
    <header className="mb-4 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <nav aria-label={t("workspace.breadcrumbs")} className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1 text-footnote text-label-secondary">
            <li className="shrink-0">
              <Link
                to="/content/$collection"
                params={{ collection: collection.handle }}
                className="rounded-[4px] hover:text-label focus-visible:focus-ring"
              >
                {collection.name}
              </Link>
            </li>
            {ancestors.map((step) => (
              <li key={step.id} className="flex min-w-0 items-center gap-1">
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
              <ChevronRight aria-hidden="true" strokeWidth={2} className="size-3 shrink-0" />
              <span className="truncate text-label">{title || t("tree.untitled")}</span>
            </li>
          </ol>
        </nav>
        <EntryStatusBadge status={entry.status} />
        {isChanged && <Badge tone="warning">{t("tree.status.changed")}</Badge>}
        {actions.length > 0 && (
          <button
            type="button"
            aria-label={t("workspace.actions")}
            aria-haspopup="menu"
            aria-expanded={menuAt !== null}
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setMenuAt({ x: box.right - 208, y: box.bottom + 6 });
            }}
            className="flex size-9 items-center justify-center rounded-control text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring"
          >
            <Ellipsis aria-hidden="true" strokeWidth={2} className="size-5" />
          </button>
        )}
        {menuAt && (
          <TreeActionsMenu
            label={t("workspace.actions")}
            items={actions}
            position={menuAt}
            onClose={() => setMenuAt(null)}
          />
        )}
      </div>
      <h1 className="sr-only">{title || t("editor.untitled")}</h1>
      <EntryTitleInput
        label={titleLabel ?? t("editor.titleFallback")}
        value={title}
        onChange={onTitleChange}
        error={fieldErrors.title}
      />
      <EntrySlugInput
        routePattern={collection.routePattern}
        slug={slug}
        onChange={onSlugChange}
        error={fieldErrors.slug}
        viewPage={viewPage}
      />
    </header>
  );
}

import { useQueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent } from "react";
import { apiRequest } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { contentKeys, useCollections } from "../content/content.queries.js";
import type { Collection } from "../content/content.types.js";
import { treeKeys } from "../content-tree/contentTree.queries.js";
import { Button } from "../design/Button.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import type { Blueprint } from "./blueprints.types.js";

/** The most columns a list shows; the API refuses more. */

type Placement = Pick<Collection, "allowedAtRoot" | "allowedChildren" | "childrenAsCollection">;

function savePlacement(collectionHandle: string, placement: Placement): Promise<Collection> {
  return apiRequest<Collection>(`/collections/${encodeURIComponent(collectionHandle)}`, {
    method: "PUT",
    body: placement,
  });
}

/**
 * "Where it goes" on a content type's page: for each collection using it, whether it can sit
 * at the top of the content tree, what may be created under it, and whether its children
 * are listed in the workspace (and with which columns). Content model files can set the same.
 */
export function ContentTypePlacement({ blueprint }: { blueprint: Blueprint }) {
  const canEdit = useCan("collections:update");
  const collections = useCollections();
  const all = collections.data ?? [];
  const using = all.filter((collection) => collection.blueprintHandle === blueprint.handle);
  if (!canEdit || using.length === 0) return null;

  return (
    <section aria-labelledby="placement-heading" className="mt-8 flex flex-col gap-2">
      <div className="px-1">
        <h2 id="placement-heading" className="text-headline text-label">
          {t("placement.title")}
        </h2>
        <p className="text-footnote text-label-secondary">{t("placement.description")}</p>
      </div>
      {using.map((collection) => (
        <PlacementForm
          key={collection.handle}
          collection={collection}
          collections={all}
          showsName={using.length > 1}
        />
      ))}
    </section>
  );
}

interface PlacementFormProps {
  collection: Collection;
  collections: readonly Collection[];
  showsName: boolean;
}

function PlacementForm({ collection, collections, showsName }: PlacementFormProps) {
  const queryClient = useQueryClient();
  const [placement, setPlacement] = useState<Placement>({
    allowedAtRoot: collection.allowedAtRoot,
    allowedChildren: collection.allowedChildren,
    childrenAsCollection: collection.childrenAsCollection,
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const childrenId = useId();
  // Only collections arranged as pages with children can go under something.
  const childCandidates = collections.filter((candidate) => candidate.structure === "tree");

  function change(next: Partial<Placement>) {
    setPlacement((current) => ({ ...current, ...next }));
    setStatus("idle");
  }

  function toggleIn(list: readonly string[], handle: string, isOn: boolean): string[] {
    return isOn
      ? [...list.filter((item) => item !== handle), handle]
      : list.filter((item) => item !== handle);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      const updated = await savePlacement(collection.handle, placement);
      queryClient.setQueryData(contentKeys.collection(updated.handle), updated);
      await queryClient.invalidateQueries({ queryKey: contentKeys.collections() });
      await queryClient.invalidateQueries({ queryKey: treeKeys.all() });
      setStatus("saved");
    } catch (failure) {
      setError(describeError(failure));
      setStatus("idle");
    }
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="flex flex-col gap-5 rounded-card bg-surface p-5"
    >
      {showsName && (
        <h3 className="text-body font-medium text-label">
          {t("placement.collection", { name: collection.name, handle: collection.handle })}
        </h3>
      )}
      <ToggleWithHint
        label={t("placement.allowedAtRoot")}
        hint={t("placement.allowedAtRootHint")}
        checked={placement.allowedAtRoot}
        onCheckedChange={(checked) => change({ allowedAtRoot: checked })}
      />
      {collection.structure === "tree" && (
        <fieldset aria-describedby={`${childrenId}-hint`} className="flex flex-col gap-2">
          <legend className="text-footnote font-medium text-label">
            {t("placement.allowedChildren")}
          </legend>
          <p id={`${childrenId}-hint`} className="text-footnote text-label-secondary">
            {t("placement.allowedChildrenHint")}
          </p>
          {childCandidates.map((candidate) => (
            <label key={candidate.handle} className="flex items-center gap-2 text-body text-label">
              <input
                type="checkbox"
                checked={placement.allowedChildren.includes(candidate.handle)}
                onChange={(event) =>
                  change({
                    allowedChildren: toggleIn(
                      placement.allowedChildren,
                      candidate.handle,
                      event.target.checked,
                    ),
                  })
                }
                className="size-4 accent-(--color-accent-fill)"
              />
              {candidate.name}
            </label>
          ))}
        </fieldset>
      )}
      {collection.structure === "tree" && (
        <ToggleWithHint
          label={t("placement.childrenAsCollection")}
          hint={t("placement.childrenAsCollectionHint")}
          checked={placement.childrenAsCollection}
          onCheckedChange={(checked) => change({ childrenAsCollection: checked })}
        />
      )}
      <p className="text-footnote text-label-secondary">{t("placement.listColumnsHint")}</p>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="tinted" disabled={status === "saving"}>
          {t("placement.save")}
        </Button>
        <p
          role="status"
          className={error ? "text-footnote text-danger" : "text-footnote text-label-secondary"}
        >
          {error ?? (status === "saved" ? t("placement.saved") : "")}
        </p>
      </div>
    </form>
  );
}

interface ToggleWithHintProps {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function ToggleWithHint({ label, hint, checked, onCheckedChange }: ToggleWithHintProps) {
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1">
      <Toggle
        label={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
        describedBy={hintId}
      />
      <p id={hintId} className="text-footnote text-label-secondary">
        {hint}
      </p>
    </div>
  );
}

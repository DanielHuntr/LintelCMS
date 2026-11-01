import { useNavigate } from "@tanstack/react-router";
import { useId, useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { createEntry } from "../content/content.api.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { Dialog } from "../design/Dialog.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { useContentTree } from "./ContentTreeContext.js";
import type { TreePlace } from "./contentTree.types.js";
import { useAllowedTypes, useRefreshContent } from "./contentTree.queries.js";
import { rootKey } from "./treeState.js";
import { iconForContent } from "./typeIcons.js";

interface CreateDialogProps {
  /** Under an entry, at a collection's top, or (null) anywhere at the top, from the landing. */
  place: TreePlace | null;
  /** The entry or section's name, for the title; undefined at the top. */
  placeName: string | undefined;
  /** "Create your home page": a page tree chosen first, and Home as the name. */
  isHome?: boolean;
  onClose: () => void;
}

/**
 * "Create": offers only the content types allowed at this place (the server decides, from
 * each content type's "Where it goes"), asks for a name, makes a draft and opens it.
 */
export function CreateDialog({ place, placeName, isHome = false, onClose }: CreateDialogProps) {
  const navigate = useNavigate();
  const tree = useContentTree();
  const refresh = useRefreshContent();
  const allowed = useAllowedTypes(place);
  const types = allowed.data?.types ?? [];
  const [chosen, setChosen] = useState<string | undefined>();
  const [name, setName] = useState(isHome ? t("tree.createHome.name") : "");
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const groupLabelId = useId();
  const chosenType =
    types.find((type) => type.handle === chosen) ??
    (isHome ? types.find((type) => type.structure === "tree") : undefined) ??
    types[0];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!chosenType) return;
    if (name.trim() === "") {
      setError(t("tree.create.nameRequired"));
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      const parentId = place && "parentId" in place ? place.parentId : null;
      const created = await createEntry(chosenType.handle, {
        data: { title: name.trim() },
        slug: "",
        parentId,
      });
      tree.open([parentId ?? rootKey(chosenType.handle)]);
      await refresh();
      onClose();
      await navigate({
        to: "/content/$collection/$entryId",
        params: { collection: chosenType.handle, entryId: created.id },
      });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setIsWorking(false);
    }
  }

  const formId = useId();
  return (
    <Dialog
      open
      onClose={onClose}
      title={
        isHome
          ? t("tree.createHome.title")
          : placeName
            ? t("tree.create.title", { place: placeName })
            : t("tree.create.titleAtTop")
      }
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={!chosenType || isWorking}>
            {t("tree.create.confirm")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-5"
      >
        {allowed.isPending && <Skeleton className="h-16 w-full" />}
        {allowed.data && types.length === 0 && (
          <p className="text-body text-label-secondary">
            {placeName
              ? t("tree.create.noTypes", { place: placeName })
              : t("tree.create.noTypesAtTop")}
          </p>
        )}
        {types.length > 0 && (
          <div role="radiogroup" aria-labelledby={groupLabelId} className="flex flex-col gap-2">
            <span id={groupLabelId} className="text-footnote font-medium text-label">
              {t("tree.create.typeLabel")}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {types.map((type) => {
                const Icon = iconForContent(type);
                const isChosen = chosenType?.handle === type.handle;
                return (
                  <label
                    key={type.handle}
                    className={classNames(
                      "flex cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5 text-body",
                      "has-focus-visible:focus-ring",
                      isChosen
                        ? "bg-accent/12 text-accent ring-1 ring-accent"
                        : "bg-fill/60 text-label hover:bg-fill",
                    )}
                  >
                    <input
                      type="radio"
                      name="content-type"
                      value={type.handle}
                      checked={isChosen}
                      onChange={() => setChosen(type.handle)}
                      className="sr-only"
                    />
                    <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
                    <span className="truncate">{type.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        {types.length > 0 && (
          <TextField
            label={t("tree.create.nameLabel")}
            placeholder={t("tree.create.namePlaceholder")}
            hint={t("tree.create.nameHint")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={error ?? undefined}
            data-autofocus=""
            autoComplete="off"
          />
        )}
      </form>
    </Dialog>
  );
}

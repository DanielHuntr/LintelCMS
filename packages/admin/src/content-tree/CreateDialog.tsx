import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { createEntry } from "../content/content.api.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { Dialog } from "../design/Dialog.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { setPageInMenu } from "../menus/menus.api.js";
import { useCan } from "../session/SessionContext.js";
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
  /** Making it right under the site's start (its home page): "In the main menu" starts on. */
  isUnderSiteStart?: boolean;
  onClose: () => void;
}

/**
 * "Create": offers only the content types allowed at this place (the server decides, from
 * each content type's "Where it goes"), asks for a name, makes a draft and opens it.
 */
export function CreateDialog({
  place,
  placeName,
  isHome = false,
  isUnderSiteStart = false,
  onClose,
}: CreateDialogProps) {
  const navigate = useNavigate();
  const tree = useContentTree();
  const refresh = useRefreshContent();
  const allowed = useAllowedTypes(place);
  const types = allowed.data?.types ?? [];
  const [chosen, setChosen] = useState<string | undefined>();
  const [name, setName] = useState(isHome ? t("tree.createHome.name") : "");
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [inMainMenu, setInMainMenu] = useState(isUnderSiteStart);
  const canChangeMenus = useCan("navigation:update");
  const groupLabelId = useId();
  const chosenType =
    types.find((type) => type.handle === chosen) ??
    (isHome ? types.find((type) => type.structure === "tree") : undefined) ??
    types[0];

  // Pages (a page tree with addresses) can go in the main menu; the home page is its start.
  const offersMenu =
    canChangeMenus &&
    !isHome &&
    chosenType?.structure === "tree" &&
    place !== null &&
    "parentId" in place;

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
      if (offersMenu && inMainMenu) {
        // The page is made either way; a menu that can't be changed is said on the page.
        await setPageInMenu("main", created.id, { inMenu: true }).catch(() => undefined);
      }
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
  const menuHintId = useId();
  // The Name field appears once the content types have loaded, after the dialog has opened,
  // so it takes focus then, once (LINTEL-A11Y-031).
  const form = useRef<HTMLFormElement>(null);
  const hasFocusedName = useRef(false);
  const hasTypes = types.length > 0;
  useEffect(() => {
    if (!hasTypes || hasFocusedName.current) return;
    hasFocusedName.current = true;
    form.current?.querySelector<HTMLElement>("input[data-autofocus]")?.focus();
  }, [hasTypes]);
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
        ref={form}
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
        {offersMenu && (
          <div className="flex flex-col gap-1">
            <Toggle
              label={t("pageMenu.toggle")}
              checked={inMainMenu}
              onCheckedChange={setInMainMenu}
              describedBy={menuHintId}
            />
            <p id={menuHintId} className="text-caption text-label-secondary">
              {t("pageMenu.toggleHint")}
            </p>
          </div>
        )}
      </form>
    </Dialog>
  );
}

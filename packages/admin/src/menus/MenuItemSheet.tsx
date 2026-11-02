import { FileText } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { EntryPickerDialog, type PickedEntry } from "../fields/EntryPickerDialog.js";
import { t } from "../i18n/strings.js";
import type { FlatMenuItem } from "./menuTree.js";

type LinkKind = "page" | "address";

/** Web addresses, email and phone links, and addresses on this site: the API's rule. */
const safeAddressPattern = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

interface MenuItemSheetProps {
  /** The item being edited, or null for a new one. */
  item: FlatMenuItem | null;
  /** The title of the page the item links to, if it links to one. */
  linkedTitle: string | undefined;
  onSave: (item: Omit<FlatMenuItem, "depth">, picked: PickedEntry | null) => void;
  onRemove?: () => void;
  onClose: () => void;
}

/** One menu item: what it links to (a page, or a typed address), its label, and a new tab. */
export function MenuItemSheet({
  item,
  linkedTitle,
  onSave,
  onRemove,
  onClose,
}: MenuItemSheetProps) {
  const [kind, setKind] = useState<LinkKind>(item?.url ? "address" : "page");
  const [entryId, setEntryId] = useState(item?.entryId ?? null);
  const [entryTitle, setEntryTitle] = useState(linkedTitle);
  const [picked, setPicked] = useState<PickedEntry | null>(null);
  const [url, setUrl] = useState(item?.url ?? "");
  const [label, setLabel] = useState(item?.label ?? "");
  const [newTab, setNewTab] = useState(item?.newTab ?? false);
  const [isButton, setIsButton] = useState(item?.style === "button");
  const [isPicking, setIsPicking] = useState(false);
  const [problems, setProblems] = useState<{ link?: string; label?: string }>({});

  function save(event?: FormEvent) {
    event?.preventDefault();
    if (kind === "page" && !entryId) {
      setProblems({ link: t("menus.item.problem.page") });
      return;
    }
    if (kind === "address" && !safeAddressPattern.test(url.trim())) {
      setProblems({ link: t("menus.item.problem.address") });
      return;
    }
    if (kind === "address" && label.trim() === "") {
      setProblems({ label: t("menus.item.problem.label") });
      return;
    }
    onSave(
      {
        id: item?.id ?? crypto.randomUUID(),
        label: label.trim(),
        entryId: kind === "page" ? entryId : null,
        url: kind === "address" ? url.trim() : null,
        newTab,
        style: isButton ? "button" : "link",
      },
      kind === "page" ? picked : null,
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? t("menus.item.editTitle") : t("menus.item.newTitle")}
      footer={
        <>
          {onRemove && (
            <Button variant="destructive" className="me-auto" onClick={onRemove}>
              {t("menus.item.remove")}
            </Button>
          )}
          <Button variant="tinted" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => save()}>{item ? t("common.done") : t("menus.item.add")}</Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5 pt-2 pb-1">
        <SegmentedControl<LinkKind>
          label={t("menus.item.linksTo")}
          options={[
            { value: "page", label: t("menus.item.page") },
            { value: "address", label: t("menus.item.address") },
          ]}
          value={kind}
          onChange={(next) => {
            setKind(next);
            setProblems({});
          }}
        />

        {kind === "page" ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-footnote font-medium text-label">{t("menus.item.page")}</p>
            <div className="flex items-center gap-3 rounded-control bg-fill px-3 py-2">
              <FileText
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4 text-label-secondary"
              />
              <span className="min-w-0 flex-1 truncate text-body text-label">
                {entryId ? (entryTitle ?? t("menus.item.missingPage")) : t("menus.item.noPage")}
              </span>
              <Button
                variant="tinted"
                size="small"
                onClick={() => setIsPicking(true)}
                data-autofocus
              >
                {entryId ? t("menus.item.changePage") : t("menus.item.choosePage")}
              </Button>
            </div>
            {problems.link && (
              <p className="text-footnote font-medium text-danger">{problems.link}</p>
            )}
          </div>
        ) : (
          <TextField
            label={t("menus.item.address")}
            hint={t("menus.item.addressHint")}
            placeholder="https://"
            inputMode="url"
            spellCheck={false}
            value={url}
            error={problems.link}
            data-autofocus
            onChange={(event) => setUrl(event.target.value)}
          />
        )}

        <TextField
          label={t("menus.item.label")}
          hint={kind === "page" ? t("menus.item.labelHintPage") : undefined}
          placeholder={kind === "page" ? entryTitle : undefined}
          value={label}
          error={problems.label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <Toggle label={t("menus.item.newTab")} checked={newTab} onCheckedChange={setNewTab} />
        <div className="flex flex-col gap-1">
          <Toggle
            label={t("menus.item.button")}
            checked={isButton}
            onCheckedChange={setIsButton}
            describedBy="menu-item-button-hint"
          />
          <p id="menu-item-button-hint" className="text-caption text-label-secondary">
            {t("menus.item.buttonHint")}
          </p>
        </div>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>

      <EntryPickerDialog
        open={isPicking}
        title={t("menus.item.choosePage")}
        collections={[]}
        chosenIds={entryId ? [entryId] : []}
        onChoose={(entry) => {
          setEntryId(entry.id);
          setEntryTitle(entry.title);
          setPicked(entry);
          setProblems({});
          setIsPicking(false);
        }}
        onClose={() => setIsPicking(false)}
      />
    </Dialog>
  );
}

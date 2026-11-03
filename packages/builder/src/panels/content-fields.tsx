import {
  isSafeImageAddress,
  isSafeLinkAddress,
  type LinkProp,
  pageLinkHref,
  readPageLinkId,
} from "@lintel/builder-model";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { createContext, useContext, useId, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { useLinkedPage, usePickPage } from "./page-picker.js";
import { IconButton, inputClassName, Labelled } from "../ui/controls.js";

/**
 * The inputs of the Content panel, one per kind of editable field. Each reports a whole new
 * value; the panel turns that into a change with a plain label for the history.
 */

export interface PickedImage {
  assetId: string | null;
  src: string;
  alt: string;
}

/** Opens the app's media library and resolves with the chosen picture, or null if cancelled. */
export type ImagePicker = (request: {
  label: string;
  currentAssetId: string | null;
}) => Promise<PickedImage | null>;

interface FieldProps<Value> {
  label: string;
  value: Value;
  onChange: (value: Value) => void;
  placeholder?: string;
}

export function TextInputField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: FieldProps<string> & { multiline?: boolean }) {
  return (
    <Labelled label={label}>
      {(id) =>
        multiline ? (
          <textarea
            id={id}
            value={value}
            placeholder={placeholder}
            rows={3}
            onChange={(event) => onChange(event.target.value)}
            className={`${inputClassName} h-auto resize-y py-1.5`}
          />
        ) : (
          <input
            id={id}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            className={inputClassName}
          />
        )
      }
    </Labelled>
  );
}

/**
 * A link's address. "Choose a page…" links to the page itself (`lintel:page/<id>`), so the
 * link follows the page when its address changes; the page's title then shows in place of
 * the address, with a plain note if the page has since been deleted.
 */
export function LinkInputField({ label, value, onChange }: FieldProps<string>) {
  const text = useBuilderText();
  const pickPage = usePickPage();
  const [draft, setDraft] = useState(value);
  // Another element selected (or Undo): show its address, not the one typed before.
  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    setDraft(value);
  }
  const isValid = isSafeLinkAddress(draft);
  const linkedPageId = readPageLinkId(draft);

  function change(address: string) {
    setDraft(address);
    onChange(address);
  }

  async function choosePage() {
    const page = await pickPage?.();
    if (page) change(pageLinkHref(page.id));
  }

  return (
    <Labelled
      label={label}
      hint={isValid && !linkedPageId ? text("pageBuilder.content.linkHint") : undefined}
    >
      {(id) => (
        <>
          {linkedPageId ? (
            <LinkedPageInput id={id} entryId={linkedPageId} />
          ) : (
            <input
              id={id}
              value={draft}
              placeholder={text("pageBuilder.content.linkPlaceholder")}
              aria-invalid={!isValid}
              onChange={(event) => {
                setDraft(event.target.value);
                if (isSafeLinkAddress(event.target.value)) onChange(event.target.value);
              }}
              className={inputClassName}
            />
          )}
          {!isValid && (
            <span className="text-caption text-danger">
              {text("pageBuilder.content.linkInvalid")}
            </span>
          )}
          <div className="flex flex-wrap gap-x-3">
            {pickPage && (
              <ChoosePageLink onClick={() => void choosePage()}>
                {text("pageBuilder.content.choosePage")}
              </ChoosePageLink>
            )}
            {linkedPageId && (
              <ChoosePageLink onClick={() => change("")}>
                {text("pageBuilder.content.typeAddress")}
              </ChoosePageLink>
            )}
          </div>
        </>
      )}
    </Labelled>
  );
}

/** A linked page's title where its address would be, or a note that the page is gone. */
function LinkedPageInput({
  id,
  entryId,
  ariaLabel,
}: {
  id?: string;
  entryId: string;
  ariaLabel?: string;
}) {
  const text = useBuilderText();
  const page = useLinkedPage(entryId);
  const shown =
    page.state === "found"
      ? page.title || text("pageBuilder.content.untitledPage")
      : page.state === "finding"
        ? text("pageBuilder.content.findingPage")
        : page.state === "unknown"
          ? text("pageBuilder.content.chosenPage")
          : "";
  return (
    <>
      <input
        id={id}
        aria-label={ariaLabel}
        value={shown}
        readOnly
        aria-invalid={page.state === "gone" || undefined}
        className={inputClassName}
      />
      {page.state === "gone" && (
        <span className="text-caption text-danger">{text("pageBuilder.content.pageGone")}</span>
      )}
    </>
  );
}

export function ChoiceField({
  label,
  value,
  onChange,
  choices,
}: FieldProps<string> & { choices: readonly { value: string; label: string }[] }) {
  return (
    <Labelled label={label}>
      {(id) => (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName}
        >
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      )}
    </Labelled>
  );
}

/** An on/off switch with its label, drawn like the admin's Toggle (a pill with a knob). */
export function ToggleField({ label, value, onChange }: FieldProps<boolean>) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-footnote text-label">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-standard focus-visible:focus-ring ${value ? "bg-accent-fill" : "bg-fill-strong"}`}
      >
        <span
          aria-hidden="true"
          className={`size-[18px] rounded-full bg-knob shadow-thumb transition-transform duration-200 ease-standard ${value ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

/**
 * The website's address, so a picture with a site path (the built-in illustrations, at
 * /_lintel/...) shows in the panel as it does on the canvas. Null where there is none.
 */
export const PictureBaseUrlContext = createContext<string | null>(null);

/** Lintel's own pictures (the starter illustrations): served by the website, not uploaded. */
export function isBuiltInPicture(src: string): boolean {
  return src.startsWith("/_lintel/");
}

/** Where the panel loads a picture from: built-in ones from the website's address. */
export function picturePreviewSrc(src: string, baseUrl: string | null): string {
  return isBuiltInPicture(src) && baseUrl ? `${baseUrl.replace(/\/+$/, "")}${src}` : src;
}

export function ImageField({
  label,
  value,
  onChange,
  pickImage,
  labelHidden = false,
}: FieldProps<PickedImage> & { pickImage: ImagePicker | undefined; labelHidden?: boolean }) {
  const text = useBuilderText();
  const baseUrl = useContext(PictureBaseUrlContext);
  const [address, setAddress] = useState(value.src);
  // A built-in illustration's path means nothing to people: they change it with the button.
  const isBuiltIn = isBuiltInPicture(value.src) && address === value.src;
  return (
    <Labelled label={label} labelHidden={labelHidden}>
      {(id) => (
        <div className="flex flex-col gap-2">
          {value.src ? (
            <img
              src={picturePreviewSrc(value.src, baseUrl)}
              alt=""
              className="h-28 w-full rounded-control bg-fill object-cover"
            />
          ) : (
            <div className="flex h-20 items-center justify-center rounded-control bg-fill text-caption text-label-secondary">
              {text("pageBuilder.content.noPicture")}
            </div>
          )}
          {pickImage && (
            <button
              type="button"
              onClick={async () => {
                const picked = await pickImage({ label, currentAssetId: value.assetId });
                if (picked) {
                  setAddress(picked.src);
                  onChange({ ...picked, alt: picked.alt || value.alt });
                }
              }}
              className="flex h-8 items-center justify-center gap-1.5 rounded-control bg-fill text-footnote font-medium text-accent hover:bg-fill-strong focus-visible:focus-ring"
            >
              <ImagePlus aria-hidden="true" className="size-4" />
              {value.src
                ? text("pageBuilder.content.changePicture")
                : text("pageBuilder.content.choosePicture")}
            </button>
          )}
          {isBuiltIn && (
            <p className="text-caption text-label-secondary">
              {text("pageBuilder.content.builtInPicture")}
            </p>
          )}
          <input
            id={id}
            hidden={isBuiltIn}
            aria-label={text("pageBuilder.content.pictureAddress")}
            placeholder={text("pageBuilder.content.pictureAddressPlaceholder")}
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              if (isSafeImageAddress(event.target.value))
                onChange({ ...value, src: event.target.value, assetId: null });
            }}
            className={inputClassName}
          />
        </div>
      )}
    </Labelled>
  );
}

export function TextListField({
  label,
  value,
  onChange,
  itemLabel,
}: FieldProps<string[]> & { itemLabel: string }) {
  const text = useBuilderText();
  const replace = (index: number, item: string) =>
    onChange(value.map((current, at) => (at === index ? item : current)));
  const move = (index: number, by: number) => {
    const next = value.slice();
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item as string);
    onChange(next);
  };
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1 text-caption text-label-secondary">{label}</legend>
      {value.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <input
            aria-label={`${itemLabel} ${index + 1}`}
            value={item}
            onChange={(event) => replace(index, event.target.value)}
            className={inputClassName}
          />
          <IconButton
            size="small"
            icon={ArrowUp}
            label={text("pageBuilder.content.moveUp", { name: `${itemLabel} ${index + 1}` })}
            disabled={index === 0}
            onClick={() => move(index, -1)}
          />
          <IconButton
            size="small"
            icon={ArrowDown}
            label={text("pageBuilder.content.moveDown", { name: `${itemLabel} ${index + 1}` })}
            disabled={index === value.length - 1}
            onClick={() => move(index, 1)}
          />
          <IconButton
            size="small"
            icon={Trash2}
            label={text("pageBuilder.content.remove", { name: `${itemLabel} ${index + 1}` })}
            onClick={() => onChange(value.filter((_, at) => at !== index))}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, ""])}
        className="flex h-7 items-center gap-1 self-start rounded-control px-2 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring"
      >
        <Plus aria-hidden="true" className="size-3.5" />
        {text("pageBuilder.content.addItem", { name: itemLabel.toLowerCase() })}
      </button>
    </fieldset>
  );
}

export function LinkListField({ label, value, onChange }: FieldProps<LinkProp[]>) {
  const text = useBuilderText();
  const pickPage = usePickPage();
  const replace = (index: number, link: LinkProp) =>
    onChange(value.map((current, at) => (at === index ? link : current)));

  async function choosePage(index: number, link: LinkProp) {
    const page = await pickPage?.();
    if (!page) return;
    replace(index, { label: link.label || page.title, href: pageLinkHref(page.id) });
  }
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-caption text-label-secondary">{label}</legend>
      {value.map((link, index) => (
        <div key={index} className="flex items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <input
              aria-label={text("pageBuilder.content.linkWords", { number: index + 1 })}
              value={link.label}
              onChange={(event) => replace(index, { ...link, label: event.target.value })}
              className={inputClassName}
            />
            {readPageLinkId(link.href) ? (
              <LinkedPageInput
                entryId={readPageLinkId(link.href) ?? ""}
                ariaLabel={text("pageBuilder.content.linkAddress", { number: index + 1 })}
              />
            ) : (
              <input
                aria-label={text("pageBuilder.content.linkAddress", { number: index + 1 })}
                value={link.href}
                placeholder={text("pageBuilder.content.linkPlaceholder")}
                onChange={(event) =>
                  isSafeLinkAddress(event.target.value) &&
                  replace(index, { ...link, href: event.target.value })
                }
                className={inputClassName}
              />
            )}
            <div className="flex flex-wrap gap-x-3">
              {pickPage && (
                <ChoosePageLink
                  label={text("pageBuilder.content.choosePageFor", { number: index + 1 })}
                  onClick={() => void choosePage(index, link)}
                >
                  {text("pageBuilder.content.choosePage")}
                </ChoosePageLink>
              )}
              {readPageLinkId(link.href) && (
                <ChoosePageLink
                  label={text("pageBuilder.content.typeAddressFor", { number: index + 1 })}
                  onClick={() => replace(index, { ...link, href: "" })}
                >
                  {text("pageBuilder.content.typeAddress")}
                </ChoosePageLink>
              )}
            </div>
          </div>
          <IconButton
            size="small"
            icon={Trash2}
            label={text("pageBuilder.content.remove", { name: link.label || String(index + 1) })}
            onClick={() => onChange(value.filter((_, at) => at !== index))}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { label: "", href: "" }])}
        className="flex h-7 items-center gap-1 self-start rounded-control px-2 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring"
      >
        <Plus aria-hidden="true" className="size-3.5" />
        {text("pageBuilder.content.addLink")}
      </button>
    </fieldset>
  );
}

/** "Choose a page…" under a link's address: a plain text action, as the admin's are. */
function ChoosePageLink({
  label,
  onClick,
  children,
}: {
  label?: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="min-h-6 self-start rounded-control text-caption font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
    >
      {children}
    </button>
  );
}

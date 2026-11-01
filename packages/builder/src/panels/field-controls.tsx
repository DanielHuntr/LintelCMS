import type {
  DataSourceKind,
  LinkProp,
  PageNode,
  PictureProp,
  SimpleField,
} from "@lintel/builder-model";
import { useId, useMemo, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { findSiteIcon, siteIconNames } from "../render/elements/icon-set.js";
import { inputClassName, Labelled } from "../ui/controls.js";
import {
  ChoiceField,
  ImageField,
  type ImagePicker,
  LinkInputField,
  LinkListField,
  TextInputField,
  TextListField,
  ToggleField,
} from "./content-fields.js";
import { sourceChoices, useDataSources } from "./data-sources.js";

/**
 * One control for any simple field, given its value: what the Content panel and each item
 * of a list (a slide, a plan) draw. Pictures stored as objects keep their description with
 * them; the older `src` prop beside `alt` and `assetId` is handled by the Content panel.
 */
export function FieldControl({
  field,
  value,
  onChange,
  pickImage,
}: {
  field: SimpleField;
  value: unknown;
  onChange: (value: unknown) => void;
  pickImage: ImagePicker | undefined;
}) {
  switch (field.kind) {
    case "text":
    case "multilineText":
      return (
        <TextInputField
          multiline={field.kind === "multilineText"}
          label={field.label}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={onChange}
        />
      );
    case "choice":
      // Numeric props (a heading's level) are offered as text and stored as numbers again.
      return (
        <ChoiceField
          label={field.label}
          value={String(value ?? "")}
          choices={field.choices}
          onChange={(next) => onChange(typeof value === "number" ? Number(next) : next)}
        />
      );
    case "toggle":
      return <ToggleField label={field.label} value={value === true} onChange={onChange} />;
    case "link":
      return <LinkInputField label={field.label} value={String(value ?? "")} onChange={onChange} />;
    case "image":
      return typeof value === "object" && value !== null ? (
        <PictureField
          label={field.label}
          value={value as PictureProp}
          pickImage={pickImage}
          onChange={onChange}
        />
      ) : (
        <ImageField
          label={field.label}
          pickImage={pickImage}
          value={{ src: String(value ?? ""), alt: "", assetId: null }}
          onChange={(picked) => onChange(picked.src)}
        />
      );
    case "textList":
      return (
        <TextListField
          label={field.label}
          itemLabel={field.itemLabel}
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={onChange}
        />
      );
    case "linkList":
      return (
        <LinkListField
          label={field.label}
          value={Array.isArray(value) ? (value as LinkProp[]) : []}
          onChange={onChange}
        />
      );
    case "number":
      return (
        <NumberField
          field={field}
          value={typeof value === "number" ? value : 0}
          onChange={onChange}
        />
      );
    case "dateTime":
      return <DateTimeField label={field.label} value={String(value ?? "")} onChange={onChange} />;
    case "icon":
      return <IconField label={field.label} value={String(value ?? "")} onChange={onChange} />;
  }
}

/** A picture with its description, kept together as one value. */
export function PictureField({
  label,
  value,
  pickImage,
  onChange,
}: {
  label: string;
  value: PictureProp;
  pickImage: ImagePicker | undefined;
  onChange: (value: PictureProp) => void;
}) {
  const text = useBuilderText();
  return (
    <div className="flex flex-col gap-2">
      <ImageField
        label={label}
        pickImage={pickImage}
        value={value}
        onChange={(picked) =>
          onChange({ src: picked.src, alt: picked.alt || value.alt, assetId: picked.assetId })
        }
      />
      <TextInputField
        label={text("pageBuilder.content.pictureDescription")}
        value={value.alt}
        onChange={(alt) => onChange({ ...value, alt })}
      />
    </div>
  );
}

function NumberField({
  field,
  value,
  onChange,
}: {
  field: Extract<SimpleField, { kind: "number" }>;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <Labelled label={field.unit ? `${field.label} (${field.unit})` : field.label}>
      {(id) => (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            const number = Number(event.target.value);
            const inRange =
              event.target.value.trim() !== "" &&
              Number.isFinite(number) &&
              (field.min === undefined || number >= field.min) &&
              (field.max === undefined || number <= field.max);
            if (inRange) onChange(number);
          }}
          className={inputClassName}
        />
      )}
    </Labelled>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Labelled label={label}>
      {(id) => (
        <input
          id={id}
          type="datetime-local"
          value={value.slice(0, 16)}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName}
        />
      )}
    </Labelled>
  );
}

/**
 * The bundled icons as a searchable group of radio buttons: arrow keys move between them,
 * and each is announced by its name.
 */
function IconField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const text = useBuilderText();
  const [search, setSearch] = useState("");
  const name = useId();
  const shown = useMemo(() => {
    const words = search.trim().toLowerCase();
    return ["", ...siteIconNames.filter((icon) => icon.includes(words))].slice(0, words ? 60 : 200);
  }, [search]);
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1 text-caption text-label-secondary">{label}</legend>
      <input
        type="search"
        aria-label={text("pageBuilder.content.findIcon")}
        placeholder={text("pageBuilder.content.findIcon")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className={inputClassName}
      />
      <p className="sr-only" aria-live="polite">
        {text("pageBuilder.content.iconsFound", { count: shown.length - 1 })}
      </p>
      <div className="grid max-h-40 grid-cols-7 gap-1 overflow-y-auto rounded-control bg-fill p-1">
        {shown.map((icon) => {
          const Icon = findSiteIcon(icon);
          return (
            <label
              key={icon || "none"}
              title={icon || text("pageBuilder.content.noIcon")}
              className="relative flex size-8 cursor-pointer items-center justify-center rounded-control text-label-secondary hover:bg-fill-strong has-[:checked]:bg-accent-fill has-[:checked]:text-on-accent has-[:focus-visible]:focus-ring"
            >
              <input
                type="radio"
                name={name}
                value={icon}
                checked={value === icon}
                onChange={() => onChange(icon)}
                aria-label={icon ? icon.replace(/-/g, " ") : text("pageBuilder.content.noIcon")}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              {Icon ? (
                <Icon aria-hidden="true" className="size-4" />
              ) : (
                <span aria-hidden="true">∅</span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * One of the site's collections, forms or products. With nothing to list (the app passed
 * no data, or the plugin is off) it is a text box for the handle.
 */
export function SourceField({
  label,
  source,
  dependsOn,
  node,
  value,
  onChange,
}: {
  label: string;
  source: DataSourceKind;
  dependsOn: string | undefined;
  node: PageNode;
  value: string;
  onChange: (value: string) => void;
}) {
  const text = useBuilderText();
  const sources = useDataSources();
  const choices = sourceChoices(sources, source, node, dependsOn);
  const withShop =
    node.type === "page" && sources.products.length > 0
      ? [...choices, { value: "shop:products", label: text("pageBuilder.content.shopProducts") }]
      : choices;
  if (withShop.length === 0) {
    return (
      <TextInputField
        label={label}
        value={value}
        placeholder={text("pageBuilder.content.sourceHandle", {
          example: source === "terms" ? "categories/news" : "blog",
        })}
        onChange={onChange}
      />
    );
  }
  const known = withShop.some((choice) => choice.value === value);
  return (
    <ChoiceField
      label={label}
      value={value}
      choices={[
        { value: "", label: text("pageBuilder.content.choose") },
        ...withShop,
        ...(known || value === "" ? [] : [{ value, label: value }]),
      ]}
      onChange={onChange}
    />
  );
}

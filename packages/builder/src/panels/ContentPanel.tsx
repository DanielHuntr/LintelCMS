import {
  type AnyComponentDefinition,
  type CodeImage,
  type EditableField,
  findCodeMarkers,
  type PageDocument,
  type PageFont,
  type PageNode,
} from "@lintel/builder-model";
import { useMemo } from "react";
import { blockBindableFields } from "../blocks/block-commands.js";
import { useBlockMaster } from "../blocks/blocks-context.js";
import { readMarks } from "../editor/design-commands.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { MarkableTextField } from "../inline-text/MarkableTextField.js";
import { markableTypes } from "../inline-text/SelectedWordsBar.js";
import type { MarkChange } from "../inline-text/TextStyleBar.js";
import { usePreferenceStore } from "../preferences/builder-preferences.js";
import { useRememberedOpenSections } from "../preferences/open-sections.js";
import { OpenSectionsContext } from "../ui/CollapsibleSection.js";
import { PanelSection } from "../ui/controls.js";
import { contentGroupSummary, fieldsShownTogether, groupContentFields } from "./content-groups.js";
import { ImageField, type ImagePicker, TextInputField, ToggleField } from "./content-fields.js";
import { type BindingScope, findBindingScope, useDataSources } from "./data-sources.js";
import { FieldControl, SourceField } from "./field-controls.js";
import { BindingPicker, ItemListField } from "./item-list-field.js";
import { MenuSection } from "../menus/menu-editing.js";

interface ContentPanelProps {
  node: PageNode;
  definition: AnyComponentDefinition | undefined;
  isLocked: boolean;
  pickImage: ImagePicker | undefined;
  onChange: (props: Record<string, unknown>, label: string) => void;
  /** The page, to find the collection list (or item page) an element shows entries of. */
  document?: PageDocument;
  /** Shows a field of each entry in a prop (`null`: type it in again). */
  onBind?: (prop: string, fieldPath: string | null, label: string) => void;
  /** Styles part of the text (headings and paragraphs). */
  onMarkText?: (
    range: { from: number; to: number; text: string },
    styles: MarkChange | null,
    label: string,
  ) => void;
  pageFonts?: readonly PageFont[];
}

/**
 * What the selected element says and shows: its text, link, picture... A code block shows the
 * parts its developer marked as editable instead, so nobody needs to read its code.
 */
export function ContentPanel({
  node,
  definition,
  isLocked,
  pickImage,
  onChange,
  document,
  onBind,
  onMarkText,
  pageFonts = [],
}: ContentPanelProps) {
  const text = useBuilderText();
  const sources = useDataSources();
  const master = useBlockMaster();
  // In a block's design, elements show the block's properties rather than an entry's fields.
  const scope = useMemo<BindingScope | null>(
    () =>
      master
        ? master.isReadOnly
          ? null
          : {
              kind: "block",
              fields: blockBindableFields(master.block.properties),
              name: text("pageBuilder.content.bind.blockScope"),
            }
        : document
          ? findBindingScope(document, node.id, sources)
          : null,
    [master, document, node.id, sources, text],
  );
  const fields = definition?.editableFields ?? [];
  const isCode = node.type === "codeBlock";
  const store = usePreferenceStore();
  const openGroups = useRememberedOpenSections(store, "content.open", [
    "source",
    "words",
    "picture",
  ]);
  const groups = useMemo(() => groupContentFields(definition?.editableFields ?? []), [definition]);
  const isGrouped = !isCode && fields.length > fieldsShownTogether && groups.length > 1;
  const groupSections = useMemo(
    () => ({ ...openGroups, isContentDisabled: isLocked }),
    [openGroups, isLocked],
  );

  if (!isCode && fields.length === 0) {
    return (
      <p className="px-4 py-6 text-footnote text-label-secondary">
        {text("pageBuilder.content.nothingToEdit", { name: definition?.label ?? node.type })}
      </p>
    );
  }
  return (
    <fieldset disabled={isLocked && !isGrouped} className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">{text("pageBuilder.content.legend")}</legend>
      {isLocked && (
        <p className="px-4 pt-3 text-caption text-warning">
          {text("pageBuilder.style.lockedNote")}
        </p>
      )}
      <MenuSection node={node} isLocked={isLocked} onChange={onChange} />
      {isGrouped ? (
        <OpenSectionsContext.Provider value={groupSections}>
          <h2 className="px-4 pt-3 pb-1 text-footnote font-semibold text-label">
            {definition?.label ?? node.type}
          </h2>
          {groups.map((group) => (
            <PanelSection
              key={group.id}
              title={text(group.title)}
              sectionId={group.id}
              summary={contentGroupSummary(group, node, text)}
            >
              {group.fields.map((field) => (
                <ContentField
                  key={field.prop}
                  field={field}
                  node={node}
                  pickImage={pickImage}
                  onChange={onChange}
                  scope={scope}
                  onBind={onBind}
                  onMarkText={onMarkText}
                  pageFonts={pageFonts}
                />
              ))}
            </PanelSection>
          ))}
        </OpenSectionsContext.Provider>
      ) : (
        <PanelSection title={definition?.label ?? node.type}>
          {isCode ? (
            <CodeMarkerFields node={node} pickImage={pickImage} onChange={onChange} />
          ) : (
            fields.map((field) => (
              <ContentField
                key={field.prop}
                field={field}
                node={node}
                pickImage={pickImage}
                onChange={onChange}
                scope={scope}
                onBind={onBind}
                onMarkText={onMarkText}
                pageFonts={pageFonts}
              />
            ))
          )}
        </PanelSection>
      )}
    </fieldset>
  );
}

function ContentField({
  field,
  node,
  pickImage,
  onChange,
  scope,
  onBind,
  onMarkText,
  pageFonts,
}: {
  field: EditableField;
  node: PageNode;
  pickImage: ImagePicker | undefined;
  onChange: ContentPanelProps["onChange"];
  scope: BindingScope | null;
  onBind: ContentPanelProps["onBind"];
  onMarkText: ContentPanelProps["onMarkText"];
  pageFonts: readonly PageFont[];
}) {
  const value = node.props[field.prop];
  const set = (next: unknown) => onChange({ [field.prop]: next }, field.label);
  const boundTo = node.bindings?.[field.prop];
  const binding =
    scope && onBind ? (
      <BindingPicker
        field={field}
        scope={scope}
        boundTo={boundTo}
        onChange={(path) => onBind(field.prop, path, field.label)}
      />
    ) : null;
  if (boundTo && binding) return binding;
  if (node.type === "image" && field.prop === "showCredit") {
    return <PhotoCreditSwitch node={node} label={field.label} onChange={set} />;
  }
  // Typed text that isn't bound to an entry's field can have styled words.
  if (field.prop === "text" && onMarkText && markableTypes.includes(node.type)) {
    const markable = (
      <MarkableTextField
        label={field.label}
        value={String(value ?? "")}
        marks={readMarks(node)}
        pageFonts={pageFonts}
        onChange={set}
        onMark={onMarkText}
      />
    );
    return binding ? (
      <div className="flex flex-col gap-2">
        {binding}
        {markable}
      </div>
    ) : (
      markable
    );
  }
  const control = (() => {
    switch (field.kind) {
      case "itemList":
        return (
          <ItemListField
            field={field}
            value={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
            pickImage={pickImage}
            onChange={set}
          />
        );
      case "source":
        return (
          <SourceField
            label={field.label}
            source={field.source}
            dependsOn={field.dependsOn}
            node={node}
            value={String(value ?? "")}
            onChange={set}
          />
        );
      case "image":
        // A picture kept as `src` with `alt` and `assetId` beside it, as Picture keeps it.
        if (field.prop === "src") {
          return (
            <ImageField
              label={field.label}
              pickImage={pickImage}
              value={{
                src: String(value ?? ""),
                alt: String(node.props.alt ?? ""),
                assetId: (node.props.assetId as string | null) ?? null,
              }}
              onChange={(picked) =>
                onChange(
                  { [field.prop]: picked.src, assetId: picked.assetId, alt: picked.alt },
                  field.label,
                )
              }
            />
          );
        }
        return <FieldControl field={field} value={value} pickImage={pickImage} onChange={set} />;
      default:
        return <FieldControl field={field} value={value} pickImage={pickImage} onChange={set} />;
    }
  })();
  return binding ? (
    <div className="flex flex-col gap-2">
      {binding}
      {control}
    </div>
  ) : (
    control
  );
}

function CodeMarkerFields({
  node,
  pickImage,
  onChange,
}: {
  node: PageNode;
  pickImage: ImagePicker | undefined;
  onChange: ContentPanelProps["onChange"];
}) {
  const text = useBuilderText();
  const html = typeof node.props.html === "string" ? node.props.html : "";
  const markers = useMemo(() => findCodeMarkers(html), [html]);
  const fields = (node.props.fields ?? {}) as Record<string, string>;
  const images = (node.props.images ?? {}) as Record<string, CodeImage>;

  if (markers.length === 0) {
    return (
      <p className="text-footnote text-label-secondary">
        {text("pageBuilder.content.codeNoMarkers")}
      </p>
    );
  }
  return (
    <>
      <p className="text-caption text-label-secondary">{text("pageBuilder.content.codeHint")}</p>
      {markers.map((marker) =>
        marker.kind === "field" ? (
          <TextInputField
            key={`field:${marker.name}`}
            multiline={marker.defaultText.length > 60}
            label={humanise(marker.name)}
            value={fields[marker.name] ?? marker.defaultText}
            onChange={(value) =>
              onChange({ fields: { ...fields, [marker.name]: value } }, humanise(marker.name))
            }
          />
        ) : (
          <ImageField
            key={`image:${marker.name}`}
            label={humanise(marker.name)}
            pickImage={pickImage}
            value={
              images[marker.name] ?? marker.defaultImage ?? { src: "", alt: "", assetId: null }
            }
            onChange={(picked) =>
              onChange({ images: { ...images, [marker.name]: picked } }, humanise(marker.name))
            }
          />
        ),
      )}
    </>
  );
}

/** "hero_heading" or "heroHeading" reads as "Hero heading". */
function humanise(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * "Show the photo credit" on a Picture: only there when the picture has a credit to show
 * (its licence asks for one, or one was typed), on unless someone turned it off. Turned off,
 * it says why the credit matters.
 */
function PhotoCreditSwitch({
  node,
  label,
  onChange,
}: {
  node: PageNode;
  label: string;
  onChange: (value: boolean) => void;
}) {
  const text = useBuilderText();
  const sources = useDataSources();
  const assetId = typeof node.props.assetId === "string" ? node.props.assetId : null;
  const credit = assetId ? sources.photoCredits?.[assetId] : undefined;
  if (!credit) return null;
  const isOn = node.props.showCredit !== false;
  return (
    <div className="flex flex-col gap-1">
      <ToggleField label={label} value={isOn} onChange={onChange} />
      <p className="text-caption text-label-secondary">
        {isOn
          ? text("pageBuilder.content.creditShown", { credit: credit.text })
          : text("pageBuilder.content.creditHidden")}
      </p>
    </div>
  );
}

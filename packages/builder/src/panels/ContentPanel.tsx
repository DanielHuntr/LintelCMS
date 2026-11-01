import {
  type AnyComponentDefinition,
  type CodeImage,
  type EditableField,
  findCodeMarkers,
  type LinkProp,
  type PageFont,
  type PageNode,
} from "@lintel/builder-model";
import { useMemo } from "react";
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

interface ContentPanelProps {
  node: PageNode;
  definition: AnyComponentDefinition | undefined;
  isLocked: boolean;
  pickImage: ImagePicker | undefined;
  onChange: (props: Record<string, unknown>, label: string) => void;
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
  onMarkText,
  pageFonts = [],
}: ContentPanelProps) {
  const text = useBuilderText();
  const fields = definition?.editableFields ?? [];
  const isCode = node.type === "codeBlock";
  const store = usePreferenceStore();
  const openGroups = useRememberedOpenSections(store, "content.open", ["words", "picture"]);
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
  onMarkText,
  pageFonts,
}: {
  field: EditableField;
  node: PageNode;
  pickImage: ImagePicker | undefined;
  onChange: ContentPanelProps["onChange"];
  onMarkText: ContentPanelProps["onMarkText"];
  pageFonts: readonly PageFont[];
}) {
  const value = node.props[field.prop];
  const set = (next: unknown) => onChange({ [field.prop]: next }, field.label);
  if (field.prop === "text" && onMarkText && markableTypes.includes(node.type)) {
    return (
      <MarkableTextField
        label={field.label}
        value={String(value ?? "")}
        marks={readMarks(node)}
        pageFonts={pageFonts}
        onChange={set}
        onMark={onMarkText}
      />
    );
  }
  switch (field.kind) {
    case "text":
      return (
        <TextInputField
          label={field.label}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={set}
        />
      );
    case "multilineText":
      return (
        <TextInputField
          multiline
          label={field.label}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={set}
        />
      );
    case "choice":
      // Numeric props (a heading's level) are offered as text and stored as numbers again.
      return (
        <ChoiceField
          label={field.label}
          value={String(value ?? "")}
          choices={field.choices}
          onChange={(next) => set(typeof value === "number" ? Number(next) : next)}
        />
      );
    case "toggle":
      return <ToggleField label={field.label} value={value === true} onChange={set} />;
    case "link":
      return <LinkInputField label={field.label} value={String(value ?? "")} onChange={set} />;
    case "image":
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
    case "textList":
      return (
        <TextListField
          label={field.label}
          itemLabel={field.itemLabel}
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={set}
        />
      );
    case "linkList":
      return (
        <LinkListField
          label={field.label}
          value={Array.isArray(value) ? (value as LinkProp[]) : []}
          onChange={set}
        />
      );
  }
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

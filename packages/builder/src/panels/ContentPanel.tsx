import {
  type AnyComponentDefinition,
  type CodeImage,
  type EditableField,
  findCodeMarkers,
  type LinkProp,
  type PageNode,
} from "@lintel/builder-model";
import { useMemo } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { PanelSection } from "../ui/controls.js";
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
}: ContentPanelProps) {
  const text = useBuilderText();
  const fields = definition?.editableFields ?? [];
  const isCode = node.type === "codeBlock";

  if (!isCode && fields.length === 0) {
    return (
      <p className="px-4 py-6 text-footnote text-label-secondary">
        {text("pageBuilder.content.nothingToEdit", { name: definition?.label ?? node.type })}
      </p>
    );
  }
  return (
    <fieldset disabled={isLocked} className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">{text("pageBuilder.content.legend")}</legend>
      {isLocked && (
        <p className="px-4 pt-3 text-caption text-warning">
          {text("pageBuilder.style.lockedNote")}
        </p>
      )}
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
            />
          ))
        )}
      </PanelSection>
    </fieldset>
  );
}

function ContentField({
  field,
  node,
  pickImage,
  onChange,
}: {
  field: EditableField;
  node: PageNode;
  pickImage: ImagePicker | undefined;
  onChange: ContentPanelProps["onChange"];
}) {
  const value = node.props[field.prop];
  const set = (next: unknown) => onChange({ [field.prop]: next }, field.label);
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

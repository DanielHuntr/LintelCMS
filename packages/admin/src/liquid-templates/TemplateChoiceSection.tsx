import { PanelSection } from "../content/PanelSection.js";
import { SelectField } from "../design/SelectField.js";
import { t } from "../i18n/strings.js";
import { useLiquidTemplates } from "./liquidTemplates.queries.js";

/** Where the choice is kept in the entry's values (core's liquid-templates/template-choice.ts). */
export const TEMPLATE_CHOICE_KEY = "_template";
const DESIGNED = "designed";
/** The select's value for "the collection's own", which is stored as no choice at all. */
const COLLECTION_DEFAULT = "";

interface TemplateChoiceSectionProps {
  collection: { handle: string; name: string };
  /** The stored choice: a template's name, "designed", or nothing for the collection's. */
  value: unknown;
  onChange: (value: string | null) => void;
}

/**
 * "Template" in the editor's side panel: which template draws this page on the website.
 * Shown only when the install has Liquid templates; otherwise every page uses the built-in
 * template and there is nothing to choose.
 */
export function TemplateChoiceSection({ collection, value, onChange }: TemplateChoiceSectionProps) {
  const templates = useLiquidTemplates();
  const list = templates.data?.templates ?? [];
  if (list.length === 0) return null;

  const own = list.find((template) => template.collectionHandle === collection.handle);
  const options = [
    {
      value: COLLECTION_DEFAULT,
      label: own
        ? t("liquidTemplates.collectionDefault", { collection: collection.name })
        : t("liquidTemplates.builtInDefault", { collection: collection.name }),
    },
    { value: DESIGNED, label: t("liquidTemplates.designed") },
    ...list
      .filter((template) => template !== own)
      .map((template) => ({ value: template.name, label: nameInWords(template.name) })),
  ];
  const current = typeof value === "string" ? value : COLLECTION_DEFAULT;
  // A template that has since been deleted still shows, so the choice isn't silently lost.
  if (!options.some((option) => option.value === current)) {
    options.push({ value: current, label: nameInWords(current) });
  }

  return (
    <PanelSection
      title={t("liquidTemplates.heading")}
      value={options.find((option) => option.value === current)?.label}
    >
      <SelectField
        label={t("liquidTemplates.label")}
        hint={t("liquidTemplates.hint")}
        options={options}
        value={current}
        onValueChange={(chosen) => onChange(chosen === COLLECTION_DEFAULT ? null : chosen)}
      />
    </PanelSection>
  );
}

/** "pages/wide-photo" as "Pages / Wide photo": file names read as words. */
export function nameInWords(name: string): string {
  return name
    .split("/")
    .map((part) => {
      const words = part.replace(/[-_]+/g, " ").trim();
      return words.charAt(0).toUpperCase() + words.slice(1);
    })
    .join(" / ");
}

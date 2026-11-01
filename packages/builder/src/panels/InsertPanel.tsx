import {
  type AnyComponentDefinition,
  type ComponentCatalogue,
  componentCategories,
  type ComponentCategory,
  sectionCategories,
  type SectionCategory,
  type SectionTemplate,
} from "@lintel/builder-model";
import type { DragEvent } from "react";
import type { BuilderStringKey } from "../i18n/builder-strings.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { ComponentIcon } from "../ui/component-icons.js";
import { BlueprintSketch } from "./BlueprintSketch.js";
import { insertDragType } from "./layer-drop.js";

/** What the Insert panel offers: `component:heading` or `template:hero`. */
export type InsertKey = `component:${string}` | `template:${string}`;

interface InsertPanelProps {
  catalogue: ComponentCatalogue;
  templates: readonly SectionTemplate[];
  canEditCode: boolean;
  onInsert: (key: InsertKey) => void;
}

const sectionCategoryTitles: Record<SectionCategory, BuilderStringKey> = {
  hero: "pageBuilder.insert.sectionCategory.hero",
  features: "pageBuilder.insert.sectionCategory.features",
  story: "pageBuilder.insert.sectionCategory.story",
  testimonials: "pageBuilder.insert.sectionCategory.testimonials",
  pricing: "pageBuilder.insert.sectionCategory.pricing",
  questions: "pageBuilder.insert.sectionCategory.questions",
  callToAction: "pageBuilder.insert.sectionCategory.callToAction",
  contact: "pageBuilder.insert.sectionCategory.contact",
  footer: "pageBuilder.insert.sectionCategory.footer",
};

const categoryTitles: Record<ComponentCategory, BuilderStringKey> = {
  blocks: "pageBuilder.insert.category.blocks",
  layout: "pageBuilder.insert.category.layout",
  text: "pageBuilder.insert.category.text",
  media: "pageBuilder.insert.category.media",
  navigation: "pageBuilder.insert.category.navigation",
  code: "pageBuilder.insert.category.code",
};

/**
 * Ready-made sections, then single elements by kind, each with a plain description. Press one
 * to add it after the selected element (or inside it, when it holds elements), or drag it
 * into the Layers panel to put it exactly where you want.
 */
export function InsertPanel({ catalogue, templates, canEditCode, onInsert }: InsertPanelProps) {
  const text = useBuilderText();
  const insertable = catalogue.definitions.filter(
    (definition) =>
      !definition.hiddenFromInsert && (canEditCode || !definition.requiresCodePermission),
  );

  const startDrag = (event: DragEvent, key: InsertKey, type: string) => {
    event.dataTransfer.setData(insertDragType, key);
    event.dataTransfer.setData(`${insertDragType}+${type.toLowerCase()}`, "");
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      <p className="text-caption text-label-secondary">{text("pageBuilder.insert.hint")}</p>
      <section aria-labelledby="lintel-insert-sections" className="flex flex-col gap-2">
        <h3 id="lintel-insert-sections" className="text-footnote font-semibold text-label">
          {text("pageBuilder.insert.sections")}
        </h3>
        {sectionCategories.map((category) => {
          const inCategory = templates.filter((template) => template.category === category);
          if (inCategory.length === 0) return null;
          return (
            <div key={category} className="flex flex-col gap-1">
              <h4 className="pt-1 text-caption font-semibold tracking-wide text-label-secondary uppercase">
                {text(sectionCategoryTitles[category])}
              </h4>
              <ul className="grid grid-cols-1 gap-2">
                {inCategory.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) =>
                        startDrag(event, `template:${template.id}`, template.blueprint.type)
                      }
                      onClick={() => onInsert(`template:${template.id}`)}
                      className="flex w-full flex-col gap-1.5 rounded-card p-2 text-left transition-colors duration-150 hover:bg-fill focus-visible:focus-ring"
                    >
                      <BlueprintSketch blueprint={template.blueprint} />
                      <span className="text-footnote font-medium text-label">{template.label}</span>
                      <span className="text-caption text-label-secondary">
                        {template.description}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
      {componentCategories.map((category) => {
        const definitions = insertable.filter((definition) => definition.category === category);
        if (definitions.length === 0) return null;
        return (
          <section
            key={category}
            aria-labelledby={`lintel-insert-${category}`}
            className="flex flex-col gap-1"
          >
            <h3 id={`lintel-insert-${category}`} className="text-footnote font-semibold text-label">
              {text(categoryTitles[category])}
            </h3>
            <ul className="flex flex-col">
              {definitions.map((definition) => (
                <li key={definition.type}>
                  <ComponentButton
                    definition={definition}
                    onInsert={onInsert}
                    onDragStart={startDrag}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ComponentButton({
  definition,
  onInsert,
  onDragStart,
}: {
  definition: AnyComponentDefinition;
  onInsert: (key: InsertKey) => void;
  onDragStart: (event: DragEvent, key: InsertKey, type: string) => void;
}) {
  const key: InsertKey = `component:${definition.type}`;
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => onDragStart(event, key, definition.type)}
      onClick={() => onInsert(key)}
      className="flex w-full items-start gap-3 rounded-control px-2 py-2 text-left transition-colors duration-150 hover:bg-fill focus-visible:focus-ring"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-fill text-label-secondary">
        <ComponentIcon name={definition.icon} className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-footnote font-medium text-label">{definition.label}</span>
        <span className="text-caption text-label-secondary">{definition.description}</span>
      </span>
    </button>
  );
}

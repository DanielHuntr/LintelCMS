import {
  effectCategories,
  effectRegistry,
  type EffectCategory,
  type EffectDefinition,
  type EffectRegistry,
  type ElementKind,
} from "@lintel/motion/effects";
import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Checkbox, controlClasses, Select } from "../controls/Field.js";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { useTranslate } from "../strings/translate.js";
import { EffectCard } from "./EffectCard.js";

type CategoryFilter = EffectCategory | "all";

export const effectCategoryLabels: Record<CategoryFilter, MotionEditorStringKey> = {
  all: "motionEditor.category.allEffects",
  text: "motionEditor.category.text",
  hover: "motionEditor.category.hoverEffects",
  scroll: "motionEditor.category.scrollEffects",
  canvas: "motionEditor.category.canvas",
  depth: "motionEditor.category.depth",
  transitions: "motionEditor.category.transitions",
  physics: "motionEditor.category.physics",
  cursor: "motionEditor.category.cursor",
  marquee: "motionEditor.category.marquee",
  loaders: "motionEditor.category.loaders",
  svg: "motionEditor.category.svg",
};

export interface EffectsGalleryProps {
  /** The kind of the selected element, for "Suits this element". "any" turns the filter off. */
  elementKind: ElementKind;
  addedIds: ReadonlySet<string>;
  onApply: (definition: EffectDefinition) => void;
  onTry?: (definition: EffectDefinition | null) => void;
  registry?: EffectRegistry;
  moduleAddresses?: Readonly<Record<string, string>>;
}

/** Every effect, filtered by kind, by a search and by what suits the selected element. */
export function EffectsGallery({
  elementKind,
  addedIds,
  onApply,
  onTry,
  registry = effectRegistry,
  moduleAddresses,
}: EffectsGalleryProps) {
  const t = useTranslate();
  const searchId = useId();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [suitsOnly, setSuitsOnly] = useState(elementKind !== "any");

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase();
    const candidates = suitsOnly ? registry.suiting(elementKind) : registry.all();
    return candidates.filter(
      (definition) =>
        (category === "all" || definition.category === category) &&
        (words === "" ||
          `${definition.name} ${definition.description} ${(definition.keywords ?? []).join(" ")}`
            .toLowerCase()
            .includes(words)),
    );
  }, [registry, elementKind, suitsOnly, category, search]);

  return (
    <section aria-label={t("motionEditor.effects.add")} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Select
          label={t("motionEditor.effects.categoryLabel")}
          options={(["all", ...effectCategories] as CategoryFilter[]).map((value) => ({
            value,
            label: t(effectCategoryLabels[value]),
          }))}
          value={category}
          onChange={(event) => setCategory(event.target.value as CategoryFilter)}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor={searchId} className="text-caption font-medium text-label-secondary">
            {t("motionEditor.effects.search")}
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-2 inset-s-2.5 size-4 text-label-tertiary"
            />
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${controlClasses} ps-8`}
            />
          </div>
        </div>
      </div>
      {elementKind !== "any" && (
        <Checkbox
          label={t("motionEditor.effects.suitsOnly")}
          checked={suitsOnly}
          onChange={setSuitsOnly}
        />
      )}
      <p aria-live="polite" className="sr-only">
        {t("motionEditor.effects.count", { count: shown.length })}
      </p>
      {shown.length === 0 ? (
        <p className="rounded-card bg-surface p-6 text-center text-footnote text-label-secondary">
          {t("motionEditor.effects.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
          {shown.map((definition) => (
            <EffectCard
              key={definition.id}
              definition={definition}
              added={addedIds.has(definition.id)}
              moduleAddresses={moduleAddresses}
              onApply={onApply}
              onTry={onTry}
            />
          ))}
        </div>
      )}
    </section>
  );
}

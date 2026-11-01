import { motionPresets, type MotionPreset, type PresetCategory } from "@lintel/motion/presets";
import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { controlClasses } from "../controls/Field.js";
import { SegmentedControl } from "../controls/SegmentedControl.js";
import { useTranslate } from "../strings/translate.js";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { PresetCard } from "./PresetCard.js";

type CategoryFilter = PresetCategory | "all";

const categoryLabels: Record<CategoryFilter, MotionEditorStringKey> = {
  all: "motionEditor.category.all",
  entrance: "motionEditor.category.entrance",
  scroll: "motionEditor.category.scroll",
  hover: "motionEditor.category.hover",
  attention: "motionEditor.category.attention",
  transition: "motionEditor.category.transition",
};

interface PresetGalleryProps {
  selectedId: string | undefined;
  onSelect: (preset: MotionPreset) => void;
  presets?: readonly MotionPreset[];
}

/** Every ready-made animation, filtered by kind or by a search, each with a live preview. */
export function PresetGallery({
  selectedId,
  onSelect,
  presets = motionPresets,
}: PresetGalleryProps) {
  const t = useTranslate();
  const searchId = useId();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase();
    return presets.filter(
      (preset) =>
        (category === "all" || preset.category === category) &&
        (words === "" || `${preset.name} ${preset.description}`.toLowerCase().includes(words)),
    );
  }, [presets, category, search]);

  const options = (Object.keys(categoryLabels) as CategoryFilter[]).map((value) => ({
    value,
    label: t(categoryLabels[value]),
  }));

  return (
    <section aria-label={t("motionEditor.gallery.title")} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label={t("motionEditor.gallery.categoryLabel")}
          options={options}
          value={category}
          onChange={setCategory}
        />
        <div className="relative ms-auto w-56">
          <label htmlFor={searchId} className="sr-only">
            {t("motionEditor.gallery.search")}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-2 inset-s-2.5 size-4 text-label-tertiary"
          />
          <input
            id={searchId}
            type="search"
            value={search}
            placeholder={t("motionEditor.gallery.search")}
            onChange={(event) => setSearch(event.target.value)}
            className={`${controlClasses} ps-8`}
          />
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {t("motionEditor.gallery.count", { count: shown.length })}
      </p>
      {shown.length === 0 ? (
        <p className="rounded-card bg-surface p-6 text-center text-footnote text-label-secondary">
          {t("motionEditor.gallery.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
          {shown.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              selected={preset.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}

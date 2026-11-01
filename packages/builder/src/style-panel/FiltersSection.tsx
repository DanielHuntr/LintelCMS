import {
  type FilterName,
  filterValue,
  neutralFilterValues,
  parseFilters,
  type StylePropertyName,
} from "@lintel/builder-model";
import { useBuilderText } from "../i18n/builder-text.js";
import { Labelled, PanelSection } from "../ui/controls.js";
import { blendModeChoices } from "./BackgroundSection.js";
import { useStyleField, useStyleReader } from "./style-field.js";
import { StyleChips, StyleSelect, StyleTextInput } from "./StyleInputs.js";

/** One-tap looks for pictures, as Simple offers them. */
const looks = {
  blackAndWhite: "grayscale(100%)",
  faded: "grayscale(40%) brightness(110%) contrast(90%)",
  vivid: "contrast(120%) saturate(140%)",
  blurred: "blur(6px)",
} as const;

interface SliderSpec {
  name: Exclude<FilterName, "drop-shadow">;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const sliders: readonly SliderSpec[] = [
  { name: "blur", min: 0, max: 40, step: 1, unit: "px" },
  { name: "grayscale", min: 0, max: 100, step: 5, unit: "%" },
  { name: "brightness", min: 0, max: 200, step: 5, unit: "%" },
  { name: "contrast", min: 0, max: 200, step: 5, unit: "%" },
  { name: "saturate", min: 0, max: 300, step: 10, unit: "%" },
  { name: "hue-rotate", min: 0, max: 360, step: 5, unit: "deg" },
];

/**
 * How an element mixes with what's behind it (blend modes) and photo-style filters on it or
 * on what shows through it (frosted glass). Simple has a few ready-made looks; Advanced has
 * the blend mode, each filter as a slider, a drop shadow that follows the shape, and
 * blurring what's behind.
 */
export function FiltersSection({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const read = useStyleReader();
  const summary = [
    read("mixBlendMode"),
    read("filter") && text("pageBuilder.design.summary.filtered"),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <PanelSection title={text("pageBuilder.design.filters")} sectionId="filters" summary={summary}>
      <StyleChips
        properties={["filter"]}
        label={text("pageBuilder.design.look")}
        choices={[
          { value: undefined, label: text("pageBuilder.style.none") },
          { value: looks.blackAndWhite, label: text("pageBuilder.design.look.blackAndWhite") },
          { value: looks.faded, label: text("pageBuilder.design.look.faded") },
          { value: looks.vivid, label: text("pageBuilder.design.look.vivid") },
          { value: looks.blurred, label: text("pageBuilder.design.look.blurred") },
        ]}
      />
      {advanced && (
        <>
          <StyleSelect
            property="mixBlendMode"
            label={text("pageBuilder.design.blend")}
            choices={blendModeChoices(text)}
          />
          <FilterSliders property="filter" />
          <StyleTextInput
            property="filter"
            label={text("pageBuilder.design.filterExact")}
            placeholder="drop-shadow(0 8px 16px rgb(0 0 0 / 0.3))"
          />
          <FilterSlider
            property="backdropFilter"
            spec={{ name: "blur", min: 0, max: 40, step: 1, unit: "px" }}
            label={text("pageBuilder.design.backdropBlur")}
          />
          <StyleSelect
            property="isolation"
            label={text("pageBuilder.design.isolation")}
            choices={[
              { value: "isolate", label: text("pageBuilder.design.isolationOn") },
              { value: "auto", label: text("pageBuilder.design.isolationOff") },
            ]}
          />
        </>
      )}
    </PanelSection>
  );
}

function FilterSliders({ property }: { property: StylePropertyName }) {
  const text = useBuilderText();
  return (
    <>
      {sliders.map((spec) => (
        <FilterSlider
          key={spec.name}
          property={property}
          spec={spec}
          label={text(`pageBuilder.design.filter.${spec.name}`)}
        />
      ))}
    </>
  );
}

/** One filter function as a slider, keeping the others in the same property as they are. */
function FilterSlider({
  property,
  spec,
  label,
}: {
  property: StylePropertyName;
  spec: SliderSpec;
  label: string;
}) {
  const field = useStyleField(property, label);
  const filters = parseFilters(field.value);
  if (!filters) return null;
  const neutral = Number.parseFloat(neutralFilterValues[spec.name]);
  const parsed = Number.parseFloat(filters[spec.name] ?? "");
  const value = Number.isFinite(parsed) ? parsed : neutral;
  return (
    <Labelled label={label}>
      {(id) => (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="range"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={value}
            aria-valuetext={`${value}${spec.unit}`}
            onChange={(event) =>
              field.set(
                filterValue({ ...filters, [spec.name]: `${event.target.value}${spec.unit}` }),
              )
            }
            className="flex-1 accent-[var(--color-accent-fill)]"
          />
          <span className="w-12 text-end text-caption text-label-secondary">
            {value}
            {spec.unit}
          </span>
        </div>
      )}
    </Labelled>
  );
}

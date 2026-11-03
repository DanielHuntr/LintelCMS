import { type ComponentVariants, resolveSelection } from "@lintel/builder-model";
import { ChoiceGroup } from "../ui/controls.js";

/**
 * One row of choices per variant property ("Size: Small · Medium · Large"), as an instance's
 * panel and the designer's variant bar show them. Arrow keys move between choices.
 */
export function VariantChoices({
  variants,
  selection,
  onChange,
  inline = false,
}: {
  variants: ComponentVariants;
  selection: Readonly<Record<string, string>>;
  onChange: (selection: Record<string, string>) => void;
  /** In a row, each name beside its choices, as the canvas's variant bar shows them. */
  inline?: boolean;
}) {
  const resolved = resolveSelection(variants, selection);
  if (inline) {
    return (
      <>
        {variants.properties.map((property) => (
          <div
            key={property.handle}
            className="flex shrink-0 items-center gap-1.5 [&_[role=radio]]:flex-none [&_[role=radio]]:px-2.5 [&_[role=radio]]:whitespace-nowrap"
          >
            <span aria-hidden="true" className="text-caption text-label-secondary">
              {property.label}
            </span>
            <ChoiceGroup
              label={property.label}
              hideLabel
              choices={property.options.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              value={resolved[property.handle]}
              onChange={(value) => onChange({ ...resolved, [property.handle]: value })}
            />
          </div>
        ))}
      </>
    );
  }
  return (
    <>
      {variants.properties.map((property) => (
        <ChoiceGroup
          key={property.handle}
          label={property.label}
          choices={property.options.map((option) => ({ value: option.value, label: option.label }))}
          value={resolved[property.handle]}
          wraps={property.options.length > 3}
          onChange={(value) => onChange({ ...resolved, [property.handle]: value })}
        />
      ))}
    </>
  );
}

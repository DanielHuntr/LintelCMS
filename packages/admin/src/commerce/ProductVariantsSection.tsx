import { Plus, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { currencySymbol } from "./money.js";
import { OptionChoicesField } from "./OptionChoicesField.js";
import {
  type ProductDraft,
  renameChoice,
  splitList,
  type VariantDraft,
  variantsForOptions,
} from "./productDraft.js";
import type { InventoryLocation } from "./products.api.js";
import { VariantFields } from "./VariantFields.js";
import { VariantTable } from "./VariantTable.js";
import type { VariantTableView } from "./variantTableState.js";

interface ProductVariantsSectionProps {
  draft: ProductDraft;
  onChange: (changes: Partial<ProductDraft>) => void;
  currency: string;
  locations: InventoryLocation[];
  errors: Record<string, string>;
  tableView: VariantTableView;
  onTableViewChange: (view: VariantTableView) => void;
}

const MAX_OPTIONS = 3;

/**
 * Price, stock and options. A product without options has one set of fields; adding an
 * option ("Size: S, M, L") makes one variant per combination, listed in a table.
 */
export function ProductVariantsSection({
  draft,
  onChange,
  currency,
  locations,
  errors,
  tableView,
  onTableViewChange,
}: ProductVariantsSectionProps) {
  const hasOptions = draft.options.length > 0;
  const onlyVariant = draft.variants[0];
  // Variants taken out by removing a choice, until saving, so adding it back restores them.
  const setAside = useRef(new Map<string, VariantDraft>());

  function changeOptions(options: ProductDraft["options"]) {
    const variants = variantsForOptions(options, draft.variants, [...setAside.current.values()]);
    const keptKeys = new Set(variants.map((variant) => variant.key));
    for (const variant of draft.variants) {
      if (!keptKeys.has(variant.key)) setAside.current.set(variant.key, variant);
    }
    for (const key of keptKeys) setAside.current.delete(key);
    onChange({ options, variants });
  }

  function changeOptionName(index: number, name: string) {
    // Only the name changes, so the variants stay exactly as they are.
    onChange({
      options: draft.options.map((option, position) =>
        position === index ? { ...option, name } : option,
      ),
    });
  }

  return (
    <>
      <Card title={t("shop.products.optionsHeader")}>
        <div className="flex flex-col gap-4">
          <p className="text-footnote text-label-secondary">{t("shop.products.optionsHint")}</p>
          {draft.options.map((option, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_auto] items-start gap-3 sm:grid-cols-[1fr_2fr_auto]"
            >
              <TextField
                label={t("shop.products.optionNameLabel")}
                placeholder={t("shop.products.optionNamePlaceholder")}
                value={option.name}
                error={errors[`options.${index}.name`]}
                onChange={(event) => changeOptionName(index, event.target.value)}
              />
              <div className="max-sm:col-span-2 max-sm:row-start-2">
                <OptionChoicesField
                  label={t("shop.products.optionValuesLabel")}
                  placeholder={t("shop.products.optionValuesPlaceholder")}
                  morePlaceholder={t("shop.products.optionValuesMorePlaceholder")}
                  hint={t("shop.products.optionValuesHint")}
                  error={errors[`options.${index}.values`]}
                  choices={splitList(option.values)}
                  onChange={(choices) =>
                    changeOptions(
                      draft.options.map((existing, position) =>
                        position === index ? { ...existing, values: choices.join(", ") } : existing,
                      ),
                    )
                  }
                  onRename={(from, to) => onChange(renameChoice(draft, index, from, to))}
                />
              </div>
              <Button
                variant="plain"
                className="mt-6"
                aria-label={t("shop.products.removeOption", {
                  name: option.name || String(index + 1),
                })}
                onClick={() =>
                  changeOptions(draft.options.filter((_, position) => position !== index))
                }
                icon={<X aria-hidden="true" />}
              />
            </div>
          ))}
          {draft.options.length < MAX_OPTIONS && (
            <div>
              <Button
                variant="tinted"
                icon={<Plus aria-hidden="true" />}
                onClick={() => changeOptions([...draft.options, { name: "", values: "" }])}
              >
                {hasOptions ? t("shop.products.addAnotherOption") : t("shop.products.addOption")}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {onlyVariant && onlyVariant.optionValues.length === 0 ? (
        <Card title={t("shop.products.pricingHeader")}>
          <VariantFields
            variant={onlyVariant}
            index={0}
            currency={currency}
            currencySymbol={currencySymbol(currency)}
            locations={locations}
            errors={errors}
            onChange={(changes) => onChange({ variants: [{ ...onlyVariant, ...changes }] })}
          />
        </Card>
      ) : (
        <VariantTable
          options={draft.options}
          variants={draft.variants}
          currency={currency}
          locations={locations}
          errors={errors}
          view={tableView}
          onViewChange={onTableViewChange}
          onVariantsChange={(variants) => onChange({ variants })}
        />
      )}
    </>
  );
}

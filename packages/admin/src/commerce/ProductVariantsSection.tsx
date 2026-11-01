import { Plus, X } from "lucide-react";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { currencySymbol } from "./money.js";
import { type ProductDraft, type VariantDraft, variantsForOptions } from "./productDraft.js";
import type { InventoryLocation } from "./products.api.js";
import { VariantFields } from "./VariantFields.js";

interface ProductVariantsSectionProps {
  draft: ProductDraft;
  onChange: (changes: Partial<ProductDraft>) => void;
  currency: string;
  locations: InventoryLocation[];
  errors: Record<string, string>;
}

const MAX_OPTIONS = 3;

/**
 * Price, stock and options. A product without options has one set of fields; adding an
 * option ("Size: S, M, L") makes one variant per combination, each with its own fields.
 */
export function ProductVariantsSection({
  draft,
  onChange,
  currency,
  locations,
  errors,
}: ProductVariantsSectionProps) {
  const hasOptions = draft.options.length > 0;

  function changeOptions(options: ProductDraft["options"]) {
    onChange({ options, variants: variantsForOptions(options, draft.variants) });
  }

  function changeVariant(index: number, changes: Partial<VariantDraft>) {
    onChange({
      variants: draft.variants.map((variant, position) =>
        position === index ? { ...variant, ...changes } : variant,
      ),
    });
  }

  return (
    <>
      <Card title={t("shop.products.optionsHeader")}>
        <div className="flex flex-col gap-4">
          <p className="text-footnote text-label-secondary">{t("shop.products.optionsHint")}</p>
          {draft.options.map((option, index) => (
            <div key={index} className="grid grid-cols-[1fr_2fr_auto] items-start gap-3">
              <TextField
                label={t("shop.products.optionNameLabel")}
                placeholder={t("shop.products.optionNamePlaceholder")}
                value={option.name}
                error={errors[`options.${index}.name`]}
                onChange={(event) =>
                  changeOptions(
                    draft.options.map((existing, position) =>
                      position === index ? { ...existing, name: event.target.value } : existing,
                    ),
                  )
                }
              />
              <TextField
                label={t("shop.products.optionValuesLabel")}
                placeholder={t("shop.products.optionValuesPlaceholder")}
                hint={t("shop.products.optionValuesHint")}
                value={option.values}
                error={errors[`options.${index}.values`]}
                onChange={(event) =>
                  changeOptions(
                    draft.options.map((existing, position) =>
                      position === index ? { ...existing, values: event.target.value } : existing,
                    ),
                  )
                }
              />
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

      {draft.variants.map((variant, index) => (
        <Card
          key={variant.key}
          title={hasOptions ? variant.optionValues.join(" / ") : t("shop.products.pricingHeader")}
        >
          <VariantFields
            variant={variant}
            index={index}
            currency={currency}
            currencySymbol={currencySymbol(currency)}
            locations={locations}
            errors={errors}
            onChange={(changes) => changeVariant(index, changes)}
          />
        </Card>
      ))}
    </>
  );
}

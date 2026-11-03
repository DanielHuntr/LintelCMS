import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import type { VariantDraft } from "./productDraft.js";
import type { InventoryLocation } from "./products.api.js";

interface VariantFieldsProps {
  variant: VariantDraft;
  index: number;
  currency: string;
  currencySymbol: string;
  locations: InventoryLocation[];
  errors: Record<string, string>;
  onChange: (changes: Partial<VariantDraft>) => void;
}

/** One variant's price, codes, weight and stock. */
export function VariantFields({
  variant,
  index,
  currency,
  currencySymbol,
  locations,
  errors,
  onChange,
}: VariantFieldsProps) {
  const field = (name: string) => errors[`variants.${index}.${name}`];
  const otherCurrencies = variant.otherPrices.map((price) => price.currency).join(", ");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField
          label={t("shop.products.priceLabel", { currency })}
          hint={
            otherCurrencies
              ? t("shop.products.priceHintWithOthers", { currencies: otherCurrencies })
              : t("shop.products.priceHint")
          }
          inputMode="decimal"
          placeholder={`${currencySymbol}0`}
          data-autofocus
          value={variant.price}
          onChange={(event) => onChange({ price: event.target.value })}
          error={field("price") ?? field("prices")}
        />
        <TextField
          label={t("shop.products.compareAtLabel")}
          hint={t("shop.products.compareAtHint")}
          inputMode="decimal"
          placeholder={`${currencySymbol}0`}
          value={variant.compareAtPrice}
          onChange={(event) => onChange({ compareAtPrice: event.target.value })}
          error={field("compareAtPrice")}
        />
        <TextField
          label={t("shop.products.skuLabel")}
          hint={t("shop.products.skuHint")}
          value={variant.sku}
          onChange={(event) => onChange({ sku: event.target.value })}
          error={field("sku")}
        />
        <TextField
          label={t("shop.products.barcodeLabel")}
          hint={t("shop.products.barcodeHint")}
          value={variant.barcode}
          onChange={(event) => onChange({ barcode: event.target.value })}
          error={field("barcode")}
        />
        <TextField
          label={t("shop.products.weightLabel")}
          hint={t("shop.products.weightHint")}
          inputMode="numeric"
          value={variant.weightGrams}
          onChange={(event) => onChange({ weightGrams: event.target.value })}
          error={field("weightGrams")}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Toggle
          label={t("shop.products.trackStock")}
          checked={variant.inventoryTracked}
          onCheckedChange={(inventoryTracked) => onChange({ inventoryTracked })}
        />
        <p className="text-footnote text-label-secondary">
          {variant.inventoryTracked
            ? t("shop.products.trackStockOnHint")
            : t("shop.products.trackStockOffHint")}
        </p>
        {variant.inventoryTracked && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {locations.map((location) => (
              <TextField
                key={location.id}
                label={t("shop.products.stockAt", { location: location.name })}
                inputMode="numeric"
                placeholder="0"
                value={variant.stock[location.id] ?? ""}
                onChange={(event) =>
                  onChange({ stock: { ...variant.stock, [location.id]: event.target.value } })
                }
                error={field("stock")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

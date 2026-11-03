import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";
import { currencySymbol } from "./money.js";
import { type VariantDraft, variantName } from "./productDraft.js";
import type { InventoryLocation } from "./products.api.js";
import { VariantFields } from "./VariantFields.js";

interface VariantDrawerProps {
  variant: VariantDraft;
  index: number;
  currency: string;
  locations: InventoryLocation[];
  errors: Record<string, string>;
  onChange: (changes: Partial<VariantDraft>) => void;
  onClose: () => void;
}

/**
 * Everything about one variant, in the admin's usual sheet. Changes go straight into the
 * product's draft, like the table's own boxes, so there's nothing to cancel here.
 */
export function VariantDrawer({
  variant,
  index,
  currency,
  locations,
  errors,
  onChange,
  onClose,
}: VariantDrawerProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={variantName(variant)}
      description={t("shop.variants.drawerHint")}
      footer={<Button onClick={onClose}>{t("shop.variants.done")}</Button>}
    >
      {/* The sheet sits inside the product's form, where Enter in a box would save the product. */}
      <div
        className="pt-1"
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            event.target instanceof HTMLInputElement &&
            event.target.type === "text"
          ) {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <VariantFields
          variant={variant}
          index={index}
          currency={currency}
          currencySymbol={currencySymbol(currency)}
          locations={locations}
          errors={errors}
          onChange={onChange}
        />
      </div>
    </Dialog>
  );
}

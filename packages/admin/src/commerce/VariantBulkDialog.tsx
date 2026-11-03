import { useState } from "react";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { currencySymbol, inputToMinor } from "./money.js";

interface VariantBulkDialogProps {
  kind: "price" | "stock";
  count: number;
  currency: string;
  /** The location being changed, when the shop has more than one. */
  locationName: string | null;
  onApply: (text: string) => void;
  onClose: () => void;
}

/** One box that sets the price or stock of every ticked variant. */
export function VariantBulkDialog({
  kind,
  count,
  currency,
  locationName,
  onApply,
  onClose,
}: VariantBulkDialogProps) {
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const isPrice = kind === "price";

  function apply() {
    const isValid =
      text.trim() !== "" &&
      (isPrice ? inputToMinor(text, currency) !== null : Number.isInteger(Number(text)));
    if (isValid) onApply(text.trim());
    else
      setProblem(t(isPrice ? "shop.variants.bulkPriceProblem" : "shop.variants.bulkStockProblem"));
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(isPrice ? "shop.variants.setPriceTitle" : "shop.variants.setStockTitle", { count })}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={apply}>{t("shop.variants.bulkApply")}</Button>
        </>
      }
    >
      <TextField
        data-autofocus
        label={
          isPrice
            ? t("shop.products.priceLabel", { currency })
            : locationName
              ? t("shop.products.stockAt", { location: locationName })
              : t("shop.variants.column.stock")
        }
        inputMode={isPrice ? "decimal" : "numeric"}
        placeholder={isPrice ? `${currencySymbol(currency)}0` : "0"}
        value={text}
        error={problem}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // The dialog sits inside the product's form, where Enter would save the product.
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
          }
        }}
      />
    </Dialog>
  );
}

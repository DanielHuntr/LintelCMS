import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { currencySymbol } from "./money.js";

interface AmountsByCurrencyFieldsProps {
  /** What the amounts are, e.g. "Amount off". Each box adds its currency. */
  label: string;
  hint?: string;
  /** The market currencies, the shop's own first. */
  currencies: readonly string[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  error?: string;
}

/**
 * One amount box per currency the shop sells in. The first (the shop's own currency) is the
 * one most people fill in; a currency left empty isn't offered the discount.
 */
export function AmountsByCurrencyFields({
  label,
  hint,
  currencies,
  values,
  onChange,
  error,
}: AmountsByCurrencyFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      {currencies.map((currency, index) => (
        <TextField
          key={currency}
          label={t("shop.discounts.amountIn", {
            label,
            currency,
            symbol: currencySymbol(currency),
          })}
          hint={index === 0 ? hint : t("shop.discounts.otherCurrencyHint", { currency })}
          inputMode="decimal"
          value={values[currency] ?? ""}
          onChange={(event) => onChange({ ...values, [currency]: event.target.value })}
          error={index === 0 ? error : undefined}
        />
      ))}
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { controlClasses } from "../design/controlStyles.js";
import { Dialog } from "../design/Dialog.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { CountryPicker } from "./CountryPicker.js";
import { commonCurrencies } from "./currencies.js";
import type { Market, MarketInput, PriceRounding } from "./shopSettings.api.js";
import {
  useDeleteMarket,
  useMakeMarketPrimary,
  usePrimaryCurrency,
  useSaveMarket,
} from "./shopSettings.queries.js";

interface MarketDialogProps {
  market: Market | null;
  isFirst: boolean;
  onClose: () => void;
}

/** Adding or changing a market: its name, currency, countries and how prices are shown. */
export function MarketDialog({ market, isFirst, onClose }: MarketDialogProps) {
  const [values, setValues] = useState<MarketInput>(
    market ?? {
      name: "",
      currency: "GBP",
      countries: [],
      exchangeRate: 1,
      priceRounding: "exact",
      pricesIncludeTax: true,
    },
  );
  const [rateText, setRateText] = useState(String(market?.exchangeRate ?? 1));
  const save = useSaveMarket(market?.id ?? null);
  const makePrimary = useMakeMarketPrimary();
  const remove = useDeleteMarket();
  const primaryCurrency = usePrimaryCurrency();
  const isPrimary = isFirst || (market?.isPrimary ?? false);
  const fields = save.error instanceof ApiError ? save.error.fields : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    const exchangeRate = Number(rateText);
    save.mutate(
      {
        ...values,
        exchangeRate: Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : 1,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        market ? t("shop.markets.editTitle", { name: market.name }) : t("shop.markets.addTitle")
      }
      description={isFirst ? t("shop.markets.firstDescription") : t("shop.markets.formDescription")}
      footer={
        <>
          {market && !market.isPrimary && (
            <Button
              variant="destructive"
              onClick={() => remove.mutate(market.id, { onSuccess: onClose })}
            >
              {t("shop.markets.delete")}
            </Button>
          )}
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="market-form" disabled={save.isPending}>
            {save.isPending ? t("shop.saving") : t("shop.save")}
          </Button>
        </>
      }
    >
      <form id="market-form" onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label={t("shop.markets.nameLabel")}
          placeholder={t("shop.markets.namePlaceholder")}
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          error={fields?.name}
          required
          data-autofocus
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="market-currency" className="text-footnote font-medium text-label">
            {t("shop.markets.currencyLabel")}
          </label>
          <select
            id="market-currency"
            value={values.currency}
            onChange={(event) => setValues({ ...values, currency: event.target.value })}
            className={`${controlClasses()} h-9`}
          >
            {commonCurrencies().map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.label}
              </option>
            ))}
          </select>
        </div>
        <CountryPicker
          legend={t("shop.markets.countriesLabel")}
          hint={t("shop.markets.countriesHint")}
          value={values.countries}
          onChange={(countries) => setValues({ ...values, countries })}
          error={fields?.countries}
        />
        {!isPrimary && primaryCurrency && primaryCurrency !== values.currency && (
          <>
            <TextField
              label={t("shop.markets.rateLabel", { from: primaryCurrency, to: values.currency })}
              hint={t("shop.markets.rateHint", { from: primaryCurrency, to: values.currency })}
              inputMode="decimal"
              value={rateText}
              onChange={(event) => setRateText(event.target.value)}
            />
            <SegmentedControl<PriceRounding>
              label={t("shop.markets.roundingLabel")}
              value={values.priceRounding}
              onChange={(priceRounding) => setValues({ ...values, priceRounding })}
              options={[
                { value: "exact", label: t("shop.markets.roundExact") },
                { value: "whole", label: t("shop.markets.roundWhole") },
                { value: "ninety_nine", label: t("shop.markets.roundNinetyNine") },
              ]}
            />
          </>
        )}
        <Toggle
          label={t("shop.markets.includesTax")}
          checked={values.pricesIncludeTax}
          onCheckedChange={(pricesIncludeTax) => setValues({ ...values, pricesIncludeTax })}
        />
        <p className="-mt-3 text-footnote text-label-secondary">
          {t("shop.markets.includesTaxHint")}
        </p>
        {market && !market.isPrimary && (
          <Button
            variant="tinted"
            onClick={() => makePrimary.mutate(market.id, { onSuccess: onClose })}
          >
            {t("shop.markets.makePrimary")}
          </Button>
        )}
        {(save.error || remove.error) && !fields && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(save.error ?? remove.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

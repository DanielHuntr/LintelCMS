import { Plus, X } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { controlClasses } from "../design/controlStyles.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { allCountries } from "./CountryPicker.js";
import type { TaxSettings } from "./shopSettings.api.js";
import { useTaxSettings, useUpdateTaxSettings } from "./shopSettings.queries.js";

/** /commerce/settings/taxes: Stripe Tax, or rates typed in by hand. */
export function TaxesPage() {
  const taxes = useTaxSettings();
  return (
    <>
      <BackLink to="/commerce/settings">{t("shop.settings.title")}</BackLink>
      <LargeTitle title={t("shop.taxes.title")} subtitle={t("shop.taxes.subtitle")} />
      {taxes.isError && <LoadError error={taxes.error} onRetry={() => void taxes.refetch()} />}
      {taxes.isPending && (
        <LoadingRegion label={t("shop.taxes.loading")}>
          <Skeleton className="h-40 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {taxes.data && <TaxForm settings={taxes.data} />}
    </>
  );
}

interface RateRow {
  country: string;
  rate: string;
  name: string;
}

function TaxForm({ settings }: { settings: TaxSettings }) {
  const [calculation, setCalculation] = useState(settings.taxCalculation);
  const [taxShipping, setTaxShipping] = useState(settings.taxShipping);
  const [rates, setRates] = useState<RateRow[]>(
    settings.manualTaxRates.map((rate) => ({ ...rate, rate: String(rate.rate) })),
  );
  const update = useUpdateTaxSettings();
  const canChange = useCan("commerce:update");

  function save() {
    update.mutate({
      taxCalculation: calculation,
      taxShipping,
      manualTaxRates: rates
        .filter((row) => row.country !== "" && row.rate.trim() !== "")
        .map((row) => ({
          country: row.country,
          rate: Number(row.rate),
          name: row.name.trim() || "Tax",
        })),
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card title={t("shop.taxes.howHeader")}>
        <div className="flex flex-col gap-3">
          <SegmentedControl<"stripe" | "manual">
            label={t("shop.taxes.howHeader")}
            value={calculation}
            onChange={setCalculation}
            options={[
              { value: "stripe", label: t("shop.taxes.calculation.stripe") },
              { value: "manual", label: t("shop.taxes.calculation.manual") },
            ]}
          />
          <p className="text-footnote text-label-secondary">
            {calculation === "stripe" ? t("shop.taxes.stripeHint") : t("shop.taxes.manualHint")}
          </p>
          {calculation === "stripe" && settings.effectiveCalculation === "manual" && (
            <p
              role="note"
              className="rounded-control bg-warning/10 px-3 py-2 text-footnote text-warning"
            >
              {t("shop.taxes.stripeNotConnected")}
            </p>
          )}
          <Toggle
            label={t("shop.taxes.taxShipping")}
            checked={taxShipping}
            onCheckedChange={setTaxShipping}
          />
        </div>
      </Card>

      <Card title={t("shop.taxes.ratesHeader")}>
        <div className="flex flex-col gap-4">
          <p className="text-footnote text-label-secondary">{t("shop.taxes.ratesHint")}</p>
          {rates.map((row, index) => (
            <div key={index} className="grid grid-cols-[2fr_1fr_1fr_auto] items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`tax-country-${index}`}
                  className="text-footnote font-medium text-label"
                >
                  {t("shop.taxes.country")}
                </label>
                <select
                  id={`tax-country-${index}`}
                  value={row.country}
                  onChange={(event) =>
                    setRates(
                      rates.map((existing, position) =>
                        position === index
                          ? { ...existing, country: event.target.value }
                          : existing,
                      ),
                    )
                  }
                  className={`${controlClasses()} h-9`}
                >
                  <option value="">{t("shop.taxes.chooseCountry")}</option>
                  {allCountries().map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
              <TextField
                label={t("shop.taxes.rate")}
                inputMode="decimal"
                placeholder="20"
                value={row.rate}
                onChange={(event) =>
                  setRates(
                    rates.map((existing, position) =>
                      position === index ? { ...existing, rate: event.target.value } : existing,
                    ),
                  )
                }
              />
              <TextField
                label={t("shop.taxes.name")}
                placeholder={t("shop.taxes.namePlaceholder")}
                value={row.name}
                onChange={(event) =>
                  setRates(
                    rates.map((existing, position) =>
                      position === index ? { ...existing, name: event.target.value } : existing,
                    ),
                  )
                }
              />
              <Button
                variant="plain"
                aria-label={t("shop.taxes.removeRate", { number: index + 1 })}
                onClick={() => setRates(rates.filter((_, position) => position !== index))}
                icon={<X aria-hidden="true" />}
              />
            </div>
          ))}
          <div>
            <Button
              variant="tinted"
              size="small"
              icon={<Plus aria-hidden="true" />}
              onClick={() => setRates([...rates, { country: "", rate: "", name: "" }])}
            >
              {t("shop.taxes.addRate")}
            </Button>
          </div>
        </div>
      </Card>

      {canChange && (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? t("shop.saving") : t("shop.save")}
          </Button>
          <p role="status" className="text-footnote text-label-secondary">
            {update.isSuccess ? t("shop.saved") : ""}
          </p>
          {update.error && (
            <p role="alert" className="text-footnote text-danger">
              {describeError(update.error)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

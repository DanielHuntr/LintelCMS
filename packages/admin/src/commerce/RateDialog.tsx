import { Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { currencySymbol, inputToMinor, minorToInput } from "./money.js";
import type { ShippingRate, ShippingZone } from "./shopSettings.api.js";
import { useDeleteShippingRate, useSaveShippingRate } from "./shopSettings.queries.js";

interface RateDialogProps {
  zone: ShippingZone;
  rate: ShippingRate | null;
  /** Prices are typed in the shop's own currency; other markets convert. */
  currency: string;
  onClose: () => void;
}

interface Step {
  upToKilograms: string;
  price: string;
}

/** A shipping rate: flat or by weight, optionally free over an amount. */
export function RateDialog({ zone, rate, currency, onClose }: RateDialogProps) {
  const [name, setName] = useState(rate?.name ?? "");
  const [kind, setKind] = useState<"flat" | "weight">(rate?.kind ?? "flat");
  const [price, setPrice] = useState(minorToInput(rate?.amounts[currency], currency));
  const [steps, setSteps] = useState<Step[]>(
    rate?.weightBrackets.map((bracket) => ({
      upToKilograms: bracket.upToGrams === null ? "" : String(bracket.upToGrams / 1000),
      price: minorToInput(bracket.amounts[currency], currency),
    })) ?? [
      { upToKilograms: "2", price: "" },
      { upToKilograms: "", price: "" },
    ],
  );
  const freeOverAmount = rate?.freeOverAmounts?.[currency];
  const [isFreeOver, setIsFreeOver] = useState(freeOverAmount !== undefined);
  const [freeOver, setFreeOver] = useState(minorToInput(freeOverAmount, currency));
  const [estimate, setEstimate] = useState(rate?.deliveryEstimate ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const save = useSaveShippingRate(zone.id, rate?.id ?? null);
  const remove = useDeleteShippingRate();
  const symbol = currencySymbol(currency);

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = inputToMinor(price, currency);
    const brackets = steps.map((step, index) => ({
      upToGrams:
        index === steps.length - 1 && step.upToKilograms.trim() === ""
          ? null
          : Math.round(Number(step.upToKilograms) * 1000),
      amount: inputToMinor(step.price, currency),
    }));
    const free = isFreeOver ? inputToMinor(freeOver, currency) : null;
    if (
      (kind === "flat" && amount === null) ||
      (kind === "weight" &&
        brackets.some(
          (bracket) =>
            bracket.amount === null || (bracket.upToGrams !== null && !(bracket.upToGrams > 0)),
        )) ||
      (isFreeOver && free === null)
    ) {
      setProblem(t("shop.shipping.rateProblem"));
      return;
    }
    setProblem(null);
    save.mutate(
      {
        name,
        kind,
        amounts: kind === "flat" && amount !== null ? { [currency]: amount } : {},
        weightBrackets:
          kind === "weight"
            ? brackets.map((bracket) => ({
                upToGrams: bracket.upToGrams,
                amounts: { [currency]: bracket.amount ?? 0 },
              }))
            : [],
        freeOverAmounts: free === null ? null : { [currency]: free },
        deliveryEstimate: estimate,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        rate
          ? t("shop.shipping.editRateTitle", { name: rate.name })
          : t("shop.shipping.addRateTitle", { zone: zone.name })
      }
      footer={
        <>
          {rate && (
            <Button
              variant="destructive"
              onClick={() => remove.mutate(rate.id, { onSuccess: onClose })}
            >
              {t("shop.shipping.deleteRate")}
            </Button>
          )}
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="rate-form" disabled={save.isPending}>
            {save.isPending ? t("shop.saving") : t("shop.save")}
          </Button>
        </>
      }
    >
      <form id="rate-form" onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label={t("shop.shipping.rateNameLabel")}
          placeholder={t("shop.shipping.rateNamePlaceholder")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          data-autofocus
        />
        <SegmentedControl<"flat" | "weight">
          label={t("shop.shipping.rateKindLabel")}
          value={kind}
          onChange={setKind}
          options={[
            { value: "flat", label: t("shop.shipping.flat") },
            { value: "weight", label: t("shop.shipping.byWeight") },
          ]}
        />
        {kind === "flat" ? (
          <TextField
            label={t("shop.shipping.priceLabel", { currency })}
            inputMode="decimal"
            placeholder={`${symbol}0`}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        ) : (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1.5 text-footnote font-medium text-label">
              {t("shop.shipping.stepsLabel")}
            </legend>
            <p className="text-footnote text-label-secondary">{t("shop.shipping.stepsHint")}</p>
            {steps.map((step, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                <TextField
                  label={
                    index === steps.length - 1
                      ? t("shop.shipping.upToLast")
                      : t("shop.shipping.upTo")
                  }
                  inputMode="decimal"
                  value={step.upToKilograms}
                  onChange={(event) =>
                    setSteps(
                      steps.map((existing, position) =>
                        position === index
                          ? { ...existing, upToKilograms: event.target.value }
                          : existing,
                      ),
                    )
                  }
                />
                <TextField
                  label={t("shop.shipping.stepPrice", { currency })}
                  inputMode="decimal"
                  placeholder={`${symbol}0`}
                  value={step.price}
                  onChange={(event) =>
                    setSteps(
                      steps.map((existing, position) =>
                        position === index ? { ...existing, price: event.target.value } : existing,
                      ),
                    )
                  }
                />
                <Button
                  variant="plain"
                  aria-label={t("shop.shipping.removeStep", { number: index + 1 })}
                  disabled={steps.length === 1}
                  onClick={() => setSteps(steps.filter((_, position) => position !== index))}
                  icon={<X aria-hidden="true" />}
                />
              </div>
            ))}
            <div>
              <Button
                variant="tinted"
                size="small"
                icon={<Plus aria-hidden="true" />}
                onClick={() => setSteps([...steps, { upToKilograms: "", price: "" }])}
              >
                {t("shop.shipping.addStep")}
              </Button>
            </div>
          </fieldset>
        )}
        <Toggle
          label={t("shop.shipping.freeOverToggle")}
          checked={isFreeOver}
          onCheckedChange={setIsFreeOver}
        />
        {isFreeOver && (
          <TextField
            label={t("shop.shipping.freeOverLabel", { currency })}
            inputMode="decimal"
            placeholder={`${symbol}0`}
            value={freeOver}
            onChange={(event) => setFreeOver(event.target.value)}
          />
        )}
        <TextField
          label={t("shop.shipping.estimateLabel")}
          placeholder={t("shop.shipping.estimatePlaceholder")}
          value={estimate}
          onChange={(event) => setEstimate(event.target.value)}
        />
        {(problem || save.error || remove.error) && (
          <p role="alert" className="text-footnote text-danger">
            {problem ?? describeError(save.error ?? remove.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

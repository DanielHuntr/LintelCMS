import { Gift, Percent, Truck, Wallet } from "lucide-react";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { ChoiceCardGroup } from "../design/ChoiceCardGroup.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { AmountsByCurrencyFields } from "./AmountsByCurrencyFields.js";
import { type DiscountDraft, suggestCode } from "./discountDraft.js";
import type { DiscountKind, DiscountMethod } from "./discounts.api.js";

interface SectionProps {
  draft: DiscountDraft;
  onChange: (changes: Partial<DiscountDraft>) => void;
  errors: Record<string, string>;
  currencies: readonly string[];
}

/** How shoppers get the discount (a code or automatically), and what it gives them. */
export function DiscountOfferSection({ draft, onChange, errors, currencies }: SectionProps) {
  return (
    <>
      <Card title={t("shop.discounts.howHeader")}>
        <div className="flex flex-col gap-4">
          <SegmentedControl<DiscountMethod>
            label={t("shop.discounts.howHeader")}
            value={draft.method}
            onChange={(method) => onChange({ method })}
            options={[
              { value: "code", label: t("shop.discounts.method.code") },
              { value: "automatic", label: t("shop.discounts.method.automatic") },
            ]}
          />
          <p className="text-footnote text-label-secondary">
            {draft.method === "code"
              ? t("shop.discounts.method.codeHint")
              : t("shop.discounts.method.automaticHint")}
          </p>
          {draft.method === "code" && (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <TextField
                  label={t("shop.discounts.codeLabel")}
                  hint={t("shop.discounts.codeHint")}
                  value={draft.code}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
                  error={errors.code}
                />
              </div>
              <Button variant="tinted" onClick={() => onChange({ code: suggestCode() })}>
                {t("shop.discounts.suggestCode")}
              </Button>
            </div>
          )}
          <TextField
            label={t("shop.discounts.titleLabel")}
            hint={t("shop.discounts.titleHint")}
            value={draft.title}
            onChange={(event) => onChange({ title: event.target.value })}
            error={errors.title}
          />
        </div>
      </Card>

      <Card title={t("shop.discounts.whatHeader")}>
        <div className="flex flex-col gap-5">
          <ChoiceCardGroup<DiscountKind>
            label={t("shop.discounts.whatHeader")}
            value={draft.kind}
            onChange={(kind) => onChange({ kind })}
            columns={2}
            options={[
              {
                value: "percentage",
                icon: Percent,
                title: t("shop.discounts.kind.percentage"),
                description: t("shop.discounts.kind.percentageHint"),
              },
              {
                value: "fixed_amount",
                icon: Wallet,
                title: t("shop.discounts.kind.fixed_amount"),
                description: t("shop.discounts.kind.fixed_amountHint"),
              },
              {
                value: "free_shipping",
                icon: Truck,
                title: t("shop.discounts.kind.free_shipping"),
                description: t("shop.discounts.kind.free_shippingHint"),
              },
              {
                value: "buy_x_get_y",
                icon: Gift,
                title: t("shop.discounts.kind.buy_x_get_y"),
                description: t("shop.discounts.kind.buy_x_get_yHint"),
              },
            ]}
          />
          {draft.kind === "percentage" && (
            <TextField
              label={t("shop.discounts.percentLabel")}
              inputMode="numeric"
              value={draft.percentText}
              onChange={(event) => onChange({ percentText: event.target.value })}
              error={errors.percentOff}
            />
          )}
          {draft.kind === "fixed_amount" && (
            <AmountsByCurrencyFields
              label={t("shop.discounts.amountLabel")}
              hint={t("shop.discounts.amountHint")}
              currencies={currencies}
              values={draft.amountTexts}
              onChange={(amountTexts) => onChange({ amountTexts })}
              error={errors.amounts}
            />
          )}
          {draft.kind === "buy_x_get_y" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label={t("shop.discounts.buyLabel")}
                  inputMode="numeric"
                  value={draft.buyText}
                  onChange={(event) => onChange({ buyText: event.target.value })}
                  error={errors.buyQuantity}
                />
                <TextField
                  label={t("shop.discounts.getLabel")}
                  inputMode="numeric"
                  value={draft.getText}
                  onChange={(event) => onChange({ getText: event.target.value })}
                />
              </div>
              <Toggle
                label={t("shop.discounts.getFree")}
                checked={draft.getFree}
                onCheckedChange={(getFree) => onChange({ getFree })}
              />
              {!draft.getFree && (
                <TextField
                  label={t("shop.discounts.getPercentLabel")}
                  inputMode="numeric"
                  value={draft.percentText}
                  onChange={(event) => onChange({ percentText: event.target.value })}
                  error={errors.percentOff}
                />
              )}
              <p className="text-footnote text-label-secondary">{t("shop.discounts.buyGetHint")}</p>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

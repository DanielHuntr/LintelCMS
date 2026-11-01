import { Card } from "../design/Card.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import type { DiscountDraft } from "./discountDraft.js";

interface SectionProps {
  draft: DiscountDraft;
  onChange: (changes: Partial<DiscountDraft>) => void;
  errors: Record<string, string>;
}

/** When the discount works, how often it can be used, and whether it adds to others. */
export function DiscountScheduleSection({ draft, onChange, errors }: SectionProps) {
  return (
    <Card title={t("shop.discounts.whenHeader")}>
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t("shop.discounts.startLabel")}
            type="date"
            value={draft.startDate}
            onChange={(event) => onChange({ startDate: event.target.value })}
          />
          <TextField
            label={t("shop.discounts.endLabel")}
            hint={t("shop.discounts.endHint")}
            type="date"
            value={draft.endDate}
            onChange={(event) => onChange({ endDate: event.target.value })}
            error={errors.endsAt}
          />
        </div>
        <TextField
          label={t("shop.discounts.usageLimitLabel")}
          hint={t("shop.discounts.usageLimitHint")}
          inputMode="numeric"
          value={draft.usageLimitText}
          onChange={(event) => onChange({ usageLimitText: event.target.value })}
          error={errors.usageLimit}
        />
        <Toggle
          label={t("shop.discounts.oncePerCustomer")}
          checked={draft.oncePerCustomer}
          onCheckedChange={(oncePerCustomer) => onChange({ oncePerCustomer })}
        />
        <div className="flex flex-col gap-1">
          <Toggle
            label={t("shop.discounts.combines")}
            checked={draft.combinesWithOthers}
            onCheckedChange={(combinesWithOthers) => onChange({ combinesWithOthers })}
          />
          <p className="text-footnote text-label-secondary">{t("shop.discounts.combinesHint")}</p>
        </div>
        <Toggle
          label={t("shop.discounts.enabled")}
          checked={draft.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
        />
      </div>
    </Card>
  );
}

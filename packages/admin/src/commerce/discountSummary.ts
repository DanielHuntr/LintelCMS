import { t } from "../i18n/strings.js";
import type { DiscountInput } from "./discounts.api.js";
import { decimalPlaces } from "./money.js";

/**
 * A discount in one plain sentence, as the shop owner would say it:
 * "20% off Summer Edit, orders of £50 or more, until 31 Aug". Shown in the list and kept up
 * to date in the editor as the form changes, so the owner can check they set what they meant.
 */
export interface SummaryContext {
  currency: string;
  productNames: ReadonlyMap<string, string>;
  collectionNames: ReadonlyMap<string, string>;
  now: Date;
}

export function summariseDiscount(
  discount: Pick<
    DiscountInput,
    | "kind"
    | "percentOff"
    | "amounts"
    | "buyQuantity"
    | "getQuantity"
    | "scope"
    | "productIds"
    | "collectionIds"
    | "minimumSpend"
    | "minimumQuantity"
    | "startsAt"
    | "endsAt"
    | "usageLimit"
    | "perCustomerLimit"
  >,
  context: SummaryContext,
): string {
  const parts = [offerPart(discount, context)];
  const spend = discount.minimumSpend[context.currency];
  if (spend !== undefined && spend > 0) {
    parts.push(
      t(
        discount.scope === "order"
          ? "shop.discounts.summary.minimumOrder"
          : "shop.discounts.summary.minimumItems",
        { amount: shortMoney(spend, context.currency) },
      ),
    );
  }
  if (discount.minimumQuantity) {
    parts.push(t("shop.discounts.summary.minimumQuantity", { count: discount.minimumQuantity }));
  }
  const datePart = datesPart(discount.startsAt, discount.endsAt, context.now);
  if (datePart) parts.push(datePart);
  if (discount.usageLimit) {
    parts.push(t("shop.discounts.summary.usageLimit", { count: discount.usageLimit }));
  }
  if (discount.perCustomerLimit === 1) {
    parts.push(t("shop.discounts.summary.oncePerCustomer"));
  } else if (discount.perCustomerLimit) {
    parts.push(t("shop.discounts.summary.perCustomer", { count: discount.perCustomerLimit }));
  }
  return parts.join(", ");
}

function offerPart(
  discount: Parameters<typeof summariseDiscount>[0],
  context: SummaryContext,
): string {
  const scope = scopeText(discount, context);
  switch (discount.kind) {
    case "percentage":
      return t("shop.discounts.summary.percentOff", {
        percent: discount.percentOff ?? 0,
        scope,
      });
    case "fixed_amount":
      return t("shop.discounts.summary.amountOff", {
        amount: shortMoney(discount.amounts[context.currency] ?? 0, context.currency),
        scope,
      });
    case "free_shipping":
      return discount.scope === "order"
        ? t("shop.discounts.summary.freeShipping")
        : t("shop.discounts.summary.freeShippingOn", { scope });
    case "buy_x_get_y": {
      const offer =
        (discount.percentOff ?? 100) >= 100
          ? t("shop.discounts.summary.buyGetFree", {
              buy: discount.buyQuantity,
              get: discount.getQuantity,
            })
          : t("shop.discounts.summary.buyGetPercent", {
              buy: discount.buyQuantity,
              get: discount.getQuantity,
              percent: discount.percentOff ?? 0,
            });
      return discount.scope === "order"
        ? offer
        : t("shop.discounts.summary.offerOn", { offer, scope });
    }
  }
}

function scopeText(
  discount: Pick<DiscountInput, "scope" | "productIds" | "collectionIds">,
  context: SummaryContext,
): string {
  if (discount.scope === "order") return t("shop.discounts.summary.everything");
  const [ids, names, many] =
    discount.scope === "products"
      ? [discount.productIds, context.productNames, "shop.discounts.summary.products" as const]
      : [
          discount.collectionIds,
          context.collectionNames,
          "shop.discounts.summary.collections" as const,
        ];
  const known = ids.flatMap((id) => {
    const name = names.get(id);
    return name ? [name] : [];
  });
  if (known.length === ids.length && ids.length > 0 && ids.length <= 2) {
    return known.join(t("shop.discounts.summary.and"));
  }
  return t(many, { count: ids.length });
}

function datesPart(startsAt: string, endsAt: string | null, now: Date): string | null {
  const start = new Date(startsAt);
  const startsLater = start > now;
  if (endsAt && startsLater) {
    return t("shop.discounts.summary.between", {
      start: shortDate(start, now),
      end: shortDate(new Date(endsAt), now),
    });
  }
  if (endsAt) return t("shop.discounts.summary.until", { date: shortDate(new Date(endsAt), now) });
  if (startsLater) return t("shop.discounts.summary.from", { date: shortDate(start, now) });
  return null;
}

/** "31 Aug", or "31 Aug 2027" when it isn't this year. */
export function shortDate(date: Date, now: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
}

/** "£50" for whole amounts, "£49.99" otherwise. */
export function shortMoney(amount: number, currency: string): string {
  const places = decimalPlaces(currency);
  const whole = amount % 10 ** places === 0;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : places,
      maximumFractionDigits: places,
    }).format(amount / 10 ** places);
  } catch {
    return `${amount} ${currency}`;
  }
}

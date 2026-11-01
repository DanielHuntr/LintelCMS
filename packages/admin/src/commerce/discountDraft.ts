import type {
  Discount,
  DiscountInput,
  DiscountKind,
  DiscountMethod,
  DiscountScope,
} from "./discounts.api.js";
import { inputToMinor, minorToInput } from "./money.js";

/**
 * The discount editor's form state: what's typed, as typed (amounts as "10.00", dates as
 * "2026-08-31"), and turning it into what the API takes. Amounts are kept per currency, one
 * box for each market's currency.
 */
export interface DiscountDraft {
  title: string;
  method: DiscountMethod;
  code: string;
  kind: DiscountKind;
  percentText: string;
  amountTexts: Record<string, string>;
  buyText: string;
  getText: string;
  /** Buy X get Y: "free" or a percentage off. */
  getFree: boolean;
  scope: DiscountScope;
  productIds: string[];
  collectionIds: string[];
  minimum: "none" | "spend" | "quantity";
  minimumSpendTexts: Record<string, string>;
  minimumQuantityText: string;
  startDate: string;
  endDate: string;
  usageLimitText: string;
  oncePerCustomer: boolean;
  combinesWithOthers: boolean;
  enabled: boolean;
}

export type DraftProblem =
  | "titleRequired"
  | "codeRequired"
  | "codeFormat"
  | "percent"
  | "amount"
  | "quantity"
  | "products"
  | "collections"
  | "endBeforeStart";

export function emptyDiscountDraft(today: string): DiscountDraft {
  return {
    title: "",
    method: "code",
    code: "",
    kind: "percentage",
    percentText: "10",
    amountTexts: {},
    buyText: "2",
    getText: "1",
    getFree: true,
    scope: "order",
    productIds: [],
    collectionIds: [],
    minimum: "none",
    minimumSpendTexts: {},
    minimumQuantityText: "",
    startDate: today,
    endDate: "",
    usageLimitText: "",
    oncePerCustomer: false,
    combinesWithOthers: true,
    enabled: true,
  };
}

export function draftFromDiscount(discount: Discount): DiscountDraft {
  const texts = (amounts: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(amounts).map(([currency, amount]) => [
        currency,
        minorToInput(amount, currency),
      ]),
    );
  return {
    title: discount.title,
    method: discount.method,
    code: discount.code ?? "",
    kind: discount.kind,
    percentText: String(discount.percentOff || 10),
    amountTexts: texts(discount.amounts),
    buyText: String(discount.buyQuantity || 2),
    getText: String(discount.getQuantity || 1),
    getFree: discount.kind !== "buy_x_get_y" || discount.percentOff >= 100,
    scope: discount.scope,
    productIds: discount.productIds,
    collectionIds: discount.collectionIds,
    minimum:
      Object.keys(discount.minimumSpend).length > 0
        ? "spend"
        : discount.minimumQuantity
          ? "quantity"
          : "none",
    minimumSpendTexts: texts(discount.minimumSpend),
    minimumQuantityText: discount.minimumQuantity ? String(discount.minimumQuantity) : "",
    startDate: toDateInput(discount.startsAt),
    endDate: discount.endsAt ? toDateInput(discount.endsAt) : "",
    usageLimitText: discount.usageLimit ? String(discount.usageLimit) : "",
    oncePerCustomer: discount.perCustomerLimit === 1,
    combinesWithOthers: discount.combinesWithOthers,
    enabled: discount.enabled,
  };
}

/** The API's input, or what needs fixing first, by field. */
export function discountInputFromDraft(
  draft: DiscountDraft,
  currencies: readonly string[],
): { input: DiscountInput; problems: Partial<Record<string, DraftProblem>> } {
  const problems: Partial<Record<string, DraftProblem>> = {};
  const code = draft.code.trim().toUpperCase();
  if (!draft.title.trim()) problems.title = "titleRequired";
  if (draft.method === "code") {
    if (!code) problems.code = "codeRequired";
    else if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) problems.code = "codeFormat";
  }
  const percent = wholeNumber(draft.percentText);
  const needsPercent =
    draft.kind === "percentage" || (draft.kind === "buy_x_get_y" && !draft.getFree);
  if (needsPercent && (percent === null || percent < 1 || percent > 100)) {
    problems.percentOff = "percent";
  }
  const amounts = readAmounts(draft.amountTexts, currencies);
  if (draft.kind === "fixed_amount" && (amounts === null || Object.keys(amounts).length === 0)) {
    problems.amounts = "amount";
  }
  const buy = wholeNumber(draft.buyText);
  const get = wholeNumber(draft.getText);
  if (draft.kind === "buy_x_get_y" && (!buy || !get || buy > 100 || get > 100)) {
    problems.buyQuantity = "quantity";
  }
  if (draft.scope === "products" && draft.productIds.length === 0) problems.productIds = "products";
  if (draft.scope === "collections" && draft.collectionIds.length === 0) {
    problems.collectionIds = "collections";
  }
  const minimumSpend =
    draft.minimum === "spend" ? readAmounts(draft.minimumSpendTexts, currencies) : {};
  if (
    minimumSpend === null ||
    (draft.minimum === "spend" && Object.keys(minimumSpend).length === 0)
  ) {
    problems.minimumSpend = "amount";
  }
  const minimumQuantity =
    draft.minimum === "quantity" ? wholeNumber(draft.minimumQuantityText) : null;
  if (draft.minimum === "quantity" && !minimumQuantity) problems.minimumQuantity = "quantity";
  if (draft.endDate && draft.startDate && draft.endDate < draft.startDate) {
    problems.endsAt = "endBeforeStart";
  }
  return {
    input: {
      title: draft.title.trim(),
      method: draft.method,
      code: draft.method === "code" ? code : null,
      kind: draft.kind,
      percentOff: draft.kind === "buy_x_get_y" && draft.getFree ? 100 : (percent ?? undefined),
      amounts: amounts ?? {},
      buyQuantity: buy ?? 1,
      getQuantity: get ?? 1,
      scope: draft.scope,
      productIds: draft.scope === "products" ? draft.productIds : [],
      collectionIds: draft.scope === "collections" ? draft.collectionIds : [],
      minimumSpend: minimumSpend ?? {},
      minimumQuantity,
      startsAt: startOfDay(draft.startDate),
      endsAt: draft.endDate ? endOfDay(draft.endDate) : null,
      usageLimit: wholeNumber(draft.usageLimitText),
      perCustomerLimit: draft.oncePerCustomer ? 1 : null,
      combinesWithOthers: draft.combinesWithOthers,
      enabled: draft.enabled,
    },
    problems,
  };
}

/** A code that's easy to read aloud: no 0/O or 1/I to mix up. */
export function suggestCode(random: () => number = Math.random): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => letters[Math.floor(random() * letters.length)]).join("");
}

function readAmounts(
  texts: Record<string, string>,
  currencies: readonly string[],
): Record<string, number> | null {
  const amounts: Record<string, number> = {};
  for (const currency of currencies) {
    const text = texts[currency]?.trim() ?? "";
    if (!text) continue;
    const amount = inputToMinor(text, currency);
    if (amount === null || amount <= 0) return null;
    amounts[currency] = amount;
  }
  return amounts;
}

function wholeNumber(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0 ? Number(trimmed) : null;
}

/** "2026-08-31" from a date and time, in the browser's own time zone. */
export function toDateInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(dateText: string): string {
  return new Date(`${dateText}T00:00:00`).toISOString();
}

/** A discount "until 31 Aug" works all of 31 August. */
function endOfDay(dateText: string): string {
  return new Date(`${dateText}T23:59:59`).toISOString();
}

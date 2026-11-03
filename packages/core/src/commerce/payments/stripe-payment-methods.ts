import { z } from "zod";
import type { StripeClient } from "./stripe-client.js";
import type { WayToPay } from "./ways-to-pay.schema.js";

/**
 * Which payment methods Stripe offers this shop's shoppers. Lintel never lists methods when
 * it starts a payment, so Stripe uses the account's default Payment Method Configuration:
 * the same switches as Settings → Payment methods in its dashboard.
 */

/** The usual ones, in the order they read best. Anything else is named from Stripe's id. */
const METHOD_NAMES: Record<string, string> = {
  card: "Card",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  link: "Link",
  klarna: "Klarna",
  afterpay_clearpay: "Clearpay",
  affirm: "Affirm",
  ideal: "iDEAL",
  bancontact: "Bancontact",
  eps: "EPS",
  p24: "Przelewy24",
  sepa_debit: "SEPA Direct Debit",
  bacs_debit: "Bacs Direct Debit",
  us_bank_account: "US bank account",
  acss_debit: "Canadian pre-authorised debit",
  wechat_pay: "WeChat Pay",
  alipay: "Alipay",
};

const methodSettingSchema = z.object({
  available: z.boolean(),
  display_preference: z.object({ value: z.string().nullish() }).nullish(),
});

const configurationsSchema = z.object({
  data: z.array(z.looseObject({ is_default: z.boolean().nullish() })),
});

/**
 * Null when the account has no default configuration to read. `available` means shoppers can
 * be offered it; switched on but not available means Stripe hasn't approved it yet.
 */
export async function listStripePaymentMethods(stripe: StripeClient): Promise<WayToPay[] | null> {
  const configurations = await stripe.get(
    "/v1/payment_method_configurations?limit=100",
    configurationsSchema,
  );
  const configuration = configurations.data.find((candidate) => candidate.is_default);
  if (!configuration) return null;

  const methods: WayToPay[] = [];
  for (const [id, value] of Object.entries(configuration)) {
    const setting = methodSettingSchema.safeParse(value);
    if (!setting.success) continue;
    const switchedOn = setting.data.display_preference?.value === "on";
    if (setting.data.available || switchedOn) {
      methods.push({ id, name: methodName(id), waiting: !setting.data.available });
    }
  }
  return methods.sort((first, second) => rank(first.id) - rank(second.id));
}

function methodName(id: string): string {
  const words = id.replaceAll("_", " ");
  return METHOD_NAMES[id] ?? `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function rank(id: string): number {
  const position = Object.keys(METHOD_NAMES).indexOf(id);
  return position === -1 ? Number.MAX_SAFE_INTEGER : position;
}

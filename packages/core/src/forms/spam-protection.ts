import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The checks that keep bots out without bothering people:
 *
 *   - a honeypot: a field hidden from people (`_website`) that bots fill in;
 *   - timing: the form's schema carries a signed "opened at" token (`_token`), and a
 *     submission sent within a few seconds of opening can only be a script;
 *   - a rate limit per address, set on the route (see public-forms.routes.ts);
 *   - optionally Cloudflare Turnstile, when both keys are set in the forms settings.
 *
 * A bot caught by the honeypot or the timer is told its submission was received, so it has
 * no reason to try again differently; nothing is stored or sent.
 */
export const HONEYPOT_FIELD = "_website";
export const TOKEN_FIELD = "_token";
/** The name Turnstile's widget gives the answer it adds to the form. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

/** Quicker than any person could read and fill in a form. */
export const FASTEST_HUMAN_MILLISECONDS = 3_000;
/** A form left open longer than this has to be reloaded, so old tokens can't be reused. */
export const TOKEN_LIFETIME_MILLISECONDS = 24 * 60 * 60_000;

export function generateSigningSecret(): string {
  return randomBytes(32).toString("hex");
}

/** `<opened at, in ms>.<signature>`, tied to one form so it can't be used on another. */
export function issueFormToken(secret: string, formId: string, now = new Date()): string {
  const openedAt = String(now.getTime());
  return `${openedAt}.${sign(secret, formId, openedAt)}`;
}

export type TokenCheck = "fine" | "tooFast" | "expired" | "invalid";

export function checkFormToken(
  secret: string,
  formId: string,
  token: unknown,
  now = new Date(),
): TokenCheck {
  if (typeof token !== "string") return "invalid";
  const [openedAt = "", signature = ""] = token.split(".");
  const expected = Buffer.from(sign(secret, formId, openedAt));
  const received = Buffer.from(signature);
  if (
    !/^\d{1,15}$/.test(openedAt) ||
    received.length !== expected.length ||
    !timingSafeEqual(expected, received)
  ) {
    return "invalid";
  }
  const age = now.getTime() - Number(openedAt);
  if (age < FASTEST_HUMAN_MILLISECONDS) return "tooFast";
  if (age > TOKEN_LIFETIME_MILLISECONDS) return "expired";
  return "fine";
}

function sign(secret: string, formId: string, openedAt: string): string {
  return createHmac("sha256", secret).update(`${formId}.${openedAt}`).digest("base64url");
}

/** Any text in the honeypot means a bot: people never see the field. */
export function honeypotWasFilled(value: unknown): boolean {
  const values = Array.isArray(value) ? value : [value];
  return values.some((item) => typeof item === "string" && item.trim() !== "");
}

/** Asks Cloudflare whether a Turnstile answer is genuine. Tests hand in their own. */
export type TurnstileVerifier = (check: {
  secretKey: string;
  response: string;
  remoteIp: string;
}) => Promise<boolean>;

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const verifyWithCloudflare: TurnstileVerifier = async ({
  secretKey,
  response,
  remoteIp,
}) => {
  const answer = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    body: new URLSearchParams({ secret: secretKey, response, remoteip: remoteIp }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!answer.ok) return false;
  const result = (await answer.json()) as { success?: unknown };
  return result.success === true;
};

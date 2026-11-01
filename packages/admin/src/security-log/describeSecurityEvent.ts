import { type StringKey, t } from "../i18n/strings.js";
import type { SecurityEvent } from "./securityLog.api.js";

/** Every kind of event, in the order the filter lists them. */
export const securityEventKinds = [
  "sign-in",
  "sign-in-failed",
  "two-factor-failed",
  "password-changed",
  "password-reset-requested",
  "password-reset",
  "email-changed",
  "user-invited",
  "invitation-accepted",
  "invitation-revoked",
  "role-changed",
  "user-deactivated",
  "user-reactivated",
  "user-removed",
  "role-created",
  "role-updated",
  "role-deleted",
  "two-factor-enabled",
  "two-factor-disabled",
  "recovery-codes-created",
  "passkey-added",
  "passkey-removed",
  "sessions-ended",
  "api-token-created",
  "api-token-deleted",
  "lintel-update-started",
  "lintel-rolled-back",
] as const;

export function securityEventName(kind: string): string {
  const key = `securityLog.kind.${kind}` as StringKey;
  return (securityEventKinds as readonly string[]).includes(kind) ? t(key) : kind;
}

/** A sentence's worth of what happened, from the event's details. */
export function describeSecurityEvent(event: SecurityEvent): string {
  const details = event.details;
  const parts: string[] = [];
  if (event.subject?.name) parts.push(event.subject.name);
  if (typeof details.from === "string" && typeof details.to === "string") {
    parts.push(t("securityLog.fromTo", { from: details.from, to: details.to }));
  }
  for (const key of ["role", "email", "token", "passkey", "method"] as const) {
    const value = details[key];
    if (typeof value === "string") parts.push(value);
  }
  return parts.join(" · ");
}

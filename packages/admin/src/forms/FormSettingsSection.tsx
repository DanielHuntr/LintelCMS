import { Link } from "@tanstack/react-router";
import { useId, type ReactNode } from "react";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { useEmailStatus } from "../email-outbox/emailStatus.queries.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import type { FormChanges, FormConfirmation, FormNotifications } from "./forms.types.js";
import { TextAreaField } from "./TextAreaField.js";

/** The parts of a form the Settings tab changes. */
export type FormSettingsDraft = Required<
  Pick<
    FormChanges,
    "submitLabel" | "confirmation" | "notifications" | "retentionDays" | "acceptingSubmissions"
  >
>;

interface FormSettingsSectionProps {
  draft: FormSettingsDraft;
  hasEmailField: boolean;
  onChange: (changes: Partial<FormSettingsDraft>) => void;
}

/** After sending, who's told, and how long answers are kept. */
export function FormSettingsSection({ draft, hasEmailField, onChange }: FormSettingsSectionProps) {
  const { confirmation, notifications } = draft;
  const emailStatus = useEmailStatus();
  const sendsEmail = notifications.notifyOwner || notifications.confirmationEmail.enabled;
  const setNotifications = (changes: Partial<FormNotifications>) =>
    onChange({ notifications: { ...notifications, ...changes } });
  const setConfirmationEmail = (changes: Partial<FormNotifications["confirmationEmail"]>) =>
    setNotifications({ confirmationEmail: { ...notifications.confirmationEmail, ...changes } });

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <SettingsGroup title={t("forms.settings.sendingTitle")}>
        <Toggle
          label={t("forms.settings.accepting")}
          checked={draft.acceptingSubmissions}
          onCheckedChange={(acceptingSubmissions) => onChange({ acceptingSubmissions })}
        />
        <TextField
          label={t("forms.settings.submitLabel")}
          value={draft.submitLabel}
          maxLength={60}
          onChange={(event) => onChange({ submitLabel: event.target.value })}
        />
      </SettingsGroup>

      <SettingsGroup title={t("forms.settings.afterTitle")}>
        <SegmentedControl<FormConfirmation["type"]>
          label={t("forms.settings.afterTitle")}
          options={[
            { value: "message", label: t("forms.settings.showMessage") },
            { value: "redirect", label: t("forms.settings.goToPage") },
          ]}
          value={confirmation.type}
          onChange={(type) =>
            onChange({
              confirmation:
                type === "message"
                  ? {
                      type,
                      message:
                        confirmation.type === "message"
                          ? confirmation.message
                          : t("forms.settings.defaultThanks"),
                    }
                  : { type, url: confirmation.type === "redirect" ? confirmation.url : "/" },
            })
          }
        />
        {confirmation.type === "message" ? (
          <TextAreaField
            label={t("forms.settings.message")}
            value={confirmation.message}
            rows={3}
            onChange={(event) =>
              onChange({ confirmation: { type: "message", message: event.target.value } })
            }
          />
        ) : (
          <TextField
            label={t("forms.settings.redirectUrl")}
            hint={t("forms.settings.redirectHint")}
            value={confirmation.url}
            onChange={(event) =>
              onChange({ confirmation: { type: "redirect", url: event.target.value } })
            }
          />
        )}
      </SettingsGroup>

      <SettingsGroup title={t("forms.settings.emailsTitle")}>
        {sendsEmail && emailStatus.data?.delivers === false && (
          <p
            role="note"
            className="rounded-control bg-warning/12 px-3 py-2 text-footnote text-label"
          >
            {t("forms.settings.emailNotSetUp")} {t("forms.settings.emailNextStep")}{" "}
            <Link
              to="/help"
              search={{ topic: "using/forms", anchor: "emails" }}
              className="font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
            >
              {t("forms.settings.emailHelp")}
            </Link>
          </p>
        )}
        <Toggle
          label={t("forms.settings.notifyOwner")}
          checked={notifications.notifyOwner}
          onCheckedChange={(notifyOwner) => setNotifications({ notifyOwner })}
        />
        {notifications.notifyOwner && (
          <>
            <TextField
              label={t("forms.settings.recipients")}
              hint={t("forms.settings.recipientsHint")}
              value={notifications.recipients.join(", ")}
              onChange={(event) =>
                setNotifications({
                  recipients: event.target.value
                    .split(/[,\s]+/)
                    .filter((address) => address !== ""),
                })
              }
            />
            <TextField
              label={t("forms.settings.subject")}
              hint={t("forms.settings.subjectHint")}
              value={notifications.subject}
              onChange={(event) => setNotifications({ subject: event.target.value })}
            />
          </>
        )}
        <Toggle
          label={t("forms.settings.confirmationEmail")}
          checked={notifications.confirmationEmail.enabled}
          onCheckedChange={(enabled) => setConfirmationEmail({ enabled })}
        />
        {notifications.confirmationEmail.enabled && (
          <>
            {!hasEmailField && (
              <p
                role="note"
                className="rounded-control bg-warning/12 px-3 py-2 text-footnote text-label"
              >
                {t("forms.settings.needsEmailField")}
              </p>
            )}
            <TextField
              label={t("forms.settings.confirmationSubject")}
              value={notifications.confirmationEmail.subject}
              onChange={(event) => setConfirmationEmail({ subject: event.target.value })}
            />
            <TextAreaField
              label={t("forms.settings.confirmationMessage")}
              hint={t("forms.settings.subjectHint")}
              rows={4}
              value={notifications.confirmationEmail.message}
              onChange={(event) => setConfirmationEmail({ message: event.target.value })}
            />
          </>
        )}
      </SettingsGroup>

      <SettingsGroup title={t("forms.settings.keepTitle")} footer={t("forms.settings.keepFooter")}>
        <SegmentedControl<"forever" | "days">
          label={t("forms.settings.keepTitle")}
          options={[
            { value: "forever", label: t("forms.settings.keepForever") },
            { value: "days", label: t("forms.settings.keepDays") },
          ]}
          value={draft.retentionDays === null ? "forever" : "days"}
          onChange={(choice) => onChange({ retentionDays: choice === "forever" ? null : 90 })}
        />
        {draft.retentionDays !== null && (
          <TextField
            type="number"
            inputMode="numeric"
            min={1}
            max={3650}
            label={t("forms.settings.days")}
            value={draft.retentionDays}
            onChange={(event) =>
              onChange({ retentionDays: Math.max(1, Math.round(Number(event.target.value) || 1)) })
            }
            className="max-w-40"
          />
        )}
      </SettingsGroup>
    </div>
  );
}

function SettingsGroup({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1.5">
      <h2 id={headingId} className="px-4 text-footnote font-medium text-label-secondary">
        {title}
      </h2>
      <div className="flex flex-col gap-4 rounded-card bg-surface p-4">{children}</div>
      {footer && <p className="px-4 text-footnote text-label-secondary">{footer}</p>}
    </section>
  );
}

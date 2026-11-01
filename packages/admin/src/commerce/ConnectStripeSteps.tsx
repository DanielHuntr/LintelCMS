import { CircleCheck, ExternalLink } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { CopyButton } from "../design/CopyButton.js";
import { PasswordField } from "../design/PasswordField.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { PaymentSettings } from "./shopSettings.api.js";
import { useCheckStripeConnection, useSavePaymentKeys } from "./shopSettings.queries.js";

const STRIPE_KEYS_PAGE = "https://dashboard.stripe.com/test/apikeys";
const STRIPE_WEBHOOKS_PAGE = "https://dashboard.stripe.com/test/webhooks/create";

/**
 * "Connect Stripe" in four numbered steps, each saying exactly where in Stripe to click and
 * which key goes in which box. Keys set on the server are shown as set and can't be changed.
 */
export function ConnectStripeSteps({
  settings,
  canChange,
}: {
  settings: PaymentSettings;
  canChange: boolean;
}) {
  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const saveKeys = useSavePaymentKeys();
  const savePublishable = useSavePaymentKeys();
  const saveWebhook = useSavePaymentKeys();
  const check = useCheckStripeConnection();
  const fromServer = (source: string | undefined) => source === "environment";

  function submitKeys(event: FormEvent) {
    event.preventDefault();
    saveKeys.mutate(
      {
        secretKey: secretKey.trim(),
        ...(publishableKey.trim() && { publishableKey: publishableKey.trim() }),
      },
      { onSuccess: () => setSecretKey("") },
    );
  }

  return (
    <ol className="flex flex-col gap-6" aria-label={t("shop.payments.stepsLabel")}>
      <Step number={1} title={t("shop.payments.step1Title")} done={settings.secretKey !== null}>
        <p>{t("shop.payments.step1Body")}</p>
        <ExternalButton href="https://dashboard.stripe.com/register">
          {t("shop.payments.step1Action")}
        </ExternalButton>
      </Step>

      <Step
        number={2}
        title={t("shop.payments.step2Title")}
        done={settings.secretKey !== null && settings.publishableKey !== null}
      >
        <p>{t("shop.payments.step2Body")}</p>
        <ExternalButton href={STRIPE_KEYS_PAGE}>{t("shop.payments.step2Action")}</ExternalButton>
        {fromServer(settings.secretKey?.source) ? (
          <p className="text-footnote text-label-secondary">
            {t("shop.payments.keysFromServer", { hint: settings.secretKey?.hint ?? "" })}
          </p>
        ) : (
          canChange && (
            <form onSubmit={submitKeys} className="flex flex-col gap-4">
              <TextField
                label={t("shop.payments.publishableKeyLabel")}
                hint={t("shop.payments.publishableKeyHint")}
                placeholder={settings.publishableKey?.value ?? "pk_test_…"}
                value={publishableKey}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setPublishableKey(event.target.value)}
              />
              <PasswordField
                label={t("shop.payments.secretKeyLabel")}
                hint={
                  settings.secretKey
                    ? t("shop.payments.secretKeySaved", { hint: settings.secretKey.hint })
                    : t("shop.payments.secretKeyHint")
                }
                placeholder="sk_test_…"
                value={secretKey}
                autoComplete="off"
                onChange={(event) => setSecretKey(event.target.value)}
                error={saveKeys.error ? describeError(saveKeys.error) : undefined}
              />
              <div className="flex gap-3">
                <Button type="submit" disabled={saveKeys.isPending || secretKey.trim() === ""}>
                  {saveKeys.isPending
                    ? t("shop.payments.checkingKey")
                    : t("shop.payments.saveKeys")}
                </Button>
                {settings.secretKey && publishableKey.trim() !== "" && secretKey.trim() === "" && (
                  <Button
                    variant="tinted"
                    onClick={() =>
                      savePublishable.mutate({ publishableKey: publishableKey.trim() })
                    }
                  >
                    {t("shop.payments.savePublishable")}
                  </Button>
                )}
              </div>
            </form>
          )
        )}
      </Step>

      <Step number={3} title={t("shop.payments.step3Title")} done={settings.webhookSecret !== null}>
        <p>{t("shop.payments.step3Body")}</p>
        <ExternalButton href={STRIPE_WEBHOOKS_PAGE}>
          {t("shop.payments.step3Action")}
        </ExternalButton>
        <div className="flex flex-col gap-1.5">
          <p className="text-footnote font-medium text-label">{t("shop.payments.endpointUrl")}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-control bg-fill px-3 py-2 text-footnote text-label">
              {settings.webhookUrl}
            </code>
            <CopyButton value={settings.webhookUrl} label={t("shop.payments.copyUrl")} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-footnote font-medium text-label">
            {t("shop.payments.eventsToChoose")}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {settings.webhookEvents.map((event) => (
              <li key={event}>
                <code className="rounded-control bg-fill px-2 py-1 text-caption text-label">
                  {event}
                </code>
              </li>
            ))}
          </ul>
        </div>
        {fromServer(settings.webhookSecret?.source) ? (
          <p className="text-footnote text-label-secondary">
            {t("shop.payments.secretFromServer")}
          </p>
        ) : (
          canChange && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveWebhook.mutate(
                  { webhookSecret: webhookSecret.trim() },
                  { onSuccess: () => setWebhookSecret("") },
                );
              }}
            >
              <PasswordField
                label={t("shop.payments.signingSecretLabel")}
                hint={
                  settings.webhookSecret
                    ? t("shop.payments.signingSecretSaved")
                    : t("shop.payments.signingSecretHint")
                }
                placeholder="whsec_…"
                value={webhookSecret}
                autoComplete="off"
                onChange={(event) => setWebhookSecret(event.target.value)}
                error={saveWebhook.error ? describeError(saveWebhook.error) : undefined}
              />
              <div>
                <Button
                  type="submit"
                  disabled={saveWebhook.isPending || webhookSecret.trim() === ""}
                >
                  {t("shop.payments.saveSecret")}
                </Button>
              </div>
            </form>
          )
        )}
      </Step>

      <Step number={4} title={t("shop.payments.step4Title")} done={check.isSuccess}>
        <p>{t("shop.payments.step4Body")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="tinted"
            disabled={!settings.secretKey || check.isPending}
            onClick={() => check.mutate()}
          >
            {check.isPending ? t("shop.payments.checking") : t("shop.payments.check")}
          </Button>
          <p role="status" className="text-footnote text-label-secondary">
            {check.data ? t("shop.payments.checkOk", { name: check.data.accountName }) : ""}
          </p>
        </div>
        {check.error && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(check.error)}
          </p>
        )}
      </Step>
    </ol>
  );
}

function Step({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      <Card>
        <div className="flex gap-4">
          <span
            aria-hidden="true"
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-footnote font-semibold ${done ? "bg-success text-on-accent" : "bg-accent/14 text-accent"}`}
          >
            {done ? <CircleCheck className="size-4" /> : number}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-3 text-body text-label-secondary">
            <h2 className="text-headline text-label">
              <span className="sr-only">{t("shop.payments.stepNumber", { number })} </span>
              {title}
              {done && <span className="sr-only"> ({t("shop.setup.done")})</span>}
            </h2>
            {children}
          </div>
        </div>
      </Card>
    </li>
  );
}

function ExternalButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-1.5 text-body font-medium text-accent underline-offset-2 hover:underline focus-visible:focus-ring"
    >
      {children}
      <ExternalLink aria-hidden="true" className="size-4" />
      <span className="sr-only">{t("help.newTab")}</span>
    </a>
  );
}

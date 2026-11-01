import { useId, useState, type FormEvent, type ReactNode } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { controlClasses } from "../design/controlStyles.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { AccentColourField } from "./AccentColourField.js";
import type { Branding, BrandingSettings } from "./branding.api.js";
import { useBrandingSettings, useResetBranding, useSaveBranding } from "./branding.queries.js";
import { BrandingImageField } from "./BrandingImageField.js";

/**
 * /settings/branding: the name, logo, colour and help links clients see, for agencies
 * selling the admin under their own (or their client's) brand. Needs `branding:update`.
 */
export function BrandingPage() {
  const settings = useBrandingSettings();
  // A reset brings new values, so the form starts again from them.
  const [timesReset, setTimesReset] = useState(0);

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle title={t("branding.title")} subtitle={t("branding.subtitle")} />
      {settings.isError && (
        <LoadError error={settings.error} onRetry={() => void settings.refetch()} />
      )}
      {settings.isPending && (
        <LoadingRegion label={t("branding.loading")}>
          <Skeleton className="h-96 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {settings.data && (
        <BrandingForm
          key={timesReset}
          settings={settings.data}
          onReset={() => setTimesReset((count) => count + 1)}
        />
      )}
    </>
  );
}

function BrandingForm({ settings, onReset }: { settings: BrandingSettings; onReset: () => void }) {
  const [values, setValues] = useState<Branding>(settings.branding);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const save = useSaveBranding();
  const reset = useResetBranding();
  const change = (changes: Partial<Branding>) => {
    save.reset();
    setValues({ ...values, ...changes });
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate(values);
  }

  const resetLabel = settings.defaultsFromDeployment
    ? t("branding.resetToDeployment")
    : t("branding.resetToLintel");

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-8">
      <Section
        title={t("branding.section.identity")}
        description={t("branding.section.identityHint")}
      >
        <TextField
          label={t("branding.productName")}
          hint={t("branding.productNameHint")}
          value={values.productName}
          maxLength={60}
          required
          onChange={(event) => change({ productName: event.target.value })}
        />
        <BrandingImageField
          label={t("branding.logo")}
          hint={t("branding.logoHint")}
          value={values.logo}
          onChange={(logo) => change({ logo })}
        />
        <BrandingImageField
          label={t("branding.logoDark")}
          hint={t("branding.logoDarkHint")}
          value={values.logoDark}
          onDark
          onChange={(logoDark) => change({ logoDark })}
        />
        <BrandingImageField
          label={t("branding.mark")}
          hint={t("branding.markHint")}
          value={values.mark}
          shape="square"
          onChange={(mark) => change({ mark })}
        />
        <BrandingImageField
          label={t("branding.favicon")}
          hint={t("branding.faviconHint")}
          value={values.favicon}
          shape="square"
          onChange={(favicon) => change({ favicon })}
        />
      </Section>

      <Section title={t("branding.section.colour")} description={t("branding.section.colourHint")}>
        <AccentColourField
          value={values.accentColour}
          onChange={(accentColour) => change({ accentColour })}
        />
      </Section>

      <Section title={t("branding.section.signIn")} description={t("branding.section.signInHint")}>
        <TextArea
          id="branding-sign-in-message"
          label={t("branding.signInMessage")}
          hint={t("branding.signInMessageHint")}
          value={values.signInMessage ?? ""}
          maxLength={300}
          onChange={(signInMessage) => change({ signInMessage })}
        />
        <BrandingImageField
          label={t("branding.signInBackground")}
          hint={t("branding.signInBackgroundHint")}
          value={values.signInBackground}
          onChange={(signInBackground) => change({ signInBackground })}
        />
      </Section>

      <Section title={t("branding.section.help")} description={t("branding.section.helpHint")}>
        <TextField
          label={t("branding.supportUrl")}
          hint={t("branding.supportUrlHint")}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={values.supportUrl ?? ""}
          onChange={(event) => change({ supportUrl: event.target.value })}
        />
        <TextField
          label={t("branding.supportEmail")}
          type="email"
          inputMode="email"
          placeholder="help@example.com"
          value={values.supportEmail ?? ""}
          onChange={(event) => change({ supportEmail: event.target.value })}
        />
        <TextField
          label={t("branding.docsUrl")}
          hint={t("branding.docsUrlHint")}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={values.docsUrl ?? ""}
          onChange={(event) => change({ docsUrl: event.target.value })}
        />
        <ToggleWithHint
          label={t("branding.hideLintelHelp")}
          hint={t("branding.hideLintelHelpHint")}
          checked={values.hideLintelHelp}
          onCheckedChange={(hideLintelHelp) => change({ hideLintelHelp })}
        />
      </Section>

      <Section title={t("branding.section.website")}>
        <ToggleWithHint
          label={t("branding.hideBuiltWithLintel")}
          hint={t("branding.hideBuiltWithLintelHint")}
          checked={values.hideBuiltWithLintel}
          onCheckedChange={(hideBuiltWithLintel) => change({ hideBuiltWithLintel })}
        />
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="plain" onClick={() => setIsConfirmingReset(true)}>
          {resetLabel}
        </Button>
        <div className="flex items-center gap-3">
          <p role="status" className="text-footnote text-label-secondary">
            {save.isError ? (
              <span className="text-danger">{describeError(save.error)}</span>
            ) : save.isSuccess ? (
              t("branding.saved")
            ) : (
              ""
            )}
          </p>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t("branding.saving") : t("branding.save")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={isConfirmingReset}
        title={t("branding.resetTitle")}
        message={
          settings.defaultsFromDeployment
            ? t("branding.resetToDeploymentMessage")
            : t("branding.resetToLintelMessage")
        }
        confirmLabel={resetLabel}
        cancelLabel={t("branding.cancel")}
        isWorking={reset.isPending}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: onReset,
            onSettled: () => setIsConfirmingReset(false),
          })
        }
        onCancel={() => setIsConfirmingReset(false)}
      />
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-5 rounded-card bg-surface p-6">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true">
        <p className="text-headline text-label">{title}</p>
        {description && <p className="mt-1 text-footnote text-label-secondary">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}

function TextArea({
  id,
  label,
  hint,
  value,
  maxLength,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-footnote font-medium text-label">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        rows={2}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-16 resize-y py-2 ${controlClasses()}`}
      />
      <p id={`${id}-hint`} className="text-footnote text-label-secondary">
        {hint}
      </p>
    </div>
  );
}

function ToggleWithHint({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1">
      <Toggle
        label={label}
        checked={checked}
        describedBy={hintId}
        onCheckedChange={onCheckedChange}
      />
      <p id={hintId} className="text-footnote text-label-secondary">
        {hint}
      </p>
    </div>
  );
}

import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { erasePersonalData, exportPersonalData, saveFile } from "./forms.api.js";
import { useFormsSettings, useUpdateFormsSettings } from "./forms.queries.js";
import type { FormsSettings, PersonalDataExport } from "./forms.types.js";

/** /forms/settings: spam protection, and requests from people about their own data. */
export function FormsSettingsPage() {
  const settings = useFormsSettings();
  return (
    <>
      <BackLink to="/forms">{t("nav.forms")}</BackLink>
      <LargeTitle
        title={t("forms.siteSettings.title")}
        subtitle={t("forms.siteSettings.subtitle")}
      />
      <div className="flex max-w-2xl flex-col gap-8">
        {settings.isError && (
          <LoadError error={settings.error} onRetry={() => void settings.refetch()} />
        )}
        {settings.isPending && (
          <LoadingRegion label={t("forms.siteSettings.loading")}>
            <Skeleton className="h-40 rounded-card" />
          </LoadingRegion>
        )}
        {settings.data && (
          <SpamProtection key={settings.data.turnstileSiteKey ?? ""} saved={settings.data} />
        )}
        <PrivacyRequests />
      </div>
    </>
  );
}

function SpamProtection({ saved }: { saved: FormsSettings }) {
  const canChange = useCan("settings:update");
  const update = useUpdateFormsSettings();
  const [siteKey, setSiteKey] = useState(saved.turnstileSiteKey ?? "");
  const [secretKey, setSecretKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const isOn = saved.turnstileSiteKey !== null && saved.hasTurnstileSecret;

  return (
    <section aria-labelledby="spam-heading" className="flex flex-col gap-1.5">
      <h2 id="spam-heading" className="px-4 text-footnote font-medium text-label-secondary">
        {t("forms.spam.title")}
      </h2>
      <div className="flex flex-col gap-4 rounded-card bg-surface p-4">
        <p className="text-body text-label">{t("forms.spam.alwaysOn")}</p>
        <p className="text-footnote text-label-secondary">
          {isOn ? t("forms.spam.turnstileOn") : t("forms.spam.turnstileOff")}
        </p>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(null);
            update.mutate(
              {
                turnstileSiteKey: siteKey.trim() || null,
                ...(secretKey.trim() !== "" ? { turnstileSecretKey: secretKey.trim() } : {}),
                ...(siteKey.trim() === "" ? { turnstileSecretKey: null } : {}),
              },
              {
                onSuccess: () => {
                  setSecretKey("");
                  setMessage(t("forms.spam.saved"));
                },
              },
            );
          }}
        >
          <TextField
            label={t("forms.spam.siteKey")}
            value={siteKey}
            disabled={!canChange}
            autoComplete="off"
            onChange={(event) => setSiteKey(event.target.value)}
          />
          <TextField
            label={t("forms.spam.secretKey")}
            hint={
              saved.hasTurnstileSecret ? t("forms.spam.secretSaved") : t("forms.spam.secretHint")
            }
            type="password"
            autoComplete="off"
            value={secretKey}
            disabled={!canChange}
            onChange={(event) => setSecretKey(event.target.value)}
          />
          {update.isError && (
            <p role="alert" className="text-footnote text-danger">
              {describeError(update.error)}
            </p>
          )}
          <p role="status" className="text-footnote text-success">
            {message}
          </p>
          {canChange && (
            <div>
              <Button type="submit" disabled={update.isPending}>
                {t("forms.spam.save")}
              </Button>
            </div>
          )}
        </form>
      </div>
      <p className="px-4 text-footnote text-label-secondary">{t("forms.spam.footer")}</p>
    </section>
  );
}

function PrivacyRequests() {
  const canErase = useCan("forms:delete");
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<PersonalDataExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  async function look() {
    setError(null);
    setStatus(null);
    setIsWorking(true);
    try {
      setFound(await exportPersonalData(email));
    } catch (caught) {
      setFound(null);
      setError(describeError(caught));
    } finally {
      setIsWorking(false);
    }
  }

  async function erase() {
    if (!found) return;
    setIsWorking(true);
    try {
      const { deleted } = await erasePersonalData(found.email);
      setStatus(t("forms.privacy.erased", { count: deleted }));
      setFound(null);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setIsWorking(false);
      setIsConfirming(false);
    }
  }

  return (
    <section aria-labelledby="privacy-heading" className="flex flex-col gap-1.5">
      <h2 id="privacy-heading" className="px-4 text-footnote font-medium text-label-secondary">
        {t("forms.privacy.title")}
      </h2>
      <div className="flex flex-col gap-4 rounded-card bg-surface p-4">
        <p className="text-body text-label">{t("forms.privacy.description")}</p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void look();
          }}
        >
          <div className="min-w-60 flex-1">
            <TextField
              type="email"
              label={t("forms.privacy.email")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button type="submit" variant="tinted" disabled={isWorking || email.trim() === ""}>
            {t("forms.privacy.find")}
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-footnote text-danger">
            {error}
          </p>
        )}
        <div role="status">
          {status && <p className="text-footnote text-success">{status}</p>}
          {found && (
            <div className="flex flex-col gap-3">
              <p className="text-body text-label">
                {found.submissions.length === 0
                  ? t("forms.privacy.nothing", { email: found.email })
                  : t("forms.privacy.found", { count: found.submissions.length })}
              </p>
              {found.submissions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="tinted"
                    icon={<Download aria-hidden="true" />}
                    onClick={() =>
                      saveFile(
                        new Blob([JSON.stringify(found, null, 2)], { type: "application/json" }),
                        `form-data-${found.email}.json`,
                      )
                    }
                  >
                    {t("forms.privacy.download")}
                  </Button>
                  {canErase && (
                    <Button
                      variant="destructive"
                      icon={<Trash2 aria-hidden="true" />}
                      onClick={() => setIsConfirming(true)}
                    >
                      {t("forms.privacy.erase")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="px-4 text-footnote text-label-secondary">{t("forms.privacy.footer")}</p>
      <ConfirmDialog
        open={isConfirming}
        title={t("forms.privacy.eraseTitle", { email: found?.email ?? "" })}
        message={t("forms.privacy.eraseMessage")}
        confirmLabel={t("forms.privacy.erase")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={isWorking}
        onCancel={() => setIsConfirming(false)}
        onConfirm={() => void erase()}
      />
    </section>
  );
}

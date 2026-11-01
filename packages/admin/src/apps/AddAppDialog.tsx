import { TriangleAlert } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { controlClasses } from "../design/controlStyles.js";
import { CopyButton } from "../design/CopyButton.js";
import { Dialog } from "../design/Dialog.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { AppPreview, InstalledApp, ManifestSource } from "./apps.api.js";
import { AppAccessSummary } from "./AppAccessSummary.js";
import { AppIcon } from "./AppIcon.js";
import { useInstallApp, usePreviewApp } from "./apps.queries.js";

interface AddAppDialogProps {
  open: boolean;
  onClose: () => void;
}

type SourceKind = "address" | "pasted";

/**
 * Adding an app takes three steps in one sheet:
 *
 * 1. Where its details are: the address the developer gave, or `lintel-app.json` pasted in.
 * 2. What it asks for, in plain English. Nothing is installed until "Install app".
 * 3. Its client id and secret, to copy into the app. The secret is shown this once.
 */
export function AddAppDialog({ open, onClose }: AddAppDialogProps) {
  const [kind, setKind] = useState<SourceKind>("address");
  const [address, setAddress] = useState("");
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [source, setSource] = useState<ManifestSource | null>(null);
  const [preview, setPreview] = useState<AppPreview | null>(null);
  const [installed, setInstalled] = useState<InstalledApp | null>(null);
  const previewApp = usePreviewApp();
  const installApp = useInstallApp();
  const pastedId = useId();

  function close() {
    setKind("address");
    setAddress("");
    setPasted("");
    setPasteError(null);
    setSource(null);
    setPreview(null);
    setInstalled(null);
    previewApp.reset();
    installApp.reset();
    onClose();
  }

  async function review(event: FormEvent) {
    event.preventDefault();
    const chosen = readSource();
    if (!chosen) return;
    try {
      setPreview(await previewApp.mutateAsync(chosen));
      setSource(chosen);
    } catch {
      // The error is shown under the field.
    }
  }

  function readSource(): ManifestSource | null {
    setPasteError(null);
    if (kind === "address") {
      return { manifestUrl: address.trim() };
    }
    try {
      return { manifest: JSON.parse(pasted) as unknown };
    } catch {
      setPasteError(t("apps.add.pasteNotJson"));
      return null;
    }
  }

  async function install() {
    if (!source || !preview) return;
    try {
      setInstalled(
        await installApp.mutateAsync({ ...source, approvedScopes: preview.manifest.scopes }),
      );
    } catch {
      // The error is shown above the buttons.
    }
  }

  if (installed) {
    return (
      <Dialog
        open={open}
        onClose={close}
        title={t("apps.installed.title", { name: installed.app.name })}
        description={t("apps.installed.description")}
        footer={
          <Button onClick={close} data-autofocus>
            {t("common.done")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Credential label={t("apps.clientId")} value={installed.app.clientId} />
          <Credential label={t("apps.clientSecret")} value={installed.clientSecret} />
          <p className="flex items-start gap-2 text-footnote text-label-secondary">
            <TriangleAlert
              aria-hidden="true"
              strokeWidth={2}
              className="mt-0.5 size-4 shrink-0 text-warning"
            />
            {t("apps.installed.shownOnce")}
          </p>
        </div>
      </Dialog>
    );
  }

  if (preview) {
    const { manifest } = preview;
    return (
      <Dialog
        open={open}
        onClose={close}
        title={t("apps.review.title", { name: manifest.name })}
        description={t("apps.review.description")}
        footer={
          <>
            <Button variant="plain" onClick={() => setPreview(null)}>
              {t("apps.review.back")}
            </Button>
            <Button
              onClick={() => void install()}
              disabled={preview.alreadyInstalled || installApp.isPending}
              data-autofocus
            >
              {installApp.isPending ? t("apps.review.installing") : t("apps.review.install")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <AppIcon iconUrl={manifest.icon ?? null} size="large" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-body text-label">{manifest.description}</p>
              <p className="text-footnote text-label-secondary">
                {manifest.developer
                  ? t("apps.review.madeBy", { developer: manifest.developer.name })
                  : t("apps.review.from", { origin: new URL(manifest.appUrl).host })}
              </p>
            </div>
          </div>
          <AppAccessSummary manifest={manifest} />
          <p className="text-footnote text-label-secondary">{t("apps.review.trust")}</p>
          {preview.alreadyInstalled && (
            <p role="alert" className="text-footnote text-danger">
              {t("apps.review.alreadyInstalled", { name: manifest.name })}
            </p>
          )}
          {installApp.isError && (
            <p role="alert" className="text-footnote whitespace-pre-line text-danger">
              {describeError(installApp.error)}
            </p>
          )}
        </div>
      </Dialog>
    );
  }

  const error = previewApp.isError ? describeError(previewApp.error) : undefined;
  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("apps.add.title")}
      description={t("apps.add.description")}
      footer={
        <>
          <Button variant="plain" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="add-app-form" disabled={previewApp.isPending}>
            {previewApp.isPending ? t("apps.add.checking") : t("apps.add.continue")}
          </Button>
        </>
      }
    >
      <form id="add-app-form" onSubmit={review} className="flex flex-col gap-5">
        <SegmentedControl
          label={t("apps.add.sourceLabel")}
          options={[
            { value: "address", label: t("apps.add.fromAddress") },
            { value: "pasted", label: t("apps.add.fromPasted") },
          ]}
          value={kind}
          onChange={(next) => {
            setKind(next);
            previewApp.reset();
          }}
        />
        {kind === "address" ? (
          <TextField
            label={t("apps.add.addressLabel")}
            hint={t("apps.add.addressHint")}
            type="url"
            inputMode="url"
            placeholder="https://app.example.com/lintel-app.json"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            error={error}
            required
            data-autofocus
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={pastedId} className="text-footnote font-medium text-label">
              {t("apps.add.pastedLabel")}
            </label>
            <textarea
              id={pastedId}
              value={pasted}
              rows={8}
              required
              spellCheck={false}
              aria-invalid={Boolean(pasteError ?? error)}
              aria-describedby={`${pastedId}-hint`}
              onChange={(event) => setPasted(event.target.value)}
              className={`min-h-40 resize-y py-2 font-mono text-footnote ${controlClasses({ hasError: Boolean(pasteError ?? error) })}`}
            />
            <p
              id={`${pastedId}-hint`}
              className={`text-footnote whitespace-pre-line ${(pasteError ?? error) ? "text-danger" : "text-label-secondary"}`}
            >
              {pasteError ?? error ?? t("apps.add.pastedHint")}
            </p>
          </div>
        )}
      </form>
    </Dialog>
  );
}

function Credential({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-footnote font-medium text-label">{label}</p>
      <div className="flex items-center gap-2 rounded-control bg-fill p-2 pl-3">
        <code
          aria-label={label}
          className="min-w-0 flex-1 font-mono text-footnote break-all text-label select-all"
        >
          {value}
        </code>
        <CopyButton value={value} label={t("apps.copy", { what: label })} />
      </div>
    </div>
  );
}

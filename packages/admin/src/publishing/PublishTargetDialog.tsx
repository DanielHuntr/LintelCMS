import { useCan } from "../session/SessionContext.js";
import { Cloud, Folder, FolderArchive, Server, Terminal } from "lucide-react";
import { type FormEvent, useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { ChoiceCardGroup } from "../design/ChoiceCardGroup.js";
import { Dialog } from "../design/Dialog.js";
import { PasswordField } from "../design/PasswordField.js";
import { SelectField } from "../design/SelectField.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useSites } from "../sites/sites.queries.js";
import type {
  FormDelivery,
  PublishTarget,
  PublishTargetInput,
  PublishTargetKind,
  PublishTargetOptions,
  PublishTargetSecrets,
} from "./publishing.api.js";

interface PublishTargetDialogProps {
  /** Left out when adding a new destination. */
  target?: PublishTarget;
  isSaving: boolean;
  error: unknown;
  onSubmit: (input: PublishTargetInput) => void;
  onClose: () => void;
}

const kindChoices = [
  {
    value: "ftp",
    icon: Server,
    title: t("publishing.kind.ftp"),
    description: t("publishing.kind.ftp.description"),
  },
  {
    value: "sftp",
    icon: Terminal,
    title: t("publishing.kind.sftp"),
    description: t("publishing.kind.sftp.description"),
  },
  {
    value: "zip",
    icon: FolderArchive,
    title: t("publishing.kind.zip"),
    description: t("publishing.kind.zip.description"),
  },
  {
    value: "s3",
    icon: Cloud,
    title: t("publishing.kind.s3"),
    description: t("publishing.kind.s3.description"),
  },
  {
    value: "folder",
    icon: Folder,
    title: t("publishing.kind.folder"),
    description: t("publishing.kind.folder.description"),
  },
] as const;

/**
 * Adding or changing a publishing destination: what kind it is, how to reach it and how
 * forms work there. Saved passwords are never shown; typing a new one replaces it.
 */
export function PublishTargetDialog({
  target,
  isSaving,
  error,
  onSubmit,
  onClose,
}: PublishTargetDialogProps) {
  // A folder writes straight to the server's disk, so the server only allows it for Owners.
  const isOwner = useCan("*");
  const [kind, setKind] = useState<PublishTargetKind>(target?.kind ?? "ftp");
  const [name, setName] = useState(target?.name ?? "");
  const [options, setOptions] = useState<PublishTargetOptions>(
    target?.options ?? { ftpSecurity: "explicit", remoteFolder: "public_html" },
  );
  const [secrets, setSecrets] = useState<PublishTargetSecrets>({});
  const [formDelivery, setFormDelivery] = useState<FormDelivery>(target?.formDelivery ?? "bridge");
  const [automatic, setAutomatic] = useState(target?.publishAutomatically ?? false);
  const sites = useSites().data ?? [];
  const defaultSiteId = sites.find((site) => site.isDefault)?.id ?? "";
  const [siteId, setSiteId] = useState<string | null>(target?.siteId ?? null);

  const option = (key: keyof PublishTargetOptions) => ({
    value: String(options[key] ?? ""),
    onChange: (event: { target: { value: string } }) =>
      setOptions({
        ...options,
        [key]:
          key === "port"
            ? event.target.value === ""
              ? undefined
              : Number(event.target.value)
            : event.target.value,
      }),
  });
  const secret = (key: keyof PublishTargetSecrets) => ({
    value: secrets[key] ?? "",
    onChange: (event: { target: { value: string } }) =>
      setSecrets({ ...secrets, [key]: event.target.value }),
    autoComplete: "new-password",
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const typedSecrets = Object.fromEntries(
      Object.entries(secrets).filter(([, value]) => value !== ""),
    );
    onSubmit({
      name: name || t(`publishing.kind.${kind}`),
      siteId: siteId === defaultSiteId ? null : siteId,
      kind,
      options,
      secrets: typedSecrets,
      formDelivery: kind === "s3" && formDelivery === "bridge" ? "api" : formDelivery,
      publishAutomatically: kind === "zip" ? false : automatic,
    });
  }

  const passwordHint = target?.saved.password ? t("publishing.field.passwordSaved") : undefined;

  return (
    <Dialog
      open
      size="sheet"
      onClose={onClose}
      title={target ? t("publishing.editTitle", { name: target.name }) : t("publishing.addTitle")}
      description={t("publishing.secretsNote")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="publish-target-form" disabled={isSaving}>
            {isSaving ? t("publishing.saving") : t("publishing.save")}
          </Button>
        </>
      }
    >
      <form id="publish-target-form" onSubmit={submit} className="flex flex-col gap-5">
        {!target && (
          <ChoiceCardGroup
            label={t("publishing.addTitle")}
            options={isOwner ? kindChoices : kindChoices.filter(({ value }) => value !== "folder")}
            value={kind}
            onChange={setKind}
            columns={2}
          />
        )}
        <TextField
          label={t("publishing.field.name")}
          hint={t("publishing.field.nameHint")}
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          data-autofocus={target ? true : undefined}
        />
        {sites.length > 1 && (
          <SelectField
            label={t("publishing.field.site")}
            hint={t("publishing.field.siteHint")}
            value={siteId ?? defaultSiteId}
            onValueChange={setSiteId}
            options={sites.map((site) => ({ value: site.id, label: site.name }))}
          />
        )}
        <TextField
          label={t("publishing.field.siteAddress")}
          hint={t("publishing.field.siteAddressHint")}
          type="url"
          inputMode="url"
          placeholder="https://www.example.com"
          {...option("siteAddress")}
        />
        {(kind === "ftp" || kind === "sftp") && (
          <>
            <TextField
              label={t("publishing.field.host")}
              hint={t("publishing.field.hostHint")}
              {...option("host")}
            />
            <TextField
              label={t("publishing.field.port")}
              type="number"
              inputMode="numeric"
              placeholder={kind === "sftp" ? "22" : "21"}
              {...option("port")}
            />
            <TextField
              label={t("publishing.field.username")}
              autoComplete="off"
              {...option("username")}
            />
            <PasswordField
              label={t("publishing.field.password")}
              hint={passwordHint}
              {...secret("password")}
            />
            {kind === "sftp" && (
              <TextField
                label={t("publishing.field.privateKey")}
                hint={target?.saved.privateKey ? t("publishing.field.passwordSaved") : undefined}
                {...secret("privateKey")}
              />
            )}
            <TextField
              label={t("publishing.field.remoteFolder")}
              hint={t("publishing.field.remoteFolderHint")}
              {...option("remoteFolder")}
            />
          </>
        )}
        {kind === "ftp" && (
          <SelectField
            label={t("publishing.field.ftpSecurity")}
            hint={
              options.ftpSecurity === "none" ? t("publishing.ftpSecurity.noneWarning") : undefined
            }
            value={options.ftpSecurity ?? "explicit"}
            onValueChange={(value) =>
              setOptions({ ...options, ftpSecurity: value as PublishTargetOptions["ftpSecurity"] })
            }
            options={[
              { value: "explicit", label: t("publishing.ftpSecurity.explicit") },
              { value: "implicit", label: t("publishing.ftpSecurity.implicit") },
              { value: "none", label: t("publishing.ftpSecurity.none") },
            ]}
          />
        )}
        {kind === "s3" && (
          <>
            <TextField label={t("publishing.field.bucket")} {...option("bucket")} />
            <TextField
              label={t("publishing.field.region")}
              placeholder="eu-west-2"
              {...option("region")}
            />
            <TextField label={t("publishing.field.endpoint")} type="url" {...option("endpoint")} />
            <TextField label={t("publishing.field.prefix")} {...option("prefix")} />
            <TextField
              label={t("publishing.field.accessKeyId")}
              hint={target?.saved.accessKeyId ? t("publishing.field.passwordSaved") : undefined}
              {...secret("accessKeyId")}
            />
            <PasswordField
              label={t("publishing.field.secretAccessKey")}
              hint={target?.saved.secretAccessKey ? t("publishing.field.passwordSaved") : undefined}
              {...secret("secretAccessKey")}
            />
          </>
        )}
        {kind === "folder" && (
          <TextField
            label={t("publishing.field.folderPath")}
            hint={t("publishing.field.folderPathHint")}
            {...option("folderPath")}
          />
        )}
        <SelectField
          label={t("publishing.field.formDelivery")}
          value={kind === "s3" && formDelivery === "bridge" ? "api" : formDelivery}
          onValueChange={(value) => setFormDelivery(value as FormDelivery)}
          options={[
            ...(kind === "s3"
              ? []
              : [{ value: "bridge", label: t("publishing.formDelivery.bridge") }]),
            { value: "api", label: t("publishing.formDelivery.api") },
            { value: "none", label: t("publishing.formDelivery.none") },
          ]}
        />
        {kind !== "s3" && formDelivery === "bridge" && (
          <PasswordField
            label={t("publishing.field.stripeWebhookSecret")}
            hint={t("publishing.field.stripeWebhookSecretHint", {
              address: options.siteAddress || "https://www.example.com",
            })}
            {...secret("stripeWebhookSecret")}
          />
        )}
        {kind !== "zip" && (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-body text-label">{t("publishing.field.automatic")}</p>
              <p className="text-footnote text-label-secondary">
                {t("publishing.field.automaticHint")}
              </p>
            </div>
            <Toggle
              label={t("publishing.field.automatic")}
              labelVisibility="hidden"
              checked={automatic}
              onCheckedChange={setAutomatic}
            />
          </div>
        )}
        {error !== null && error !== undefined && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

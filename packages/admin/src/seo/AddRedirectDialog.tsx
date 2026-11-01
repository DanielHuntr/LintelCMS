import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { RedirectStatusCode } from "./seo.api.js";
import { useCreateRedirect } from "./seo.queries.js";

/** A new redirect: the old address, the new one, and whether the move is for good. */
export function AddRedirectDialog({ onClose }: { onClose: () => void }) {
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [statusCode, setStatusCode] = useState<RedirectStatusCode>(301);
  const create = useCreateRedirect();
  const fields = create.error instanceof ApiError ? create.error.fields : undefined;
  const generalError = create.error && !fields ? describeError(create.error) : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ fromPath, toPath, statusCode }, { onSuccess: onClose });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("redirects.addTitle")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="add-redirect-form" disabled={create.isPending}>
            {t("redirects.add")}
          </Button>
        </>
      }
    >
      <form id="add-redirect-form" onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label={t("redirects.fromLabel")}
          hint={t("redirects.fromHint")}
          placeholder="/old-page"
          value={fromPath}
          onChange={(event) => setFromPath(event.target.value)}
          error={fields?.fromPath ?? generalError}
          required
          data-autofocus
        />
        <TextField
          label={t("redirects.toLabel")}
          hint={t("redirects.toHint")}
          placeholder="/new-page"
          value={toPath}
          onChange={(event) => setToPath(event.target.value)}
          error={fields?.toPath}
          required
        />
        <div className="flex flex-col gap-1.5">
          <p aria-hidden="true" className="text-footnote font-medium text-label">
            {t("redirects.typeLabel")}
          </p>
          <SegmentedControl
            label={t("redirects.typeLabel")}
            options={[
              { value: "301", label: t("redirects.permanentShort") },
              { value: "302", label: t("redirects.temporaryShort") },
            ]}
            value={String(statusCode)}
            onChange={(value) => setStatusCode(value === "302" ? 302 : 301)}
          />
          <p className="text-footnote text-label-secondary">
            {statusCode === 301 ? t("redirects.permanentHint") : t("redirects.temporaryHint")}
          </p>
        </div>
      </form>
    </Dialog>
  );
}

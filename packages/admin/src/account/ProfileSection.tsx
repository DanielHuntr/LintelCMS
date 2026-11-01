import { useState, type FormEvent } from "react";
import { describeFormError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { MediaPicker } from "../media/MediaPicker.js";
import { useCan } from "../session/SessionContext.js";
import type { Account } from "./account.api.js";
import { useUpdateAccount } from "./account.queries.js";
import { AccountSection } from "./AccountSection.js";

/** Your name and picture. The picture comes from the media library. */
export function ProfileSection({ account }: { account: Account }) {
  const [name, setName] = useState(account.name);
  const update = useUpdateAccount();
  const canUseMedia = useCan("media:read");
  const [saved, setSaved] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    update.mutate({ name }, { onSuccess: () => setSaved(true) });
  }

  return (
    <AccountSection
      title={t("account.profile.title")}
      description={t("account.profile.description")}
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex items-end gap-3">
          <TextField
            className="flex-1"
            label={t("account.profile.name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={100}
            required
          />
          <Button
            type="submit"
            variant="tinted"
            disabled={update.isPending || name.trim() === account.name}
          >
            {t("account.save")}
          </Button>
        </div>
        {canUseMedia && (
          <MediaPicker
            label={t("account.profile.picture")}
            value={account.avatar?.id ?? null}
            onChange={(avatarAssetId) => update.mutate({ avatarAssetId })}
          />
        )}
        <p role="status" className="text-footnote empty:hidden">
          {update.isError ? (
            <span className="text-danger">{describeFormError(update.error)}</span>
          ) : saved ? (
            <span className="text-success">{t("account.saved")}</span>
          ) : null}
        </p>
      </form>
    </AccountSection>
  );
}

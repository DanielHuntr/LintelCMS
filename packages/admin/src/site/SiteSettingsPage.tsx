import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { fetchSiteAddress, saveSiteAddress } from "./site.api.js";

/** /settings/site: the website Lintel's content appears on, for "View page" and the sitemap. */
export function SiteSettingsPage() {
  const address = useQuery({ queryKey: ["site-address"], queryFn: fetchSiteAddress });

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle title={t("siteSettings.title")} subtitle={t("siteSettings.subtitle")} />
      {address.isError && (
        <LoadError error={address.error} onRetry={() => void address.refetch()} />
      )}
      {address.isPending && (
        <LoadingRegion label={t("siteSettings.loading")}>
          <Skeleton className="h-40 rounded-card" />
        </LoadingRegion>
      )}
      {address.data && <SiteAddressForm initial={address.data.siteAddress} />}
    </>
  );
}

function SiteAddressForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const canChange = useCan("settings:update");
  const router = useRouter();
  const save = useMutation({
    mutationFn: saveSiteAddress,
    onSuccess: async (saved) => {
      setValue(saved.siteAddress);
      // The editor reads the address from the session, so load it again.
      await router.invalidate();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate(value);
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5 rounded-card bg-surface p-6">
      <TextField
        label={t("siteSettings.address")}
        hint={t("siteSettings.addressHint")}
        placeholder="https://www.example.com"
        type="url"
        inputMode="url"
        value={value}
        disabled={!canChange}
        error={save.isError ? describeError(save.error) : undefined}
        onChange={(event) => {
          save.reset();
          setValue(event.target.value);
        }}
      />
      {canChange && (
        <div className="flex items-center justify-end gap-3">
          <p role="status" className="text-footnote text-label-secondary">
            {save.isSuccess ? t("siteSettings.saved") : ""}
          </p>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t("siteSettings.saving") : t("siteSettings.save")}
          </Button>
        </div>
      )}
    </form>
  );
}

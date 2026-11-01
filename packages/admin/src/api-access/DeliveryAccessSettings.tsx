import { Globe, LockKeyhole, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { Button } from "../design/Button.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useDeliveryAccess, useUpdateDeliveryAccess } from "./apiAccess.queries.js";

interface DeliveryAccessSettingsProps {
  canChange: boolean;
}

/** Who may read published content: anyone or token holders, and which websites' pages. */
export function DeliveryAccessSettings({ canChange }: DeliveryAccessSettingsProps) {
  const access = useDeliveryAccess();
  const update = useUpdateDeliveryAccess();
  const [newOrigin, setNewOrigin] = useState("");
  const [originError, setOriginError] = useState<string | undefined>();

  if (access.isError) {
    return <LoadError error={access.error} onRetry={() => void access.refetch()} />;
  }
  if (!access.data) return null;
  const { requireToken, allowedOrigins } = access.data;

  async function addOrigin(event: FormEvent) {
    event.preventDefault();
    setOriginError(undefined);
    try {
      await update.mutateAsync({ allowedOrigins: [...allowedOrigins, newOrigin] });
      setNewOrigin("");
    } catch (error) {
      setOriginError(describeError(error));
    }
  }

  return (
    <>
      <GroupedList header={t("apiAccess.whoHeader")} footer={t("apiAccess.requireTokenFooter")}>
        <GroupedListRow
          icon={LockKeyhole}
          iconTone="warning"
          label={t("apiAccess.requireToken")}
          accessory={
            <Toggle
              label={t("apiAccess.requireToken")}
              labelVisibility="hidden"
              checked={requireToken}
              disabled={!canChange || update.isPending}
              onCheckedChange={(checked) => update.mutate({ requireToken: checked })}
            />
          }
        />
      </GroupedList>

      <section aria-labelledby="allowed-origins-heading" className="flex flex-col gap-2">
        <h2 id="allowed-origins-heading" className="px-4 text-headline text-label">
          {t("apiAccess.originsHeader")}
        </h2>
        <GroupedList footer={t("apiAccess.originsFooter")}>
          {allowedOrigins.length === 0 && (
            <GroupedListRow
              icon={Globe}
              iconTone="neutral"
              label={t("apiAccess.noOrigins")}
              description={t("apiAccess.noOriginsDescription")}
              wrapsText
            />
          )}
          {allowedOrigins.map((origin) => (
            <GroupedListRow
              key={origin}
              icon={Globe}
              label={origin}
              accessory={
                canChange && (
                  <Button
                    variant="plain"
                    size="small"
                    aria-label={t("apiAccess.removeOrigin", { origin })}
                    icon={<Trash2 aria-hidden="true" strokeWidth={2} className="size-3.5" />}
                    onClick={() =>
                      update.mutate({
                        allowedOrigins: allowedOrigins.filter((allowed) => allowed !== origin),
                      })
                    }
                  />
                )
              }
            />
          ))}
        </GroupedList>
        {canChange && (
          <form onSubmit={addOrigin} className="flex items-start gap-2 px-4">
            <TextField
              className="flex-1"
              label={t("apiAccess.addOriginLabel")}
              placeholder="https://www.example.com"
              type="url"
              inputMode="url"
              value={newOrigin}
              onChange={(event) => setNewOrigin(event.target.value)}
              error={originError}
              required
            />
            <Button type="submit" variant="tinted" className="mt-6" disabled={update.isPending}>
              {t("apiAccess.addOrigin")}
            </Button>
          </form>
        )}
      </section>
    </>
  );
}

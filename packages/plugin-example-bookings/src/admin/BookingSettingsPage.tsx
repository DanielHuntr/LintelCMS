import {
  Button,
  Card,
  describeError,
  LargeTitle,
  LoadError,
  PluginBackLink,
  TextField,
  useCan,
} from "@lintel/admin/plugin";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { BookingSettings } from "../server/bookings.schema.js";
import { getBookingSettings, saveBookingSettings } from "./bookings.api.js";
import { t } from "./strings.js";

/** Settings → Bookings: the plugin's settings, kept by Lintel and checked by its schema. */
export function BookingSettingsPage() {
  const settings = useQuery({ queryKey: ["bookings", "settings"], queryFn: getBookingSettings });
  return (
    <>
      <PluginBackLink to="/settings">{t("bookings.settingsBack")}</PluginBackLink>
      <LargeTitle title={t("bookings.settingsTitle")} subtitle={t("bookings.settingsSubtitle")} />
      {settings.isError && (
        <LoadError error={settings.error} onRetry={() => void settings.refetch()} />
      )}
      {settings.data && <SettingsForm initial={settings.data} />}
    </>
  );
}

function SettingsForm({ initial }: { initial: BookingSettings }) {
  const canChange = useCan("settings:update");
  const [minutes, setMinutes] = useState(String(initial.defaultDurationMinutes));
  const save = useMutation({ mutationFn: saveBookingSettings });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate({ defaultDurationMinutes: Number(minutes) });
  }

  return (
    <Card className="max-w-xl">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <TextField
          label={t("bookings.defaultDuration")}
          type="number"
          min={5}
          max={480}
          step={5}
          value={minutes}
          disabled={!canChange}
          onChange={(event) => setMinutes(event.target.value)}
        />
        {save.isError && (
          <p role="alert" className="text-footnote whitespace-pre-line text-danger">
            {describeError(save.error)}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          <p role="status" className="text-footnote text-label-secondary">
            {save.isSuccess ? t("bookings.settingsSaved") : ""}
          </p>
          {canChange && (
            <Button type="submit" disabled={save.isPending}>
              {t("bookings.settingsSave")}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

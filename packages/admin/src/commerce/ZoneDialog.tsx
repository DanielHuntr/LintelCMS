import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { CountryPicker } from "./CountryPicker.js";
import type { ShippingZone } from "./shopSettings.api.js";
import { useDeleteShippingZone, useSaveShippingZone } from "./shopSettings.queries.js";

/** A shipping zone: a name and the countries that share its rates. */
export function ZoneDialog({ zone, onClose }: { zone: ShippingZone | null; onClose: () => void }) {
  const [name, setName] = useState(zone?.name ?? "");
  const [countries, setCountries] = useState<string[]>(zone?.countries ?? []);
  const save = useSaveShippingZone(zone?.id ?? null);
  const remove = useDeleteShippingZone();

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate({ name, countries }, { onSuccess: onClose });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        zone
          ? t("shop.shipping.editZoneTitle", { name: zone.name })
          : t("shop.shipping.addZoneTitle")
      }
      description={t("shop.shipping.zoneDescription")}
      footer={
        <>
          {zone && (
            <Button
              variant="destructive"
              onClick={() => remove.mutate(zone.id, { onSuccess: onClose })}
            >
              {t("shop.shipping.deleteZone")}
            </Button>
          )}
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="zone-form" disabled={save.isPending}>
            {save.isPending ? t("shop.saving") : t("shop.save")}
          </Button>
        </>
      }
    >
      <form id="zone-form" onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label={t("shop.shipping.zoneNameLabel")}
          placeholder={t("shop.shipping.zoneNamePlaceholder")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          data-autofocus
        />
        <CountryPicker
          legend={t("shop.shipping.zoneCountriesLabel")}
          value={countries}
          onChange={setCountries}
        />
        {(save.error || remove.error) && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(save.error ?? remove.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

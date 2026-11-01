import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { chosenLines, LineQuantityFields } from "./LineQuantityFields.js";
import type { Order } from "./orders.api.js";
import { useFulfilOrder } from "./shop.queries.js";

/** "Mark as sent": which items went, with a tracking number if there is one. */
export function FulfilDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const maximums = Object.fromEntries(
    order.lines.map((line) => [line.id, line.unfulfilledQuantity]),
  );
  const [quantities, setQuantities] = useState<Record<string, number>>(maximums);
  const [trackingCompany, setTrackingCompany] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const fulfil = useFulfilOrder(order.id);
  const lines = chosenLines(quantities);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (lines.length === 0) return;
    fulfil.mutate(
      { lines, trackingCompany, trackingNumber, trackingUrl: trackingUrl.trim(), notifyCustomer },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("shop.orders.fulfilTitle", { name: order.name })}
      description={t("shop.orders.fulfilDescription")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="fulfil-form"
            disabled={fulfil.isPending || lines.length === 0}
          >
            {fulfil.isPending ? t("shop.saving") : t("shop.orders.fulfilConfirm")}
          </Button>
        </>
      }
    >
      <form id="fulfil-form" onSubmit={submit} className="flex flex-col gap-5">
        <LineQuantityFields
          legend={t("shop.orders.whatWasSent")}
          lines={order.lines}
          maximums={maximums}
          quantities={quantities}
          onChange={setQuantities}
        />
        <TextField
          label={t("shop.orders.trackingCompany")}
          placeholder={t("shop.orders.trackingCompanyPlaceholder")}
          value={trackingCompany}
          onChange={(event) => setTrackingCompany(event.target.value)}
          data-autofocus
        />
        <TextField
          label={t("shop.orders.trackingNumber")}
          value={trackingNumber}
          onChange={(event) => setTrackingNumber(event.target.value)}
        />
        <TextField
          label={t("shop.orders.trackingUrl")}
          hint={t("shop.orders.trackingUrlHint")}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={trackingUrl}
          onChange={(event) => setTrackingUrl(event.target.value)}
        />
        <Toggle
          label={t("shop.orders.emailCustomerShipped")}
          checked={notifyCustomer}
          onCheckedChange={setNotifyCustomer}
        />
        {fulfil.error && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(fulfil.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

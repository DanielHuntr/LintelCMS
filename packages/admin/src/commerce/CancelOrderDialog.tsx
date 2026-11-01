import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { formatMoney } from "./money.js";
import type { Order } from "./orders.api.js";
import { useCancelOrder } from "./shop.queries.js";

/** Cancelling an order nothing has been sent from: refund it and put the items back. */
export function CancelOrderDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(true);
  const [restock, setRestock] = useState(true);
  const cancel = useCancelOrder(order.id);

  return (
    <Dialog
      open
      size="alert"
      onClose={onClose}
      title={t("shop.orders.cancelTitle", { name: order.name })}
      description={t("shop.orders.cancelDescription")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("shop.orders.keepOrder")}
          </Button>
          <Button
            variant="destructive"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({ reason, refund, restock }, { onSuccess: onClose })}
          >
            {cancel.isPending ? t("shop.saving") : t("shop.orders.cancelConfirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={t("shop.orders.cancelReason")}
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          data-autofocus
        />
        <Toggle
          label={t("shop.orders.cancelRefund", { amount: formatMoney(order.refundable) })}
          checked={refund}
          onCheckedChange={setRefund}
        />
        <Toggle label={t("shop.orders.restock")} checked={restock} onCheckedChange={setRestock} />
        {cancel.error && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(cancel.error)}
          </p>
        )}
      </div>
    </Dialog>
  );
}

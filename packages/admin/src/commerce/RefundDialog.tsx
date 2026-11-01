import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { chosenLines, LineQuantityFields } from "./LineQuantityFields.js";
import { currencySymbol, formatMoney, inputToMinor } from "./money.js";
import type { Order } from "./orders.api.js";
import { useRefundOrder } from "./shop.queries.js";

type RefundBy = "items" | "amount";

/**
 * Giving money back through Stripe: for some items (worked out for you, and they can go
 * back into stock) or a typed amount, such as a goodwill gesture.
 */
export function RefundDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const [refundBy, setRefundBy] = useState<RefundBy>("items");
  const maximums = Object.fromEntries(
    order.lines.map((line) => [line.id, line.quantity - line.refundedQuantity]),
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [amountError, setAmountError] = useState<string | undefined>();
  const refund = useRefundOrder(order.id);
  const currency = order.total.currency;
  const lines = chosenLines(quantities);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (refundBy === "amount") {
      const amount = inputToMinor(amountText, currency);
      if (amount === null || amount <= 0 || amount > order.refundable.amount) {
        setAmountError(
          t("shop.orders.refundAmountProblem", { most: formatMoney(order.refundable) }),
        );
        return;
      }
      refund.mutate(
        { amount, lines: [], reason, restock: false, notifyCustomer },
        { onSuccess: onClose },
      );
      return;
    }
    if (lines.length === 0) return;
    refund.mutate({ lines, reason, restock, notifyCustomer }, { onSuccess: onClose });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("shop.orders.refundTitle", { name: order.name })}
      description={t("shop.orders.refundDescription", { most: formatMoney(order.refundable) })}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="refund-form"
            disabled={refund.isPending || (refundBy === "items" && lines.length === 0)}
          >
            {refund.isPending ? t("shop.orders.refunding") : t("shop.orders.refundConfirm")}
          </Button>
        </>
      }
    >
      <form id="refund-form" onSubmit={submit} className="flex flex-col gap-5">
        <SegmentedControl<RefundBy>
          label={t("shop.orders.refundBy")}
          value={refundBy}
          onChange={setRefundBy}
          options={[
            { value: "items", label: t("shop.orders.refundByItems") },
            { value: "amount", label: t("shop.orders.refundByAmount") },
          ]}
        />
        {refundBy === "items" ? (
          <>
            <LineQuantityFields
              legend={t("shop.orders.whatToRefund")}
              lines={order.lines}
              maximums={maximums}
              quantities={quantities}
              onChange={setQuantities}
            />
            <Toggle
              label={t("shop.orders.restock")}
              checked={restock}
              onCheckedChange={setRestock}
            />
          </>
        ) : (
          <TextField
            label={t("shop.orders.refundAmount", { currency })}
            inputMode="decimal"
            placeholder={`${currencySymbol(currency)}0`}
            value={amountText}
            onChange={(event) => {
              setAmountText(event.target.value);
              setAmountError(undefined);
            }}
            error={amountError}
            data-autofocus
          />
        )}
        <TextField
          label={t("shop.orders.refundReason")}
          hint={t("shop.orders.refundReasonHint")}
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
        />
        <Toggle
          label={t("shop.orders.emailCustomerRefund")}
          checked={notifyCustomer}
          onCheckedChange={setNotifyCustomer}
        />
        {refund.error && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(refund.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}

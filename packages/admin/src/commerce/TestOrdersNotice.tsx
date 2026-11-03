import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { deleteTestOrders, getTestOrders } from "./testCheckout.api.js";

/** On the Orders page while test orders exist: what they are, and one way to clear them away. */
export function TestOrdersNotice() {
  const canDelete = useCan("commerce:update");
  const queryClient = useQueryClient();
  const [isAsking, setIsAsking] = useState(false);
  const testOrders = useQuery({ queryKey: ["shop", "test-orders"], queryFn: getTestOrders });
  const remove = useMutation({
    mutationFn: deleteTestOrders,
    onSuccess: async () => {
      setIsAsking(false);
      await queryClient.invalidateQueries({ queryKey: ["shop"] });
    },
  });
  const count = testOrders.data?.count ?? 0;
  if (count === 0) return null;

  return (
    <div className="mb-5 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-card bg-surface px-4 py-3">
      <div className="min-w-0 flex-1 basis-60">
        <p className="text-body font-medium text-label">{t("shop.testOrders.title", { count })}</p>
        <p className="text-footnote text-label-secondary">{t("shop.testOrders.body")}</p>
      </div>
      {canDelete && (
        <Button variant="tinted" onClick={() => setIsAsking(true)}>
          {t("shop.testOrders.delete")}
        </Button>
      )}
      {remove.error && (
        <p role="alert" className="w-full text-footnote text-danger">
          {describeError(remove.error)}
        </p>
      )}
      <ConfirmDialog
        open={isAsking}
        title={t("shop.testOrders.confirmTitle")}
        message={t("shop.testOrders.confirmMessage", { count })}
        confirmLabel={
          remove.isPending ? t("shop.testOrders.deleting") : t("shop.testOrders.delete")
        }
        cancelLabel={t("shop.testOrders.keep")}
        isDestructive
        isWorking={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setIsAsking(false)}
      />
    </div>
  );
}

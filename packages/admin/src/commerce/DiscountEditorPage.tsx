import { useNavigate } from "@tanstack/react-router";
import { Globe, Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import {
  type DiscountDraft,
  discountInputFromDraft,
  draftFromDiscount,
  emptyDiscountDraft,
  toDateInput,
} from "./discountDraft.js";
import { DiscountOfferSection } from "./DiscountOfferSection.js";
import type { Discount } from "./discounts.api.js";
import { useDeleteDiscount, useDiscount, useSaveDiscount } from "./discounts.queries.js";
import { DiscountScheduleSection } from "./DiscountScheduleSection.js";
import { DiscountScopeSection } from "./DiscountScopeSection.js";
import { summariseDiscount } from "./discountSummary.js";
import { useMarkets } from "./shopSettings.queries.js";
import { useSummaryContext } from "./useSummaryContext.js";

/** /commerce/discounts/:id (or /new): one discount, with a sentence saying what it does. */
export function DiscountEditorPage({ discountId }: { discountId: string }) {
  const isNew = discountId === "new";
  const discount = useDiscount(isNew ? null : discountId);
  const markets = useMarkets();
  const failed = [discount, markets].find((query) => query.isError);
  const isLoading = (!isNew && discount.isPending) || markets.isPending;
  const currencies = [
    ...new Set(
      [...(markets.data ?? [])]
        .sort((first, second) => Number(second.isPrimary) - Number(first.isPrimary))
        .map((market) => market.currency),
    ),
  ];

  return (
    <>
      <BackLink to="/commerce/discounts">{t("shop.discounts.title")}</BackLink>
      {failed && <LoadError error={failed.error} onRetry={() => void failed.refetch()} />}
      {isLoading && !failed && (
        <LoadingRegion label={t("shop.discounts.loadingOne")}>
          <Skeleton className="mb-8 h-10 w-72 rounded-control" />
          <Skeleton className="h-64 max-w-3xl rounded-card" />
        </LoadingRegion>
      )}
      {!isLoading && !failed && currencies.length === 0 && (
        <div className="max-w-3xl rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Globe}
            title={t("shop.products.needsMarketTitle")}
            description={t("shop.discounts.needsMarketDescription")}
            action={
              <LinkButton to="/commerce/settings/markets">
                {t("shop.products.needsMarketAction")}
              </LinkButton>
            }
          />
        </div>
      )}
      {!isLoading && !failed && currencies.length > 0 && (
        <DiscountForm
          key={discount.data?.id ?? "new"}
          discount={isNew ? null : (discount.data ?? null)}
          currencies={currencies}
        />
      )}
    </>
  );
}

function DiscountForm({
  discount,
  currencies,
}: {
  discount: Discount | null;
  currencies: string[];
}) {
  const [draft, setDraft] = useState<DiscountDraft>(() =>
    discount
      ? draftFromDiscount(discount)
      : emptyDiscountDraft(toDateInput(new Date().toISOString())),
  );
  const [localProblems, setLocalProblems] = useState<Record<string, string>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const save = useSaveDiscount(discount?.id ?? null);
  const remove = useDeleteDiscount();
  const navigate = useNavigate();
  const canChange = useCan("commerce:update");
  const context = useSummaryContext();
  const apiFields = save.error instanceof ApiError ? (save.error.fields ?? {}) : {};
  const errors = { ...apiFields, ...localProblems };
  const { input } = discountInputFromDraft(draft, currencies);

  function change(changes: Partial<DiscountDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function submit() {
    const { problems } = discountInputFromDraft(draft, currencies);
    const messages = Object.fromEntries(
      Object.entries(problems).flatMap(([field, problem]) =>
        problem ? [[field, t(`shop.discounts.problem.${problem}`)]] : [],
      ),
    );
    setLocalProblems(messages);
    if (Object.keys(messages).length > 0) return;
    save.mutate(input, {
      onSuccess: (saved) => {
        if (!discount) {
          void navigate({
            to: "/commerce/discounts/$discountId",
            params: { discountId: saved.id },
          });
        }
      },
    });
  }

  const generalError =
    save.error && Object.keys(apiFields).length === 0 ? describeError(save.error) : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      noValidate
    >
      <LargeTitle
        title={discount ? discount.title : t("shop.discounts.newTitle")}
        subtitle={t("shop.discounts.editorSubtitle")}
        actions={
          canChange && (
            <>
              {discount && (
                <Button
                  variant="destructive"
                  icon={<Trash2 aria-hidden="true" />}
                  onClick={() => setIsDeleting(true)}
                >
                  {t("shop.discounts.delete")}
                </Button>
              )}
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t("shop.saving") : t("shop.save")}
              </Button>
            </>
          )
        }
      />
      <div role="status" aria-live="polite" className="sr-only">
        {save.isSuccess ? t("shop.saved") : ""}
      </div>
      {(generalError || Object.keys(errors).length > 0) && (
        <p
          role="alert"
          className="mb-5 max-w-3xl rounded-card bg-danger/10 px-4 py-3 text-body text-danger"
        >
          {generalError ?? t("shop.discounts.fixProblems")}
        </p>
      )}
      <div className="flex max-w-3xl flex-col gap-6">
        {context && (
          <Card title={t("shop.discounts.summaryHeader")}>
            <p className="text-body text-label" aria-live="polite">
              {summariseDiscount(input, {
                ...context,
                currency: currencies[0] ?? context.currency,
              })}
            </p>
            {discount && (
              <p className="mt-2 text-footnote text-label-secondary">
                {t("shop.discounts.usedCount", { count: discount.usageCount })}
              </p>
            )}
          </Card>
        )}
        <DiscountOfferSection
          draft={draft}
          onChange={change}
          errors={errors}
          currencies={currencies}
        />
        <DiscountScopeSection
          draft={draft}
          onChange={change}
          errors={errors}
          currencies={currencies}
        />
        <DiscountScheduleSection draft={draft} onChange={change} errors={errors} />
      </div>
      {discount && (
        <ConfirmDialog
          open={isDeleting}
          title={t("shop.discounts.deleteTitle", { title: discount.title })}
          message={t("shop.discounts.deleteDescription")}
          confirmLabel={t("shop.discounts.delete")}
          cancelLabel={t("common.cancel")}
          isDestructive
          isWorking={remove.isPending}
          onCancel={() => setIsDeleting(false)}
          onConfirm={() =>
            remove.mutate(discount.id, {
              onSuccess: () => void navigate({ to: "/commerce/discounts" }),
            })
          }
        />
      )}
    </form>
  );
}

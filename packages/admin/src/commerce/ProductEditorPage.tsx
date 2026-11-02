import { useNavigate } from "@tanstack/react-router";
import { Globe, Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import {
  draftFromProduct,
  emptyProductDraft,
  type ProductDraft,
  productInputFromDraft,
} from "./productDraft.js";
import { useManualCollections, useSetProductCollections } from "./collections.queries.js";
import { ProductCollectionsCard } from "./ProductCollectionsCard.js";
import { ProductDetailsSection } from "./ProductDetailsSection.js";
import { ProductOrganisationSection } from "./ProductOrganisationSection.js";
import { ProductVariantsSection } from "./ProductVariantsSection.js";
import type { InventoryLocation, Product } from "./products.api.js";
import { useDeleteProduct, useLocations, useProduct, useSaveProduct } from "./shop.queries.js";
import { useMarkets } from "./shopSettings.queries.js";

/** /commerce/products/:id (or /new): everything about one product, saved in one go. */
export function ProductEditorPage({ productId }: { productId: string }) {
  const isNew = productId === "new";
  const product = useProduct(isNew ? null : productId);
  const locations = useLocations();
  const markets = useMarkets();
  const currency =
    markets.data?.find((market) => market.isPrimary)?.currency ?? markets.data?.[0]?.currency;

  const isLoading = (!isNew && product.isPending) || locations.isPending || markets.isPending;
  const failed = [product, locations, markets].find((query) => query.isError);

  return (
    <>
      <BackLink to="/commerce/products">{t("shop.products.title")}</BackLink>
      {failed && <LoadError error={failed.error} onRetry={() => void failed.refetch()} />}
      {isLoading && !failed && (
        <LoadingRegion label={t("shop.products.loadingOne")}>
          <Skeleton className="mb-8 h-10 w-72 rounded-control" />
          <Skeleton className="h-64 max-w-3xl rounded-card" />
        </LoadingRegion>
      )}
      {!isLoading && !failed && markets.data?.length === 0 && <NeedsMarketFirst />}
      {!isLoading && !failed && currency && locations.data && (
        <ProductForm
          key={product.data?.updatedAt ?? "new"}
          product={isNew ? null : (product.data ?? null)}
          currency={currency}
          locations={locations.data}
        />
      )}
    </>
  );
}

function NeedsMarketFirst() {
  return (
    <div className="max-w-3xl rounded-card bg-surface">
      <EmptyState
        size="page"
        icon={Globe}
        title={t("shop.products.needsMarketTitle")}
        description={t("shop.products.needsMarketDescription")}
        action={
          <LinkButton to="/commerce/settings/markets">
            {t("shop.products.needsMarketAction")}
          </LinkButton>
        }
      />
    </div>
  );
}

interface ProductFormProps {
  product: Product | null;
  currency: string;
  locations: InventoryLocation[];
}

function ProductForm({ product, currency, locations }: ProductFormProps) {
  const [draft, setDraft] = useState<ProductDraft>(() =>
    product ? draftFromProduct(product, currency) : emptyProductDraft(),
  );
  const [localProblems, setLocalProblems] = useState<Record<string, string>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const save = useSaveProduct(product?.id ?? null);
  const remove = useDeleteProduct();
  const navigate = useNavigate();
  const canChange = useCan("commerce:update");
  const collections = useManualCollections();
  const setCollections = useSetProductCollections();
  // The hand-picked collections it's in, unless ticked differently here; saved with the product.
  const [chosenCollections, setChosenCollections] = useState<string[] | null>(null);
  const collectionIds =
    chosenCollections ??
    (collections ?? [])
      .filter((collection) => product && collection.productIds.includes(product.id))
      .map((collection) => collection.id);
  const apiFields = save.error instanceof ApiError ? (save.error.fields ?? {}) : {};
  const fieldErrors = { ...apiFields, ...localProblems };

  function change(changes: Partial<ProductDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function submit() {
    const { input, problems } = productInputFromDraft(
      draft,
      currency,
      locations.map((location) => location.id),
    );
    const messages = Object.fromEntries(
      Object.entries(problems).map(([field, kind]) => [field, t(`shop.products.problem.${kind}`)]),
    );
    if (input.title === "") messages.title = t("shop.products.titleRequired");
    setLocalProblems(messages);
    if (Object.keys(messages).length > 0) return;
    // Chained with mutateAsync rather than onSuccess callbacks: saving an existing product
    // redraws this form (it's keyed by updatedAt), and a redrawn form's callbacks never run.
    void save
      .mutateAsync(input)
      .then(async (saved) => {
        if (collections && chosenCollections) {
          await setCollections.mutateAsync({
            productId: saved.id,
            chosenIds: chosenCollections,
            collections,
          });
        }
        if (!product)
          void navigate({ to: "/commerce/products/$productId", params: { productId: saved.id } });
      })
      .catch(() => {
        // Shown from save.error or setCollections.error.
      });
  }

  const failure = save.error ?? setCollections.error;
  const generalError =
    failure && Object.keys(apiFields).length === 0 ? describeError(failure) : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      noValidate
    >
      <LargeTitle
        title={product ? product.title : t("shop.products.newTitle")}
        subtitle={t("shop.products.editorSubtitle")}
        actions={
          canChange && (
            <>
              {product && (
                <Button
                  variant="destructive"
                  icon={<Trash2 aria-hidden="true" />}
                  onClick={() => setIsDeleting(true)}
                >
                  {t("shop.products.delete")}
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
      {(generalError || Object.keys(fieldErrors).length > 0) && (
        <p
          role="alert"
          className="mb-5 max-w-3xl rounded-card bg-danger/10 px-4 py-3 text-body text-danger"
        >
          {generalError ?? t("shop.products.fixProblems")}
        </p>
      )}
      <div className="flex max-w-3xl flex-col gap-6">
        <ProductDetailsSection draft={draft} onChange={change} errors={fieldErrors} />
        <ProductVariantsSection
          draft={draft}
          onChange={change}
          currency={currency}
          locations={locations}
          errors={fieldErrors}
        />
        <ProductOrganisationSection draft={draft} onChange={change} errors={fieldErrors} />
        <ProductCollectionsCard
          collections={collections}
          chosen={collectionIds}
          onChange={setChosenCollections}
        />
      </div>
      {product && (
        <ConfirmDialog
          open={isDeleting}
          title={t("shop.products.deleteTitle", { title: product.title })}
          message={t("shop.products.deleteDescription")}
          confirmLabel={t("shop.products.delete")}
          cancelLabel={t("common.cancel")}
          isDestructive
          isWorking={remove.isPending}
          onCancel={() => setIsDeleting(false)}
          onConfirm={() =>
            remove.mutate(product.id, {
              onSuccess: () => void navigate({ to: "/commerce/products" }),
            })
          }
        />
      )}
    </form>
  );
}

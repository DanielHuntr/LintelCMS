import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import {
  inputFromCollection,
  type ProductCollection,
  type ProductCollectionInput,
} from "./collections.api.js";
import { useProductCollection, useSaveProductCollection } from "./collections.queries.js";
import { ProductPicker } from "./DiscountScopeSection.js";

const emptyCollection: ProductCollectionInput = {
  title: "",
  description: "",
  kind: "manual",
  rules: [],
  matchAll: true,
  productIds: [],
};

/** /commerce/collections/:id (or /new): a collection's title, description and products. */
export function CollectionEditorPage({ collectionId }: { collectionId: string }) {
  const isNew = collectionId === "new";
  const collection = useProductCollection(isNew ? null : collectionId);
  return (
    <>
      <BackLink to="/commerce/collections">{t("shop.collections.title")}</BackLink>
      {collection.isError && (
        <LoadError error={collection.error} onRetry={() => void collection.refetch()} />
      )}
      {!isNew && collection.isPending && (
        <LoadingRegion label={t("shop.collections.loadingOne")}>
          <Skeleton className="h-64 max-w-3xl rounded-card" />
        </LoadingRegion>
      )}
      {(isNew || collection.data) && (
        <CollectionForm collection={isNew ? null : (collection.data ?? null)} />
      )}
    </>
  );
}

function CollectionForm({ collection }: { collection: ProductCollection | null }) {
  const [draft, setDraft] = useState<ProductCollectionInput>(() =>
    collection ? inputFromCollection(collection) : emptyCollection,
  );
  const [titleProblem, setTitleProblem] = useState<string | undefined>();
  const save = useSaveProductCollection(collection?.id ?? null);
  const navigate = useNavigate();
  const canChange = useCan("commerce:update");
  const apiFields = save.error instanceof ApiError ? (save.error.fields ?? {}) : {};
  const generalError =
    save.error && Object.keys(apiFields).length === 0 ? describeError(save.error) : null;
  const change = (changes: Partial<ProductCollectionInput>) =>
    setDraft((current) => ({ ...current, ...changes }));

  function submit() {
    const title = draft.title.trim();
    setTitleProblem(title === "" ? t("shop.collections.titleRequired") : undefined);
    if (title === "") return;
    save.mutate(
      { ...draft, title },
      {
        onSuccess: (saved) => {
          if (!collection)
            void navigate({
              to: "/commerce/collections/$collectionId",
              params: { collectionId: saved.id },
            });
        },
      },
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      noValidate
    >
      <LargeTitle
        title={collection ? collection.title : t("shop.collections.newTitle")}
        subtitle={t("shop.collections.editorSubtitle")}
        actions={
          canChange && (
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t("shop.saving") : t("shop.save")}
            </Button>
          )
        }
      />
      <div role="status" aria-live="polite" className="sr-only">
        {save.isSuccess ? t("shop.saved") : ""}
      </div>
      {generalError && (
        <p
          role="alert"
          className="mb-5 max-w-3xl rounded-card bg-danger/10 px-4 py-3 text-body text-danger"
        >
          {generalError}
        </p>
      )}
      <div className="flex max-w-3xl flex-col gap-6">
        <Card>
          <div className="flex flex-col gap-5">
            <TextField
              label={t("shop.collections.titleLabel")}
              value={draft.title}
              maxLength={200}
              onChange={(event) => {
                change({ title: event.target.value });
                setTitleProblem(undefined);
              }}
              error={titleProblem ?? apiFields.title}
            />
            <TextField
              label={t("shop.collections.descriptionLabel")}
              hint={t("shop.collections.descriptionHint")}
              value={draft.description}
              maxLength={2000}
              onChange={(event) => change({ description: event.target.value })}
              error={apiFields.description}
            />
          </div>
        </Card>
        {/* The picker's own legend names hand-picked products; rules need a heading here. */}
        <Card title={draft.kind === "manual" ? undefined : t("shop.collections.productsHeader")}>
          {draft.kind === "manual" ? (
            <ProductPicker
              chosen={draft.productIds}
              onChange={(productIds) => change({ productIds })}
              error={apiFields.productIds}
            />
          ) : (
            <p className="text-body text-label-secondary">
              {t("shop.collections.automaticNote", { count: collection?.productCount ?? 0 })}
            </p>
          )}
        </Card>
      </div>
    </form>
  );
}

import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useReducer, useState } from "react";
import { ApiError, type FieldMessages } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import {
  blueprintDraftReducer,
  blueprintProblems,
  draftFromFields,
  fieldsForSaving,
  problemsByKey,
} from "../content-types/blueprintDraft.js";
import { blueprintKeys } from "../content-types/blueprints.queries.js";
import { FieldsBuilder } from "../content-types/FieldsBuilder.js";
import { isSameValue } from "../content/sameValue.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { SelectField } from "../design/SelectField.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { blockIconChoices } from "./blockIcons.js";
import { renamedProperties, withoutBindingsTo } from "./blockChanges.js";
import { asCustomBlock, deleteBlock, type SiteBlock, updateBlock } from "./blocks.api.js";
import { blockKeys, useBlock } from "./blocks.queries.js";

// The renderer is large; it loads with the preview.
const BlockPreview = lazy(async () => ({
  default: (await import("./BlockPreview.js")).BlockPreview,
}));

/**
 * Design → Your site's blocks → a block: its name, icon and group in Insert, what editors
 * fill in (built with the same field builder as content types), a live preview, where it is
 * used, and Edit design. Blocks from code and plugins are shown read-only.
 */
export function BlockEditorPage({ handle }: { handle: string }) {
  const block = useBlock(handle);
  return (
    <Page width="readable">
      {block.isError && <LoadError error={block.error} onRetry={() => void block.refetch()} />}
      {block.isPending && (
        <LoadingRegion label={t("blocks.loading")}>
          <Skeleton className="mb-10 h-10 w-56" />
          <Skeleton className="h-72 rounded-card" />
        </LoadingRegion>
      )}
      {block.data && <BlockEditor key={block.data.updatedAt} block={block.data} />}
    </Page>
  );
}

interface Details {
  icon: string;
  category: string;
  description: string;
}

type PendingRemoval = { properties: string[]; pages: string[] };

function BlockEditor({ block }: { block: SiteBlock }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canEdit = useCan("builder:blocks") && block.editable;
  const [saved, setSaved] = useState(() => ({
    draft: draftFromFields(block.name, block.properties),
    details: { icon: block.icon, category: block.category, description: block.description },
  }));
  const [state, dispatch] = useReducer(blueprintDraftReducer, saved.draft);
  const [details, setDetails] = useState<Details>(saved.details);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [serverProblems, setServerProblems] = useState<FieldMessages>({});
  const [hasTriedToSave, setHasTriedToSave] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isUnsaved = !isSameValue(saved.draft, state) || !isSameValue(saved.details, details);
  const leaveWarning = useLeaveWarning(isUnsaved);
  const problems = hasTriedToSave
    ? { ...blueprintProblems(state), ...serverProblems }
    : serverProblems;
  const preview = useMemo(
    () => asCustomBlock({ ...block, properties: fieldsForSaving(state.fields) }),
    [block, state.fields],
  );

  async function save(confirmRemovals = false) {
    setHasTriedToSave(true);
    setMessage(null);
    if (Object.keys(blueprintProblems(state)).length > 0) {
      setMessage({ tone: "danger", text: t("builder.fixProblems") });
      return;
    }
    if (!block.design) return;
    setIsSaving(true);
    try {
      const properties = fieldsForSaving(state.fields);
      const renames = renamedProperties(state.fields);
      const kept = new Set(properties.map((property) => property.handle));
      const removed = block.properties
        .map((property) => property.handle)
        .filter((old) => !kept.has(renames[old] ?? old));
      const updated = await updateBlock(block.handle, {
        name: state.name.trim(),
        ...details,
        properties,
        design: withoutBindingsTo(block.design, removed),
        renamedProperties: renames,
        confirmRemovals,
      });
      queryClient.setQueryData(blockKeys.block(updated.handle), updated);
      void queryClient.invalidateQueries({ queryKey: blockKeys.blocks() });
      // Content types offering it in blocks fields have new fields now.
      void queryClient.invalidateQueries({ queryKey: blueprintKeys.blueprints() });
      const fresh = {
        draft: draftFromFields(updated.name, updated.properties),
        details: {
          icon: updated.icon,
          category: updated.category,
          description: updated.description,
        },
      };
      setSaved(fresh);
      dispatch({ type: "reset", draft: fresh.draft });
      setServerProblems({});
      setHasTriedToSave(false);
      setMessage({ tone: "success", text: t("blocks.saved") });
    } catch (error) {
      if (error instanceof ApiError && error.code === "BLOCK_CHANGE_NEEDS_CONFIRMATION") {
        const pages = (error.details.pages as Array<{ title: string }> | undefined) ?? [];
        setPendingRemoval({
          properties: (error.details.removedProperties as string[] | undefined) ?? [],
          pages: pages.map((page) => page.title),
        });
      } else {
        if (error instanceof ApiError && error.fields) {
          setServerProblems(problemsByKey(state.fields, error.fields));
        }
        setMessage({ tone: "danger", text: describeError(error) });
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      await deleteBlock(block.handle, block.usedOn.length > 0);
      await queryClient.invalidateQueries({ queryKey: blockKeys.blocks() });
      await navigate({ to: "/design/blocks", ignoreBlocker: true });
    } catch (error) {
      setMessage({ tone: "danger", text: describeError(error) });
      setIsDeleting(false);
    }
  }

  return (
    <>
      <BackLink to="/design/blocks">{t("blocks.back")}</BackLink>
      <LargeTitle
        title={state.name.trim() || block.name}
        subtitle={[
          t("blocks.propertyCount", { count: state.fields.length }),
          t("blocks.usedOn", { count: block.usedOn.length }),
        ].join(" · ")}
        actions={
          canEdit ? (
            <div className="flex items-center gap-2">
              <Button variant="destructive" onClick={() => setIsDeleting(true)}>
                {t("blocks.delete")}
              </Button>
              <LinkButton
                variant="tinted"
                to="/design/blocks/$handle/design"
                params={{ handle: block.handle }}
              >
                {t("blocks.editDesign")}
              </LinkButton>
              <Button onClick={() => void save()} disabled={isSaving || !isUnsaved}>
                {isSaving ? t("blocks.saving") : t("blocks.save")}
              </Button>
            </div>
          ) : (
            <Badge>{t(`blocks.source.${block.source}`)}</Badge>
          )
        }
      />
      {!block.editable && (
        <p role="note" className="mb-6 rounded-card bg-fill px-4 py-3 text-footnote text-label">
          {t(block.source === "code" ? "blocks.readOnly" : "blocks.readOnlyPlugin")}
        </p>
      )}
      {message && (
        <p
          role={message.tone === "danger" ? "alert" : "status"}
          className={
            message.tone === "danger"
              ? "mb-6 rounded-card bg-danger/10 px-4 py-3 text-footnote text-label"
              : "mb-6 rounded-card bg-success/10 px-4 py-3 text-footnote text-label"
          }
        >
          {message.text}
        </p>
      )}
      <div className="flex flex-col gap-8">
        <section
          className="flex flex-col gap-4 rounded-card bg-surface p-5"
          aria-label={t("blocks.details")}
        >
          <TextField
            label={t("blocks.name")}
            value={state.name}
            error={problems.name}
            disabled={!canEdit}
            onChange={(event) => dispatch({ type: "renamed", name: event.target.value })}
            className="max-w-md"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t("blocks.icon")}
              value={details.icon}
              disabled={!canEdit}
              options={blockIconChoices(details.icon)}
              onValueChange={(icon) => setDetails((current) => ({ ...current, icon }))}
            />
            <TextField
              label={t("blocks.category")}
              hint={t("blocks.categoryHint")}
              value={details.category}
              disabled={!canEdit}
              maxLength={60}
              onChange={(event) =>
                setDetails((current) => ({ ...current, category: event.target.value }))
              }
            />
          </div>
          <TextField
            label={t("blocks.description")}
            hint={t("blocks.descriptionHint")}
            value={details.description}
            disabled={!canEdit}
            maxLength={200}
            onChange={(event) =>
              setDetails((current) => ({ ...current, description: event.target.value }))
            }
          />
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="block-preview-title">
          <div>
            <h2 id="block-preview-title" className="text-headline font-semibold text-label">
              {t("blocks.preview")}
            </h2>
            <p className="text-footnote text-label-secondary">{t("blocks.previewHint")}</p>
          </div>
          <Suspense fallback={<Skeleton className="h-40 rounded-card" />}>
            <BlockPreview
              block={preview}
              values={{}}
              label={t("blocksField.previewLabel", { name: block.name })}
            />
          </Suspense>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="block-properties-title">
          <div>
            <h2 id="block-properties-title" className="text-headline font-semibold text-label">
              {t("blocks.properties")}
            </h2>
            <p className="text-footnote text-label-secondary">{t("blocks.propertiesHint")}</p>
          </div>
          <FieldsBuilder
            fields={state.fields}
            problems={problems}
            canEdit={canEdit}
            dispatch={dispatch}
            removeMessage={t("blocks.removePropertyMessage")}
            canShowInList={false}
          />
        </section>

        <section
          className="flex flex-col gap-3 rounded-card bg-surface p-5"
          aria-labelledby="block-uses-title"
        >
          <h2 id="block-uses-title" className="text-headline font-semibold text-label">
            {t("blocks.whereUsed")}
          </h2>
          {block.usedOn.length === 0 ? (
            <p className="text-footnote text-label-secondary">{t("blocks.notUsed")}</p>
          ) : (
            <ul className="flex flex-col gap-1" data-block-uses>
              {block.usedOn.map((page) => (
                <li key={page.entryId}>
                  <Link
                    to="/content/$collection/$entryId"
                    params={{ collection: page.collection, entryId: page.entryId }}
                    search={{ locale: undefined }}
                    className="text-body text-accent hover:underline focus-visible:focus-ring"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {block.usedIn.length > 0 && (
            <p className="text-footnote text-label-secondary">
              {t("blocks.inContentTypes", { names: block.usedIn.join(", ") })}
            </p>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={t("blocks.removalTitle")}
        message={t("blocks.removalMessage", {
          properties: pendingRemoval?.properties.join(", ") ?? "",
          pages: pendingRemoval?.pages.join(", ") ?? "",
        })}
        confirmLabel={t("blocks.removalConfirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={isSaving}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          setPendingRemoval(null);
          void save(true);
        }}
      />
      <ConfirmDialog
        open={isDeleting}
        title={
          block.usedOn.length > 0
            ? t("blocks.deleteInUseTitle", { name: block.name, count: block.usedOn.length })
            : t("blocks.deleteTitle", { name: block.name })
        }
        message={
          block.usedOn.length > 0 ? t("blocks.deleteInUseMessage") : t("blocks.deleteMessage")
        }
        confirmLabel={block.usedOn.length > 0 ? t("blocks.deleteAndConvert") : t("blocks.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setIsDeleting(false)}
        onConfirm={() => void confirmDelete()}
      />
      <ConfirmDialog
        open={leaveWarning.isAsking}
        title={t("editor.leaveTitle")}
        message={t("builder.leaveMessage")}
        confirmLabel={t("editor.leave")}
        cancelLabel={t("editor.stay")}
        isDestructive
        onCancel={leaveWarning.stay}
        onConfirm={leaveWarning.leave}
      />
    </>
  );
}

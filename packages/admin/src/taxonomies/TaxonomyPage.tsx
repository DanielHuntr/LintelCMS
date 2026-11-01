import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Ellipsis, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { NameSheet } from "../content/NameSheet.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { useCanChangeContentModel } from "../content-model-sync/contentModelSync.queries.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Menu } from "../design/Menu.js";
import { Skeleton } from "../design/Skeleton.js";
import { t, tCount } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import {
  createTerm,
  deleteTaxonomy,
  deleteTerm,
  renameTaxonomy,
  updateTerm,
} from "./taxonomies.api.js";
import { taxonomyKeys, useTaxonomy, useTerms } from "./taxonomies.queries.js";
import type { Term, TermChanges } from "./taxonomies.types.js";
import { TermSheet } from "./TermSheet.js";

type Editing = { term: Term | null } | null;

/** /content/taxonomies/:handle: a taxonomy's terms, to add, rename and remove. */
export function TaxonomyPage({ handle }: { handle: string }) {
  const taxonomy = useTaxonomy(handle);
  const terms = useTerms(handle);
  const canEditTerms = useCan("terms:update");
  const canEditTaxonomy = useCanChangeContentModel("taxonomies:update");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Editing>(null);
  const [termToDelete, setTermToDelete] = useState<Term | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeletingTaxonomy, setIsDeletingTaxonomy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: taxonomyKeys.taxonomies() });

  if (taxonomy.isError) {
    return <LoadError error={taxonomy.error} onRetry={() => void taxonomy.refetch()} />;
  }
  if (!taxonomy.data) {
    return (
      <LoadingRegion label={t("terms.loading")}>
        <Skeleton className="mb-8 h-10 w-48" />
        <Skeleton className="h-40 rounded-card" />
      </LoadingRegion>
    );
  }
  const { name, termCount } = taxonomy.data;

  async function saveTerm(changes: TermChanges) {
    if (editing?.term) await updateTerm(editing.term.id, changes);
    else await createTerm(handle, changes);
    await refresh();
    setEditing(null);
  }

  async function confirmDeleteTerm() {
    if (!termToDelete) return;
    setActionError(null);
    try {
      await deleteTerm(termToDelete.id);
      await refresh();
    } catch (error) {
      setActionError(describeError(error));
    }
    setTermToDelete(null);
  }

  async function confirmDeleteTaxonomy() {
    setActionError(null);
    try {
      await deleteTaxonomy(handle);
      await refresh();
      await navigate({ to: "/content/taxonomies" });
    } catch (error) {
      setActionError(describeError(error));
      setIsDeletingTaxonomy(false);
    }
  }

  const addButton = (variant: "filled" | "tinted") =>
    canEditTerms && (
      <Button
        variant={variant}
        icon={<Plus aria-hidden="true" />}
        onClick={() => setEditing({ term: null })}
      >
        {t("terms.add")}
      </Button>
    );

  return (
    <>
      <BackLink to="/content/taxonomies">{t("taxonomies.title")}</BackLink>
      <LargeTitle
        title={name}
        subtitle={tCount(
          { one: "taxonomies.termCount.one", other: "taxonomies.termCount.other" },
          termCount,
        )}
        actions={
          <>
            {termCount > 0 && addButton("tinted")}
            {canEditTaxonomy && (
              <Menu
                label={t("taxonomies.moreActions", { name })}
                trigger={<Ellipsis aria-hidden="true" className="size-5" />}
                items={[
                  {
                    label: t("taxonomies.rename"),
                    icon: Pencil,
                    onSelect: () => setIsRenaming(true),
                  },
                  {
                    label: t("taxonomies.delete"),
                    icon: Trash2,
                    tone: "danger",
                    onSelect: () => setIsDeletingTaxonomy(true),
                  },
                ]}
              />
            )}
          </>
        }
      />

      {actionError && (
        <p
          role="alert"
          className="mb-6 rounded-card bg-danger/10 px-4 py-3 text-footnote text-label"
        >
          {actionError}
        </p>
      )}
      {terms.isError && <LoadError error={terms.error} onRetry={() => void terms.refetch()} />}
      {terms.data?.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Tag}
            title={t("terms.emptyTitle", { name })}
            description={t("terms.emptyDescription")}
            action={addButton("filled")}
          />
        </div>
      )}
      {terms.data && terms.data.length > 0 && (
        <GroupedList footer={t("terms.footer")}>
          {terms.data.map((term) => (
            <GroupedListRow
              key={term.id}
              icon={Tag}
              iconTone="neutral"
              label={term.title}
              description={term.description ? `${term.slug} · ${term.description}` : term.slug}
              onSelect={canEditTerms ? () => setEditing({ term }) : undefined}
            />
          ))}
        </GroupedList>
      )}

      {editing && (
        <TermSheet
          term={editing.term}
          taxonomyName={name}
          onSave={saveTerm}
          onDelete={
            editing.term
              ? () => {
                  setTermToDelete(editing.term);
                  setEditing(null);
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={termToDelete !== null}
        title={t("terms.deleteTitle", { title: termToDelete?.title ?? "" })}
        message={t("terms.deleteMessage")}
        confirmLabel={t("terms.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setTermToDelete(null)}
        onConfirm={() => void confirmDeleteTerm()}
      />
      <ConfirmDialog
        open={isDeletingTaxonomy}
        title={t("taxonomies.deleteTitle", { name })}
        message={tCount(
          { one: "taxonomies.deleteMessage.one", other: "taxonomies.deleteMessage.other" },
          termCount,
        )}
        confirmLabel={t("taxonomies.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setIsDeletingTaxonomy(false)}
        onConfirm={() => void confirmDeleteTaxonomy()}
      />
      {isRenaming && (
        <NameSheet
          open
          title={t("taxonomies.rename")}
          nameLabel={t("taxonomies.name")}
          submitLabel={t("common.done")}
          initialName={name}
          onSubmit={async (newName) => {
            await renameTaxonomy(handle, newName);
            await refresh();
            setIsRenaming(false);
          }}
          onClose={() => setIsRenaming(false)}
        />
      )}
    </>
  );
}

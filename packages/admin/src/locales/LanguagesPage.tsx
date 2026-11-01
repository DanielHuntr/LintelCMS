import { useQueryClient } from "@tanstack/react-query";
import { Languages, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { NameSheet } from "../content/NameSheet.js";
import { Badge } from "../design/Badge.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t, tCount } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { AddLanguageSheet } from "./AddLanguageSheet.js";
import { addLocale, removeLocale, renameLocale } from "./locales.api.js";
import { localeKeys, useLocales } from "./locales.queries.js";
import type { Locale } from "./locales.types.js";

/** /settings/languages: the languages the site is written in. */
export function LanguagesPage() {
  const locales = useLocales();
  const canEdit = useCan("settings:update");
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [renaming, setRenaming] = useState<Locale | null>(null);
  const [removing, setRemoving] = useState<Locale | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: localeKeys.locales() });

  async function confirmRemove() {
    if (!removing) return;
    setActionError(null);
    try {
      await removeLocale(removing.code);
      await refresh();
    } catch (error) {
      setActionError(describeError(error));
    }
    setRemoving(null);
  }

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle
        title={t("languages.title")}
        subtitle={t("languages.subtitle")}
        actions={
          canEdit && (
            <Button
              variant="tinted"
              icon={<Plus aria-hidden="true" />}
              onClick={() => setIsAdding(true)}
            >
              {t("languages.add")}
            </Button>
          )
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
      {locales.isError && (
        <LoadError error={locales.error} onRetry={() => void locales.refetch()} />
      )}
      {locales.isPending && (
        <LoadingRegion label={t("languages.loading")}>
          <Skeleton className="h-14 rounded-card" />
        </LoadingRegion>
      )}
      {locales.data && (
        <div className="flex max-w-2xl flex-col gap-8">
          <GroupedList
            footer={
              locales.data.locales.length === 1
                ? t("languages.footerOne")
                : t("languages.footerMany")
            }
          >
            {locales.data.locales.map((locale) => (
              <GroupedListRow
                key={locale.code}
                icon={Languages}
                iconTone={locale.isDefault ? "accent" : "neutral"}
                label={locale.name}
                description={`${locale.code} · ${tCount(
                  { one: "entries.count.one", other: "entries.count.other" },
                  locale.entryCount,
                )}`}
                accessory={
                  <span className="flex items-center gap-1">
                    {locale.isDefault && <Badge tone="accent">{t("languages.main")}</Badge>}
                    {canEdit && (
                      <RowButton
                        label={t("languages.rename", { name: locale.name })}
                        onClick={() => setRenaming(locale)}
                      >
                        <Pencil aria-hidden="true" strokeWidth={1.75} className="size-4" />
                      </RowButton>
                    )}
                    {canEdit && !locale.isDefault && (
                      <RowButton
                        label={t("languages.remove", { name: locale.name })}
                        onClick={() => setRemoving(locale)}
                        tone="danger"
                      >
                        <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
                      </RowButton>
                    )}
                  </span>
                }
              />
            ))}
          </GroupedList>
        </div>
      )}

      {isAdding && locales.data && (
        <AddLanguageSheet
          existingCodes={locales.data.locales.map((locale) => locale.code)}
          onAdd={async (code) => {
            await addLocale({ code });
            await refresh();
            setIsAdding(false);
          }}
          onClose={() => setIsAdding(false)}
        />
      )}
      {renaming && (
        <NameSheet
          open
          title={t("languages.renameTitle")}
          description={renaming.code}
          nameLabel={t("languages.name")}
          submitLabel={t("common.done")}
          initialName={renaming.name}
          onSubmit={async (name) => {
            await renameLocale(renaming.code, name);
            await refresh();
            setRenaming(null);
          }}
          onClose={() => setRenaming(null)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title={t("languages.removeTitle", { name: removing?.name ?? "" })}
        message={t("languages.removeMessage")}
        confirmLabel={t("languages.removeConfirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => void confirmRemove()}
      />
    </>
  );
}

function RowButton({
  label,
  onClick,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "danger";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={classNames(
        "flex size-7 items-center justify-center rounded-control text-label-secondary hover:bg-fill focus-visible:focus-ring",
        tone === "danger" ? "hover:text-danger" : "hover:text-label",
      )}
    >
      {children}
    </button>
  );
}

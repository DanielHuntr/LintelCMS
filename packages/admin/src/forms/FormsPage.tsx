import { useNavigate } from "@tanstack/react-router";
import { ListChecks, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t, tCount } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { useCreateForm, useForms } from "./forms.queries.js";
import type { Form } from "./forms.types.js";
import { NewFormDialog } from "./NewFormDialog.js";

/** /forms: every form, with how many new submissions each has. */
export function FormsPage() {
  const forms = useForms();
  const createForm = useCreateForm();
  const canCreate = useCan("forms:update");
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const now = useNow();

  const newButton = canCreate && (
    <Button icon={<Plus aria-hidden="true" />} onClick={() => setIsCreating(true)}>
      {t("forms.list.new")}
    </Button>
  );

  return (
    <>
      <LargeTitle
        title={t("forms.list.title")}
        subtitle={t("forms.list.subtitle")}
        actions={
          <>
            <LinkButton
              variant="tinted"
              icon={<ShieldCheck aria-hidden="true" />}
              to="/forms/settings"
            >
              {t("forms.list.settings")}
            </LinkButton>
            {forms.data?.length === 0 ? undefined : newButton}
          </>
        }
      />

      {forms.isError && <LoadError error={forms.error} onRetry={() => void forms.refetch()} />}
      {forms.isPending && (
        <LoadingRegion label={t("forms.list.loading")}>
          <Skeleton className="h-14 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {forms.data?.length === 0 && (
        <div className="max-w-2xl rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={ListChecks}
            title={t("forms.list.emptyTitle")}
            description={t("forms.list.emptyDescription")}
            action={newButton}
          />
        </div>
      )}
      {forms.data && forms.data.length > 0 && (
        <div className="max-w-2xl">
          <GroupedList footer={t("forms.list.footer")}>
            {forms.data.map((form) => (
              <GroupedListRow
                key={form.id}
                icon={ListChecks}
                iconTone={form.acceptingSubmissions ? "accent" : "neutral"}
                label={form.name}
                description={describeForm(form, now)}
                accessory={
                  form.unreadCount > 0 ? (
                    <Badge tone="accent">
                      {t("forms.list.unread", { count: form.unreadCount })}
                    </Badge>
                  ) : form.acceptingSubmissions ? undefined : (
                    <Badge tone="neutral">{t("forms.list.closed")}</Badge>
                  )
                }
                to={`/forms/${encodeURIComponent(form.id)}`}
              />
            ))}
          </GroupedList>
        </div>
      )}

      {isCreating && (
        <NewFormDialog
          open
          isSaving={createForm.isPending}
          error={createForm.error}
          onClose={() => {
            createForm.reset();
            setIsCreating(false);
          }}
          onCreate={(form) =>
            createForm.mutate(form, {
              onSuccess: (created) =>
                void navigate({ to: "/forms/$formId", params: { formId: created.id } }),
            })
          }
        />
      )}
    </>
  );
}

function describeForm(form: Form, now: number): string {
  const count = tCount(
    { one: "forms.list.submissionCount.one", other: "forms.list.submissionCount.other" },
    form.submissionCount,
  );
  return form.lastSubmittedAt
    ? t("forms.list.lastSubmitted", { count, when: formatRelativeTime(form.lastSubmittedAt, now) })
    : count;
}

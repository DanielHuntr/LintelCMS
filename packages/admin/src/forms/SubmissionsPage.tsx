import { Download, Inbox, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { Pagination } from "../content/Pagination.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SearchField } from "../design/SearchField.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useDebouncedValue } from "../media/useDebouncedValue.js";
import { useCan } from "../session/SessionContext.js";
import { downloadSubmissionsCsv, saveFile, SUBMISSIONS_PER_PAGE } from "./forms.api.js";
import { useForm, useSubmissions, useUpdateSubmission } from "./forms.queries.js";
import type { Form, Submission, SubmissionFilter } from "./forms.types.js";
import { SubmissionDetail } from "./SubmissionDetail.js";
import { submissionPreview, submissionTitle } from "./submissionValues.js";

export interface SubmissionsView {
  submission?: string;
  search?: string;
  filter?: SubmissionFilter;
  page?: number;
}

interface SubmissionsPageProps {
  formId: string;
  view: SubmissionsView;
  onViewChange: (view: SubmissionsView) => void;
}

/**
 * /forms/$formId/submissions: the inbox. The list is on the left and the open submission
 * on the right; which one is open, the search and the filter are in the address.
 */
export function SubmissionsPage({ formId, view, onViewChange }: SubmissionsPageProps) {
  const form = useForm(formId);
  if (form.isError) return <LoadError error={form.error} onRetry={() => void form.refetch()} />;
  if (!form.data) {
    return (
      <LoadingRegion label={t("forms.inbox.loading")}>
        <Skeleton className="h-64 max-w-4xl rounded-card" />
      </LoadingRegion>
    );
  }
  return (
    <SubmissionsInbox formId={formId} form={form.data} view={view} onViewChange={onViewChange} />
  );
}

function SubmissionsInbox({ form, view, onViewChange }: SubmissionsPageProps & { form: Form }) {
  const [typedSearch, setTypedSearch] = useState(view.search ?? "");
  const search = useDebouncedValue(typedSearch, 300);
  const filter = view.filter ?? "all";
  const page = view.page ?? 1;
  const submissions = useSubmissions(form.id, { search, filter, page });
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const now = useNow();

  // Typing in the search box updates the address once the typing pauses.
  useEffect(() => {
    if ((view.search ?? "") !== search) {
      onViewChange({ ...view, search: search || undefined, page: undefined });
    }
  }, [search, view, onViewChange]);

  async function exportCsv() {
    setExportError(null);
    setIsExporting(true);
    try {
      const { blob, filename } = await downloadSubmissionsCsv(form.id);
      saveFile(blob, filename);
    } catch (error) {
      setExportError(describeError(error));
    } finally {
      setIsExporting(false);
    }
  }

  const list = submissions.data?.submissions ?? [];
  const total = submissions.data?.total ?? 0;
  const isFiltered = search !== "" || filter !== "all";

  return (
    <>
      <BackLink to="/forms/$formId" params={{ formId: form.id }}>
        {form.name}
      </BackLink>
      <LargeTitle
        title={t("forms.inbox.title")}
        subtitle={t("forms.list.submissionCount", { count: form.submissionCount })}
        actions={
          form.submissionCount > 0 && (
            <Button
              variant="tinted"
              icon={<Download aria-hidden="true" />}
              onClick={() => void exportCsv()}
              disabled={isExporting}
            >
              {isExporting ? t("forms.inbox.exporting") : t("forms.inbox.export")}
            </Button>
          )
        }
      />
      {exportError && (
        <p
          role="alert"
          className="mb-4 rounded-card bg-danger/10 px-4 py-3 text-footnote text-label"
        >
          {exportError}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <SearchField
            label={t("forms.inbox.search")}
            value={typedSearch}
            onValueChange={setTypedSearch}
          />
        </div>
        <SegmentedControl<SubmissionFilter>
          label={t("forms.inbox.filter")}
          options={[
            { value: "all", label: t("forms.inbox.filterAll") },
            { value: "unread", label: t("forms.inbox.filterUnread") },
            { value: "starred", label: t("forms.inbox.filterStarred") },
          ]}
          value={filter}
          onChange={(next) =>
            onViewChange({ ...view, filter: next === "all" ? undefined : next, page: undefined })
          }
        />
      </div>

      {submissions.isError && (
        <LoadError error={submissions.error} onRetry={() => void submissions.refetch()} />
      )}
      {submissions.isPending && (
        <LoadingRegion label={t("forms.inbox.loading")}>
          <Skeleton className="h-40 max-w-md rounded-card" />
        </LoadingRegion>
      )}

      {submissions.data && list.length === 0 && (
        <div className="max-w-2xl rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Inbox}
            title={isFiltered ? t("forms.inbox.noMatchesTitle") : t("forms.inbox.emptyTitle")}
            description={
              isFiltered ? t("forms.inbox.noMatchesDescription") : t("forms.inbox.emptyDescription")
            }
          />
        </div>
      )}

      {list.length > 0 && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div>
            <ul
              aria-label={t("forms.inbox.listLabel")}
              className="overflow-hidden rounded-card bg-surface"
            >
              {list.map((submission) => (
                <SubmissionRow
                  key={submission.id}
                  form={form}
                  submission={submission}
                  isOpen={submission.id === view.submission}
                  now={now}
                  onOpen={() => onViewChange({ ...view, submission: submission.id })}
                />
              ))}
            </ul>
            <Pagination
              page={page}
              pageCount={Math.ceil(total / SUBMISSIONS_PER_PAGE)}
              onPageChange={(next) => onViewChange({ ...view, page: next })}
            />
          </div>
          <div className="lg:sticky lg:top-6">
            {view.submission ? (
              <SubmissionDetail
                key={view.submission}
                formId={form.id}
                submissionId={view.submission}
                fields={form.fields}
                onDeleted={() => onViewChange({ ...view, submission: undefined })}
              />
            ) : (
              <div className="rounded-card bg-surface">
                <EmptyState
                  icon={Inbox}
                  title={t("forms.inbox.pickTitle")}
                  description={t("forms.inbox.pickDescription")}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SubmissionRow({
  form,
  submission,
  isOpen,
  now,
  onOpen,
}: {
  form: Form;
  submission: Submission;
  isOpen: boolean;
  now: number;
  onOpen: () => void;
}) {
  const canUpdate = useCan("forms:update");
  const markRead = useUpdateSubmission(form.id, submission.id);
  const title = submissionTitle(submission, form.fields);

  // Opening a submission marks it as read, as an email inbox does.
  useEffect(() => {
    if (isOpen && !submission.isRead && canUpdate && markRead.isIdle) {
      markRead.mutate({ isRead: true });
    }
  }, [isOpen, submission.isRead, canUpdate, markRead]);

  return (
    <li className="[&+&]:hairline-top">
      <button
        type="button"
        onClick={onOpen}
        aria-current={isOpen ? "true" : undefined}
        className={classNames(
          "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors duration-150 ease-standard focus-visible:focus-ring-inset",
          isOpen ? "bg-accent/12" : "hover:bg-fill/50",
        )}
      >
        <span
          aria-hidden="true"
          className={classNames(
            "mt-2 size-2 shrink-0 rounded-full",
            submission.isRead ? "bg-transparent" : "bg-accent-fill",
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span
              className={classNames(
                "truncate text-body text-label",
                !submission.isRead && "font-semibold",
              )}
            >
              {title}
            </span>
            {submission.isStarred && (
              <Star aria-hidden="true" className="size-3.5 shrink-0 fill-warning text-warning" />
            )}
          </span>
          <span className="truncate text-footnote text-label-secondary">
            {submissionPreview(submission, form.fields)}
          </span>
          <span className="sr-only">
            {[
              submission.isRead ? "" : t("forms.inbox.unread"),
              submission.isStarred ? t("forms.inbox.starred") : "",
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        </span>
        <span className="shrink-0 text-caption text-label-secondary">
          {formatRelativeTime(submission.createdAt, now)}
        </span>
      </button>
    </li>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { Ellipsis, FlaskConical, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { describeError } from "../api/describeError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Menu } from "../design/Menu.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { RunHistory } from "./RunHistory.js";
import { TestRunDialog } from "./TestRunDialog.js";
import { WorkflowEditor } from "./WorkflowEditor.js";
import { emptyDraft, findTemplate } from "./workflowTemplates.js";
import {
  useCatalogue,
  useDeleteWorkflow,
  useRunWorkflow,
  useSaveWorkflow,
  useWorkflow,
} from "./workflows.queries.js";
import type { Workflow, WorkflowDraft } from "./workflows.types.js";

interface WorkflowBuilderPageProps {
  /** Undefined for a new automation. */
  workflowId: string | undefined;
  /** A gallery example to start a new one from. */
  templateId?: string;
}

/** /automations/new and /automations/$workflowId: the builder, with its run history. */
export function WorkflowBuilderPage({ workflowId, templateId }: WorkflowBuilderPageProps) {
  const workflow = useWorkflow(workflowId);
  const session = useSession();

  if (workflowId && workflow.isError) {
    return (
      <>
        <BackLink to="/automations">{t("automations.title")}</BackLink>
        <LoadError error={workflow.error} onRetry={() => void workflow.refetch()} />
      </>
    );
  }
  if (workflowId && !workflow.data) {
    return (
      <LoadingRegion label={t("builder.loading")}>
        <Skeleton className="h-40 max-w-3xl rounded-card" />
      </LoadingRegion>
    );
  }
  const initial: WorkflowDraft = workflow.data
    ? toDraft(workflow.data)
    : (findTemplate(templateId)?.build(session.user) ?? emptyDraft());
  return (
    <Builder
      key={workflow.data?.id ?? templateId ?? "new"}
      saved={workflow.data}
      initial={initial}
    />
  );
}

function Builder({ saved, initial }: { saved: Workflow | undefined; initial: WorkflowDraft }) {
  const [draft, setDraft] = useState(initial);
  const [tab, setTab] = useState<"steps" | "history">("steps");
  const [openRunId, setOpenRunId] = useState<string | undefined>();
  const [isTesting, setIsTesting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const save = useSaveWorkflow(saved?.id);
  const run = useRunWorkflow(saved?.id ?? "");
  const remove = useDeleteWorkflow();
  const catalogue = useCatalogue();
  const canChange = useCan("workflows:update");
  const navigate = useNavigate();
  const hasChanges =
    saved === undefined || JSON.stringify(toDraft(saved)) !== JSON.stringify(draft);
  const canRunByHand = saved !== undefined && draft.trigger.type !== "event" && !hasChanges;

  function saveDraft() {
    save.mutate(draft, {
      onSuccess: (workflow) => {
        if (!saved) {
          void navigate({
            to: "/automations/$workflowId",
            params: { workflowId: workflow.id },
            replace: true,
          });
        }
      },
    });
  }

  function startRun(test: boolean, sampleData?: Record<string, unknown>) {
    run.mutate(
      { test, sampleData },
      {
        onSuccess: (started) => {
          setIsTesting(false);
          setTab("history");
          setOpenRunId(started.id);
        },
      },
    );
  }

  const trigger = draft.trigger;
  const sampleData =
    trigger.type === "event"
      ? (catalogue.data?.events.find((event) => event.name === trigger.event)?.sampleData ?? {})
      : {};

  const actions = canChange && (
    <div className="flex items-center gap-2">
      {saved && (
        <Button
          variant="tinted"
          icon={<FlaskConical aria-hidden="true" />}
          onClick={() => setIsTesting(true)}
          disabled={hasChanges}
          title={hasChanges ? t("builder.saveFirst") : undefined}
        >
          {t("builder.testRun")}
        </Button>
      )}
      {canRunByHand && (
        <Button
          variant="tinted"
          icon={<Play aria-hidden="true" />}
          onClick={() => startRun(false)}
          disabled={run.isPending}
        >
          {t("builder.runNow")}
        </Button>
      )}
      <Button
        onClick={saveDraft}
        disabled={save.isPending || !hasChanges || draft.name.trim() === ""}
      >
        {save.isPending ? t("builder.saving") : hasChanges ? t("builder.save") : t("builder.saved")}
      </Button>
      {saved && (
        <Menu
          label={t("builder.more")}
          trigger={<Ellipsis aria-hidden="true" className="size-5" />}
          items={[
            {
              label: t("builder.delete"),
              icon: Trash2,
              tone: "danger",
              onSelect: () => setIsConfirmingDelete(true),
            },
          ]}
        />
      )}
    </div>
  );

  return (
    <>
      <BackLink to="/automations">{t("automations.title")}</BackLink>
      <LargeTitle title={saved?.name || draft.name || t("builder.newTitle")} actions={actions} />

      <div className="flex max-w-3xl flex-col gap-6">
        {save.isError && (
          <p role="alert" className="rounded-card bg-danger/10 px-4 py-3 text-footnote text-label">
            {describeError(save.error)}
          </p>
        )}
        {run.isError && !isTesting && (
          <p role="alert" className="rounded-card bg-danger/10 px-4 py-3 text-footnote text-label">
            {describeError(run.error)}
          </p>
        )}
        {saved && (
          <SegmentedControl
            label={t("builder.tabsLabel")}
            value={tab}
            onChange={setTab}
            options={[
              { value: "steps", label: t("builder.tab.steps") },
              { value: "history", label: t("builder.tab.history") },
            ]}
          />
        )}
        {tab === "steps" || !saved ? (
          <WorkflowEditor
            draft={draft}
            onChange={setDraft}
            saved={saved}
            catalogue={catalogue.data}
            readOnly={!canChange}
            hasChanges={hasChanges}
          />
        ) : (
          <RunHistory
            workflowId={saved.id}
            openRunId={openRunId}
            onOpenRun={setOpenRunId}
            canChange={canChange}
          />
        )}
      </div>

      {isTesting && (
        <TestRunDialog
          sampleData={sampleData}
          isStarting={run.isPending}
          error={run.error}
          onClose={() => {
            run.reset();
            setIsTesting(false);
          }}
          onStart={(data) => startRun(true, data)}
        />
      )}
      {saved && (
        <ConfirmDialog
          open={isConfirmingDelete}
          title={t("builder.deleteTitle", { name: saved.name })}
          message={t("builder.deleteMessage")}
          confirmLabel={t("builder.delete")}
          cancelLabel={t("common.cancel")}
          isDestructive
          isWorking={remove.isPending}
          onCancel={() => setIsConfirmingDelete(false)}
          onConfirm={() =>
            remove.mutate(saved.id, { onSuccess: () => void navigate({ to: "/automations" }) })
          }
        />
      )}
    </>
  );
}

function toDraft(workflow: Workflow): WorkflowDraft {
  return {
    name: workflow.name,
    description: workflow.description,
    enabled: workflow.enabled,
    trigger: workflow.trigger,
    steps: workflow.steps,
  };
}

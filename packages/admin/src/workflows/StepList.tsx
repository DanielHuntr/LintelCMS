import { Plus } from "lucide-react";
import { Menu } from "../design/Menu.js";
import { t } from "../i18n/strings.js";
import { type DescribeContext, describeStep } from "./describeSteps.js";
import { stepIcons } from "./stepIcons.js";
import type { StepPlace } from "./stepTree.js";
import { StepCard } from "./StepCard.js";
import type { StepType, WorkflowStep } from "./workflows.types.js";

/** The steps someone can add, in the order the menu offers them. */
export const addableStepTypes: readonly StepType[] = [
  "send_email",
  "notify_users",
  "http_request",
  "update_entry_field",
  "publish_entry",
  "unpublish_entry",
  "run_workflow",
  "condition",
  "approval",
  "wait",
];

export interface FlowActions {
  onAdd: (place: StepPlace, index: number, type: StepType) => void;
  onEdit: (step: WorkflowStep) => void;
  onRemove: (stepId: string) => void;
  onMove: (stepId: string, direction: -1 | 1) => void;
}

interface StepListProps {
  steps: readonly WorkflowStep[];
  place: StepPlace;
  context: DescribeContext;
  /** Without actions the flow is read-only. */
  actions?: FlowActions;
}

/**
 * The flow, top to bottom: each step a card, with a + between them to add one there.
 * Conditions and approvals split into two lanes, each a StepList of its own.
 */
export function StepList({ steps, place, context, actions }: StepListProps) {
  return (
    <ol className="flex flex-col">
      {actions && <AddStepButton onAdd={(type) => actions.onAdd(place, 0, type)} />}
      {steps.length === 0 && !actions && <Connector />}
      {steps.map((step, index) => (
        <StepWithBranches
          key={step.id}
          step={step}
          context={context}
          actions={actions}
          isFirst={index === 0}
          isLast={index === steps.length - 1}
          onAddAfter={actions ? (type) => actions.onAdd(place, index + 1, type) : undefined}
        />
      ))}
    </ol>
  );
}

function StepWithBranches({
  step,
  context,
  actions,
  isFirst,
  isLast,
  onAddAfter,
}: {
  step: WorkflowStep;
  context: DescribeContext;
  actions: FlowActions | undefined;
  isFirst: boolean;
  isLast: boolean;
  onAddAfter: ((type: StepType) => void) | undefined;
}) {
  const branches =
    step.type === "condition" || step.type === "approval" ? (
      <div className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-2">
        {(["then", "otherwise"] as const).map((branch) => (
          <section
            key={branch}
            aria-label={branchLabel(step.type, branch)}
            className="flex flex-col rounded-card bg-fill/60 p-3"
          >
            <h3 className="mb-1 text-caption font-semibold tracking-wide text-label-secondary uppercase">
              {branchLabel(step.type, branch)}
            </h3>
            {step[branch].length === 0 && !actions && (
              <p className="text-footnote text-label-tertiary">{t("steps.emptyBranch")}</p>
            )}
            <StepList
              steps={step[branch]}
              place={{ parentId: step.id, branch }}
              context={context}
              actions={actions}
            />
          </section>
        ))}
      </div>
    ) : undefined;

  return (
    <>
      <StepCard
        type={step.type}
        kindLabel={t(`step.${step.type}`)}
        description={describeStep(step, context)}
        onEdit={
          actions && step.type !== "publish_entry" && step.type !== "unpublish_entry"
            ? () => actions.onEdit(step)
            : undefined
        }
        onRemove={actions ? () => actions.onRemove(step.id) : undefined}
        onMoveUp={actions && !isFirst ? () => actions.onMove(step.id, -1) : undefined}
        onMoveDown={actions && !isLast ? () => actions.onMove(step.id, 1) : undefined}
      >
        {branches}
      </StepCard>
      {onAddAfter ? <AddStepButton onAdd={onAddAfter} /> : !isLast && <Connector />}
    </>
  );
}

function branchLabel(type: "condition" | "approval", branch: "then" | "otherwise"): string {
  if (type === "approval")
    return t(branch === "then" ? "steps.branch.approved" : "steps.branch.rejected");
  return t(branch === "then" ? "steps.branch.yes" : "steps.branch.no");
}

/** The line between cards, with a + that offers every kind of step. */
function AddStepButton({ onAdd }: { onAdd: (type: StepType) => void }) {
  return (
    <li className="flex flex-col items-center py-1" aria-label={t("steps.addHere")}>
      <span aria-hidden="true" className="h-3 w-px bg-separator" />
      <Menu
        label={t("steps.addHere")}
        trigger={<Plus aria-hidden="true" className="size-4" />}
        items={addableStepTypes.map((type) => ({
          label: t(`step.${type}`),
          icon: stepIcons[type],
          onSelect: () => onAdd(type),
        }))}
      />
      <span aria-hidden="true" className="h-3 w-px bg-separator" />
    </li>
  );
}

function Connector() {
  return (
    <li aria-hidden="true" className="flex justify-center py-1">
      <span className="h-5 w-px bg-separator" />
    </li>
  );
}

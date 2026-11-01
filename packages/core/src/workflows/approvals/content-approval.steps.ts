import type { WorkflowStep } from "../workflow-definition.schema.js";

/**
 * The steps of a collection's approval workflow. The approval step tells the reviewers
 * itself; the author hears back either way.
 */
export function buildContentApprovalSteps(
  reviewerRole: string,
  publishWhenApproved: boolean,
): WorkflowStep[] {
  return [
    {
      id: "review",
      type: "approval",
      role: reviewerRole,
      message: "{{actor.name}} asked you to review “{{entry.title}}”",
      expiresAfterDays: null,
      then: [
        ...(publishWhenApproved ? [{ id: "publish", type: "publish_entry" } as const] : []),
        {
          id: "tellAuthorApproved",
          type: "notify_users",
          to: { type: "actor" },
          message: publishWhenApproved
            ? "“{{entry.title}}” was approved and published"
            : "“{{entry.title}}” was approved. You can publish it now",
        },
      ],
      otherwise: [
        {
          id: "tellAuthorChanges",
          type: "notify_users",
          to: { type: "actor" },
          message: "Changes were requested on “{{entry.title}}”: {{steps.review.comment}}",
        },
      ],
    },
  ];
}

/** Reads the settings back out of the steps, so the steps are the only record of them. */
export function readContentApprovalSteps(steps: readonly WorkflowStep[]): {
  reviewerRole: string;
  publishWhenApproved: boolean;
} {
  const approval = steps.find((step) => step.type === "approval");
  if (!approval || approval.type !== "approval") {
    return { reviewerRole: "super-admin", publishWhenApproved: false };
  }
  return {
    reviewerRole: approval.role,
    publishWhenApproved: approval.then.some((step) => step.type === "publish_entry"),
  };
}

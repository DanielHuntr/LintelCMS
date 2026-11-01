import { HttpError } from "../http/http-errors.js";

export class WorkflowNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That workflow doesn't exist. It may have been deleted.");
  }
}

export class WorkflowRunNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That run isn't in the history.");
  }
}

export class ApprovalNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That approval request doesn't exist.");
  }
}

export class InvalidWorkflowError extends HttpError {
  constructor(problem: string) {
    super(400, "INVALID_WORKFLOW", problem);
  }
}

export class NotAnApproverError extends HttpError {
  constructor(role: string) {
    super(403, "NOT_AN_APPROVER", `Only people with the “${role}” role can answer this request.`);
  }
}

export class ApprovalAlreadyAnsweredError extends HttpError {
  constructor() {
    super(409, "APPROVAL_ANSWERED", "Someone has already answered this request.");
  }
}

export class CommentNeededError extends HttpError {
  constructor() {
    super(400, "COMMENT_NEEDED", "Please say what needs changing, so the author knows what to do.");
  }
}

export class RunNotStoppableError extends HttpError {
  constructor() {
    super(409, "RUN_FINISHED", "This run has already finished, so there is nothing to stop.");
  }
}

export class ApprovalRequiredError extends HttpError {
  constructor(collectionName: string) {
    super(
      409,
      "APPROVAL_REQUIRED",
      `${collectionName} need approval before they are published. Submit it for review instead.`,
    );
  }
}

export class ReviewAlreadyRequestedError extends HttpError {
  constructor() {
    super(409, "REVIEW_IN_PROGRESS", "This entry is already waiting for review.");
  }
}

export class ApprovalNotRequiredError extends HttpError {
  constructor() {
    super(
      409,
      "APPROVAL_NOT_REQUIRED",
      "This collection doesn't need approval, so it can be published straight away.",
    );
  }
}

export class ManualRunNotAllowedError extends HttpError {
  constructor() {
    super(
      409,
      "NOT_STARTED_BY_HAND",
      "This workflow starts by itself when something happens, so it can't be run by hand. Use Test run to try it with sample data.",
    );
  }
}

export class WorkflowSwitchedOffError extends HttpError {
  constructor() {
    super(409, "WORKFLOW_OFF", "This workflow is switched off. Switch it on to run it.");
  }
}

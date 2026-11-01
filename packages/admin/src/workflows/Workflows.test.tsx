import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import {
  type DescribeContext,
  describeStep,
  describeTrigger,
  summariseWorkflow,
} from "./describeSteps.js";
import { EntryReviewSection } from "./EntryReviewSection.js";
import { insertStep, moveStep, newStepId, removeStep } from "./stepTree.js";
import { WorkflowBuilderPage } from "./WorkflowBuilderPage.js";
import { WorkflowsPage } from "./WorkflowsPage.js";
import type { Catalogue, EntryReview, WorkflowStep } from "./workflows.types.js";

const context: DescribeContext = {
  events: [],
  collectionNames: { posts: "Blog posts", pages: "Pages" },
  workflows: [{ id: "w2", name: "Tell the team" }],
};

const catalogue: Catalogue = {
  events: [
    {
      name: "entry.published",
      label: "An entry is published",
      group: "Content",
      sampleData: { entry: { title: "Hello" } },
    },
    { name: "form.submitted", label: "A form is submitted", group: "Forms", sampleData: {} },
  ],
  roles: [
    { handle: "super-admin", name: "Super admin" },
    { handle: "editor", name: "Editor" },
  ],
};

const collections = [{ id: "c1", handle: "posts", name: "Blog posts" }];

afterEach(() => vi.restoreAllMocks());

describe("plain-English descriptions", () => {
  it("read triggers and steps as sentences", () => {
    expect(
      describeTrigger({ type: "event", event: "entry.published", collections: ["posts"] }, context),
    ).toBe("When an entry is published in Blog posts");
    expect(describeTrigger({ type: "schedule", cron: "0 9 * * 1" }, context)).toBe(
      "Every Monday at 9:00 (UTC)",
    );
    expect(
      describeStep(
        {
          id: "e",
          type: "send_email",
          to: { type: "role", role: "editor" },
          subject: "New post",
          body: "",
        },
        context,
      ),
    ).toBe("Send an email to everyone with the editor role: “New post”");
    expect(describeStep({ id: "w", type: "wait", amount: 1, unit: "days" }, context)).toBe(
      "Wait 1 day",
    );
    expect(
      describeStep(
        {
          id: "c",
          type: "condition",
          match: "any",
          conditions: [
            { type: "field_contains", field: "title", value: "News" },
            { type: "collection_is", collections: ["pages"] },
          ],
          then: [],
          otherwise: [],
        },
        context,
      ),
    ).toBe("If title contains “News” or it’s in Pages");
    expect(
      summariseWorkflow(
        {
          trigger: { type: "event", event: "form.submitted", collections: [] },
          steps: [{ id: "r", type: "run_workflow", workflowId: "w2" }],
        },
        context,
      ),
    ).toBe("When a form is submitted → Run “Tell the team”");
  });
});

describe("changing the flow", () => {
  const condition: WorkflowStep = {
    id: "check1",
    type: "condition",
    match: "all",
    conditions: [{ type: "field_changed", field: "title" }],
    then: [],
    otherwise: [],
  };

  it("adds into branches, moves and removes steps", () => {
    const publish: WorkflowStep = { id: "publish1", type: "publish_entry" };
    const notify: WorkflowStep = {
      id: "notify1",
      type: "notify_users",
      to: { type: "actor" },
      message: "Hi",
    };
    let steps = insertStep([condition], { parentId: "check1", branch: "then" }, 0, publish);
    steps = insertStep(steps, { parentId: "check1", branch: "then" }, 1, notify);
    expect(steps[0]).toMatchObject({ then: [{ id: "publish1" }, { id: "notify1" }] });

    steps = moveStep(steps, "notify1", -1);
    expect(steps[0]).toMatchObject({ then: [{ id: "notify1" }, { id: "publish1" }] });
    expect(newStepId("publish_entry", steps)).toBe("publish2");

    steps = removeStep(steps, "notify1");
    expect(steps[0]).toMatchObject({ then: [{ id: "publish1" }] });
  });
});

describe("the automations screen", () => {
  it("guides people with no automations to the examples", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/workflows") return { workflows: [] };
      if (url.pathname === "/workflows/catalogue") return catalogue;
      if (url.pathname === "/collections") return { collections };
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    renderScreen(<WorkflowsPage />);

    expect(await screen.findByText("Nothing automated yet")).toBeInTheDocument();
    for (const name of [
      "Notify me when a form is submitted",
      "Post new blog posts to Slack",
      "Require approval for pages",
      "Call my server when content changes",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
  });
});

describe("the builder", () => {
  it("starts from an example, adds a step with the + menu, and saves", async () => {
    const { calls } = mockApi(({ method, url, body }) => {
      if (url.pathname === "/workflows" && method === "GET") return { workflows: [] };
      if (url.pathname === "/workflows/catalogue") return catalogue;
      if (url.pathname === "/collections") return { collections };
      if (url.pathname === "/workflows" && method === "POST") {
        return {
          id: "w1",
          secret: "whsec_1",
          purpose: null,
          lastRun: null,
          createdAt: "",
          updatedAt: "",
          ...(body as object),
        };
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<WorkflowBuilderPage workflowId={undefined} templateId="slack-posts" />);

    expect(
      await screen.findByRole("article", {
        name: "When: When an entry is published in Blog posts",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", {
        name: /^Call a web address: Call https:\/\/hooks\.slack\.com/,
      }),
    ).toBeInTheDocument();

    const addButtons = screen.getAllByRole("button", { name: "Add a step here" });
    await userEvent.click(addButtons.at(-1) as HTMLElement);
    await userEvent.click(screen.getByRole("menuitem", { name: "Send an email" }));
    const dialog = screen.getByRole("dialog", { name: "Send an email" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Please fill in Subject.");
    await userEvent.type(within(dialog).getByLabelText("Subject"), "Posted: {{{{entry.title}}");
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(
      screen.getByRole("article", {
        name: "Send an email: Send an email to the person who made the change: “Posted: {{entry.title}}”",
      }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const saved = calls.find((call) => call.method === "POST")?.body as { steps: WorkflowStep[] };
    expect(saved.steps.map((step) => step.id)).toEqual(["call1", "email1"]);
  });
});

describe("the review panel", () => {
  const inReview: EntryReview = {
    required: true,
    state: "in_review",
    changedSinceApproval: false,
    reviewerRole: "editor",
    reviewerRoleName: "Editor",
    pendingApprovalId: "a1",
    canReview: true,
    canSkipReview: false,
    history: [{ kind: "submitted", by: "Sam", comment: "Ready", at: "2026-11-01T09:00:00Z" }],
  };

  it("lets a reviewer ask for changes with a comment", async () => {
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/entries/e1/review") return inReview;
      if (method === "POST" && url.pathname === "/workflow-approvals/a1/decision") return {};
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<EntryReviewSection entryId="e1" collectionName="Pages" />);

    expect(await screen.findByText("In review")).toBeInTheDocument();
    expect(screen.getByText("Sam submitted it")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Comment"), "Add a photo");
    await userEvent.click(screen.getByRole("button", { name: "Request changes" }));

    expect(calls.find((call) => call.method === "POST")?.body).toEqual({
      decision: "request_changes",
      comment: "Add a photo",
    });
  });

  it("shows nothing when the collection doesn't need approval", async () => {
    const { calls } = mockApi(() => ({ ...inReview, required: false }));
    const { container } = { container: document.body };
    renderScreen(<EntryReviewSection entryId="e1" collectionName="Pages" />);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(within(container).queryByText("Review")).not.toBeInTheDocument();
  });
});

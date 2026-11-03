import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { ClientReviewListItem, EntryReviewState } from "./clientEditing.api.js";
import { ClientChangesSetting } from "./ClientChangesSetting.js";
import { SendForReviewButton, SentBackNote } from "./SendForReview.js";
import { WaitingForReviewWidget } from "./WaitingForReviewWidget.js";

afterEach(() => vi.restoreAllMocks());

const review = {
  id: "r1",
  entryId: "e1",
  status: "waiting" as const,
  requestedByName: "Cleo",
  requestNote: "",
  requestedAt: "2026-11-03T10:00:00Z",
  decidedByName: null,
  decisionNote: "",
  decidedAt: null,
};

const waiting: ClientReviewListItem = {
  ...review,
  entry: { id: "e1", title: "Opening hours", collection: "pages", collectionName: "Pages" },
};

describe("Send for review", () => {
  const state: EntryReviewState = { needsApproval: true, mustSendForReview: true, review: null };

  it("sends the changes, then says they are waiting", async () => {
    const { calls } = mockApi(({ url }) => {
      if (url.pathname === "/entries/e1/review") return { ...state, review };
      throw new Error(`Unexpected ${url.pathname}`);
    });
    const beforeSending = vi.fn();
    renderScreen(<SendForReviewButton entryId="e1" state={state} beforeSending={beforeSending} />);
    await userEvent.click(await screen.findByRole("button", { name: "Send for review" }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === "POST")?.url.pathname).toBe("/entries/e1/review"),
    );
    expect(beforeSending).toHaveBeenCalled();
    expect(
      await screen.findByText("Sent for review. The site team will check your changes."),
    ).toBeInTheDocument();
  });

  it("can't be pressed again while the changes wait", async () => {
    mockApi(() => undefined);
    renderScreen(<SendForReviewButton entryId="e1" state={{ ...state, review }} />);
    expect(await screen.findByRole("button", { name: "Waiting for review" })).toBeDisabled();
  });

  it("shows what the reviewer said when they sent the changes back", async () => {
    mockApi(() => undefined);
    renderScreen(
      <SentBackNote
        state={{
          ...state,
          review: {
            ...review,
            status: "sentBack",
            decidedByName: "Sam",
            decisionNote: "Check the spelling in the heading",
          },
        }}
      />,
    );
    expect(await screen.findByText("Sent back by Sam")).toBeInTheDocument();
    expect(screen.getByText(/Check the spelling in the heading/)).toBeInTheDocument();
  });
});

describe("the Waiting for review widget", () => {
  it("approves a client's changes", async () => {
    const { calls } = mockApi(({ url, method }) => {
      if (url.pathname === "/client-reviews" && method === "GET") {
        return { reviews: calls.some((call) => call.method === "POST") ? [] : [waiting] };
      }
      if (url.pathname === "/client-reviews/r1/approve") return { ...review, status: "approved" };
      throw new Error(`Unexpected ${url.pathname}`);
    });
    renderScreen(<WaitingForReviewWidget />);
    expect(await screen.findByText("Opening hours")).toBeInTheDocument();
    expect(screen.getByText("Pages · sent by Cleo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Nothing waiting")).toBeInTheDocument();
  });

  it("sends changes back with a note", async () => {
    const { calls } = mockApi(({ url }) => {
      if (url.pathname === "/client-reviews") return { reviews: [waiting] };
      if (url.pathname === "/client-reviews/r1/send-back") return { ...review, status: "sentBack" };
      throw new Error(`Unexpected ${url.pathname}`);
    });
    renderScreen(<WaitingForReviewWidget />);
    await userEvent.click(await screen.findByRole("button", { name: "Send back" }));
    const confirm = screen.getAllByRole("button", { name: "Send back" }).at(-1)!;
    expect(confirm).toBeDisabled();
    await userEvent.type(
      screen.getByRole("textbox", { name: "What should they change?" }),
      "Use the new photo",
    );
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(calls.find((call) => call.method === "POST")?.body).toEqual({
        note: "Use the new photo",
      }),
    );
  });

  it("lists changes without the buttons for people who can't approve", async () => {
    mockApi(() => ({ reviews: [waiting] }));
    renderScreen(<WaitingForReviewWidget />, { permissions: ["entries:read", "entries:publish"] });
    expect(await screen.findByText("Opening hours")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});

describe("the Clients' changes setting", () => {
  it("switches clients' changes to wait for approval", async () => {
    const { calls } = mockApi(({ method }) =>
      method === "PATCH" ? { clientChanges: "needsApproval" } : { clientChanges: "goLive" },
    );
    renderScreen(<ClientChangesSetting />);
    await userEvent.click(await screen.findByRole("radio", { name: "Wait for approval" }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({
        clientChanges: "needsApproval",
      }),
    );
  });

  it("isn't shown to people who can't change settings", async () => {
    mockApi(() => ({ clientChanges: "goLive" }));
    renderScreen(<ClientChangesSetting />, { permissions: ["users:read"] });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Clients’ changes")).toBeNull();
  });
});

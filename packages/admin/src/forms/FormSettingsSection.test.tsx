import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { type FormSettingsDraft, FormSettingsSection } from "./FormSettingsSection.js";

afterEach(() => vi.restoreAllMocks());

const draft: FormSettingsDraft = {
  submitLabel: "Send",
  confirmation: { type: "message", message: "Thanks, we'll be in touch." },
  notifications: {
    notifyOwner: true,
    recipients: [],
    subject: "New message",
    confirmationEmail: { enabled: false, subject: "", message: "" },
  },
  retentionDays: null,
  acceptingSubmissions: true,
};

const warning = /Email isn’t set up on this website yet/;

describe("a form's email settings", () => {
  // Notifications were on by default and silently never sent without a mail service.
  it("warns that its emails won't be sent while email isn't set up", async () => {
    mockApi(() => ({ delivers: false }));
    renderScreen(<FormSettingsSection draft={draft} hasEmailField onChange={vi.fn()} />);

    expect(await screen.findByRole("note")).toHaveTextContent(warning);
  });

  // The warning was a dead end: it now says what to do and where to read more.
  it("says what to do next, with a link to help", async () => {
    mockApi(() => ({ delivers: false }));
    renderScreen(<FormSettingsSection draft={draft} hasEmailField onChange={vi.fn()} />);

    const note = await screen.findByRole("note");
    expect(note).toHaveTextContent(/Ask whoever set up your website to connect an email service/);
    expect(screen.getByRole("link", { name: "How emails work" })).toHaveAttribute(
      "href",
      expect.stringContaining("topic=using%2Fforms"),
    );
  });

  it("says nothing once a mail service sends them", async () => {
    const api = mockApi(() => ({ delivers: true }));
    renderScreen(<FormSettingsSection draft={draft} hasEmailField onChange={vi.fn()} />);

    await vi.waitFor(() => expect(api.calls).toHaveLength(1));
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });
});

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { FormBuilderPage } from "./FormBuilderPage.js";
import { FormsPage } from "./FormsPage.js";
import { FormsSettingsPage } from "./FormsSettingsPage.js";
import { anaSubmission, contactForm } from "./forms.test-data.js";
import type { FormChanges } from "./forms.types.js";
import { SubmissionsPage } from "./SubmissionsPage.js";

afterEach(() => vi.restoreAllMocks());

describe("the forms list", () => {
  it("guides a first form from a template", async () => {
    const { calls } = mockApi(({ method, url, body }) => {
      if (url.pathname === "/forms" && method === "GET") return { forms: [] };
      if (url.pathname === "/forms" && method === "POST")
        return { ...contactForm, ...(body as object) };
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<FormsPage />, { enabledPlugins: ["forms"] });

    expect(await screen.findByText("No forms yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "New form" }));
    const dialog = screen.getByRole("dialog", { name: "New form" });
    await userEvent.click(within(dialog).getByRole("radio", { name: /Newsletter sign-up/ }));
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Newsletter sign-up");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create form" }));

    expect(calls.find((call) => call.method === "POST")?.body).toEqual({
      name: "Newsletter sign-up",
      template: "newsletter",
    });
  });

  it("shows how many new submissions each form has", async () => {
    mockApi(() => ({ forms: [contactForm] }));
    renderScreen(<FormsPage />, { enabledPlugins: ["forms"] });

    expect(await screen.findByText("Contact")).toBeInTheDocument();
    expect(screen.getByText("1 new")).toBeInTheDocument();
  });
});

describe("the form builder", () => {
  function mockForm() {
    return mockApi(({ method, url, body }) => {
      if (url.pathname === "/forms/f1" && method === "GET") return contactForm;
      if (url.pathname === "/forms/f1" && method === "PATCH")
        return { ...contactForm, ...(body as FormChanges) };
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
  }

  it("adds a field, shows it in the preview, and saves the new order", async () => {
    const { calls } = mockForm();
    renderScreen(<FormBuilderPage formId="f1" />, { enabledPlugins: ["forms"] });

    expect(await screen.findByRole("heading", { level: 1, name: "Contact" })).toBeInTheDocument();
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(within(preview).getByLabelText(/Your name/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add field" }));
    await userEvent.click(screen.getByRole("button", { name: /Phone/ }));
    const sheet = screen.getByRole("dialog", { name: "Phone number" });
    await userEvent.clear(within(sheet).getByLabelText("Question"));
    await userEvent.type(within(sheet).getByLabelText("Question"), "Mobile");
    await userEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(within(preview).getByLabelText("Mobile")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Move Mobile up" }));
    expect(screen.getByText("Mobile moved to position 3 of 4.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const saved = calls.find((call) => call.method === "PATCH")?.body as FormChanges;
    expect(saved.fields?.map((field) => field.handle)).toEqual([
      "name",
      "email",
      "mobile",
      "message",
    ]);
  });

  it("won't save a field without a label", async () => {
    const { calls } = mockForm();
    renderScreen(<FormBuilderPage formId="f1" />, { enabledPlugins: ["forms"] });

    await userEvent.click(await screen.findByRole("button", { name: "Edit Message" }));
    const sheet = screen.getByRole("dialog", { name: "Message" });
    await userEvent.clear(within(sheet).getByLabelText("Question"));
    await userEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Some fields need attention");
    expect(screen.getByText("Give this field a label.")).toBeInTheDocument();
    expect(calls.some((call) => call.method === "PATCH")).toBe(false);
  });

  it("offers the embed code for other websites", async () => {
    mockForm();
    renderScreen(<FormBuilderPage formId="f1" />, { enabledPlugins: ["forms"] });

    await userEvent.click(await screen.findByRole("radio", { name: "Add to your site" }));
    expect(screen.getByText(/data-form="contact"/)).toBeInTheDocument();
  });

  // The code and the API were two cards beside "On a page"; they are for developers.
  it("folds the embed code and the API away under For developers", async () => {
    mockForm();
    renderScreen(<FormBuilderPage formId="f1" />, { enabledPlugins: ["forms"] });

    await userEvent.click(await screen.findByRole("radio", { name: "Add to your site" }));
    expect(screen.getByText(/add a Form element/)).toBeVisible();
    const developers = screen.getByText("For developers").closest("details");
    expect(developers).not.toHaveAttribute("open");
    expect(developers).toContainElement(screen.getByText(/data-form="contact"/));
    expect(developers).toContainElement(screen.getByText("Through the API"));
  });
});

describe("the submissions inbox", () => {
  it("opens a submission, marks it read and adds a note", async () => {
    let current = anaSubmission;
    const { calls } = mockApi(({ method, url, body }) => {
      if (url.pathname === "/forms/f1") return contactForm;
      if (url.pathname === "/forms/f1/submissions") return { submissions: [current], total: 1 };
      if (url.pathname === "/forms/f1/submissions/s1" && method === "GET") return current;
      if (url.pathname === "/forms/f1/submissions/s1" && method === "PATCH") {
        current = { ...current, ...(body as object) };
        return current;
      }
      if (url.pathname === "/forms/f1/submissions/s1/notes") {
        current = {
          ...current,
          notes: [
            {
              id: "n1",
              body: (body as { body: string }).body,
              author: { id: "u1", name: "Ada Lovelace" },
              createdAt: "2026-11-01T09:00:00Z",
            },
          ],
        };
        return current;
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    const view = { submission: "s1" };
    renderScreen(<SubmissionsPage formId="f1" view={view} onViewChange={() => {}} />, {
      enabledPlugins: ["forms"],
    });

    expect(await screen.findByRole("heading", { name: "Ana Lima" })).toBeInTheDocument();
    expect(screen.getByText("Please call me back.", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reply by email" })).toHaveAttribute(
      "href",
      "mailto:ana@example.com",
    );
    await vi.waitFor(() =>
      expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({ isRead: true }),
    );

    await userEvent.type(screen.getByLabelText("Add a note"), "Called back");
    await userEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(await screen.findByText("Called back")).toBeInTheDocument();
  });

  it("explains an empty inbox", async () => {
    mockApi(({ url }) =>
      url.pathname === "/forms/f1" ? contactForm : { submissions: [], total: 0 },
    );
    renderScreen(<SubmissionsPage formId="f1" view={{}} onViewChange={() => {}} />, {
      enabledPlugins: ["forms"],
    });
    expect(await screen.findByText("No submissions yet")).toBeInTheDocument();
  });
});

describe("spam and privacy", () => {
  it("finds one person's submissions and deletes them after asking", async () => {
    const { calls } = mockApi(({ url }) => {
      if (url.pathname === "/forms/settings")
        return { turnstileSiteKey: null, hasTurnstileSecret: false };
      if (url.pathname === "/forms/privacy/export") {
        return {
          email: "ana@example.com",
          exportedAt: "2026-11-01T09:00:00Z",
          submissions: [{ ...anaSubmission, form: { handle: "contact", name: "Contact" } }],
        };
      }
      if (url.pathname === "/forms/privacy/erase") return { deleted: 1 };
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    renderScreen(<FormsSettingsPage />, { enabledPlugins: ["forms"] });

    expect(await screen.findByText(/hidden trap for bots/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Their email address"), "ana@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByText("1 submission found, across all forms.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete everything" }));
    const confirm = screen.getByRole("alertdialog", {
      name: "Delete everything from ana@example.com?",
    });
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete everything" }));

    expect(await screen.findByText("1 submission deleted.")).toBeInTheDocument();
    expect(calls.at(-1)?.body).toEqual({ email: "ana@example.com" });
  });
});

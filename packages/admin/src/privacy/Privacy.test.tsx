import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { PersonalDataMapPage } from "./PersonalDataMapPage.js";
import { PolicyHelperPage } from "./PolicyHelperPage.js";
import { PrivacyPage } from "./PrivacyPage.js";
import type { PersonSearch, RetentionRule } from "./privacy.api.js";
import { ProcessorsPage } from "./ProcessorsPage.js";
import { describeLength, RetentionPage } from "./RetentionPage.js";

afterEach(() => vi.restoreAllMocks());

const grace: PersonSearch = {
  found: [
    {
      kindId: "form-entries",
      name: "Form entries",
      erasure: "Deleted, with the files they sent and your notes on them.",
      items: [{ id: "s1", summary: "Contact entry", date: "2026-10-31T09:00:00Z" }],
    },
    {
      kindId: "shop-orders",
      name: "Orders",
      erasure: "Kept for tax records with the name, email, address and phone removed.",
      items: [{ id: "o1", summary: "Order #1001", date: "2026-10-30T09:00:00Z" }],
    },
  ],
  notSearched: [
    { kindId: "plugin:chat", name: "Chat", reason: "This add-on can't search it yet." },
  ],
};

describe("Settings → Privacy", () => {
  it("finds a person, then erases them only after saying what happens to each kind", async () => {
    let erased = false;
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/privacy/requests") {
        return {
          requests: erased
            ? [
                {
                  id: "r1",
                  kind: "erase",
                  actorName: "Sam",
                  parts: [{ source: "Form entries", found: 1, deleted: 1, anonymised: 0, kept: 0 }],
                  createdAt: "2026-11-03T10:00:00Z",
                },
              ]
            : [],
        };
      }
      if (url.pathname === "/privacy/people/find")
        return erased ? { found: [], notSearched: [] } : grace;
      if (url.pathname === "/privacy/people/erase" && method === "POST") {
        erased = true;
        return { parts: [], explanations: ["Admin accounts aren't removed here."] };
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<PrivacyPage />, { permissions: ["privacy:manage"] });

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Email address" }),
      "grace@example.com",
    );
    await userEvent.click(screen.getByRole("button", { name: "Find" }));

    expect(await screen.findByText("Found 2 items")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(calls.find((call) => call.url.pathname === "/privacy/people/find")?.body).toEqual({
      email: "grace@example.com",
      name: null,
    });

    await userEvent.click(screen.getByRole("button", { name: "Erase…" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Erase this person's data?",
    });
    expect(within(dialog).getByText(/Kept for tax records/)).toBeInTheDocument();
    expect(calls.some((call) => call.url.pathname === "/privacy/people/erase")).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Erase" }));

    expect(await screen.findByText(/Their data has been erased/)).toBeInTheDocument();
    expect(screen.getByText("Admin accounts aren't removed here.")).toBeInTheDocument();
    expect(await screen.findByText("Data erased")).toBeInTheDocument();
    expect(screen.getByText(/By Sam/)).toBeInTheDocument();
  });

  it("searches by full name instead when asked", async () => {
    const { calls } = mockApi(({ url }) => {
      if (url.pathname === "/privacy/requests") return { requests: [] };
      if (url.pathname === "/privacy/people/find") return { found: [], notSearched: [] };
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    renderScreen(<PrivacyPage />, { permissions: ["privacy:manage"] });

    await userEvent.click(
      await screen.findByRole("button", { name: "Search by full name instead" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Or their full name" }),
      "Grace Hopper",
    );
    await userEvent.click(screen.getByRole("button", { name: "Find" }));

    expect(await screen.findByText(/Nothing found/)).toBeInTheDocument();
    expect(calls.find((call) => call.url.pathname === "/privacy/people/find")?.body).toEqual({
      email: null,
      name: "Grace Hopper",
    });
  });

  it("maps personal data, and flags add-ons that can't be searched", async () => {
    mockApi(() => ({
      kinds: [
        {
          id: "form-entries",
          name: "Form entries",
          description: "What people type into the site's forms.",
          from: "core",
          inUse: true,
          searchable: true,
          notSearchableReason: null,
          erasure: "Deleted.",
          tables: [{ name: "form_submissions", columns: ["values"] }],
        },
        {
          id: "plugin:chat",
          name: "Chat",
          description: "Messages people send.",
          from: "chat",
          inUse: true,
          searchable: false,
          notSearchableReason: "Look in it by hand.",
          erasure: null,
          tables: [],
        },
        {
          id: "visitors",
          name: "Visitors",
          description: "Visit counts.",
          from: "core",
          inUse: false,
          searchable: false,
          notSearchableReason: "Nothing here can identify a person.",
          erasure: null,
          tables: [],
        },
      ],
    }));
    renderScreen(<PersonalDataMapPage />);

    expect(await screen.findByText("Form entries")).toBeInTheDocument();
    expect(screen.getByText("Can't be searched")).toBeInTheDocument();
    expect(screen.getByText("Switched off")).toBeInTheDocument();
    expect(screen.getByText("form_submissions: values")).toBeInTheDocument();
  });

  it("saves a retention rule as soon as it changes, and says what will go", async () => {
    const rule = (changes: Partial<RetentionRule>): RetentionRule => ({
      id: "formEntries",
      enabled: false,
      days: 365,
      choices: [90, 180, 365, 730],
      applies: true,
      dueNow: 4,
      nextDueAt: null,
      ...changes,
    });
    const { calls } = mockApi(({ method, body }) => {
      if (method === "PUT")
        return {
          rules: [rule({ enabled: true, ...(body as { formEntries: object }).formEntries })],
        };
      return { rules: [rule({})] };
    });
    renderScreen(<RetentionPage />);

    expect(await screen.findByText("4 items are older than this")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "Form entries" }));

    expect(await screen.findByText("4 items will go in the next hour")).toBeInTheDocument();
    expect(calls.at(-1)?.body).toEqual({ formEntries: { enabled: true, days: 365 } });
    expect(screen.getByRole("combobox", { name: "Keep for" })).toHaveDisplayValue("1 year");
    expect([90, 180, 730, 2555].map(describeLength)).toEqual([
      "90 days",
      "6 months",
      "2 years",
      "7 years",
    ]);
  });

  it("drafts the policy, never as legal advice, and warns what the privacy page misses", async () => {
    mockApi(() => ({
      sections: [{ id: "forms", heading: "Forms", text: "When you fill in a form…" }],
      draft: "What this site collects\n\nForms\nWhen you fill in a form…",
      privacyPage: { id: "p1", title: "Privacy" },
      notMentioned: ["Stripe", "YouTube"],
    }));
    renderScreen(<PolicyHelperPage />);

    expect(await screen.findByText(/A starting point, not legal advice/)).toBeInTheDocument();
    expect(
      screen.getByText("Privacy doesn't seem to mention: Stripe, YouTube"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy the draft" })).toBeInTheDocument();
  });

  it("adds a company to the list", async () => {
    const { calls } = mockApi(({ method, body }) => {
      if (method === "PUT") {
        const { processors } = body as { processors: Array<Record<string, string>> };
        return {
          detected: [],
          added: processors.map((processor) => ({ ...processor, origin: "added" })),
        };
      }
      return {
        detected: [
          {
            id: "payments:Stripe",
            name: "Stripe",
            purpose: "Takes payments.",
            location: "",
            link: "",
            origin: "detected",
          },
        ],
        added: [],
      };
    });
    renderScreen(<ProcessorsPage />);

    expect(await screen.findByText("Stripe")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add a company" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Company" }), "Bytemark");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "What it does with the data" }),
      "Hosts the website",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Bytemark")).toBeInTheDocument();
    expect(calls.at(-1)?.body).toMatchObject({
      processors: [expect.objectContaining({ name: "Bytemark", purpose: "Hosts the website" })],
    });
  });
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { Account, AccountSession, TwoFactorStatus } from "./account.api.js";
import { AccountPage } from "./AccountPage.js";

const account: Account = {
  id: "u1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  avatar: null,
  pendingEmail: null,
  roles: [{ id: "r1", name: "Owner" }],
};

const sessions: AccountSession[] = [
  {
    id: "s1",
    browser: "Firefox on Mac",
    createdAt: "2026-10-01T00:00:00Z",
    lastUsedAt: "2026-10-31T00:00:00Z",
    current: true,
  },
  {
    id: "s2",
    browser: "Safari on iPhone",
    createdAt: "2026-10-01T00:00:00Z",
    lastUsedAt: "2026-10-30T00:00:00Z",
    current: false,
  },
];

function serveAccount(
  twoFactor: TwoFactorStatus = { enabled: false, required: false, recoveryCodesLeft: 0 },
) {
  return mockApi(({ method, url, body }) => {
    if (url.pathname === "/account" && method === "GET") return account;
    if (url.pathname === "/account/sessions") return { sessions };
    if (url.pathname === "/account/two-factor") return twoFactor;
    if (url.pathname === "/account/passkeys") return { passkeys: [] };
    if (url.pathname === "/account/two-factor/setup") {
      return {
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl: "otpauth://totp/x",
        qrCodeSvg: "<svg></svg>",
      };
    }
    if (url.pathname === "/account/two-factor/confirm") {
      if ((body as { code: string }).code !== "123456") {
        throw apiErrorResponse(
          401,
          "INVALID_TWO_FACTOR_CODE",
          "That code didn't work. Check the code in your authenticator app and try again.",
        );
      }
      return { recoveryCodes: ["aaaa-bbbb", "cccc-dddd"] };
    }
    if (url.pathname === "/account/password") {
      if ((body as { currentPassword: string }).currentPassword !== "the old password") {
        throw apiErrorResponse(401, "WRONG_PASSWORD", "That isn't your current password.");
      }
      return { endedSessions: 1 };
    }
    if (url.pathname === "/account/sessions/sign-out-others") return { endedSessions: 1 };
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("your account", () => {
  it("shows where you're signed in, and signs the other devices out", async () => {
    const { calls } = serveAccount();
    renderScreen(<AccountPage />);

    expect(await screen.findByText("Safari on iPhone")).toBeInTheDocument();
    expect(screen.getByText("This device")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign out other devices" }));

    expect(await screen.findByText("Your other devices are signed out.")).toBeInTheDocument();
    expect(calls.some((call) => call.url.pathname === "/account/sessions/sign-out-others")).toBe(
      true,
    );
  });

  it("turns on two-factor with a QR code and a typed key, then shows the recovery codes", async () => {
    serveAccount();
    renderScreen(<AccountPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Set up" }));
    const dialog = await screen.findByRole("dialog", { name: "Set up two-factor authentication" });
    expect(
      within(dialog).getByRole("img", { name: "QR code for your authenticator app" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();

    const codeField = within(dialog).getByLabelText("Then enter the 6-digit code the app shows");
    await userEvent.type(codeField, "000000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Turn on" }));
    expect(await within(dialog).findByText(/That code didn't work/)).toBeInTheDocument();

    await userEvent.clear(codeField);
    await userEvent.type(codeField, "123456");
    await userEvent.click(within(dialog).getByRole("button", { name: "Turn on" }));

    const done = await screen.findByRole("dialog", { name: "Two-factor authentication is on" });
    expect(within(done).getByRole("list", { name: "Recovery codes" })).toHaveTextContent(
      "aaaa-bbbb",
    );
  });

  it("won't offer to turn off two-factor when a role requires it", async () => {
    serveAccount({ enabled: true, required: true, recoveryCodesLeft: 8 });
    renderScreen(<AccountPage />);

    expect(await screen.findByText("Required by your role")).toBeInTheDocument();
    expect(screen.getByText("8 recovery codes left")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn off" })).not.toBeInTheDocument();
  });

  it("changes the password after checking the current one", async () => {
    serveAccount();
    renderScreen(<AccountPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Change password…" }));
    const dialog = screen.getByRole("dialog", { name: "Change your password" });
    await userEvent.type(within(dialog).getByLabelText("Current password"), "wrong");
    await userEvent.type(
      within(dialog).getByLabelText("New password"),
      "a lovely long new password",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect(
      await within(dialog).findByText("That isn't your current password."),
    ).toBeInTheDocument();

    await userEvent.clear(within(dialog).getByLabelText("Current password"));
    await userEvent.type(within(dialog).getByLabelText("Current password"), "the old password");
    await userEvent.click(within(dialog).getByRole("button", { name: "Change password" }));

    await waitFor(() =>
      expect(
        screen.getByText("Password changed. 1 other device was signed out."),
      ).toBeInTheDocument(),
    );
  });
});

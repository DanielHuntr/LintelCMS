import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { apiRequest } from "../api/client.js";
import type { Session } from "../session/session.api.js";

/** Calls for the signed-in person's own account (see packages/core/src/account). */

export interface Account {
  id: string;
  email: string;
  name: string;
  avatar: { id: string; url: string } | null;
  pendingEmail: string | null;
  roles: Array<{ id: string; name: string }>;
}

export interface AccountSession {
  id: string;
  browser: string;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export interface TwoFactorStatus {
  enabled: boolean;
  required: boolean;
  recoveryCodesLeft: number;
}

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeSvg: string;
}

export interface Passkey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export const getAccount = () => apiRequest<Account>("/account");

export const updateAccount = (changes: { name?: string; avatarAssetId?: string | null }) =>
  apiRequest<Account>("/account", { method: "PATCH", body: changes });

export const requestEmailChange = (change: { newEmail: string; password: string }) =>
  apiRequest<void>("/account/email", { method: "POST", body: change });

export const confirmEmailChange = (token: string) =>
  apiRequest<void>("/account/email/confirm", { method: "POST", body: { token } });

export const changePassword = (change: { currentPassword: string; newPassword: string }) =>
  apiRequest<{ endedSessions: number }>("/account/password", { method: "POST", body: change });

export const listSessions = async () =>
  (await apiRequest<{ sessions: AccountSession[] }>("/account/sessions")).sessions;

export const endSession = (sessionId: string) =>
  apiRequest<void>(`/account/sessions/${sessionId}`, { method: "DELETE" });

export const signOutOtherDevices = () =>
  apiRequest<{ endedSessions: number }>("/account/sessions/sign-out-others", { method: "POST" });

export const getTwoFactor = () => apiRequest<TwoFactorStatus>("/account/two-factor");

export const startTwoFactorSetup = () =>
  apiRequest<TwoFactorSetup>("/account/two-factor/setup", { method: "POST" });

export const confirmTwoFactor = (code: string) =>
  apiRequest<{ recoveryCodes: string[] }>("/account/two-factor/confirm", {
    method: "POST",
    body: { code },
  });

export const disableTwoFactor = (password: string) =>
  apiRequest<void>("/account/two-factor/disable", { method: "POST", body: { password } });

export const createRecoveryCodes = (password: string) =>
  apiRequest<{ recoveryCodes: string[] }>("/account/two-factor/recovery-codes", {
    method: "POST",
    body: { password },
  });

export const listPasskeys = async () =>
  (await apiRequest<{ passkeys: Passkey[] }>("/account/passkeys")).passkeys;

export const passkeyCreationOptions = (password: string) =>
  apiRequest<PublicKeyCredentialCreationOptionsJSON>("/account/passkeys/options", {
    method: "POST",
    body: { password },
  });

export const savePasskey = (name: string, response: RegistrationResponseJSON) =>
  apiRequest<Passkey>("/account/passkeys", { method: "POST", body: { name, response } });

export const removePasskey = (passkeyId: string) =>
  apiRequest<void>(`/account/passkeys/${passkeyId}`, { method: "DELETE" });

export const passkeySignInOptions = () =>
  apiRequest<PublicKeyCredentialRequestOptionsJSON>("/auth/passkey/options", { method: "POST" });

export const signInWithPasskeyResponse = (response: AuthenticationResponseJSON) =>
  apiRequest<Session>("/auth/passkey/sign-in", { method: "POST", body: { response } });

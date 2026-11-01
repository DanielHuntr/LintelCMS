import { ApiError, apiRequest } from "../api/client.js";

/** Who is signed in and what they may do. Matches the API's /auth responses. */
export interface Session {
  user: { id: string; email: string; name: string };
  /** May contain wildcards such as "*" or "entries:*": check with hasPermission, not includes. */
  permissions: string[];
  /** Features switched on for this site, such as "commerce". Sections for the rest stay hidden. */
  enabledPlugins: string[];
  /** Their role requires two-factor authentication and it isn't on yet: only /account works. */
  mustSetUpTwoFactor?: true;
}

/** A correct password for someone with two-factor on: a code from their app comes next. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
}

export function signIn(email: string, password: string): Promise<Session | TwoFactorChallenge> {
  return apiRequest<Session | TwoFactorChallenge>("/auth/sign-in", {
    method: "POST",
    body: { email, password },
  });
}

export function isTwoFactorChallenge(
  result: Session | TwoFactorChallenge,
): result is TwoFactorChallenge {
  return "twoFactorRequired" in result;
}

export function completeTwoFactorSignIn(
  challengeToken: string,
  answer: { code: string } | { recoveryCode: string },
): Promise<Session> {
  return apiRequest<Session>("/auth/sign-in/two-factor", {
    method: "POST",
    body: { challengeToken, ...answer },
  });
}

export function requestPasswordReset(email: string): Promise<{ message: string }> {
  return apiRequest("/auth/forgot-password", { method: "POST", body: { email } });
}

export function checkResetLink(token: string): Promise<{ usable: boolean }> {
  return apiRequest("/auth/reset-password/check", { method: "POST", body: { token } });
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return apiRequest("/auth/reset-password", { method: "POST", body: { token, newPassword } });
}

export function acceptInvitation(token: string, name: string, password: string): Promise<Session> {
  return apiRequest("/invitations/accept", { method: "POST", body: { token, name, password } });
}

export function signOut(): Promise<void> {
  return apiRequest<void>("/auth/sign-out", { method: "POST" });
}

/** The current session, or null when nobody is signed in. Other failures are thrown. */
export async function fetchCurrentSession(): Promise<Session | null> {
  try {
    return await apiRequest<Session>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

import { ApiError, apiRequest } from "../api/client.js";

/** Who is signed in and what they may do. Matches the API's /auth responses. */
export interface Session {
  user: { id: string; email: string; name: string };
  /** May contain wildcards such as "*" or "entries:*": check with hasPermission, not includes. */
  permissions: string[];
}

export function signIn(email: string, password: string): Promise<Session> {
  return apiRequest<Session>("/auth/sign-in", { method: "POST", body: { email, password } });
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

import { hasPermission, type Permission } from "@lintel/core/permissions";
import { createContext, useContext, type ReactNode } from "react";
import type { Session } from "./session.api.js";

const SessionContext = createContext<Session | null>(null);

/**
 * Makes the signed-in session available to every admin screen. The router fetches it once
 * before the admin loads, so screens never wait for it.
 */
export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession needs a SessionProvider: render the screen inside the admin.");
  }
  return session;
}

/** Whether the signed-in person may do something, e.g. `useCan("entries:publish")`. */
export function useCan(permission: Permission): boolean {
  return hasPermission(useSession().permissions, permission);
}

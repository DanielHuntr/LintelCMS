import {
  type AnyRoute,
  createRoute,
  redirect,
  useParams,
  useRouteContext,
} from "@tanstack/react-router";
import { lazy } from "react";
import { fetchCurrentSession, type Session } from "../session/session.api.js";
import { SessionProvider } from "../session/SessionContext.js";
import { ServerUnreachablePage } from "../setup/ServerUnreachablePage.js";

// The builder is large, so it loads only when someone opens a design.
const PageDesignPage = lazy(async () => ({
  default: (await import("./PageDesignPage.js")).PageDesignPage,
}));

/**
 * "Edit design" for a page field: /content/pages/<entry id>/design/<field handle>. The builder
 * fills the whole window, so it sits beside the admin layout rather than inside it, and asks
 * who is signed in itself, as the admin route does.
 */
export function pageDesignRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  const pageDesignRoute = createRoute({
    getParentRoute,
    path: "/content/$collection/$entryId/design/$field",
    beforeLoad: async ({ location }) => {
      const session = await fetchCurrentSession();
      if (!session) throw redirect({ to: "/sign-in", search: { redirect: location.href } });
      return { session };
    },
    errorComponent: ServerUnreachablePage,
    component: function PageDesignScreen() {
      // Read with `strict: false` because the route is made for any parent: its beforeLoad
      // above always provides the session, and its path has these three params.
      const { session } = useRouteContext({ strict: false }) as { session: Session };
      const { collection = "", entryId = "", field = "" } = useParams({ strict: false });
      return (
        <SessionProvider session={session}>
          <PageDesignPage collectionHandle={collection} entryId={entryId} fieldHandle={field} />
        </SessionProvider>
      );
    },
  });
  return [pageDesignRoute];
}

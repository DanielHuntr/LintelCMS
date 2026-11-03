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
import { BlockEditorPage } from "./BlockEditorPage.js";
import { BlocksPage } from "./BlocksPage.js";

// The builder is large, so it loads only when someone opens a block's design.
const BlockDesignPage = lazy(async () => ({
  default: (await import("./BlockDesignPage.js")).BlockDesignPage,
}));

/** /design/blocks and /design/blocks/:handle, under the signed-in admin route. */
export function blockRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  const blocksRoute = createRoute({
    getParentRoute,
    path: "/design/blocks",
    component: BlocksPage,
  });
  const blockRoute = createRoute({
    getParentRoute,
    path: "/design/blocks/$handle",
    component: function BlockRoute() {
      const { handle = "" } = useParams({ strict: false });
      return <BlockEditorPage key={handle} handle={handle} />;
    },
  });
  return [blocksRoute, blockRoute];
}

/**
 * /design/blocks/:handle/design: the block's design in the builder, which fills the window,
 * so it sits beside the admin layout and asks who is signed in itself, as page designs do.
 */
export function blockDesignRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  const designRoute = createRoute({
    getParentRoute,
    path: "/design/blocks/$handle/design",
    beforeLoad: async ({ location }) => {
      const session = await fetchCurrentSession();
      if (!session) throw redirect({ to: "/sign-in", search: { redirect: location.href } });
      return { session };
    },
    errorComponent: ServerUnreachablePage,
    component: function BlockDesignScreen() {
      const { session } = useRouteContext({ strict: false }) as { session: Session };
      const { handle = "" } = useParams({ strict: false });
      return (
        <SessionProvider session={session}>
          <BlockDesignPage handle={handle} />
        </SessionProvider>
      );
    },
  });
  return [designRoute];
}

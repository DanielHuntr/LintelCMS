import {
  type AnyRoute,
  createRoute,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { AccountPage } from "../account/AccountPage.js";
import { ConfirmEmailPage } from "../account/ConfirmEmailPage.js";
import { EmailOutboxPage } from "../email-outbox/EmailOutboxPage.js";
import { SecurityLogPage } from "../security-log/SecurityLogPage.js";
import { ForgotPasswordPage } from "../sign-in/ForgotPasswordPage.js";
import { ResetPasswordPage } from "../sign-in/ResetPasswordPage.js";
import { AcceptInvitationPage } from "./AcceptInvitationPage.js";
import { RoleEditorPage } from "./RoleEditorPage.js";
import { RolesPage } from "./RolesPage.js";
import { UsersPage } from "./UsersPage.js";

/**
 * People and account security, signed in: Users, Roles, your Account, and two screens
 * under Settings (the security log and the email outbox). router.tsx passes the admin route.
 */
export function peopleRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  return [
    createRoute({
      getParentRoute,
      path: "/users",
      // `?invite=true` opens the invitation straight away, for the command palette's action.
      validateSearch: (search: Record<string, unknown>): { invite?: boolean } => ({
        invite: search.invite === true || search.invite === "true" ? true : undefined,
      }),
      component: function UsersRoute() {
        const { invite } = useSearch({ strict: false });
        const navigate = useNavigate();
        return (
          <UsersPage
            startInviting={invite === true}
            onInvitingStarted={() => void navigate({ to: "/users", search: {}, replace: true })}
          />
        );
      },
    }),
    createRoute({ getParentRoute, path: "/users/roles", component: RolesPage }),
    createRoute({
      getParentRoute,
      path: "/users/roles/$roleId",
      component: function RoleRoute() {
        const { roleId = "" } = useParams({ strict: false });
        return <RoleEditorPage roleId={roleId} />;
      },
    }),
    createRoute({ getParentRoute, path: "/account", component: AccountPage }),
    createRoute({ getParentRoute, path: "/users/activity", component: SecurityLogPage }),
    createRoute({ getParentRoute, path: "/users/emails", component: EmailOutboxPage }),
  ];
}

/**
 * The screens people reach from an email or before signing in. They sit beside sign-in,
 * outside the admin; the links' tokens are read from after the "#".
 */
export function signedOutAccountRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  return [
    createRoute({
      getParentRoute,
      path: "/forgot-password",
      component: function ForgotPasswordRoute() {
        return <ForgotPasswordPage />;
      },
    }),
    createRoute({ getParentRoute, path: "/reset-password", component: ResetPasswordPage }),
    createRoute({ getParentRoute, path: "/accept-invitation", component: AcceptInvitationPage }),
    createRoute({ getParentRoute, path: "/confirm-email", component: ConfirmEmailPage }),
  ];
}

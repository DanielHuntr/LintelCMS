import { type AnyRoute, createRoute } from "@tanstack/react-router";
import { PersonalDataMapPage } from "./PersonalDataMapPage.js";
import { PolicyHelperPage } from "./PolicyHelperPage.js";
import { PrivacyPage } from "./PrivacyPage.js";
import { ProcessorsPage } from "./ProcessorsPage.js";
import { RetentionPage } from "./RetentionPage.js";

/** Settings → Privacy and its four tools, under the signed-in admin route router.tsx passes in. */
export function privacyRoutes<Parent extends AnyRoute>(getParentRoute: () => Parent) {
  return [
    createRoute({ getParentRoute, path: "/settings/privacy", component: PrivacyPage }),
    createRoute({ getParentRoute, path: "/settings/privacy/data", component: PersonalDataMapPage }),
    createRoute({ getParentRoute, path: "/settings/privacy/retention", component: RetentionPage }),
    createRoute({ getParentRoute, path: "/settings/privacy/policy", component: PolicyHelperPage }),
    createRoute({
      getParentRoute,
      path: "/settings/privacy/companies",
      component: ProcessorsPage,
    }),
  ];
}

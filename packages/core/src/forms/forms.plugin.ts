import { definePlugin } from "../plugins/plugin-definition.js";

/**
 * Forms: for now only its place in the admin (a Forms section saying what is coming).
 * Form building and submissions will add routes and tables here.
 */
export const formsPlugin = definePlugin({
  id: "forms",
  name: "Forms",
  description: "Contact forms and submissions.",
  permissions: [{ permission: "forms:read", description: "See forms and their submissions" }],
});

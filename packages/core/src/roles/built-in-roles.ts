/**
 * The roles every site has. Their permissions are fixed here, so improving a role in a
 * new version of Lintel improves it on every site. Admins add custom roles for anything else.
 *
 * Owner is special: only owners can make someone an owner, change an owner or remove one,
 * and the last active owner can't be removed, deactivated or demoted (see src/users).
 */
export const OWNER_ROLE_HANDLE = "owner";
export const CLIENT_ROLE_HANDLE = "client-content-only";

export interface BuiltInRole {
  handle: string;
  name: string;
  description: string;
  permissions: string[];
}

const readContentModel = ["collections:read", "blueprints:read", "taxonomies:read"];

export const builtInRoles: readonly BuiltInRole[] = [
  {
    handle: OWNER_ROLE_HANDLE,
    name: "Owner",
    description: "Can do everything, including managing other owners.",
    permissions: ["*"],
  },
  {
    handle: "admin",
    name: "Admin",
    description: "Can do everything except change owners.",
    permissions: [
      "entries:*",
      "media:*",
      "navigation:*",
      "taxonomies:*",
      "terms:*",
      "globals:*",
      "collections:*",
      "blueprints:*",
      "builder:design",
      "builder:code",
      "builder:blocks",
      "users:*",
      "roles:*",
      "settings:*",
      // Owners have everything already; Admins brand the admin for the client too.
      "branding:update",
      "security:read",
      // Answering people's requests about their data, and the retention rules.
      "privacy:manage",
      "backups:read",
      "content:transfer",
      "updates:read",
      "commerce:*",
      "orders:*",
      "forms:*",
      "automations:*",
      "drafts:*",
      "analytics:*",
      "experiments:*",
    ],
  },
  {
    handle: "editor",
    name: "Editor",
    description: "Writes, edits and publishes all content, and manages media and menus.",
    permissions: [
      "entries:*",
      "builder:design",
      "media:*",
      "navigation:*",
      "terms:*",
      "globals:read",
      "globals:update",
      // Drafting only ever adds editable sections to a page; nothing is published by it.
      "drafts:*",
      // How many people read what they write (the Visitors plugin).
      "analytics:read",
      ...readContentModel,
    ],
  },
  {
    handle: "author",
    name: "Author",
    description: "Writes and publishes their own content. Can see everyone else's.",
    permissions: [
      "entries:read",
      "entries:create",
      "entries:update-own",
      "entries:publish-own",
      "entries:delete-own",
      "builder:design",
      "media:read",
      "media:upload",
      ...readContentModel,
    ],
  },
  {
    // Agencies design the site and give their clients this: they change the words,
    // pictures and links the designer opened up, never the design (see src/client-editing).
    handle: CLIENT_ROLE_HANDLE,
    name: "Client (content only)",
    description:
      "Changes the words, pictures and links the designer allows, and edits content. Can't change the design.",
    permissions: [
      "entries:read",
      "entries:create",
      "entries:update",
      "entries:publish",
      "media:read",
      "media:upload",
      "navigation:read",
      "globals:read",
      ...readContentModel,
    ],
  },
  {
    handle: "viewer",
    name: "Viewer",
    description: "Can look at everything in Content and Media, but change nothing.",
    permissions: [
      "entries:read",
      "media:read",
      "navigation:read",
      "globals:read",
      ...readContentModel,
    ],
  },
];

export function isBuiltInRoleHandle(handle: string): boolean {
  return builtInRoles.some((role) => role.handle === handle);
}

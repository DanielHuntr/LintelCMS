import type { Invitation, Person, Role } from "./people.api.js";

/** People, roles and invitations for the Users screen's tests. */

export const ownerRole: Role = {
  id: "r-owner",
  handle: "owner",
  name: "Owner",
  description: "Can do everything, including managing other owners.",
  isBuiltIn: true,
  requiresTwoFactor: false,
  permissions: ["*"],
  memberCount: 1,
};

export const editorRole: Role = {
  id: "r-editor",
  handle: "editor",
  name: "Editor",
  description: "Writes, edits and publishes all content.",
  isBuiltIn: true,
  requiresTwoFactor: false,
  permissions: ["entries:*", "media:*"],
  memberCount: 1,
};

export const viewerRole: Role = {
  ...editorRole,
  id: "r-viewer",
  handle: "viewer",
  name: "Viewer",
  description: "Can look, but change nothing.",
  permissions: ["entries:read", "media:read"],
};

export const shopRole: Role = {
  ...editorRole,
  id: "r-shop",
  handle: "shop-manager",
  name: "Shop manager",
  description: "Runs the shop",
  isBuiltIn: false,
  permissions: ["entries:read"],
  memberCount: 0,
};

export const you: Person = {
  id: "u1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  status: "active",
  roles: [{ id: ownerRole.id, name: "Owner", handle: "owner" }],
  avatarUrl: null,
  twoFactorEnabled: true,
  lastActiveAt: "2026-10-31T10:00:00Z",
  createdAt: "2026-01-01T10:00:00Z",
};

export const ed: Person = {
  ...you,
  id: "u2",
  email: "ed@example.com",
  name: "Ed Editor",
  roles: [{ id: editorRole.id, name: "Editor", handle: "editor" }],
  twoFactorEnabled: false,
  lastActiveAt: null,
};

export const invitation: Invitation = {
  id: "i1",
  email: "nia@example.com",
  role: { id: editorRole.id, name: "Editor" },
  invitedBy: { id: "u1", name: "Ada Lovelace" },
  createdAt: "2026-10-31T10:00:00Z",
  expiresAt: "2099-11-07T10:00:00Z",
  expired: false,
};

import { apiRequest } from "../api/client.js";

/** Calls to the API's people, roles and invitations routes (see packages/core/src/users). */

export interface Person {
  id: string;
  email: string;
  name: string;
  status: "active" | "deactivated";
  roles: Array<{ id: string; name: string; handle: string }>;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface Role {
  id: string;
  handle: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  requiresTwoFactor: boolean;
  permissions: string[];
  memberCount: number;
}

export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  pluginId?: string;
  permissions: Array<{ permission: string; name: string; description: string }>;
}

export interface Invitation {
  id: string;
  email: string;
  role: { id: string; name: string };
  invitedBy: { id: string; name: string } | null;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface SentInvitation {
  invitation: Invitation;
  /** The link, shown once, for passing on by hand while email isn't set up. */
  invitationUrl: string;
}

export interface RoleChanges {
  name?: string;
  description?: string;
  permissions?: string[];
  requiresTwoFactor?: boolean;
}

export async function listPeople(search: string): Promise<Person[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return (await apiRequest<{ users: Person[] }>(`/users${query}`)).users;
}

export function changeRole(userId: string, roleId: string) {
  return apiRequest<Person>(`/users/${userId}/role`, { method: "PUT", body: { roleId } });
}

export function deactivatePerson(userId: string) {
  return apiRequest<Person>(`/users/${userId}/deactivate`, { method: "POST" });
}

export function reactivatePerson(userId: string) {
  return apiRequest<Person>(`/users/${userId}/reactivate`, { method: "POST" });
}

export function removePerson(userId: string, reassignToUserId: string) {
  return apiRequest<void>(`/users/${userId}`, { method: "DELETE", body: { reassignToUserId } });
}

export async function listRoles(): Promise<Role[]> {
  return (await apiRequest<{ roles: Role[] }>("/roles")).roles;
}

export async function listPermissionGroups(): Promise<PermissionGroup[]> {
  return (await apiRequest<{ groups: PermissionGroup[] }>("/permissions")).groups;
}

export function createRole(role: RoleChanges & { name: string }) {
  return apiRequest<Role>("/roles", { method: "POST", body: role });
}

export function updateRole(roleId: string, changes: RoleChanges) {
  return apiRequest<Role>(`/roles/${roleId}`, { method: "PATCH", body: changes });
}

export function deleteRole(roleId: string) {
  return apiRequest<void>(`/roles/${roleId}`, { method: "DELETE" });
}

export async function listInvitations(): Promise<Invitation[]> {
  return (await apiRequest<{ invitations: Invitation[] }>("/invitations")).invitations;
}

export function invitePerson(invitation: { email: string; roleId: string }) {
  return apiRequest<SentInvitation>("/invitations", { method: "POST", body: invitation });
}

export function resendInvitation(invitationId: string) {
  return apiRequest<SentInvitation>(`/invitations/${invitationId}/resend`, { method: "POST" });
}

export function revokeInvitation(invitationId: string) {
  return apiRequest<void>(`/invitations/${invitationId}`, { method: "DELETE" });
}

export interface InvitationPreview {
  email: string;
  roleName: string;
  invitedByName: string | null;
}

export function previewInvitation(token: string) {
  return apiRequest<InvitationPreview>("/invitations/preview", { method: "POST", body: { token } });
}

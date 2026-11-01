import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeRole,
  createRole,
  deactivatePerson,
  deleteRole,
  invitePerson,
  listInvitations,
  listPeople,
  listPermissionGroups,
  listRoles,
  reactivatePerson,
  removePerson,
  resendInvitation,
  revokeInvitation,
  type RoleChanges,
  updateRole,
} from "./people.api.js";

export const peopleKeys = {
  all: () => ["people"] as const,
  list: (search: string) => ["people", "list", search] as const,
  invitations: () => ["people", "invitations"] as const,
  roles: () => ["people", "roles"] as const,
  permissions: () => ["people", "permissions"] as const,
};

export function usePeople(search: string) {
  return useQuery({ queryKey: peopleKeys.list(search), queryFn: () => listPeople(search) });
}

export function useInvitations(enabled = true) {
  return useQuery({ queryKey: peopleKeys.invitations(), queryFn: listInvitations, enabled });
}

export function useRoles() {
  return useQuery({ queryKey: peopleKeys.roles(), queryFn: listRoles });
}

export function usePermissionGroups() {
  return useQuery({ queryKey: peopleKeys.permissions(), queryFn: listPermissionGroups });
}

/** Every change to people, roles or invitations can change the others' lists too. */
function useRefreshPeople() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: peopleKeys.all() });
}

export function useChangeRole() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      changeRole(userId, roleId),
    onSuccess: refresh,
  });
}

export function useSetActive() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      active ? reactivatePerson(userId) : deactivatePerson(userId),
    onSuccess: refresh,
  });
}

export function useRemovePerson() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: ({ userId, reassignToUserId }: { userId: string; reassignToUserId: string }) =>
      removePerson(userId, reassignToUserId),
    onSuccess: refresh,
  });
}

export function useInvitePerson() {
  const refresh = useRefreshPeople();
  return useMutation({ mutationFn: invitePerson, onSuccess: refresh });
}

export function useResendInvitation() {
  const refresh = useRefreshPeople();
  return useMutation({ mutationFn: resendInvitation, onSuccess: refresh });
}

export function useRevokeInvitation() {
  const refresh = useRefreshPeople();
  return useMutation({ mutationFn: revokeInvitation, onSuccess: refresh });
}

export function useSaveRole() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: ({ roleId, changes }: { roleId: string | null; changes: RoleChanges }) =>
      roleId ? updateRole(roleId, changes) : createRole({ ...changes, name: changes.name ?? "" }),
    onSuccess: refresh,
  });
}

export function useDeleteRole() {
  const refresh = useRefreshPeople();
  return useMutation({ mutationFn: deleteRole, onSuccess: refresh });
}

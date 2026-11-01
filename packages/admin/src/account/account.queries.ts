import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changePassword,
  createRecoveryCodes,
  disableTwoFactor,
  endSession,
  getAccount,
  getTwoFactor,
  listPasskeys,
  listSessions,
  removePasskey,
  requestEmailChange,
  signOutOtherDevices,
  updateAccount,
} from "./account.api.js";

export const accountKeys = {
  all: () => ["account"] as const,
  profile: () => ["account", "profile"] as const,
  sessions: () => ["account", "sessions"] as const,
  twoFactor: () => ["account", "two-factor"] as const,
  passkeys: () => ["account", "passkeys"] as const,
};

export const useAccount = () => useQuery({ queryKey: accountKeys.profile(), queryFn: getAccount });
export const useSessions = () =>
  useQuery({ queryKey: accountKeys.sessions(), queryFn: listSessions });
export const useTwoFactor = () =>
  useQuery({ queryKey: accountKeys.twoFactor(), queryFn: getTwoFactor });
export const usePasskeys = () =>
  useQuery({ queryKey: accountKeys.passkeys(), queryFn: listPasskeys });

function useRefreshAccount() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: accountKeys.all() });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAccount,
    onSuccess: (account) => queryClient.setQueryData(accountKeys.profile(), account),
  });
}

export const useRequestEmailChange = () =>
  useMutation({ mutationFn: requestEmailChange, onSuccess: useRefreshAccount() });

export const useChangePassword = () =>
  useMutation({ mutationFn: changePassword, onSuccess: useRefreshAccount() });

export const useEndSession = () =>
  useMutation({ mutationFn: endSession, onSuccess: useRefreshAccount() });

export const useSignOutOtherDevices = () =>
  useMutation({ mutationFn: signOutOtherDevices, onSuccess: useRefreshAccount() });

export const useDisableTwoFactor = () =>
  useMutation({ mutationFn: disableTwoFactor, onSuccess: useRefreshAccount() });

export const useCreateRecoveryCodes = () =>
  useMutation({ mutationFn: createRecoveryCodes, onSuccess: useRefreshAccount() });

export const useRemovePasskey = () =>
  useMutation({ mutationFn: removePasskey, onSuccess: useRefreshAccount() });

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { switchInterfaceLanguage } from "../i18n/activeLanguage.js";
import {
  chooseSiteDefaultLanguage,
  choosePersonalLanguage,
  fetchInterfaceLanguage,
  type InterfaceLanguageChoice,
} from "./interfaceLanguage.api.js";
import { rememberLanguage } from "./loadInterfaceLanguage.js";

export const interfaceLanguageKeys = {
  choice: () => ["interface-language"] as const,
};

export function useInterfaceLanguageChoice() {
  return useQuery({ queryKey: interfaceLanguageKeys.choice(), queryFn: fetchInterfaceLanguage });
}

function useLanguageChange(change: (language: string | null) => Promise<InterfaceLanguageChoice>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: async (choice) => {
      queryClient.setQueryData(interfaceLanguageKeys.choice(), choice);
      rememberLanguage(choice.active);
      await switchInterfaceLanguage(choice.active);
    },
  });
}

export function useChoosePersonalLanguage() {
  return useLanguageChange(choosePersonalLanguage);
}

export function useChooseSiteDefaultLanguage() {
  return useLanguageChange(chooseSiteDefaultLanguage);
}

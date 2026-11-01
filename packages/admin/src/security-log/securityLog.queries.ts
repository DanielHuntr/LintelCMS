import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listSecurityEvents } from "./securityLog.api.js";

export function useSecurityEvents(filter: { kind?: string; page: number }) {
  return useQuery({
    queryKey: ["security-log", filter.kind ?? "all", filter.page],
    queryFn: () => listSecurityEvents(filter),
    placeholderData: keepPreviousData,
  });
}

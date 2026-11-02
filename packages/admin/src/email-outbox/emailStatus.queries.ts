import { useQuery } from "@tanstack/react-query";
import { getEmailStatus } from "./emailOutbox.api.js";

/** Whether emails really go out. It changes only when the server restarts, so it's kept. */
export function useEmailStatus() {
  return useQuery({ queryKey: ["email-status"], queryFn: getEmailStatus, staleTime: Infinity });
}

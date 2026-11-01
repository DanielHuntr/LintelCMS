import {
  BadgeCheck,
  Bell,
  CircleSlash,
  Clock,
  Globe,
  type LucideIcon,
  Mail,
  PenLine,
  Send,
  Split,
  Workflow,
  Zap,
} from "lucide-react";
import type { StepType } from "./workflows.types.js";

/** The icon on each kind of card. */
export const stepIcons: Record<StepType | "trigger", LucideIcon> = {
  trigger: Zap,
  send_email: Mail,
  http_request: Globe,
  update_entry_field: PenLine,
  publish_entry: Send,
  unpublish_entry: CircleSlash,
  notify_users: Bell,
  wait: Clock,
  run_workflow: Workflow,
  condition: Split,
  approval: BadgeCheck,
};

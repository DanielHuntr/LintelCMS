import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Mail, MessageSquare, Server } from "lucide-react";
import { type StringKey, t } from "../i18n/strings.js";
import type { WorkflowDraft } from "./workflows.types.js";

/**
 * The examples in the gallery. Each opens the builder filled in and unsaved, except
 * "Require approval for pages", which is content approval's own switch.
 */
export interface WorkflowTemplate {
  id: string;
  name: StringKey;
  description: StringKey;
  icon: LucideIcon;
  /** Content approval is switched on rather than built step by step. */
  kind: "workflow" | "content-approval";
  build: (person: { email: string }) => WorkflowDraft;
}

export const workflowTemplates: readonly WorkflowTemplate[] = [
  {
    id: "form-notify",
    name: "templates.formNotify.name",
    description: "templates.formNotify.description",
    icon: Mail,
    kind: "workflow",
    build: (person) => ({
      name: t("templates.formNotify.name"),
      description: t("templates.formNotify.description"),
      enabled: true,
      trigger: { type: "event", event: "form.submitted", collections: [] },
      steps: [
        {
          id: "email1",
          type: "send_email",
          to: { type: "addresses", addresses: person.email },
          subject: t("templates.formNotify.subject"),
          body: t("templates.formNotify.body"),
        },
      ],
    }),
  },
  {
    id: "slack-posts",
    name: "templates.slack.name",
    description: "templates.slack.description",
    icon: MessageSquare,
    kind: "workflow",
    build: () => ({
      name: t("templates.slack.name"),
      description: t("templates.slack.description"),
      enabled: true,
      trigger: { type: "event", event: "entry.published", collections: ["posts"] },
      steps: [
        {
          id: "call1",
          type: "http_request",
          url: "https://hooks.slack.com/services/…",
          method: "POST",
          headers: [],
          body: '{\n  "text": "New post: {{entry.title}} {{entry.url}}"\n}',
          sign: false,
          timeoutSeconds: 10,
        },
      ],
    }),
  },
  {
    id: "approval-pages",
    name: "templates.approval.name",
    description: "templates.approval.description",
    icon: BadgeCheck,
    kind: "content-approval",
    build: () => ({
      name: t("templates.approval.name"),
      description: t("templates.approval.description"),
      enabled: true,
      trigger: { type: "event", event: "entry.review_requested", collections: ["pages"] },
      steps: [],
    }),
  },
  {
    id: "call-server",
    name: "templates.callServer.name",
    description: "templates.callServer.description",
    icon: Server,
    kind: "workflow",
    build: () => ({
      name: t("templates.callServer.name"),
      description: t("templates.callServer.description"),
      enabled: true,
      trigger: { type: "event", event: "entry.updated", collections: [] },
      steps: [
        {
          id: "call1",
          type: "http_request",
          url: "https://example.com/lintel/content-changed",
          method: "POST",
          headers: [],
          body: "",
          sign: true,
          timeoutSeconds: 10,
        },
      ],
    }),
  },
];

export function findTemplate(templateId: string | undefined): WorkflowTemplate | undefined {
  return workflowTemplates.find((template) => template.id === templateId);
}

export const emptyDraft = (): WorkflowDraft => ({
  name: "",
  description: "",
  enabled: true,
  trigger: { type: "event", event: "entry.published", collections: [] },
  steps: [],
});

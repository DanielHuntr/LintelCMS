import { SIGNATURE_HEADER, signWebhookBody } from "../../webhooks/webhook-signatures.js";
import {
  checkWebhookAddress,
  sendWebhookRequest,
  WebhookSendError,
} from "../../webhooks/webhook-sender.js";
import type { ActionStep } from "../workflow-definition.schema.js";
import { ActionFailedError, type ActionResult } from "./action-result.js";
import type { RunContext } from "./run-context.js";
import { renderHeaderValue, renderJson, renderUrl } from "./templates.js";
import type { WorkflowServices } from "./workflow-services.js";

type HttpRequestStep = Extract<ActionStep, { type: "http_request" }>;

const KEPT_RESPONSE_CHARACTERS = 64_000;

/** Details of the run the request belongs to, sent as headers. */
export interface HttpCallIdentity {
  runId: string;
  stepId: string;
  workflowId: string;
  secret: string;
  isTest: boolean;
}

/**
 * Calls any address: the hook for custom code in any language. The request is signed
 * like a webhook (Lintel-Signature, HMAC-SHA256 of "<t>.<body>"), carries an idempotency
 * key that stays the same on retries, and goes through the webhooks' address check, so
 * it can't reach the server's own network. Any 2xx counts; 5xx, 429, timeouts and
 * connection errors are tried again; other answers fail the step.
 *
 * The answer is kept for later steps: `{{steps.<id>.status}}` and, when it is JSON,
 * `{{steps.<id>.body.<name>}}`.
 */
export async function sendHttpRequestStep(
  step: HttpRequestStep,
  context: RunContext,
  identity: HttpCallIdentity,
  services: WorkflowServices,
  now: Date,
): Promise<ActionResult> {
  const url = renderUrl(step.url, context);
  if (!/^https?:\/\//i.test(url)) {
    throw new ActionFailedError(
      `“${url}” isn't a web address (it should start with https://)`,
      false,
    );
  }
  try {
    // Obviously private addresses won't become public later, so they aren't retried.
    checkWebhookAddress(new URL(url), services.sender);
  } catch (error) {
    throw new ActionFailedError(error instanceof Error ? error.message : String(error), false);
  }
  const sendsBody = step.method !== "GET" && step.method !== "DELETE";
  const body = sendsBody ? JSON.stringify(buildBody(step.body, context)) : "";
  const headers: Record<string, string> = {
    "user-agent": "Lintel-Workflows/1",
    "lintel-workflow": identity.workflowId,
    "lintel-run": identity.runId,
    "idempotency-key": `${identity.runId}:${identity.stepId}`,
    ...(identity.isTest ? { "lintel-test": "true" } : {}),
    ...(sendsBody ? { "content-type": "application/json" } : {}),
  };
  for (const header of step.headers) {
    headers[header.name.toLowerCase()] = renderHeaderValue(header.value, context);
  }
  if (step.sign) {
    headers[SIGNATURE_HEADER] = signWebhookBody(identity.secret, body, now);
  }

  try {
    const response = await sendWebhookRequest(
      { url, method: step.method, body, headers, keptResponseCharacters: KEPT_RESPONSE_CHARACTERS },
      { ...services.sender, timeoutMilliseconds: step.timeoutSeconds * 1000 },
    );
    const output = { status: response.status, body: parseAnswer(response.bodyStart) };
    const detail = { request: { method: step.method, url, body }, response: output };
    if (response.status >= 200 && response.status < 300) {
      return { summary: `${step.method} ${url} answered ${response.status}`, output, detail };
    }
    const retryable = response.status >= 500 || response.status === 429;
    throw new ActionFailedError(`${url} answered ${response.status}`, retryable, detail);
  } catch (error) {
    if (error instanceof WebhookSendError) {
      throw new ActionFailedError(error.message, true, { request: { method: step.method, url } });
    }
    throw error;
  }
}

function buildBody(template: string, context: RunContext): unknown {
  if (template.trim() === "") {
    // Without a body template, the receiver gets everything the run knows.
    return context;
  }
  return renderJson(template, context);
}

function parseAnswer(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

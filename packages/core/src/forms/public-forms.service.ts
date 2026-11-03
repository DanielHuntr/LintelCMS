import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { readOrCreateSetting, readSetting } from "../settings/settings.service.js";
import { answerFields, type FormField } from "./form-fields.schema.js";
import type { FormsContext } from "./forms-context.js";
import {
  FormClosedError,
  FormExpiredError,
  FormNotFoundError,
  TurnstileFailedError,
} from "./forms.errors.js";
import { findFormRowByHandle } from "./forms.repository.js";
import type { FormConfirmation } from "./forms.schema.js";
import type { FormRow, FormSubmissionRow } from "./forms.table.js";
import {
  checkFormToken,
  generateSigningSecret,
  HONEYPOT_FIELD,
  honeypotWasFilled,
  issueFormToken,
  TOKEN_FIELD,
  TURNSTILE_FIELD,
  type TurnstileVerifier,
} from "./spam-protection.js";
import { checkSubmittedFiles, type IncomingFile, storeSubmittedFiles } from "./submission-files.js";
import { checkSubmissionValues, findSubmitterEmail } from "./submission-values.js";
import {
  insertSubmissionRow,
  listRecentSubmissionsWithToken,
  lockFormSubmissions,
} from "./submissions.repository.js";

/**
 * What websites see of a form, and taking in what visitors send. Public by design: only
 * what is needed to draw the form is shown, never who is emailed or what others sent.
 */

/** A field as a website draws it. Steps are given separately, as lists of handles. */
export interface PublicFormField {
  handle: string;
  type: FormField["type"];
  label: string;
  helpText: string;
  placeholder: string;
  required: boolean;
  options: Record<string, unknown>;
}

export interface PublicForm {
  handle: string;
  name: string;
  submitLabel: string;
  acceptingSubmissions: boolean;
  fields: PublicFormField[];
  /** One step for an ordinary form; one per step break for a multi-step form. */
  steps: Array<{ title: string | null; fields: string[] }>;
  confirmation: FormConfirmation;
  /** Send these back with the answers; see "Spam protection" in the README. */
  spamProtection: {
    honeypotField: string;
    tokenField: string;
    token: string;
    turnstileSiteKey: string | null;
    turnstileField: string;
  };
}

async function findPublicFormRow(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<FormRow> {
  const row = await findFormRowByHandle(database, DEFAULT_TENANT_ID, handle);
  if (!row) {
    throw new FormNotFoundError();
  }
  return row;
}

function signingSecret(database: DatabaseOrTransaction): Promise<string> {
  return readOrCreateSetting(database, "formsSigningSecret", generateSigningSecret);
}

export function splitIntoSteps(fields: readonly FormField[]): PublicForm["steps"] {
  const steps: PublicForm["steps"] = [{ title: null, fields: [] }];
  for (const field of fields) {
    if (field.type === "step") {
      const current = steps[steps.length - 1];
      // A step break before any question names the first step rather than adding an empty one.
      if (current && current.fields.length === 0) {
        current.title = field.label;
      } else {
        steps.push({ title: field.label, fields: [] });
      }
    } else {
      steps[steps.length - 1]?.fields.push(field.handle);
    }
  }
  return steps.filter((step, index) => step.fields.length > 0 || index === 0);
}

export async function describePublicForm(
  database: DatabaseOrTransaction,
  handle: string,
  now = new Date(),
): Promise<PublicForm> {
  const row = await findPublicFormRow(database, handle);
  const spam = await readSetting(database, "formsSpamProtection");
  return {
    handle: row.handle,
    name: row.name,
    submitLabel: row.submitLabel,
    acceptingSubmissions: row.acceptingSubmissions,
    fields: answerFields(row.fields).map((field) => ({
      handle: field.handle,
      type: field.type,
      label: field.label,
      helpText: field.helpText,
      placeholder: field.placeholder,
      required: field.required,
      options: field.options,
    })),
    steps: splitIntoSteps(row.fields),
    confirmation: row.confirmation,
    spamProtection: {
      honeypotField: HONEYPOT_FIELD,
      tokenField: TOKEN_FIELD,
      token: issueFormToken(await signingSecret(database), row.id, now),
      turnstileSiteKey:
        spam.turnstileSiteKey && spam.turnstileSecretKey ? spam.turnstileSiteKey : null,
      turnstileField: TURNSTILE_FIELD,
    },
  };
}

export interface IncomingSubmission {
  values: Record<string, unknown>;
  files: IncomingFile[];
  remoteIp: string;
  sourceUrl: string | null;
}

export type SubmissionOutcome =
  | { saved: true; form: FormRow; submission: FormSubmissionRow }
  /**
   * Caught by the honeypot or the timer, or the same answers sent again: answered as if
   * saved, but nothing new was kept.
   */
  | { saved: false; form: FormRow };

/**
 * Checks and stores one submission. Spam checks run first, then every answer is checked;
 * files are stored only once everything else is known to be fine.
 */
export async function receiveSubmission(
  context: FormsContext,
  handle: string,
  incoming: IncomingSubmission,
  verifyTurnstile: TurnstileVerifier,
  now = new Date(),
): Promise<SubmissionOutcome> {
  const form = await findPublicFormRow(context.database, handle);
  if (!form.acceptingSubmissions) {
    throw new FormClosedError();
  }
  if (honeypotWasFilled(incoming.values[HONEYPOT_FIELD])) {
    return { saved: false, form };
  }
  const token = checkFormToken(
    await signingSecret(context.database),
    form.id,
    incoming.values[TOKEN_FIELD],
    now,
  );
  if (token === "invalid" || token === "expired") {
    throw new FormExpiredError();
  }
  if (token === "tooFast") {
    return { saved: false, form };
  }
  await checkTurnstile(context.database, incoming, verifyTurnstile);

  const { values, messages } = checkSubmissionValues(form.fields, incoming.values);
  Object.assign(messages, await checkSubmittedFiles(form.fields, incoming.files));
  if (Object.keys(messages).length > 0) {
    throw new InvalidFieldsError(messages);
  }

  // Outside the transaction: the media library writes through its own connection. A file
  // sent twice is the same file to the library, so a resend doesn't leave a copy behind.
  const stored = await storeSubmittedFiles(context.media, form.fields, incoming.files);
  const allValues = { ...values, ...stored.values };
  const tokenHash = hashToken(incoming.values[TOKEN_FIELD]);
  return context.database.transaction(async (transaction) => {
    // One submission to a form at a time, so a double click's two requests can't both pass
    // the check below before either is saved (LINTEL-DATA-006).
    await lockFormSubmissions(transaction, form.id);
    const recent = await listRecentSubmissionsWithToken(
      transaction,
      form.id,
      tokenHash,
      new Date(now.getTime() - RESENT_WITHIN_MILLISECONDS),
    );
    if (recent.some((submission) => isDeepStrictEqual(submission.values, allValues))) {
      return { saved: false, form };
    }

    const submission = await insertSubmissionRow(transaction, {
      tenantId: DEFAULT_TENANT_ID,
      formId: form.id,
      values: allValues,
      submitterEmail: findSubmitterEmail(form.fields, allValues),
      assetIds: stored.assetIds,
      sourceUrl: incoming.sourceUrl?.slice(0, 2000) ?? null,
      tokenHash,
    });
    return { saved: true, form, submission };
  });
}

/**
 * The same answers from the same opened form within this long are one submission sent twice:
 * a double click, or a browser resending. A second, different answer from the same page is
 * still kept.
 */
const RESENT_WITHIN_MILLISECONDS = 60_000;

function hashToken(token: unknown): string {
  return createHash("sha256").update(String(token)).digest("hex");
}

async function checkTurnstile(
  database: DatabaseOrTransaction,
  incoming: IncomingSubmission,
  verifyTurnstile: TurnstileVerifier,
): Promise<void> {
  const { turnstileSiteKey, turnstileSecretKey } = await readSetting(
    database,
    "formsSpamProtection",
  );
  if (!turnstileSiteKey || !turnstileSecretKey) {
    return;
  }
  const response = incoming.values[TURNSTILE_FIELD];
  const passed =
    typeof response === "string" &&
    response !== "" &&
    (await verifyTurnstile({
      secretKey: turnstileSecretKey,
      response,
      remoteIp: incoming.remoteIp,
    }).catch(() => false));
  if (!passed) {
    throw new TurnstileFailedError();
  }
}

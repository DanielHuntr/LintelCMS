import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { HttpError, InvalidFieldsError } from "../http/http-errors.js";
import type { FormsContext } from "./forms-context.js";
import { formsEmbedScript } from "./forms-embed-script.js";
import { FormNotFoundError, TooManySubmissionsError } from "./forms.errors.js";
import { formHandleParamsSchema } from "./forms.schema.js";
import { announceFormSubmitted } from "./form-submitted.js";
import { describePublicForm, receiveSubmission } from "./public-forms.service.js";
import type { TurnstileVerifier } from "./spam-protection.js";
import {
  acceptUrlEncodedForms,
  readSubmission,
  SOURCE_FIELD,
  SUBMISSION_LIMITS,
} from "./submission-request.js";
import { plainPage } from "./plain-page.js";

export interface PublicFormsRoutesOptions {
  context: () => FormsContext;
  verifyTurnstile: TurnstileVerifier;
  adminOrigin: string;
}

/** Submissions one address may send in a minute, across all forms. */
const SUBMISSIONS_PER_MINUTE = 10;

/**
 * HTTP only. Public by design, like the rest of /delivery, and open even when the delivery
 * API needs a token: a form on a public website can't keep a token secret.
 *
 *   GET  /delivery/forms.js                         the embeddable script
 *   GET  /delivery/forms/:handle                    -> PublicForm, never cached (it holds a token)
 *   POST /delivery/forms/:handle/submissions        JSON, multipart or a plain form post
 *                                                   -> 201 { received: true, confirmation }
 *
 * A plain HTML form post (a browser asking for HTML) gets a page back instead of JSON: the
 * thank-you message, a redirect to the form's "thank you" page, or what went wrong.
 */
export async function publicFormsRoutes(
  server: FastifyInstance,
  options: PublicFormsRoutesOptions,
) {
  await server.register(multipart, { limits: SUBMISSION_LIMITS });
  acceptUrlEncodedForms(server);

  server.get("/delivery/forms.js", async (_request, reply) =>
    reply
      .type("text/javascript; charset=utf-8")
      .header("cache-control", "public, max-age=300")
      .header("cross-origin-resource-policy", "cross-origin")
      .send(formsEmbedScript),
  );

  server.get("/delivery/forms/:handle", async (request, reply) => {
    const form = await describePublicForm(server.database, readHandle(request.params));
    return reply.header("cache-control", "no-store").send(form);
  });

  server.post(
    "/delivery/forms/:handle/submissions",
    {
      config: {
        rateLimit: {
          max: SUBMISSIONS_PER_MINUTE,
          timeWindow: "1 minute",
          errorResponseBuilder: (_request, context) => new TooManySubmissionsError(context.after),
        },
      },
    },
    async (request, reply) => {
      const wantsPage = asksForPage(request);
      try {
        const handle = readHandle(request.params);
        const { values, files } = await readSubmission(request);
        const outcome = await receiveSubmission(
          options.context(),
          handle,
          { values, files, remoteIp: request.ip, sourceUrl: sourceUrlOf(request, values) },
          options.verifyTurnstile,
        );
        if (outcome.saved) {
          await announceFormSubmitted(
            server,
            outcome.form,
            outcome.submission,
            options.adminOrigin,
          );
        }
        const confirmation = outcome.form.confirmation;
        if (wantsPage) {
          return confirmation.type === "redirect"
            ? reply.redirect(confirmation.url, 303)
            : sendPage(reply, 201, outcome.form.name, [confirmation.message], backLink(request));
        }
        return reply.code(201).send({ received: true, confirmation });
      } catch (error) {
        if (wantsPage && error instanceof HttpError) {
          const lines =
            error instanceof InvalidFieldsError ? Object.values(error.fields) : [error.message];
          return sendPage(
            reply,
            error.statusCode,
            "Please check your answers",
            lines,
            backLink(request),
          );
        }
        throw error;
      }
    },
  );
}

function readHandle(params: unknown): string {
  const parsed = formHandleParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new FormNotFoundError();
  }
  return parsed.data.handle;
}

/** A browser posting an HTML form asks for HTML; the embed script and API clients ask for JSON. */
function asksForPage(request: FastifyRequest): boolean {
  const accept = request.headers.accept ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

function sourceUrlOf(request: FastifyRequest, values: Record<string, unknown>): string | null {
  const sent = values[SOURCE_FIELD];
  const candidate = typeof sent === "string" ? sent : request.headers.referer;
  return typeof candidate === "string" && /^https?:\/\//.test(candidate) ? candidate : null;
}

function backLink(request: FastifyRequest): string | null {
  const referer = request.headers.referer;
  return typeof referer === "string" && /^https?:\/\//.test(referer) ? referer : null;
}

function sendPage(
  reply: FastifyReply,
  status: number,
  title: string,
  lines: readonly string[],
  back: string | null,
) {
  return reply
    .code(status)
    .type("text/html; charset=utf-8")
    .header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'")
    .send(plainPage(title, lines, back));
}

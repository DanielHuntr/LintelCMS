import { EmailNotSentError } from "./email.errors.js";

/** The `fetch` the HTTP drivers use. Tests pass their own, so nothing goes out. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const TEN_SECONDS = 10_000;

/**
 * Posts an email to a sending service's API and returns the parsed answer. Failures become
 * an EmailNotSentError saying what to check, using the service's own message when it has one.
 */
export async function postEmailRequest(options: {
  driver: string;
  fetch: Fetch;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  /** The field holding the service's explanation in an error answer. */
  errorMessageField: string;
}): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await options.fetch(options.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...options.headers,
      },
      body: JSON.stringify(options.body),
      signal: AbortSignal.timeout(TEN_SECONDS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new EmailNotSentError(
      options.driver,
      `Lintel couldn't reach the service (${reason}). Check this server's internet connection.`,
    );
  }

  const answer = await readJsonObject(response);
  if (!response.ok) {
    throw new EmailNotSentError(
      options.driver,
      explainRefusal(response.status, answer, options.errorMessageField),
    );
  }
  return answer;
}

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await response.json();
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function explainRefusal(status: number, answer: Record<string, unknown>, messageField: string) {
  const serviceMessage =
    typeof answer[messageField] === "string" ? ` It said: "${answer[messageField]}"` : "";
  if (status === 401 || status === 403) {
    return `the service refused the API key. Check the key in your settings.${serviceMessage}`;
  }
  if (status === 422 || status === 400) {
    return `the service refused the email, often because the sender's domain isn't verified with it yet.${serviceMessage}`;
  }
  if (status === 429) {
    return `the service is limiting how fast emails can be sent. Try again in a minute.${serviceMessage}`;
  }
  return `the service answered with an error (${status}).${serviceMessage}`;
}

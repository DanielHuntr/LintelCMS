/**
 * Safe templates: `{{entry.title}}` is replaced by that value from the run's context, and
 * nothing else happens. There are no expressions, function calls or loops, so a template
 * can't run code or reach anything the context doesn't hold. Paths are names separated
 * by dots (`steps.callServer.body.id`); only the context's own properties are read, so
 * `{{constructor}}` or `{{__proto__}}` find nothing. A missing value becomes "".
 */
export type TemplateContext = Readonly<Record<string, unknown>>;

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}/g;
const WHOLE_PLACEHOLDER = /^\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}$/;
const MAXIMUM_OUTPUT_CHARACTERS = 100_000;

/** Looks a dotted path up in the context, own properties only. */
export function lookUpPath(context: TemplateContext, path: string): unknown {
  let value: unknown = context;
  for (const name of path.split(".")) {
    if (typeof value !== "object" || value === null || !Object.hasOwn(value, name)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[name];
  }
  return value;
}

/** A value as text: strings as they are, other values as JSON, nothing as "". */
export function valueAsText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Plain text, for subjects, messages and email bodies. */
export function renderText(template: string, context: TemplateContext): string {
  const rendered = template.replace(PLACEHOLDER, (_placeholder, path: string) =>
    valueAsText(lookUpPath(context, path)),
  );
  return rendered.slice(0, MAXIMUM_OUTPUT_CHARACTERS);
}

/** For a header value: line breaks would start a new header, so they become spaces. */
export function renderHeaderValue(template: string, context: TemplateContext): string {
  return renderText(template, context).replace(/[\r\n]+/g, " ");
}

/** For an address: each value is URL-encoded, so it can't change the host or path. */
export function renderUrl(template: string, context: TemplateContext): string {
  return template.replace(PLACEHOLDER, (_placeholder, path: string) =>
    encodeURIComponent(valueAsText(lookUpPath(context, path))),
  );
}

/** Thrown when a JSON body template isn't valid JSON before its values are filled in. */
export class InvalidJsonTemplateError extends Error {
  constructor(reason: string) {
    super(`The body isn't valid JSON: ${reason}`);
    this.name = "InvalidJsonTemplateError";
  }
}

/**
 * A JSON body. The template is parsed as JSON first and values are filled into its
 * strings, so a value can never break out of the JSON (a title with a quote in it stays
 * one string). A string that is nothing but a placeholder takes the value's own type:
 * `"entry": "{{entry}}"` sends the entry as an object, `"count": "{{steps.a.body.n}}"` a number.
 */
export function renderJson(template: string, context: TemplateContext): unknown {
  return fillJsonValue(parseJsonTemplate(template), context);
}

export function parseJsonTemplate(template: string): unknown {
  try {
    return JSON.parse(template);
  } catch (error) {
    throw new InvalidJsonTemplateError(error instanceof Error ? error.message : String(error));
  }
}

function fillJsonValue(value: unknown, context: TemplateContext): unknown {
  if (typeof value === "string") {
    const whole = WHOLE_PLACEHOLDER.exec(value);
    if (whole?.[1]) {
      return lookUpPath(context, whole[1]) ?? null;
    }
    return renderText(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => fillJsonValue(item, context));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, fillJsonValue(item, context)]),
    );
  }
  return value;
}

/** Every path a template uses, for checking them in the builder. */
export function listTemplatePaths(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "");
}

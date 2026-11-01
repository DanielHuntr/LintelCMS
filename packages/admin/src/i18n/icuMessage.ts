/**
 * A small reader for ICU MessageFormat, the format every string in the admin is written in
 * (and that translation tools such as Crowdin, Weblate and Lokalise understand):
 *
 *   "Hello {name}"
 *   "{count, plural, one {# file} other {# files}}"
 *   "{count, plural, =0 {No terms} one {One term} other {# terms}}"
 *   "{role, select, admin {Admins} other {Everyone}}"
 *   "Saved {when, date, medium}"     "{total, number}"
 *
 * Apostrophes work as in ICU: '' is one apostrophe and '{' is a literal brace. Typographic
 * apostrophes (’) are ordinary text. A placeholder with no value is left as written, so
 * example text such as "?path={url}" in a hint shows as it is.
 */

export type MessagePart =
  | { kind: "text"; text: string }
  | { kind: "argument"; name: string; format?: "number" | "date" | "time"; style?: string }
  | { kind: "pound" }
  | {
      kind: "plural";
      name: string;
      ordinal: boolean;
      offset: number;
      options: Readonly<Record<string, MessagePart[]>>;
    }
  | { kind: "select"; name: string; options: Readonly<Record<string, MessagePart[]>> };

export type MessageValues = Readonly<Record<string, string | number | Date>>;

export class MessageSyntaxError extends Error {
  constructor(message: string, problem: string) {
    super(`Can't read the message "${message}": ${problem}`);
    this.name = "MessageSyntaxError";
  }
}

export function parseMessage(message: string): MessagePart[] {
  const reader = new MessageReader(message);
  const parts = reader.readParts(false, false);
  if (!reader.isAtEnd()) reader.fail("there is a } without a matching {");
  return parts;
}

/** The names of a message's placeholders, to check a translation uses the same ones. */
export function placeholderNames(parts: readonly MessagePart[]): Set<string> {
  const names = new Set<string>();
  for (const part of parts) {
    if (part.kind === "argument" || part.kind === "plural" || part.kind === "select") {
      names.add(part.name);
    }
    if (part.kind === "plural" || part.kind === "select") {
      for (const option of Object.values(part.options)) {
        for (const name of placeholderNames(option)) names.add(name);
      }
    }
  }
  return names;
}

export interface FormatOptions {
  /** The locale for plural rules, numbers and dates. */
  locale: string;
  /** Applied to the message's own words, never to the values put into it. */
  transformText?: (text: string) => string;
}

export function formatMessage(
  parts: readonly MessagePart[],
  values: MessageValues,
  options: FormatOptions,
  pluralValue?: number,
): string {
  return parts.map((part) => formatPart(part, values, options, pluralValue)).join("");
}

function formatPart(
  part: MessagePart,
  values: MessageValues,
  options: FormatOptions,
  pluralValue: number | undefined,
): string {
  switch (part.kind) {
    case "text":
      return options.transformText ? options.transformText(part.text) : part.text;
    case "pound":
      return pluralValue === undefined ? "#" : formatNumber(pluralValue, options.locale);
    case "argument":
      return formatArgument(part, values, options.locale);
    case "plural": {
      const value = values[part.name];
      if (typeof value !== "number") return `{${part.name}}`;
      const exact = part.options[`=${value}`];
      const category = new Intl.PluralRules(options.locale, {
        type: part.ordinal ? "ordinal" : "cardinal",
      }).select(value - part.offset);
      const chosen = exact ?? part.options[category] ?? part.options.other ?? [];
      return formatMessage(chosen, values, options, value - part.offset);
    }
    case "select": {
      const value = values[part.name];
      const chosen = part.options[String(value)] ?? part.options.other ?? [];
      return formatMessage(chosen, values, options, pluralValue);
    }
  }
}

function formatArgument(
  part: Extract<MessagePart, { kind: "argument" }>,
  values: MessageValues,
  locale: string,
): string {
  const value = values[part.name];
  if (value === undefined) return `{${part.name}}`;
  if (part.format === "number" && typeof value === "number") {
    return part.style === "percent"
      ? new Intl.NumberFormat(locale, { style: "percent" }).format(value)
      : formatNumber(value, locale);
  }
  if (part.format === "date" || part.format === "time") {
    const date = value instanceof Date ? value : new Date(value);
    const style = (part.style ?? "medium") as "short" | "medium" | "long" | "full";
    return new Intl.DateTimeFormat(
      locale,
      part.format === "date" ? { dateStyle: style } : { timeStyle: style },
    ).format(date);
  }
  if (typeof value === "number") return formatNumber(value, locale);
  return value instanceof Date ? value.toISOString() : value;
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

class MessageReader {
  private position = 0;

  constructor(private readonly message: string) {}

  isAtEnd(): boolean {
    return this.position >= this.message.length;
  }

  fail(problem: string): never {
    throw new MessageSyntaxError(this.message, problem);
  }

  /** Reads until the end, or until the `}` that closes a plural or select option. */
  readParts(insideOption: boolean, insidePlural: boolean): MessagePart[] {
    const parts: MessagePart[] = [];
    let text = "";
    const flushText = () => {
      if (text !== "") parts.push({ kind: "text", text });
      text = "";
    };

    while (!this.isAtEnd()) {
      const character = this.message[this.position] ?? "";
      if (character === "}") {
        if (!insideOption) this.fail("there is a } without a matching {");
        break;
      }
      if (character === "{") {
        flushText();
        parts.push(this.readPlaceholder());
        continue;
      }
      if (character === "#" && insidePlural) {
        flushText();
        parts.push({ kind: "pound" });
        this.position += 1;
        continue;
      }
      if (character === "'") {
        text += this.readApostrophe(insidePlural);
        continue;
      }
      text += character;
      this.position += 1;
    }
    flushText();
    return parts;
  }

  private readApostrophe(insidePlural: boolean): string {
    const next = this.message[this.position + 1];
    if (next === "'") {
      this.position += 2;
      return "'";
    }
    const startsQuote = next === "{" || next === "}" || (insidePlural && next === "#");
    if (!startsQuote) {
      this.position += 1;
      return "'";
    }
    const end = this.message.indexOf("'", this.position + 1);
    const quoted = this.message.slice(this.position + 1, end === -1 ? undefined : end);
    this.position = end === -1 ? this.message.length : end + 1;
    return quoted;
  }

  private readPlaceholder(): MessagePart {
    this.position += 1; // {
    const name = this.readWord();
    if (name === "") this.fail("a placeholder has no name");
    this.skipSpace();

    if (this.take("}")) return { kind: "argument", name };
    if (!this.take(",")) this.fail(`"{${name}" should be followed by } or a comma`);

    const type = this.readWord();
    this.skipSpace();
    if (type === "plural" || type === "selectordinal" || type === "select") {
      if (!this.take(",")) this.fail(`"{${name}, ${type}" needs a comma before its options`);
      return this.readChoice(name, type);
    }
    if (type !== "number" && type !== "date" && type !== "time") {
      this.fail(`"${type}" isn't a kind of placeholder; use plural, select, number, date or time`);
    }
    let style: string | undefined;
    if (this.take(",")) {
      style = this.readWord();
      this.skipSpace();
    }
    if (!this.take("}")) this.fail(`"{${name}, ${type}" isn't closed with }`);
    return { kind: "argument", name, format: type, style };
  }

  private readChoice(name: string, type: "plural" | "selectordinal" | "select"): MessagePart {
    const isPlural = type !== "select";
    const options: Record<string, MessagePart[]> = {};
    let offset = 0;

    for (;;) {
      this.skipSpace();
      if (this.take("}")) break;
      if (this.isAtEnd()) this.fail(`"{${name}, ${type}" isn't closed with }`);
      const selector = this.readWord();
      if (selector === "") this.fail(`an option in "{${name}" has no name`);
      if (isPlural && selector.startsWith("offset:")) {
        offset = Number(selector.slice("offset:".length));
        continue;
      }
      this.skipSpace();
      if (!this.take("{")) this.fail(`the "${selector}" option in "{${name}" needs {…}`);
      options[selector] = this.readParts(true, isPlural);
      if (!this.take("}")) this.fail(`the "${selector}" option in "{${name}" isn't closed`);
    }

    if (!options.other) this.fail(`"{${name}, ${type}" needs an "other" option`);
    return isPlural
      ? { kind: "plural", name, ordinal: type === "selectordinal", offset, options }
      : { kind: "select", name, options };
  }

  private readWord(): string {
    this.skipSpace();
    const match = /^[^\s{},]+/.exec(this.message.slice(this.position));
    const word = match?.[0] ?? "";
    this.position += word.length;
    return word;
  }

  private skipSpace(): void {
    while (/\s/.test(this.message[this.position] ?? "")) this.position += 1;
  }

  private take(character: string): boolean {
    if (this.message[this.position] !== character) return false;
    this.position += 1;
    return true;
  }
}

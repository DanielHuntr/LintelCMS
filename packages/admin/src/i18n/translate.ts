import { activeLanguage } from "./activeLanguage.js";
import { formatMessage, type MessagePart, type MessageValues, parseMessage } from "./icuMessage.js";

/**
 * Looks up a message in the active language, falling back to English, and fills it in.
 * `{product}` is always available: it's the admin's name, "Lintel" unless an agency has
 * branded it (see src/branding).
 */

let productName = "Lintel";

export function setProductName(name: string): void {
  productName = name;
}

export function currentProductName(): string {
  return productName;
}

const parsedMessages = new Map<string, MessagePart[]>();

export function translate(key: string, english: string, values: MessageValues = {}): string {
  const { language, catalogue, formattingLocale } = activeLanguage();
  const translated = catalogue[key];
  const parts = (translated !== undefined && parseOrWarn(`${language.code}:${key}`, translated)) ||
    parseOrWarn(`en:${key}`, english) || [{ kind: "text" as const, text: english }];

  const text = formatMessage(
    parts,
    { product: productName, ...values },
    { locale: formattingLocale, transformText: language.transformText },
  );
  return language.transformMessage ? language.transformMessage(text) : text;
}

/** A translation with a typo shows the English instead of breaking the screen. */
function parseOrWarn(cacheKey: string, message: string): MessagePart[] | null {
  const cached = parsedMessages.get(cacheKey);
  if (cached) return cached;
  try {
    const parts = parseMessage(message);
    parsedMessages.set(cacheKey, parts);
    return parts;
  } catch (error) {
    console.warn(error instanceof Error ? error.message : error);
    return null;
  }
}

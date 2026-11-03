import { type DraftSectionKind, draftSectionKinds } from "@lintel/builder-model";
import type { DraftPageRequest, RewriteRequest } from "./page-drafts.schema.js";

/**
 * What the writing model is told. Plain instructions, the site's name when it has one, and
 * what the person typed; the shape of the answer is held by the JSON schema, not by asking.
 */

/** What each kind of section is for, so the model writes words that suit its place. */
const sectionPurposes: Record<DraftSectionKind, string> = {
  welcome: "the big welcome at the top: a heading, one or two sentences, a button label",
  "welcome-with-picture": "a welcome beside a picture: a small label, heading, sentence, button",
  "page-title": "a quiet start for an inner page: a small label, heading and one sentence",
  features: "three things that make the business different, each with a short heading",
  steps: "how working with them goes, in three or four short steps",
  story: "a short story about who they are, with three short key points",
  quotes: "three example quotes of what a happy customer might say",
  prices: "two or three options with prices; separate what each includes with semicolons",
  questions: "questions people often ask, with short answers",
  "call-to-action": "a short invitation to get in touch or buy, with a button label",
  "quiet-call-to-action": "a gentle invitation with a button label",
};

const toneWords = {
  friendly: "warm and friendly",
  professional: "clear and professional",
  playful: "light and playful",
  calm: "calm and reassuring",
} as const;

const RULES = [
  "You write starter copy for small business websites, in plain British English.",
  "Write short, concrete sentences a visitor understands at once. No jargon, no hype, no clichés such as 'unlock', 'elevate' or 'seamless'. No emoji.",
  "Never invent facts: no names, prices, phone numbers, addresses, dates, awards or statistics. Where one is needed, write a placeholder in square brackets, such as [price] or [your town].",
  "Answer only with JSON in the shape you are given.",
].join("\n");

export function pageDraftInstructions(): string {
  return RULES;
}

export function pageDraftPrompt(request: DraftPageRequest, siteName: string | null): string {
  const kinds = (
    request.sections.length > 0 ? request.sections : draftSectionKinds
  ) as DraftSectionKind[];
  const lines = [
    siteName ? `The website is called "${siteName}".` : "",
    `What the page is for: ${request.purpose}`,
    request.audience ? `Who it is for: ${request.audience}` : "",
    `Tone: ${toneWords[request.tone]}.`,
    request.sections.length > 0
      ? "Write these sections, in this order:"
      : "Choose three to six of these sections, in a sensible order for the page:",
    ...kinds.map((kind) => `- ${kind}: ${sectionPurposes[kind]}`),
  ];
  return lines.filter(Boolean).join("\n");
}

const rewriteWords = {
  shorter: "Make it shorter, keeping its meaning.",
  friendlier: "Make it friendlier and warmer, about the same length.",
  "more-formal": "Make it more formal and polished, about the same length.",
} as const;

export function rewriteInstructions(): string {
  return [
    "You rewrite one piece of website copy, in the same language it is written in.",
    "Keep every fact as it is. Don't add new facts, emoji or quotation marks.",
    "Answer only with JSON in the shape you are given.",
  ].join("\n");
}

export function rewritePrompt(request: RewriteRequest): string {
  return `${rewriteWords[request.style]}\n\nThe words:\n${request.text}`;
}

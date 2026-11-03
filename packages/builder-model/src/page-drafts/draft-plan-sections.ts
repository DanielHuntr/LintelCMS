import type { NodeBlueprint } from "../components/component-definition.js";
import { brandInvitation, panelInvitation, questions } from "../sections/closers.js";
import { featureCards, steps, story } from "../sections/features.js";
import { centredHero, pageHeader, splitHero } from "../sections/heroes.js";
import { pricing, quoteCards } from "../sections/social-proof.js";
import type { DraftPlan, DraftSection } from "./draft-plan.js";

/**
 * Where a drafted button goes until someone chooses a page: nowhere, on purpose, so the
 * link is plainly one to set rather than a guess at an address the site may not have.
 */
const LINK_TO_CHOOSE = "#";

/** Drafted quotes are examples of what a customer might say, so they aren't anyone's. */
const QUOTE_NAME = "Customer name";

/** Pictures start as the library's own illustrations, ready to be swapped for a photo. */
const pictures = ["abstract-hills", "abstract-window", "abstract-circles"] as const;

/**
 * Turns a checked plan into sections built by the section library's own builders, so they
 * are ordinary, editable sections in the site's theme. Pictures take turns among the
 * library's illustrations, and stories alternate sides down the page.
 */
export function sectionsFromDraftPlan(plan: DraftPlan): NodeBlueprint[] {
  let picturesUsed = 0;
  const nextPicture = () => ({ name: pictures[picturesUsed++ % pictures.length] ?? "", alt: "" });
  return plan.sections.map((section, index) => sectionFromDraft(section, index, nextPicture));
}

function sectionFromDraft(
  section: DraftSection,
  index: number,
  nextPicture: () => { name: string; alt: string },
): NodeBlueprint {
  const button = (label: string) => ({ label, href: LINK_TO_CHOOSE });
  switch (section.kind) {
    case "welcome":
      return centredHero({
        heading: section.heading,
        text: section.text,
        primary: button(section.button),
      });
    case "welcome-with-picture":
      return splitHero({
        label: section.label,
        heading: section.heading,
        text: section.text,
        primary: button(section.button),
        picture: nextPicture(),
      });
    case "page-title":
      return pageHeader(section);
    case "features":
      return featureCards({
        heading: section.heading,
        text: section.text,
        points: section.points,
      });
    case "steps":
      return steps(section);
    case "story":
      return story({
        heading: section.heading,
        text: section.text,
        points: section.points,
        picture: nextPicture(),
        pictureFirst: index % 2 === 1,
      });
    case "quotes":
      return quoteCards({
        heading: section.heading,
        quotes: section.quotes.map((quote) => ({ words: quote.words, name: QUOTE_NAME })),
      });
    case "prices":
      return pricing({
        heading: section.heading,
        text: section.text,
        plans: section.plans.map((plan, planIndex) => ({
          name: plan.name,
          price: plan.price,
          description: plan.description,
          includes: plan.includes
            .split(/[;\n]/)
            .map((item) => item.trim())
            .filter(Boolean),
          button: button(`Choose ${plan.name}`),
          highlighted: planIndex === 1,
        })),
      });
    case "questions":
      return questions(section);
    case "call-to-action":
      return brandInvitation({
        heading: section.heading,
        text: section.text,
        button: button(section.button),
      });
    case "quiet-call-to-action":
      return panelInvitation({
        heading: section.heading,
        text: section.text,
        button: button(section.button),
      });
  }
}

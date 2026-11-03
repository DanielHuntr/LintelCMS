import { describe, expect, it } from "vitest";
import { html, photo } from "../testing.js";
import type { SiteBlock } from "./block.types.js";
import { BlockList, groupBlocks } from "./BlockList.js";
import { FaqList } from "./FaqList.js";
import { FormSection } from "./FormSection.js";
import { Hero } from "./Hero.js";

describe("the hero", () => {
  it("is a labelled section with a heading, text, a button and a cropped picture", () => {
    const output = html(
      <Hero
        id="b1"
        heading="Bread worth getting up for"
        subheading="Baked on the corner since 1952."
        image={photo}
        button={{ label: "See the menu", url: "/menu" }}
        headingLevel={1}
      />,
    );
    expect(output).toContain(
      '<section class="lintel-section lintel-hero" aria-labelledby="hero-b1" data-lintel-component="hero">',
    );
    expect(output).toContain(
      '<h1 id="hero-b1" class="lintel-hero__heading" data-lintel-field="heading">Bread worth getting up for</h1>',
    );
    expect(output).toContain(
      '<a class="lintel-button lintel-button--primary" href="/menu" data-lintel-field="button">See the menu</a>',
    );
    // A tall crop for phones, a wide one otherwise, with the size reserved and loaded first.
    expect(output).toContain('<source media="(max-width: 40rem)"');
    expect(output).toContain("h=1125&amp;fit=cover");
    expect(output).toContain(
      'width="2000" height="1125" alt="Loaves cooling on a rack" loading="eager"',
    );
    expect(output).toContain('fetchpriority="high"');
    expect(output).not.toContain("style=");
  });

  it("uses an h2 when the page has its own title", () => {
    const output = html(<Hero id="b1" heading="Hello" subheading="" image={null} button={null} />);
    expect(output).toContain("<h2");
    expect(output).not.toContain("<img");
  });
});

describe("FAQs", () => {
  it("are native disclosures, so they need no script", () => {
    const output = html(
      <FaqList
        questions={[{ id: "q1", question: "Do you deliver?", answer: "<p>Yes, daily.</p>" }]}
      />,
    );
    expect(output).toContain(
      '<details class="lintel-faq__item" data-lintel-block="q1"><summary class="lintel-faq__question" data-lintel-field="question">Do you deliver?</summary>',
    );
    expect(output).toContain(
      '<div class="lintel-prose lintel-faq__answer" data-lintel-field="answer"><p>Yes, daily.</p></div>',
    );
  });

  it("next to each other become one list", () => {
    const blocks: SiteBlock[] = [
      { type: "faq", id: "q1", question: "One?", answer: "" },
      { type: "faq", id: "q2", question: "Two?", answer: "" },
      { type: "text", id: "t1", heading: "", body: "<p>Between</p>" },
      { type: "faq", id: "q3", question: "Three?", answer: "" },
    ];
    expect(groupBlocks(blocks).map((group) => group.kind)).toEqual(["faq", "single", "faq"]);
    expect(html(<BlockList blocks={blocks} />).match(/class="lintel-faq"/g)).toHaveLength(2);
  });
});

describe("a list of blocks", () => {
  it("draws every kind of section in order, with the opening hero as the page title", () => {
    const blocks: SiteBlock[] = [
      { type: "hero", id: "h", heading: "Welcome", subheading: "", image: null, button: null },
      { type: "text", id: "t", heading: "About", body: "<p>We bake.</p>" },
      { type: "image", id: "i", image: photo, caption: "Our ovens" },
      { type: "call_to_action", id: "c", heading: "Visit", text: "Open daily.", button: null },
    ];
    const output = html(<BlockList blocks={blocks} heroIsTitle />);
    const components = [...output.matchAll(/data-lintel-component="([a-z_]+)"/g)].map(
      (match) => match[1],
    );
    expect(components).toEqual(["hero", "text", "image", "call_to_action"]);
    expect(output.match(/<h1/g)).toHaveLength(1);
    expect(output).toContain(
      '<figcaption class="lintel-figure__caption" data-lintel-field="caption">Our ovens</figcaption>',
    );
  });

  it("leaves out an image section whose picture has been deleted", () => {
    expect(
      html(<BlockList blocks={[{ type: "image", id: "i", image: null, caption: "" }]} />),
    ).toBe("");
  });
});

describe("the form section", () => {
  const form = {
    handle: "contact",
    name: "Contact",
    submitLabel: "Send message",
    acceptingSubmissions: true,
    action: "/lintel-bridge.php?action=form&form=contact",
    tokenUrl: "/lintel-bridge.php?action=token&form=contact",
    scriptUrl: "/_lintel/forms.js",
    honeypotField: "_website",
    tokenField: "_token",
    fields: [
      {
        handle: "email",
        type: "email",
        label: "Email",
        helpText: "We reply within a day",
        placeholder: "",
        required: true,
        choices: [],
      },
      {
        handle: "topic",
        type: "choice",
        label: "Topic",
        helpText: "",
        placeholder: "",
        required: false,
        choices: ["Bread", "Cakes"],
      },
    ],
  };

  it("is a plain form that posts where it is told, every field labelled", () => {
    const output = html(<FormSection id="f1" heading="Say hello" handle="contact" form={form} />);
    expect(output).toContain('action="/lintel-bridge.php?action=form&amp;form=contact"');
    expect(output).toContain('<label class="lintel-site-form__label" for="f1-email">Email');
    expect(output).toContain('aria-describedby="f1-email-help"');
    expect(output).toContain('<legend class="lintel-site-form__label">Topic</legend>');
    expect(output).toContain('name="_website"');
    expect(output).toContain('<input type="hidden" name="_token" value=""/>');
    expect(output).toContain('<script src="/_lintel/forms.js" defer="">');
  });

  it("says when a form is closed, and draws nothing for a missing one", () => {
    expect(
      html(
        <FormSection
          id="f1"
          heading=""
          handle="contact"
          form={{ ...form, acceptingSubmissions: false }}
        />,
      ),
    ).toContain("isn’t taking submissions");
    expect(html(<FormSection id="f1" heading="" handle="gone" form={null} />)).toBe("");
  });
});

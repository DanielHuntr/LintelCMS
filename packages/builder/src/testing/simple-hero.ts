import type { NodeBlueprint } from "@lintel/builder-model";

/**
 * A small hero for tests, written out in full so they don't change when the section
 * library does: a section holding a centred container with a title, a line and a button.
 */
export const simpleHero: NodeBlueprint = {
  type: "section",
  name: "Hero",
  children: [
    {
      type: "container",
      styles: {
        base: {
          display: "flex",
          flexDirection: "column",
          gap: "var(--lintel-space-5)",
          maxWidth: "48rem",
          marginLeft: "auto",
          marginRight: "auto",
          width: "100%",
          alignItems: "center",
          textAlign: "center",
        },
      },
      children: [
        {
          type: "heading",
          name: "Hero title",
          props: { text: "Good things, made well", level: 1 },
        },
        { type: "text", props: { text: "Say in a sentence or two what you do and who it’s for." } },
        { type: "button", props: { label: "Get in touch", href: "/contact" } },
      ],
    },
  ],
};

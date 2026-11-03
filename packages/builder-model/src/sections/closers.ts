import type { NodeBlueprint } from "../components/component-definition.js";
import {
  animate,
  button,
  buttonRow,
  colourBlock,
  container,
  divider,
  heading,
  lead,
  link,
  section,
  split,
  stack,
  text,
} from "./section-parts.js";

/** How a page ends: questions, an invitation, contact details and a footer band. */

export function questions(copy: {
  heading: string;
  items: Array<{ question: string; answer: string }>;
}): NodeBlueprint {
  return section("Questions", [
    container(
      [
        heading(copy.heading, 2),
        ...copy.items.flatMap((item, index) => [
          ...(index > 0 ? [divider()] : []),
          stack("Question", [heading(item.question, 3), text(item.answer)], 2),
        ]),
      ],
      { width: "48rem" },
    ),
  ]);
}

export interface Invitation {
  heading: string;
  text: string;
  button: { label: string; href: string };
}

/** A short invitation with a button, in the brand colour. */
export function brandInvitation(copy: Invitation): NodeBlueprint {
  return section(
    "Call to action",
    [
      container(
        [
          heading(copy.heading, 2),
          text(copy.text),
          button(copy.button.label, copy.button.href, "inverse", {
            animation: animate("pulse", { delay: 600 }),
          }),
        ],
        { width: "40rem", centred: true },
      ),
    ],
    { tone: "brand" },
  );
}

/** The same, on a panel, with the words on the left and the button on the right. */
export function panelInvitation(copy: Invitation): NodeBlueprint {
  return section(
    "Call to action",
    [
      container([
        split(
          stack("Invitation", [heading(copy.heading, 2), text(copy.text)], 3),
          buttonRow([button(copy.button.label, copy.button.href)], false),
          "2fr 1fr",
        ),
      ]),
    ],
    { tone: "panel", padding: 7 },
  );
}

/** Where to find you and how to get in touch, with buttons that call or email. */
/**
 * A heading, a line and one of the site's forms (`formHandle`, filled with the form made for
 * it when the template is used). Left out of the page while Forms is switched off.
 */
export function contactForm(copy: { heading: string; text: string; formHandle: string }) {
  return section("Contact form", [
    container(
      [
        heading(copy.heading, 2),
        lead(copy.text),
        { type: "formEmbed", name: "Form", props: { form: copy.formHandle, showTitle: false } },
      ],
      { width: "40rem" },
    ),
  ]);
}

export function contactDetails(copy: {
  heading: string;
  text: string;
  phone: string;
  email: string;
  address: string;
  hours: string[];
}): NodeBlueprint {
  return section("Contact", [
    container([
      split(
        stack(
          "Contact details",
          [
            heading(copy.heading, 2),
            lead(copy.text),
            buttonRow([
              button(`Call ${copy.phone}`, `tel:${copy.phone.replace(/[^\d+]/g, "")}`),
              button("Send an email", `mailto:${copy.email}`, "outline"),
            ]),
          ],
          5,
          { animation: animate("fade-up") },
        ),
        stack(
          "Visit",
          [
            heading("Find us", 3),
            text(copy.address),
            heading("Opening hours", 3),
            text(copy.hours.join("\n")),
          ],
          3,
          {
            styles: {
              base: {
                display: "flex",
                flexDirection: "column",
                gap: "var(--lintel-space-3)",
                paddingTop: "var(--lintel-space-6)",
                paddingBottom: "var(--lintel-space-6)",
                paddingLeft: "var(--lintel-space-6)",
                paddingRight: "var(--lintel-space-6)",
                backgroundColor: "var(--lintel-color-surface)",
                borderRadius: "var(--lintel-radius-large)",
              },
            },
            animation: animate("fade-up", { delay: 150 }),
          },
        ),
      ),
    ]),
  ]);
}

/** A closing band: a line about you and a few links. */
export function simpleFooter(copy: {
  text: string;
  links: Array<{ label: string; href: string }>;
}): NodeBlueprint {
  return section(
    "Footer",
    [
      container(
        [
          text(copy.text),
          {
            type: "box",
            name: "Footer links",
            styles: {
              base: {
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--lintel-space-5)",
                justifyContent: "center",
              },
            },
            children: [
              ...copy.links.map((item) => link(item.label, item.href)),
              // Shows only on a site that asks visitors about cookies.
              { type: "cookieSettings" },
            ],
          },
        ],
        { centred: true, gap: 3 },
      ),
    ],
    { tone: "panel", padding: 6, element: "footer" },
  );
}

/** A footer column: links written into the template, or one of the site's menus. */
type FooterColumn =
  | { heading: string; links: Array<{ label: string; href: string }> }
  | { heading: string; menuHandle: string };

/** A closing band in columns: about, links and contact. */
export function columnsFooter(copy: { about: string; columns: FooterColumn[] }): NodeBlueprint {
  return section(
    "Footer",
    [
      container([
        {
          type: "columns",
          name: "Footer columns",
          styles: {
            base: {
              display: "grid",
              gridTemplateColumns: `2fr repeat(${copy.columns.length}, minmax(0, 1fr))`,
              gap: "var(--lintel-space-6)",
            },
            phone: { gridTemplateColumns: "minmax(0, 1fr)" },
          },
          children: [
            stack(
              "About",
              [
                colourBlock("Mark", "brand", "1 / 1", "3rem"),
                text(copy.about),
                { type: "cookieSettings" },
              ],
              3,
              {
                styles: {
                  base: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--lintel-space-3)",
                    maxWidth: "20rem",
                  },
                },
              },
            ),
            ...copy.columns.map((column) =>
              stack(
                column.heading,
                [
                  heading(column.heading, 3),
                  ...("menuHandle" in column
                    ? [siteMenu(column.heading, column.menuHandle)]
                    : column.links.map((item) => link(item.label, item.href))),
                ],
                2,
              ),
            ),
          ],
        },
      ]),
    ],
    { tone: "dark", padding: 7, element: "footer" },
  );
}

/** The Menu element showing one of the site's menus (Content → Menus), so it stays current. */
function siteMenu(label: string, menuHandle: string): NodeBlueprint {
  return { type: "navigation", props: { menuSource: "site", menuHandle, label, links: [] } };
}

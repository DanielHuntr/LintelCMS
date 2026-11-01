import StarterKit from "@tiptap/starter-kit";

/**
 * What rich text can contain: paragraphs, two heading levels, bold, italic, links, lists and
 * quotes. Kept deliberately small, so content stays consistent and the site's design decides
 * how it looks. Core renders the same JSON to HTML for the delivery API.
 */
export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    link: {
      // In an editor a click should place the cursor, not leave the page.
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
    },
  }),
];

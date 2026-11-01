import type { ReactNode } from "react";

/**
 * Light syntax colouring for the code view: tags, attributes and values in HTML; selectors,
 * properties and values in CSS. Colours come from the admin's status tokens, which pass
 * contrast in both colour schemes. The text is unchanged, so screen readers read plain code.
 */

type TokenKind = "tag" | "attribute" | "value" | "comment" | "selector" | "property" | "plain";

const tokenClasses: Record<TokenKind, string> = {
  tag: "text-accent",
  attribute: "text-warning",
  value: "text-success",
  comment: "text-label-tertiary italic",
  selector: "text-accent",
  property: "text-warning",
  plain: "",
};

function spans(tokens: Array<[TokenKind, string]>): ReactNode[] {
  return tokens.map(([kind, content], index) =>
    kind === "plain" ? (
      content
    ) : (
      <span key={index} className={tokenClasses[kind]}>
        {content}
      </span>
    ),
  );
}

export function highlightHtml(html: string): ReactNode[] {
  const tokens: Array<[TokenKind, string]> = [];
  const pattern = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][\w-]*)|(\s[\w:-]+)(=)("[^"]*")|(\/?>)/g;
  let last = 0;
  for (const match of html.matchAll(pattern)) {
    if (match.index > last) tokens.push(["plain", html.slice(last, match.index)]);
    if (match[1]) tokens.push(["comment", match[1]]);
    else if (match[2]) tokens.push(["tag", match[2]]);
    else if (match[3])
      tokens.push(["attribute", match[3]], ["plain", match[4] ?? ""], ["value", match[5] ?? ""]);
    else if (match[6]) tokens.push(["tag", match[6]]);
    last = match.index + match[0].length;
  }
  if (last < html.length) tokens.push(["plain", html.slice(last)]);
  return spans(tokens);
}

export function highlightCss(css: string): ReactNode[] {
  const tokens: Array<[TokenKind, string]> = [];
  const pattern = /(\/\*[\s\S]*?\*\/)|([^{};\n][^{};]*)(?=\{)|([\w-]+)(\s*:\s*)([^;{}]+)(;)/g;
  let last = 0;
  for (const match of css.matchAll(pattern)) {
    if (match.index > last) tokens.push(["plain", css.slice(last, match.index)]);
    if (match[1]) tokens.push(["comment", match[1]]);
    else if (match[2]) tokens.push(["selector", match[2]]);
    else
      tokens.push(
        ["property", match[3] ?? ""],
        ["plain", match[4] ?? ""],
        ["value", match[5] ?? ""],
        ["plain", match[6] ?? ""],
      );
    last = match.index + match[0].length;
  }
  if (last < css.length) tokens.push(["plain", css.slice(last)]);
  return spans(tokens);
}

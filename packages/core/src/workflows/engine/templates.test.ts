import { describe, expect, it } from "vitest";
import {
  InvalidJsonTemplateError,
  renderHeaderValue,
  renderJson,
  renderText,
  renderUrl,
} from "./templates.js";

const context = {
  entry: { title: 'Say "hi"', slug: "say hi/now", fields: { tags: ["news"], views: 3 } },
  actor: { name: "Ana" },
};

describe("templates", () => {
  it("fill in values by dotted path, and leave missing ones empty", () => {
    expect(renderText("{{ actor.name }} wrote {{entry.title}}{{entry.missing}}", context)).toBe(
      'Ana wrote Say "hi"',
    );
    expect(renderText("{{entry.fields.tags}}", context)).toBe('["news"]');
  });

  it("can't reach anything but the context's own values", () => {
    expect(renderText("{{constructor}}{{entry.__proto__}}{{entry.title.length}}", context)).toBe(
      "",
    );
    expect(renderText("{{ process.env.HOME }}", context)).toBe("");
    expect(renderText("{{entry.title + 1}}", context)).toBe("{{entry.title + 1}}");
  });

  it("keep JSON valid whatever the values hold, and keep types for whole placeholders", () => {
    const body = renderJson(
      '{"title": "New: {{entry.title}}", "fields": "{{entry.fields}}", "views": "{{entry.fields.views}}"}',
      context,
    );
    expect(body).toEqual({
      title: 'New: Say "hi"',
      fields: { tags: ["news"], views: 3 },
      views: 3,
    });
  });

  it("refuse a body that isn't JSON", () => {
    expect(() => renderJson("{title: {{entry.title}}}", context)).toThrow(InvalidJsonTemplateError);
  });

  it("encode values in addresses and strip line breaks from headers", () => {
    expect(renderUrl("https://example.com/hooks/{{entry.slug}}", context)).toBe(
      "https://example.com/hooks/say%20hi%2Fnow",
    );
    expect(renderHeaderValue("a\r\nX-Injected: {{actor.name}}", context)).toBe("a X-Injected: Ana");
  });
});

import { describe, expect, it } from "vitest";
import { html } from "../testing.js";
import { VideoEmbed } from "../media/VideoEmbed.js";
import { DataTable } from "./DataTable.js";

describe("the video player", () => {
  it("embeds YouTube and Vimeo in their own player, with a title", () => {
    const output = html(
      <VideoEmbed
        title="Our bakery"
        video={{
          url: "https://youtu.be/abc123def",
          provider: "youtube",
          embedUrl: "https://www.youtube-nocookie.com/embed/abc123def",
        }}
      />,
    );
    expect(output).toContain('<div class="lintel-video">');
    expect(output).toContain(
      'src="https://www.youtube-nocookie.com/embed/abc123def" title="Our bakery"',
    );
  });

  it("plays a file in the browser's player, and draws nothing without a video", () => {
    const file = html(
      <VideoEmbed
        title="Clip"
        video={{
          url: "https://cdn.example.com/a.mp4",
          provider: "file",
          embedUrl: "https://cdn.example.com/a.mp4",
        }}
      />,
    );
    expect(file).toContain('<video src="https://cdn.example.com/a.mp4" controls=""');
    expect(html(<VideoEmbed title="None" video={null} />)).toBe("");
  });
});

describe("the table", () => {
  it("uses the first row as column headings", () => {
    const output = html(
      <DataTable
        caption="Opening hours"
        rows={[
          ["Day", "Opens"],
          ["Monday", "9am"],
        ]}
      />,
    );
    expect(output).toBe(
      '<table class="lintel-table"><caption>Opening hours</caption><thead><tr><th scope="col">Day</th><th scope="col">Opens</th></tr></thead><tbody><tr><td>Monday</td><td>9am</td></tr></tbody></table>',
    );
  });

  it("can treat every row as data", () => {
    expect(html(<DataTable headerRow={false} rows={[["a"]]} />)).toBe(
      '<table class="lintel-table"><tbody><tr><td>a</td></tr></tbody></table>',
    );
  });
});

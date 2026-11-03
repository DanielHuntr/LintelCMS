import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  type PageNode,
  type PhotoCreditData,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ContentPanel } from "../panels/ContentPanel.js";
import { DataSourcesContext, noDataSources } from "../panels/data-sources.js";
import { renderPage } from "./render-page.js";
import { standardRegistry } from "./stand-in-components.js";

const BY_PHOTO = "a41bba82-76b0-4ddf-93ea-c907b0b191f7";
const CC0_PHOTO = "c2222222-2222-4222-8222-222222222222";

const byCredit: PhotoCreditData = {
  text: "“Bakery” by Ian Sane, CC BY 2.0",
  creator: "Ian Sane",
  sourceUrl: "https://www.flickr.com/photos/example/1",
  licenceName: "CC BY 2.0",
  licenceUrl: "https://creativecommons.org/licenses/by/2.0/",
};

function picture(assetId: string, extra: Record<string, unknown> = {}): PageNode {
  return createNode(
    {
      type: "image",
      props: { src: `http://api.test/media/${assetId}/file`, alt: "Loaves", assetId, ...extra },
    },
    standardCatalogue,
    createCountingNodeIds(),
  );
}

function pageOf(...children: PageNode[]): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children } };
}

// The website only lists credits that need showing: a CC0 photo is simply not in `credits`.
const data = { credits: { [BY_PHOTO]: byCredit } };

describe("photo credits under Picture elements", () => {
  it("draw a CC BY photo as a figure with its credit, linking creator and licence", () => {
    const { html } = renderPage(pageOf(picture(BY_PHOTO)), standardRegistry, { data });

    expect(html).toContain('<figcaption class="lintel-credit">Photo: ');
    expect(html).toContain(
      '<a href="https://www.flickr.com/photos/example/1" rel="noopener">Ian Sane</a>',
    );
    expect(html).toContain(
      '<a href="https://creativecommons.org/licenses/by/2.0/" rel="license noopener">CC BY 2.0</a>',
    );
  });

  it("draw a CC0 photo, or one with the credit switched off, as the picture alone", () => {
    const cc0 = renderPage(pageOf(picture(CC0_PHOTO)), standardRegistry, { data }).html;
    const off = renderPage(pageOf(picture(BY_PHOTO, { showCredit: false })), standardRegistry, {
      data,
    }).html;

    for (const html of [cc0, off]) {
      expect(html).not.toContain("lintel-credit");
      expect(html).not.toContain("<figure");
    }
  });

  it("keep a caption, with the credit after it in the same figcaption", () => {
    const { html } = renderPage(
      pageOf(picture(BY_PHOTO, { caption: "Our morning bake" })),
      standardRegistry,
      { data },
    );

    expect(html).toMatch(
      /<figcaption><span>Our morning bake<\/span><span class="lintel-credit">Photo: /,
    );
  });
});

function EditedPicture({
  start,
  credits,
}: {
  start: PageNode;
  credits: Record<string, PhotoCreditData>;
}) {
  const [node, setNode] = useState(start);
  return (
    <DataSourcesContext.Provider value={{ ...noDataSources, photoCredits: credits }}>
      <ContentPanel
        node={node}
        definition={standardCatalogue.find(node.type)}
        isLocked={false}
        pickImage={undefined}
        onChange={(props) =>
          setNode((current) => ({ ...current, props: { ...current.props, ...props } }))
        }
      />
      <output data-testid="showCredit">{String(node.props.showCredit)}</output>
    </DataSourcesContext.Provider>
  );
}

describe("Show the photo credit", () => {
  it("is on for a photo whose licence asks for a credit, and explains why when turned off", async () => {
    render(<EditedPicture start={picture(BY_PHOTO)} credits={{ [BY_PHOTO]: byCredit }} />);

    const toggle = screen.getByRole("switch", { name: "Show the photo credit" });
    expect(toggle).toBeChecked();
    expect(screen.getByText(/Shown under the picture: “Bakery” by Ian Sane/)).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(screen.getByTestId("showCredit")).toHaveTextContent("false");
    expect(screen.getByText(/This photo’s licence asks for a credit/)).toBeInTheDocument();
  });

  it("isn't offered for a picture without a credit to show", () => {
    render(<EditedPicture start={picture(CC0_PHOTO)} credits={{ [BY_PHOTO]: byCredit }} />);

    expect(screen.queryByRole("switch", { name: "Show the photo credit" })).not.toBeInTheDocument();
  });
});

import {
  arcCarouselComponent,
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  MODEL_WARNING_BYTES,
  type NodeBlueprint,
  type PageDocument,
  type PageNode,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ContentPanel } from "../../panels/ContentPanel.js";
import { PictureBaseUrlContext } from "../../panels/content-fields.js";
import { ModelPosterUploadContext, SampleModelsUrlContext } from "../../panels/model-field.js";
import { renderPage } from "../render-page.js";
import { standardRegistry } from "../stand-in-components.js";

const captureModelPoster = vi.fn(
  async (_src: string, _options: object) => new Blob(["picture"], { type: "image/webp" }),
);
vi.mock("@lintel/motion/model-poster", () => ({ captureModelPoster }));

function page(...blueprints: NodeBlueprint[]): PageDocument {
  const createId = createCountingNodeIds("e");
  const empty = createEmptyPage();
  return {
    ...empty,
    root: {
      ...empty.root,
      children: blueprints.map((blueprint) => createNode(blueprint, standardCatalogue, createId)),
    },
  };
}

const vase = { src: "/_lintel/models/vase.glb", assetId: null, bytes: 0 };

describe("the 3D model element on the page", () => {
  it("is a picture named by its description, with its poster, drawn by the model effect", () => {
    const rendered = renderPage(
      page({
        type: "model3d",
        props: {
          model: vase,
          poster: "/media/vase.webp",
          alt: "A terracotta vase",
          motion: "drag",
        },
      }),
      standardRegistry,
      { withMotion: true },
    );
    expect(rendered.html).toContain('role="img"');
    expect(rendered.html).toContain('aria-label="A terracotta vase"');
    expect(rendered.html).toContain(
      '<img class="lintel-model__poster" src="/media/vase.webp" alt=""',
    );
    expect(rendered.effects).toEqual([
      {
        nodeId: "e1",
        module: "model",
        behaviour: "modelViewer",
        params: { src: vase.src, motion: "drag", light: "studio", background: "transparent" },
      },
    ]);
    expect(rendered.html).toContain('data-node-id="e1"');
  });

  it("loads and shows nothing on the site until a model is chosen", () => {
    const rendered = renderPage(page({ type: "model3d" }), standardRegistry, { withMotion: true });
    expect(rendered.effects).toEqual([]);
    expect(rendered.html).not.toContain("lintel-model");
    const canvas = renderPage(page({ type: "model3d" }), standardRegistry, { mode: "canvas" });
    expect(canvas.html).toContain("lintel-model__placeholder");
  });

  it("says what it is without a description", () => {
    const rendered = renderPage(
      page({ type: "model3d", props: { model: vase } }),
      standardRegistry,
    );
    expect(rendered.html).toContain('aria-label="3D model"');
  });

  it("passes a chosen background colour to the model", () => {
    const rendered = renderPage(
      page({
        type: "model3d",
        props: { model: vase, background: "colour", backgroundColour: "#112233", light: "night" },
      }),
      standardRegistry,
    );
    expect(rendered.effects[0]?.params).toMatchObject({ background: "#112233", light: "night" });
  });
});

/** The Content panel for one 3D model, keeping its changes like the builder would. */
function EditedModel({
  start,
  upload,
}: {
  start: PageNode;
  upload?: (file: File) => Promise<{ assetId: string; src: string; alt: string }>;
}) {
  const [node, setNode] = useState(start);
  return (
    <PictureBaseUrlContext value="https://bakery.test">
      <ModelPosterUploadContext value={upload}>
        <ContentPanel
          node={node}
          definition={standardCatalogue.find(node.type)}
          isLocked={false}
          pickImage={undefined}
          onChange={(props) =>
            setNode((current) => ({ ...current, props: { ...current.props, ...props } }))
          }
        />
        <output data-testid="state">{JSON.stringify(node.props)}</output>
      </ModelPosterUploadContext>
    </PictureBaseUrlContext>
  );
}

const state = () =>
  JSON.parse(screen.getByTestId("state").textContent ?? "{}") as Record<string, unknown>;

describe("the 3D model's Content panel", () => {
  it("tries a sample and takes its poster from the website's copy", async () => {
    const upload = vi.fn(async (_file: File) => ({
      assetId: "p1",
      src: "/media/p1.webp",
      alt: "",
    }));
    const node = page({ type: "model3d" }).root.children[0]!;
    render(<EditedModel start={node} upload={upload} />);

    expect(screen.getByText(/No model yet/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Vase" }));

    expect(state().model).toEqual(vase);
    await waitFor(() => expect(state().poster).toBe("/media/p1.webp"));
    expect(captureModelPoster).toHaveBeenCalledWith("https://bakery.test/_lintel/models/vase.glb", {
      light: "studio",
      background: "transparent",
    });
    expect(upload.mock.calls[0]?.[0]).toBeInstanceOf(File);
    expect(screen.getByText("Visitors see this picture while the model loads.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vase", pressed: true })).toBeTruthy();
  });

  it("fetches a sample from where the app says it can", async () => {
    const node = page({ type: "model3d" }).root.children[0]!;
    render(
      <SampleModelsUrlContext value="https://api.test/media/sample-models">
        <EditedModel
          start={node}
          upload={vi.fn(async () => ({ assetId: "p", src: "/p", alt: "" }))}
        />
      </SampleModelsUrlContext>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Disc" }));
    await waitFor(() => expect(state().poster).toBe("/p"));
    expect(captureModelPoster).toHaveBeenLastCalledWith(
      "https://api.test/media/sample-models/disc.glb",
      expect.anything(),
    );
  });

  it("says when the poster can't be taken, and asks for a description", async () => {
    captureModelPoster.mockRejectedValueOnce(new Error("No WebGL"));
    const node = page({ type: "model3d" }).root.children[0]!;
    render(<EditedModel start={node} upload={vi.fn()} />);

    expect(screen.getByText("Describe the model for people who can’t see it.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Knot" }));
    await waitFor(() => expect(screen.getByText(/Couldn’t take a picture/)).toBeTruthy());
  });

  it("warns about a model that is slow to load on phones", () => {
    const node = page({
      type: "model3d",
      props: {
        model: {
          src: "https://api.test/media/m/file",
          assetId: "m",
          bytes: MODEL_WARNING_BYTES + 3 * 1024 * 1024,
        },
      },
    }).root.children[0]!;
    render(<EditedModel start={node} />);
    expect(screen.getByText(/At 13\.0 MB this model may be slow/)).toBeTruthy();
    expect(screen.getByText(/From your media · 13\.0 MB/)).toBeTruthy();
  });
});

describe("the arc carousel", () => {
  it("starts with eight pictures in reading order and the arc effect", () => {
    const rendered = renderPage(
      page({ type: "arcCarousel", children: [...(arcCarouselComponent.defaultChildren ?? [])] }),
      standardRegistry,
      {
        withMotion: true,
      },
    );
    expect(rendered.html).toContain("lintel-arc-carousel");
    expect(rendered.html).toContain('aria-label="Gallery"');
    // The carousel and its eight pictures.
    const canvas = renderPage(
      page({ type: "arcCarousel", children: [...(arcCarouselComponent.defaultChildren ?? [])] }),
      standardRegistry,
      { mode: "canvas" },
    );
    expect(canvas.html.match(/data-lintel-node="e\d+"/g)).toHaveLength(9);
    expect(rendered.effects).toEqual([
      expect.objectContaining({ module: "depth", behaviour: "arcCarousel" }),
    ]);
  });
});

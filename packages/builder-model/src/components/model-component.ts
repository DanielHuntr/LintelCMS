import { z } from "zod";
import { defineComponent } from "./component-definition.js";
import type { PageNode } from "../document/page-document.schema.js";
import { imageAddressSchema, oneOf, plainText } from "./component-props.js";

/**
 * The 3D model element: a .glb from the media library (or one of Lintel's samples), placed
 * like a picture. The page shows its poster until the model has loaded, and keeps it for
 * people who ask for less motion and on devices that can't draw 3D; the model itself is
 * drawn by the "model-viewer" effect (`@lintel/motion`), which loads three.js only on
 * pages with a model, as the model comes near the screen.
 */

/** Above this a model takes a while to load on a phone, so the builder says so. */
export const MODEL_WARNING_BYTES = 10 * 1024 * 1024;

/** Where Lintel's own sample models are served, on the website and to the builder. */
export const SAMPLE_MODELS_FOLDER = "/_lintel/models";

/** Small models made for Lintel (see packages/motion/scripts/make-sample-models.mjs). */
export const sampleModels = [
  { id: "vase", name: "Ceramic vase", file: "vase.glb" },
  { id: "disc", name: "Brass disc", file: "disc.glb" },
  { id: "knot", name: "Knot", file: "knot.glb" },
] as const;

export type SampleModel = (typeof sampleModels)[number];

export function sampleModelAddress(sample: SampleModel): string {
  return `${SAMPLE_MODELS_FOLDER}/${sample.file}`;
}

/** The sample at this address, if it is one. */
export function findSampleModel(src: string): SampleModel | undefined {
  return sampleModels.find((sample) => sampleModelAddress(sample) === src);
}

/** A model file: its address, its media library id (none for samples) and its size. */
export const modelFileSchema = z.object({
  src: imageAddressSchema.default(""),
  assetId: z.string().max(100).nullable().default(null),
  bytes: z.number().int().min(0).max(1_000_000_000).default(0),
});

export type ModelFile = z.output<typeof modelFileSchema>;

export const emptyModelFile: ModelFile = { src: "", assetId: null, bytes: 0 };

const colourSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, { error: "A colour should be like #f4f1ec" })
  .default("#f4f1ec");

export const model3dComponent = defineComponent({
  type: "model3d",
  label: "3D model",
  keywords: ["3d", "glb", "gltf", "model", "object", "product", "spin", "three"],
  description:
    "A 3D model from your media library that turns by itself, with the pointer, as people scroll or when they drag it.",
  icon: "box",
  category: "media",
  propsSchema: z.object({
    model: modelFileSchema.default(emptyModelFile),
    /** What shows before the model loads, for less motion and without 3D. */
    poster: imageAddressSchema.default(""),
    alt: plainText(500),
    motion: oneOf(["spin", "still", "pointer", "scroll", "drag"], "The motion"),
    light: oneOf(["studio", "daylight", "dramatic", "night"], "The light"),
    background: oneOf(["transparent", "colour"], "The background"),
    backgroundColour: colourSchema,
  }),
  defaultProps: {
    model: emptyModelFile,
    poster: "",
    alt: "",
    motion: "spin",
    light: "studio",
    background: "transparent",
    backgroundColour: "#f4f1ec",
  },
  defaultStyles: {
    base: { width: "100%", maxWidth: "520px", aspectRatio: "1 / 1" },
  },
  allowedChildren: "none",
  editableFields: [
    { kind: "model", prop: "model", label: "Model" },
    {
      kind: "multilineText",
      prop: "alt",
      label: "Description",
      placeholder: "A terracotta vase with a narrow neck",
    },
    {
      kind: "choice",
      prop: "motion",
      label: "Motion",
      choices: [
        { value: "spin", label: "Spin slowly" },
        { value: "still", label: "Still" },
        { value: "pointer", label: "Follow the pointer" },
        { value: "scroll", label: "Turn as you scroll" },
        { value: "drag", label: "Drag to turn" },
      ],
    },
    {
      kind: "choice",
      prop: "light",
      label: "Light",
      choices: [
        { value: "studio", label: "Studio" },
        { value: "daylight", label: "Soft daylight" },
        { value: "dramatic", label: "Dramatic" },
        { value: "night", label: "Night" },
      ],
    },
    {
      kind: "choice",
      prop: "background",
      label: "Background",
      choices: [
        { value: "transparent", label: "See-through" },
        { value: "colour", label: "Colour" },
      ],
      advanced: true,
    },
    { kind: "text", prop: "backgroundColour", label: "Background colour", advanced: true },
    { kind: "image", prop: "poster", label: "Picture shown before it loads", advanced: true },
  ],
});

export type Model3dProps = z.output<typeof model3dComponent.propsSchema>;

/** The model's props, read safely from a node saved by any version. */
export function readModelProps(props: Readonly<Record<string, unknown>>): Model3dProps {
  const parsed = model3dComponent.propsSchema.safeParse(props);
  return parsed.success ? parsed.data : model3dComponent.propsSchema.parse({});
}

/** The effect that draws a 3D model element on the page; undefined for anything else. */
/** What a page's 3D models weigh: each file once, however many elements show it. */
export function modelFileBytes(node: PageNode): number {
  const files = new Map<string, number>();
  const visit = (current: PageNode) => {
    if (current.hidden) return;
    if (current.type === "model3d") {
      const { src, bytes } = readModelProps(current.props).model;
      if (src) files.set(src, bytes);
    }
    current.children.forEach(visit);
  };
  visit(node);
  return [...files.values()].reduce((total, bytes) => total + bytes, 0);
}

export function impliedModelEffect(
  node: PageNode,
): { effect: string; params: Record<string, string> } | undefined {
  if (node.type !== "model3d" || node.hidden) return undefined;
  const props = readModelProps(node.props);
  if (!props.model.src) return undefined;
  return {
    effect: "model-viewer",
    params: {
      src: props.model.src,
      motion: props.motion,
      light: props.light,
      background: props.background === "colour" ? props.backgroundColour : "transparent",
    },
  };
}

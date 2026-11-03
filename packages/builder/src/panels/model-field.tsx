import {
  findSampleModel,
  MODEL_WARNING_BYTES,
  type ModelFile,
  type PageNode,
  readModelProps,
  sampleModelAddress,
  sampleModels,
} from "@lintel/builder-model";
import { Box } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { PictureUploader } from "../canvas/usePictureDrop.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { Labelled } from "../ui/controls.js";
import { type ImagePicker, PictureBaseUrlContext, picturePreviewSrc } from "./content-fields.js";

/**
 * The 3D model element's Model field: choose a .glb from the media library or try one of
 * Lintel's samples. Each new model gets a poster at once: the builder draws the model as the
 * page first shows it and saves that picture to the media library, so visitors see it while
 * the model loads, when they ask for less motion and on devices that can't draw 3D.
 */

/** How the field saves the poster it takes: the app's picture upload (see PageBuilder). */
export const ModelPosterUploadContext = createContext<PictureUploader | undefined>(undefined);

/**
 * Where this window can fetch the samples from, when the app says: a site can be on an
 * address its security policy doesn't allow. Without it, they come from the website.
 */
export const SampleModelsUrlContext = createContext<string | undefined>(undefined);

type PosterState = "idle" | "taking" | "taken" | "failed";

const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

/** The model's address as this window can fetch it. */
function fetchableAddress(src: string, baseUrl: string | null, samplesUrl?: string): string {
  const sample = findSampleModel(src);
  return sample && samplesUrl ? `${samplesUrl}/${sample.file}` : picturePreviewSrc(src, baseUrl);
}

async function takePoster(
  src: string,
  options: { light: string; background: string },
): Promise<File> {
  const { captureModelPoster } = await import("@lintel/motion/model-poster");
  const picture = await captureModelPoster(src, options);
  const extension = picture.type === "image/webp" ? "webp" : "png";
  return new File([picture], `model-poster.${extension}`, { type: picture.type });
}

export function ModelField({
  label,
  node,
  pickImage,
  onChange,
}: {
  label: string;
  node: PageNode;
  pickImage: ImagePicker | undefined;
  onChange: (props: Record<string, unknown>, label: string) => void;
}) {
  const text = useBuilderText();
  const baseUrl = useContext(PictureBaseUrlContext);
  const upload = useContext(ModelPosterUploadContext);
  const samplesUrl = useContext(SampleModelsUrlContext);
  const props = readModelProps(node.props);
  const [poster, setPoster] = useState<PosterState>("idle");
  const latest = useRef(0);
  useEffect(() => () => void (latest.current += 1), []);

  const retakePoster = async (model: ModelFile) => {
    if (!upload || !model.src) return;
    const attempt = (latest.current += 1);
    setPoster("taking");
    try {
      const file = await takePoster(fetchableAddress(model.src, baseUrl, samplesUrl), {
        light: props.light,
        background: props.background === "colour" ? props.backgroundColour : "transparent",
      });
      const saved = await upload(file);
      if (attempt !== latest.current) return;
      onChange({ poster: saved.src }, text("pageBuilder.model.retakePoster"));
      setPoster("taken");
    } catch {
      if (attempt === latest.current) setPoster("failed");
    }
  };

  const choose = (model: ModelFile) => {
    onChange({ model, poster: "" }, label);
    void retakePoster(model);
  };

  const sample = findSampleModel(props.model.src);
  const hasModel = props.model.src !== "";
  return (
    <Labelled label={label}>
      {() => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-control bg-fill p-2">
            {props.poster ? (
              <img
                src={picturePreviewSrc(props.poster, baseUrl)}
                alt=""
                className="size-12 shrink-0 rounded-control object-contain"
              />
            ) : (
              <Box aria-hidden="true" className="size-12 shrink-0 p-2.5 text-label-tertiary" />
            )}
            <p className="min-w-0 text-caption text-label-secondary">
              {!hasModel
                ? text("pageBuilder.model.none")
                : sample
                  ? text("pageBuilder.model.sampleChosen", {
                      name: text(`pageBuilder.model.sample.${sample.id}`),
                    })
                  : `${text("pageBuilder.model.fromLibrary")}${props.model.bytes ? ` · ${text("pageBuilder.model.size", { size: megabytes(props.model.bytes) })}` : ""}`}
            </p>
          </div>
          {pickImage && (
            <button
              type="button"
              onClick={async () => {
                const picked = await pickImage({
                  label,
                  currentAssetId: props.model.assetId,
                  kind: "model",
                });
                if (picked) {
                  choose({ src: picked.src, assetId: picked.assetId, bytes: picked.bytes ?? 0 });
                }
              }}
              className="flex h-8 items-center justify-center gap-1.5 rounded-control bg-fill text-footnote font-medium text-accent hover:bg-fill-strong focus-visible:focus-ring"
            >
              {hasModel ? text("pageBuilder.model.change") : text("pageBuilder.model.choose")}
            </button>
          )}
          <div
            role="group"
            aria-label={text("pageBuilder.model.trySample")}
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="text-caption text-label-secondary">
              {text("pageBuilder.model.trySample")}
            </span>
            {sampleModels.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={sample?.id === option.id}
                onClick={() => choose({ src: sampleModelAddress(option), assetId: null, bytes: 0 })}
                className="h-7 rounded-full bg-fill px-2.5 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring aria-pressed:bg-accent-fill aria-pressed:text-on-accent"
              >
                {text(`pageBuilder.model.sample.${option.id}`)}
              </button>
            ))}
          </div>
          {props.model.bytes > MODEL_WARNING_BYTES && (
            <p className="text-caption text-warning">
              {text("pageBuilder.model.large", { size: megabytes(props.model.bytes) })}
            </p>
          )}
          {poster !== "idle" && (
            <p className="text-caption text-label-secondary" role="status">
              {text(
                poster === "taking"
                  ? "pageBuilder.model.posterTaking"
                  : poster === "taken"
                    ? "pageBuilder.model.posterTaken"
                    : "pageBuilder.model.posterFailed",
              )}
            </p>
          )}
          {hasModel && upload && poster !== "taking" && (
            <button
              type="button"
              onClick={() => void retakePoster(props.model)}
              className="self-start text-caption font-medium text-accent hover:underline focus-visible:focus-ring"
            >
              {text("pageBuilder.model.retakePoster")}
            </button>
          )}
        </div>
      )}
    </Labelled>
  );
}

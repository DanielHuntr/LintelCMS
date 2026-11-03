import type {
  BackgroundVideo,
  Breakpoint,
  FreeLayout,
  GridPlace,
  PlacedGrid,
  PageFont,
  PageNode,
  StackingMove,
} from "@lintel/builder-model";
import { createContext, useContext } from "react";
import type { ImagePicker } from "../panels/content-fields.js";

/** A file uploaded to the media library: a font or a video. */
export interface UploadedFile {
  assetId: string | null;
  src: string;
  /** What the file turned out to be: "font/woff2", "video/mp4"... */
  mimeType: string;
  filename: string;
}

/** Uploads a file the person chose to the media library; null if it didn't work. */
export type FileUploader = (file: File) => Promise<UploadedFile | null>;

/**
 * What the Style panel needs besides styles: settings that live on the element or the page
 * (free layout, a background video, the page's fonts), stacking, and the app's media
 * library. Provided by the Style panel; controls read it with `useDesignTools`.
 */
export interface DesignTools {
  node: PageNode;
  /** The element it is in; null for the page's sections. */
  parent: PageNode | null;
  pageFonts: readonly PageFont[];
  changePageFonts: (fonts: PageFont[], label: string) => void;
  setFreeLayout: (freeLayout: FreeLayout | null) => void;
  setPlacedGrid: (placedGrid: PlacedGrid | null) => void;
  /** Puts the element on its parent's placed grid at one screen size. */
  placeOnGrid: (target: Breakpoint, place: GridPlace) => void;
  setBackgroundVideo: (video: BackgroundVideo | null) => void;
  restack: (move: StackingMove) => void;
  pickImage?: ImagePicker;
  uploadFile?: FileUploader;
}

export const DesignToolsContext = createContext<DesignTools | null>(null);

export function useDesignTools(): DesignTools {
  const tools = useContext(DesignToolsContext);
  if (!tools) throw new Error("Design controls need the Style panel around them.");
  return tools;
}

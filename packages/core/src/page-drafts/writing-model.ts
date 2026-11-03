/**
 * The writing model page drafting uses, described exactly: who made it, its licence, where it
 * comes from, its files and their SHA-256 checksums. The setup screen shows all of this before
 * anything is downloaded, and every file is checked against its checksum before it is used.
 *
 * Qwen2.5 7B Instruct, quantised to 4 bits (Q4_K_M) by its makers, from their own repository.
 * The repository splits it into two GGUF files; llama.cpp reads them as one model when given
 * the first. Everything here was read from the repository at the pinned revision, so the
 * addresses keep pointing at the same bytes even if the repository changes later. The
 * reasoning is in docs/decisions/0043-page-drafting.md.
 */

export interface WritingModelFile {
  name: string;
  /** Where it downloads from: the maker's own repository, at a fixed revision. */
  url: string;
  sizeInBytes: number;
  sha256: string;
}

export interface WritingModel {
  /** Also the name of its folder on disk. */
  id: string;
  name: string;
  maker: string;
  licence: string;
  licenceUrl: string;
  /** The model's page, for people who want to read about it. */
  sourcePage: string;
  /** The first file is the one llama.cpp is given; the others sit beside it. */
  files: readonly WritingModelFile[];
  /** Free memory it needs to write, with room for its working space. */
  memoryNeededInBytes: number;
}

const REPOSITORY = "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF";
const REVISION = "bb5d59e06d9551d752d08b292a50eb208b07ab1f";
const GIGABYTE = 1024 ** 3;

const fileAtRevision = (name: string) => `${REPOSITORY}/resolve/${REVISION}/${name}`;

export const qwenWritingModel: WritingModel = {
  id: "qwen2.5-7b-instruct-q4_k_m",
  name: "Qwen2.5 7B Instruct",
  maker: "The Qwen team at Alibaba Cloud",
  licence: "Apache License 2.0",
  licenceUrl: `${REPOSITORY}/blob/${REVISION}/LICENSE`,
  sourcePage: REPOSITORY,
  files: [
    {
      name: "qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf",
      url: fileAtRevision("qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf"),
      sizeInBytes: 3_993_201_344,
      sha256: "dfce12e3862a5283ccfb88221b48480e58745165de856439950d0f22590580db",
    },
    {
      name: "qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf",
      url: fileAtRevision("qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf"),
      sizeInBytes: 689_872_288,
      sha256: "539cf93f78e887edea1c04e2d7d8cdaca9d01dae9c9025bcb8accbe29df3d72a",
    },
  ],
  // 4.4 GB of weights, about half a gigabyte for a 4,096-token context and llama.cpp's
  // working buffers, and some room to spare.
  memoryNeededInBytes: 6 * GIGABYTE,
};

export function modelSizeInBytes(model: WritingModel): number {
  return model.files.reduce((total, file) => total + file.sizeInBytes, 0);
}

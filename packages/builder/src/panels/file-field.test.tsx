import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FileUploader } from "../style-panel/design-tools.js";
import { FileField, FileUploaderContext, fileNameOf, hasAcceptedExtension } from "./file-field.js";

/** The field the Lottie and Rive elements use to choose their animation file. */

function Field({ uploader, start = "" }: { uploader: FileUploader | null; start?: string }) {
  const [value, setValue] = useState(start);
  return (
    <FileUploaderContext value={uploader}>
      <FileField
        label="Animation file"
        value={value}
        accept={[".json", ".lottie"]}
        onChange={setValue}
      />
      <output data-testid="value">{value}</output>
    </FileUploaderContext>
  );
}

describe("the animation file field", () => {
  it("says the sample plays until a file is uploaded, then names the file", async () => {
    const uploader = vi.fn<FileUploader>(async (file) => ({
      assetId: "a1",
      src: `/media/${file.name}`,
      mimeType: "application/json",
      filename: file.name,
    }));
    render(<Field uploader={uploader} />);
    expect(screen.getByText(/Lintel’s sample/)).toBeTruthy();
    await userEvent.upload(
      screen.getByLabelText("Upload a file"),
      new File(["{}"], "hop.lottie", { type: "application/zip" }),
    );
    expect(uploader).toHaveBeenCalledOnce();
    expect(screen.getByTestId("value").textContent).toBe("/media/hop.lottie");
    expect(screen.getByText("Plays hop.lottie")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Use the sample again" }));
    expect(screen.getByTestId("value").textContent).toBe("");
  });

  it("gives the media library's id with an upload, and none for a typed address", async () => {
    const changed = vi.fn();
    render(
      <FileUploaderContext
        value={async () => ({
          assetId: "a1",
          src: "/media/a1/file",
          mimeType: "application/x-rive",
          filename: "orbit.riv",
        })}
      >
        <FileField label="Animation file" value="" accept={[".riv"]} onChange={changed} />
      </FileUploaderContext>,
    );
    await userEvent.upload(screen.getByLabelText("Upload a file"), new File(["RIVE"], "orbit.riv"));
    expect(changed).toHaveBeenLastCalledWith("/media/a1/file", "a1");
    await userEvent.type(screen.getByLabelText("File address"), "x");
    expect(changed.mock.lastCall?.[1]).toBe("");
  });

  it("refuses a file of the wrong kind before uploading it", async () => {
    const uploader = vi.fn<FileUploader>();
    render(<Field uploader={uploader} />);
    await userEvent.upload(
      screen.getByLabelText("Upload a file"),
      new File(["x"], "photo.png", { type: "image/png" }),
      { applyAccept: false },
    );
    expect(uploader).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(".json or .lottie");
  });

  it("chooses a file already in Media (LINTEL-UX-319)", async () => {
    const pickImage = vi.fn(async () => ({ src: "/media/hop.json", alt: "", assetId: "a1" }));
    const onChange = vi.fn();
    render(
      <FileField
        label="Animation file"
        value=""
        accept={[".json", ".lottie"]}
        pickImage={pickImage}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose from Media" }));

    expect(pickImage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "animation", accept: [".json", ".lottie"] }),
    );
    expect(onChange).toHaveBeenCalledWith("/media/hop.json", "a1");
  });

  it("takes a typed address, but only a safe one", async () => {
    render(<Field uploader={null} />);
    expect(screen.queryByLabelText("Upload a file")).toBeNull();
    const address = screen.getByLabelText("File address");
    await userEvent.type(address, "javascript:x");
    expect(screen.getByTestId("value").textContent).toBe("");
    await userEvent.clear(address);
    await userEvent.type(address, "/media/wave.json");
    expect(screen.getByTestId("value").textContent).toBe("/media/wave.json");
  });

  it("shows the address of the element now selected, not the one before", () => {
    const { rerender } = render(
      <FileField
        label="Animation file"
        value="/media/a.json"
        accept={[".json"]}
        onChange={() => undefined}
      />,
    );
    rerender(
      <FileField
        label="Animation file"
        value="/media/b.riv"
        accept={[".riv"]}
        onChange={() => undefined}
      />,
    );
    expect((screen.getByLabelText("File address") as HTMLInputElement).value).toBe("/media/b.riv");
  });

  it("reads names and extensions from addresses", () => {
    expect(fileNameOf("/media/abc/My%20dots.lottie?x=1")).toBe("My dots.lottie");
    expect(fileNameOf("https://api.example.com/media/d0e2/file?v=8")).toBe("");
    expect(hasAcceptedExtension("ORBIT.RIV", [".riv"])).toBe(true);
    expect(hasAcceptedExtension("orbit.riv.png", [".riv"])).toBe(false);
  });
});

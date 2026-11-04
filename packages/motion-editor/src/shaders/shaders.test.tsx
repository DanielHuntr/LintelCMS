import type * as Effects from "@lintel/motion/effects";
import { effectRegistry, type EffectDefinition, type NodeEffect } from "@lintel/motion/effects";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { EffectSettings } from "../effects/EffectSettings.js";
import { MotionPanel } from "../motion-panel/MotionPanel.js";
import { ShaderCodeBox } from "./ShaderCodeBox.js";
import { ShaderLibraryContext, type ShaderLibrary } from "./shader-library.js";

/** What the tests' preview was told to show, and how to make the card stop it. */
const previewed: { codes: string[]; lose: () => void } = { codes: [], lose: () => undefined };

vi.mock("@lintel/motion/shader-preview", async () => {
  const { readCustomShader } = await vi.importActual<typeof Effects>("@lintel/motion/effects");
  return {
    createShaderPreview: (_canvas: HTMLCanvasElement, onLost: () => void) => {
      previewed.lose = onLost;
      return {
        show: (code: string) => {
          previewed.codes.push(code);
          return readCustomShader(code).problems;
        },
        setValues: () => undefined,
        destroy: () => undefined,
      };
    },
  };
});

const gradient = effectRegistry.find("moving-gradient") as EffectDefinition;

function Panel({ initial, onPreview }: { initial: NodeEffect[]; onPreview?: () => void }) {
  const [effects, setEffects] = useState(initial);
  return (
    <>
      <MotionPanel
        name="Hero"
        animations={[]}
        effects={effects}
        elementKind="container"
        onChangeAnimations={() => undefined}
        onChangeEffects={setEffects}
        onPreviewSpec={() => undefined}
        onPreviewEffect={onPreview ?? (() => undefined)}
        onStopPreview={() => undefined}
        showsTimeline={false}
      />
      <output data-testid="saved">{JSON.stringify(effects)}</output>
    </>
  );
}

const saved = () => JSON.parse(screen.getByTestId("saved").textContent ?? "[]") as NodeEffect[];

describe("settings", () => {
  it("shows the few main settings and folds the rest", () => {
    render(<EffectSettings definition={gradient} values={{}} onChange={() => undefined} />);
    expect(screen.getByLabelText("How much colour")).toBeTruthy();
    expect(screen.queryByLabelText("Size")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More settings" }));
    expect(screen.getByLabelText("Size")).toBeTruthy();
    expect(screen.getByLabelText("Direction")).toBeTruthy();
  });

  it("offers no way to react unless the host saves reactions", () => {
    render(<EffectSettings definition={gradient} values={{}} onChange={() => undefined} />);
    expect(screen.queryByRole("button", { name: /react to something/ })).toBeNull();
  });

  it("lets a number react to something from a control on that setting", () => {
    const onReacts = vi.fn();
    render(
      <EffectSettings
        definition={gradient}
        values={{ strength: 0.5 }}
        onChange={() => undefined}
        onReacts={onReacts}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Make Speed react to something" }));
    fireEvent.change(screen.getByLabelText("Speed reacts to"), { target: { value: "scroll" } });
    expect(onReacts).toHaveBeenCalledWith({ speed: { source: "scroll", to: 3 } });
  });
});

describe("layers", () => {
  const openEffect = () =>
    fireEvent.click(screen.getByRole("button", { name: "Edit Moving gradient" }));

  it("turns a background into layers without losing its settings, and adds to them", () => {
    render(<Panel initial={[{ effect: "moving-gradient", params: { strength: 0.8 } }]} />);
    openEffect();
    fireEvent.click(screen.getByRole("button", { name: "Add a layer" }));
    const [stack] = saved();
    expect(stack?.effect).toBe("layered-background");
    expect(stack?.layers?.[0]).toMatchObject({
      effect: "moving-gradient",
      params: { strength: 0.8 },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add a layer" }));
    fireEvent.click(screen.getByRole("button", { name: "Film grain" }));
    expect(saved()[0]?.layers?.map((layer) => layer.effect)).toEqual([
      "moving-gradient",
      "film-grain",
    ]);
  });

  const stack: NodeEffect = {
    effect: "layered-background",
    params: { readable: true },
    layers: [
      { id: "a", effect: "moving-gradient", params: {}, blend: "normal", opacity: 1 },
      { id: "b", effect: "film-grain", params: {}, blend: "normal", opacity: 1 },
    ],
  };
  const openStack = () =>
    fireEvent.click(screen.getByRole("button", { name: "Edit Layered background" }));

  it("lists the top layer first, and hides, reorders, blends and removes", () => {
    render(<Panel initial={[stack]} />);
    openStack();
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows[0]?.textContent).toContain("Film grain");

    fireEvent.click(screen.getByRole("button", { name: "Hide Film grain" }));
    expect(saved()[0]?.layers?.[1]?.hidden).toBe(true);

    fireEvent.change(screen.getByLabelText("Blend"), { target: { value: "overlay" } });
    expect(saved()[0]?.layers?.[1]?.blend).toBe("overlay");

    fireEvent.click(screen.getByRole("button", { name: "Move Film grain down" }));
    expect(saved()[0]?.layers?.map((layer) => layer.id)).toEqual(["b", "a"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Film grain" }));
    expect(saved()[0]?.layers?.map((layer) => layer.id)).toEqual(["a"]);
  });

  it("lets a layer's opacity react, like any number", () => {
    render(<Panel initial={[stack]} />);
    openStack();
    fireEvent.click(screen.getByRole("button", { name: "Make Opacity react to something" }));
    fireEvent.change(screen.getByLabelText("Opacity reacts to"), { target: { value: "scroll" } });
    expect(saved()[0]?.layers?.[1]?.reacts).toEqual({
      layerOpacity: { source: "scroll", to: 0 },
    });
  });

  it("keeps a layer's settings to the layer, and starts showing it on the page at once", () => {
    const onPreview = vi.fn();
    render(<Panel initial={[{ effect: "moving-gradient", params: {} }]} onPreview={onPreview} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Moving gradient" }));
    onPreview.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Add a layer" }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(screen.getAllByLabelText("Keep words readable")).toHaveLength(1);
  });

  it('keeps "Keep words readable" working over the stack', () => {
    render(<Panel initial={[stack]} />);
    openStack();
    fireEvent.click(screen.getByLabelText("Keep words readable"));
    expect(saved()[0]?.params.readable).toBe(false);
  });

  it("previews a stack from a plan, so the page draws what's saved", () => {
    const onPreview = vi.fn();
    render(<Panel initial={[stack]} onPreview={onPreview} />);
    openStack();
    fireEvent.click(screen.getByRole("button", { name: "Hide Film grain" }));
    const [, props] = onPreview.mock.calls.at(-1) as [unknown, { plan: string }];
    expect(JSON.parse(props.plan).layers).toHaveLength(1);
  });
});

describe("custom shaders", () => {
  const library = (overrides: Partial<ShaderLibrary> = {}): ShaderLibrary => ({
    shaders: [],
    allowed: true,
    canWrite: true,
    save: vi.fn(async () => undefined),
    remove: vi.fn(),
    ...overrides,
  });

  const stack: NodeEffect = { effect: "layered-background", params: {}, layers: [] };

  it("shows a shader on the page as soon as it's saved, before the library has it back", async () => {
    const onPreview = vi.fn();
    render(
      <ShaderLibraryContext value={library()}>
        <Panel initial={[stack]} onPreview={onPreview} />
      </ShaderLibraryContext>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Layered background" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a layer" }));
    fireEvent.click(screen.getByRole("button", { name: "Write your own…" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Rings" } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    const [, props] = onPreview.mock.calls.at(-1) as [unknown, { plan: string }];
    expect(JSON.parse(props.plan).layers[0].code).toContain("void main");
  });

  it("offers saved shaders to anyone, and writing only to those who may", () => {
    const shaders = [{ id: "r", name: "Rings", code: "void main(){gl_FragColor=vec4(1.);}" }];
    render(
      <ShaderLibraryContext value={library({ shaders, canWrite: false })}>
        <Panel initial={[stack]} />
      </ShaderLibraryContext>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Layered background" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a layer" }));
    expect(screen.queryByRole("button", { name: "Write your own…" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rings" }));
    expect(saved()[0]?.layers?.[0]).toMatchObject({ effect: "custom-shader", shader: "r" });
  });

  it("shows controls from the code's comments, and names the line that's wrong", async () => {
    render(
      <ShaderCodeBox library={library()} onClose={() => undefined} onSaved={() => undefined} />,
    );
    expect(screen.getByLabelText("How many rings")).toBeTruthy();
    expect(screen.getByLabelText("Turn inside out")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Fragment shader code"), {
      target: { value: "void main(){\n  while(true){}\n}" },
    });
    expect(await screen.findByText(/^Line 2: only for loops/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("stops code the card gave up on, doesn't retry it, and tries again once it changes", async () => {
    vi.useFakeTimers();
    try {
      render(
        <ShaderCodeBox library={library()} onClose={() => undefined} onSaved={() => undefined} />,
      );
      await act(() => vi.advanceTimersByTimeAsync(400));
      previewed.codes.length = 0;
      act(() => previewed.lose());
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(screen.getByText(/graphics card stopped this shader/)).toBeTruthy();
      expect(previewed.codes).toEqual([]);
      const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
      fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Rings" } });
      expect(save.disabled).toBe(true);

      const fixed = "void main(){gl_FragColor=vec4(1.);}";
      fireEvent.change(screen.getByLabelText("Fragment shader code"), { target: { value: fixed } });
      await act(() => vi.advanceTimersByTimeAsync(400));
      expect(screen.queryByText(/graphics card stopped this shader/)).toBeNull();
      expect(previewed.codes).toEqual([fixed]);
      expect(save.disabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("won't lose changed code to the Escape key, but leaves if nothing changed", () => {
    const onClose = vi.fn();
    render(<ShaderCodeBox library={library()} onClose={onClose} onSaved={() => undefined} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Fragment shader code"), { target: { value: "x" } });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("starts in the code, and asks before deleting a shader from the whole site", () => {
    const remove = vi.fn();
    const shader = { id: "r", name: "Rings", code: "void main(){gl_FragColor=vec4(1.);}" };
    render(
      <ShaderCodeBox
        shader={shader}
        library={library({ remove })}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Fragment shader code"));
    fireEvent.click(screen.getByRole("button", { name: "Delete from this site" }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete from this site" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(remove).toHaveBeenCalledWith("r");
  });

  it("sends no code to the canvas while the site doesn't allow custom code", () => {
    const onPreview = vi.fn();
    const shaders = [{ id: "r", name: "Rings", code: "void main(){gl_FragColor=vec4(1.);}" }];
    const uses: NodeEffect = {
      effect: "layered-background",
      params: {},
      layers: [
        {
          id: "a",
          effect: "custom-shader",
          shader: "r",
          params: {},
          blend: "normal",
          opacity: 1,
        },
      ],
    };
    render(
      <ShaderLibraryContext value={library({ shaders, allowed: false })}>
        <Panel initial={[uses]} onPreview={onPreview} />
      </ShaderLibraryContext>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Layered background" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide Rings" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Rings" }));
    const [, props] = onPreview.mock.calls.at(-1) as [unknown, { plan: string }];
    expect(props.plan).not.toContain("void main");
  });

  it("says so when the site doesn't allow custom code, and offers the switch to who may", () => {
    const allowCode = vi.fn();
    render(
      <ShaderCodeBox
        library={library({ allowed: false, allowCode })}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    expect(screen.queryByLabelText("Fragment shader code")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Allow custom code" }));
    expect(allowCode).toHaveBeenCalled();
  });
});

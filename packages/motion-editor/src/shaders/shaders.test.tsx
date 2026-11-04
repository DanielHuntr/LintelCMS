import type * as Effects from "@lintel/motion/effects";
import { effectRegistry, type EffectDefinition, type NodeEffect } from "@lintel/motion/effects";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { EffectSettings } from "../effects/EffectSettings.js";
import { MotionPanel } from "../motion-panel/MotionPanel.js";
import { ShaderCodeBox } from "./ShaderCodeBox.js";
import { ShaderLibraryContext, type ShaderLibrary } from "./shader-library.js";

vi.mock("@lintel/motion/shader-preview", async () => {
  const { readCustomShader } = await vi.importActual<typeof Effects>("@lintel/motion/effects");
  return {
    createShaderPreview: () => ({
      show: (code: string) => readCustomShader(code).problems,
      setValues: () => undefined,
      destroy: () => undefined,
    }),
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

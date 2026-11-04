import {
  blendModes,
  cleanProps,
  customShaderDefinition,
  customShaderEffectId,
  defaultProps,
  isStackable,
  layeredBackgroundEffectId,
  maxShaderLayers,
  readCustomShader,
  type BlendMode,
  type EffectDefinition,
  type EffectRegistry,
  type NodeEffect,
  type ShaderLayer,
} from "@lintel/motion/effects";
import { ArrowDown, ArrowUp, ChevronRight, Code2, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { classNames } from "../controls/classNames.js";
import { Checkbox, Select } from "../controls/Field.js";
import { Slider } from "../controls/Slider.js";
import type { CursorColourSwatch } from "../effects/CursorLookFields.js";
import { EffectSettings } from "../effects/EffectSettings.js";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { useTranslate } from "../strings/translate.js";
import { ShaderCodeBox } from "./ShaderCodeBox.js";
import { useShaderLibrary, type ShaderInLibrary } from "./shader-library.js";

/** A layer's settings as an effect: its catalogue entry, or its saved shader's controls. */
function definitionOf(
  layer: ShaderLayer,
  registry: EffectRegistry,
  shaders: readonly ShaderInLibrary[],
): EffectDefinition | undefined {
  if (layer.effect !== customShaderEffectId) return registry.find(layer.effect);
  const shader = shaders.find((candidate) => candidate.id === layer.shader);
  return shader ? customShaderDefinition(shader.name, readCustomShader(shader.code)) : undefined;
}

const newLayerId = () => `l${Math.random().toString(36).slice(2, 10)}`;

/**
 * A section's background as layers, shown the way design tools show them: the top layer first.
 * Each can be hidden, moved, blended and removed. A row opens to the layer's own settings.
 */
export function ShaderLayers({
  saved,
  registry,
  colours,
  onChange,
  onRemove,
  onCommit,
}: {
  saved: NodeEffect;
  registry: EffectRegistry;
  colours?: readonly CursorColourSwatch[];
  onChange: (next: NodeEffect) => void;
  onRemove: () => void;
  onCommit?: () => void;
}) {
  const t = useTranslate();
  const library = useShaderLibrary();
  const shaders = library?.shaders ?? [];
  const layers = saved.layers ?? [];
  const [openId, setOpenId] = useState<string | undefined>(layers.at(-1)?.id);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ShaderInLibrary | "new" | undefined>();

  const change = (next: readonly ShaderLayer[]) => onChange({ ...saved, layers: [...next] });
  const update = (id: string, patch: Partial<ShaderLayer>) =>
    change(layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  const move = (index: number, by: number) => {
    const next = [...layers];
    const [taken] = next.splice(index, 1);
    next.splice(index + by, 0, taken!);
    change(next);
    onCommit?.();
  };
  const add = (layer: Omit<ShaderLayer, "id" | "blend" | "opacity">) => {
    const id = newLayerId();
    change([...layers, { ...layer, id, blend: "normal", opacity: 1 }]);
    setOpenId(id);
    setAdding(false);
    onCommit?.();
  };
  const addShader = (shader: ShaderInLibrary) => {
    const definition = customShaderDefinition(shader.name, readCustomShader(shader.code));
    add({
      effect: customShaderEffectId,
      shader: shader.id,
      params: defaultProps(definition.params),
    });
  };
  const stackable = registry
    .all()
    .filter(
      (definition) =>
        definition.listed !== false &&
        isStackable(definition) &&
        definition.id !== layeredBackgroundEffectId,
    );
  const full = layers.length >= maxShaderLayers;
  const readable = saved.params.readable !== false;

  return (
    <section aria-label={t("motionEditor.shaders.layers")} className="flex flex-col gap-3">
      <h2 className="text-title text-label">{t("motionEditor.shaders.layers")}</h2>
      <ol className="overflow-hidden rounded-card bg-background">
        {[...layers].reverse().map((layer) => {
          const index = layers.indexOf(layer);
          const definition = definitionOf(layer, registry, shaders);
          const name = definition?.name ?? t("motionEditor.shaders.missing");
          const open = openId === layer.id;
          const shader = shaders.find((candidate) => candidate.id === layer.shader);
          return (
            <li key={layer.id} className="[&+li]:hairline-top">
              <div className="flex min-h-11 items-center gap-0.5 pr-1 pl-1">
                <IconButton
                  label={t(
                    layer.hidden ? "motionEditor.shaders.show" : "motionEditor.shaders.hide",
                    { name },
                  )}
                  pressed={layer.hidden === true}
                  onClick={() => {
                    update(layer.id, { hidden: !layer.hidden });
                    onCommit?.();
                  }}
                >
                  {layer.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </IconButton>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? undefined : layer.id)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-control px-1 text-start focus-visible:focus-ring"
                >
                  <span
                    className={classNames(
                      "min-w-0 flex-1 truncate text-body font-medium",
                      layer.hidden ? "text-label-tertiary" : "text-label",
                    )}
                  >
                    {name}
                  </span>
                  {layer.blend !== "normal" && (
                    <span className="shrink-0 text-footnote text-label-secondary">
                      {t(`motionEditor.shaders.blend.${layer.blend}` as MotionEditorStringKey)}
                    </span>
                  )}
                  <ChevronRight
                    aria-hidden="true"
                    className={classNames(
                      "size-4 shrink-0 text-label-tertiary transition-transform",
                      open && "rotate-90",
                    )}
                  />
                </button>
              </div>
              {open && (
                <div className="flex flex-col gap-3 px-3 pt-1 pb-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label={t("motionEditor.shaders.blend")}
                      value={layer.blend}
                      options={blendModes.map((mode) => ({
                        value: mode,
                        label: t(`motionEditor.shaders.blend.${mode}` as MotionEditorStringKey),
                      }))}
                      onChange={(event) => {
                        update(layer.id, { blend: event.target.value as BlendMode });
                        onCommit?.();
                      }}
                    />
                    <Slider
                      label={t("motionEditor.shaders.opacity")}
                      min={0}
                      max={1}
                      step={0.05}
                      value={layer.opacity}
                      displayValue={`${Math.round(layer.opacity * 100)}%`}
                      onChange={(opacity) => update(layer.id, { opacity })}
                      onCommit={onCommit}
                    />
                  </div>
                  {definition && (
                    <EffectSettings
                      definition={definition}
                      values={cleanProps(definition, layer.params)}
                      colours={colours}
                      onChange={(params) => update(layer.id, { params })}
                      onCommit={onCommit}
                      reacts={layer.reacts}
                      onReacts={(reacts) => update(layer.id, { reacts })}
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                    <IconButton
                      label={t("motionEditor.shaders.moveUp", { name })}
                      disabled={index === layers.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowUp className="size-4" />
                    </IconButton>
                    <IconButton
                      label={t("motionEditor.shaders.moveDown", { name })}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowDown className="size-4" />
                    </IconButton>
                    {shader && library?.canWrite && library.allowed && (
                      <IconButton
                        label={t("motionEditor.shaders.editCode", { name })}
                        onClick={() => setEditing(shader)}
                      >
                        <Code2 className="size-4" />
                      </IconButton>
                    )}
                    <span className="flex-1" />
                    <IconButton
                      label={t("motionEditor.shaders.remove", { name })}
                      onClick={() => {
                        change(layers.filter((other) => other.id !== layer.id));
                        onCommit?.();
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {adding ? (
        <div className="overflow-hidden rounded-card bg-background">
          <ul aria-label={t("motionEditor.shaders.add")}>
            {stackable.map((definition) => (
              <li key={definition.id} className="[&+li]:hairline-top">
                <AddRow
                  label={definition.name}
                  onClick={() =>
                    add({ effect: definition.id, params: defaultProps(definition.params) })
                  }
                />
              </li>
            ))}
            {shaders.map((shader) => (
              <li key={shader.id} className="[&+li]:hairline-top">
                <AddRow label={shader.name} onClick={() => addShader(shader)} />
              </li>
            ))}
            {library?.canWrite && (
              <li className="hairline-top">
                <AddRow
                  label={t("motionEditor.shaders.writeYourOwn")}
                  onClick={() => setEditing("new")}
                />
              </li>
            )}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          disabled={full}
          onClick={() => setAdding(true)}
          className="flex min-h-11 items-center gap-2.5 rounded-card bg-background px-2.5 text-start text-body font-medium text-label hover:bg-fill focus-visible:focus-ring disabled:text-label-tertiary"
        >
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-[7px] bg-fill-strong"
          >
            <Plus className="size-4" />
          </span>
          {t(full ? "motionEditor.shaders.full" : "motionEditor.shaders.add")}
        </button>
      )}

      <div className="rounded-card bg-background p-3">
        <Checkbox
          label={t("motionEditor.shaders.readable")}
          checked={readable}
          onChange={(next) => {
            onChange({ ...saved, params: { ...saved.params, readable: next } });
            onCommit?.();
          }}
        />
      </div>
      <p className="px-2.5 text-caption text-label-secondary">
        {t("motionEditor.shaders.footnote")}
      </p>
      <button
        type="button"
        onClick={onRemove}
        className="flex min-h-11 items-center justify-center rounded-card bg-background text-body font-medium text-danger hover:bg-fill focus-visible:focus-ring"
      >
        {t("motionEditor.shaders.removeAll")}
      </button>

      {editing && library && (
        <ShaderCodeBox
          shader={editing === "new" ? undefined : editing}
          library={library}
          onClose={() => setEditing(undefined)}
          onSaved={(shader, isNew) => {
            setEditing(undefined);
            if (isNew) addShader(shader);
          }}
        />
      )}
    </section>
  );
}

function IconButton({
  label,
  onClick,
  pressed,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-control text-label-secondary hover:bg-fill focus-visible:focus-ring disabled:text-label-tertiary disabled:opacity-50 [&>svg]:shrink-0"
    >
      {children}
    </button>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-2 px-3 text-start text-body text-label hover:bg-fill focus-visible:focus-ring"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Plus aria-hidden="true" className="size-4 shrink-0 text-label-tertiary" />
    </button>
  );
}

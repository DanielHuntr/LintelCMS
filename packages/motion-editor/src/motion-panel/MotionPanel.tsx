import type { MotionSpec } from "@lintel/motion";
import {
  defaultProps,
  effectAnimation,
  effectRegistry,
  maxEffectsPerElement,
  type EffectDefinition,
  type EffectRegistry,
  type ElementKind,
  type NodeEffect,
  type PageWeight,
} from "@lintel/motion/effects";
import { findPreset, motionPresets, type MotionPreset } from "@lintel/motion/presets";
import { ChevronLeft, ChevronRight, Play, Plus, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { OpenGroups } from "../controls/CollapsibleGroup.js";
import { classNames } from "../controls/classNames.js";
import { AppliedEffect } from "../effects/AppliedEffect.js";
import { PageWeightMeter } from "../effects/PageWeightMeter.js";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { TranslateProvider, useTranslate, type Translate } from "../strings/translate.js";
import { MotionStudio, type StudioView } from "../studio/MotionStudio.js";
import { type SceneElement, SceneElementsContext } from "../trigger/sceneElements.js";
import { MomentPicker, momentColours, momentIcons } from "./MomentPicker.js";
import {
  listMotionChoices,
  momentOfEffect,
  momentOfSpec,
  searchMotionChoices,
  type MotionChoice,
  type MotionMoment,
} from "./motionChoices.js";
import { QuickMotion, type QuickAdded } from "./QuickMotion.js";
import {
  animationSpecOf,
  quickChoicesFor,
  quickResult,
  quickSpec,
  settingsOf,
  type QuickChoice,
  type QuickSettings,
} from "./quickPicks.js";

export interface SavedAnimation {
  spec: MotionSpec;
  presetId?: string;
}

export interface MotionPanelProps {
  /** The element's name in Layers. */
  name: string;
  animations: readonly SavedAnimation[];
  effects: readonly NodeEffect[];
  elementKind: ElementKind;
  onChangeAnimations: (animations: SavedAnimation[]) => void;
  /** How many animations one element may have. */
  maxAnimations?: number;
  onChangeEffects: (effects: NodeEffect[]) => void;
  /** Plays a spec once on the element on the page. */
  onPreviewSpec: (spec: MotionSpec) => void;
  /** Runs an effect on the element on the page until `onStopPreview`. */
  onPreviewEffect: (
    definition: EffectDefinition,
    props: Record<string, number | string | boolean>,
  ) => void;
  onStopPreview: () => void;
  /** Whether "Fine-tune" (the timeline) is on offer. */
  showsTimeline: boolean;
  /** Shown under an animation's settings while the timeline isn't on offer, saying how to get it. */
  timelineNote?: string;
  /** Lets undo treat a drag on a slider as one change. */
  onCommit?: () => void;
  /** Elements around this one whose scroll scenes it can be a step of, nearest first. */
  sceneElements?: readonly SceneElement[];
  /** The page's effects added up: shown only when there's something to warn about. */
  pageWeight?: PageWeight;
  openGroups?: OpenGroups;
  presets?: readonly MotionPreset[];
  registry?: EffectRegistry;
  translate?: Translate;
}

type View =
  | { name: "list" }
  /** Adding: choose when, and a default goes on at once, with a few alternatives. */
  | { name: "add" }
  /** Every preset and effect, with search: "More effects…". */
  | { name: "catalogue" }
  | { name: "animation"; index: number }
  | { name: "effect"; index: number };

/**
 * Everything that makes the selected element move, in one place: what it has (its animations
 * and its effects, each named by what it does and when), adding more by choosing when it
 * should move, and each one's settings in plain words. It replaces the separate Animation
 * and Effects tabs, which asked people to know the difference.
 */
export function MotionPanel(props: MotionPanelProps) {
  return (
    <TranslateProvider translate={props.translate}>
      <SceneElementsContext value={props.sceneElements ?? []}>
        <Panel {...props} />
      </SceneElementsContext>
    </TranslateProvider>
  );
}

function Panel({
  name,
  animations,
  effects,
  elementKind,
  onChangeAnimations,
  maxAnimations = 6,
  onChangeEffects,
  onPreviewSpec,
  onPreviewEffect,
  onStopPreview,
  showsTimeline,
  timelineNote,
  onCommit,
  pageWeight,
  openGroups,
  presets = motionPresets,
  registry = effectRegistry,
}: MotionPanelProps) {
  const t = useTranslate();
  const [view, setView] = useState<View>({ name: "list" });
  const [moment, setMoment] = useState<MotionMoment | null>(null);
  const [addedHere, setAdded] = useState<QuickAdded | null>(null);
  // Undo can take away what this screen added; then the next choice adds afresh.
  const added = addedHere && animations[addedHere.index] ? addedHere : null;
  const choices = useMemo(
    () => listMotionChoices(presets, registry, elementKind),
    [presets, registry, elementKind],
  );
  const known = effects.flatMap((saved, index) => {
    const definition = registry.find(saved.effect);
    return definition ? [{ saved, definition, index }] : [];
  });
  const nameOf = (animation: SavedAnimation) =>
    findPresetOrEffectName(animation.presetId, presets, registry) ??
    t("motionEditor.panel.yourAnimation");
  const animationsFull = animations.length >= maxAnimations;

  function go(next: View) {
    onStopPreview();
    setMoment(null);
    setAdded(null);
    setView(next);
  }

  /** The element's animations without the one this screen added, which a new choice replaces. */
  const withoutAdded = added ? animations.filter((_, at) => at !== added.index) : animations;

  /** Puts a tile's motion on the element (in place of the one added here) and plays it. */
  function applyTile(tile: QuickChoice, inMoment: MotionMoment) {
    if (!added && animationsFull) return;
    const base = quickSpec(tile.choice, inMoment);
    const settings = settingsOf(base);
    const spec = quickResult(base, settings);
    const index = added ? added.index : animations.length;
    const saved: SavedAnimation = { spec, presetId: tile.choice.id };
    onChangeAnimations(
      added
        ? animations.map((animation, at) => (at === index ? saved : animation))
        : [...animations, saved],
    );
    setAdded({ index, choice: tile.choice, base, settings });
    onPreviewSpec(spec);
    onCommit?.();
  }

  function chooseMoment(next: MotionMoment) {
    setMoment(next);
    const first = quickChoicesFor(next, choices, elementKind)[0];
    if (first) applyTile(first, next);
  }

  function changeSettings(settings: QuickSettings, preview: boolean) {
    if (!added) return;
    const spec = quickResult(added.base, settings);
    onChangeAnimations(
      animations.map((animation, at) =>
        at === added.index ? { spec, presetId: added.choice.id } : animation,
      ),
    );
    setAdded({ ...added, settings });
    if (preview) onPreviewSpec(spec);
  }

  /** A choice from the full catalogue: it takes the place of anything added just before. */
  function choose(choice: MotionChoice) {
    onStopPreview();
    const replacing = added !== null;
    setAdded(null);
    setMoment(null);
    const spec = animationSpecOf(choice);
    if (spec) {
      if (withoutAdded.length >= maxAnimations) return;
      onChangeAnimations([...withoutAdded, { spec, presetId: choice.id }]);
      onPreviewSpec(spec);
      onCommit?.();
      setView({ name: "animation", index: withoutAdded.length });
      return;
    }
    if (choice.kind === "preset") return;
    if (replacing) onChangeAnimations([...withoutAdded]);
    const { definition } = choice;
    const existing = effects.findIndex((saved) => saved.effect === definition.id);
    if (existing !== -1 || effects.length >= maxEffectsPerElement) {
      if (replacing) onCommit?.();
      setView(existing !== -1 ? { name: "effect", index: existing } : { name: "list" });
      return;
    }
    onChangeEffects([
      ...effects,
      { effect: definition.id, params: defaultProps(definition.params) },
    ]);
    onCommit?.();
    setView({ name: "effect", index: effects.length });
  }

  if (view.name === "add") {
    return (
      <div className="flex flex-col gap-2.5">
        <PanelBar onBack={() => go({ name: "list" })} />
        <h2 className="text-headline text-label">{t("motionEditor.panel.chooseTitle")}</h2>
        <QuickMotion
          moment={moment}
          tiles={moment ? quickChoicesFor(moment, choices, elementKind) : []}
          added={added}
          animationsFull={animationsFull}
          onMoment={chooseMoment}
          onTile={(tile) => {
            if (moment) applyTile(tile, moment);
          }}
          onSettings={changeSettings}
          onCommit={() => onCommit?.()}
          onMoreSettings={() => {
            if (added) go({ name: "animation", index: added.index });
          }}
          onMoreEffects={() => {
            onStopPreview();
            setView({ name: "catalogue" });
          }}
          onDone={() => go({ name: "list" })}
        />
      </div>
    );
  }

  if (view.name === "catalogue") {
    return (
      <AddMotion
        choices={choices}
        initialMoment={moment ?? "appears"}
        addedEffects={new Set(effects.map((saved) => saved.effect))}
        animationsFull={withoutAdded.length >= maxAnimations}
        isFull={effects.length >= maxEffectsPerElement}
        onBack={() => {
          onStopPreview();
          setView({ name: "add" });
        }}
        onChoose={choose}
        onTry={(choice) => {
          if (!choice) return onStopPreview();
          if (choice.kind === "preset") return onPreviewSpec(choice.preset.spec);
          const props = defaultProps(choice.definition.params);
          if (choice.definition.kind === "animation") {
            onPreviewSpec(effectAnimation(choice.definition, props));
          } else {
            onPreviewEffect(choice.definition, props);
          }
        }}
      />
    );
  }

  const editing = view.name === "animation" ? animations[view.index] : undefined;
  if (view.name === "animation" && editing) {
    const animation = editing;
    const index = view.index;
    const animationName = nameOf(animation);
    const replace = (next: SavedAnimation | null) =>
      onChangeAnimations(
        next
          ? animations.map((saved, at) => (at === index ? next : saved))
          : animations.filter((_, at) => at !== index),
      );
    const studioViews: StudioView[] = showsTimeline ? ["simple", "advanced"] : ["simple"];
    return (
      <div className="flex flex-col gap-3">
        <PanelBar onBack={() => go({ name: "list" })}>
          <PlayButton onClick={() => onPreviewSpec(animation.spec)} />
        </PanelBar>
        <h2 className="text-title text-label">{animationName}</h2>
        <MotionStudio
          key={`${index}:${animation.presetId ?? "custom"}`}
          initialSpec={animation.spec}
          initialPresetId={animation.presetId}
          initialView="simple"
          views={studioViews}
          openGroups={openGroups}
          onChange={(spec, presetId) => {
            replace({ spec, ...(presetId ? { presetId } : {}) });
            onPreviewSpec(spec);
          }}
        />
        {!showsTimeline && timelineNote && (
          <p className="px-2.5 text-caption text-label-secondary">{timelineNote}</p>
        )}
        <RemoveRow
          label={t("motionEditor.panel.remove", { name: animationName })}
          onRemove={() => {
            replace(null);
            onCommit?.();
            go({ name: "list" });
          }}
        />
      </div>
    );
  }

  if (view.name === "effect") {
    const item = known.find((entry) => entry.index === view.index);
    if (item) {
      return (
        <div className="flex flex-col gap-3">
          <PanelBar onBack={() => go({ name: "list" })} />
          <AppliedEffect
            definition={item.definition}
            saved={item.saved}
            onChange={(params) =>
              onChangeEffects(
                effects.map((saved, at) => (at === item.index ? { ...saved, params } : saved)),
              )
            }
            onRemove={() => {
              onChangeEffects(effects.filter((_, at) => at !== item.index));
              onCommit?.();
              go({ name: "list" });
            }}
            onTry={() => onPreviewEffect(item.definition, item.saved.params)}
            onCommit={onCommit}
          />
        </div>
      );
    }
  }

  const hasMotion = animations.length > 0 || known.length > 0;
  const playAll = () => animations.forEach((animation) => onPreviewSpec(animation.spec));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-headline text-label">
          {t("motionEditor.panel.title")}
          <span className="font-normal text-label-secondary"> · {name}</span>
        </h2>
        {animations.length > 0 && <PlayButton onClick={playAll} />}
      </div>

      {hasMotion ? (
        <>
          <ul
            aria-label={t("motionEditor.panel.list")}
            className="overflow-hidden rounded-card bg-background"
          >
            {animations.map((animation, index) => (
              <MotionRow
                key={`animation-${index}`}
                moment={momentOfSpec(animation.spec) ?? "appears"}
                name={nameOf(animation)}
                onOpen={() => go({ name: "animation", index })}
                onTry={() => onPreviewSpec(animation.spec)}
                onStopTry={onStopPreview}
              />
            ))}
            {known.map(({ saved, definition, index }) => (
              <MotionRow
                key={`${saved.effect}-${index}`}
                moment={momentOfEffect(definition)}
                name={definition.name}
                onOpen={() => go({ name: "effect", index })}
                onTry={() => onPreviewEffect(definition, saved.params)}
                onStopTry={onStopPreview}
              />
            ))}
          </ul>
          <p className="px-2.5 text-caption text-label-secondary">
            {t("motionEditor.panel.footnote")}
          </p>
          <button
            type="button"
            onClick={() => go({ name: "add" })}
            className="flex min-h-11 items-center gap-2.5 rounded-card bg-background px-2.5 text-start text-body font-medium text-label hover:bg-fill focus-visible:focus-ring"
          >
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-[7px] bg-fill-strong"
            >
              <Plus className="size-4" />
            </span>
            {t("motionEditor.panel.add")}
          </button>
        </>
      ) : (
        <>
          <div className="rounded-card bg-background px-4 pt-6 pb-4 text-center">
            <p className="text-headline text-label">{t("motionEditor.panel.emptyTitle")}</p>
            <p className="mt-1 text-footnote text-label-secondary">
              {t("motionEditor.panel.emptyBody")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => go({ name: "add" })}
            className="h-10 rounded-card bg-accent-fill font-semibold text-on-accent hover:bg-accent-fill-hover focus-visible:focus-ring"
          >
            {t("motionEditor.panel.add")}
          </button>
        </>
      )}

      {pageWeight && pageWeight.warnings.length > 0 && <PageWeightMeter weight={pageWeight} />}
    </div>
  );
}

function findPresetOrEffectName(
  id: string | undefined,
  presets: readonly MotionPreset[],
  registry: EffectRegistry,
): string | undefined {
  if (!id) return undefined;
  return (
    (presets.find((preset) => preset.id === id) ?? findPreset(id))?.name ?? registry.find(id)?.name
  );
}

function MotionRow({
  moment,
  name,
  onOpen,
  onTry,
  onStopTry,
}: {
  moment: MotionMoment;
  name: string;
  onOpen: () => void;
  onTry: () => void;
  onStopTry: () => void;
}) {
  const t = useTranslate();
  return (
    <li className="[&+li]:hairline-top">
      <button
        type="button"
        onClick={onOpen}
        onPointerEnter={onTry}
        onPointerLeave={onStopTry}
        onFocus={onTry}
        onBlur={onStopTry}
        aria-label={t("motionEditor.panel.edit", { name })}
        className="flex min-h-11 w-full items-center gap-2.5 px-2.5 py-1.5 text-start hover:bg-fill focus-visible:focus-ring"
      >
        <MomentTile moment={moment} />
        <span className="min-w-0 flex-1 truncate text-body font-medium text-label">{name}</span>
        <span className="shrink-0 text-footnote text-label-secondary">
          {t(`motionEditor.momentLabel.${moment}` as MotionEditorStringKey)}
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-label-tertiary" />
      </button>
    </li>
  );
}

function MomentTile({ moment }: { moment: MotionMoment }) {
  const Icon = momentIcons[moment];
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-[7px] text-white"
      style={{ backgroundColor: momentColours[moment] }}
    >
      <Icon className="size-4" strokeWidth={2} />
    </span>
  );
}

function PanelBar({
  onBack,
  backLabel,
  children,
}: {
  onBack: () => void;
  /** What the back button says; "Motion" (the list) when left out. */
  backLabel?: string;
  children?: ReactNode;
}) {
  const t = useTranslate();
  return (
    <div className="flex min-h-8 items-center">
      <button
        type="button"
        onClick={onBack}
        className="-ms-1.5 flex h-8 items-center gap-0.5 rounded-control pe-2 text-body font-medium text-label-secondary hover:bg-fill focus-visible:focus-ring"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {backLabel ?? t("motionEditor.panel.back")}
      </button>
      <div className="ms-auto">{children}</div>
    </div>
  );
}

function PlayButton({ onClick }: { onClick: () => void }) {
  const t = useTranslate();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 items-center gap-1 rounded-control px-2 text-footnote font-semibold text-accent hover:bg-fill focus-visible:focus-ring"
    >
      <Play aria-hidden="true" className="size-3.5" />
      {t("motionEditor.panel.play")}
    </button>
  );
}

function RemoveRow({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="mt-2 min-h-11 rounded-card bg-background text-body font-medium text-danger hover:bg-fill focus-visible:focus-ring"
    >
      {label}
    </button>
  );
}

interface AddMotionProps {
  choices: readonly MotionChoice[];
  initialMoment: MotionMoment;
  addedEffects: ReadonlySet<string>;
  animationsFull: boolean;
  isFull: boolean;
  onBack: () => void;
  onChoose: (choice: MotionChoice) => void;
  onTry: (choice: MotionChoice | null) => void;
}

/**
 * The full catalogue ("More effects…"): every preset and effect sorted into plain groups by
 * when it moves, with search across all of them.
 */
function AddMotion({
  choices: all,
  initialMoment,
  addedEffects,
  animationsFull,
  isFull,
  onBack,
  onChoose,
  onTry,
}: AddMotionProps) {
  const t = useTranslate();
  const [moment, setMoment] = useState<MotionMoment>(initialMoment);
  const [search, setSearch] = useState("");
  const searching = search.trim() !== "";
  const shown = searching
    ? searchMotionChoices(all, search)
    : all.filter((choice) => choice.moment === moment);
  const count = shown.length;
  const countText = searching
    ? count === 1
      ? t("motionEditor.panel.matchesOne")
      : t("motionEditor.panel.matchesOther", { count })
    : count === 1
      ? t("motionEditor.panel.countOne")
      : t("motionEditor.panel.countOther", { count });

  const groups: Array<{ key: string; choices: MotionChoice[] }> = [];
  for (const choice of shown) {
    const key = searching ? "results" : choice.group;
    const last = groups.at(-1);
    if (last?.key === key) last.choices.push(choice);
    else groups.push({ key, choices: [choice] });
  }

  return (
    <div className="flex flex-col gap-2">
      <PanelBar onBack={onBack} backLabel={t("motionEditor.panel.backToAdd")} />
      <h2 className="text-headline text-label">{t("motionEditor.panel.allTitle")}</h2>
      <label className="flex h-9 items-center gap-2 rounded-control bg-fill px-2.5">
        <Search aria-hidden="true" className="size-4 shrink-0 text-label-secondary" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("motionEditor.panel.search")}
          aria-label={t("motionEditor.panel.search")}
          className="min-w-0 flex-1 bg-transparent text-body text-label outline-none placeholder:text-label-secondary"
        />
      </label>
      {!searching && <MomentPicker value={moment} onChange={setMoment} />}
      <p className="px-2.5 text-caption text-label-secondary">
        {!searching && (
          <span className="block">
            {t(`motionEditor.momentNote.${moment}` as MotionEditorStringKey)}
          </span>
        )}
        <span role="status" className="block font-medium">
          {countText}
        </span>
      </p>
      {animationsFull && (
        <p className="px-2.5 text-caption text-warning">{t("motionEditor.panel.animationsFull")}</p>
      )}
      {isFull && <p className="px-2.5 text-caption text-warning">{t("motionEditor.panel.full")}</p>}
      {count === 0 && (
        <p className="rounded-card bg-background p-4 text-center text-footnote text-label-secondary">
          {t("motionEditor.panel.noMatches")}
        </p>
      )}
      {groups.map((group) => (
        <section key={group.key} aria-label={searching ? countText : groupName(t, group.key)}>
          {!searching && (
            <h3 className="mt-2 px-2.5 pb-1 text-footnote font-medium text-label-secondary">
              {groupName(t, group.key)}
            </h3>
          )}
          <ul className="overflow-hidden rounded-card bg-background">
            {group.choices.map((choice) => {
              const added = choice.kind === "effect" && addedEffects.has(choice.id);
              const isAnimation =
                choice.kind === "preset" || choice.definition.kind === "animation";
              const blocked = isAnimation ? animationsFull : isFull && !added;
              return (
                <li key={`${choice.kind}-${choice.id}`} className="[&+li]:hairline-top">
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => onChoose(choice)}
                    onPointerEnter={() => onTry(choice)}
                    onPointerLeave={() => onTry(null)}
                    onFocus={() => onTry(choice)}
                    onBlur={() => onTry(null)}
                    className={classNames(
                      "flex w-full items-start gap-2.5 px-2.5 py-2 text-start hover:bg-fill focus-visible:focus-ring",
                      blocked && "opacity-50",
                    )}
                  >
                    <MomentTile moment={choice.moment} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium text-label">{choice.name}</span>
                      <span className="line-clamp-2 block text-footnote text-label-secondary">
                        {choice.description}
                      </span>
                    </span>
                    {added && (
                      <span className="shrink-0 text-caption text-label-secondary">
                        {t("motionEditor.panel.added")}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function groupName(t: Translate, key: string): string {
  return t(`motionEditor.group.${key}` as MotionEditorStringKey);
}

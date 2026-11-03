import type * as RivePlayerFile from "../players/rive-player.js";
import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { combine, listen } from "../kit/listen.js";
import {
  addStage,
  animationAddress,
  besideModules,
  hasPoster,
  importPlayer,
  readPlayWhen,
  watchOnScreen,
} from "../kit/media-player.js";
import { readText } from "../kit/params.js";

/**
 * The Rive element: plays a .riv file from the media library with Rive's official web
 * runtime (`@rive-app/canvas-lite`, MIT). The runtime and its WebAssembly are separate
 * files, served beside the effect modules and fetched only when a Rive comes near the
 * screen; nothing is loaded from anyone else's servers.
 *
 * It plays the file's first state machine (or the one named), or else its first animation.
 * "Respond to" hover sets the state machine's switch (a boolean input, by name or the first)
 * while the pointer or keyboard focus is on it; click fires its trigger or flips its switch.
 * For less motion, the poster stays, or the first frame is drawn and held.
 */

/** The runtime's own numbers for a state machine's switches and triggers. */
const switchType = 59;
const triggerType = 58;

const rivePlayer: EffectBehaviour = (element, params, context) => {
  if (context.reduced && hasPoster(element)) return;
  const playWhen = readPlayWhen(readText(params, "play", "view"));
  const respondTo = readText(params, "respondTo", "none");
  const inputName = readText(params, "input", "").trim().toLowerCase();
  const wanted = readText(params, "stateMachine", "").trim();
  const address = animationAddress(readText(params, "src", ""), "sample-orbit.riv");
  const { stage, showStage, remove } = addStage(element, "canvas");
  const canvas = stage as HTMLCanvasElement;
  let stopped = false;
  const stops: Array<() => void> = [];

  void importPlayer<typeof RivePlayerFile>("rive-player.js")
    .then(({ Alignment, Fit, Layout, Rive, RuntimeLoader }) => {
      if (stopped) return;
      RuntimeLoader.setWasmUrl(besideModules("rive.wasm"));
      RuntimeLoader.setWasmFallbackUrl(null);
      const rive: InstanceType<typeof Rive> = new Rive({
        src: address,
        canvas,
        autoplay: false,
        layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
        onLoad: () => {
          if (stopped) return;
          rive.resizeDrawingSurfaceToCanvas();
          showStage();
          const machine = rive.stateMachineNames.includes(wanted)
            ? wanted
            : rive.stateMachineNames[0];
          const playing = machine ?? rive.animationNames[0];
          if (!playing || context.reduced) return;
          const play = () => rive.play(playing);
          // Read when needed: a state machine has no inputs until it is running, and it
          // only starts after this callback.
          const findInput = () => {
            const inputs = (machine && rive.stateMachineInputs(machine)) || [];
            return (
              inputs.find((candidate) => candidate.name.toLowerCase() === inputName) ??
              inputs.find((candidate) =>
                respondTo === "click"
                  ? Number(candidate.type) === triggerType || Number(candidate.type) === switchType
                  : Number(candidate.type) === switchType,
              )
            );
          };
          if (respondTo === "hover") {
            const set = (on: boolean) => () => {
              play();
              const input = findInput();
              if (input && Number(input.type) === switchType) input.value = on;
            };
            stops.push(
              listen(element, {
                pointerenter: set(true),
                pointerleave: set(false),
                focusin: set(true),
                focusout: set(false),
              }),
            );
          }
          if (respondTo === "click") {
            const press = () => {
              play();
              const input = findInput();
              if (!input) return;
              if (Number(input.type) === triggerType) return input.fire();
              input.value = !input.value;
              element.setAttribute("aria-pressed", String(input.value));
            };
            stops.push(
              listen(element, {
                click: press,
                keydown: (event: KeyboardEvent) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  press();
                },
              }),
            );
          }
          if (playWhen === "load") play();
          stops.push(watchOnScreen(element, (visible) => (visible ? play() : rive.pause())));
        },
      });
      const resize =
        typeof ResizeObserver === "function"
          ? new ResizeObserver(() => rive.resizeDrawingSurfaceToCanvas())
          : undefined;
      resize?.observe(element);
      stops.push(() => {
        resize?.disconnect();
        rive.cleanup();
      });
    })
    // A missing or broken file, or no WebAssembly, leaves the poster in place.
    .catch(() => undefined);

  return combine(() => {
    stopped = true;
    stops.splice(0).forEach((stop) => stop());
    remove();
  });
};

export const behaviours: EffectModule["behaviours"] = { rivePlayer };

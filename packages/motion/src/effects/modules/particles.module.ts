import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readColour, readNumber, readText } from "../kit/params.js";
import { createSurface } from "../kit/surface.js";

/**
 * A field of drifting particles behind the element's content that moves away from the
 * pointer, gathers towards it, or joins up into a web. Plain 2D canvas: no WebGL needed.
 * Phones get half as many particles; with less motion asked for, one still frame is drawn.
 * The element's own background shows until (and wherever) the canvas can't draw.
 */
const particleField: EffectBehaviour = (element, params, context) => {
  const surface = createSurface(element, context);
  const drawing = surface.canvas.getContext("2d");
  if (!drawing) return surface.remove;
  const count = Math.round(readNumber(params, "count", 70) * (context.lowPower ? 0.5 : 1));
  const colour = readColour(params, "colour", "#7539fd");
  const mode = readText(params, "mode", "repel");
  const size = readNumber(params, "size", 2.2);
  const speed = readNumber(params, "speed", 0.3);
  const particles = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * speed,
    vy: (Math.random() - 0.5) * speed,
  }));
  let pointer: { x: number; y: number } | undefined;
  const draw = (elapsed: number) => {
    const { width, height, ratio } = surface;
    drawing.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawing.clearRect(0, 0, width, height);
    drawing.fillStyle = colour;
    drawing.strokeStyle = colour;
    for (const particle of particles) {
      if (!context.reduced) {
        if (pointer) {
          const dx = particle.x * width - pointer.x;
          const dy = particle.y * height - pointer.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance < 140) {
            const push =
              ((mode === "attract" ? -1 : 1) * (1 - distance / 140) * 0.9) /
              Math.max(width, height);
            particle.vx += (dx / distance) * push * elapsed;
            particle.vy += (dy / distance) * push * elapsed;
          }
        }
        particle.vx *= 0.985;
        particle.vy *= 0.985;
        particle.x += (particle.vx * elapsed) / 1000 + (speed * 0.02 * (Math.random() - 0.5)) / 60;
        particle.y += (particle.vy * elapsed) / 1000;
        particle.x = (particle.x + 1) % 1;
        particle.y = (particle.y + 1) % 1;
      }
      drawing.beginPath();
      drawing.arc(particle.x * width, particle.y * height, size, 0, Math.PI * 2);
      drawing.fill();
    }
    if (mode === "web") {
      drawing.lineWidth = 0.6;
      particles.forEach((one, index) => {
        for (let other = index + 1; other < particles.length; other += 1) {
          const two = particles[other]!;
          const distance = Math.hypot((one.x - two.x) * width, (one.y - two.y) * height);
          if (distance > 110) continue;
          drawing.globalAlpha = 1 - distance / 110;
          drawing.beginPath();
          drawing.moveTo(one.x * width, one.y * height);
          drawing.lineTo(two.x * width, two.y * height);
          drawing.stroke();
        }
      });
      drawing.globalAlpha = 1;
    }
  };
  draw(0);
  if (context.reduced) return surface.remove;
  const loop = createFrameLoop(element, (elapsed) => (draw(elapsed), true));
  return combine(
    listen(element, {
      pointermove: (event: PointerEvent) => {
        const box = element.getBoundingClientRect();
        pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
      },
      pointerleave: () => (pointer = undefined),
    }),
    () => loop.destroy(),
    surface.remove,
  );
};

export const behaviours = { particleField };
export default { behaviours } satisfies EffectModule;

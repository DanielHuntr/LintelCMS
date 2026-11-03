/**
 * The trail behind the site cursor ("dots", "line" or "comet"), drawn on a canvas: by the
 * site's cursor module, and by the cursor settings' "Try it" sample, so both look the same.
 */

/** Where the pointer was, and how far it has faded: 0 just now, 1 gone. */
export type TrailPoint = { x: number; y: number; age: number };

export function drawTrail(
  context: CanvasRenderingContext2D,
  points: readonly TrailPoint[],
  kind: string,
  colour: string,
  size: number,
) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.fillStyle = colour;
  context.strokeStyle = colour;
  context.lineCap = "round";
  points.forEach((point, index) => {
    const life = 1 - point.age;
    if (life <= 0) return;
    context.globalAlpha = life * (kind === "comet" ? 0.6 : 0.45);
    if (kind === "line" || kind === "comet") {
      const previous = points[index - 1];
      if (!previous) return;
      context.lineWidth = kind === "comet" ? size * life : 2;
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    } else if (index % 3 === 0) {
      context.beginPath();
      context.arc(point.x, point.y, (size / 4) * life, 0, Math.PI * 2);
      context.fill();
    }
  });
  context.globalAlpha = 1;
}

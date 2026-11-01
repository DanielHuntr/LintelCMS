# Easing

`easing.ts` turns a spec's easing into a CSS timing function (`easingToCss`) or a number for a
moment in time (`evaluateEasing`), from the same definitions so the editor draws what plays.
`cubicBezier.ts` solves Bézier curves; `spring.ts` solves damped springs in closed form and
finds how long they take to settle.

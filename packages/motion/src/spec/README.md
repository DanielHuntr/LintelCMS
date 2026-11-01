# Spec

The animation spec's shape, as Zod schemas: `motion.schema.ts` (the spec, tracks, targets),
`trigger.schema.ts` and `easing.schema.ts`. Types are inferred from them; the runtime imports
only the types, so published pages never download Zod. `properties.ts` lists every property a
track can animate and which CSS property it writes. Only properties that don't cause layout
are allowed.

# Keyframes

`buildKeyframes.ts` turns tracks into Web Animations keyframes, one set per CSS property.
Tracks that share a CSS property (translateX and translateY both write `translate`) are
composed by `composeGroup.ts`; if their keyframes don't line up they are sampled together
(`sampleTrack.ts`), because a CSS keyframe's easing applies to all of it. `values.ts` reads
numbers with units.

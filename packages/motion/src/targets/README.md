# Targets

`resolveTargets.ts` finds the elements an animation moves: itself, its children, a selector,
builder nodes by id, or its text split into words or letters (`splitText.ts`, which keeps a
readable copy for screen readers and restores the original on destroy). `stagger.ts` works out
each target's delay.

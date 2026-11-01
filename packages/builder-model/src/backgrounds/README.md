# Backgrounds

Picture and gradient backgrounds are ordinary styles (`backgroundImage` and friends, see
`styles/background-layers.ts`). A video can't be a style, so it is a setting on the node,
`backgroundVideo`: its address, a poster picture and a colour overlay. The renderer draws it
as a muted, looping, decorative video behind the content, with a pause button, and it never
plays for people who ask for less motion.

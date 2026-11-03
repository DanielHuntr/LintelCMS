# samples

Lintel's own small sample animations, so a new Lottie or Rive element shows something
moving before a site has a file of its own. Both are made by the scripts beside them, from
scratch, and are free to use like the rest of Lintel.

| File                     | What it is                                                                   |
| ------------------------ | ---------------------------------------------------------------------------- |
| `make-sample-lottie.mjs` | Writes `sample-hop.json`: three dots hopping one after another               |
| `make-sample-rive.mjs`   | Writes `sample-orbit.riv`: a circle with a dot circling it, quicker on hover |

The Rive sample is written field by field in Rive's runtime format. Its state machine is
called "Hover" and has one switch, "hover", which the Rive element's "Responds to: the
pointer over it" turns on and off.

`scripts/effect-modules.mjs` copies both beside the effect modules with fingerprints in
their names. After changing a script, run it (`node samples/make-sample-lottie.mjs`) and
commit the file it writes.

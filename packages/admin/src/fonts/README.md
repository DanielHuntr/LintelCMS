# Fonts

The admin uses the system font everywhere except page titles, which are set in Schibsted
Grotesk (extra-bold, 800) so they look the same on Windows and Mac. It comes from the
`@fontsource/schibsted-grotesk` package and is bundled with the admin; nothing is loaded
from another server. `styles.css` imports it and names it `--font-display`.

| File                        | What it is                                 |
| --------------------------- | ------------------------------------------ |
| `schibsted-grotesk-OFL.txt` | Its licence, the SIL Open Font License 1.1 |

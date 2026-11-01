# Screens

Steps several journeys share, written the way a person would describe them:
`startEntry(page, "posts", title)`, `expectSaved(page)`. They find things by role and
visible name only. Keep each helper small; a journey should still read top to bottom.

`setup-wizard.ts` holds every selector for the setup wizard (`setupScreens(page)`) and the
two steps through it (`createOwnerAccount`, `chooseSiteAndFinish`). The first-run journey,
the keyboard-only test and the accessibility checks all use it, so a change to the wizard's
screens means changing this one file.

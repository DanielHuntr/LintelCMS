# Skill levels

**Tools** in the toolbar: Beginner, Designer or Developer, remembered on the device
(`preferences/`). `toolsFor(level, canEditCode)` says what each shows:

| Level     | Advanced styles | Animation timeline | Code tools               |
| --------- | --------------- | ------------------ | ------------------------ |
| Beginner  | no              | no                 | no                       |
| Designer  | yes             | yes                | no                       |
| Developer | yes             | yes                | with `builder:code` only |

Developer replaces the old Developer mode switch; without the permission it can't be
chosen, and a stored Developer falls back to Designer.

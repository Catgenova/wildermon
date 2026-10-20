# Working on this repo

- Always commit and push directly to `main`. Do not create feature branches or pull requests unless asked.
- Always deploy to live. After every push to `main`, dispatch the Island workflow (`island.yml`) on
  `main` with `live: true`, `found: false` and `reconcile: off`, without being asked. It pushes the
  migrations to the Supabase project and plays on the real island. Never start one while another
  live run is still going.
- **The island is the only game.** There is no single-player mode and no offline fallback: no
  `?alone`, no saves in the browser, no game that runs without the database. A page that cannot
  reach the island says so and offers Retry. Build, test and describe every feature for the island
  only: no "in a game of your own" code paths, checks, help or What's new lines. The rules in
  `src/game` are there to show the island's game (menus, refusals, descriptions); do not extend
  them into a game the browser runs by itself.
- GitHub Pages serves `main` from the repository root. `index.html` and `assets/` at the root are
  generated: run `npm run build` (typecheck + bundle + copy to root) before committing and commit
  the regenerated files together with the source change. Edit `src/index.html`, never the root one.

## Text the player reads

- **State the exact benefit. No flavour text.** Every description of a class, a
  channel, a tree node, a rite or anything else with a number behind it says
  what it changes and by how much, in the game's own terms: "Time per action,
  on carpentry and fletching" rather than "Less measuring, fewer passes."
  Prose that sets a mood instead of naming a mechanic is worse than nothing —
  somebody is reading it to decide how to spend a point.
- Where the number can be derived, derive it rather than writing it out, so
  the text cannot drift from the rule it describes.
- **No prose.** Labels, not sentences: "Boat row speed", not "A boat under
  oars." Game text names the thing and its number and stops. No scene-setting,
  no narration of what a creature or a person does, no clauses explaining why
  a rule exists.

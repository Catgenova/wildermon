---
name: rework-asset
description: Rework one of the game's visual assets (a piece of furniture, a station, a creature, the player, a tree, a flower, a spell, the ground or the sky) into the island's established aesthetic with the asset studio (tools/studio), including its moving parts, and judge it. Use when asked to redo, restyle, polish or rework an asset or a family of assets, or to bring something into the rune pastel kit.
---

# Reworking an asset

The island's look is written down in `docs/aesthetic.md` (the rules, the two registers, the references in `docs/aesthetic/`) on top of the rune pastel kit (`docs/kit-pieces.md`, `src/render/kit/core.ts`, `src/render/runestone.ts`). The asset studio (`tools/studio/`) draws any asset as the game draws it, every view, zoom, state, variant and frame of motion, and checks it against those rules. Nothing visual ships until the user says "ship it".

## 1. Find it in the catalogue

```
node tools/studio/shot.mjs --list                 # every asset: family:kind, style, views, states, variants, moving parts, entry, file and lines
node tools/studio/shot.mjs --list furniture       # one family
```

Each line says how it is drawn today — `kit` (already in the rune pastel kit), `model` (a posed rig: creatures, the player, solid trees), `old` (a box model in `MODELS`), `flat` (a painted sprite), `scene` (drawn only from inside the renderer: walls, floors, water, ground) — and its register: `line` (ligne claire: figures, creatures, things you use) or `paint` (the world). A `scene` asset is seen on the `world` family's strips (`world:terrains`, `world:meadow`, `world:shore`, `world:rock`).

## 2. Keep the baseline

```
node tools/studio/shot.mjs furniture:chair --baseline      # tmp/studio/furniture-chair.png, kept under tmp/studio/baseline/
```

The baseline is what the rework is judged against even after the old code is gone. Look at the sheet: the views by day and night, the states, the variants, every motion strip, and the checks at the foot.

## 3. Read the family's exemplars and docs

- Furniture, stations, stores: `docs/kit-pieces.md`; exemplars `src/render/kit/chair.ts`, `src/render/kit/chest.ts`; the smith's pieces `src/render/forge.ts`; the beds `src/render/dens.ts`.
- Runestone pieces: `src/render/runestone.ts` (the palette, `drawFaces`, glows and motes), `deedtotem.ts`, `runelantern.ts`, `runegate.ts`, `memorial.ts`.
- Creatures: `.claude/skills/new-wildermon-line/SKILL.md`; `src/render/beasts.ts` (tube, taper, ball, `coatPalette`, `pastel`), the latest lines (`wild-churn.ts`, `wild-deer.ts`, `wild-brewtoad.ts`, `wild-slag.ts`) and their clipping audits (commits `cd8852a6`, `4f9e06ee`).
- The player: `src/render/figure.ts` header, `render`, `drawFigure`; gear in `dress`/`partsOf`; the player-model exploration branches `player-paint`, `player-cloth`, `player-pipeline` and the figure studio `tools/figure/` when merged.
- Trees and bushes: `src/render/trees3d/` (skeleton, paint, light, species), `src/render/trees/`.
- The world: `src/render/renderer.ts`, `sky.ts`, `nightwash.ts`, `water.ts`, `shore.ts`, `masonry.ts`, `roofing.ts`, `flooring.ts`.

Hold the asset against its reference (`docs/aesthetic/`, by family: the player 07, creatures 06, foliage and trees 02 and 04, stone and masonry 02 and 04, the world 01) and any picture the user gives (`--ref some.png`).

## 4. Model it

- **Units.** Tenths of a metre: `x` across to its right, `y` toward its front, `z` up; the origin on the floor at the middle of its footprint (a piece) or between its feet (a body).
- **Register.** Ligne claire for a thing or a body: one even line in a deep hue of its own colour round the silhouette and along creases, flat local colour, one shadow shape and one highlight shape per surface, a faint grain at most. Painted for the world: broken colour, massed foliage, faint or no line, atmosphere.
- **Colour.** Base in the kit's pastel (`pastel()`, `coatPalette`, the kit's `Tone`s); the splash — blossom, emissives, prints, trims, a crest — fully saturated and a tenth of the area or less. Shadows a hue shift, highlights tinted, ink `darker()` toward DUSK, never `#000` or `#fff`.
- **Light.** The key from over the viewer's left shoulder: the left of two faces paler. Emissives unlit by the key, alive at night, throwing a small pool.
- **Parts and order.** Faceted solids, each inked round as one; split a part that passes through another; `after` only for what lies on a face. Nothing drawn outside the box the piece declares.
- **Moving parts.** Keep every motion it had and add what the reference shows: `live` for what is drawn over the bake each frame, `flicker` for fire in baked frames, `wind` for cloth, wheels for what rolls, a breath, a sway, a glow that breathes. A body's acts (`strike`, `work`, `cast`, `evolve`) each pose the rig.
- **Variants.** Dyes (`tint`), woods and metals (`material`), states (`trim`), layers, seasons, stages, subspecies: the sheet shows each; model each.

## 5. Sheet, check, iterate

```
node tools/studio/shot.mjs furniture:chair                 # the sheet, with the checks printed and at its foot
node tools/studio/shot.mjs furniture:chair --check         # the checks alone
node tools/studio/shot.mjs furniture:chair --compare       # baseline | current | difference
node tools/studio/shot.mjs furniture:chair --bench         # ms fresh, kept, and twenty of it
node tools/studio/shot.mjs creature:rabba --facings 1,3 --zooms 1,2,4 --mag 3 --frames 8
node tools/studio/shot.mjs world:meadow --hours 6,9,13,17,19,22 --seasons summer,winter
```

The checks, by name:

| Check | Holds when |
| --- | --- |
| `no-black`, `no-white` | no pure black or pure white pixels |
| `ink-own-colour` | the darkest 4% keep saturation (a deep hue, not grey) |
| `base-pastel`, `base-colour` | the body's mid-tones in `pastel()`'s range; little darker than slate; chalk's saturation at least |
| `splash-bounded`, `splash-present` | saturated colour a tenth or less of the body, and present where the family expects a splash |
| `shadow-coloured`, `highlight-tinted` | the darker third keeps saturation; the brightest tenth is not grey-white |
| `silhouette-inked` (line) / `silhouette-soft` (paint) | the outside edge is ink round a thing; little or none round the world |
| `lit-from-left` | the left of the body paler than the right (things; the world is lit by the sun's hour) |
| `mottle-grain` (line) / `mottle-painted` (paint) | inside the facets, read close up: flat with a faint grain, or broken colour |
| `night-washed`, `emissive-at-night` | darker and bluer under the wash; what is emissive still bright and coloured through it |
| `motion-<id>` | each motion's frames differ (an optional move a kind lacks is no fault) |
| `box-declared` | nothing drawn past the box the draw returned |
| `kept-matches-drawn` | the kept picture and the live path agree (the clipping tools/bodies.ts catches) |
| `size-as-game`, `size-px` | its height at zoom one against what the game says of it |

A failing check names its cell. Iterate until every check holds or is understood, and rate the sheet out of ten against its exemplars and reference on: silhouette at zoom 1, palette, coloured shadow and tinted highlight, facet mottle, ink, emissives at night, motion kept. Nine or better before it is shown. For a body, audit the clipping on all eight facings and every pose at the game's camera, from above and at eye level (as `cd8852a6` did).

## 6. Tests, build, branch

- Run the tests that cover the family against the local database (`scripts/test-island.sh` first): `bodies` (tools/bodies.ts, cache against path), `wildlines` and `repurpose` for a line, `heard` for a new timed action, `permissions` for a new rpc, and whatever lists the kind.
- `npm run build` must exit 0; check `$?`.
- Work on a branch in a worktree; commit explicit paths only; never `git stash` or amend. The island and the browser must agree: a change to what the island knows of an asset (names, stages, a trade) is a migration too (`new-wildermon-line`).

## 7. Ship

Only when the user says "ship it": merge into `main` (generated files: `git checkout --ours index.html account.html wildermon.html assets/`, then `npm run build` and `node scripts/sri.mjs --check`), push, dispatch `island.yml` with `live: true, found: false, reconcile: off` — never while another live run is going — and schedule a check-in about 40 minutes out.

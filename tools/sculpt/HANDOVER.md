# Sculpt work: task memory (read this first in a fresh context)

Branch: `sculpt-all`. Updated only when the user asks for a handover.

## Standing rules (user's)
- Work one task at a time in the main thread. No subagents unless the user asks for them.
- Sculpt work stays on branches; nothing ships until the user says "ship it". (CLAUDE.md's main/deploy rule applies to
  game code on main only.)
- Show every stage: send PNGs/GIFs (under 8000 px) via SendUserFile. Judge joins and gaps by measurement, not small thumbnails.
- Drawings over spec numbers. Close fit, no puffiness. Thick materials. Don't invent dark parts.
- Triangles uncapped. No new bones (limit 80). Materials: MAX_MATS is now 128.
- Never git stash or amend, never force-push. Commit explicit paths. End every commit with the Co-Authored-By and
  Claude-Session trailers.
- Python PIL is broken system-wide; use the venv at `$SCRATCH/venv/bin/python`. If it's gone after a reset, recreate it:
  `python3 -m venv $SCRATCH/venv && $SCRATCH/venv/bin/pip install pillow`.
- The scratchpad and the worktrees get wiped by container resets. Recreate a worktree with
  `git worktree add .claude/worktrees/<b> -B <b> origin/<b>`, then `ln -s /home/user/Wurm/node_modules node_modules`.
  Reference sheets kept only in the scratchpad are lost; the ones in `tools/sculpt/ref/` survive.

## Live game (main)
- Telestone "Travel back" (main 61de1892) is live: run 42911871000 succeeded 23:05 UTC 11-10.
- catgenova was mended to (3558, 937) via mend.yml (run 42908830521, success).

## Queue (the user's order; leather chest last)
1. DONE. Shawl corrective shapes ported to the many-garment bake.
   - sculpt-all 13c93fd7: gl.ts shapes texture, lowpoly.ts poseIn/driveOf/shapeWeights, Baked.shapes.
   - lowgarmentcheck passes.
2. DONE (accepted). His plate chest crossings.
   - The user accepted about 24 collar×trapezius crossings as invisible; the armpit under-layer is left as is.
   - Hiding the skin opened gaps, so that trial was reverted. Final is sculpt-plate-chest 67b9e816 (r5).
3. IN PROGRESS. Fur mantle, sculpt-plate-mantle 29469556.
   - Her: walk and idle 0 against body, chest, itself and the helm.
   - His weights (cca30c71): chestSurf "radial", collarArm 0, chestMargin 0.14, chestSmooth 3 (user's choice over 1).
   - His ring lowered at the back and sides, top 0.12/0.20/0.04 (user's choice), chestClear 0.07 (b7bed9da).
   - Her collar opened at the front: from 44, len 0.4 at 34 / 0.7 at 66, front lean 60 (user's choice, 2b106a91).
   - The swing vs the helm (user's choices, 29469556): his collar from 40, len 0.8 at 34, lean [30,77,60] (the back's
     tufts lie lower); her back lean 65 and collarFollow {neck 1, p 0.6, az [150,180], fade 40} (mantleWeights: the
     collar's tips onto neck_01 / off the clavicles, by height in the clump, within an azimuth window).
   - Now vs the helm: him swing 12 (collar#4/#5 × back, 1.92), idle turnnod 8, nod40 ring × visor ~110-120 (test pose);
     her swing 18 (1.83), head turns 6-30 (collar#0 × visor). Self/chest: his walk 0 self / 22 chest, idle one key at 4
     self; her walk and idle 0. His swing's body crossings rose (top 446, impact 347) and its chest sum 2940 -> 3221.
   - Tried and dropped: a blurred weight field, one weight set per clump, a wider gap/gapArm, tier-follow weights;
     weights-only for his swing (collar front x mid1 crossings up), a neck share on his back.
   - Tools:
     - `node tools/sculpt/garments/mantle.mjs` rebuilds the mantle.
     - `node tools/sculpt/lowmantleshot.mjs --out DIR --only metrics|poses --tag -x [--design '{...}']` (DIAG=1, DIAG2=<n>:
       n 1 rest, 2-4 test poses, 5-12 walk, 13-24 idle).
     - `node tools/sculpt/lowmantlehelm.mjs --helm <root> [--who male] [--design ...]` (CLUMP=1); the root from
       `git archive origin/sculpt-plate-helm src tools package.json`, node_modules linked.
     - `node tools/sculpt/lowmantlehelmshot.mjs <helm root> <out.png> [designs] [times]`: close-ups with the helm.
     - Design numbers: tools/sculpt/lowmantle-design.json (edit textually, keep its layout; --design applies to both bodies).
   - Next: zoom-10 game renders.
   - The mantle sheet was lost (`--sheet` needs a re-upload).
4. TODO. Cloth hood refit, sculpt-outfit f637edca.
   - The hood still crosses the body and the tunic in the idle and walk.
   - His best REFIT table is parked: hood-body 0/36 and hood-tunic 90, but the hood crosses itself in 16 places.
     The chin teeth were then keyed.
   - The head-turn collar/cowl "sandwich" is a known hard case.
   - Then merge origin/sculpt-feet 07ebb07d, run lowgarmentcheck with the hood up and down, then lowbackcheck, then
     the final renders.
   - lowoutfitgame needs `moving: true` for walk renders.
   - The cloth glow's hood (sculpt-cloth-glow 64dde598) must be re-merged afterwards.
5. TODO. Leather shawl, sculpt-leather-shawl c88f1a80.
   - Its look is approved.
   - Author arm-driven corrective shapes like the cloth shawl's (tools/sculpt/garments/shawlshapes.mjs is the
     pattern; the engine is now in sculpt-all).
   - Swing crossings to clear: about 1000 (guard+top+impact), plus 243 for his overhead.
   - Then stage 8 (tools/sculpt/lowleathershawlgame.mjs).
   - Refit over the final leather chest later; --under widened its corners by 0.4, so show the user before and after.
6. LAST. Leather chest & arms (target 10/10), sculpt-leather-chest 372a874d.
   - The s3b shape round is built but not rendered. Scores were 3–4.
   - Fit it over the leggings' cloth and waistband: sculpt-leather-legs 28268e3f. The flaps are a separate garment,
     hidden under the chest (user-approved).
   - Critique to address:
     - render at the sheet's framing;
     - colour split: leather on the sleeves, collar and base; light on the plates;
     - separate thick plates with gaps;
     - 2–3 pauldron lames;
     - straight tassets with no flare;
     - a belted waist;
     - a taller collar;
     - a close fit;
     - her bust and side;
     - slim sleeves.
   - Hold at the shape stage until every view scores at least 7.
   - Remaining crossings: walk 108 (him) / 74 (her), idle 86 / 57.

## Done and approved (merged into sculpt-all unless noted)
- Cloth outfit glow, sculpt-cloth-glow 64dde598: shawl teeth and emblem, tunic cuffs and collar, trouser stripes,
  boot X straps, hood teeth. The user said: "Clothes look great".
- Braid, sculpt-hair2 0e4e15d2: "Braid done". `tools/sculpt/lowbraidgaps.mjs` measures its joins.
- Leather hat bc095232, boots a6c6a3a5, leggings 28268e3f; leather shawl look (not finished, see 5).
- Plate helm, legs, boots, chest r5; the swing ba977eba (sculpt-anim).
- Known limits the user accepted:
  - the hat brim at the swing's top;
  - her elbow in the swing's drag;
  - his plate collar crossings.

## sculpt-all (integration)
- Merges outfit, anim, hair, hair2, plate (helm, legs, boots, chest, mantle@2f4097e1) and leather (boots, legs@0bebaf2b, hat, shawl).
  - Re-merge the later heads: mantle 29469556, legs 28268e3f flaps.
- 128 materials. The first outfit's pieces give way to the sets' (lowpoly.ts `o(pose)` hooks).
- The leather chest isn't merged yet.
- The merge resolver script for lowpoly/figure conflicts (keep ours, add theirs' GARMENTS entries, imports and wear
  hooks) lived in the scratchpad as res.py; rewrite it if needed.

## Settled leather colours (kind 2 unless noted)
- dark [0.29,0.157,0.129]
- leather [0.416,0.224,0.176]
- light [0.533,0.286,0.22]
- trim [0.91,0.518,0.282]
- rune: plain = trim; enchanted = glow
- glow [0.996,0.792,0.427] kind 1

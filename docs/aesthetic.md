# The island's aesthetic

The look every asset is reworked toward. The references are in `docs/aesthetic/`
(the user's, downscaled); the rules below are what they have in common, written
as things a model, a palette or a painter can be checked against. The rune pastel
kit (`docs/kit-pieces.md`, `src/render/kit/core.ts`, `src/render/runestone.ts`) is
the foundation: faceted solids, lit from over the viewer's left shoulder, inked
round in a dark of their own colour, chalk and pastel colour. These references
push it further: painterly, saturated, luminous, textured.

## References

| File | What to take from it |
| --- | --- |
| `01-forest-grove-and-night-shore.jpg` | Forms built from chunky knife strokes. Coloured shadow (teal, plum, indigo), never grey. Cyan luminous accents (stars, crescent, runes) against a dusk of blue-violet. |
| `02-village-paddies-and-arch.jpg` | Foliage as clumps of leaf-shaped facets in two or three values. Warm roofs (terracotta, coral) against cool greens. Lilac sky, mint water. Patchwork cloth on a figure. The arch: rock as big faceted planes with mossy pink-violet tops. |
| `03-crystal-knight-in-the-glade.jpg` | A figure read by silhouette; its detail is in facets of colour, not line. Light splits into hue: lemon, cyan, magenta on one surface. Dappled light as hard-edged patches. |
| `04-mossy-walker-and-cottage.jpg` | The palette: teal, lilac, violet, magenta, pink, mint, gold. Metal and stone in cool violets, lit edges in gold. Blossom and moss as massed pink-violet clumps. Sky with soft swirl texture. A cottage with a coral roof. |
| `05-mosaic-herald.jpg` | Mosaic and patchwork as texture: a cloth or a ground as tiles of related hues. Gold used for trims, edges and glints only. Backgrounds of broken colour, not flat. |
| `06-moldling-gate.jpg` | A glowing creature (magenta-gold) and its light trail over a cool scene. Overgrown stone, hanging roots, scattered motes of light. |
| `08-male-body-proportions.jpg` | The male body: proportions and masses for every sculpted man. About 7.5 heads; broad shoulders over a narrow waist, a defined chest, abdomen and back, lats, round deltoids, forearms and calves that taper to the joints, hands and feet at full size. Low-poly in the picture; the sculpt is smooth with these masses. |
| `07-player-poncho-sheet.jpg` | The player at full detail: hooded printed poncho with tassels, brass clasp, strap and pouches, bracer and boots with glowing strips, swept chunky hair, a lit face with irises and a smile. A slight pixel grain. |

## The painting: as in Scavengers Reign

The references' colour and mood, painted the way that series is. Two registers,
kept distinct:

- **Figures, creatures, things you use** (the player, wildermon, monsters,
  furniture, tools, devices): *ligne claire*. One clean line of even weight round
  the silhouette and along every crease, a deep hue of the thing's own colour,
  never feathered or sketchy. Inside the line, flat local colour broken only by
  one shadow shape and one highlight shape per surface, each a hard-edged patch
  in a shifted hue. Facet mottle is faint here (a grain, not a stroke), so the
  shape reads first.
- **The world they stand in** (ground, water, sky, cliffs, trees, bushes,
  distance, weather): painted. Soft airbrushed gradients in sky and water,
  textured broken colour on ground and rock, foliage as massed strokes with a
  few drawn leaves at the edge for scale, no outline or a faint one. Depth by
  atmosphere: far things lose contrast and drift toward the sky's hue.

Across both: the kit's pastel as the base (`pastel()`: chalk greens, dove and
lilac greys, caramel browns, nothing darker than slate), with vibrant colour kept
for splashes; a sky that grades across the day (gold dawn, pale cyan noon, salmon and
lilac dusk, indigo night) and tints everything under it; bioluminescence as the
night's light, in cyan, magenta and gold; organic forms, with stone and plant
growing into one another. Restraint: a scene is three or four hues and their
neighbours, with one accent.

This covers the whole island: the ground, the sky, the water, the night wash and
the weather are assets to be reworked like any other, under a `world` family in
the studio.

## Rules

**Colour.**
- **Base: the rune pastel kit's palette, unchanged.** Every large surface -- ground, stone, wood, coat, cloth, sky -- stays in `pastel()`'s range: chalk and pastel, browns warmed to caramel, greys tinted dove, lilac or slate-blue, nothing darker than slate. This is what the references share with the kit, and it is the ground the splashes sit on.
- **Splash: vibrant colour as contrast and energy, in small areas.** Blossom and moss masses, emissives (runes, strips, gems, motes, trails), prints and trims, a creature's crest or markings, a roof, a flower: fully saturated teal, cyan, magenta, pink, coral, gold. A splash is a tenth of an asset's area or less and never the whole of it; a scene has one or two.
- Hues for both: teal, cyan, mint, lilac, violet, magenta, pink, coral, gold, ochre.
- Shadows are a colour, not a darker grey of the surface: a cool hue shift (teal, plum, indigo) at least as much as a drop in lightness.
- Highlights are tinted: lemon on warm surfaces, cyan or pink on cool ones. Lit edges of metal and stone are gold.
- Pure black and pure white do not appear. Ink is a deep hue of the surface's own colour (`darker()` toward DUSK, never `#000`). The brightest point is a tinted off-white.
- Night is a wash of blue-violet with cyan emissives, as the kit's `NIGHT_WASH` and runes already do.

**Form.**
- Faceted: every surface is planes with hard edges between them. Rounded things are many small facets, not gradients.
- Within a facet, broken colour: a stipple or mottle of two or three close values of its colour, scaled to the facet so it reads as paint at zoom 1 and as grain close up. Never a smooth gradient across a facet.
- Silhouette first: an asset reads at the game's zoom (figure ~40 px/m) by its outline and its two or three biggest colour masses. Detail is added in accents (trim, glint, glow), not in more lines.
- Ink: a thicker line round the silhouette, a thin crease where parts meet, nothing inside a facet.

**Light.**
- One key light from over the viewer's left shoulder (the kit's rule); the left of two faces is paler.
- A cool fill from the sky on upward faces; warm bounce on downward faces near the ground.
- Emissive materials (runes, strips, gems, motes, the creature's trail) are unlit by the key, keep their colour at night and throw a small pool of their colour.
- Dappled light, where used, is hard-edged patches, not blur.

**Texture and pattern.**
- Cloth may carry a print: patchwork, mosaic, a sigil, a striped border, as tiles of related hues (`Pattern`, decals, or a mapped print).
- Stone and bark carry their facet mottle and moss in massed clumps on their tops.
- Foliage is clumps: each clump a few leaf-shaped facets in two or three values, pink-violet where it blossoms.

**Motion.**
- Moving parts move: cloth and tassels swing, flames flicker in baked frames, wheels turn, water and glow breathe. A reworked asset keeps every animation it had and adds the hang, sway or flicker its reference shows.

## How a rework is judged

Rendered on the asset studio (`tools/studio/`) at the game's zooms, day and night,
every view and every animation frame, beside its exemplars and its reference, and
rated out of ten on: silhouette at zoom 1, palette within these rules, coloured
shadow and tinted highlight, facet mottle present, ink a dark of its own colour,
emissives alive at night, motion kept. Nine or better before it is shown; nothing
ships until the user says "ship it".

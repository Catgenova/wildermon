# Furniture in the rune pastel kit

Every piece of furniture is being redrawn in the kit the runestones, the smith's
pieces (`src/render/forge.ts`) and the wildermon beds (`src/render/dens.ts`) are
drawn in. This is how a piece is converted. The exemplars are `chair` and `chest`
(`src/render/kit/chair.ts`, `src/render/kit/chest.ts`). Copy them.

## Files

| File | What it is |
| --- | --- |
| `src/render/kit/core.ts` | The contract (`KitPiece`, `KitLook`, `KitModel`, `KitPart`), the palette and the builders and painters a piece uses |
| `src/render/kit/<piece>.ts` | One file per piece or family of pieces: its model |
| `src/render/kit/index.ts` | The registry `KIT_PIECES`: one line per kind |
| `src/render/kitpieces.ts` | The generic code: models cached per look, parts sorted, baked per view and scale, kept in an LRU, prewarmed when idle, drawn |
| `tools/piece-sheet.mjs` | The contact sheet: old model beside kit model |

`drawFurniture` (furniture.ts) sends any registered kind to `drawKit` before it
looks at `MODELS`. Nothing in `renderer.ts` changes. Old `MODELS` entries stay as
the fallback until a later step deletes them. Leave them in place.

## The contract

```ts
interface KitPiece {
  model: (look: KitLook, size: { hw: number; hd: number }) => KitModel;
  uses?: { lit?: boolean; tint?: boolean; trim?: boolean; material?: boolean }; // what the model reads; unsaid = all
  layers?: number;            // drawn in layers; `trim` picks the layer (crate, fountain)
  states?: { trim: number; label: string }[];   // the trims the preview sheet shows
  live?: (ctx, sx, sy, zoom, view, night, t, air?) => void; // drawn over the bake every frame
  holes?: (sx, sy, zoom, view, t) => { x, y, r, a }[];      // where it takes the night off itself
  wind?: boolean;             // `live` wants the wind (`clothInWind`)
}
interface KitLook { lit: boolean; tint?: Tint; trim?: number; material?: string }
interface KitModel { parts: KitPart[]; shade?: V3[] | null }   // shade: footprint for the soft floor shadow
interface KitPart {
  faces?: Face[];                     // a solid, inked round as one
  draw?: (g, e) => void; reach?: V3[];  // or something loose (coins, moss), px at zoom 1 from the footprint middle
  solid?: boolean;                    // part of the click box (solids default true)
  edges?: boolean;                    // light caught along its near top arrises
  first?: boolean;                    // laid before everything (a rug)
  after?: KitPart[];                  // laid after these whatever the boxes say
  layer?: number | ((e) => number);   // its layer in a layered piece; `halfOf(x, y)` for near or far half
  wholeOnly?: boolean;                // only in the whole picture (still water)
}
```

- **Units.** Tenths of a metre. `x` runs across the piece to its right as you face
  its front, `y` runs toward its front, `z` runs up. The origin is the middle of the
  footprint, which is `hw` by `hd` either way (5 units a subtile).
- **Register.** Add `kind: PIECE,` to `KIT_PIECES` in `kit/index.ts`.
- **Click box.** `drawKit` returns the box round the solids (or round one layer's solids),
  `[left, top, right, bottom]` in screen px from the floor contact, as `drawFurniture`
  always did. `FURNITURE_HEIGHT` for a kit kind is measured off the plain model.
- **Order.** Parts are laid back to front by their 3D boxes, in the same way as `Scene.flush`.
  When two overlapping parts are separated along an axis, the far one goes first.
  Otherwise the one furthest back goes first. Split any solid that passes through another
  (a chair's back post goes below the seat, then on as a post above it). Use `after`
  only for something lying on a face (a strap over a lid). Never use `after` for
  something that is behind from some views: a hasp on a chest front is sorted by its
  box, so it hides when seen from the back.
- **Look.** `trim` is the piece's number (`Renderer.pieceTrim`). For a layered piece
  it is the layer and never reaches the model. A `trim` the renderer never sends (a
  chest's open lid, trim 1) can still be modelled and shown on the sheet, ready for
  when the island says so.
- **Live.** `drawFurnitureLive` calls `KitPiece.live` with the kind, view, night and
  air only. It does not receive lit, trim or material, because the renderer does not
  pass them. A flame that depends on `lit` has to stay in the bake, or be drawn by
  the renderer (as `drawLampBloom` is).

### What stays on the old path

- **Wheeled pieces** (`WHEELS`: `large_cart`, `wagon`). Their wheels are baked in
  sheets round each wheel and turned per frame (`bakeRound`, `wheelsFor`). The kit has
  no wheel stage. Restyle these in the `Scene` builder: kit palette, softer ink.
- **Boats with a crew** (`sailing_boat`, `caravel`, rowing boats: `crewOf`). They are
  baked in layers round the people on deck (`Crew`, `crewOrder`, `seeThrough` for the
  helmsman), with sway, tiller and oars as trims. Keep them on `MODELS`. A kit kind
  ignores `crew`, `layer` and `seeHelm`, so never register one.
- **Pieces whose `trim` packs data the model must decode.** Check what
  `Renderer.pieceTrim` sends before converting one: racks and crate shelves (a crate
  mask), trellis vines and roses (stage and variant), moss (`mossTrim`), planters
  (crop and stage), lamps (lamp in or not). These work in the kit (`uses.trim`), but
  each distinct trim is a separate model and bake. Keep the decoding identical, and
  list a few trims in `states`.
- **Pieces already drawn by their own module.** These keep their own path:
  enchanter's plinth, dens, memorial, rune lantern, smelter, anvil, kiln, fountain water.

## The look

Hold every piece against `node tools/piece-sheet.mjs @anvil @smelter @kiln den_medium`.

- **Palette.** Use the tokens in `kit/core.ts`. Do not invent new ones.
  - Wood is `woodTone(material, tint?)`. The board colour (`WOOD_TONE`) is taken 20% toward
    cream `#fff2dc` in the light and 55% toward mauve `#6a5468` in the shade. Use
    `deeper()` for plinths, insides and stretchers, and `paler()` for tops and knobs.
  - Cloth is `clothTone(tint?)`: warm linen undyed, or the dye whole.
  - Metal is `IRON` (the anvils' iron a step darker, for straps), `BRASS` (locks, rings)
    or `metalTone(id)` (`ANVIL_METALS`) for a piece cast in a named metal.
  - Stone is the forge's tones (`KILN_STONE` cream `#ecd6c0` / `#a68f94`, and so on).
- **Dye.** A piece with cloth takes the dye on its cloth (`clothTone`) and leaves its
  wood plain. A piece of wood alone takes it as paint over its boards
  (`woodTone(material, tint, 0.75)`), and its iron stays bare. Give metal bands a dark
  rim so they still read on a painted piece.
- **Ink.** Use `KIT_INK` at `KIT_INK_W` (0.7 px at zoom 1). Each solid is ruled round
  once. Creases between faces are the face colour toward `CREASE_INK` (set by
  `crease`, about 0.3–0.45). Never use black.
- **Faceting.** Make solids from `slab` (corner cut and top bevel give rounded edges),
  `lathe` (8–12 sides), `extrude` (a shaped outline with chamfered rims: a crest rail,
  a lid seen end on), `turned` (a lid on its hinge) and `warped` (a raked back). Light
  comes from `lightOf`: a top is full, a side facing screen-left is pale, a side facing
  screen-right is in mauve shade. Set `edges: true` on tops that should catch a hair
  of light.
- **Detail density.** At zoom 1 a piece is 15–30 px. Give it one strong silhouette,
  2–4 big masses, and no members under about 0.4 units (they turn into ink). Paint
  the rest in face frames: `boards` / `grain` / `seam` for wood, `band` / `nail` /
  `sheen` for iron. Detail goes in paint, not in extra solids. At zoom 2 the painted
  detail should reward a look.
- **Accents.** Use them sparingly on everyday furniture: one gold `stud` or one small
  `inlay` rune per piece, at most. Use moss (`drawPads`) only on pieces that stand
  outside or gather it (`mossy`). Rune glow and night light are for pieces that are
  magical or burn.
- **Proportion.** Keep true size within the footprint. Make pieces a little chunky
  (thicker legs, plumper cushions) so they read at zoom 1.

## The preview tool

```
node tools/piece-sheet.mjs chair chest            # tmp/sheet-chair.png, tmp/sheet-chest.png
node tools/piece-sheet.mjs chest --zooms 1,3 --mag 3 --views s0,e0,n0
node tools/piece-sheet.mjs @anvil den_medium      # the references
node tools/piece-sheet.mjs table bench --one      # one sheet
```

The sheet shows old cells on the left and kit cells on the right, with rows for each
zoom: day, night (the island's wash), dyed, woods, lit (if the piece `uses.lit` or you
pass `--lit`), each `state`, and each layer. Every cell of a zoom is the same size,
with the footprint in pale squares. It takes about 6 s.
`tmp/` is untracked and must stay out of commits.

## Review rubric

Score each line 1–10. Iterate until every line is at least 9.

1. **Craft.** Clean ink, faceted lit faces, no z-fighting or mis-sorted parts from
   any of the 8 turns, painted detail aligned across faces (straps meet over the lid).
2. **Theme fit.** Stands beside the anvil, smelter and beds as one set: palette tokens,
   mauve shades, soft ink, a single sparing accent.
3. **Readability at zoom 1.** You can tell what it is, and which way it faces, from
   the zoom 1 row alone. It is no less legible than the old model.
4. **States and variants.** Woods are told apart. The dye reads, and the iron still reads
   over it. Every trim the renderer sends is drawn. Night reads as the wash, with no
   glow the piece should not have.
5. **Integration.** The click box covers the solids. The height is sensible (shown
   in the sheet header). Layers interleave correctly. `npx tsc --noEmit -p tsconfig.json`
   and `npm run build` pass. Unconverted pieces are pixel-identical.

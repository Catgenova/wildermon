# Skill gates

What a skill level opens, one way for everything. Asked for:

> Mining ores and taming is currently the only level gated content. Establish that cutting trees is similarly gated,
> with willow requiring the highest level and pine the least. Oak birch and maple early on. Sprouts now are also gated
> by forestry. Gate farming for different vegetables, gate cooking recipes. Gate bauble and artifact restorations.
> Review each skill for appropriate Gate suggestions. … Gating carpentry crafts, masonry crafts, wall types based on
> carp/masonry levels. Gating formulas. Gating paving/floor types. Gating these tasks also for wildermon that perform
> them equal to their own level. Make sure the approach is sensible and uniform. Gate using wagons until driving
> level 30. Gate boat type use by sailing level.

All of it stays on the `gating` branch until the whole set rolls out together. The framework and one gate (tree
felling by woodcutting) are built; everything else below is the plan.

## 1. What is gated today

| Gate | Browser | Island | Words | Menu |
| --- | --- | --- | --- | --- |
| Seams by mining | `ROCK_VARIANTS[].level` (src/world/tiles.ts:796-813); `oreNeeds` (src/game/actions.ts:687) in `mine` and `chip_corner` (actions.ts:1611, 1669); cellar cut (cellar.ts:385) | `rock_def.level`; `terrain_refusal` (functions/public.terrain_refusal.sql:59-66) | "Iron vein: needs mining 5; have 2.3." | Greyed, the words as hint |
| Ore Sense lowers it | `perk('ore:below')` in `oreNeeds` | `pk(…, 'ore:below')` | — | — |
| Miner workers | `gatherable('mine')` (creatures.ts:7499) `level <= skill`, `anySeam` exempts the Ironemole line; `mineIdle` (creatures.ts:6800) | `worker_gatherable` (`rock.level <= task_skill(c)` or `species_def.any_seam`), `seam_beyond`, `mine_idle` (migration 20261120000050) | Card: "Idle: Iron vein 4 tiles from the totem needs mining 5 (yours 1.0); copper vein and coal seam: 1." Keeper after an hour: `worker_idle` | — |
| Taming | `tameNeeds` (creatures.ts:1209): `tameLevel` + `WILD_STAGE_TAME` (15) per stage; `tame` check (creatureActions.ts:436) | `tame_needs` | "Need taming 25." (a different form) | Greyed |
| Fish by fishing | `FISH[].level` 1/1/15/35/60/20/45/70 (fishing.ts:38-46), `fishHere`/`deepFishHere` filter the pool, `laterSaid` names the rest | `fish_def.level`, `fish_here`, `deep_fish_here` | Not a refusal: a fish over your level is not in the catch; "trout at 15" | — |
| Storeys | `storeySkill` = 10 per storey (building.ts:226; buildActions.ts:1045) | same rule | "Storey 3 over plank needs carpentry 20; have 4.2." | Greyed |
| Foundation depth | masonry per metre (game.ts:7074) | same | "Pour 1.2 m deep needs masonry 6.0; have 2.0." | Greyed |
| Trait reading | `TIER_LEVEL` 0/15/35/60 (husbandry.ts:426) | `blood_seen` | Hidden until read | — |
| Trade book | `TRADE_BOOK_AT` 50 in the trade written on (recipes.ts:692) | read off the recipe id | — | Greyed |
| Perk tiers, class tiers | `PERK_TIER_AT` 50/60/70/80/90/99, `CLASS_TIER_AT` 1/20/40/60/80/99 (classes.ts:63, 74) | `perk_tier`, `class_tier` | A choice opening, not a refusal | Shown locked |
| Path and faith tiers | `PATH_TIER_AT` 20/40/60/80/99 (meditation.ts:116); `FAITH_TIER_AT` (patrons.ts:43) | `path_tier`, `faith_tier` | "Faith tier needs … 40; have 31." | Shown locked |
| Rune tablet | usable only *under* `TABLET_BELOW` 50 (relicuse.ts:31) | same | A cap, not a gate | Hidden |

Not gates:

* **Recipe `difficulty`** only sets the success chance: `skillChance` clamps to 30–98% (game.ts:6517), and a craft at
  any level can be tried. Material difficulty (materials.ts) adds to it.
* **QL caps**: what you make or gather is capped by your level (`productQl`, `qlCeiling`); a cap, never a refusal.
* **Continuous reach**: dig slope (`maxDigSlope`), climb step, prospect range, a worker's range per ten levels.
* **Locked recipes** (`Recipe.locked`, a Recipe or Formula read), **perk recipes** (`Recipe.perk`): knowledge, not
  level.

Wording today: mining and storeys use "X: needs <skill> N; have Y." (no "you"); taming says "Need taming N."; fish say
nothing. The menu greys any refused action and shows its refusal as the hint (src/ui/contextmenu.ts:58-100, ui.ts:260).

## 2. How workers do each trade

* A worker's level is its **task skill**: `taskSkill(c, def)` (creatures.ts:4717), the island's `task_skill(c)`: the
  skill of its kind's trade (`gather_def.skill`, `GATHER_SKILL`), or for a hybrid the trade it is at (`c.trade`,
  `c.job`).
* **Ground trades** pick a tile with `gatherable` / `worker_gatherable` (`find_work_tile` walks rings from the site,
  `work_tile_may` prefilters by tile type, claim and forage clock) and do it in `worker_do` (browser `finish*`). A gate
  here is checked in `worker_gatherable` (never picked) and again in `worker_do` (never done if it got there anyway).
  Trades: woodcut, sprout, plant, prune, fruit, resin, farm, mine, quarry, fish, forage, botanize, bush, grass, moss,
  reed, peat, sand, clay, pan, worm, seek, flower, scrub, stump, hive.
* **Store trades** work recipes out of the settlement stores (`tradeRecipes`, `smithLumps`, `ALLOY_RECIPES`, …): saw,
  timber, shaft, chisel, brick, fletch, paper, spin, nail, ribbon, glass, concrete, mortar, bandage, cheese, churn,
  alloy, cook, brew, kiln, restore, tan, mill. A gate here is checked where the recipe is chosen: a recipe over its
  level is skipped like one with nothing in stock.
* **Errands** (fetch, water, fill, lamp, groom, heal, dairy, mend, stoke, ash, guard, hunt) have nothing to gate.
* **Hod carriers** (masonry) fit planned walls, floors, spans and foundations: a wall or floor gate is checked when it
  picks the plan.
* **Idle reasons**: `IdleWhy` (workerledger.ts:9) and the island's `creature.idle_why`, said by `idleSays`
  (workerlog.ts:154); `worker_idle` tells the keeper after an hour.

## 3. The one rule

**A thing has at most one gate: a skill and a level.** Held once in `src/game/skillgates.ts` (`SKILL_GATES`), emitted by
`npm run defs` into one table:

```
skill_gate (kind text, id text, name text, skill text, level int, primary key (kind, id))
```

`kind` says what sort of thing (`tree`, later `sprout`, `crop`, `recipe`, `furniture`, `wall_material`, `wall_type`,
`floor`, `paving`, `formula`, `vehicle`, `boat`, `seam`, `tame`, `fish`, `metal`, `stone`); `id` the thing within it.
A thing that is two things (a marble portcullis is a material and a wall type) has two gates, one each, and the first
unmet is named.

**One check, one set of words.** `skillGateRefusal(name, skill, have, need)` in the browser, `skill_gate_refusal(name, skill,
have, need)` on the island, word for word, in the form mining already used:

> Willow: needs woodcutting 70; have 12.4.

Helpers: `gateOf(kind, id)` / `skill_gate_of(kind, id)`; per kind a reader (`treeGate(data)` / `tree_gate(data)`) and a
person's refusal (`treeGateRefusal(g, data)` / `tree_gate_refusal(world, uid, data)`).

**Modifiers** are perks that lower one skill's gates, the way Ore Sense lowers seams (`ore:below`); at rollout it
becomes `gate:<skill>:below`, read inside the one check. Taming's +15 per stage is the other: the gate is the kind's
base, the stage adds to it.

**One menu treatment: greyed with the need named.** The action's check returns the refusal; the context menu already
draws any refused action greyed with it as the hint. The crafting window shows a gated recipe the way it shows a
locked one: listed, greyed, the refusal as its line. A gate never hides a thing.

**One help treatment: each skill's Unlocks, derived.**

* Skills window (K): an opened skill lists every gate on it in level order, each `<name> <level>` with a tick when
  your level meets it, then "Next: Birch at 5 (yours 1.0)" (`unlocksOf`, `nextUnlockSaid`; src/ui/panels/skills.ts).
* Help: "Skill gates", one line per gated skill: what its gates stop and its rungs, "Pine 1; Birch 5; Oak 10; Fig,
  Maple and Peach 20; …" (`unlocksSaid`).

## 4. Workers use the same gate

A worker reads a gate against **its own level, its task skill** (`taskSkill`, `task_skill(c)`); its level in the
gate's skill is the same number wherever the gate is on the trade's own skill, and for the few where it is not (a hod
carrier, masonry, at a plank wall's carpentry gate) its trade's level stands in for it. `gateOpen(gate, level)` /
`worker_gate_open(c, gate)`.

* It never picks gated work (`worker_gatherable`, recipe choice), and never does it if it is at it anyway (`worker_do`).
* With nothing else to do and gated work in reach, it is idle for one reason, `gate`, naming the lowest gate in reach,
  then the nearest: `idle_what = [kind, id]`, `idle_n` = tiles off (`gate_idle`, browser `gateIdle`):

  > Idle: Willow 3 tiles from the totem needs woodcutting 70 (yours 1.0).

  and after an hour to its keeper: "Pip idle: only work above its level within 8 tiles of the totem at 40,40. Willow:
  needs woodcutting 70; have 1.0."
* Mining's `seam` reason becomes `gate` at rollout (`mine_idle` folded into `gate_idle`); the Ironemole line's
  `anySeam` stays as the one kind exempt from one kind of gate (`species_def.any_seam`), named in the gate's help line.

A worker never does what its own level could not.

## 5. The ladder

Every gate sits on one of: **1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90.** (`GATE_LADDER`; `skillgates.ts` throws on any
other.) 1 is "open from the start", listed so the Unlocks list is complete.

How a level is chosen, in order:

1. **The user said** (trees' ends, wagons at driving 30).
2. **Crafts by their difficulty**: `level = the ladder step at or below 2 × (difficulty − 6)`; no difficulty → 1. So
   d8 → 1, d10 → 5, d12–14 → 10, d16–20 → 20, d22–24 → 30, d26–30 → 40, d32–34 → 50, d36–40 → 60, d42–45 → 70,
   d46–50 → 80, d51+ → 90. Recipes, furniture, moulds, relics, baubles and brews all have a difficulty already, so the
   whole craft table falls out of the numbers players already see, and moves with them.
3. **Kinds of a thing by tier**: the cheapest/commonest at 1, then one step per tier (woods by their wood difficulty,
   wall materials by their bill, metals by their seam).
4. **Existing gates keep their numbers** (seams are on the ladder already).

## 6. Existing gates onto the rule

| Gate | Moves to | Numbers |
| --- | --- | --- |
| Seams by mining | `skill_gate('seam', yield)` (`SEAM_GATE`; `ROCK_VARIANTS` holds no level now); `rock_def.level` emitted from it; `terrain_refusal` → `face_gate_refusal`, browser `faceGateRefusal` | Kept: already 1, 5, 10, 20 … 90. Built |
| Miner workers | `worker_gatherable` → `worker_gate_open`; `mine_idle` → `gate_idle`; `seam` → `gate` | Kept |
| Taming | `skill_gate('tame', species)` (`TAME_GATE`) the kind's base; +15 per stage (`TAME_STAGE_GATE`) on top; words "Logchewer: needs taming 16; have 1.0." by the stage's name (`tameRefusal`, `tame_gate_refusal`), for Tame and Take catch | Base kept, off the ladder (`KEPT_OFF_LADDER`). Built |
| Fish | `skill_gate('fish', id)` (`FISH_GATE`); still a pool filter (a gated fish is not caught), and the Unlocks list names them | Kept, off the ladder. Built |
| Veins by prospecting | `skill_gate('vein', yield)`, each seam's mining level: every vein in reach is marked and glows; one over your prospecting is "Unidentified metal" in Prospect's lines, a find told to you, the tile's reading and name, with "5 prospecting required to identify this vein." (`seenVein`/`veinTip`, `seen_vein`/`vein_tip`), per viewer | Built |
| Stone faces by mining | `skill_gate('stone', yield)` (`STONE_GATE`): Mine and Chip corner on a bare face; a quarrier's work at its task skill (`quarryGate`/`stone_gate`), idle `gate` naming the stone (`stoneIdle`/`stone_idle`) | Rock 1, sandstone 10, slate 20, marble 30. Built |
| Storeys, foundation depth | Stay their own rules: a level per storey or per metre is a scale, not a thing | — |
| Perk, class, path, faith tiers; trade book; trait reading | Stay: choices and readings, not things refused | — |

## 7. What players keep

A gate stops **making, gathering, planting or taking the controls**. It never takes away what is owned, built, planted
or known, and never stops repairing, improving, moving, selling, demolishing or harvesting.

| Kind | Stops | Keeps |
| --- | --- | --- |
| Tree | Felling a tree with logs: Cut down, Coppice; a feller's work | Trees standing, logs owned; a tree with no logs yet (sapling, clipped) anybody clears; bushes |
| Sprout | Picking a sprout of the species; planting one; grafting it | Sprouts held (stored, traded); trees planted grow on |
| Crop | Sowing it (seed, planter, glasshouse) | Crops in the ground tended and harvested by anyone; seed held |
| Cooking recipe | Cooking it | Food made; a Recipe read stays known |
| Bauble, relic | Restoring it | The tarnished piece or the pieces, owned and traded |
| Carpentry/masonry craft | Making it | Things made, used, improved, repaired |
| Wall material, wall type | Planning and building it (adding to a plan) | Walls built; plans already laid stay and anyone at the level finishes them; repair and demolish open |
| Floor, paving | Planning, laying | Laid floors and paving; removing open |
| Formula | Writing its scroll | A Formula read stays known; scrolls written are used by anybody |
| Wagon, cart | Taking the reins | Owning, loading, hitching, riding as a passenger |
| Boat | Taking the helm / climbing aboard to row | Owning, loading, mooring, sailing as a passenger |
| Seam | Mining, chipping it | Ore held |
| Tame | Taming it | Tamed wildermon |

## 8. The gate table

A = asked for; S = suggested. Levels on the ladder; crafts by the difficulty rule (§5.2) unless named.

### Woodcutting: felling a tree with logs (A) — built

| Pine | Birch | Oak | Maple, Fig, Peach | Cherry, Lemon, Apricot | Apple, Pear, Plum, Quince | Cedar, Pomegranate | Olive | Willow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 | 10 | 20 | 30 | 40 | 50 | 60 | 70 |

Pine least, birch/oak/maple early, willow most, as asked; the rest by their wood's difficulty (materials.ts): 0–1 → 20,
2 → 30, 3 → 40, 4–5 → 50, 6 → 60. Workers: the Sapgnaw line, and any hybrid at woodcut.

### Forestry: sprouts (A)

Picking, planting and grafting a species' sprout: **one ladder step under its felling gate** (derived), so you can grow
a wood before you can fell it.

| Pine, Birch | Oak | Maple, Fig, Peach | Cherry, Lemon, Apricot | Apple, Pear, Plum, Quince | Cedar, Pomegranate | Olive | Willow |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 | 10 | 20 | 30 | 40 | 50 | 60 |

S: grape cuttings at a trellis 20; prune, fruit picking and tapping resin ungated. Workers: sprout pickers (`sprout`),
planters (`plant`), vine planters (`vine`).

### Farming: sowing (A)

| Onion, Carrot, Potato | Cabbage, Wheat | Corn, Thyme | Cotton, Mint, Sage | Wemp, Basil | Rosemary |
| --- | --- | --- | --- | --- | --- |
| 1 | 5 | 10 | 20 | 30 | 40 |

Staples first, fibres and the costlier herbs later. Workers: farmers (`farm`), planter tenders (`patch`). S:
botanizing water plants: water lily 10, lotus 20 (`lily` workers).

### Cooking: recipes (A), by difficulty

| 1 | 5 | 10 | 20 | 30 |
| --- | --- | --- | --- | --- |
| Roasts (potato, onion, nuts, lotus seeds), cooked and fried meat, cooked fish, compote, dough, porridge, pottage | Bread, preserves, stew, broth | Cheese, butter, pastry, cherry preserves | Apple pie | Cottage pie |

Workers: cooks (`cook`), cheese presses (`cheese`), churners (`churn`). Cooked fish stay at 1: the catch is gated.

### Restoration (A), by difficulty

| | 10 | 20 | 30 | 40 | 50 | 60 | 70 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baubles | Minor | | | Major | | | Ancient |
| Relics | Old pot | Bone comb, seed jar, old whetstone | Old file, old collar | Old lamp, old bridle, bronze mirror | Old brace, old blade | Statuette, maker's stamp | Rune tablet, ancient helm |

Workers: restorers (`restore`). Archaeology (finding) stays ungated: finds are rolls.

### Carpentry crafts (A), by difficulty

| 1 | 5 | 10 | 20 | 30 | 40 | 70 | 90 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Planks, timbers, shafts, crates, fitting heads and blades, mallet, rope tool, club, thatch, compost bin, footstool, training dummy, mooring post, buoy, snare, nameplate | Settlement stake, small den, signpost, side table, archery target, cheese rack, pedigree board | Bucket, fishing rod, lantern post, flower cart, armour stand, water trough, spice shelf, window seat, garden obelisk, game table | Work post, wooden and metal shields, medium den, rope walk, paper press, butter churn, rose/lavender arches, wisteria pergola, arbour bench, garden swing, tree bench | Large den, gazebo | Large wheel, large cart, rowing boat, deadfall | Wagon, sailing boat | Caravel |

Fine carpentry by the same rule: stool 1; coat rack, planter, trellis, boxes, sign 5; chair, bench, table, cot, coffer,
spindle, small barrel, bins … 10; bed, chest, cupboard, shelves, barrel, lectern, hive, small cart, signboard … 20;
desk, wardrobe, stall, crate shelf, bell, loom, four-poster 30; larder, large barrel 40. Workers: sawyers (`saw`,
`timber`, `shaft`: all 1).

### Masonry crafts (A), by difficulty

| 1 | 10 | 20 | 30 | 40 | 50 | 60 |
| --- | --- | --- | --- | --- | --- | --- |
| Concrete, mortar, cairn, moss boulder | Birdbath, stone bench, lily pond, herb spiral | Kiln, brazier, lantern pillar, sundial, stone lantern | Smelter, statue, oven, rune lantern post, memorial stone, stone arches, fireplace | Enchanter's plinth, well | Fountain | Altar |

Workers: concrete and mortar mixers (1).

### Walls (A): material and type, in the material's skill

| Carpentry | Log 1 · Plank 10 · Timbercraft 20 · Glass (roof) 40 |
| --- | --- |
| **Masonry** | Cobblestone 1 · Clay adobe 5 · Clay bricks 10 · Stone brick 20 · Sandstone 30 · Slate 40 · Marble 50 · Ornate silver 60 · Stained glass 60 · Ornate gold 70 |
| **Wall type** (either) | Solid, fence, half wall, railing 1 · Window, door, fence gate 5 · Double door, arch, shop counter 10 · Bay window 20 · Iron-bound gate 30 · Hidden door 40 · Portcullis 50 · Rune gate 60 |

Materials by their bill (cheapest first), as the ladder's tier rule. A wall needs both its material's and its type's
gate. Storeys keep their own rule. Workers: hod carriers (`hod`), at their task skill.

### Floors and paving (A)

* **Floors, roofs, stairs**: the material's gate above; floor kind: floor, ladder 1 · staircase 10 · spiral and
  single staircases 20.
* **Paving** (paving): packed dirt 1 · cobblestone 5 · stone slabs 10 · sandstone slabs 20 · slate slabs 30 · marble
  slabs 50. Stepping stones as their slab. Garden steps by their difficulty: timber (carpentry, d12) 10, stone (masonry,
  d15) 10.
* Foundations keep their depth rule.

### Enchanting: formulas (A)

Writing a scroll:

| 20 | 30 | 40 | 50 |
| --- | --- | --- | --- |
| One element on a weapon, bow, armour, shield, tool or light: Emberbrand, Razoredge, Concussion, Venomfang, Gale, Nightblade, Sunstrike, Tidecaller, Farsight, Flamearrow, Frostbite, Stoneskin, Emberward, Thornhide, Bulwark, Swiftwork, Truesteel, Bountiful, Lodestone, Lantern's Grace | On jewellery, clothing and gear: Featherstep, Shadowcloak, Scholar's Band, Steady Heart, Hearthbound, Favoured, Stillwater, Packmule, Seal's Coat, Hawk's Eye, Snarecraft, Netmender, Fleetfoot, Tamer's Bridle | On a vessel, cart, store, furnace or station: Ember Heart, Fair Wind, Deep Hold, True Axle | Two elements: Leeching, Knackstone, Masterwork, Bag of Holding, Dreamweave |

### Driving and sailing (A)

| Small cart (pulled by hand) | Large cart | Wagon |
| --- | --- | --- |
| open | open (a small cart teaches no driving, so the large cart is where it is learned) | **driving 30** (A) |

| Rowing boat | Sailing boat | Caravel |
| --- | --- | --- |
| sailing 1 | sailing 20 | sailing 50 |

Stops taking the reins or the helm (`board_vehicle`); boarding as a passenger stays open. Wildermon pull, they do not
drive: no worker gate. Built (`helmGate`, `helm_gate_refusal`).

### Every other skill (S)

| Skill | Gate | Levels |
| --- | --- | --- |
| Mining | Seams (existing) | 1 … 90, kept |
| Mining (quarry) | Stone faces quarried | Rock 1 · Sandstone 10 · Slate 20 · Marble 30 |
| Taming | Kinds (existing) | Kept, +15 per stage |
| Fishing | Fish (existing, pool) | Kept |
| Stonecutting | By difficulty | Whetstone 5 · bricks, slate and sandstone slabs 10 · stone and marble slabs, bust 20 · quern 30 · telestone 40 |
| Pottery | By difficulty | Brick, bowl, adobe, potted fern 1 · jar, palm, vase 5 · pot 10 · potter's wheel, amphora 20 |
| Smelting | Alloys by difficulty | Pewter 5 · bronze, brass 10 · steel, electrum 20 |
| Blacksmithing, weaponsmithing, armorsmithing, chainsmithing, platesmithing, jewellery | Moulds by difficulty; and **working a metal at its seam's level** (copper 1, iron 5 … seryll 90; alloys at their own making level) | per mould |
| Tailoring | By difficulty | Yarn 1–10 · sack, banner, curtains 5 · cloth, needle, caps, shoes, flagpole 10 · rug, tunic, trousers, tent 20 |
| Ropemaking | By difficulty | Torch, twine 1 · rope 5 · hammock, skep 10 · creel, sailcloth 20 · net 30 · thick rope, rigging 40 |
| Leatherworking | By difficulty | Awl 10 · leather, satchel, cap, bridle, yoke 20 · toolbelt, jerkin 30 · backpack, saddle 40 · large harness 50 · scale 80–90 |
| Bowyery, fletching | By difficulty | Short bow 20 · medium 30 · long 40 · composite 80; blunt 1 · javelin 5 · arrows 10 · broadhead 20 · bodkin 40 |
| Glassblowing | By difficulty | Glass 5 · panel, bottle 20 · stained glass 40 |
| Alchemy, first aid | By difficulty | Candle, tea 5 · lye, dyes 10–30 · ink, tinctures 20; bandage 1 · covers, salves 10 |
| Papyrusmaking, milling, brewing | By difficulty | Papyrus 20 · book 40 · trade book 50 (and `TRADE_BOOK_AT`); flour, juice 5 · cornmeal 10 · olive oil, cider 20; ale 10 · cider 20 · mead 30 · wine 40 |
| Repair | Kit, sealant (perk recipes) | 20 |
| Animal husbandry | Trait reading (existing) | Kept |
| Archaeology, prospecting, digging, foraging, botanizing, tracking, butchering, climbing, swimming, chirurgy | None: finds are rolls, the rest are continuous | — |
| Prayer, meditation, elementalism | Their own tiers | Kept |
| Fighting and weapon skills, armour skills | None: gear is open, the skill sets the odds | — |

## 9. The pilot (built)

* `src/game/skillgates.ts`: `GATE_LADDER`, `SKILL_GATES`, `TREE_GATE`, `gateOf`, `skillGateRefusal`, `treeGate`,
  `gateOpen`, `unlocksOf`, `nextUnlockSaid`, `unlocksSaid`, `GATE_STOPS`.
* `skill_gate` emitted by `scripts/dump-defs.ts`; read by anybody, as the rulebook is (permissions.allow.ts).
* Island (`20261120000065_skill_gates.sql`): `skill_gate_refusal`, `skill_gate_of`, `worker_gate_open`, `tree_gate`,
  `tree_gate_refusal`, `gate_idle`; patched `gather_refusal` (cut down), `ground_refusal` (coppice),
  `worker_gatherable`, `worker_do`, `worker_settle`, `worker_idle`, `rpc_creatures`.
* Browser: `cut_down` and `coppice` checks (`treeGateRefusal`), `gatherable('woodcut')`, `gateIdle`, `finishFelling`,
  `IdleWhy` 'gate' and its words (`idleSays`, `IDLE_LABEL`), the Skills window's Unlocks, the help's Skill gates.
* Test: `supabase/test/skillgates.ts`.

### Second set (built): wagons, boats, stone; seams, taming, fish moved; veins

* `skillgates.ts`: `SEAM_GATE`, `VEIN_GATE`, `STONE_GATE`, `TAME_GATE` and `TAME_STAGE_GATE`, `FISH_GATE`,
  `VEHICLE_GATE`, `BOAT_GATE`; `KEPT_OFF_LADDER` (tame, fish); `rockGate`, `helmGate`, `seenVein`, `veinTip`,
  `UNIDENTIFIED_METAL`; `nameGates` (a kind, a fish and a piece are named by the module holding them, so this one stays
  a leaf). `ROCK_VARIANTS`, `SPECIES` and `FISH` read their levels from it.
* Island (`20261120000066_skill_gates_b.sql`): `helm_gate_refusal` (in `ride_refusal`), `face_gate_refusal` (in
  `terrain_refusal`), `stone_gate`, `stone_idle`; `tame_needs` reads the gate; `tame_gate_refusal` (in
  `creature_refusal`, `trap_refusal`); `seen_vein`, `vein_tip` (in `perform_ground`'s Prospect, `read_ground`); patched
  `worker_gatherable` and `worker_do` (quarry), `worker_settle` (`stone_idle`).
* Browser: `board_vehicle`, `mine`/`chip_corner` (`faceGateRefusal`), `tame` and `take_catch` (`tameRefusal`),
  `gatherable('quarry')`, `finishQuarry`, `stoneIdle`; Prospect, `readGround`, `groundReading`/`groundTip`, `tileSeen`.
* Test: `supabase/test/skillgates-b.ts`.

## 10. Open questions

1. Trees: maple at 20 and birch at 5 read as "early"; lowland woods are about a third birch and an eighth pine, so a
   new player fells mostly pine at first (young trees with no logs, bushes and saplings still teach woodcutting).
   Birch at 1 too?
2. Willow at 70 is the top of the trees; shore woods are mostly willow. 70, or 90 to match the deepest seam?
3. Existing gates off the ladder (taming bases 6, 8, 12 …; fish 15, 35, 45): keep their numbers, or snap them?
4. The difficulty rule puts a wagon at carpentry 70, a caravel at 90 and scale armour at 80–90, and the smelter (the
   Path's stone phase) at masonry 30. Cap big builds, or move the Path's steps onto what the gates open first?
5. A worker reads every gate at its task skill (a hod carrier's masonry for a plank wall's carpentry gate). Or its own
   level in the gate's skill?
6. Walls: a material and a wall type are two gates (a marble portcullis needs both). Or one gate per material only?
7. Mining a vein you cannot identify still names it in its refusal ("Iron vein: needs mining 5; have 2.3."), as asked
   ("mining is unchanged"). Say "Unidentified metal" there too, under the prospecting gate?
8. A cellar dug into marble or slate bedrock gives up its shards without the quarry gate (Mine out the cellar keeps only
   the seam gate). Gate it too?

# Skill gates

What a skill level opens, one way for everything. Asked for:

> Mining ores and taming is currently the only level gated content. Establish that cutting trees is similarly gated,
> with willow requiring the highest level and pine the least. Oak birch and maple early on. Sprouts now are also gated
> by forestry. Gate farming for different vegetables, gate cooking recipes. Gate bauble and artifact restorations.
> Review each skill for appropriate Gate suggestions. … Gating carpentry crafts, masonry crafts, wall types based on
> carp/masonry levels. Gating formulas. Gating paving/floor types. Gating these tasks also for wildermon that perform
> them equal to their own level. Make sure the approach is sensible and uniform. Gate using wagons until driving
> level 30. Gate boat type use by sailing level.

All of it stays on the `gating` branch until the whole set rolls out together. Built: the framework, tree felling by
woodcutting, sprouts by forestry, sowing by farming, a worker at its own level in the gate's skill, and unidentified
items (§12); wagons, boats, quarried stone, veins (batch B); every crafting recipe, relic and bauble restoring,
building materials, wall, floor and paving types, Formulas, and each skill's next gate beside its level (batch C,
§9); the answers to batch C's questions: stone brick at 10, pouring by the metal, the trees spread to 70 and 80, a bare
vein always named, long Unlocks lists one row a level (batch D, §9); iron poured at 1, prospectors finding buried veins, the
Guiding Light counting only trees you fell, cellars cut by the stone's gate (batch E, §9); the sweep's recommended gates
(graft, water plants, treasure maps, bridges, smelting, stones in a circlet, a cross, spells), working a casting by the
metal at the smelting levels, and a trade's first steps at 1 (batch F, §9). What is left below is the plan; §11 sweeps
every skill for the next gates.

Decided since (the user, on §10's questions): birch 1 and willow 90; taming and fish keep their own numbers (batch B
moves them into the table); the smelter at masonry 1, the wagon at carpentry 70 and the caravel at carpentry 90; a
worker reads a gate's own skill at its own level in that skill; a wall keeps both its gates, material and type, a
carpentry wall's in carpentry and a masonry wall's in masonry; the large cart has no gate (a small cart gives no driving
to earn it with), the wagon driving 30; and items whose use is gated are unidentified under the gate (§12).

Decided since (the user, on batch C's questions, built in batch D):

1. **Stone brick walls at masonry 10** (was 20); every other material keeps its level.
2. **Casting a mould stays ungated; pouring is gated by the metal poured**, in blacksmithing (the trade that pours every
   mould): a mined metal at its seam's mining gate, an alloy at the highest of the mined metals mixed into it. Players
   and pour workers (nail and ribbon smiths) at their own level, on both sides.
3. **Formulas by what they enchant** (20/30/40/50): confirmed, no change.
4. **No empty tree step between 1 and 90**: pine and birch 1, oak 5, maple 10 and willow 90 kept; plum and quince 40
   (were 40), apple and pear 50 (were 40), pomegranate 60 (was 50), cedar 70 (was 50), olive 80 (was 60). Sprouts follow
   one step under: plum and quince 30, apple and pear 40, pomegranate 50, cedar 60, olive 70.
5. **A bare vein is always named, and still mining-gated by name**; only a buried one (under soil or water) found by
   prospecting is "Unidentified metal" over the reader's prospecting gate, and says no level ("More prospecting
   required to identify this vein.").
6. **Long Unlocks lists one row a level**: over 15 gates, so the lists named (taming's 77 kinds, fishing's 16, cooking's
   20, carpentry's 97) and blacksmithing's, mining's, woodcutting's and forestry's:
   "1: Bramblet, Briarling, Budscarab, … (+27)", ticked when reached, the whole list as the row's hint.

Decided since (the user, on batch D's questions, built in batch E):

1. **Pouring iron is level 1** (was 5, its seam's mining gate): `POUR_GATE_SAID`. Steel, iron and coal, follows the alloy
   rule (the highest mined metal in its mix; coal is not a metal) and comes down with it to **1**. A fresh nail smith pours
   iron; a ribbon smith at 1 pours copper, iron and steel.
2. **Prospectors find buried veins too**, as a player's Prospect does: every seam in the circle, bare, under soil or below
   water. The find is told to the keeper and read by the keeper's prospecting (batch B's rule: `seen_vein_at` with the
   keeper's uid), so a buried vein over the keeper's gate is "Unidentified metal".
3. **A vein seen bare then covered stays named in that browser** until the land is read again: accepted, no change.
4. **The Guiding Light counts only trees you can fell**: a suggested site's tree count takes only species at or under the
   player's woodcutting gate (`tree_fells` in `thepath_sites`); the site step says which ("Birch or pine ≥10 within 10",
   "Site: Birch or pine 14 · Water 6 …"), derived from the gates (`fellsSaid`).
5. **Cellars are cut by the rock's gate**: Mine out the cellar asks what Mine asks of a bare face of the same rock, a seam
   by its mining (less Ore Sense) and a stone by its quarrying (rock 1, sandstone 10, slate 20, marble 30), in the one
   rule's words (`rockGateRefusal`, `rock_gate_refusal`): "Marble: needs mining 30; have 12.0." Dig the cellar cuts only
   soil and stays open. No worker digs cellars.
6. **These stay ungated**: dye-recipe sheets, brews set going at a barrel, garden steps, stepping stones, a Mason's
   Repoint and ingots (`pour_ingot`). Beating a casting out at the anvil was on this list; batch F gates it (below).

Decided since (the user, on §11's sweep, built in batch F): "Add those recommended gates. Coinsmithing needs to be
removed entirely… Bring the awl and leather down. Same with papyrus milling and ropemaking first steps. For smithing,
working a casting should have requirements equal to the smelting gate parallels."

1. **Every ★ in §11, built**: Graft onto the rule (forestry 50); the water lily 10 and the lotus 20 (botanizing), water
   planters at their own level; treasure maps by tier (digging: worn 1, sound 20, fine 40, grand 60), the map
   unidentified under it; bridges (carpentry: garden footbridge 10, rope bridge 20, drawbridge 50; log, plank and
   timbercraft at their material's gate; masonry: a stone bridge at its material's gate, the aqueduct 70), hod carriers
   at their own level; smelting ore by its metal at the metal's pouring level (copper and iron 1, tin 10 … seryll 90),
   smelter workers and stokers at their own smelting; stones in a circlet by rarity (30/40/50/60); a listed cross onto
   the rule (animal husbandry 50); spells onto the rule (kind `spell`, kept at 1 and 30).
2. **Brought down to 1** (their recipe level, `CRAFT_GATE_SAID`, not a new gate): the bowstring (10) and the short bow
   (20); the awl (10) and leather (`tan_hide`, 20); papyrus (20) and the paper press it is pressed at (carpentry 20), the
   step before it; rope (5).
3. **Working a casting is gated by its metal** (replaces "beating a casting stays open"): at the anvil (Smith), in the
   trade the casting's mould is worked in (blacksmithing, weaponsmithing, armorsmithing, chainsmithing, platesmithing,
   jewellery), at exactly the level smelting that metal takes: one table (`METAL_GATE`) read by smelting, pouring and
   working a casting. An alloy's casting at its alloy level (then the highest smelting gate of the mined metals in it;
   its mixing recipe's level since batch G).
4. **Coin striking is removed** from the game on `main` by a separate change; it is not gated here, and §11's
   "Striking coins" proposal is dropped.

Decided since (the user, on batch F's questions 16–24, built in batch G):

1. **Wemp is sown at farming 1** (was 30), so rope's chain starts at 1. The unidentified-seed examples (the help, the
   tests) use the lowest crop still gated above 1, by name: cabbage seeds at 5.
2. **The bucket at carpentry 1** (was 10), the paper press kept at 1.
3. **Lye at alchemy 1** (was 10).
4. **An alloy is poured and its casting worked at the level of the recipe that mixes it**, derived from the recipe:
   pewter 5, bronze and brass 10, steel and electrum 20, fire-tempered steel 40 (smelting's, its recipe). A mined metal
   keeps its smelting level. Steel was 1 by the old alloy rule; it is 20 now, so a ribbon smith at 1 beats copper and
   iron only.
5. **Ore stays identified**, and an idle worker names the metal or the plant, not the item: agreed, no change.
6. **An unidentified treasure map is read**; only Dig it up is gated (and the warmth it says).
7. **A hod carrier whose only work within reach is bridge spans over its level names the gate** in the one wording
   ("Idle: Drawbridge 4 tiles from the totem needs carpentry 50 (yours 1.0)."), not "no work" (`hodGatedSpan`,
   `hod_span_gate`). Question 8 (walls and floors over its level) stays open.
8. **Fire-tempered steel** at its recipe's level, 40, by 4.
9. **Everything of obsidian at 99** (`OBSIDIAN_LEVEL`, a new top step on the ladder; a craft by its difficulty alone
   still stops at 90, `CRAFT_TOP`): every recipe with obsidian as an input, in its own making skill (the obsidian
   armour in platesmithing; the knapped tools and weapons, the throne, obelisk and bust in stonecutting; the vase, wind
   chime, black-glass lantern and lava lamp in glassblowing; the dragon-glass fountain, the shard garden and the glass
   shard path in masonry; the ember orb in jewellery), and obsidian glass building (masonry). Workers follow their own
   level through the recipe and material gates. Raw obsidian is not gated: it comes off monsters killed on Volcano
   Isle, by butchering (`carcass_obsidian`), which has no gate.

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

> Willow: needs woodcutting 90; have 12.4.

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
  your level meets it, then "Next: Oak at 5 (yours 1.0)" (`unlocksOf`, `nextUnlockSaid`; src/ui/panels/skills.ts). Over
  15 gates (`UNLOCKS_GROUPED_OVER`) one row a level, its first three names and "… (+N)", the whole list as its hint
  (`unlockRows`).
* Help: "Skill gates", one line per gated skill: what its gates stop and its rungs, "Birch and Pine 1; Oak 5; Maple 10; Fig
  and Peach 20; …" (`unlocksSaid`).

## 4. Workers use the same gate

A worker reads a gate against **its own level in the gate's skill** (`workerGateOpen`, `worker_gate_open(c, gate)`,
off `workerLevel` / `worker_level(c, skill)`: its `skills` entry, 1 where it has none), not its trade's. Where the gate
is on the trade's own skill that is its task skill; where it is not, it is its own level there: a hod carrier fitting a
plank wall checks its carpentry, not its masonry. An item's gate the same (`workerItemOpen`, `worker_item_open`).

* It never picks gated work (`worker_gatherable`, recipe choice), and never does it if it is at it anyway (`worker_do`).
* With nothing else to do and gated work in reach, it is idle for one reason, `gate`, naming the lowest gate in reach,
  then the nearest: `idle_what = [kind, id]`, `idle_n` = tiles off (`gate_idle`, browser `gateIdle`):

  > Idle: Willow 3 tiles from the totem needs woodcutting 90 (yours 1.0).

  and after an hour to its keeper: "Pip idle: only work above its level within 8 tiles of the totem at 40,40. Willow:
  needs woodcutting 90; have 1.0." Both name its level in the gate's skill. A sprout picker the same over its trees'
  sprouts ("Idle: Willow sprout 3 tiles from the totem needs forestry 80 (yours 1.0).").
* A worker that uses an item (a farmer's or a planter tender's seed, a planter's sprout) takes out of the stores only
  what its level may use (`sow_seed`, `worker_seeds`, `stocked_for`, `take_usable_stored`; the browser's `seedFor`,
  `planterStep`, `plantStep`); seed it may not sow stays in the stores.
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
   whole craft table falls out of the numbers players already see, and moves with them (`craftLevel`,
   `src/game/craftgates.ts`). Every recipe in `RECIPES` is on it, in its own skill (`recipe` gates, by recipe id), but
   the named ones (`CRAFT_GATE_SAID`) and a Formula's scroll: all 43 scrolls share one difficulty (14, which would put
   them all at 10), so they go by what the enchantment goes on (`FORMULA_GATE`), a tier rule as below.
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
| Veins by prospecting | `skill_gate('vein', yield)`, each seam's mining level: every vein in reach is marked and glows; a bare one (a Rock tile) is always named; a buried one over your prospecting is "Unidentified metal" in Prospect's lines, a find told to you and the tile's reading, with "More prospecting required to identify this vein." (no level: one level is one metal) (`seenVein`/`veinTip` with `exposed`, `seen_vein_at`/`vein_tip_at`), per viewer; on the wire only a buried one is masked (`mask_rock` with the tiles), and `tile_change` carries the rock of a square gone bare (`rock`); a prospector reads every seam in its circle, buried ones too, by its keeper's prospecting (`read_ground`, `readGround`) | Built (batch D: bare named; batch E: prospectors find buried) |
| Stone faces by mining | `skill_gate('stone', yield)` (`STONE_GATE`): Mine and Chip corner on a bare face, and Mine out the cellar into the rock under a building (`rockGateRefusal`, `rock_gate_refusal`, batch E); a quarrier's work at its own mining (`quarryGate`/`stone_gate`, `workerGateOpen`), idle `gate` naming the stone (`stoneIdle`/`stone_idle`) | Rock 1, sandstone 10, slate 20, marble 30. Built |
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
| Seam, stone | Mining, chipping it; mining out a cellar into it | Ore and shards held; a cellar dug |
| Tame | Taming it | Tamed wildermon |

## 8. The gate table

A = asked for; S = suggested. Levels on the ladder; crafts by the difficulty rule (§5.2) unless named.

### Woodcutting: felling a tree with logs (A) — built

| Pine, Birch | Oak | Maple | Fig, Peach | Cherry, Lemon, Apricot | Plum, Quince | Apple, Pear | Pomegranate | Cedar | Olive | Willow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | **90** |

Birch 1 and willow 90, as decided; pine least, oak and maple early: the next two steps. The rest one step a group by
their wood's difficulty (materials.ts), spread so no step is empty (decided, batch D): 0–1 → 20, 2 → 30, the four of 3
over two steps (plum and quince 40, the heavier apple and pear 50), pomegranate 60 and cedar 70 (both 4; cedar higher as
the user's example had it), olive (6) 80. Moved in batch D: apple and pear 40 → 50, pomegranate 50 → 60, cedar 50 → 70,
olive 60 → 80. Workers: the Sapgnaw line, and any hybrid at woodcut.

### Forestry: sprouts (A) — built

Picking, planting and grafting a species' sprout: **one ladder step under its felling gate** (derived, `sproutLevel`),
so you can grow a wood before you can fell it. Named in the Unlocks as "Willow sprout".

| Pine, Birch, Oak | Maple | Fig, Peach | Cherry, Lemon, Apricot | Plum, Quince | Apple, Pear | Pomegranate | Cedar | Olive | Willow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 |

Pick sprout (`pick_sprout`: the tree's species), Plant sprout (`plant`) and Graft (`graft`: the sprout's species; with
none chosen, the first sprout to hand your forestry may plant, `sproutToHand` / `sprout_to_hand`). S: grape cuttings at a
trellis 20; prune, fruit picking and tapping resin ungated. Workers: sprout pickers (`sprout`: `worker_gatherable`,
`worker_do`, `gate_idle`), planters (`plant`: only a sprout they may plant, `stocked_for`, `take_usable_stored`).

### Farming: sowing (A) — built

| Onion, Carrot, Potato | Cabbage, Wheat | Corn, Thyme | Cotton, Mint, Sage | Wemp, Basil | Rosemary |
| --- | --- | --- | --- | --- | --- |
| 1 | 5 | 10 | 20 | 30 | 40 |

Sow on a field, a glasshouse field or a garden bed (`plant_seed`, `farm_refusal`), Sow a patch (`sow_patch`), a planter
or herb box (`planter_refusal`), a herb spiral (`spiral_sow`, `adorn_refusal`; with none chosen, the first herb seed
your farming may sow). Harvest, tend and clear open to anyone. Workers: farmers (`farm`: `sow_seed`, the browser's
`seedFor`), planter tenders (`patch`: `worker_seeds`). Botanizing water plants: water lily 10, lotus 20 (`lily`
workers), built in batch F (§9).

### Cooking: recipes (A), by difficulty — built

| 1 | 5 | 10 | 20 | 30 |
| --- | --- | --- | --- | --- |
| Roasts (potato, onion, nuts, lotus seeds), cooked and fried meat, cooked fish, compote, dough, porridge, pottage | Bread, preserves, stew, broth | Cheese, butter, pastry, cherry preserves | Apple pie | Cottage pie |

Workers: cooks (`cook`), cheese presses (`cheese`), churners (`churn`). Cooked fish stay at 1: the catch is gated.

### Restoration (A), by difficulty — built

| | 10 | 20 | 30 | 40 | 50 | 60 | 70 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baubles | Minor | | | Major | | | Ancient |
| Relics | Old pot | Bone comb, seed jar, old whetstone | Old file, old collar | Old lamp, old bridle, bronze mirror | Old brace, old blade | Statuette, maker's stamp | Rune tablet, ancient helm |

Workers: restorers (`restore`). Archaeology (finding) stays ungated: finds are rolls.

### Carpentry crafts (A), by difficulty — built

| 1 | 5 | 10 | 20 | 30 | 40 | 70 | 90 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Planks, timbers, shafts, crates, fitting heads and blades, mallet, rope tool, club, thatch, compost bin, footstool, training dummy, mooring post, buoy, snare, nameplate, paper press (batch F) | Settlement stake, small den, signpost, side table, archery target, cheese rack, pedigree board | Bucket, fishing rod, lantern post, flower cart, armour stand, water trough, spice shelf, window seat, garden obelisk, game table | Work post, wooden and metal shields, medium den, rope walk, butter churn, rose/lavender arches, wisteria pergola, arbour bench, garden swing, tree bench | Large den, gazebo | Large wheel, large cart, rowing boat, deadfall | **Wagon**, sailing boat | **Caravel** |

Fine carpentry by the same rule: stool 1; coat rack, planter, trellis, boxes, sign 5; chair, bench, table, cot, coffer,
spindle, small barrel, bins … 10; bed, chest, cupboard, shelves, barrel, lectern, hive, small cart, signboard … 20;
desk, wardrobe, stall, crate shelf, bell, loom, four-poster 30; larder, large barrel 40. Wagon 70 and caravel 90 as
decided (`CRAFT_GATE_SAID`). Workers: sawyers (`saw`, `timber`, `shaft`: all 1).

### Masonry crafts (A), by difficulty — built

| 1 | 10 | 20 | 30 | 40 | 50 | 60 |
| --- | --- | --- | --- | --- | --- | --- |
| Concrete, mortar, cairn, moss boulder, **smelter** | Birdbath, stone bench, lily pond, herb spiral | Kiln, brazier, lantern pillar, sundial, stone lantern | Statue, oven, rune lantern post, memorial stone, stone arches, fireplace | Enchanter's plinth, well | Fountain | Altar |

The smelter at 1 as decided (`CRAFT_GATE_SAID`; its difficulty would put it at 30): the Path's stone phase makes one.
Workers: concrete and mortar mixers (1).

### Walls (A): material and type, in the material's skill — built

| Carpentry | Log 1 · Plank 10 · Timbercraft 20 · Glass (roof) 40 |
| --- | --- |
| **Masonry** | Cobblestone 1 · Clay adobe 5 · Clay bricks 10 · Stone brick 10 (decided; was 20) · Sandstone 30 · Slate 40 · Marble 50 · Ornate silver 60 · Stained glass 60 · Ornate gold 70 |
| **Wall type** (either) | Solid, fence, half wall, railing 1 · Window, door, fence gate 5 · Double door, arch, shop counter 10 · Bay window 20 · Iron-bound gate 30 · Hidden door 40 · Portcullis 50 · Rune gate 60 |

Materials by their bill (cheapest first), as the ladder's tier rule. A wall needs both its material's and its type's
gate (decided). A carpentry wall's gates are in carpentry and a masonry wall's in masonry, the type's gate in its
material's skill. Storeys keep their own rule. Workers: hod carriers (`hod`), each gate at its own level in the gate's
skill: a hod carrier fitting a plank wall checks its carpentry.

### Floors and paving (A) — built

* **Floors, roofs, stairs**: the material's gate above; floor type, in the material's skill: floor, roof, ladder 1 ·
  staircase 10 · spiral and single staircases 20. The garden bed is a carpentry material at 1. A column: its
  material's gate.
* **Paving** (paving): cobblestones 5 · stone slabs 10 · sandstone slabs 20 · slate slabs 30 · marble slabs 50 (Pave
  (cobblestone), Pave (slabs): the slab the go lays, the one named or else the first carried). Packing stays open.
  Stepping stones and garden steps stay ungated (decided, batch E).
* Foundations keep their depth rule.

### Enchanting: formulas (A) — built, confirmed

Writing a scroll:

| 20 | 30 | 40 | 50 |
| --- | --- | --- | --- |
| One element on a weapon, bow, armour, shield, tool or light: Emberbrand, Razoredge, Concussion, Venomfang, Gale, Nightblade, Sunstrike, Tidecaller, Farsight, Flamearrow, Frostbite, Stoneskin, Emberward, Thornhide, Bulwark, Swiftwork, Truesteel, Bountiful, Lodestone, Lantern's Grace | On jewellery, clothing and gear: Featherstep, Shadowcloak, Scholar's Band, Steady Heart, Hearthbound, Favoured, Stillwater, Packmule, Seal's Coat, Hawk's Eye, Snarecraft, Netmender, Fleetfoot, Tamer's Bridle | On a vessel, cart, store, furnace or station: Ember Heart, Fair Wind, Deep Hold, True Axle | Two elements: Leeching, Knackstone, Masterwork, Bag of Holding, Dreamweave |

### Blacksmithing: pouring, by the metal (decided) — built

Pour a mould and Cast an anvil (`pour_mould`, `cast_anvil`, `firing_refusal`), and a nail or ribbon smith's work
(`worker_smith_lumps`), in blacksmithing (`MOULD_SKILL`), by the metal poured (`METAL_GATE`, kind `metal`, named
"Iron pouring"):

| Copper, Iron | Pewter | Tin, Bronze, Brass | Zinc, Steel, Electrum | Lead | Silver, Fire-tempered steel | Gold | Adamantine | Glimmersteel | Mithril | Seryll |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 |

(An alloy at its mixing recipe's level since batch G; it was the highest of its mined metals.)

A mined metal at its seam's mining gate (`SEAM_GATE`), but iron at 1 (decided, batch E: `POUR_GATE_SAID`); an alloy at
the highest of the mined metals in its mix (bronze: copper and tin; steel: iron and coal, so iron's 1; brass: copper and
zinc; pewter: tin and lead; electrum: silver and gold). Forming the mould keeps its recipe's gate. Ingots (a Smith's
perk, `pour_ingot`) are not a mould and stay open (decided). Lumps are not unidentified: they have uses other than
pouring. Workers: a ribbon smith at blacksmithing 1 pours copper, iron and steel; a nail smith (iron) pours from 1; with
only metal over its level in the stores, idle `gate`: "Idle: Tin pouring in your settlement stores needs blacksmithing
10 (yours 1.0)."

### Smelting and working a casting, by the metal (decided, batch F) — built

One table, `METAL_GATE`, read three ways: smelting a metal's ore (kind `smelt`, in smelting), pouring it (kind `metal`,
in blacksmithing, above) and working a casting of it at the anvil (kind `casting`, in the trade the casting's mould is
worked in: blacksmithing, weaponsmithing, armorsmithing, chainsmithing, platesmithing, jewellery; id
`weaponsmithing:tin`). A mined metal's casting is at its smelting gate; an alloy's at the level of the recipe that
mixes it (batch G). A piece cast whole (a bell, a statue) has no casting gate.

| Copper, Iron | Pewter | Tin, Bronze, Brass | Zinc, Steel, Electrum | Lead | Silver, Fire-tempered steel | Gold | Adamantine | Glimmersteel | Mithril | Seryll |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 |

(An alloy at its mixing recipe's level since batch G; it was the highest of its mined metals.)

Smelt (`smelt_ore`, `firing_refusal`): "Tin smelting: needs smelting 10; have 2.3." Smith (`smith`, `forge_refusal`,
`casting_gate_refusal`): "Tin casting: needs weaponsmithing 10; have 2.3." Workers: a smelter worker and a stoker take
only ore their own smelting smelts (`worker_furnace_fits`, `workerSmeltOpen`), idle `gate` naming the lowest metal "in
your settlement stores"; a nail or ribbon smith beats out only metal its blacksmithing both pours and works out of a
casting (`worker_smith_lumps`, `workerSmithOpen`). No worker works a weapon, armour or jewellery casting. Ore, lumps and
castings are not unidentified: ore is named by the vein it was mined from, lumps and castings have other uses (melting
down, alloys).

### Every other batch F gate — built

| Gate | Skill | Levels | Stops | Workers | Unidentified |
| --- | --- | --- | --- | --- | --- |
| Graft (kind `graft`) | forestry | 50 (`GRAFT_LEVEL`) | Graft | — | — |
| Water plant (`water_plant`) | botanizing | Water lily 10 · lotus 20 (`WATER_PLANT_GATE`) | Plant a water lily or a lotus; a lily pond's Plant a water lily | Water planters (`lily`) | A lily root ("Unidentified root"); lotus seeds never (food) |
| Treasure map (`hoard`) | digging | Worn 1 · sound 20 · fine 40 · grand 60 (`MAP_GATE_PER_TIER` 20 a tier) | Dig it up (the map read under it, batch G) | — | The map, by its tier ("Unidentified map") |
| Bridge (`bridge`) | the bridge's trade | A material bridge at its material's gate (log 1, plank 10, timbercraft 20; cobblestone 1, clay adobe 5, clay bricks and stone brick 10, sandstone 30, slate 40, marble 50); garden footbridge 10, rope bridge 20, drawbridge 50, aqueduct 70 by difficulty (`bridgeLevel`) | Throw a bridge across, Work on the bridge, Lead an aqueduct here, Work on the aqueduct | Hod carriers fitting a span (`hod_may`, `hodMay`) | — |
| Stone in a circlet (`gem`) | jewellery | Topaz, garnet, onyx, amber 30 · emerald, peridot, amethyst, jasper 40 · ruby, sapphire, opal 50 · diamond 60 (`gemLevel`: the circlet's own level, a ladder step a rarer weight) | Set in circlet | — | — (gems have other uses) |
| A listed cross (`cross`) | animal husbandry | 50 (`CROSS_SKILL`) | Putting a cross to a mate | — | — |
| Spell (`spell`) | its school's skill | Ember, Snare, Aegis 1 · Pyre, Still field, Bulwark 30 (`SpellDef.level`) | Casting it | — | — |

All in the one rule's words, through one reader (`kindGateRefusal`, `kind_gate_refusal`), but a water plant's
(`waterPlantGateRefusal`: the root named as the planter sees it) and a casting's (`castingGateRefusal`).

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
| Smelting | Alloys by difficulty; ore by its metal (batch F) | Pewter 5 · bronze, brass 10 · steel, electrum 20; ore at the metal's pouring level, copper and iron 1 … seryll 90 |
| Blacksmithing, weaponsmithing, armorsmithing, chainsmithing, platesmithing, jewellery | Moulds by difficulty; pouring by the metal (built, above); working a casting at the anvil by its metal, in the casting's own trade, at the smelting level (batch F) | per mould; per metal |
| Tailoring | By difficulty | Yarn 1–10 · sack, banner, curtains 5 · cloth, needle, caps, shoes, flagpole 10 · rug, tunic, trousers, tent 20 |
| Ropemaking | By difficulty | Torch, twine, rope 1 (rope was 5, batch F) · lead rope, hanging basket 5 · hammock, skep 10 · creel, sailcloth 20 · net 30 · thick rope, rigging 40 |
| Leatherworking | By difficulty | Awl, leather 1 (were 10 and 20, batch F) · pelt rug 10 · satchel, cap, bridle, yoke 20 · toolbelt, jerkin 30 · backpack, saddle 40 · large harness 50 · scale 80–90 |
| Bowyery, fletching | By difficulty | Bowstring, short bow 1 (were 10 and 20, batch F) · medium 30 · long 40 · composite 80; blunt 1 · javelin 5 · arrows 10 · broadhead 20 · bodkin 40 |
| Glassblowing | By difficulty | Glass 5 · panel, bottle 20 · stained glass 40 |
| Alchemy, first aid | By difficulty | Candle, tea 5 · lye, dyes 10–30 · ink, tinctures 20; bandage 1 · covers, salves 10 |
| Papyrusmaking, milling, brewing | By difficulty | Papyrus 1 (was 20) and the paper press, carpentry 1 (was 20), batch F · paper lantern pole 10 · book 40 · trade book 50 (and `TRADE_BOOK_AT`); flour, juice 5 · cornmeal 10 · olive oil, cider 20; ale 10 · cider 20 · mead 30 · wine 40 |
| Repair | Kit, sealant (perk recipes) | 20 |
| Animal husbandry | Trait reading (existing) | Kept |
| Digging, botanizing | Treasure maps by tier; water plants (batch F) | Worn map 1 · sound 20 · fine 40 · grand 60; water lily 10 · lotus 20 |
| Archaeology, prospecting, foraging, tracking, butchering, climbing, swimming, chirurgy | None: finds are rolls, the rest are continuous | — |
| Prayer, meditation | Their own tiers | Kept |
| Kindling, binding, warding | Spells (batch F); elementalism's own tiers kept | Ember, Snare, Aegis 1 · Pyre, Still field, Bulwark 30 |
| Fighting and weapon skills, armour skills | None: gear is open, the skill sets the odds | — |

## 9. Built

* `src/game/skillgates.ts`: `GATE_LADDER`, `SKILL_GATES` (`TREE_GATE`, `sproutLevel`, `CROP_GATE`, `VEHICLE_GATE`),
  `CRAFT_GATE_SAID`, `gateOf`, `skillGateRefusal`, `treeGate`, `sproutGate`, `gateOpen`, `workerLevel`,
  `workerGateOpen`; items: `GATE_ITEMS`, `GATED_ITEMS`, `itemGate`, `unidentified`, `seenName`, `seenDefName`,
  `identifySaid`, `itemGateRefusal`, `workerItemOpen`; `unlocksOf`, `nextUnlockSaid`, `unlocksSaid`, `GATE_STOPS`.
* `skill_gate` and `skill_gate_item` emitted by `scripts/dump-defs.ts`; read by anybody, as the rulebook is
  (permissions.allow.ts).
* Island, the pilot (`20261120000094_skill_gates.sql`): `skill_gate_refusal`, `skill_gate_of`, `tree_gate`,
  `tree_gate_refusal`, `gate_idle`; patched `gather_refusal` (cut down), `ground_refusal` (coppice),
  `worker_gatherable`, `worker_do`, `worker_settle`, `worker_idle`, `rpc_creatures`.
* Island, batch A (`20261120000095_skill_gates_a.sql`): `worker_level`, `worker_gate_open` (the gate's own skill),
  `sprout_gate`, `sprout_gate_refusal`, `item_gate`, `unidentified_name`, `seen_name` (an item; a def with the line's own
  name), `identify_said`, `item_gate_refusal`, `worker_item_open`, `worker_seeds`, `seen_pile_text`, `sprout_to_hand`,
  `stocked_for`, `take_usable_stored`, `sow_seed`; `gate_idle` for sprouts; patched `ground_refusal` (pick sprout,
  plant, graft), `perform_ground`, `farm_refusal`, `planter_refusal`, `adorn_refusal`, `perform_adorn`, `errand_do`,
  `errand_step`, `worker_gatherable`, `worker_do`, `worker_settle`, `worker_idle`, and the names in `perform_gather`,
  `perform_hands`, `perform_crate`, `perform_holding`, `perform_farm`, `perform_planter`, `perform_relic_use`,
  `perform_counter`, `rpc_buy`, `examine_item_text`.
* Browser: the checks of `cut_down`, `coppice`, `pick_sprout`, `plant`, `graft`, `plant_seed`, `sow_patch` and the herb
  spiral's Sow; `gatherable('woodcut' | 'sprout')`, `gateIdle`, `finishFelling`, `finishHands`, `seedFor`,
  `planterStep`, `plantStep`; `IdleWhy` 'gate' and its words (`idleSays`, with the worker's levels); the Skills window's
  Unlocks, the help's Skill gates, the Path's tree step (the trees your woodcutting fells).
* Test: `supabase/test/skillgates.ts`.

### Second set (built): wagons, boats, stone; seams, taming, fish moved; veins

* `skillgates.ts`: `SEAM_GATE`, `VEIN_GATE`, `STONE_GATE`, `TAME_GATE` and `TAME_STAGE_GATE`, `FISH_GATE`,
  `VEHICLE_GATE`, `BOAT_GATE`; `KEPT_OFF_LADDER` (tame, fish); `rockGate`, `helmGate`, `seenVein`, `veinTip`,
  `UNIDENTIFIED_METAL`; `nameGates` (a kind, a fish and a piece are named by the module holding them, so this one stays
  a leaf). `ROCK_VARIANTS`, `SPECIES` and `FISH` read their levels from it.
* Island (`20261120000096_skill_gates_b.sql`): `helm_gate_refusal` (in `ride_refusal`), `face_gate_refusal` (in
  `terrain_refusal`), `stone_gate`, `stone_idle`; `tame_needs` reads the gate; `tame_gate_refusal` (in
  `creature_refusal`, `trap_refusal`); `seen_vein`, `vein_tip` (in `perform_ground`'s Prospect, `read_ground`); patched
  `worker_gatherable` and `worker_do` (quarry), `worker_settle` (`stone_idle`).
* Browser: `board_vehicle`, `mine`/`chip_corner` (`faceGateRefusal`), `tame` and `take_catch` (`tameRefusal`),
  `gatherable('quarry')`, `finishQuarry`, `stoneIdle`; Prospect, `readGround`, `groundReading`/`groundTip`, `tileSeen`.
* Test: `supabase/test/skillgates-b.ts`.

### Third set (built): recipes, restoring, building, paving, Formulas

* `src/game/craftgates.ts`, which adds its rows to the one table at load (`addGates` in `skillgates.ts`, so that module
  stays a leaf; `game.ts`, the help and `scripts/dump-defs.ts` load it): `craftLevel`, `recipeLevel`, `FORMULA_GATE`,
  `MATERIAL_GATE`, `WALL_GATE`, `FLOOR_GATE`, `PAVING_GATE`; kinds `recipe` (by recipe id; named by its title, or by
  its label or title and first input where two at different levels share a title: "Smoke the trout", "Yarn (wool)"),
  `relic` (by name), `bauble` (by tier), `material`, `wall` and `floor` (`carpentry:door`, `masonry:spiral`: one row a
  building skill; the stone-only types in masonry only), `paving`; readers `recipeGated` (recipes.ts),
  `buildGateRefusal`, `workerBuildOpen`, `workerRecipeOpen`, `hodMay`, `pavingGateRefusal`. Items: a shut recipe's
  Recipe or Formula (by its title), a relic's fragments (by relic: `gateExtra` reads "old pot" off "old pot 1/2"), a
  tarnished bauble (by tier). `nextUnlockBar`: "10: Maple", the Skills window's line beside each level.
* Island (`20261120000098_skill_gates_c.sql`): `recipe_gate_refusal` (in `craft_refusal` after a perk, a trade book's
  trade and a shut recipe's book, before the tool, the station and the makings, as `recipeReason`), `worker_recipes` and
  `recipe_gate_idle` (every store trade in `errand_step`/`errand_do`, idle `gate` naming the recipe), `gate_item_extra`
  (in `item_gate`, `identify_said`, `unidentified_name`), Restore at the gate in `dig_refusal`, finds told unidentified
  in `perform_dig`, `relic_in_stores(…, c)` for a restorer, `worker_idle` "in your settlement stores", a Formula or
  Recipe not read under its gate (`relic_use_refusal`); `floor_type`, `build_gates`, `build_gate_refusal` (plan wall,
  plan fence, build wall, plan floor, build floor in `build_refusal`; `change_wall_refusal`), `worker_build_open`,
  `hod_may`, `hod_needing(…, c)` and `hod_needing_stocked(…, c)`; `paving_gate_refusal` (`terrain_refusal`'s Pave
  (cobblestone)), `slab_to_lay` (`ground_refusal`'s Pave (slabs)).
* Browser: `recipeReason` and `recipeStatus` (`gated`: the crafting window greys the row, a padlock and the refusal as
  its hint), Restore, Read formula/recipe, the finds' lines; plan wall, plan fence, build wall, change wall, plan floor,
  build floor; Pave; workers' `recipeInStores`/`relicInStores` with the worker, `stockWhy`, `hodNeeding(…, may)`;
  `idleSays` for a store gate; the Skills window's next gate (`skill-next`), the help's recipe rule.
* Test: `supabase/test/skillgates-c.ts`. Batch A's and B's Unlocks checks now compare in level then name order and
  pick the fish out of fishing's list, since a skill's crafts are on it too.

### Fourth set (built): the answers to batch C's questions

* `skillgates.ts`: `TREE_GATE` spread (plum and quince 40, apple and pear 50, pomegranate 60, cedar 70, olive 80); kind
  `metal`; `VEIN_UNREAD`, `seenVein`/`veinTip`/`seenRock` with exposure (a Rock tile always named); `unlockRows`,
  `UNLOCKS_GROUPED_OVER`, `UNLOCK_ROW_NAMES`.
* `craftgates.ts`: `MATERIAL_GATE.stone_brick` 10; `METAL_GATE` (derived from `SEAM_GATE` and the alloys' mixes), the
  `metal` rows, `metalGate`, `metalGateRefusal`, `workerMetalOpen`.
* Island (`20261120000099_skill_gates_d.sql`): `metal_gate_refusal` (in `firing_refusal`'s
  Pour a mould and Cast an anvil, after the metal and before its lumps), `worker_smith_lumps` (nail and ribbon smiths in
  `errand_step`/`errand_do`, idle `gate` naming the metal; `worker_idle` "in your settlement stores"); `vein_tip` with
  no level, `vein_tip_at`, `seen_vein_at` (Prospect's tally and reading, `read_ground`); `mask_rock(rock, tiles, hide)`
  in `rpc_land_window` (a Rock tile never masked); `tile_change.rock` (`land_announce`, `land_out`).
* Browser: `pour_mould`, `cast_anvil` (`metalGateRefusal`); a nail or ribbon smith (`anvilStep`, `workerMetalOpen`,
  idle `gate`); `idleSays` for a metal; Prospect, `readGround`, `groundReading`/`groundTip`, `tileSeen` with exposure;
  `layChange` lays a change's rock; the Skills window's grouped Unlocks; the help's pouring and vein lines.
* Tests: the four decisions in `skillgates.ts` (trees), `skillgates-b.ts` (veins, taming grouped), `skillgates-c.ts`
  (stone brick, pouring, grouped lists); `window.ts` reads the land by exposure.

### Fifth set (built): the answers to batch D's questions

* `craftgates.ts`: `POUR_GATE_SAID` (iron 1), read in `metalLevel` before the seam's gate, so `METAL_GATE` has iron and
  steel at 1. `skillgates.ts`: `rockGateRefusal(rock, viewer, below)`, the one check for cutting a rock, bare or under a
  building. `path.ts`: `fellsSaid` (the trees your woodcutting fells, from the gates), in the site step's lines and
  `siteSays`.
* Island (iron and steel pouring at 1; `20261120000100_skill_gates_e.sql`): `read_ground`
  reads every seam in its circle, buried ones too (`seam`, any tile), each named by the keeper (`seen_vein_at`);
  `tree_fells` and `thepath_sites` counting a tree tile only where its species' gate is at or under the player's
  woodcutting; `rock_gate_refusal`, read by `face_gate_refusal` and by `cellar_refusal`'s Mine out the cellar.
* Browser: `readGround` (a prospector's find) the same; `faceGateRefusal` and Mine out the cellar through
  `rockGateRefusal`; the help's pouring line names iron's level, the site line "trees your woodcutting fells".
* Tests: `skillgates.ts` (the Guiding Light's sites at woodcutting 1 and 5, and in a wood of oak; the site step's
  words), `skillgates-b.ts` (a prospector's buried find at prospecting 1 and 5; Mine out the cellar into marble, slate
  and an iron seam), `skillgates-c.ts` (iron and steel at 1; tin refused at 2.3 and poured at 10; a fresh nail smith
  pours iron, a ribbon smith at 1 copper, iron and steel).

### Sixth set (built): the sweep's recommended gates, castings by the metal, first steps at 1

* `skillgates.ts`: kinds `graft`, `water_plant`, `hoard`, `bridge`, `smelt`, `casting`, `gem`, `cross`, `spell` and
  what each stops (`GATE_STOPS`); `GRAFT_LEVEL`; `ladderAt`, `stepsAbove`; `kindGateRefusal` (the one reader by kind and
  id, the island's `kind_gate_refusal`); `CRAFT_GATE_SAID` with the bowstring, the short bow, the awl, leather, papyrus,
  the paper press and rope at 1.
* `craftgates.ts`: the rows (`F_ROWS`): `WATER_PLANT_GATE`, `MAP_GATE_PER_TIER`, `bridgeLevel`, `SMELT_SKILL`,
  `CASTING_SKILLS`, `castingGateId`, `gemLevel`, all off the tables they name (`MATERIAL_GATE`, `craftLevel`,
  `METAL_GATE`, the circlet's recipe level, `CROSS_SKILL`, `SpellDef.level`); items: a lily root (`water_plant`, noun
  "root"; not a seed that is food), a treasure map by tier (`hoard`, noun "map"); readers `castingGate`,
  `castingGateRefusal`, `smeltGate`, `smeltGateRefusal`, `workerSmeltOpen`, `workerSmithOpen`, `waterPlantGateRefusal`,
  `waterPlantFrom`, `workerWaterPlantOpen`, `bridgeGateRefusal`, `gemGateRefusal`; `hodMay` reads a span's bridge.
* Island (`20261120000101_skill_gates_f.sql`):
  `kind_gate_refusal` in `ground_refusal` (Graft), `cross_refuses`, `spell_refusal`, `last_refusal` (Throw a bridge
  across, Work on the bridge), `aqueduct_refusal` (Lead an aqueduct here, Work on the aqueduct), `firing_refusal`
  (Smelt), `item_refusal` (Set in circlet); `water_plant_gate_refusal` in `water_garden_refusal` and `adorn_refusal`
  (a lily pond's lily); `worker_roots` and `worker_furnace_fits` in `errand_step`/`errand_do` (idle `gate` naming the
  lowest, `worker_idle` "in your settlement stores"); `hod_may` for spans; `casting_gate`, `casting_gate_refusal` in
  `forge_refusal` (Smith) and `worker_smith_lumps`; `item_gate_refusal` in `treasure_refusal` (Dig it up, and how warm)
  and `rpc_treasure_map` (Read); `bury_treasure`'s Found: line by `seen_name`.
* Browser: `graft`, `crossRefuses`, `spellRefusal`, `plant_lily`/`plant_lotus` (and their label for an unidentified
  root), a lily pond's Plant a water lily, `unearth` and the pack's Read (greyed under the gate), `plan_bridge`,
  `build_bridge`, `plan_aqueduct`, `build_aqueduct`, `smelt_ore`, `smith`, `set_in_circlet`; `furnaceStep`, `lilyStep`,
  `anvilStep`; `idleSays` for a smelt and a water plant gate; the help's metal, casting, bridge, circlet and map lines.
* Not written: no What's new line. The gating branch's batches add none (they roll out together); batch A–E's only
  touch on `news.ts` kept an existing entry compiling.
* Test: `supabase/test/skillgates-f.ts`; `hybrids.ts` reads a cross's refusal in the one wording.
* Merged with `main` (batch F): the branch's migrations now follow `main`'s, so the island applies them after what it
  already has. `main`'s and the branch's definitions files shared three names (`…064_defs`, `…073_defs`, `…075_defs`),
  so the branch's definitions files are gone and one delta from `main`'s rulebook to the merged one stands in for them
  (`20261120000093_defs.sql`, written by `npm run defs` against `main`'s rulebook: `skill_gate`, `skill_gate_item` and
  `rock_def`), followed by the hand migrations in their order: `…094_skill_gates`, `…095_skill_gates_a`,
  `…096_skill_gates_b`, `…097_unidentified_rock`, `…098_skill_gates_c`, `…099_skill_gates_d`, `…100_skill_gates_e`,
  `…101_skill_gates_f`. Merged twice: the second time after `main`'s `…089_free_roofing`, `…091_no_coinsmithing`
  (coin striking removed: nothing gated refers to it) and `…092_defs`.
* From `main`, on the rule: fire-tempered steel and obsidian, as batch G decided (below).
* CI fixes on the branch: `dyes.ts` gives its player the alchemy of every boil's gate on both sides; `seasons.ts` gives
  the browser the farming the island's player sows wheat at; `skillgates-c.ts` reads the named crafts off
  `CRAFT_GATE_SAID` and counts fire-tempered steel among a ribbon smith's metals at 1. `adorn.ts` and `motes.ts` came
  right with `main`; `skillgates.ts` and `skillgates-b.ts` pass on the merged branch.
* Tests whose players the new gates stopped, given the gate's level on both sides (derived from the table): `aqueduct`,
  `bridgestorey`, `bridgewidth`, `buildstores` (bridges), `pondlife` and `repurpose` (water plants), `head` (a worn
  map's dig); from `main`: `obsidiangear` (obsidian armour), `stairbuild` (timber and stone floors), `upperbed`
  (sowing); `newplayer` reads a first tame's refusal in the one wording.

### Seventh set (built): the answers to batch F's questions

* `skillgates.ts`: `GATE_LADDER` with 99; `OBSIDIAN_LEVEL` 99; `CRAFT_TOP` 90 (`ladderAt` takes a top); `CROP_GATE.wemp`
  1; `CRAFT_GATE_SAID` with the bucket (carpentry 1) and lye (`lye_bucket`, alchemy 1).
* `craftgates.ts`: `OBSIDIAN`; `recipeLevel` puts any recipe with obsidian in it at `OBSIDIAN_LEVEL`; a material whose
  bill has obsidian the same; `METAL_GATE` reads an alloy's mixing recipe (`alloyRecipe`, `recipeLevel`).
* Island: the rows (`20261120000093_defs.sql`); `20261120000101_skill_gates_f.sql` no longer gates `rpc_treasure_map`;
  `20261120000102_skill_gates_g.sql`: `hod_span_gate` in `errand_step` (idle `gate` naming the bridge).
* Browser: `Game.hodGatedSpan` in a hod carrier's step; the pack's Read open under the gate; the help's alloy and seed
  lines.
* Tests: `supabase/test/skillgates-g.ts`; `skillgates.ts` asks its unidentified seed of cabbage; `skillgates-c.ts` and
  `skillgates-f.ts` read alloys at their recipe's level and a map read under its gate; `obsidiangear.ts` works at 99;
  `noplan.ts` (main's free roofing) gives the island's builder the plank roof's carpentry for its one ask.
* CI on batch G: `hod_span_gate` always gives one row, its outs null with no span over the level, so a hod carrier
  with none said `gate` with no bridge; only a named bridge is a gate now (`errand_step`). `skillgates.ts` and
  `skillgates-b.ts` order the tables in code-unit order on both sides (`collate "C"`), as the server's locale sorted
  `make_ember_heart_scroll` after `make_emberbrand_scroll`. `repurpose.ts` pins a browser worker's rarity and size
  form, as the island's `ready` does.

## 10. Open questions

Answered in batch D (above): 1 (the trees), 4 (a bare vein is always named, so its mining refusal names what everybody
sees), stone brick in 6, the forge's casting in 7 (pouring gated by metal), 10 (Formulas kept). Answered in batch E: 2
(the Guiding Light counts only trees you fell), 5 (cellars by the stone's gate), 7 (all stay ungated), 11 (iron at 1),
12 (prospectors find buried veins), 13 (accepted). Still open:

3. A farmer or a planter tender with only seed over its level in the stores says "nothing to sow"; name the gate
   instead ("Idle: Wemp seeds need farming 30 (yours 1.0)" would name an unidentified thing to a keeper under 30)?
6. Recipes by difficulty move many everyday things up: bread 5, a bucket 10, a plank wall 10, lye 10 (an ash raker
   making lye now needs alchemy 10), cheese 10 for a cheese press. Keep, or start the everyday ones lower? (Stone brick
   walls answered: 10.)
8. A hod carrier whose only work is over its level says "no work"/"stock", not `gate` naming it (its idle words list
   items, not plans). Name the gate?
9. A wall type's gate is in its material's skill, so carpentry and masonry each list Door 5, Window 5 …; materials are
   named "Plank building", "Marble building" to tell them from the crafts (a "Plank" recipe is carpentry 1). Better
   names?
14. A buried vein under a building that you cannot identify is sent to your browser unidentified, but Mine out the
    cellar's refusal on the island names it with its level ("Iron vein: needs mining 5; have 1.0."), and the browser,
    which cannot know the level, greys nothing until the island answers. Say "Unidentified metal" and "More
    prospecting required to identify this vein." instead, as the tile's reading does?
15. A prospector's find now counts every seam, coal too, as Prospect always did (it counted only metal ores before).
    Keep coal in "found ore", or leave it out of a worker's find?

From batch F: 16 to 24, all answered (batch G, above). Still open from them: none.

## 11. Sweep: proposals

Every skill read for what it does (actions, recipes, items, tools, stations, workers, perks in `src/game`), what is
gated already, and what a further gate would give a player to aim at. Same framework throughout: ladder steps, the gate's
own skill, the one wording, a worker at its own level in the gate's skill, and an item unidentified where its use is
gated. Each proposal: what · level · why. ★ the ones recommended most. "Flag" marks a thing that should stay open (or
come down) because it is part of a new player's first loop: first tools, food, water, shelter. Every ★ and the flags
marked "brought down" are built (batch F, §9); the rest stay proposals.

### Gathering and the land

**Mining**. Gated: seams 1–90 (12), stone faces 1–30 (4), Mine out the cellar (batch E).

1. Ore Sense read inside the one check (`gate:mining:below`) · its perk's amount · planned at rollout (§3).
2. No new gate: every rock already has one.

**Prospecting**. Gated: veins named 1–90 (12).

1. No new gate: Prospect, a prospector and a Miner's Pan stay open; finds are rolls and reach is continuous.

**Woodcutting**. Gated: trees 1–90 (17), Cut down and Coppice; fellers.

1. No new gate. Flag: pine and birch at 1 are the first log; keep.

**Forestry**. Gated: sprouts 1–80 (17), two recipes at 5.

1. ★ Built (batch F). Graft onto the rule · 50 (`GRAFT_LEVEL`) · a level gate already, in other words ("Needs forestry 50."): "Graft:
   needs forestry 50; have 12.0.", in the Unlocks.
2. Grape cuttings planted at a trellis · 20 · vines are a later crop than bushes (S from §8).
3. Flag: pruning, picking fruit, tapping resin and clearing brush stay open (harvest is kept, §7; resin is the first
   tar).

**Foraging**. Gated: none.

1. No new gate. Flag: forage, cut grass, moss and reeds, pick flowers are the first food and the first materials.

**Botanizing**. Gated: none.

1. ★ Built (batch F). Planting a water lily · 10, a lotus · 20 (`plant_lily`, `plant_lotus`; the lily root unidentified under it, the
   lotus seed not, being food too; `lily` workers at their own botanizing) · the water garden is a late build with no step of its own (S from §8).
2. Flag: botanizing for herbs and seeds stays open (the herb seeds it finds are farming-gated already).

**Digging**. Gated: none.

1. ★ Built (batch F; reading the map open, batch G). Unearthing a treasure map by its tier · worn 1, sound 20, fine 40, grand 60 (the map unidentified under it) · the
   map's guards and loot already climb the same tiers; a found map becomes a goal.
2. Dig a spring · 10 (its difficulty 12, §5.2) · a water source anywhere is a step past the shore and the well's
   bucket.
3. Flag: dig, flatten, level, collect dirt, clay and sand, dredge, worms, Dig the cellar, stumps stay open:
   terraforming and the first clay and sand.

**Fishing**. Gated: fish 1–70 (8, a pool filter), 10 recipes 1–20 (rod, fish pond, mount …).

1. No new gate. Flag: the rod and the first fish at 1.

**Tracking**. Gated: none.

1. No new gate: reach grows with the skill.

**Archaeology**. Gated: none (finds already scale: a relic turns up within 14 of your level, `relicsWithin`).

1. No new gate: finds are rolls; restoring is gated in restoration.

**Butchering**. Gated: none.

1. A lair guard's carcass (goblin, orc, ogre, dragon) · 10, 20, 40, 60 by its treasure tier · the rare parts off a
   monster are a goal; wildermon and game stay open.
2. Flag: every animal carcass at 1 (the first meat and hide).

### Building

**Carpentry**. Gated: 73 recipes 1–90, materials 1–40, wall types 1–40, floor types 1–20.

1. ★ Built (batch F). Bridges by difficulty, in carpentry · garden footbridge 10 (d14), rope bridge 20 (d18), drawbridge 50 (d34);
   a log, plank or timbercraft bridge at its material's gate · bridges are big builds with no gate; hod carriers at
   their own level.
2. Flag: the campfire, the first planks, shafts and crates at 1.

**Fine carpentry**. Gated: 51 recipes 1–40.

1. No new gate.

**Masonry**. Gated: 25 recipes 1–60, materials 1–70, wall types 1–60, floor types 1–20, foundation depth, storeys.

1. ★ Built (batch F). Stone bridges and aqueducts · a bridge at its material's gate (cobblestone 1 … marble 50), the aqueduct 70 (d44) ·
   the same rule as walls, for the largest stone builds.
2. Dig a pool · by its difficulty (§5.2) · a garden build past the birdbath and lily pond.
3. Flag: raise rock, rubble fill, a Mason's Repoint (decided open) stay open.

**Paving**. Gated: cobblestones 5, slabs 10–50.

1. No new gate. Stepping stones and garden steps stay open (decided). Flag: packing a road at 1.

**Stonecutting**. Gated: 12 recipes 5–40.

1. No new gate.

**Pottery**. Gated: 10 recipes 1–20.

1. Glazing an item · by its difficulty (§5.2) · a finishing step with no gate of its own.
2. Flag: bricks, bowls and adobe at 1.

### Making

**Cooking**. Gated: 33 recipes 1–30.

1. No new gate. Flag: roasts, cooked meat and fish at 1.

**Milling**. Gated: 16 recipes 5–20; millers.

1. No new gate. Flag: milling 1 makes nothing (flour and juice 5); consider flour at 1 with §10's question 6.

**Brewing**. Gated: 5 recipes at 20 (spirit).

1. No new gate: brews set going at a barrel stay open (decided).

**Smelting**. Gated: 5 alloys 5–20.

1. ★ Built (batch F). Smelting ore by its metal · the metal's pouring level (copper and iron 1, tin 10 … seryll 90), in smelting;
   stokers that charge smelters at their own smelting · the trade that makes the lumps gets the ladder pouring has.

**Blacksmithing**. Gated: 48 recipes 1–60 (moulds and tools), pouring by metal (16).

1. Dropped: striking coins. Coin striking is removed from the game (on `main`, a separate change), so it is not gated.
2. Flag: improving, repairing and fitting padlocks stay open (§7).
3. Built (batch F): working a casting at the anvil by its metal, at the smelting level, in the casting's own trade
   (blacksmithing's tool heads, nails and ribbons too).

**Weaponsmithing, armorsmithing, chainsmithing, platesmithing**. Gated: working a casting by its metal (batch F: the
smelting level, tin 10 … seryll 90); their moulds are formed and poured in blacksmithing.

1. Each trade's moulds formed in its own trade · by difficulty (sword blade 20, long sword blade 30, helm 20, chain
   hauberk 40) · otherwise these four trades have no step at all; changes `MOULD_SKILL` from one trade to the mould's.

**Jewellery**. Gated: 5 recipes 5–30.

1. ★ Built (batch F). Setting a gem in a circlet by its rarity, from the circlet's own 30 · topaz, garnet, onyx, amber 30; emerald,
   peridot, amethyst, jasper 40; ruby, sapphire, opal 50; diamond 60 (`GEMS` weight 4, 3, 2, 1) · the stones are the
   trade's natural ladder past its last recipe. Gems have other uses (spells, rings), so not unidentified.

**Glassblowing**. Gated: 4 recipes 5–40; glass roofs carpentry 40.

1. No new gate.

**Tailoring**. Gated: 18 recipes 1–20.

1. No new gate. Flag: yarn at 1.

**Ropemaking**. Gated: 14 recipes 1–40.

1. Flag, brought down (batch F, as the user asked): rope at 1 (was 5, d10); twine and the torch were 1 already, and
   nothing else in ropemaking comes before rope (its wemp fibre is a crop: §10 question 16).

**Leatherworking**. Gated: 25 recipes 10–90.

1. ★ Flag, brought down (batch F, as the user asked): leatherworking 1 made nothing: the awl and the pelt rug are 10, leather 20. Start the awl and leather at 1
   (`CRAFT_GATE_SAID`).

**Bowyery, fletching**. Gated: 5 bows 10–80; 5 arrows 1–40.

1. ★ Flag, brought down (batch F): bowyery 1 made nothing: the bowstring is 10 and the short bow 20. Start both at 1 (`CRAFT_GATE_SAID`), as
   blunt arrows are.

**Alchemy**. Gated: 22 recipes 5–30.

1. No new gate: dyeing, painting and stripping stay open; dye-recipe sheets stay open (decided). Flag: lye at 10 (§10
   question 6).

**Papyrusmaking**. Gated: 17 recipes 10–50; trade books 50.

1. Flag, brought down (batch F, as the user asked: "papyrus milling"): papyrus at 1 (was 20), and the paper press it
   is pressed at, the step before it, carpentry 1 (was 20); §10 question 17.

**Enchanting**. Gated: 43 Formulas 20–50.

1. No new gate: a written scroll is used by anybody.

**Restoration**. Gated: relics 10–70 (14), baubles 10/40/70.

1. No new gate.

**Repair**. Gated: kit and sealant (perk recipes) 20.

1. No new gate: repairing is never stopped (§7).

**First aid, chirurgy**. Gated: 11 first aid recipes 1–10; chirurgy none.

1. No new gate. Flag: bandages and binding a wound at 1.

### Creatures, travel, the body

**Taming**. Gated: 77 kinds 1–50, +15 a stage.

1. No new gate.

**Animal husbandry**. Gated: trait reading 0/15/35/60, one recipe.

1. ★ Built (batch F). A listed cross onto the rule · 50 (`CROSS_SKILL`) · a level gate already, in other words; "Cross: needs animal
   husbandry 50; have 12.0.", in the Unlocks.
2. Flag: milking, shearing, grooming, hives and breeding a pair stay open (first wool, milk and honey).

**Driving**. Gated: the wagon 30.

1. No new gate (the large cart open, decided).

**Sailing**. Gated: rowing boat 1, sailing boat 20, caravel 50.

1. No new gate: a gale's safety (`GALE_SAFE_AT`) is a continuous rule.

**Climbing, swimming**. Gated: none.

1. No new gate: both are continuous.

**Kindling, binding, warding (elementalism)**. Gated: Ember, Snare, Aegis 1; Pyre, Still field, Bulwark 30, in their own
words ("Pyre takes 30 kindling; you have 12.").

1. ★ Built (batch F). Spells onto the rule (kind `spell`) · kept at 1 and 30 · "Pyre: needs kindling 30; have 12.0.", in each school's
   Unlocks. Elementalism keeps its own tiers.

**Prayer, praying, meditation**. Gated: their tiers (faith, path).

1. No new gate: tiers are choices, not things refused (§6).

**Fighting; swords, axes, mauls, knives, polearms, archery, throwing, shields**. Gated: none.

1. No new gate. Flag: gear stays open; the skill sets the odds, and a weapon gate would leave a new player unarmed.

**Cloth, leather, chain and plate armour**. Gated: none.

1. No new gate. Flag: wearing armour stays open; the skill sets the protection.

**Body strength, body stamina, body control, mind logic, soul strength, awareness**. Gated: none.

1. No new gate: characteristics, raised by everything else.

## 12. Unidentified items

Asked for: "items picked up that you cant use yet show as "unidentified ", e.g. a player with 20 farming sees
"unidentified seed" for a wemp seed. Tooltip shows just "30 farming required to identify this seed"".

* **Which**: every item whose use a gate stops. Each kind of gate names its items (`GATE_ITEMS`): a crop its seed
  (`wemp_seed`), a species its sprout (`sprout` with the species as `extra`). Emitted as `skill_gate_item (item, extra,
  kind, id, noun)`, so a gate added on an item (a formula, a relic, a bauble: batch C) makes it unidentified with
  nothing else written: add its kind to `GATE_ITEMS`.
* **The noun**: from the data: a seed's id after its crop ("seed"), a sprout's own name ("sprout").
* **Per viewer**: under the gate's level in its skill, the item is "Unidentified seed" to that person
  (`seenName(item, viewer)`, `seen_name(world, uid, item)`); at it, its own name. A crate seen by a player at farming 20
  and one at 40 names the same stack each way.
* **The tooltip and the examine**: exactly "30 farming required to identify this seed." and nothing else
  (`identifySaid`, `identify_said`; `itemCard`, `examine_item_text`), the market price line left off too.
* **Everywhere a name is made**: the pack, crates and stores (`nameCell`), the trade window, the market and counters,
  tooltips, the crafting window's inputs, the context menu (Sow, Plant sprout, Graft, a herb spiral's seeds), a
  worker's card ("Carrying"), and the island's lines: Found:, Picked up:, Dropped:, put in and taken from crates and
  stores, Harvested: (the seed), an ancient seed jar, set out on and bought off a counter (to the buyer and to the
  seller, each as they see it).
* **Refusals**: using one names it as you see it: "Unidentified seed: needs farming 30; have 20.0."
  (`itemGateRefusal`, `item_gate_refusal`). Gathering, picking up, carrying, storing, trading and selling stay open.

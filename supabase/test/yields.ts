/**
 * What gathering gives, said where it is decided.
 *
 *   * a spot picked over says when it is ready again, to the second, on the
 *     island and in the browser alike, for every kind of ground work with a
 *     wait: forage, botanize, cut grass, cut moss, cut reeds, pick fruit, cut
 *     a bush, pick a sprout and investigate -- the browser reading the wait
 *     off the island's `foraged` rows as `Island.refreshForaged` hands them;
 *   * the waits, the words for them, the find chance, the hook's hold and the
 *     ceiling a roll of quality reaches are the island's own numbers;
 *   * the tile window's lines and the menu's labels for each loop say them,
 *     at sample states: fresh ground and ground searched, water, a fruit tree
 *     and a bush in and out of season, a field, bare rock.
 *
 * Runs against the database the suite leaves behind, in a transaction it
 * rolls back: Hoarding.
 *
 *   npx esbuild supabase/test/yields.ts --bundle --platform=node --format=esm \
 *     --external:typescript --outfile=node_modules/.cache/yields.mjs && node node_modules/.cache/yields.mjs
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { FORAGE_COOLDOWN, Game, SPROUT_COOLDOWN } from '../../src/game/game';
import { EMPTY_CHANCE, FIND_CHECK } from '../../src/game/forage';
import { FISH, fishable, staysOn, waterDepth } from '../../src/game/fishing';
import { cropYield, describeCrop, RIPE, seedSays } from '../../src/game/farming';
import { fruitsAt } from '../../src/game/fruiting';
import { itemDef } from '../../src/game/items';
import { findChance, qlCap, searchPasses, seasonWindow } from '../../src/game/yields';
import { readyIn, waitWords } from '../../src/game/words';
import { tileUses, yieldLines } from '../../src/ui/tileinfo';
import { BUSH_DEFS, packTreeData, TileType, TREE_AGES, TREE_DEFS } from '../../src/world/tiles';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const now = Date.now() / 1000;
const AGO = 40;
const MATURE = TREE_AGES.find((a) => a.name === 'Mature')?.id ?? 1;
// Something in season now off a tree and off a bush, for the refusals that come after the season's.
const tree = TREE_DEFS.findIndex((t) => !!t.fruit && fruitsAt(t.fruit, now));
const bush = BUSH_DEFS.findIndex((b) => !!b.yields && fruitsAt(b.yields, now));
const outTree = TREE_DEFS.findIndex((t) => !!t.fruit && !fruitsAt(t.fruit, now));

/* ---- the island: every wait, and the refusal for each kind with AGO seconds gone ---- */
type Case = { action: string; kind: string; tile: number; data: number };
const CASES: Case[] = [
  { action: 'forage', kind: 'forage', tile: TileType.Grass, data: 0 },
  { action: 'botanize', kind: 'botanize', tile: TileType.Grass, data: 0 },
  { action: 'cut_grass', kind: 'grass', tile: TileType.Grass, data: 0 },
  { action: 'cut_moss', kind: 'moss', tile: TileType.Moss, data: 0 },
  { action: 'cut_reeds', kind: 'reed', tile: TileType.Reed, data: 0 },
  { action: 'pick_sprout', kind: 'sprout', tile: TileType.Tree, data: packTreeData(0, MATURE) },
  { action: 'investigate', kind: 'dig', tile: TileType.Grass, data: 0 },
  ...(tree >= 0 ? [{ action: 'pick_fruit', kind: 'forage', tile: TileType.Tree, data: packTreeData(tree, MATURE) }] : []),
  ...(bush >= 0 ? [{ action: 'harvest_bush', kind: 'forage', tile: TileType.Bush, data: bush }] : []),
];
const refusalFn = (action: string): string =>
  action === 'forage' || action === 'botanize' ? 'gather_refusal' : action === 'investigate' ? 'dig_refusal' : 'ground_refusal';
const WAITS = [0.2, 40, 59.5, 60, 130, 179.999, 3600, 3599.5, 3900];

const out = psql(`
begin;
create temp table said (k text, v text) on commit drop;
do $$
declare w uuid; u uuid; p record; tx int; ty int; t jsonb;
begin
  select id into w from world where name = 'Hoarding';
  select * into p from player where world_id = w order by uid limit 1;
  u := p.uid;
  tx := floor(p.x)::int + 1; ty := floor(p.y)::int;
  t := jsonb_build_object('kind', 'tile', 'x', tx, 'y', ty);
  perform give(w, u, 'carving_knife', 1, 30);
  perform give(w, u, 'sickle', 1, 30);
  perform give(w, u, 'trowel', 1, 30);
  insert into said values ('forage_cooldown', forage_cooldown()::text), ('sprout_cooldown', sprout_cooldown()::text);
  insert into said values ('find', ((1 - forage_empty()) * least(0.98, greatest(0.3, 0.6 + (20 / 100.0) * 0.38 - find_check() / 150.0)))::text);
  insert into said values ('hold', stays_on(20, 25, true, 0)::text);
  ${WAITS.map((s, i) => `insert into said values ('wait${i}', wait_words(${s}));`).join('\n  ')}
  ${CASES.map((c) => `
  perform land_set_tile(w, tx, ty, ${c.tile});
  perform land_set_data(w, tx, ty, ${c.data});
  delete from foraged where world_id = w and foraged.x = tx and foraged.y = ty;
  insert into said values ('${c.action}:fresh', coalesce(${refusalFn(c.action)}(w, u, '${c.action}', t), 'null'));
  insert into foraged (world_id, x, y, kind, at) values (w, tx, ty, '${c.kind}', now() - make_interval(secs => ${AGO}));
  insert into said values ('${c.action}:left', foraged_left(w, tx, ty, '${c.kind}')::text);
  insert into said values ('${c.action}', coalesce(${refusalFn(c.action)}(w, u, '${c.action}', t), 'null'));`).join('')}
end $$;
select string_agg(k || '=' || coalesce(v, 'null'), E'\\n' order by k) from said;
rollback;`);
const island = (k: string): string => out.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1) ?? 'unsaid';

check('a spot stays picked over as long on both sides, and a tree its hour',
  Number(island('forage_cooldown')) === FORAGE_COOLDOWN && Number(island('sprout_cooldown')) === SPROUT_COOLDOWN,
  `island ${island('forage_cooldown')}/${island('sprout_cooldown')}, browser ${FORAGE_COOLDOWN}/${SPROUT_COOLDOWN}`);
const words = WAITS.map((s) => waitWords(s));
check('a wait is said in the same words on both sides',
  WAITS.every((_, i) => island(`wait${i}`) === words[i]), WAITS.map((_, i) => `${island(`wait${i}`)}|${words[i]}`).join(', '));
check('and in these', words.join(', ') === '1 s, 40 s, 1 min, 1 min, 2 min 10 s, 3 min, 1 h, 1 h, 1 h 5 min', words.join(', '));

/* ---- the browser, as the island's rows reach it ---- */
const game = Game.create(4242);
const tx = game.player.tileX + 1, ty = game.player.tileY;
const at: Target = { kind: 'tile', x: tx, y: ty, cx: tx, cy: ty };
game.inventory.add('carving_knife', { ql: 30 });
game.inventory.add('sickle', { ql: 30 });
game.inventory.add('trowel', { ql: 30 });
for (const c of CASES) {
  const def = ACTION_BY_ID.get(c.action);
  if (!def?.check) {
    check(`${c.action} is an action with a check`, false);
    continue;
  }
  game.world.setTile(tx, ty, c.tile as TileType, c.data);
  game.foragedFromIsland([]);
  const fresh = def.check(at, game) ?? 'null';
  game.foragedFromIsland([{ x: tx, y: ty, kind: c.kind, ago: AGO }]);
  const left = game.foragedLeft(tx, ty, c.kind);
  const said = def.check(at, game);
  check(`${c.action}: picked over ${AGO} s ago, refused in the island's words with the wait`,
    said === island(c.action) && !!said?.endsWith(readyIn(left)) && Math.abs(left - Number(island(`${c.action}:left`))) < 1e-6,
    `browser "${said}" (${left}), island "${island(c.action)}" (${island(`${c.action}:left`)})`);
  check(`${c.action}: and allowed on both sides before`, fresh === 'null' && island(`${c.action}:fresh`) === 'null',
    `browser ${fresh}, island ${island(`${c.action}:fresh`)}`);
}
check('a tree and a bush in season were found to try', tree >= 0 && bush >= 0, `tree ${tree}, bush ${bush}`);

/* ---- the numbers behind the labels ---- */
const set = (id: string, v: number): void => {
  game.skills.values.set(id, v);
};
set('foraging', 20); set('fishing', 20); set('forestry', 25); set('mining', 30); set('farming', 22);
check('the find chance a label says is the island\'s', Math.abs(findChance(game, 'forage', 'foraging') - Number(island('find'))) < 1e-9,
  `browser ${findChance(game, 'forage', 'foraging')}, island ${island('find')}`);
check('and the browser rolls it the same way', Math.abs(findChance(game, 'forage', 'foraging') - (1 - EMPTY_CHANCE) * game.skillChance('foraging', FIND_CHECK)) < 1e-12);
check('the hold a fishing label says is the island\'s', Math.abs(staysOn(20, 25, true, 0) - Number(island('hold'))) < 1e-9,
  `browser ${staysOn(20, 25, true, 0)}, island ${island('hold')}`);
// The ceiling: the luckiest roll comes to it, and none goes past it.
const rolls = (r: number, skill: string, tool: number): number => {
  const was = game.rand;
  game.rand = () => r;
  const ql = game.productQl(skill, tool);
  game.rand = was;
  return ql;
};
for (const [skill, tool] of [['foraging', 0], ['fishing', 25], ['mining', 30]] as const) {
  const top = game.qlCeiling(skill, tool);
  const best = Math.max(rolls(1 - 1e-12, skill, tool), rolls(0, skill, tool));
  check(`${skill} with a tool of ${tool}: no roll past the ceiling, and the best comes to it`,
    [0, 0.3, 0.7, 1 - 1e-12].every((r) => rolls(r, skill, tool) <= top + 1e-9) && Math.abs(best - top) < 1e-6, `${best} of ${top}`);
}

/* ---- the menu's labels ---- */
const label = (id: string, t: Target = at): string => ACTION_BY_ID.get(id)?.labelFor?.(t, game) ?? 'none';
const pc = (p: number): string => `${Math.round(p * 100)}%`;
game.world.setTile(tx, ty, TileType.Grass, 0);
game.foragedFromIsland([]);
const passes = searchPasses(game, 'forage', 'foraging');
check('Forage says its looks, the chance of each, and its ceiling',
  label('forage') === `Forage (${passes > 1 ? `${passes} passes at ` : ''}${pc(findChance(game, 'forage', 'foraging'))}, QL ≤${qlCap(game.qlCeiling('foraging'))})`,
  label('forage'));
game.inventory.add('pickaxe', { ql: 30 });
game.world.setTile(tx, ty, TileType.Rock, 0);
check('Mine says its chance and its ceiling, no more than the rock holds',
  /^Mine \(\d+%, QL ≤\d+\)$/.test(label('mine')) && label('mine').includes(pc(game.sureChance('mine', 'mining', 12, 30))), label('mine'));
game.world.setTile(tx, ty, TileType.Tree, packTreeData(0, MATURE));
check('Pick sprout says its chance and its ceiling',
  label('pick_sprout') === `Pick sprout (${pc(game.sureChance('pick_sprout', 'forestry', 15))}, QL ≤${qlCap(game.qlCeiling('forestry'))})`, label('pick_sprout'));

/* ---- the tile window and the hover ---- */
game.world.setTile(tx, ty, TileType.Grass, 0);
game.foragedFromIsland([]);
const fresh = yieldLines(game, tx, ty);
check('fresh grass: forage and botanize ready, with their odds and ceilings',
  fresh.includes(`Forage: ready · ${passes > 1 ? `${passes} passes at ` : ''}${pc(findChance(game, 'forage', 'foraging'))} · QL up to ${qlCap(game.qlCeiling('foraging'))}`)
  && fresh.some((l) => l.startsWith('Botanize: ready · ')), fresh.join(' | '));
game.foragedFromIsland([{ x: tx, y: ty, kind: 'forage', ago: AGO }, { x: tx, y: ty, kind: 'grass', ago: 10 }]);
const searched = yieldLines(game, tx, ty);
check('searched grass: the wait left, and the grass cut beside it',
  searched.includes(`Forage: searched · ready in ${waitWords(FORAGE_COOLDOWN - AGO)}`) && searched.includes(`Grass: cut · ready in ${waitWords(FORAGE_COOLDOWN - 10)}`)
  && searched.some((l) => l.startsWith('Botanize: ready')), searched.join(' | '));
check('the tile window says the same, and the finds out of season',
  searched.every((l) => tileUses(game, tx, ty).includes(l)), tileUses(game, tx, ty).join(' | '));

if (tree >= 0) {
  game.world.setTile(tx, ty, TileType.Tree, packTreeData(tree, MATURE));
  game.foragedFromIsland([{ x: tx, y: ty, kind: 'sprout', ago: AGO }]);
  const lines = yieldLines(game, tx, ty);
  const fruit = itemDef(TREE_DEFS[tree].fruit ?? '').name;
  check('a fruit tree in season: how long the season has left, ready, its ceiling; the sprout picked and its wait',
    lines.includes(`${fruit}: ${seasonWindow(TREE_DEFS[tree].fruit ?? '', game.wallNow())} · ready · QL up to ${qlCap(game.qlCeiling('forestry'))}`)
    && lines.includes(`Sprout: picked · ready in ${waitWords(SPROUT_COOLDOWN - AGO)}`), lines.join(' | '));
}
if (outTree >= 0) {
  game.world.setTile(tx, ty, TileType.Tree, packTreeData(outTree, MATURE));
  const lines = yieldLines(game, tx, ty);
  check('a fruit tree out of season: when it comes in', lines.some((l) => /: out of season until \w+, in /.test(l)), lines.join(' | '));
}
// A season's window ends where the season does: in season a moment before, and out of it after.
for (const t of TREE_DEFS.filter((d) => !!d.fruit)) {
  const id = t.fruit ?? '';
  const said = seasonWindow(id, now) ?? '';
  const m = said.match(/^in season, (?:(\d+) days?)?(?: and )?(?:(\d+) hours?)?(?:(\d+) minutes?)?/);
  if (!m) continue;
  const secs = (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 3600 + Number(m[3] ?? 0) * 60;
  check(`${id}: in season for as long as it says`, fruitsAt(id, now + secs - 3600) && !fruitsAt(id, now + secs + 3600), said);
  break;
}

// Water: what a line brings up here at this hand.
let water: { x: number; y: number } | null = null;
for (let y = 2; y < game.world.h - 2 && !water; y++) {
  for (let x = 2; x < game.world.w - 2; x++) {
    if (fishable(game, x, y) && waterDepth(game, x, y) >= FISH[2].depth && waterDepth(game, x, y) < FISH[3].depth) {
      water = { x, y };
      break;
    }
  }
}
if (water) {
  game.inventory.add('fishing_rod', { ql: 25 });
  // A hand short of the third fish's level, in water deep enough for it.
  set('fishing', FISH[2].level - 1);
  const lines = yieldLines(game, water.x, water.y);
  const top = qlCap(game.qlCeiling('fishing', 25));
  set('fishing', 20);
  check('water: the fish this hand can land here, their ceiling, and the one that wants more fishing',
    lines.includes(`Fish: ${FISH.slice(0, 2).map((f) => f.name.toLowerCase()).join(', ')} · QL up to ${top}`)
    && lines.includes(`Fish at higher fishing: ${FISH[2].name.toLowerCase()} at ${FISH[2].level}`), lines.join(' | '));
  game.player.x = water.x + 0.5;
  game.player.y = water.y + 0.5;
  const fish = label('fish', { kind: 'tile', x: water.x, y: water.y, cx: water.x, cy: water.y });
  check('Fish says the hold and the ceiling', /^Fish( with [a-z ]+)? \(stay on \d+%, QL ≤\d+\)$/.test(fish), fish);
} else check('a stretch of water to fish was found', false);

// A field: what a harvest gives, and the whole way to ripe.
game.world.setTile(tx, ty, TileType.Field, 0);
const uses = tileUses(game, tx, ty);
check('a field says what a harvest gives, untended and tended',
  uses.includes(`Harvest: ${cropYield(0).produce} untended, ${cropYield(RIPE).produce} tended every stage; ${seedSays()}`) && !uses.some((l) => l.includes('only the seed')),
  uses.join(' | '));
const crop = game.plantCrop(tx, ty, 'onion', 18);
const line = (): string => describeCrop(crop, game.cropPer(crop), game.growNow(crop), game.wallNow(), 0, game.qlCeiling('farming'));
const sown = line();
crop.stage = RIPE - 1;
const last = line();
crop.stage = RIPE;
const ripe = line();
check('a crop says the whole way to ripe while more than a stage is left, and its harvest\'s ceiling',
  // The stage before ripe says "ripe in" once, as its next stage; earlier ones say it twice, the second for the whole way.
  (sown.match(/ripe in /g) ?? []).length === 1 && sown.includes(' · sprouting in ') && (last.match(/ripe in /g) ?? []).length === 1 && ripe.includes('ready to harvest')
  && ripe.endsWith(` · harvest QL up to ${Math.ceil((18 + game.qlCeiling('farming')) / 2 - 1e-9)}`), `${sown} | ${last} | ${ripe}`);

for (const l of [...ok, ...bad]) console.log(l);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`yields: what gathering gives, said where it is decided — ${ok.length} of ${ok.length}`);

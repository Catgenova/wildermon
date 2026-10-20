/**
 * A rune lantern post (`runelantern.ts`), on both sides.
 *
 * Asked for: "a squat carved stone pillar, waist to chest high, with one band
 * of runes round it that glows: street lighting in the runestones' style.
 * Made with masonry from stone bricks and light motes, placed like other
 * furniture. It lights like a lantern of its QL (the game's lantern reach
 * rule, as the lantern post does) and never needs fuel: it does not burn oil
 * or candles and never goes out."
 *
 * The two sides are held to the same rules and words:
 *
 *   * its recipe -- masonry with a trowel, stone bricks and light motes, at
 *     the same difficulty and time -- its item, with the description that
 *     says its reach off the lantern's rule, and its piece, which gathers
 *     moss as a statue does;
 *   * built: refused in the same words short of light motes, then built,
 *     taking the bricks and the motes, on both sides;
 *   * set down on open ground as any piece is, at the quality it was made
 *     at, and kept out of a cellar in the same words; picked up again with
 *     nothing to take down first; and none of a lantern post's five jobs --
 *     fitting a lantern, a candle, a light, putting it out, taking it down --
 *     ever applies to it, refused alike;
 *   * what a browser on the island is sent of it, and what it makes of that:
 *     its kind, its quality and when its moss began;
 *
 * and then what it does, which is the browser's to draw and see by, off the
 * same `lantern_reach` the island holds: at night a light of a lantern's
 * reach at its quality, at every quality the island's own number, in the
 * runestones' pale gold, from the middle of the pillar; none by day; the
 * ground round it in sight from thirty tiles off in the dark; and after
 * hours of burning, still lit, with no fuel in it -- there is none to burn.
 *
 * Builds a world of its own on the database the suite leaves behind; the
 * island's half is one transaction, rolled back.
 *
 *   npx esbuild supabase/test/runelantern.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/runelantern.mjs && node node_modules/.cache/runelantern.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game, DAY_SECONDS } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef } from '../../src/game/actions';
import { ITEM_DEFS } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { furnitureDef, furnitureState, type PlacedFurniture } from '../../src/game/furniture';
import { cellarPieceReason } from '../../src/game/cellar';
import { burnLamps } from '../../src/game/lamps';
import { lanternReach, RUNESTONE_CAST } from '../../src/game/light';
import { isRuneLantern, runeLanternLight, runeLanternReach } from '../../src/game/runelantern';
import { numberWord } from '../../src/game/words';
import { TileType } from '../../src/world/tiles';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
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
const same = (what: string, mine: string | null | undefined, theirs: string | undefined, want?: string | null): void => {
  const m = mine ?? 'ALLOWED';
  const t = theirs ?? 'MISSING';
  check(what, m === t && (want === undefined || m === (want ?? 'ALLOWED')), `browser "${m}", island "${t}"`);
};

const KIND = 'rune_lantern';
const MAKE = `make_${KIND}`;
const def = furnitureDef(KIND);
const recipe = RECIPE_BY_ID.get(MAKE);
const item = ITEM_DEFS[KIND];

/* ---- what it is, on both sides --------------------------------------------- */

check('a rune lantern post is a piece of furniture with runes of its own, which gathers moss, and takes no lantern',
  !!def.runes && !!def.mossy && !def.lamp && def.w === 1 && def.h === 1 && isRuneLantern({ kind: KIND }));
const isleRecipe = psql(`select skill || '|' || tool || '|' || difficulty || '|' || base_time || '|' || result || '|' || count
  || '|' || (select string_agg(item || 'x' || count, ',' order by ord) from recipe_input where recipe = r.id) from recipe r where id = '${MAKE}'`);
const mineRecipe = `${recipe?.skill}|${recipe?.tool}|${recipe?.difficulty}|${recipe?.baseTime}|${recipe?.result}|1|${recipe?.inputs.map((i) => `${i.item}x${i.count ?? 1}`).join(',')}`;
check(`it is built with masonry and a trowel from ${recipe?.inputs.map((i) => `${i.count ?? 1} ${i.item}`).join(' and ')}, the same on both sides`,
  isleRecipe === mineRecipe && recipe?.skill === 'masonry' && recipe?.tool === 'trowel'
    && recipe.inputs.some((i) => i.item === 'stone_brick') && recipe.inputs.some((i) => i.item === 'light_mote') && recipe.inputs.length === 2,
  `browser ${mineRecipe}, island ${isleRecipe}`);
const isleItem = psql(`select name || '|' || weight || '|' || description from item_def where id = '${KIND}'`);
check('its item is called, weighs and is described the same on both sides', isleItem === `${item.name}|${item.weight}|${item.description}`, `island ${isleItem}`);
check(`and the description says what it lights off the lantern's rule: ${numberWord(lanternReach(1))} tiles at the roughest, ${numberWord(lanternReach(100))} at the best, no lantern, no candle, never out`,
  !!item.description?.includes(`${lanternReach(1)} tiles at lowest QL, ${lanternReach(100)} at best`)
    && !!item.description?.includes('No lantern, no candle; never goes out') && !item.description.includes('{'), item.description);
const isleDef = psql(`select mossy || '|' || w || '|' || h || '|' || cellar_outdoor(id) from furniture_def where id = '${KIND}'`);
check('its piece gathers moss and stands on a subtile on the island too', isleDef === 'true|1|1|true', isleDef);
same('it is kept out of a cellar in the same words', cellarPieceReason(def), psql(`select cellar_piece_reason('${KIND}')`), 'Rune lantern post: not in a cellar.');
const QLS = [1, 12, 13, 37, 38, 62, 63, 87, 88, 100];
const isleReach = psql(`select string_agg(lantern_reach(q)::text, ',' order by q) from unnest(array[${QLS.join(',')}]::double precision[]) q`);
const mineReach = QLS.map((q) => runeLanternReach({ ql: q })).join(',');
check(`it throws what the island's lantern of its quality throws, at every quality: ${mineReach}`,
  isleReach === mineReach && QLS.every((q) => runeLanternReach({ ql: q }) === lanternReach(q)), `browser ${mineReach}, island ${isleReach}`);

/* ---- on the island ------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-0000000000a1';
const X = 10, Y = 10;
const count = (d: string): string => `coalesce((select sum(count) from item where world_id = w and holder = 'player' and holder_uid = u and def = '${d}'), 0)`;
const out = psql(`
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language sql volatile as $f$ select 0.01::double precision $f$;
-- Nothing made here comes out rare: a rare thing is its own pile.
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; v_b bigint; v_rl bigint; v_p bigint; v_t jsonb; v_row jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Rune lanterns', 131, 64, ${X}, ${Y}, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = ${X} + 0.5, y = ${Y} + 0.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'masonry', 90) on conflict (world_id, uid, id) do update set value = excluded.value;
  perform give(w, u, 'trowel', 1, 50);
  v_b := give(w, u, 'stone_brick', 8, 40);
  perform give(w, u, 'light_mote', 2, 40);

  -- Short of a light mote, and then built.
  insert into said values ('SHORT', coalesce(act_refusal(w, u, '${MAKE}', jsonb_build_object('kind', 'item', 'uid', v_b)), 'ALLOWED'));
  perform give(w, u, 'light_mote', 1, 40);
  insert into said values ('ASK', coalesce(act_refusal(w, u, '${MAKE}', jsonb_build_object('kind', 'item', 'uid', v_b)), 'ALLOWED'));
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform perform_craft(w, u, '${MAKE}', jsonb_build_object('kind', 'item', 'uid', v_b));
  perform set_config('search_path', '"$user", public', true);
  insert into said values ('BUILT', ${count(KIND)} || '|' || ${count('stone_brick')} || '|' || ${count('light_mote')});
  select id into v_rl from item where world_id = w and holder = 'player' and holder_uid = u and def = '${KIND}' order by id desc limit 1;

  -- Set down, as any piece is.
  v_t := jsonb_build_object('kind', 'item', 'uid', v_rl, 'x', ${X} + 1, 'y', ${Y}, 'sx', 1, 'sy', 1, 'facing', 's');
  insert into said values ('PLACE', coalesce(act_refusal(w, u, 'place_furniture', v_t), 'ALLOWED'));
  perform act_perform(w, u, 'place_furniture', v_t);
  select id into v_p from placed where world_id = w and kind = 'furniture' and sub = '${KIND}';
  insert into said values ('SET', coalesce((select sub || '|' || round(ql::numeric, 4) || '|' || x || '|' || y || '|' || facing from placed where id = v_p), 'NOT SET')
    || '|' || ${count(KIND)});
  -- What a ground read sends of it.
  select r into v_row from jsonb_array_elements(rpc_ground(w, 40, false)->'placed') r where (r->>'id')::bigint = v_p;
  insert into said values ('GROUND', coalesce(v_row::text, '{}'));

  -- None of a lantern post's jobs: nothing to fit, light, put a candle in, put out or take down.
  insert into said values ('LAMPS', (select string_agg(coalesce(act_refusal(w, u, j, jsonb_build_object('kind', 'furniture', 'id', v_p)), 'ALLOWED'), ';' order by n)
    from (values (1, 'fit_lamp'), (2, 'candle_lamp'), (3, 'light_lamp'), (4, 'douse_lamp'), (5, 'take_lamp')) v(n, j)));
  -- Picked up, with nothing to take down first.
  insert into said values ('LIFT', coalesce(act_refusal(w, u, 'pick_up_furniture', jsonb_build_object('kind', 'furniture', 'id', v_p)), 'ALLOWED'));
end $t$;
select k || '=' || v from said order by k;
rollback;
`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(131, 128);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(X + 0.5, Y + 0.5, 0);
g.settings.fromStores = false;
g.rand = () => 0.01;
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const held = (id: string): number => g.inventory.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
g.skills.values.set('masonry', 90);
g.gather('trowel', { count: 1, ql: 50 });
const bricks = g.gather('stone_brick', { count: 8, ql: 40 });
g.gather('light_mote', { count: 2, ql: 40 });
const short = act(MAKE).check?.({ kind: 'item', uid: bricks.uid }, g) ?? null;
/*
 * The browser says the whole bill after the count it is short of, where the
 * island's craft refusal stops at the count -- as for every recipe of more
 * than one thing, which is not this piece's to change: the sentence before it
 * is held to the same words.
 */
const shortHead = (short ?? 'ALLOWED').replace(/ \([^)]*\)\.$/, '.');
same('short of a light mote it is refused in the same words, the browser\'s whole bill after it aside', shortHead, isle.get('SHORT'), `Need ${recipe?.inputs.find((i) => i.item === 'light_mote')?.count} light motes.`);
g.gather('light_mote', { count: 1, ql: 40 });
same('with three it is allowed on both sides', act(MAKE).check?.({ kind: 'item', uid: bricks.uid }, g) ?? null, isle.get('ASK'), null);
act(MAKE).perform({ kind: 'item', uid: bricks.uid }, g);
check('built, it takes the eight bricks and the three motes, on both sides',
  `${held(KIND)}|${held('stone_brick')}|${held('light_mote')}` === isle.get('BUILT') && isle.get('BUILT') === '1|0|0',
  `browser ${held(KIND)}|${held('stone_brick')}|${held('light_mote')}, island ${isle.get('BUILT')}`);

const made = g.inventory.items.find((it) => it.id === KIND);
const placeT = { kind: 'tile', x: X + 1, y: Y, cx: X + 1, cy: Y, itemUid: made?.uid, sx: 1, sy: 1, facing: 's' };
same('it is set down on open ground as any piece is', act('place_furniture').check?.(placeT as never, g) ?? null, isle.get('PLACE'), null);
act('place_furniture').perform(placeT as never, g);
const piece = [...g.furniture.values()].find((f) => f.kind === KIND) as PlacedFurniture | undefined;
const [iSub, iQl, iX, iY, iFacing, iLeft] = (isle.get('SET') ?? '').split('|');
check('set down, it stands where it was put at the quality it was made at, out of the pack, on both sides',
  !!piece && iSub === KIND && Math.abs(Number(iQl) - piece.ql) < 1e-3 && Number(iX) === piece.x && Number(iY) === piece.y && iFacing === 's' && iLeft === '0' && held(KIND) === 0,
  `browser ${piece?.kind} ${piece?.ql} ${piece?.x},${piece?.y}, island ${isle.get('SET')}`);
check('and its moss starts from the day it is set down, as a statue\'s does', piece?.greenSince !== undefined, String(piece?.greenSince));
{
  const row = JSON.parse(isle.get('GROUND') ?? '{}') as { sub?: string; ql?: number; green?: unknown; since?: unknown };
  check('a browser on the island is sent its kind and its quality, which is all its light is worked out from',
    row.sub === KIND && typeof row.ql === 'number' && runeLanternReach({ ql: row.ql }) === lanternReach(row.ql), JSON.stringify(row).slice(0, 300));
}
{
  const jobs = ['fit_lamp', 'candle_lamp', 'light_lamp', 'douse_lamp', 'take_lamp'];
  const t = { kind: 'furniture', id: piece?.id };
  const mine = jobs.map((j) => act(j).check?.(t as never, g) ?? 'ALLOWED').join(';');
  check('none of a lantern post\'s five jobs applies to it, and each is refused in the same words on both sides',
    mine === isle.get('LAMPS') && jobs.every((j) => !act(j).applies(t as never, g)) && mine === jobs.map(() => 'It is gone.').join(';'),
    `browser ${mine}, island ${isle.get('LAMPS')}`);
  same('it is picked up with nothing to take down first', act('pick_up_furniture').check?.(t as never, g) ?? null, isle.get('LIFT'), null);
}

/* ---- what it does, which is the browser's to draw and see by ------------------------ */
if (piece) {
  const reach = lanternReach(piece.ql);
  check(`its menu says what it lights: ${furnitureState(piece)}`, furnitureState(piece) === `QL ${piece.ql.toFixed(0)} · lights ${reach} tiles at night, burns nothing`);
  g.time = 0; // midnight
  const lit = g.lights().find((l) => l.cast === RUNESTONE_CAST && l.radius === reach);
  const want = runeLanternLight(piece);
  check(`at night it throws a lantern's reach at its quality, ${reach} tiles, steady, in the runestones' pale gold, from the middle of the pillar`,
    !!lit && lit.x === want.x && lit.y === want.y && !!lit.steady && Math.abs(lit.x - (piece.x + (piece.sx + 0.5) / 4)) < 1e-9,
    lit ? `radius ${lit.radius} at ${lit.x},${lit.y}` : g.lights().map((l) => `${l.radius}`).join(','));
  g.time = DAY_SECONDS / 2;
  check('and by day it throws nothing: the sun is up', !g.lights().some((l) => l.cast === RUNESTONE_CAST && l.radius === reach), 'noon');
  // From thirty tiles off, in the dark, the ground at the edge of its reach is in sight; with it lifted, not.
  g.time = 0;
  g.settings.fog = true;
  g.putBody(X + 30.5, Y + 0.5, 0);
  const [lx, ly] = [want.x, want.y];
  const edge = { x: Math.floor(lx + reach - 1), y: Math.floor(ly) };
  g.vision.invalidate();
  g.vision.update();
  const seen = g.vision.isVisible(edge.x, edge.y);
  g.furniture.delete(piece.id);
  g.vision.invalidate();
  g.vision.update();
  const gone = g.vision.isVisible(edge.x, edge.y);
  g.furniture.set(piece.id, piece);
  check('from thirty tiles off in the dark, the ground at the edge of its reach is in sight while it stands, and not without it', seen && !gone, `with ${seen}, without ${gone}`);
  // Hours on, with every lantern post's candle burned down: still alight, and nothing in it to burn.
  g.putBody(X + 0.5, Y + 0.5, 0);
  burnLamps(g, 10 * 3600, true);
  for (let i = 0; i < 20; i++) g.update(1);
  g.time = 0;
  check('after ten hours it is still alight at night, with no fuel in it and nothing lit on it to go out',
    g.lights().some((l) => l.cast === RUNESTONE_CAST && l.radius === reach) && piece.fuel === undefined && !piece.lit && !piece.lamp,
    `fuel ${piece.fuel}, lit ${piece.lit}`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a rune lantern post, on both sides — ${ok.length} of ${ok.length}`);

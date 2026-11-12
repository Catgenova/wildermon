/**
 * A brewer's spring (`brewing.ts`): a water mote set in a barrel, whose brews work for `BREW_SPRING_MUL` of their
 * time, on both sides.
 *
 * The multiplier and every brew's time in a barrel that is one and one that is not, the same on both sides; Set a
 * water mote refused without a mote, while a brew works, a second time, out of reach, on a well and on nothing, in
 * the same words; set, it takes the one mote and says so, and the barrel says it on Examine and on its own line;
 * ale set going in it is ready in ×0.75 the time of ale in the barrel before it was one, and is done at that time
 * and not a second before, where the same ale unmarked is still working; mead set going in it stamps its ageing at
 * the moment it stops; the island sends the mark and the seconds left, not the whole working; and the water mote
 * names the use.
 *
 * Every roll is set and every moment held: the island's clock is its transaction's, a brew's start moved back by
 * hand, and the browser's held to it and counted down by hand. Runs against any database the migrations have built;
 * the island half is rolled back.
 *
 *   npx esbuild supabase/test/brewspring.ts --bundle --platform=node --format=esm \
 *     --external:typescript --outfile=node_modules/.cache/brewspring.mjs && node node_modules/.cache/brewspring.mjs
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, WATER_MOTE_USES, type ActionDef, type Target } from '../../src/game/actions';
import { BREW_BY_ID, BREW_SPRING, BREW_SPRING_ALREADY, BREW_SPRING_MUL, brewTime, BREWS, isWorking } from '../../src/game/brewing';
import { furnitureState, type LiquidKind, type PlacedFurniture } from '../../src/game/furniture';
import { BUCKET_LITRES, ITEM_DEFS, type Item } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { WATER_MOTE, WATER_MOTE_NEED } from '../../src/game/motes';
import { vesselSays } from '../../src/game/placeables';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const ALE = BREW_BY_ID.get('ale')!;
const MEAD = BREW_BY_ID.get('mead')!;
/** Seconds after ale is set going that it is asked whether it still works: either side of a marked barrel's time, and an unmarked one's. */
const ASKED = [ALE.time * BREW_SPRING_MUL - 1, ALE.time * BREW_SPRING_MUL, ALE.time - 1, ALE.time];
/** Seconds since a brew was set going when the island is read. */
const READ_AT = 1000;

/* ---- the rule, on both sides ----------------------------------------------------------------------- */

check(`the multiplier is the same on both sides: ×${BREW_SPRING_MUL}`, psql('select brew_spring_mul()') === String(BREW_SPRING_MUL) && BREW_SPRING_MUL === 0.75,
  psql('select brew_spring_mul()'));
const moteIsle = psql(`select description from item_def where id = '${WATER_MOTE}'`);
check(`the water mote names the use, the same on both sides: “${ITEM_DEFS[WATER_MOTE].description}”`,
  moteIsle === ITEM_DEFS[WATER_MOTE].description && moteIsle.includes(`${BREW_SPRING} 1`) && WATER_MOTE_USES.some(([w]) => w === BREW_SPRING), moteIsle);
const actIsle = psql(`select label || '|' || verb || '|' || base_time from action_def where id = 'set_brew_spring'`);
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
check(`Set a water mote is one action on both sides: ${actIsle}`, actIsle === `${act('set_brew_spring').label}|${act('set_brew_spring').verb}|${act('set_brew_spring').baseTime}`, actIsle);

/* ---- on the island ---------------------------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-0000000000b7';
const lastSaid = `(select e.text from event e where e.world_id = w and e.uid = u and e.kind = 'event' order by e.n desc limit 1)`;
const furn = (id: string): string => `jsonb_build_object('kind', 'furniture', 'id', ${id})`;
const refusal = (k: string, id = 'v_bar'): string => `insert into said values ('${k}', coalesce(act_refusal(w, u, 'set_brew_spring', ${furn(id)}), '-'));`;
const motes = `(select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = u and def = '${WATER_MOTE}')`;
const working = (k: string): string => `
  for v_i in 1..array_length(v_asked, 1) loop
    update placed set since = now() - make_interval(secs => v_asked[v_i]) where id = v_bar;
    select * into p from placed where id = v_bar;
    insert into said values ('${k}:' || v_i, is_working(p)::text || '|' || ferment_left(p)::text);
  end loop;`;
const brew = (id: LiquidKind, n: number): string => `
  update placed set liquid = 'water', litres = 80, ql = 40, ferment = 0, knack = null, since = now() where id = v_bar;
  perform give(w, u, '${BREW_BY_ID.get(id)?.input}', ${n}, 60);
  perform pg_temp.dice('0.01');
  perform act_perform(w, u, 'start_brew', jsonb_build_object('kind', 'furniture', 'id', v_bar, 'brew', '${id}'));
  perform pg_temp.nodice();`;

const out = psql(`
set wildermon.season = '';
discard temp;
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
declare xs text[] := string_to_array(current_setting('wildermon.dice'), ',');
        n int := coalesce(nullif(current_setting('wildermon.dice_n', true), ''), '0')::int;
begin
  perform set_config('wildermon.dice_n', (n + 1)::text, true);
  return xs[1 + n % array_length(xs, 1)]::double precision;
end $f$;
create function pg_temp.dice(v text) returns void language plpgsql as $f$
begin
  perform set_config('wildermon.dice', v, true);
  perform set_config('wildermon.dice_n', '0', true);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
end $f$;
create function pg_temp.nodice() returns void language plpgsql as $f$
begin
  perform set_config('search_path', '"$user", public', true);
end $f$;
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; v_bar bigint; v_b bigint; v_well bigint; v_now double precision; p placed; q placed; v_i int; g jsonb;
        v_asked double precision[] := array[${ASKED.join(', ')}]::double precision[];
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Brewspring', 179, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 0.2, 'health', 1, 'stamina', 1)
   where world_id = w;
  insert into skill (world_id, uid, id, value) values (w, u, 'brewing', 40)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  perform land_set_tile(w, x, y, ${TileType.Grass}) from generate_series(0, 63) x, generate_series(0, 63) y;
  v_now := extract(epoch from now())::double precision;
  insert into said values ('NOW', v_now::text);
  v_b := give(w, u, 'barrel', 1, 40);
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_b, 'x', 10, 'y', 9, 'sx', 1, 'sy', 1, 'facing', 's'));
  select id into v_bar from placed where world_id = w and kind = 'furniture' and sub = 'barrel';
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'well', 14, 14, 0, 0, 15, 15, 30)
    returning id into v_well;

  -- 1. Each brew's seconds in a barrel that is not one, and in one.
  select * into p from placed where id = v_bar;
  q := p;
  q.state := q.state || '{"spring": true}'::jsonb;
  insert into said select 'T:' || b.id, private.brew_seconds(p, b)::text || '|' || private.brew_seconds(q, b)::text from brew_def b;

  -- 2. Refused without a mote, on a well, and on nothing.
  ${refusal('R:none')}
  ${refusal('R:well', 'v_well')}
  ${refusal('R:gone', '-1')}
  -- And no brew set going in the well itself (asked for: "Brewing should not be an option directly in wells").
  insert into said values ('B:well', coalesce(act_refusal(w, u, 'start_brew',
    jsonb_build_object('kind', 'furniture', 'id', v_well, 'brew', 'ale')), '-'));

  -- 3. Ale in the barrel as it is: its seconds, what is said, and whether it works so long after.
  ${brew('ale', ALE.count)}
  select * into p from placed where id = v_bar;
  insert into said values ('U:set', p.liquid || '|' || p.ferment || '|' || ${lastSaid});
  ${working('U')}
  -- And while it works, a mote in the pack: refused.
  perform give(w, u, '${WATER_MOTE}', 2, 50);
  update placed set since = now() where id = v_bar;
  ${refusal('R:working')}

  -- 4. Emptied to water: out of reach, then set.
  update placed set liquid = 'water', litres = 80, ferment = 0, since = now() where id = v_bar;
  update player set x = 30.5 where world_id = w and uid = u;
  ${refusal('R:far')}
  update player set x = 10.5 where world_id = w and uid = u;
  ${refusal('R:ok')}
  perform act_perform(w, u, 'set_brew_spring', ${furn('v_bar')});
  insert into said select 'S:set', coalesce(pl.state->>'spring', '-') || '|' || ${motes} || '|' || ${lastSaid} from placed pl where pl.id = v_bar;
  ${refusal('R:again')}
  -- A second go, refused, takes nothing.
  perform act_perform(w, u, 'set_brew_spring', ${furn('v_bar')});
  insert into said select 'S:again', ${motes}::text from placed pl where pl.id = v_bar;
  insert into said select 'X:says', vessel_says(pl) from placed pl where pl.id = v_bar;

  -- 5. Ale in it now.
  ${brew('ale', ALE.count)}
  select * into p from placed where id = v_bar;
  insert into said values ('M:set', p.liquid || '|' || p.ferment || '|' || coalesce(p.state->>'spring', '-') || '|' || ${lastSaid});
  ${working('M')}
  -- What the island sends of it, ${READ_AT} seconds on.
  update placed set since = now() - make_interval(secs => ${READ_AT}) where id = v_bar;
  g := (select e from jsonb_array_elements(rpc_ground(w, 40, true, null)->'placed') e where (e->>'id')::bigint = v_bar);
  insert into said values ('G', (g->>'ferment') || '|' || coalesce(g->'state'->>'spring', '-'));

  -- 6. Mead in it: its ageing stamped at the moment it stops.
  ${brew('mead', MEAD.count)}
  insert into said select 'A:set', pl.liquid || '|' || pl.ferment || '|' || (pl.aged_from = v_now + pl.ferment)::text from placed pl where pl.id = v_bar;

  -- 7. Lye in the barrel: one ash a litre, a part litre a whole ash; refused short, and in the well.
  update placed set liquid = 'water', litres = 12.5, ql = 40, ferment = 0, knack = null, since = now() where id = v_bar;
  delete from item where world_id = w and holder = 'player' and def = 'ash';
  perform give(w, u, 'ash', 12, 30);
  insert into said values ('L:short', coalesce(act_refusal(w, u, 'leach_lye', ${furn('v_bar')}), '-'));
  update player set x = 15.5, y = 15.5 where world_id = w and uid = u;
  insert into said values ('L:well', coalesce(act_refusal(w, u, 'leach_lye', ${furn('v_well')}), '-'));
  update player set x = 10.5, y = 10.5 where world_id = w and uid = u;
  perform give(w, u, 'ash', 3, 30);
  perform pg_temp.dice('0.01');
  perform act_perform(w, u, 'leach_lye', ${furn('v_bar')});
  perform pg_temp.nodice();
  insert into said select 'L:done', pl.liquid || '|' || pl.litres || '|'
    || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'ash')
    || '|' || ${lastSaid} from placed pl where pl.id = v_bar;
  insert into said select 'L:bucket', count from recipe_input where recipe = 'make_lye' and item = 'ash';

  -- 8. Filled with water: refused over lye and with no water at hand; to the brim at a shore; then from a well.
  insert into said values ('F:lye', coalesce(act_refusal(w, u, 'fill_barrel', ${furn('v_bar')}), '-'));
  update placed set liquid = null, litres = 0, since = now() where id = v_bar;
  insert into said values ('F:dry', coalesce(act_refusal(w, u, 'fill_barrel', ${furn('v_bar')}), '-'));
  perform land_set_height(w, 12, 12, -5);
  perform act_perform(w, u, 'fill_barrel', ${furn('v_bar')});
  insert into said select 'F:shore', pl.liquid || '|' || pl.litres || '|' || ${lastSaid} from placed pl where pl.id = v_bar;
  insert into said values ('F:full', coalesce(act_refusal(w, u, 'fill_barrel', ${furn('v_bar')}), '-'));
  v_b := give(w, u, 'barrel', 1, 40);
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_b, 'x', 12, 'y', 15, 'sx', 1, 'sy', 1, 'facing', 's'));
  select id into v_b from placed where world_id = w and kind = 'furniture' and sub = 'barrel' and id <> v_bar;
  update placed set litres = 30, since = now() where id = v_well;
  update player set x = 13.5, y = 15.5 where world_id = w and uid = u;
  perform act_perform(w, u, 'fill_barrel', ${furn('v_b')});
  insert into said select 'F:well', pl.liquid || '|' || pl.litres || '|' || (select placed_litres(wl) from placed wl where wl.id = v_well)
    || '|' || ${lastSaid} from placed pl where pl.id = v_b;
  insert into said values ('F:wellnot', coalesce(act_refusal(w, u, 'fill_barrel', ${furn('v_well')}), '-'));
  insert into said values ('F:dried', coalesce(act_refusal(w, u, 'fill_barrel', ${furn('v_b')}), '-'));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

/* ---- in the browser, the same ----------------------------------------------------------------------- */

const NOW = Number(isle.get('NOW'));
const g = Game.create(179, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(10.5, 10.5, 0);
g.settings.fromStores = false;
g.skills.values.set('brewing', 40);
g.wallClock = () => NOW;
const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
const lastHere = (): string => said.filter((m) => !/^Your .* (rises|improves)|^You feel/.test(m)).slice(-1)[0] ?? '';
const dice = (...xs: number[]): void => {
  let n = 0;
  g.rand = () => xs[n++ % xs.length];
};
const thing = (id: string, ql: number, n = 1): Item => g.gather(id, { count: n, ql });
/** The browser's own count-down of a brew, by hand. */
const tick = (dt: number): void => { (g as unknown as { runPlaceables(dt: number): void }).runPlaceables(dt); };
const barrelItem = thing('barrel', 40);
act('place_furniture').perform({ kind: 'tile', x: 10, y: 9, sx: 1, sy: 1, itemUid: barrelItem.uid, facing: 's' } as Target, g);
const bar = [...g.furniture.values()].find((p) => p.kind === 'barrel') as PlacedFurniture;
const well = g.addFurniture('well', 14, 14, 0, 0, 30);
const at: Target = { kind: 'furniture', id: bar.id } as Target;
const refusalHere = (t: Target = at): string => act('set_brew_spring').check?.(t, g) ?? '-';
const same = (k: string, here: string, what: string): void => {
  check(`${what}: “${here}”, the same on both sides`, isle.get(k) === here, `${isle.get(k)} / ${here}`);
};
const motesHere = (): number => g.inventory.count(WATER_MOTE);
const brewHere = (id: LiquidKind): void => {
  Object.assign(bar, { liquid: 'water', litres: 80, ql: 40, ferment: 0 });
  delete bar.knack;
  const b = BREW_BY_ID.get(id)!;
  thing(b.input, 60, b.count);
  dice(0.01);
  act('start_brew').perform({ ...at, brew: id } as Target, g);
};
/** Whether the brew still works, and the seconds it has left, so many seconds after it was set going: counted down a copy. */
const workingHere = (k: string): void => {
  const was = { ...bar };
  ASKED.forEach((s, i) => {
    Object.assign(bar, was);
    tick(s);
    same(`${k}:${i + 1}`, `${isWorking(bar)}|${bar.ferment}`, `${s} s after it was set going, ${k === 'M' ? 'in the spring' : 'in the plain barrel'}`);
  });
  Object.assign(bar, was);
};

/* 1. Each brew's time. */
for (const b of BREWS) {
  const plain = brewTime({ ...bar, spring: undefined }, b);
  const spring = brewTime({ ...bar, spring: true }, b);
  same(`T:${b.id}`, `${plain}|${spring}`, `${b.name.toLowerCase()} works ${plain} s in a barrel and ${spring} s in a brewer's spring`);
  check(`which is ×${BREW_SPRING_MUL}: ${spring} = ${plain} × ${BREW_SPRING_MUL}`, spring === plain * BREW_SPRING_MUL && plain === b.time);
}

/* 2. Refused without a mote, on a well, and on nothing. */
same('R:none', refusalHere(), 'without a water mote');
check(`which is the mote's own refusal: “${WATER_MOTE_NEED}”`, refusalHere() === WATER_MOTE_NEED);
same('R:well', refusalHere({ kind: 'furniture', id: well.id } as Target), 'on a well');
same('R:gone', refusalHere({ kind: 'furniture', id: -1 } as Target), 'on nothing');
check('and the menu offers it on the barrel, and not on the well', act('set_brew_spring').applies(at, g) && !act('set_brew_spring').applies({ kind: 'furniture', id: well.id } as Target, g));
// No brew in the well itself, on either side: not offered, and refused in the island's words if asked.
const wellBrew = { kind: 'furniture', id: well.id, brew: 'ale' } as Target;
same('B:well', act('start_brew').check?.(wellBrew, g) ?? '-', 'a brew in a well');
check('and a brew is offered on the barrel, and not on the well', act('start_brew').applies(at, g) && !act('start_brew').applies(wellBrew, g));

/* 3. Ale in the plain barrel. */
brewHere('ale');
same('U:set', `${bar.liquid}|${bar.ferment}|${lastHere()}`, `ale in a plain barrel works its whole ${ALE.time} s`);
workingHere('U');
thing(WATER_MOTE, 50, 2);
same('R:working', refusalHere(), 'while it works');

/* 4. Set. */
Object.assign(bar, { liquid: 'water', litres: 80, ferment: 0 });
g.putBody(30.5, 10.5, 0);
same('R:far', refusalHere(), 'out of reach');
g.putBody(10.5, 10.5, 0);
same('R:ok', refusalHere(), 'beside it, water in it, a mote in the pack: allowed');
act('set_brew_spring').perform(at, g);
same('S:set', `${bar.spring ? 'true' : '-'}|${motesHere()}|${lastHere()}`, 'set: the barrel marked, one mote of two used up');
same('R:again', refusalHere(), 'a second time');
check(`which is “${BREW_SPRING_ALREADY}”, and the menu no longer offers it`, refusalHere() === BREW_SPRING_ALREADY && !act('set_brew_spring').applies(at, g));
if (!act('set_brew_spring').check?.(at, g)) act('set_brew_spring').perform(at, g);
same('S:again', String(motesHere()), 'a second go takes nothing');
same('X:says', vesselSays(bar, NOW), 'Examine says it');
check(`and so does its own line: “${furnitureState(bar)}”`, furnitureState(bar).includes(`${BREW_SPRING.toLowerCase()}, brew time ×${BREW_SPRING_MUL}`));

/* 5. Ale in the spring. */
brewHere('ale');
same('M:set', `${bar.liquid}|${bar.ferment}|${bar.spring ? 'true' : '-'}|${lastHere()}`, `ale in the spring works ${ALE.time * BREW_SPRING_MUL} s`);
check(`which is ×${BREW_SPRING_MUL} of the plain barrel's, and said so: ready in ${Math.round(ALE.time * BREW_SPRING_MUL / 60)} minutes, not ${Math.round(ALE.time / 60)}`,
  bar.ferment === ALE.time * BREW_SPRING_MUL && lastHere().endsWith(`Ready in about ${Math.round(ALE.time * BREW_SPRING_MUL / 60)} minutes.`));
check(`the barrel's line counts it down: “${furnitureState(bar)}”`, furnitureState(bar).includes(`working, ${Math.ceil(ALE.time * BREW_SPRING_MUL / 60)}m to go`));
workingHere('M');
check(`the spring's ale is done ${ALE.time * BREW_SPRING_MUL} s on and not a second before; the plain barrel's still works then, and is done at ${ALE.time}`,
  isle.get('M:1')?.startsWith('true|') === true && isle.get('M:2') === 'false|0' && isle.get('U:2')?.startsWith('true|') === true
    && isle.get('U:3')?.startsWith('true|') === true && isle.get('U:4') === 'false|0');
check(`the island sends the mark and the seconds left ${READ_AT} s on, not the whole working: ${isle.get('G')}`,
  isle.get('G') === `${ALE.time * BREW_SPRING_MUL - READ_AT}|true`, isle.get('G'));

/* 6. Mead in the spring. */
brewHere('mead');
check(`mead in the spring works ${MEAD.time * BREW_SPRING_MUL} s and stamps its ageing at the moment it stops, on both sides`,
  isle.get('A:set') === `mead|${MEAD.time * BREW_SPRING_MUL}|true` && bar.ferment === MEAD.time * BREW_SPRING_MUL && bar.agedFrom === NOW + MEAD.time * BREW_SPRING_MUL,
  `${isle.get('A:set')} / ${bar.ferment} ${bar.agedFrom}`);

/* 7. Lye in the barrel (asked for: "Making lye requires 1 unit of ash per L. Allow lye to be made in barrels as well as buckets"). */
Object.assign(bar, { liquid: 'water', litres: 12.5, ql: 40, ferment: 0 });
delete bar.knack;
for (let i = g.inventory.items.length - 1; i >= 0; i--) if (g.inventory.items[i].id === 'ash') g.inventory.items.splice(i, 1);
thing('ash', 30, 12);
same('L:short', act('leach_lye').check?.(at, g) ?? '-', '12.5 litres of water want 13 ashes; 12 are refused');
g.putBody(15.5, 15.5, 0);
same('L:well', act('leach_lye').check?.({ kind: 'furniture', id: well.id } as Target, g) ?? '-', 'and no lye in a well');
g.putBody(10.5, 10.5, 0);
thing('ash', 30, 3);
dice(0.01);
act('leach_lye').perform(at, g);
same('L:done', `${bar.liquid}|${bar.litres}|${g.inventory.count('ash')}|${lastHere()}`, 'with 15: the barrel is lye, 13 ashes gone, 2 left');
same('L:bucket', String(RECIPE_BY_ID.get('make_lye')?.inputs.find((i) => i.item === 'ash')?.count), `a bucket of ${BUCKET_LITRES} litres takes ${BUCKET_LITRES} ashes`);

/* 8. Filled with water (asked for: "No logical way to fill a barrel. Allow it to be filled at a well or water"). */
same('F:lye', act('fill_barrel').check?.(at, g) ?? '-', 'a barrel of lye');
check('and the menu does not offer it on lye', !act('fill_barrel').applies(at, g));
Object.assign(bar, { liquid: undefined, litres: 0 });
same('F:dry', act('fill_barrel').check?.(at, g) ?? '-', 'an empty barrel with no shore or well beside you');
w.setHeight(12, 12, -5);
act('fill_barrel').perform(at, g);
same('F:shore', `${bar.liquid}|${bar.litres}|${lastHere()}`, 'at a shore: to the brim');
same('F:full', act('fill_barrel').check?.(at, g) ?? '-', 'a full one');
const barrel2 = thing('barrel', 40);
act('place_furniture').perform({ kind: 'tile', x: 12, y: 15, sx: 1, sy: 1, itemUid: barrel2.uid, facing: 's' } as Target, g);
const bar2 = [...g.furniture.values()].find((p) => p.kind === 'barrel' && p !== bar) as PlacedFurniture;
well.litres = 30;
g.putBody(13.5, 15.5, 0);
const at2 = { kind: 'furniture', id: bar2.id } as Target;
check('the menu offers it on an empty barrel', act('fill_barrel').applies(at2, g));
act('fill_barrel').perform(at2, g);
same('F:well', `${bar2.liquid}|${bar2.litres}|${well.litres}|${lastHere()}`, 'at a well: what the well has, the well drawn dry');
same('F:wellnot', act('fill_barrel').check?.({ kind: 'furniture', id: well.id } as Target, g) ?? '-', 'a well');
same('F:dried', act('fill_barrel').check?.(at2, g) ?? '-', 'and with the well dry');

/* ---- what was found ------------------------------------------------------------------------------- */

finish('brewspring');

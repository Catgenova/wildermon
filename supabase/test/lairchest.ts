/**
 * A lair nobody picks up or names, and a cleared lair's hoard chest in its place.
 *
 * Asked for: "goblin warrens should not be able to be picked up or renamed", and "when all the mobs are cleared create
 * the loot chest in place of the warren". Asked of the island, on an island of its own made for the purpose, in one
 * transaction rolled back, and of the browser's rules for the same:
 *
 *   * every lair kind: no action at all asked of its piece is let through, nor a thing put into it; Pick it up and Give
 *     it a name refused through `rpc_act` in its kind's words, the same words on both sides; the browser offers none of
 *     them and refuses each in the same words, and a name on one is not shown;
 *   * a warren's garrison killed and its boss after it: the warren gone from its tile and a hoard chest on it in its
 *     place, holding a share for each who dealt a tenth of the boss's health (the trophy with their name) and none for
 *     one who dealt less, nothing in anybody's pack; Examine of the tile says it and what is in it;
 *   * the chest: Take of one thing and Take all by somebody who dealt nothing, into their pack; every other action
 *     refused in the browser's words, through `rpc_act` too, and no settlement's store; emptied, it is gone;
 *   * the lair back at its restock: the warren on its tile again, its garrison coming back; a camp cleared and left
 *     full, its chest gone at the restock with what was in it, its piece back and its fire lit; a boss killed by
 *     nobody counted: no chest.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { build } from './pagebuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { FURNITURE_BY_ID, furnitureName, type PlacedFurniture } from '../../src/game/furniture';
import { Game, type IslandGround } from '../../src/game/game';
import { isLairChest, isLairPiece, lairPieceSays } from '../../src/game/lairpiece';
import { LAIR_CHEST, LAIR_CHEST_HOLDS, LAIR_CHEST_NAME, LAIR_CHEST_OPENS, LAIR_CHEST_SHUT, LAIR_KINDS, lairShutSaid } from '../../src/game/lairs';
import { RECIPES } from '../../src/game/recipes';
import { storeMarkable } from '../../src/game/stores';
import type { LairMenu } from './lairchest-page';
import { check, finish, psql } from './harness';

const U = { a: '1a1c0000-0000-4000-8000-0000000000a1', b: '1a1c0000-0000-4000-8000-0000000000a2', c: '1a1c0000-0000-4000-8000-0000000000a3' };
const SIZE = 256;
/** Where each kind of lair stands, one to a kind, a row of them twelve tiles apart. */
const AT = LAIR_KINDS.map((k, i) => ({ kind: k.id, x: 20 + 12 * i, y: 40 }));

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; v_ids bigint[]; v_lair int; v_boss int; v_top double precision; v_max bigint; v_item bigint; v_chest bigint; r record;
        v_p jsonb; v_why text; v_let text[]; v_ev bigint; v_camp int; v_cave int; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Lairchest', 4343, ${SIZE}, 20, 200, true) returning id into w;
  insert into said values ('WORLD', w::text);
  perform land_blank(w, ${SIZE});
  update land_corner set heights = decode(repeat('6400', ${SIZE + 1}), 'hex') where world_id = w;
  update land_tile t set tiles = decode(repeat('00', ${SIZE}), 'hex') where t.world_id = w;
  perform set_config('request.jwt.claims', json_build_object('sub', '${U.a}')::text, true);
  perform rpc_join(w, 'Slayer');
  perform set_config('request.jwt.claims', json_build_object('sub', '${U.b}')::text, true);
  perform rpc_join(w, 'Helper');
  perform set_config('request.jwt.claims', json_build_object('sub', '${U.c}')::text, true);
  perform rpc_join(w, 'Passerby');
  update player set body_at = now(), away = false, x = 200.5, y = 200.5 where world_id = w;
  insert into said select 'SHUT', lair_chest() || '|' || lair_chest_shut() || '|' || (select f.name || ':' || coalesce(f.capacity::text, '-') from furniture_def f where f.id = lair_chest());

  -- ---- Every kind of lair: nothing asked of it --------------------------------------------------------------------
  ${AT.map((a, i) => `insert into lair (world_id, id, kind, x, y, placed, state, size) values (w, ${i + 1}, '${a.kind}', ${a.x}, ${a.y}, lair_piece(w, '${a.kind}', ${a.x}, ${a.y}), 'held', 0);`).join('\n  ')}
  v_item := give(w, '${U.a}', 'log', 1, 30);
  for r in select l.*, (select k.name from lair_kinds() k where k.id = l.kind) as kname from lair l where l.world_id = w order by l.id loop
    update player set x = r.x + 1.5, y = r.y + 0.5 where world_id = w and uid = '${U.a}';
    v_let := '{}';
    for v_why in select a.id from action_def a order by a.id loop
      begin
        if act_refusal(w, '${U.a}', v_why, jsonb_build_object('kind', 'furniture', 'id', r.placed, 'name', 'Mine', 'itemUid', v_item)) is null then
          v_let := v_let || v_why;
        end if;
      exception when others then null;
      end;
    end loop;
    insert into said values ('LET', r.kind || '|' || coalesce(array_to_string(v_let, ','), '') );
    insert into said values ('INTO', r.kind || '|' || coalesce(act_refusal(w, '${U.a}', 'store_in_furniture',
      jsonb_build_object('kind', 'item', 'uid', v_item, 'into', r.placed)), '-'));
    -- Through the door every browser asks by.
    perform set_config('request.jwt.claims', json_build_object('sub', '${U.a}')::text, true);
    delete from caller where uid = '${U.a}';
    v_p := rpc_act(w, 'pick_up_furniture', jsonb_build_object('kind', 'furniture', 'id', r.placed));
    insert into said values ('ACT', r.kind || '|pick_up_furniture|' || coalesce(v_p->>'why', '-'));
    delete from caller where uid = '${U.a}';
    v_p := rpc_act(w, 'name_thing', jsonb_build_object('kind', 'furniture', 'id', r.placed, 'name', 'Home'));
    insert into said values ('ACT', r.kind || '|name_thing|' || coalesce(v_p->>'why', '-'));
    insert into said select 'STILL', r.kind || '|' || coalesce(pl.name, '-') || '|' || pl.x || ',' || pl.y from placed pl where pl.id = r.placed;
  end loop;

  -- ---- A warren cleared: its chest in its place ---------------------------------------------------------------------
  v_lair := 1;
  update lair set size = lair_size_roll(kind) where world_id = w and id = v_lair;
  perform lair_restock(w, v_lair, 1000);
  update player set x = ${AT[0].x + 2}.5, y = ${AT[0].y}.5 where world_id = w;
  v_ids := array(select c.id from creature c where c.world_id = w and c.lair = v_lair and not c.boss order by c.id);
  insert into said values ('GARRISON', cardinality(v_ids)::text);
  for i in 1 .. cardinality(v_ids) loop perform wound_beast(w, v_ids[i]::int, 1e9, null, null, '${U.a}', null); end loop;
  select c.id into v_boss from creature c where c.world_id = w and c.lair = v_lair and c.boss;
  update creature set traits = '{}' where world_id = w and id = v_boss;
  select max_health(c) into v_top from creature c where c.world_id = w and c.id = v_boss;
  insert into said select 'BOSS', state || '|' || coalesce(v_boss::text, '-') || '|' || coalesce(placed::text, 'gone') from lair where world_id = w and id = v_lair;
  select coalesce(max(id), 0) into v_max from item;
  perform wound_beast(w, v_boss, v_top * 0.5, null, null, '${U.a}', null);
  perform wound_beast(w, v_boss, v_top * 0.15, null, null, '${U.b}', null);
  perform wound_beast(w, v_boss, v_top * 0.05, null, null, '${U.c}', null);
  perform wound_beast(w, v_boss, 1e9, null, null, '${U.a}', null);
  select chest into v_chest from lair where world_id = w and id = v_lair;
  insert into said select 'CLEARED', l.state || '|' || coalesce(l.placed::text, 'gone') || '|' || coalesce(l.chest::text, '-') || '|'
      || coalesce((select pl.sub || ':' || pl.x || ':' || pl.y || ':' || pl.sx || ':' || pl.sy from placed pl where pl.id = l.chest), '-') || '|'
      || (select count(*) from placed pl where pl.world_id = w and pl.x = l.x and pl.y = l.y and pl.sub = l.kind)
    from lair l where l.world_id = w and l.id = v_lair;
  insert into said select 'HOLDS', coalesce(string_agg(i2.def || ':' || coalesce(i2.maker, '-') || ':' || i2.count || ':' || coalesce(i2.rare, '-'), ',' order by i2.def, i2.maker), '-')
    from item i2 where i2.holder = 'furniture' and i2.placed = v_chest;
  insert into said select 'PACKED', count(*)::text from item i2 where i2.id > v_max and i2.holder = 'player';
  insert into said values ('EXAMINE', examine_tile_text(w, ${AT[0].x}, ${AT[0].y}, '${U.c}'::uuid));
  -- The ground read: the chest a piece like any other, what is in it said within six tiles.
  perform set_config('request.jwt.claims', json_build_object('sub', '${U.c}')::text, true);
  insert into said select 'GROUND', coalesce((select (p2->>'sub') || ':' || jsonb_array_length(p2->'things') from jsonb_array_elements(rpc_ground(w, 20, true, null)->'placed') p2
     where (p2->>'id')::bigint = v_chest), '-');

  -- ---- The chest: taken from by anybody, and nothing else -----------------------------------------------------------
  v_let := '{}';
  for v_why in select a.id from action_def a order by a.id loop
    begin
      if act_refusal(w, '${U.c}', v_why, jsonb_build_object('kind', 'furniture', 'id', v_chest, 'name', 'Mine', 'itemUid', v_item)) is null then
        v_let := v_let || v_why;
      end if;
    exception when others then null;
    end;
  end loop;
  insert into said values ('CHESTLET', coalesce(array_to_string(v_let, ','), ''));
  select i2.id into v_item from item i2 where i2.holder = 'furniture' and i2.placed = v_chest and i2.def = 'chief_ear' order by i2.id limit 1;
  insert into said values ('CHESTSAYS', coalesce(act_refusal(w, '${U.c}', 'take_from_store', jsonb_build_object('kind', 'item', 'uid', v_item)), '-') || '|'
    || coalesce(act_refusal(w, '${U.c}', 'furniture_take_all', jsonb_build_object('kind', 'furniture', 'id', v_chest)), '-') || '|'
    || coalesce(act_refusal(w, '${U.c}', 'store_in_furniture', jsonb_build_object('kind', 'item', 'uid', give(w, '${U.c}', 'log', 1, 30), 'into', v_chest)), '-') || '|'
    || coalesce((select store_markable_refusal(pl) from placed pl where pl.id = v_chest), '-'));
  delete from caller where uid = '${U.c}';
  v_p := rpc_act(w, 'pick_up_furniture', jsonb_build_object('kind', 'furniture', 'id', v_chest));
  insert into said values ('CHESTACT', 'pick_up_furniture|' || coalesce(v_p->>'why', '-'));
  delete from caller where uid = '${U.c}';
  v_p := rpc_act(w, 'name_thing', jsonb_build_object('kind', 'furniture', 'id', v_chest, 'name', 'Loot'));
  insert into said values ('CHESTACT', 'name_thing|' || coalesce(v_p->>'why', '-'));
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null, act_goes = null, act_queue = '[]'
    where world_id = w and uid = '${U.c}';
  -- One thing, and then the rest, by somebody who dealt it nothing that counted.
  select coalesce(max(n), 0) into v_ev from event where world_id = w;
  perform act_perform(w, '${U.c}', 'take_from_store', jsonb_build_object('kind', 'item', 'uid', v_item));
  insert into said select 'TOOK', (select count(*) from item i2 where i2.holder = 'player' and i2.holder_uid = '${U.c}' and i2.def = 'chief_ear') || '|'
    || (select count(*) from placed pl where pl.id = v_chest);
  perform act_perform(w, '${U.c}', 'furniture_take_all', jsonb_build_object('kind', 'furniture', 'id', v_chest));
  insert into said select 'TOOKALL', (select count(*) from item i2 where i2.holder = 'player' and i2.holder_uid = '${U.c}' and i2.def = 'chief_ear') || '|'
    || (select count(*) from placed pl where pl.id = v_chest) || '|' || coalesce((select chest::text from lair where world_id = w and id = v_lair), '-') || '|'
    || coalesce((select string_agg(e.text, '~' order by e.n) from event e where e.world_id = w and e.n > v_ev and e.uid = '${U.c}'), '-');

  -- ---- Back at its restock ------------------------------------------------------------------------------------------
  update lair set cleared_at = now() - make_interval(secs => (select k.restock from lair_kinds() k where k.id = 'goblin_warren') + 1) where world_id = w and id = v_lair;
  perform lair_turn(w, v_lair);
  insert into said select 'BACK', l.state || '|' || coalesce((select pl.sub || ':' || pl.x || ':' || pl.y from placed pl where pl.id = l.placed), '-') || '|'
      || coalesce(l.chest::text, '-') || '|' || lair_garrison_up(w, l.id)
    from lair l where l.world_id = w and l.id = v_lair;

  -- A camp cleared and its chest left full: gone at the restock with what is in it, the camp back and its fire lit.
  select id into v_camp from lair where world_id = w and kind = 'orc_camp';
  update player set x = ${AT[1].x + 2}.5, y = ${AT[1].y}.5 where world_id = w and uid = '${U.b}';
  update lair set state = 'boss' where world_id = w and id = v_camp;
  v_boss := lair_spawn(w, v_camp, 'orc', true);
  perform wound_beast(w, v_boss, 1e9, null, null, '${U.b}', null);
  select chest into v_chest from lair where world_id = w and id = v_camp;
  insert into said select 'CAMP', l.state || '|' || coalesce(l.placed::text, 'gone') || '|' || (select count(*) from item i2 where i2.placed = v_chest and i2.holder = 'furniture')
    from lair l where l.world_id = w and l.id = v_camp;
  update lair set cleared_at = now() - interval '2 hours' where world_id = w and id = v_camp;
  perform lair_turn(w, v_camp);
  insert into said select 'CAMPBACK', l.state || '|' || (select count(*) from placed pl where pl.id = v_chest) || '|'
      || (select count(*) from item i2 where i2.placed = v_chest) || '|' || coalesce((select pl.sub || ':' || placed_lit(pl) from placed pl where pl.id = l.placed), '-')
    from lair l where l.world_id = w and l.id = v_camp;

  -- A boss killed with nobody's blows counted: no shares, no chest; the piece gone all the same.
  select id into v_cave from lair where world_id = w and kind = 'ogre_cave';
  update lair set state = 'boss' where world_id = w and id = v_cave;
  v_boss := lair_spawn(w, v_cave, 'ogre', true);
  perform wound_beast(w, v_boss, 1e9, null, null, null, null);
  insert into said select 'NOBODY', l.state || '|' || coalesce(l.placed::text, 'gone') || '|' || coalesce(l.chest::text, '-') || '|'
      || (select count(*) from placed pl where pl.world_id = w and pl.sub = lair_chest() and pl.x = l.x and pl.y = l.y)
    from lair l where l.world_id = w and l.id = v_cave;
end $t$;
select k || '=' || v from said;
rollback;
`);
const lines = out.split('\n').filter((l) => l.includes('='));
const said = (k: string): string[] => lines.filter((l) => l.startsWith(`${k}=`)).map((l) => l.slice(k.length + 1));
const one = (k: string): string => said(k)[0] ?? '';

/* ---- both sides' words ------------------------------------------------------------------------------------------- */

{
  const [kind, shut, def] = one('SHUT').split('|');
  check('the hoard chest is the same on both sides: its kind, its name, its room and why anything but taking is refused',
    kind === LAIR_CHEST && shut === LAIR_CHEST_SHUT && def === `${LAIR_CHEST_NAME}:${LAIR_CHEST_HOLDS}`, one('SHUT'));
}

/* ---- every lair kind: nothing asked of it ------------------------------------------------------------------------ */

for (const k of LAIR_KINDS) {
  const let_ = said('LET').find((l) => l.startsWith(`${k.id}|`))?.split('|')[1];
  check(`${k.name}: not one of the island's actions asked of its piece is let through`, let_ === '', let_);
  const into = said('INTO').find((l) => l.startsWith(`${k.id}|`))?.split('|')[1];
  check(`${k.name}: nothing is put into it`, into === lairShutSaid(k.name), into);
  for (const job of ['pick_up_furniture', 'name_thing']) {
    const why = said('ACT').find((l) => l.startsWith(`${k.id}|${job}|`))?.split('|')[2];
    check(`${k.name}: ${ACTION_BY_ID.get(job)?.label} refused through rpc_act, in the browser's words`,
      why === lairShutSaid(k.name) && lairPieceSays({ kind: k.id } as PlacedFurniture, job) === why, why);
  }
  const still = said('STILL').find((l) => l.startsWith(`${k.id}|`))?.split('|');
  const at = AT.find((a) => a.kind === k.id)!;
  check(`${k.name}: still where it stood, with no name`, !!still && still[1] === '-' && still[2] === `${at.x},${at.y}`, still?.join('|'));
}

/* ---- the warren cleared ---------------------------------------------------------------------------------------------- */

check('the warren stood up with its garrison', Number(one('GARRISON')) >= LAIR_KINDS[0].garrison[0][1], one('GARRISON'));
check('its garrison dead: its boss out, the warren still standing', /^boss\|\d+\|\d+$/.test(one('BOSS')), one('BOSS'));
{
  const [state, piece, chest, drawn, warrens] = one('CLEARED').split('|');
  check('its boss dead: cleared, the warren gone from its tile and a hoard chest on it, in the middle',
    state === 'cleared' && piece === 'gone' && chest !== '-' && drawn === `${LAIR_CHEST}:${AT[0].x}:${AT[0].y}:1:1` && warrens === '0', one('CLEARED'));
}
const holds = one('HOLDS') === '-' ? [] : one('HOLDS').split(',');
const ears = holds.filter((h) => h.startsWith('chief_ear:'));
check('in it a share for the one who dealt half and the one who dealt a tenth and a half: the goblin chief\'s ear each, with their names',
  ears.length === 2 && ears.some((e) => e.startsWith('chief_ear:Slayer:1:')) && ears.some((e) => e.startsWith('chief_ear:Helper:1:')), one('HOLDS'));
check('none for the one who dealt under a tenth, and nothing but a map, the trophy and a Recipe; nothing rare',
  !holds.some((h) => h.includes(':Passerby:')) && holds.every((h) => ['chief_ear', 'treasure_map', 'cooking_recipe'].includes(h.split(':')[0]) && h.endsWith(':-')), one('HOLDS'));
check('nothing of the hoard in anybody\'s pack', one('PACKED') === '0', one('PACKED'));
check('Examine of its tile: cleared, its restock, and the hoard chest and what is in it',
  new RegExp(`Lair: Goblin warren: cleared, .*restock in .*; ${LAIR_CHEST_NAME.toLowerCase()} ${holds.reduce((n, h) => n + Number(h.split(':')[2]), 0)} things?, gone at the restock or once emptied\\.`)
    .test(one('EXAMINE')), one('EXAMINE'));
check('the ground read hands every browser the chest as a piece, and what is in it within reach', one('GROUND') === `${LAIR_CHEST}:${holds.length}`, one('GROUND'));

/* ---- the chest -------------------------------------------------------------------------------------------------------- */

check('of every action the island knows, only Take and Take all are let through at the chest',
  one('CHESTLET').split(',').includes('furniture_take_all') && one('CHESTLET').split(',').every((id) => LAIR_CHEST_OPENS.has(id)), one('CHESTLET'));
{
  const [take, all, into, mark] = one('CHESTSAYS').split('|');
  check('Take of one thing in it and Take all: let through, for somebody who dealt nothing that counted', take === '-' && all === '-', one('CHESTSAYS'));
  check('nothing put into it, in the browser\'s words', into === LAIR_CHEST_SHUT, into);
  check('and no settlement\'s store', mark !== '-', mark);
}
for (const job of ['pick_up_furniture', 'name_thing']) {
  const why = said('CHESTACT').find((l) => l.startsWith(`${job}|`))?.split('|')[1];
  check(`${ACTION_BY_ID.get(job)?.label} at the chest refused through rpc_act, in the browser's words`, why === LAIR_CHEST_SHUT, why);
}
{
  const [ears1, there] = one('TOOK').split('|');
  check('Take: one ear into the passer-by\'s pack, the chest still there', ears1 === '1' && there === '1', one('TOOK'));
  const [ears2, gone, link, told] = one('TOOKALL').split('|');
  check('Take all: the rest into the pack, and the chest, emptied, gone', ears2 === '2' && gone === '0' && link === '-', one('TOOKALL'));
  check('and said so', told.includes(`Taken from ${LAIR_CHEST_NAME.toLowerCase()}`), told);
}

/* ---- the restock ------------------------------------------------------------------------------------------------------ */

check('at its restock the warren stands on its tile again, its garrison coming back', one('BACK') === `held|goblin_warren:${AT[0].x}:${AT[0].y}|-|1`, one('BACK'));
{
  const [state, piece, n] = one('CAMP').split('|');
  check('a camp cleared: its piece gone, its chest holding its share', state === 'cleared' && piece === 'gone' && Number(n) >= 1, one('CAMP'));
}
check('left full until its restock: the chest gone with what was in it, the camp back and its fire lit', one('CAMPBACK') === 'held|0|0|orc_camp:true', one('CAMPBACK'));
check('a boss killed with nobody\'s blows counted: no shares and no chest, the piece gone all the same', one('NOBODY') === 'cleared|gone|-|0', one('NOBODY'));

/* ---- the browser ------------------------------------------------------------------------------------------------------ */

const chestDef = FURNITURE_BY_ID.get(LAIR_CHEST);
check('the browser: a hoard chest is a lair chest, holds things and is no settlement store; nobody builds it or a lair',
  !!chestDef?.lairChest && chestDef.capacity === LAIR_CHEST_HOLDS && !storeMarkable(LAIR_CHEST, chestDef)
    && !RECIPES.some((r) => r.result === LAIR_CHEST || LAIR_KINDS.some((k) => k.id === r.result)));
check('the browser: Take and Take all at the chest, nothing else, in the island\'s words',
  [...LAIR_CHEST_OPENS].every((id) => lairPieceSays({ kind: LAIR_CHEST } as PlacedFurniture, id) === null)
    && ['pick_up_furniture', 'name_thing', 'turn_furniture', 'store_in_furniture', 'dye_item', 'repair_item', 'lock_item']
      .every((id) => lairPieceSays({ kind: LAIR_CHEST } as PlacedFurniture, id) === LAIR_CHEST_SHUT));

{
  // A game run as the island runs it, a warren and a full chest on its ground.
  const g = Game.create(4343, 128);
  g.creatures.fromIsland = true;
  g.springs.fromIsland = true;
  g.bodyFromIsland = true;
  g.packFromIsland = true;
  g.journalReady = false;
  g.tallyFromIsland = true;
  g.ask = () => {};
  const { x, y } = g.spawn;
  g.putBody(x + 0.5, y + 0.5, 0);
  const piece = (id: number, sub: string, px: number, sx: number, extra: object = {}): object => ({
    id, kind: 'furniture', sub, x: px, y, sx, sy: sx, ql: 50, fuel: null, ash: null, lit: null, dmg: null, name: null, material: null,
    litres: null, liquid: null, ferment: null, bait: null, bait_ql: null, caught: null, state: null, mine: false, facing: 's', ...extra,
  });
  g.sawGround({
    placed: [
      piece(9001, 'goblin_warren', x + 1, 0, { name: 'Home' }),
      piece(9002, LAIR_CHEST, x - 1, 1, { things: [{ id: 77001, def: 'chief_ear', ql: 40, dmg: 0, count: 1, extra: null }] }),
    ],
    crates: [], lying: [], crops: [], now: Date.now() / 1000,
    buildings: { nextId: 1, list: [], walls: [], floors: [] }, deeds: [],
  } as unknown as IslandGround, undefined, 'me');
  const warren = g.furniture.get(9001), chest = g.furniture.get(9002);
  check('the browser: the warren and the chest seen from the ground read', !!warren && isLairPiece(warren) && !!chest && isLairChest(chest) && chest.items.length === 1,
    `${warren?.kind} ${chest?.kind} ${chest?.items.length}`);
  if (warren && chest) {
    check('the browser: a name on a lair is not shown', furnitureName(warren) === 'Goblin warren', furnitureName(warren));
    const wt: Target = { kind: 'furniture', id: warren.id };
    const ct: Target = { kind: 'furniture', id: chest.id };
    const offered = g.actionsFor(wt).map((a) => a.def.id);
    check('the browser: no action is offered at a lair', offered.length === 0, offered.join(','));
    const atChest = g.actionsFor(ct).map((a) => a.def.id);
    check('the browser: at the chest, only taking', atChest.every((id) => LAIR_CHEST_OPENS.has(id)), atChest.join(','));
    for (const id of ['pick_up_furniture', 'name_thing']) {
      const n = g.log.length;
      g.requestAction(ACTION_BY_ID.get(id)!, { ...wt, name: 'Home' } as Target);
      check(`the browser: ${ACTION_BY_ID.get(id)?.label} at the warren refused in the island's words, nothing started`,
        g.log.slice(n).some((l) => l.text === lairShutSaid('Goblin warren')) && !g.action, g.log.slice(n).map((l) => l.text).join(' | '));
      const m = g.log.length;
      g.requestAction(ACTION_BY_ID.get(id)!, { ...ct, name: 'Loot' } as Target);
      check(`the browser: ${ACTION_BY_ID.get(id)?.label} at the chest refused in the island's words`,
        g.log.slice(m).some((l) => l.text === LAIR_CHEST_SHUT) && !g.action, g.log.slice(m).map((l) => l.text).join(' | '));
    }
    const log = g.inventory.add('log', { count: 1, ql: 30 });
    const m = g.log.length;
    g.requestAction(ACTION_BY_ID.get('store_in_furniture')!, { kind: 'item', uid: log.uid, into: chest.id } as Target);
    check('the browser: nothing put into the chest', g.log.slice(m).some((l) => l.text === LAIR_CHEST_SHUT), g.log.slice(m).map((l) => l.text).join(' | '));
  }
}

/* ---- the menus, drawn ------------------------------------------------------------------------------------------------- */

const ROOT = resolve('.');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}

const options = browserOptions();
const browser = options && existsSync(join(ROOT, 'index.html')) ? await chromium.launch(options).catch(() => null) : null;
if (!browser) {
  console.log('lairchest: no Chromium here (set CHROME_PATH), or no built site; the menus are not drawn.');
  if (process.env.LAIRCHEST_STRICT) check('drawn: Chromium', false);
} else {
  // With LAIRCHEST_SHOTS set to a directory, the warren's menu, the cleared lair with its chest, and the chest's menu
  // and Examine are saved there at twice the pixels.
  const shots = process.env.LAIRCHEST_SHOTS;
  if (shots) mkdirSync(shots, { recursive: true });
  const made = new Map<string, string>();
  const head = readFileSync(join(ROOT, 'index.html'), 'utf8')
    .replace(/\s*<script type="module"[^>]*><\/script>/g, '')
    .replace(/\s*<link rel="modulepreload"[^>]*>/g, '');
  const bundled = await build({
    entryPoints: [join(ROOT, 'supabase/test/lairchest-page.ts')], bundle: true, format: 'esm', write: false, logLevel: 'error', target: 'es2022',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
  });
  made.set('__lc.js', bundled.outputFiles[0].text);
  made.set('__lc.html', head.replace('</body>', '<script type="module" src="./__lc.js"></script>\n</body>'));
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '');
    if (made.has(path)) {
      res.writeHead(200, { 'content-type': TYPES[extname(path)] }).end(made.get(path));
      return;
    }
    const file = join(ROOT, path || 'index.html');
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  try {
    const tab: Page = await (await browser.newContext({ viewport: { width: 1000, height: 720 }, deviceScaleFactor: 2 })).newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
    await tab.goto(`${base}/__lc.html`, { waitUntil: 'load' });
    await tab.waitForFunction(() => !!(window as unknown as { lairchest?: unknown }).lairchest, null, { timeout: 60_000 });
    const call = <T>(f: string, ...args: unknown[]): Promise<T> =>
      tab.evaluate(([f, args]) => {
        const api = (window as unknown as { lairchest: Record<string, (...a: unknown[]) => unknown> }).lairchest;
        return api[f as string](...(args as unknown[]));
      }, [f, args] as const) as Promise<T>;
    await call('wait', 1500);
    // The chest holding what the island put in it above.
    await call('fill', holds.map((h) => [h.split(':')[0], Number(h.split(':')[2])]));
    const warren = await call<LairMenu>('menu', 'warren');
    check('drawn: the warren picked, its menu Examine and nothing else', warren.picked === 'goblin_warren' && warren.rows[0] === 'Examine'
      && !warren.rows.some((r) => /Pick it up|name|Turn|Open|Repair|Dye|Padlock/i.test(r)), JSON.stringify(warren));
    if (shots) await tab.screenshot({ path: join(shots, 'warren-menu.png') });
    await call('hide');
    await call('wait', 300);
    if (shots) await tab.screenshot({ path: join(shots, 'cleared-lair-chest.png') });
    const chest = await call<LairMenu>('menu', 'chest');
    check('drawn: the chest picked, titled by its lair and what is in it, its menu Open, Take everything and Examine',
      chest.picked === LAIR_CHEST && chest.title === `${LAIR_CHEST_NAME} (goblin warren \u00b7 ${holds.reduce((n, h) => n + Number(h.split(':')[2]), 0)} things)` && chest.rows.slice(0, 3).join('|') === `Open|${ACTION_BY_ID.get('furniture_take_all')?.label}|Examine`
        && !chest.rows.some((r) => /Pick it up|name/i.test(r)), JSON.stringify(chest));
    await call('say', one('EXAMINE'));
    await call('wait', 400);
    if (shots) await tab.screenshot({ path: join(shots, 'chest-menu-examine.png') });
    check('drawn: nothing thrown', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
    server.close();
  }
}

finish('lair hoard chest');

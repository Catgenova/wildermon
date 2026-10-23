/**
 * Memorial stones (`memorial.ts`), on both sides.
 *
 * The piece, its recipe and its item, the same on both sides; built with
 * masonry and a trowel and set down; Engrave with a stone chisel, a line of
 * up to `ENGRAVE_MAX` characters cleaned as talk is, by whoever set it down
 * and by anybody of the settlement it stands on and nobody else, never by
 * somebody a keeper has muted; every refusal in the same words; a new line
 * cut over the old; Examine reading it back in quotes; and the line going
 * where the stone goes -- picked up into the pack, said on Examine there, set
 * down again, through the ground read, the pack's row and a save.
 *
 * Every roll is set. Runs against the database the suite leaves behind; the
 * island half is rolled back.
 *
 *   npx esbuild supabase/test/memorial.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/memorial.mjs && node node_modules/.cache/memorial.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game, type IslandGround } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { cleanSaid } from '../../src/game/chat';
import { FURNITURE_BY_ID } from '../../src/game/furniture';
import { ITEM_DEFS, type Item } from '../../src/game/items';
import { lampTooFar } from '../../src/game/lamps';
import {
  cleanEngraving, ENGRAVE, ENGRAVE_MAX, ENGRAVE_SKILL, ENGRAVE_TOOL, engravedItemSays, engravedSaid, MEMORIAL, MEMORIAL_SAID, memorialSays, READ_MEMORIAL,
} from '../../src/game/memorial';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { packLand, packWorld, unpack } from '../../src/game/save';
import { packed } from '../../src/net/packed';
import type { ItemRow } from '../../src/net/island';
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
const sq = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/* ---- the piece, its recipe and its item, and the words, on both sides --------------------- */

const piece = FURNITURE_BY_ID.get(MEMORIAL);
const recipe = RECIPE_BY_ID.get(`make_${MEMORIAL}`);
const item = ITEM_DEFS[MEMORIAL];
const recipeIsle = psql(`select r.tool || '|' || r.skill || '|' || r.base_time || '|' || r.difficulty || '|'
  || (select string_agg(i.item || ':' || i.count, ',' order by i.item) from recipe_input i where i.recipe = r.id)
  from recipe r where r.id = 'make_${MEMORIAL}'`);
const recipeHere = recipe ? `${recipe.tool}|${recipe.skill}|${recipe.baseTime}|${recipe.difficulty}|${recipe.inputs.map((i) => `${i.item}:${i.count}`).sort().join(',')}` : '';
check(`a memorial stone is built the same on both sides: ${recipeHere}`,
  !!piece && recipeIsle === recipeHere && recipe?.tool === 'trowel' && recipe?.skill === 'masonry', recipeIsle);
const itemIsle = psql(`select d.name || '|' || d.weight || '|' || d.decay || '|' || d.description || '|' || f.w || 'x' || f.h
  from item_def d join furniture_def f on f.id = d.id where d.id = '${MEMORIAL}'`);
check('its item and its footprint are the same on both sides, and it does not decay',
  itemIsle === `${item?.name}|${item?.weight}|${item?.decay}|${item?.description}|${piece?.w}x${piece?.h}` && item?.decay === 0, itemIsle);
check(`the item says the longest line it takes, ${ENGRAVE_MAX} characters, off the rule`, !!item?.description?.includes(`up to ${ENGRAVE_MAX} characters`) && !item?.description?.includes('{'),
  item?.description);
const jobsIsle = psql(`select string_agg(id || ':' || label || ':' || coalesce(skill, '-') || ':' || coalesce(tool, '-') || ':' || base_time || ':' || instant, '|' order by id)
  from action_def where id in ('${ENGRAVE}', '${READ_MEMORIAL}')`);
const jobsHere = [ENGRAVE, READ_MEMORIAL].sort().map((id) => {
  const a = ACTION_BY_ID.get(id) as ActionDef;
  return `${a.id}:${a.label}:${a.skill ?? '-'}:${a.tool ?? '-'}:${a.baseTime}:${!!a.instant}`;
}).join('|');
check(`its two jobs are the same rows on both sides: ${jobsHere}`, jobsIsle === jobsHere
  && jobsHere.includes(`${ENGRAVE}:Engrave:${ENGRAVE_SKILL}:${ENGRAVE_TOOL}`) && jobsHere.includes(`${READ_MEMORIAL}:Examine`), jobsIsle);

// The words, cleaned as talk is: the same on both sides, and the same as talk's but for the length.
const LINES = [
  'Here lies Bramble, who dug the first well',
  '  In memory\nof\tthe   old   oak  ',
  '\n\t \n',
  'Quoted "words" and an apostrophe\'s line',
  'x'.repeat(ENGRAVE_MAX + 30),
  `${' '.repeat(10)}${'y'.repeat(ENGRAVE_MAX)}`,
];
const cleanIsle = psql(`select string_agg(memorial_clean(t), '#' order by o) from unnest(array[${LINES.map((l) => `E${sq(l).replace(/\n/g, '\\n').replace(/\t/g, '\\t')}`).join(', ')}]::text[]) with ordinality u(t, o)`);
const cleanHere = LINES.map(cleanEngraving);
check('a line is cleaned the same on both sides: newlines and tabs to spaces, runs of spaces to one, trimmed, cut at the longest',
  cleanIsle === cleanHere.join('#') && cleanHere[1] === 'In memory of the old oak' && cleanHere[2] === '' && cleanHere[4].length === ENGRAVE_MAX
    && cleanHere[5] === 'y'.repeat(ENGRAVE_MAX), cleanIsle);
check('and as talk is cleaned, at a line of talk\'s own length', LINES.every((l) => cleanEngraving(l) === cleanSaid(l).slice(0, ENGRAVE_MAX)));
const wordsIsle = psql(`select concat_ws('#', memorial_says(null), memorial_says('Here lies Bramble'), engraved_said('Here lies Bramble', false),
  engraved_said('Here lies Bramble', true), engraved_item_says('Here lies Bramble'), engraved_item_says(null),
  memorial_said('notYours'), memorial_said('noChisel'), memorial_said('nothing'), memorial_said('same'), lamp_too_far_said('memorial stone'))`);
const wordsHere = [memorialSays(undefined), memorialSays('Here lies Bramble'), engravedSaid('Here lies Bramble', false), engravedSaid('Here lies Bramble', true),
  engravedItemSays({ engraving: 'Here lies Bramble' }), engravedItemSays({}), MEMORIAL_SAID.notYours, MEMORIAL_SAID.noChisel, MEMORIAL_SAID.nothing,
  MEMORIAL_SAID.same, lampTooFar('memorial stone')].join('#');
check('every sentence it says is the same on both sides, and Examine reads the line back in quotes', wordsIsle === wordsHere
  && memorialSays('Here lies Bramble') === 'Memorial stone: “Here lies Bramble”', `${wordsIsle} / ${wordsHere}`);

/* ---- on the island --------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-0000000000a1';
const OTTO = 'e1c4a170-0000-4000-8000-0000000000a2';
const LINE = '  Here lies Bramble,\nwho dug   the first well  ';
const LONG = 'Bramble and Sorrel and the hounds, who came in the spring and stayed to the very end of it';
const E = (s: string): string => `E${sq(s).replace(/\n/g, '\\n').replace(/\t/g, '\\t')}`;
const T = (id: string, name?: string): string => `jsonb_build_object('kind', 'furniture', 'id', ${id}${name === undefined ? '' : `, 'name', ${E(name)}`})`;
// What the job itself said, past the line a skill's rise adds after it.
const lastSaid = (who = 'u'): string => `(select e.text from event e where e.world_id = w and e.uid = ${who} and e.kind = 'event' order by e.n desc limit 1)`;
const count = (def: string): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = u and def = '${def}'), 0)`;
const refusal = (key: string, who: string, id: string, name?: string): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, ${who}, '${ENGRAVE}', ${T(id, name)}), 'none'));`;

const out = psql(`
set wurm.season = '';
discard temp;
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
declare xs text[] := string_to_array(current_setting('wurm.dice'), ',');
        n int := coalesce(nullif(current_setting('wurm.dice_n', true), ''), '0')::int;
begin
  perform set_config('wurm.dice_n', (n + 1)::text, true);
  return xs[1 + n % array_length(xs, 1)]::double precision;
end $f$;
create function pg_temp.dice(v text) returns void language plpgsql as $f$
begin
  perform set_config('wurm.dice', v, true);
  perform set_config('wurm.dice_n', '0', true);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
end $f$;
create function pg_temp.nodice() returns void language plpgsql as $f$
begin
  perform set_config('search_path', '"$user", public', true);
end $f$;
-- Nothing made here comes out rare: the stone is measured as a plain one.
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; o uuid := '${OTTO}'; v_x bigint; v_st bigint; v_pl bigint; v_g jsonb; v_skill double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Memorial', 161, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
  perform rpc_join(w, 'Otto');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  insert into skill (world_id, uid, id, value) values (w, u, 'masonry', 60), (w, o, 'masonry', 60)
    on conflict (world_id, uid, id) do update set value = excluded.value;

  -- 1. Built with masonry and a trowel, and set down.
  perform give(w, u, 'trowel', 1, 50);
  v_x := give(w, u, 'stone_slab', 2, 40);
  perform give(w, u, 'stone_brick', 8, 40);
  perform give(w, u, 'mortar', 4, 40);
  insert into said values ('BUILDASK', coalesce(act_refusal(w, u, 'make_${MEMORIAL}', jsonb_build_object('kind', 'item', 'uid', v_x)), 'none'));
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_${MEMORIAL}', jsonb_build_object('kind', 'item', 'uid', v_x));
  perform pg_temp.nodice();
  insert into said values ('BUILT', ${count(MEMORIAL)} || '|' || ${count('stone_slab')} || '|' || ${count('stone_brick')} || '|' || ${count('mortar')});
  select id into v_st from item where world_id = w and holder_uid = u and def = '${MEMORIAL}';
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_st, 'x', 10, 'y', 10, 'sx', 1, 'sy', 1, 'facing', 's'));
  select id into v_pl from placed where world_id = w and kind = 'furniture' and sub = '${MEMORIAL}';
  insert into said values ('PLACED', coalesce(v_pl::text, 'none') || '|' || ${count(MEMORIAL)});

  -- 2. Engrave's refusals, in order: gone, out of reach, the chisel, the words.
  insert into said values ('LOOK0', coalesce(act_refusal(w, u, '${READ_MEMORIAL}', ${T('v_pl')}), 'none'));
  perform act_perform(w, u, '${READ_MEMORIAL}', ${T('v_pl')});
  insert into said values ('READ0', ${lastSaid()});
  ${refusal('R:gone', 'u', '987654', 'x')}
  ${refusal('R:chisel', 'u', 'v_pl', LINE)}
  perform give(w, u, 'chisel', 1, 50);
  update player set body_at = now(), x = 20.5, y = 20.5 where world_id = w and uid = u;
  ${refusal('R:far', 'u', 'v_pl', LINE)}
  update player set body_at = now(), x = 10.5, y = 10.5 where world_id = w and uid = u;
  ${refusal('R:unasked', 'u', 'v_pl')}
  ${refusal('R:blank', 'u', 'v_pl', '  \n\t  ')}
  ${refusal('R:none', 'u', 'v_pl', LINE)}
  -- Muted by a keeper of the island: cuts nothing, as it says nothing.
  insert into private.island_mute (world_id, uid, until, by_uid) values (w, u, null, o);
  ${refusal('R:muted', 'u', 'v_pl', LINE)}
  insert into said values ('MUTEDWHY', private.muted_why(w, u));
  delete from private.island_mute where world_id = w and uid = u;

  -- 3. Cut, through the job: the line cleaned as talk is, masonry trained and the chisel worn.
  select value into v_skill from skill where world_id = w and uid = u and id = 'masonry';
  perform act_perform(w, u, '${ENGRAVE}', ${T('v_pl', LINE)});
  insert into said select 'CUT', coalesce(pl.engraving, '-') || '|' || ${lastSaid()} || '|'
      || ((select value from skill where world_id = w and uid = u and id = 'masonry') > v_skill)::text || '|'
      || ((select dmg from item where world_id = w and holder_uid = u and def = 'chisel') > 0)::text
    from placed pl where pl.id = v_pl;
  ${refusal('R:same', 'u', 'v_pl', LINE)}
  perform act_perform(w, u, '${READ_MEMORIAL}', ${T('v_pl')});
  insert into said values ('READ', ${lastSaid()});

  -- 4. Somebody else: not theirs, with a chisel and beside it, until they are of the settlement it stands on.
  perform give(w, o, 'chisel', 1, 50);
  ${refusal('R:other', 'o', 'v_pl', LONG)}
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Brambleholt', 10, 10, 3, 1, u);
  insert into deed_member (world_id, founder, uid, role) values (w, u, o, 'builder');
  ${refusal('R:citizen', 'o', 'v_pl', LONG)}
  perform act_perform(w, o, '${ENGRAVE}', ${T('v_pl', LONG)});
  insert into said select 'RECUT', coalesce(pl.engraving, '-') || '|' || ${lastSaid('o')} from placed pl where pl.id = v_pl;
  delete from deed_member where world_id = w;
  delete from deed where world_id = w;

  -- 5. Where the stone goes, its line goes: picked up, examined in the pack, set down again, and read off the ground.
  perform act_perform(w, u, '${ENGRAVE}', ${T('v_pl', LINE)});
  perform act_perform(w, u, 'pick_up_furniture', jsonb_build_object('kind', 'furniture', 'id', v_pl));
  select id into v_st from item where world_id = w and holder_uid = u and def = '${MEMORIAL}';
  insert into said select 'LIFTED', coalesce(i.engraving, '-') || '|' || (select count(*) from placed where id = v_pl) from item i where i.id = v_st;
  insert into said select 'PACKLOOK', examine_item_text(w, u, i) from item i where i.id = v_st;
  insert into said select 'ROW', (to_jsonb(i) - 'world_id')::text from item i where i.id = v_st;
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_st, 'x', 11, 'y', 10, 'sx', 0, 'sy', 0, 'facing', 'e'));
  select id into v_pl from placed where world_id = w and kind = 'furniture' and sub = '${MEMORIAL}';
  insert into said select 'DOWNAGAIN', coalesce(pl.engraving, '-') || '|' || pl.x || '|' || pl.facing from placed pl where pl.id = v_pl;
  v_g := rpc_ground(w, 40, false);
  insert into said values ('PIECEID', v_pl::text);
  insert into said values ('GROUND', v_g::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(161, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(10.5, 10.5, 0);
g.settings.fromStores = false;
g.skills.values.set('masonry', 60);
const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
const lastHere = (): string => said[said.length - 1] ?? '';
const dice = (...xs: number[]): void => {
  let n = 0;
  g.rand = () => xs[n++ % xs.length];
};
const held = (id: string): number => g.inventory.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number, count = 1): Item => g.gather(id, { count, ql });
const ask = (id: string, t: Target): string => act(id).check?.(t, g) ?? 'none';
const at = (id: number, name?: string): Target => ({ kind: 'furniture', id, ...(name === undefined ? {} : { name }) } as Target);

/* 1. Built and set down. */
thing('trowel', 50);
const slab = thing('stone_slab', 40, 2);
thing('stone_brick', 40, 8);
thing('mortar', 40, 4);
const buildAsk = act(`make_${MEMORIAL}`).check?.({ kind: 'item', uid: slab.uid }, g) ?? 'none';
dice(0.01);
act(`make_${MEMORIAL}`).perform({ kind: 'item', uid: slab.uid }, g);
check(`it is built with masonry and a trowel from ${recipe?.inputs.map((i) => `${i.count} ${i.item}`).join(', ')}, the same on both sides`,
  isle.get('BUILDASK') === 'none' && buildAsk === 'none' && isle.get('BUILT') === '1|0|0|0' && held(MEMORIAL) === 1 && held('stone_slab') === 0 && held('mortar') === 0,
  `${isle.get('BUILDASK')} ${isle.get('BUILT')} / ${buildAsk} ${held(MEMORIAL)}`);
const stone = g.inventory.items.find((it) => it.id === MEMORIAL) as Item;
act('place_furniture').perform({ kind: 'tile', x: 10, y: 10, sx: 1, sy: 1, itemUid: stone.uid, facing: 's' } as Target, g);
const f = [...g.furniture.values()].find((p) => p.kind === MEMORIAL);
check('and set down like any piece', part('PLACED', 0) !== 'none' && part('PLACED', 1) === '0' && !!f && held(MEMORIAL) === 0, isle.get('PLACED'));
const id = f?.id ?? -1;

/* 2. Refusals. */
const look0 = ask(READ_MEMORIAL, at(id));
act(READ_MEMORIAL).perform(at(id), g);
check(`Examine on a blank stone says so, and what it takes, the same on both sides: ${lastHere()}`,
  isle.get('LOOK0') === 'none' && look0 === 'none' && isle.get('READ0') === lastHere() && lastHere() === memorialSays(undefined), isle.get('READ0'));
const R: Record<string, string> = {};
R['R:gone'] = ask(ENGRAVE, at(987654, 'x'));
R['R:chisel'] = ask(ENGRAVE, at(id, LINE));
thing('chisel', 50);
g.putBody(20.5, 20.5, 0);
R['R:far'] = ask(ENGRAVE, at(id, LINE));
g.putBody(10.5, 10.5, 0);
R['R:unasked'] = ask(ENGRAVE, at(id));
R['R:blank'] = ask(ENGRAVE, at(id, '  \n\t  '));
R['R:none'] = ask(ENGRAVE, at(id, LINE));
const WANT: Record<string, string> = {
  'R:gone': 'It is gone.', 'R:chisel': MEMORIAL_SAID.noChisel, 'R:far': lampTooFar('memorial stone'), 'R:unasked': 'none',
  'R:blank': MEMORIAL_SAID.nothing, 'R:none': 'none',
};
for (const [k, want] of Object.entries(WANT)) {
  check(`Engrave ${k.slice(2)}: ${want}`, isle.get(k) === want && R[k] === want, `island ${isle.get(k)} / browser ${R[k]}`);
}
check('somebody a keeper has muted cuts nothing, in the keeper\'s own words, on the island where there are keepers',
  !!isle.get('MUTEDWHY') && isle.get('R:muted') === isle.get('MUTEDWHY'), isle.get('R:muted'));

/* 3. Cut. */
act(ENGRAVE).perform(at(id, LINE), g);
const cut = cleanEngraving(LINE);
check(`a line is cut cleaned, the same on both sides: ${engravedSaid(cut, false)}`,
  part('CUT', 0) === cut && f?.engraving === cut && part('CUT', 1) === lastHere() && lastHere() === engravedSaid(cut, false) && cut === 'Here lies Bramble, who dug the first well',
  `${isle.get('CUT')} / ${f?.engraving} ${lastHere()}`);
check('and on the island it trains masonry and wears the chisel a go\'s worth, as the browser\'s finished job does',
  part('CUT', 2) === 'true' && part('CUT', 3) === 'true', isle.get('CUT'));
const same = ask(ENGRAVE, at(id, LINE));
check(`the same words again are refused: ${same}`, same === MEMORIAL_SAID.same && isle.get('R:same') === same, isle.get('R:same'));
act(READ_MEMORIAL).perform(at(id), g);
check(`Examine reads it back in quotes: ${lastHere()}`, isle.get('READ') === lastHere() && lastHere() === memorialSays(cut), isle.get('READ'));

/* 4. Somebody else's stone. */
if (f) f.mine = false;
const other = ask(ENGRAVE, at(id, LONG));
check(`somebody else's stone is not theirs to cut: ${other}`, other === MEMORIAL_SAID.notYours && isle.get('R:other') === other, isle.get('R:other'));
g.deed = { name: 'Brambleholt', x: 10, y: 10, radius: 3, level: 1, mine: true } as never;
const citizen = ask(ENGRAVE, at(id, LONG));
act(ENGRAVE).perform(at(id, LONG), g);
const long = cleanEngraving(LONG);
check(`until they are of the settlement it stands on, and then a new line goes over the old, cut at ${ENGRAVE_MAX} characters`,
  citizen === 'none' && isle.get('R:citizen') === 'none' && part('RECUT', 0) === long && f?.engraving === long && long.length === ENGRAVE_MAX
    && part('RECUT', 1) === lastHere() && lastHere() === engravedSaid(long, true),
  `${isle.get('R:citizen')} ${isle.get('RECUT')} / ${citizen} ${f?.engraving} ${lastHere()}`);
g.deed = null;
if (f) f.mine = true;

/* 5. Where it goes. */
act(ENGRAVE).perform(at(id, LINE), g);
act('pick_up_furniture').perform(at(id), g);
const lifted = g.inventory.items.find((it) => it.id === MEMORIAL);
check('picked up, the stone in the pack carries its line, on both sides', part('LIFTED', 0) === cut && part('LIFTED', 1) === '0' && lifted?.engraving === cut && !g.furniture.has(id),
  `${isle.get('LIFTED')} / ${lifted?.engraving}`);
act('examine_item').perform({ kind: 'item', uid: lifted?.uid ?? -1 }, g);
const tail = engravedItemSays({ engraving: cut });
check(`and Examine on it in the pack says it: ${tail.trim()}`, (isle.get('PACKLOOK') ?? '').includes(tail) && lastHere().includes(tail), isle.get('PACKLOOK'));
const rowBack = packed(JSON.parse(isle.get('ROW') ?? '{}') as ItemRow, { since: () => 0 });
check('the island\'s row comes into the browser with its line', rowBack.engraving === cut && rowBack.id === MEMORIAL, JSON.stringify(rowBack));
act('place_furniture').perform({ kind: 'tile', x: 11, y: 10, sx: 0, sy: 0, itemUid: lifted?.uid ?? -1, facing: 'e' } as Target, g);
const again = [...g.furniture.values()].find((p) => p.kind === MEMORIAL);
check('set down again, it reads the same', part('DOWNAGAIN', 0) === cut && part('DOWNAGAIN', 2) === 'e' && again?.engraving === cut, `${isle.get('DOWNAGAIN')} / ${again?.engraving}`);
{
  const seen = Game.create(161, 64);
  seen.sawGround(JSON.parse(isle.get('GROUND') ?? '{}') as IslandGround);
  const read = seen.furniture.get(Number(isle.get('PIECEID')));
  check('and the ground read brings the line to every browser that sees it', read?.kind === MEMORIAL && read.engraving === cut, JSON.stringify(read?.engraving));
}
{
  const land = await packLand(g);
  const back = await unpack(land, JSON.parse(JSON.stringify(packWorld(g))));
  const kept = [...(back?.furniture.values() ?? [])].find((p) => p.kind === MEMORIAL);
  check('and it keeps it through a save and a load in the browser', kept?.engraving === cut, JSON.stringify(kept?.engraving));
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`memorial stones — ${ok.length} of ${ok.length}`);

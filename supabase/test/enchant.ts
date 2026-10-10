/**
 * Enchanting (`enchant.ts`, `enchanting.ts`), on both sides.
 *
 * A paper press built with carpentry and set down, papyrus pressed at it and
 * refused without it; enchantment scrolls written from papyrus and motes with
 * enchanting, three of them -- Firebrand (fire motes, a burn), Razoredge (ice,
 * a bleed) and Concussion (earth, a stun) -- each held to its sheet's QL, and
 * one that fails losing its motes and damaging its sheet, or using it up; a
 * scroll put into a melee weapon with Enchant, at the average of enchanting
 * and the scroll's QL as a percent, between the least and the most, at a
 * quality rolled about that average and held to the scroll's QL and the
 * weapon's own, and otherwise the weapon damaged or gone; every refusal; the
 * marker on a name, Examine's line, the enchantment in every payload that
 * carries a thing and through a save; what a landed hit does with each, just
 * under its chance and just over it, and through a swing; and the stun
 * itself: neither moving nor striking for its seconds, and a second stun
 * starting it again rather than adding on.
 *
 * Every roll is set: dice on the island (`random()` read off a list, as the
 * Artisan's test has them) and the same list as the browser's `rand`. Runs
 * against the database the suite leaves behind; the island half is rolled back.
 *
 *   npx esbuild supabase/test/enchant.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/enchant.mjs && node node_modules/.cache/enchant.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { itemName, type Item } from '../../src/game/items';
import { RECIPE_BY_ID, STATION_NAME, scrollHarmSaid } from '../../src/game/recipes';
import {
  alreadyEnchanted, ENCHANT_BREAK, ENCHANT_HARM, ENCHANT_LEAST, ENCHANT_MOST, ENCHANT_SAID, enchantChance, enchantHitChance, ENCHANTMENT_LIST,
  ENCHANTMENTS, enchantQl, qlWord, SCROLL_HARM, SCROLL_MOTES, type EnchantmentDef,
} from '../../src/game/enchant';
import { craftSpread, EFFECT_HEAD, enchantedSaid, enchantHitSaid, enchantRoll, enchantSays, MELEE_WEAPONS, notTakenSaid, stun } from '../../src/game/enchanting';
import { KNIFE_BLEED, STUN_SECS } from '../../src/game/fight';
import { packed } from '../../src/net/packed';
import type { ItemRow } from '../../src/net/island';
import { packLand, packWorld, unpack } from '../../src/game/save';
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
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

const [FIRE, RAZOR, CONC] = ['firebrand', 'razoredge', 'concussion'].map((id) => ENCHANTMENTS[id]);

/* ---- the numbers and the words, on both sides ------------------------------ */

const rowsIsle = psql(`select string_agg(id || ':' || name || ':' || scroll || ':' || mote || ':' || effect || ':' || per_ql, '|' order by ord) from enchantments()`);
check(`the ${ENCHANTMENT_LIST.length} enchantments are the same rows on both sides: ${ENCHANTMENT_LIST.map((e) => `${e.name} (${e.mote}, ${e.effect})`).join(', ')}`,
  rowsIsle === ENCHANTMENT_LIST.map((e) => `${e.id}:${e.name}:${e.scroll}:${e.mote}:${e.effect}:${e.perQl}`).join('|')
    && FIRE.mote === 'fire_mote' && RAZOR.mote === 'ice_mote' && CONC.mote === 'earth_mote', rowsIsle);
check('Firebrand and Razoredge work a quarter of their QL as a percent of the time, 25% at QL 100; Concussion a tenth, 10% at QL 100 and no more above it',
  near(enchantHitChance(FIRE, 100), 0.25) && near(enchantHitChance(RAZOR, 100), 0.25) && near(enchantHitChance(CONC, 100), 0.1)
    && near(enchantHitChance(CONC, 140), 0.1) && near(enchantHitChance(FIRE, 40), 0.1) && near(enchantHitChance(CONC, 40), 0.04));
const melee = psql(`select string_agg(id, ',' order by id) from weapon_def where melee_weapon(id)`);
check(`the same ${MELEE_WEAPONS.length} weapons take an enchantment on both sides, and no bow and no thrown weapon`,
  melee === [...MELEE_WEAPONS].sort().join(',') && !MELEE_WEAPONS.includes('short_bow') && !MELEE_WEAPONS.includes('javelin') && MELEE_WEAPONS.includes('sword'), melee);

const PTS: Array<[number, number]> = [[1, 1], [1, 20], [10, 30], [50, 50], [70, 90], [100, 100], [100, 95]];
const chanceIsle = psql(`select string_agg(enchant_chance(s, q)::text, ' ' order by o) from unnest(array[${PTS.map((p) => p[0]).join(',')}]::double precision[],
  array[${PTS.map((p) => p[1]).join(',')}]::double precision[]) with ordinality u(s, q, o)`).split(' ').map(Number);
check(`a go at Enchant takes the average of enchanting and the scroll's QL as a percent of the time, from ${ENCHANT_LEAST} to ${ENCHANT_MOST}, the same on both sides at ${PTS.map((p) => p.join('/')).join(', ')}`,
  PTS.every(([s, q], i) => near(chanceIsle[i], enchantChance(s, q)) && near(enchantChance(s, q), Math.min(ENCHANT_MOST, Math.max(ENCHANT_LEAST, (s + q) / 200)))),
  chanceIsle.join(' '));

const QLS: Array<[number, number, number, number]> = [
  [100, 90, 34, 0.01], [100, 40, 90, 0.5], [30, 90, 90, 0.01], [1, 1, 50, 0.99], [80, 60, 100, 0.25], [60, 100, 55, 0.7], [100, 100, 100, 1],
];
const qlIsle = psql(`select string_agg(round(q.o_ql::numeric, 9) || ':' || coalesce(q.o_held, '-'), ' ' order by o)
  from unnest(array[${QLS.map((p) => p[0])}]::float8[], array[${QLS.map((p) => p[1])}]::float8[], array[${QLS.map((p) => p[2])}]::float8[],
              array[${QLS.map((p) => p[3])}]::float8[]) with ordinality u(s, sq, iq, r, o), lateral enchant_ql(s, sq, iq, r) q`).split(' ');
const qlHere = QLS.map(([s, sq, iq, r]) => enchantQl(s, sq, iq, (b) => craftSpread(b, r)));
check('the quality one that took comes out at, and what held it down, are the same on both sides: the average rolled as a craft is, held to the scroll and the item',
  qlIsle.length === QLS.length && qlIsle.every((x, i) => near(Number(x.split(':')[0]), qlHere[i].ql, 1e-6) && x.split(':')[1] === (qlHere[i].held ?? '-'))
    && qlHere[0].ql === 34 && qlHere[0].held === 'item' && qlHere[1].ql === 40 && qlHere[1].held === 'scroll' && qlHere[2].held === null,
  `${qlIsle.join(' ')} / ${qlHere.map((q) => `${q.ql}:${q.held}`).join(' ')}`);

const sayQl = [0.4, 34, 37.48, 41.3, 63.2, 100];
const saysIsle = psql(`select '[' || string_agg(enchant_says(jsonb_build_object('id', e.id, 'ql', q)), '#' order by e.ord, o) || ']'
  from enchantments() e, unnest(array[${sayQl.join(',')}]::float8[]) with ordinality u(q, o)`);
const saysHere = `[${ENCHANTMENT_LIST.flatMap((e) => sayQl.map((q) => enchantSays({ enchant: { id: e.id, ql: q } }))).join('#')}]`;
check('Examine says each enchantment at its quality, with the exact share of hits from the rule, in the same words on both sides',
  saysIsle === saysHere && saysHere.includes('Concussion at QL 100.0: a hit stuns the target for 2 seconds 10% of the time.')
    && saysHere.includes('Firebrand at QL 63.2: a hit sets the target burning 15.8% of the time.'), saysIsle === saysHere ? '' : (() => { const i = [...saysIsle].findIndex((ch, k) => ch !== saysHere[k]); return `at ${i}: ${saysIsle.slice(i - 40, i + 60)} / ${saysHere.slice(i - 40, i + 60)}`; })());
const saidIsle = psql(`select string_agg(enchant_said(k), '|' order by o) from unnest(array[${Object.keys(ENCHANT_SAID).map((k) => `'${k}'`).join(',')}]) with ordinality u(k, o)`);
check('a refused Enchant is said in the same words', saidIsle === Object.values(ENCHANT_SAID).join('|'), saidIsle);
const station = psql(`select station_name('paper_press') || '|' || (select station from recipe where id = 'make_papyrus')`);
check('papyrus is pressed at a paper press on both sides, and it is called one', station === `${STATION_NAME.paper_press}|paper_press` && RECIPE_BY_ID.get('make_papyrus')?.station === 'paper_press', station);

/* ---- on the island ------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-000000000001';
const T = (uid: string, scroll: string): string => `jsonb_build_object('kind', 'item', 'uid', ${uid}, 'scroll', ${scroll})`;
const lastSaid = `(select e.text from event e where e.world_id = w and e.uid = u order by e.n desc limit 1)`;
const count = (def: string): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = u and def = '${def}'), 0)`;
const effects = (id: string | number): string => `(select coalesce(string_agg(m.kind, ',' order by m.kind), '-') from class_mark m where m.world_id = w and m.creature_id = ${id} and m.until > now())
    || '/' || coalesce((select (c.bleed_until > now())::text from creature c where c.world_id = w and c.id = ${id}), 'false')`;
/** Each enchantment's hit at QL 40: a roll just over its chance, then just under. */
const HIT_QL = 40;

const out = psql(`
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
create function pg_temp.thing(w uuid, u uuid, d text, n int, ql double precision, dmg double precision, x text) returns bigint
  language plpgsql as $f$
declare v bigint;
begin
  v := give(w, u, d, n, ql, x);
  update item set dmg = thing.dmg where id = v;
  return v;
end $f$;
-- Nothing made here comes out rare: a rare thing is its own pile, and the counts would not be what is measured.
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
select setseed(0.118) \\g /dev/null
do $t$
declare w uuid; u uuid := '${MIRA}'; v_reed bigint; v_pap bigint; v_s bigint; v_sw bigint; v_x bigint; v_pl bigint;
        v_e record; v_before double precision; v_p player; v_c creature;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Enchanting', 118, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;

  -- 1. Papyrus, refused without a press; the press built, set down, and papyrus pressed at it.
  insert into skill (world_id, uid, id, value) values (w, u, 'papyrusmaking', 90), (w, u, 'carpentry', 90), (w, u, 'enchanting', 100)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  v_reed := give(w, u, 'reed', 8, 40);
  perform give(w, u, 'water_bucket', 2, 40);
  insert into said values ('NOPRESS', coalesce(act_refusal(w, u, 'make_papyrus', jsonb_build_object('kind', 'item', 'uid', v_reed)), 'none'));
  perform give(w, u, 'mallet', 1, 50);
  v_x := give(w, u, 'plank', 24, 40, 'Pine');
  perform give(w, u, 'timber', 12, 40, 'Pine');
  perform give(w, u, 'shaft', 4, 40, 'Pine');
  perform give(w, u, 'nail', 36, 40);
  insert into said values ('BUILDASK', coalesce(act_refusal(w, u, 'make_paper_press', jsonb_build_object('kind', 'item', 'uid', v_x)), 'none'));
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_paper_press', jsonb_build_object('kind', 'item', 'uid', v_x));
  perform pg_temp.nodice();
  insert into said values ('BUILT', ${count('paper_press')} || '|' || ${count('plank')} || '|' || ${count('nail')});
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'paper_press', 10, 10, 0, 0, 10.375, 10.375, 50);
  insert into said values ('ATPRESS', coalesce(act_refusal(w, u, 'make_papyrus', jsonb_build_object('kind', 'item', 'uid', v_reed)), 'none'));
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_papyrus', jsonb_build_object('kind', 'item', 'uid', v_reed));
  perform pg_temp.nodice();
  insert into said values ('PRESSED', ${count('papyrus')} || '|' || ${count('reed')});

  -- 2. Scrolls: at enchanting 100 on a QL 20 sheet, held to it; at enchanting 30 on a QL 90 sheet, the roll's.
  delete from item where world_id = w and holder_uid = u and def = 'papyrus';
  v_pap := give(w, u, 'papyrus', 3, 20);
  perform give(w, u, 'fire_mote', 10, 50);
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_firebrand_scroll', jsonb_build_object('kind', 'item', 'uid', v_pap));
  perform pg_temp.nodice();
  insert into said select 'SCROLL20', (select string_agg(i.ql::text, ',') from item i where i.world_id = w and i.holder_uid = u and i.def = 'firebrand_scroll')
    || '|' || ${count('papyrus')} || '|' || ${count('fire_mote')} || '|' || ${lastSaid};
  delete from item where world_id = w and holder_uid = u and def in ('papyrus', 'firebrand_scroll');
  update skill set value = 30 where world_id = w and uid = u and id = 'enchanting';
  v_pap := give(w, u, 'papyrus', 3, 90);
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_firebrand_scroll', jsonb_build_object('kind', 'item', 'uid', v_pap));
  perform pg_temp.nodice();
  insert into said select 'SCROLL30', (select string_agg(i.ql::text, ',') from item i where i.world_id = w and i.holder_uid = u and i.def = 'firebrand_scroll');

  -- 3. A scroll that fails: the motes gone, the sheet damaged as one of its pile; then a sheet used up.
  delete from item where world_id = w and holder_uid = u and def in ('papyrus', 'firebrand_scroll', 'fire_mote');
  v_pap := give(w, u, 'papyrus', 4, 50);
  perform give(w, u, 'fire_mote', 10, 50);
  perform pg_temp.dice('0.99');
  perform perform_craft(w, u, 'make_firebrand_scroll', jsonb_build_object('kind', 'item', 'uid', v_pap));
  perform pg_temp.nodice();
  insert into said select 'FAIL', ${count('firebrand_scroll')} || '|' || ${count('fire_mote')} || '|' || ${count('papyrus')}
    || '|' || (select round(dmg::numeric, 4) from item where id = v_pap) || '|' || ${lastSaid};
  delete from item where world_id = w and holder_uid = u and def = 'papyrus';
  v_pap := pg_temp.thing(w, u, 'papyrus', 1, 50, 80, null);
  perform pg_temp.dice('0.99');
  perform perform_craft(w, u, 'make_firebrand_scroll', jsonb_build_object('kind', 'item', 'uid', v_pap));
  perform pg_temp.nodice();
  insert into said select 'USEDUP', ${count('papyrus')} || '|' || ${count('fire_mote')} || '|' || ${lastSaid};

  -- 4. The other two scrolls, from their own motes.
  update skill set value = 100 where world_id = w and uid = u and id = 'enchanting';
  delete from item where world_id = w and holder_uid = u and def in ('papyrus', 'fire_mote');
  v_pap := give(w, u, 'papyrus', 2, 60);
  perform give(w, u, 'ice_mote', ${SCROLL_MOTES}, 50);
  perform give(w, u, 'earth_mote', ${SCROLL_MOTES}, 50);
  insert into said values ('NOMOTE', coalesce(act_refusal(w, u, 'make_firebrand_scroll', jsonb_build_object('kind', 'item', 'uid', v_pap)), 'none'));
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_razoredge_scroll', jsonb_build_object('kind', 'item', 'uid', v_pap));
  perform perform_craft(w, u, 'make_concussion_scroll', jsonb_build_object('kind', 'item', 'uid', v_pap));
  perform pg_temp.nodice();
  insert into said select 'OTHERS', ${count('razoredge_scroll')} || '|' || ${count('concussion_scroll')} || '|' || ${count('ice_mote')} || '|' || ${count('earth_mote')}
    || '|' || ${count('papyrus')};

  -- 5. Enchant's refusals.
  v_sw := give(w, u, 'sword', 1, 34, 'Iron');
  v_s := give(w, u, 'firebrand_scroll', 1, 90);
  insert into said values ('R:scroll', coalesce(act_refusal(w, u, 'enchant', ${T('v_sw', 'v_sw')}), 'none'));
  insert into said values ('R:weapon', coalesce(act_refusal(w, u, 'enchant', ${T('987654', 'v_s')}), 'none'));
  v_x := give(w, u, 'short_bow', 1, 50, 'Willow');
  insert into said values ('R:bow', coalesce(act_refusal(w, u, 'enchant', ${T('v_x', 'v_s')}), 'none'));
  v_x := give(w, u, 'javelin', 1, 50, 'Iron');
  insert into said values ('R:javelin', coalesce(act_refusal(w, u, 'enchant', ${T('v_x', 'v_s')}), 'none'));
  v_x := pg_temp.thing(w, u, 'hatchet', 1, 50, 100, 'Iron');
  insert into said values ('R:broken', coalesce(act_refusal(w, u, 'enchant', ${T('v_x', 'v_s')}), 'none'));
  v_x := give(w, u, 'maul', 1, 50, 'Iron');
  update item set enchant = '{"id": "razoredge", "ql": 41.3}'::jsonb where id = v_x;
  insert into said values ('R:held', coalesce(act_refusal(w, u, 'enchant', ${T('v_x', 'v_s')}), 'none'));
  insert into said values ('R:none', coalesce(act_refusal(w, u, 'enchant', ${T('v_sw', 'v_s')}), 'none'));

  -- 6. One that takes, through the job: enchanting 100, a QL 90 scroll, a QL 34 sword -- held to the sword.
  perform pg_temp.dice('0.01');
  perform act_perform(w, u, 'enchant', ${T('v_sw', 'v_s')});
  perform pg_temp.nodice();
  insert into said select 'TOOK', i.enchant::text || '|' || item_name(i) || '|' || ${count('firebrand_scroll')} || '|' || ${lastSaid}
    from item i where i.id = v_sw;
  insert into said select 'LOOK', examine_item_text(w, u, i) from item i where i.id = v_sw;
  insert into said select 'ROW', (to_jsonb(i) - 'world_id')::text from item i where i.id = v_sw;
  -- Held to the scroll: a QL 40 scroll into a QL 90 sword.
  v_x := give(w, u, 'sword', 1, 90, 'Iron');
  v_s := give(w, u, 'firebrand_scroll', 1, 40);
  perform pg_temp.dice('0.5');
  perform perform_enchant(w, u, ${T('v_x', 'v_s')});
  perform pg_temp.nodice();
  insert into said select 'TOOKSCROLL', (i.enchant->>'ql') || '|' || ${lastSaid} from item i where i.id = v_x;
  -- Neither: enchanting 30, a QL 90 scroll, a QL 90 axe.
  update skill set value = 30 where world_id = w and uid = u and id = 'enchanting';
  v_x := give(w, u, 'hatchet', 1, 90, 'Iron');
  v_s := give(w, u, 'concussion_scroll', 1, 90);
  perform pg_temp.dice('0.01');
  perform perform_enchant(w, u, ${T('v_x', 'v_s')});
  perform pg_temp.nodice();
  insert into said select 'TOOKFREE', (i.enchant->>'ql') || '|' || item_name(i) || '|' || ${lastSaid} from item i where i.id = v_x;

  -- 7. One that does not take, at enchanting 1 with a QL 1 scroll: damage; damage to pieces; and to pieces outright, from the hand.
  update skill set value = 1 where world_id = w and uid = u and id = 'enchanting';
  v_x := pg_temp.thing(w, u, 'short_sword', 1, 50, 10, 'Iron');
  v_s := give(w, u, 'razoredge_scroll', 1, 1);
  perform pg_temp.dice('0.99');
  perform perform_enchant(w, u, ${T('v_x', 'v_s')});
  insert into said select 'HARM', coalesce((select dmg::text || '|' || coalesce(enchant::text, '-') from item where id = v_x), 'gone')
    || '|' || ${count('razoredge_scroll')} || '|' || ${lastSaid};
  v_x := pg_temp.thing(w, u, 'short_sword', 1, 50, 80, 'Iron');
  v_s := give(w, u, 'razoredge_scroll', 1, 1);
  perform perform_enchant(w, u, ${T('v_x', 'v_s')});
  insert into said select 'HARMBROKE', coalesce((select dmg::text from item where id = v_x), 'gone') || '|' || ${lastSaid};
  v_x := give(w, u, 'long_sword', 1, 50, 'Iron');
  update player set equipped = jsonb_build_object('weapon', v_x) where world_id = w and uid = u;
  v_s := give(w, u, 'razoredge_scroll', 1, 1);
  perform pg_temp.dice('0.99,0.01');
  perform perform_enchant(w, u, ${T('v_x', 'v_s')});
  perform pg_temp.nodice();
  insert into said select 'BROKE', coalesce((select dmg::text from item where id = v_x), 'gone') || '|' || coalesce(p.equipped::text, '-') || '|' || ${lastSaid}
    from player p where p.world_id = w and p.uid = u;

  -- 8. The enchantment in the payloads that carry a thing: the post, and a counter.
  update item set holder = 'post' where id = v_sw;
  insert into said select 'POST', (select t->>'enchant' from jsonb_array_elements(rpc_parcels(w)->'things') t where (t->>'id')::bigint = v_sw);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'counter', null, 20, 20, 0, 0, 20.5, 20.5, 50, u)
    returning id into v_pl;
  update item set holder = 'counter', holder_uid = null, placed = v_pl where id = v_sw;
  insert into said select 'COUNTER', (select t->>'enchant' from jsonb_array_elements(counter_json(pl, u, 20.5, 20.5)->'goods') t)
    from placed pl where pl.id = v_pl;
  update item set holder = 'player', holder_uid = u, placed = null where id = v_sw;

  -- 9. Each enchantment on a hit at QL ${HIT_QL}: a roll just over its chance does nothing; just under, it does.
  for v_e in select * from enchantments() order by ord loop
    insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex)
      values (w, 9100 + v_e.ord, 'shaggan', 'Shaggan', 'wild', 30.5, 30.5, 30.5, 30.5, 90, 'female');
    update item set enchant = jsonb_build_object('id', v_e.id, 'ql', ${HIT_QL}) where id = v_sw;
    perform pg_temp.dice((enchant_hit_chance(v_e.id, ${HIT_QL}) + 0.001)::text);
    perform enchant_hit(w, u, 9100 + v_e.ord, (select i from item i where i.id = v_sw), 4);
    insert into said values ('OVER:' || v_e.id, ${effects('9100 + v_e.ord')});
    perform pg_temp.dice((enchant_hit_chance(v_e.id, ${HIT_QL}) - 0.001)::text);
    perform enchant_hit(w, u, 9100 + v_e.ord, (select i from item i where i.id = v_sw), 4);
    perform pg_temp.nodice();
    insert into said select 'UNDER:' || v_e.id, ${effects('9100 + v_e.ord')}
      || '/' || coalesce((select round(c.bleed_rate::numeric, 6)::text from creature c where c.world_id = w and c.id = 9100 + v_e.ord), '-')
      || '/' || ${lastSaid};
  end loop;

  -- 10. Through a swing: a Concussion sword at QL 100, every roll 0.01.
  update item set enchant = '{"id": "concussion", "ql": 100}'::jsonb where id = v_sw;
  update player set equipped = jsonb_build_object('weapon', v_sw) where world_id = w and uid = u;
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex)
    values (w, 9110, 'shaggan', 'Shaggan', 'wild', 11.2, 10.5, 11.2, 10.5, 90, 'male');
  perform pg_temp.dice('0.01');
  perform perform_fight(w, u, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', 9110));
  perform pg_temp.nodice();
  insert into said select 'SWING', ${effects(9110)} || '|' || (select e.text from event e where e.world_id = w and e.uid = u
    and e.text like 'Your Concussion%' order by e.n desc limit 1);
  insert into said select 'PANEL', coalesce((select (t->>'stunned')::double precision::text from jsonb_array_elements(rpc_creatures(w, 40)) t
    where (t->>'id')::int = 9110), 'none');

  -- 11. The stun itself: a shaggan after Mira, beside her. Due a go, it strikes; stunned, it neither strikes nor moves for its
  --     seconds; and once they are past, it strikes again.
  -- Away from the peace round the landing, where nothing hunts anybody, and every roll a half: nobody dodges.
  update player set equipped = '{}'::jsonb, x = 40.5, y = 40.5 where world_id = w and uid = u;
  delete from creature where world_id = w;
  perform pg_temp.dice('0.5');
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex, hunting, until, settled_at, leg_at, leg_ends)
    values (w, 9120, 'shaggan', 'Shaggan', 'wild', 41.2, 40.5, 41.2, 40.5, 90, 'male', u,
            now() - interval '1 second', now() - interval '1 second', now() - interval '1 second', now() - interval '1 second');
  perform creature_settle(w, 9120);
  insert into said select 'DUE', (1 - (p.stats->>'health')::double precision > 0)::text from player p where p.world_id = w and p.uid = u;
  update player set stats = stats || jsonb_build_object('health', 1), wounds = '[]'::jsonb where world_id = w and uid = u;
  update creature set until = now() - interval '1 second', settled_at = now() - interval '1 second', windup_at = null where world_id = w and id = 9120;
  perform enchant_stun(w, 9120);
  perform creature_settle(w, 9120);
  insert into said select 'STUNNED', ((p.stats->>'health')::double precision = 1)::text
    || '|' || (select (creature_x(c) = 41.2 and creature_y(c) = 40.5)::text from creature c where c.world_id = w and c.id = 9120)
    || '|' || (select round(extract(epoch from (c.until - now()))::numeric, 3) from creature c where c.world_id = w and c.id = 9120)
    from player p where p.world_id = w and p.uid = u;
  update class_mark set until = until - make_interval(secs => stun_secs() + 1) where world_id = w and creature_id = 9120;
  update creature set until = until - make_interval(secs => stun_secs() + 1), settled_at = settled_at - make_interval(secs => stun_secs() + 1),
         leg_at = leg_at - make_interval(secs => stun_secs() + 1), leg_ends = leg_ends - make_interval(secs => stun_secs() + 1)
   where world_id = w and id = 9120;
  perform creature_settle(w, 9120);
  insert into said select 'AFTER', (1 - (p.stats->>'health')::double precision > 0)::text from player p where p.world_id = w and p.uid = u;
  -- A second stun a second into the first: it runs from now again, not from where the first would have ended.
  perform enchant_stun(w, 9120);
  update class_mark set until = until - interval '1 second' where world_id = w and creature_id = 9120 and kind = 'stun';
  perform enchant_stun(w, 9120);
  perform pg_temp.nodice();
  insert into said select 'REFRESH', round(extract(epoch from (m.until - now()))::numeric, 3)::text from class_mark m
    where m.world_id = w and m.creature_id = 9120 and m.kind = 'stun';
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(118, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(10.5, 10.5, 0);
g.settings.fromStores = false;
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
const thing = (id: string, ql: number, dmg = 0, extra?: string, count = 1): Item => {
  const it = g.gather(id, { count, ql, ...(extra ? { extra } : {}) });
  it.dmg = dmg;
  return it;
};
g.skills.values.set('papyrusmaking', 90);
g.skills.values.set('carpentry', 90);
g.skills.values.set('enchanting', 100);

/* 1. The press. */
const reed = thing('reed', 40, 0, undefined, 8);
thing('water_bucket', 40, 0, undefined, 2);
const noPress = act('make_papyrus').check?.({ kind: 'item', uid: reed.uid }, g) ?? 'none';
check(`papyrus is refused without a paper press on both sides: ${noPress}`,
  isle.get('NOPRESS') === noPress && noPress === `You need to stand at a ${STATION_NAME.paper_press}.`, `island ${isle.get('NOPRESS')}`);
thing('mallet', 50);
const plank = thing('plank', 40, 0, 'Pine', 24);
thing('timber', 40, 0, 'Pine', 12);
thing('shaft', 40, 0, 'Pine', 4);
thing('nail', 40, 0, undefined, 36);
const buildAsk = act('make_paper_press').check?.({ kind: 'item', uid: plank.uid }, g) ?? 'none';
dice(0.01);
act('make_paper_press').perform({ kind: 'item', uid: plank.uid }, g);
const press = RECIPE_BY_ID.get('make_paper_press');
check(`a paper press is built with carpentry from ${press?.inputs.map((i) => `${i.count} ${i.item}`).join(', ')}, the same on both sides`,
  isle.get('BUILDASK') === 'none' && buildAsk === 'none' && part('BUILT', 0) === '1' && held('paper_press') === 1
    && part('BUILT', 1) === '0' && held('plank') === 0 && press?.skill === 'carpentry' && press?.tool === 'mallet',
  `${isle.get('BUILDASK')} ${isle.get('BUILT')} / ${buildAsk} ${held('paper_press')}`);
g.addFurniture('paper_press', 10, 10, 0, 0, 50);
const atPress = act('make_papyrus').check?.({ kind: 'item', uid: reed.uid }, g) ?? 'none';
dice(0.01);
act('make_papyrus').perform({ kind: 'item', uid: reed.uid }, g);
check('set down, papyrus is pressed standing at it, on both sides',
  isle.get('ATPRESS') === 'none' && atPress === 'none' && part('PRESSED', 0) === String(held('papyrus')) && held('papyrus') > 0
    && part('PRESSED', 1) === String(held('reed')), `${isle.get('PRESSED')} / ${held('papyrus')}|${held('reed')}`);

/* 2. Scrolls. */
const clear = (...ids: string[]): void => { g.inventory.items = g.inventory.items.filter((it) => !ids.includes(it.id)); };
clear('papyrus');
let pap = thing('papyrus', 20, 0, undefined, 3);
thing('fire_mote', 50, 0, undefined, 10);
const writeFire = act(`make_${FIRE.scroll}`);
dice(0.01);
writeFire.perform({ kind: 'item', uid: pap.uid }, g);
const s20 = g.inventory.items.find((it) => it.id === FIRE.scroll);
check('a Firebrand scroll written at enchanting 100 on a QL 20 sheet comes out at the sheet\'s QL, on both sides, and takes a sheet and two fire motes',
  Number(part('SCROLL20', 0)) === 20 && s20?.ql === 20 && part('SCROLL20', 1) === '2' && held('papyrus') === 2
    && part('SCROLL20', 2) === String(10 - SCROLL_MOTES) && held('fire_mote') === 10 - SCROLL_MOTES && lastHere().startsWith(part('SCROLL20', 3).split(' (')[0]),
  `${isle.get('SCROLL20')} / ${s20?.ql} ${held('papyrus')} ${held('fire_mote')} ${lastHere()}`);
clear('papyrus', FIRE.scroll);
g.skills.values.set('enchanting', 30);
pap = thing('papyrus', 90, 0, undefined, 3);
dice(0.01);
writeFire.perform({ kind: 'item', uid: pap.uid }, g);
const s30 = g.inventory.items.find((it) => it.id === FIRE.scroll);
check(`at enchanting 30 on a QL 90 sheet it comes out at the roll, as any craft's, the same on both sides (${s30?.ql.toFixed(2)})`,
  !!s30 && near(Number(part('SCROLL30', 0)), s30.ql, 1e-4) && s30.ql < 90, `${isle.get('SCROLL30')} / ${s30?.ql}`);

clear('papyrus', FIRE.scroll, 'fire_mote');
pap = thing('papyrus', 50, 0, undefined, 4);
thing('fire_mote', 50, 0, undefined, 10);
dice(0.99);
writeFire.perform({ kind: 'item', uid: pap.uid }, g);
const failHere = lastHere();
check(`a scroll that fails loses its ${SCROLL_MOTES} motes and puts ${SCROLL_HARM} damage on a sheet as one of its pile of four, and says so, the same on both sides`,
  part('FAIL', 0) === '0' && held(FIRE.scroll) === 0 && part('FAIL', 1) === String(10 - SCROLL_MOTES) && held('fire_mote') === 10 - SCROLL_MOTES
    && part('FAIL', 2) === '4' && held('papyrus') === 4 && near(Number(part('FAIL', 3)), SCROLL_HARM / 4) && near(pap.dmg, SCROLL_HARM / 4)
    && part('FAIL', 4) === failHere && failHere === `${RECIPE_BY_ID.get(`make_${FIRE.scroll}`)?.fail} ${scrollHarmSaid('harmed')}`,
  `${isle.get('FAIL')} / ${held('fire_mote')} ${held('papyrus')} ${pap.dmg} ${failHere}`);
clear('papyrus');
pap = thing('papyrus', 50, 80, undefined, 1);
dice(0.99);
writeFire.perform({ kind: 'item', uid: pap.uid }, g);
check('and a sheet the damage would take to pieces is used up, and that is said, on both sides',
  part('USEDUP', 0) === '0' && held('papyrus') === 0 && part('USEDUP', 1) === String(10 - 2 * SCROLL_MOTES) && held('fire_mote') === 10 - 2 * SCROLL_MOTES
    && part('USEDUP', 2) === lastHere() && lastHere().endsWith(scrollHarmSaid('used')), `${isle.get('USEDUP')} / ${lastHere()}`);

g.skills.values.set('enchanting', 100);
clear('papyrus', 'fire_mote');
pap = thing('papyrus', 60, 0, undefined, 2);
thing(RAZOR.mote, 50, 0, undefined, SCROLL_MOTES);
thing(CONC.mote, 50, 0, undefined, SCROLL_MOTES);
const noMote = writeFire.check?.({ kind: 'item', uid: pap.uid }, g) ?? 'none';
dice(0.01);
act(`make_${RAZOR.scroll}`).perform({ kind: 'item', uid: pap.uid }, g);
act(`make_${CONC.scroll}`).perform({ kind: 'item', uid: pap.uid }, g);
// The island's craft refusal names the input short and the browser's adds the whole bill after it, as for every recipe.
const short = `Firebrand scroll takes ${SCROLL_MOTES} fire motes`;
check('a Razoredge scroll is written from ice motes and a Concussion scroll from earth motes, and neither from fire motes, on both sides',
  isle.get('OTHERS') === `1|1|0|0|0` && held(RAZOR.scroll) === 1 && held(CONC.scroll) === 1 && held(RAZOR.mote) === 0 && held(CONC.mote) === 0
    && (isle.get('NOMOTE') ?? '').startsWith(short) && noMote.startsWith(short), `${isle.get('OTHERS')} ${isle.get('NOMOTE')} / ${noMote}`);

/* 5. Refusals. */
const enchant = act('enchant');
const sword = thing('sword', 34, 0, 'Iron');
let scroll = thing(FIRE.scroll, 90);
const ask = (uid: number, scrollUid: number): string => enchant.check?.({ kind: 'item', uid, scroll: scrollUid } as Target, g) ?? 'none';
const here: Record<string, string> = {
  scroll: ask(sword.uid, sword.uid),
  weapon: ask(987654, scroll.uid),
  bow: ask(thing('short_bow', 50, 0, 'Willow').uid, scroll.uid),
  javelin: ask(thing('javelin', 50, 0, 'Iron').uid, scroll.uid),
  broken: ask(thing('hatchet', 50, 100, 'Iron').uid, scroll.uid),
};
const maul = thing('maul', 50, 0, 'Iron');
maul.enchant = { id: 'razoredge', ql: 41.3 };
here.held = ask(maul.uid, scroll.uid);
here.none = ask(sword.uid, scroll.uid);
for (const [k, want] of [['scroll', ENCHANT_SAID.scroll], ['weapon', ENCHANT_SAID.weapon], ['bow', ENCHANT_SAID.notMelee], ['javelin', ENCHANT_SAID.notMelee],
  ['broken', ENCHANT_SAID.broken], ['held', alreadyEnchanted({ id: 'razoredge', ql: 41.3 })], ['none', 'none']] as Array<[string, string]>) {
  check(`Enchant is refused in the same words on both sides: ${want}`, isle.get(`R:${k}`) === want && here[k] === want, `island ${isle.get(`R:${k}`)}, browser ${here[k]}`);
}

/* 6. One that takes. */
const nameBefore = itemName({ ...sword, count: 1 }).toLowerCase();
dice(0.01);
enchant.perform({ kind: 'item', uid: sword.uid, scroll: scroll.uid } as Target, g);
const tookIsle = JSON.parse(part('TOOK', 0) || '{}') as { id?: string; ql?: number };
check(`enchanting 100 with a QL 90 scroll into a QL 34 sword comes out at the sword's QL, held to it, on both sides: ${lastHere()}`,
  tookIsle.id === FIRE.id && tookIsle.ql === 34 && sword.enchant?.id === FIRE.id && sword.enchant?.ql === 34 && part('TOOK', 2) === '0' && held(FIRE.scroll) === 0
    && part('TOOK', 3) === lastHere() && lastHere() === enchantedSaid(FIRE, nameBefore, 'sword', 34, 'item', 90, 34) && lastHere().includes('held to the sword\'s QL 34.0'),
  `${isle.get('TOOK')} / ${JSON.stringify(sword.enchant)} ${lastHere()}`);
check(`the name carries it on both sides: ${itemName(sword)}`, part('TOOK', 1) === itemName(sword) && itemName(sword) === 'Sword (iron) (Firebrand)', part('TOOK', 1));
const examined: string[] = [];
const was = g.logMsg;
g.logMsg = (m: string) => { examined.push(m); };
act('examine_item').perform({ kind: 'item', uid: sword.uid }, g);
g.logMsg = was;
check('Examine says it at its quality, the same line on both sides',
  isle.get('LOOK') === examined[0] && (examined[0] ?? '').includes(enchantSays(sword)) && enchantSays(sword).includes(`Firebrand at QL ${qlWord(34)}`),
  `${isle.get('LOOK')} / ${examined[0]}`);
const rowBack = packed(JSON.parse(isle.get('ROW') ?? '{}') as ItemRow, { since: () => 0 });
check('the island\'s row comes into the browser with its enchantment whole', rowBack.enchant?.id === FIRE.id && rowBack.enchant?.ql === 34 && itemName(rowBack) === itemName(sword),
  JSON.stringify(rowBack.enchant));
check('and it goes out in the post and on a counter with it', JSON.parse(isle.get('POST') ?? 'null')?.id === FIRE.id && JSON.parse(isle.get('COUNTER') ?? 'null')?.ql === 34,
  `${isle.get('POST')} / ${isle.get('COUNTER')}`);
{
  const land = await packLand(g);
  const back = await unpack(land, JSON.parse(JSON.stringify(packWorld(g))));
  const again = back?.inventory.items.find((it) => it.uid === sword.uid);
  check('and through a save and a load in the browser', again?.enchant?.id === FIRE.id && again?.enchant?.ql === 34 && !!again && itemName(again) === itemName(sword),
    JSON.stringify(again?.enchant));
}
const big = thing('sword', 90, 0, 'Iron');
scroll = thing(FIRE.scroll, 40);
dice(0.5);
enchant.perform({ kind: 'item', uid: big.uid, scroll: scroll.uid } as Target, g);
check(`a QL 40 scroll into a QL 90 sword is held to the scroll's QL, on both sides: ${lastHere()}`,
  part('TOOKSCROLL', 0) === '40' && big.enchant?.ql === 40 && part('TOOKSCROLL', 1) === lastHere() && lastHere().includes('held to the scroll\'s QL 40.0'),
  `${isle.get('TOOKSCROLL')} / ${lastHere()}`);
g.skills.values.set('enchanting', 30);
const axe = thing('hatchet', 90, 0, 'Iron');
scroll = thing(CONC.scroll, 90);
dice(0.01);
enchant.perform({ kind: 'item', uid: axe.uid, scroll: scroll.uid } as Target, g);
const freeQl = enchantQl(30, 90, 90, (b) => craftSpread(b, 0.01)).ql;
check(`at enchanting 30 with a QL 90 scroll into a QL 90 hatchet it comes out at the roll, held by neither (${qlWord(freeQl)}), on both sides`,
  near(Number(part('TOOKFREE', 0)), freeQl, 1e-6) && near(axe.enchant?.ql ?? 0, freeQl) && part('TOOKFREE', 1) === itemName(axe)
    && itemName(axe).endsWith('(Concussion)') && part('TOOKFREE', 2) === lastHere() && !lastHere().includes('held to'),
  `${isle.get('TOOKFREE')} / ${axe.enchant?.ql} ${lastHere()}`);

/* 7. One that does not take. */
g.skills.values.set('enchanting', 1);
const ss = thing('short_sword', 50, 10, 'Iron');
const ssName = itemName({ ...ss, count: 1 }).toLowerCase();
scroll = thing(RAZOR.scroll, 1);
dice(0.99);
enchant.perform({ kind: 'item', uid: ss.uid, scroll: scroll.uid } as Target, g);
check(`one that does not take puts ${ENCHANT_HARM} damage on the weapon and uses the scroll, and says so, on both sides`,
  part('HARM', 0) === String(10 + ENCHANT_HARM) && ss.dmg === 10 + ENCHANT_HARM && part('HARM', 1) === '-' && !ss.enchant && part('HARM', 2) === String(held(RAZOR.scroll))
    && part('HARM', 3) === lastHere() && lastHere() === notTakenSaid(RAZOR, ssName, 'harm', 10 + ENCHANT_HARM), `${isle.get('HARM')} / ${lastHere()}`);
const ss2 = thing('short_sword', 50, 80, 'Iron');
scroll = thing(RAZOR.scroll, 1);
enchant.perform({ kind: 'item', uid: ss2.uid, scroll: scroll.uid } as Target, g);
check('and one the damage takes to pieces is gone, and that is said, on both sides',
  part('HARMBROKE', 0) === 'gone' && !g.inventory.get(ss2.uid) && part('HARMBROKE', 1) === lastHere() && lastHere() === notTakenSaid(RAZOR, ssName, 'harmBroke', 100),
  `${isle.get('HARMBROKE')} / ${lastHere()}`);
const ls = thing('long_sword', 50, 0, 'Iron');
g.player.equipped.weapon = ls.uid;
const lsName = itemName({ ...ls, count: 1 }).toLowerCase();
scroll = thing(RAZOR.scroll, 1);
dice(0.99, 0.01);
enchant.perform({ kind: 'item', uid: ls.uid, scroll: scroll.uid } as Target, g);
check(`and ${ENCHANT_BREAK * 100}% of the time it goes to pieces outright, out of the hand it was in, on both sides`,
  part('BROKE', 0) === 'gone' && !g.inventory.get(ls.uid) && part('BROKE', 1) === '{}' && !g.player.equipped.weapon
    && part('BROKE', 2) === lastHere() && lastHere() === notTakenSaid(RAZOR, lsName, 'broke', 100), `${isle.get('BROKE')} / ${lastHere()}`);

/* 9. A hit, with each. */
const spawn = (x: number, y: number) => {
  const c = g.creatures.spawn('shaggan', x, y, 'wild', () => 0.5, 0);
  c.health = 90;
  return c;
};
for (const e of ENCHANTMENT_LIST) {
  const c = spawn(30.5, 30.5);
  const blade = thing('sword', 50, 0, 'Iron');
  blade.enchant = { id: e.id, ql: HIT_QL };
  // Through the one door a swing asks (`enchantRoll`); what each then does is the swing's, below.
  const fire = (r: number): EnchantmentDef | null => { dice(r); return enchantRoll(g, blade, c); };
  const over = fire(enchantHitChance(e, HIT_QL) + 0.001);
  const under = fire(enchantHitChance(e, HIT_QL) - 0.001);
  const [mark, bleeding] = (isle.get(`OVER:${e.id}`) ?? '').split('/');
  const u = (isle.get(`UNDER:${e.id}`) ?? '').split('/');
  const wantMark = e.effect === 'burn' ? 'burn' : e.effect === 'stun' ? 'hold,stun' : '-';
  check(`${e.name} at QL ${HIT_QL} (${(enchantHitChance(e, HIT_QL) * 100).toFixed(1)}%): a roll just over does nothing and just under ${EFFECT_HEAD[e.effect]}, on both sides`,
    mark === '-' && bleeding !== 'true' && over === null && under?.id === e.id
      && u[0] === wantMark && (e.effect === 'burn' || e.effect === 'bleed' ? u[1] === 'true' : true)
      && (e.effect === 'bleed' ? near(Number(u[2]), 4 * KNIFE_BLEED) : true)
      && u[3] === enchantHitSaid(e, 'shaggan'),
    `${isle.get(`OVER:${e.id}`)} / ${isle.get(`UNDER:${e.id}`)}`);
}

/* 10. Through a swing. */
{
  const blade = thing('sword', 50, 0, 'Iron');
  blade.enchant = { id: 'concussion', ql: 100 };
  g.player.equipped.weapon = blade.uid;
  const c = spawn(11.2, 10.5);
  dice(0.01);
  said.length = 0;
  act('attack_creature').perform({ kind: 'creature', id: c.id }, g);
  const swung = said.filter((m) => m.startsWith('Your Concussion'));
  check(`a landed swing with a Concussion sword at QL 100 stuns it, and the fight log says so, on both sides: ${swung[0]}`,
    part('SWING', 0).startsWith('hold,stun') && part('SWING', 1) === swung[0] && (c.stunUntil ?? 0) > g.time && swung[0] === enchantHitSaid(CONC, 'shaggan'),
    `${isle.get('SWING')} / ${swung.join(' # ')} ${c.stunUntil}`);
  check(`and the island tells the browser how long is left of it, for the target panel (${isle.get('PANEL')} s)`, near(Number(isle.get('PANEL')), STUN_SECS, 0.01), isle.get('PANEL'));
  // And a Firebrand's and a Razoredge's, the same way: the burn and the bleed are the ones the game already has.
  for (const e of [FIRE, RAZOR]) {
    blade.enchant = { id: e.id, ql: 100 };
    const d = spawn(11.2, 10.5);
    dice(0.01);
    said.length = 0;
    act('attack_creature').perform({ kind: 'creature', id: d.id }, g);
    const ran = e === FIRE ? (d.burnUntil ?? 0) > g.time && d.bleedUntil > g.time : d.bleedUntil > g.time && d.bleedRate > 0 && !(d.burnUntil ?? 0);
    check(`and a ${e.name} sword's, ${e === FIRE ? 'a burn' : 'a bleed of the blow'}, through the same swing, said the same way`,
      ran && said.includes(enchantHitSaid(e, 'shaggan')), `${d.burnUntil} ${d.bleedUntil} ${d.bleedRate} ${said.join(' # ')}`);
  }
  g.player.equipped.weapon = null;
}

/* 11. The stun itself. */
check(`on the island a creature after you strikes when it is due, stunned it neither strikes nor moves for ${STUN_SECS} seconds, and after them it strikes again`,
  isle.get('DUE') === 'true' && part('STUNNED', 0) === 'true' && part('STUNNED', 1) === 'true' && near(Number(part('STUNNED', 2)), STUN_SECS, 0.01)
    && isle.get('AFTER') === 'true', `${isle.get('DUE')} ${isle.get('STUNNED')} ${isle.get('AFTER')}`);
check(`and a second stun a second into the first runs ${STUN_SECS} seconds from then, not on from the first`, near(Number(isle.get('REFRESH')), STUN_SECS, 0.01), isle.get('REFRESH'));
{
  for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
  // Away from the peace round the landing, as on the island.
  g.putBody(40.5, 40.5, 0);
  g.player.stats.health = 1;
  const c = spawn(41.2, 40.5);
  g.rand = () => 0.5;
  g.creatures.engage(g, c);
  stun(g, c);
  const at: [number, number] = [c.x, c.y];
  const until = c.stunUntil ?? 0;
  const step = 0.1;
  let moved = false;
  let struck = false;
  for (let t = 0; t < STUN_SECS - step; t += step) {
    g.time += step;
    g.creatures.update(step, g);
    if (c.x !== at[0] || c.y !== at[1]) moved = true;
    if (g.player.stats.health < 1) struck = true;
  }
  check(`in the browser a stunned creature after you neither moves nor strikes for its ${STUN_SECS} seconds`, !moved && !struck && until > g.time,
    `moved ${moved}, struck ${struck}`);
  // A second stun a second in: from then, not on from the first.
  const t0 = g.time;
  stun(g, c);
  check('and a second stun runs from then, not on from the first', near(c.stunUntil ?? 0, t0 + STUN_SECS), `${c.stunUntil} vs ${t0 + STUN_SECS}`);
  let acted = false;
  for (let t = 0; t < STUN_SECS + 6; t += step) {
    g.time += step;
    g.creatures.update(step, g);
    if (g.time > (c.stunUntil ?? 0) && (c.x !== at[0] || c.y !== at[1] || g.player.stats.health < 1)) acted = true;
  }
  check('and once it is over, it moves or strikes again', acted, `${c.x},${c.y} health ${g.player.stats.health}`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`enchanting — ${ok.length} of ${ok.length}`);

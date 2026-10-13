/**
 * A bucket keeps its brew's QL, and mead ages (`ageing.ts`), on both sides.
 *
 * Each brew that ages, its rate and cap, the same on both sides; a bucket
 * drawn off a barrel of grape wine kept thirteen days is at the barrel's aged
 * QL, off the top of a pile of empty buckets that stay as they were; one
 * drawn off a barrel of ale that does not age is at the ale's QL, and one off
 * a barrel of water keeps the bucket's own; the aged bucket poured back into
 * an empty barrel puts the barrel at its QL and the barrel does not age, and
 * a bucket poured into a barrel of the same wine puts it at the average by
 * litres; mead set going stamps its ageing, and the QL a barrel of it is at
 * after so many days in a cellar and out, to the last bit, capped at its own
 * cap and at 100, said on Examine.
 *
 * Every roll is set and every moment held. Runs against any database the
 * migrations have built; the island half is rolled back. The island keeps a
 * QL as a `real`, so a QL the island has written down is held against the
 * browser's at the same precision (`Math.fround`).
 *
 *   npx esbuild supabase/test/aged.ts --bundle --platform=node --format=esm \
 *     --external:typescript --outfile=node_modules/.cache/aged.mjs && node node_modules/.cache/aged.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { ageGain, ageingRule, brewQl, CELLAR_AGEING, MEAD_AGE_CAP, MEAD_AGE_RATE } from '../../src/game/ageing';
import { BREW_BY_ID, BREWS, MEAD_AGEING } from '../../src/game/brewing';
import type { PlacedFurniture } from '../../src/game/furniture';
import { ITEM_DEFS, type Item } from '../../src/game/items';
import { DAY_SECONDS } from '../../src/game/pace';
import { vesselSays } from '../../src/game/placeables';
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
/** A QL as the island writes it down: a `real`, read back as a double. */
const real = (x: number): string => String(Math.fround(x));

const DAY = DAY_SECONDS;
/** Grape wine at this QL, kept this many days out of a cellar, drawn off. */
const BASE = 40.5;
const KEPT = 13.3;
/** Ale at this QL, which does not age. */
const ALE = 33.25;
/** A barrel of water at this QL, and an empty bucket at this one. */
const WATER = 55;
const PAIL = 20;
/** A bucket of grape wine poured into a barrel of it. */
const POURED = 47.25;
const TOP = 95.25;

/* ---- the definitions, on both sides ---------------------------------------------------------------- */

const ageing = BREWS.filter((b) => b.ages);
const ratesHere = BREWS.map((b) => `${b.id}:${b.ages ? `${b.ages.rate}/${b.ages.cap}` : '-'}`).join(',');
const ratesIsle = psql(`select string_agg(id || ':' || case when brew_ages(id) then age_rate(id)::text || '/' || age_cap(id)::text else '-' end, ','
  order by array_position(array[${BREWS.map((b) => `'${b.id}'`).join(', ')}]::text[], id)) from brew_def`);
check(`each brew ages at the same rate and cap on both sides: ${ratesHere}`, ratesIsle === ratesHere, ratesIsle);
check(`mead ages, at ${MEAD_AGE_RATE} QL a day up to ${MEAD_AGE_CAP}, and so do cherry and grape wine`,
  BREW_BY_ID.get('mead')?.ages === MEAD_AGEING && ['mead', 'wine', 'grape_wine'].every((id) => ageing.some((b) => b.id === id))
    && psql(`select brew_ages('mead') and brew_ages('wine') and brew_ages('grape_wine') and not brew_ages('ale') and not brew_ages('cider')`) === 't');
const meadIsle = psql(`select description from item_def where id = 'mead_bucket'`);
check(`the bucket of mead says how it ages, off its own rule, the same on both sides: “${ITEM_DEFS.mead_bucket.description}”`,
  meadIsle === ITEM_DEFS.mead_bucket.description && meadIsle.includes(ageingRule(MEAD_AGEING)) && !meadIsle.includes('{'), meadIsle);

const AGES = [0, 0.5, 1, 7.3, 14.99, 15, 16, 59.99, 60, 61, 1000].map((d) => d * DAY);
const gainIsle = psql(`select string_agg(age_gain('mead', a, false)::text || '/' || age_gain('mead', a, true)::text, ',' order by o)
  from unnest(array[${AGES.join(', ')}]::double precision[]) with ordinality u(a, o)`);
const gainHere = AGES.map((a) => `${ageGain('mead', a, false)}/${ageGain('mead', a, true)}`).join(',');
check(`a mead gains the same QL to the last bit on both sides, so many days in a cellar and out: ${gainHere}`, gainIsle === gainHere, gainIsle);
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
check(`${MEAD_AGE_RATE} a day out of a cellar and ${MEAD_AGE_RATE * CELLAR_AGEING} in one, up to ${MEAD_AGE_CAP}: reached in ${MEAD_AGE_CAP / MEAD_AGE_RATE} days out and ${MEAD_AGE_CAP / (MEAD_AGE_RATE * CELLAR_AGEING)} in`,
  near(ageGain('mead', 10 * DAY, false), 10 * MEAD_AGE_RATE) && near(ageGain('mead', 2 * DAY, true), 2 * MEAD_AGE_RATE * CELLAR_AGEING)
    && ageGain('mead', 1000 * DAY, false) === MEAD_AGE_CAP && ageGain('mead', 1000 * DAY, true) === MEAD_AGE_CAP
    && ageGain('mead', (MEAD_AGE_CAP / MEAD_AGE_RATE + 1) * DAY, false) === MEAD_AGE_CAP && ageGain('mead', (MEAD_AGE_CAP / (MEAD_AGE_RATE * CELLAR_AGEING) + 1) * DAY, true) === MEAD_AGE_CAP
    && ageGain('ale', 1000 * DAY, true) === 0 && psql(`select age_gain('ale', ${1000 * DAY}, true)`) === '0');

/* ---- on the island ---------------------------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-0000000000b2';
const lastSaid = `(select e.text from event e where e.world_id = w and e.uid = u and e.kind = 'event' order by e.n desc limit 1)`;
const item = (action: string, id: string): string => `perform act_perform(w, u, '${action}', jsonb_build_object('kind', 'item', 'uid', ${id}));`;
const qls = (defs: string[]): string => `coalesce((select string_agg(def || ':' || count || ':' || ql::double precision::text, ',' order by def, ql)
  from item where world_id = w and holder_uid = u and holder = 'player' and def in (${defs.map((d) => `'${d}'`).join(', ')})), '-')`;
const barrel = (k: string): string => `insert into said select '${k}', coalesce(pl.liquid, '-') || '|' || pl.litres || '|' || pl.ql::double precision::text || '|'
  || coalesce(pl.aged_from::text, '-') from placed pl where pl.id = v_bar;`;

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
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; v_bar bigint; v_b bigint; v_w bigint; v_now double precision; p placed;
        v_ages double precision[] := array[${AGES.join(', ')}]::double precision[]; v_i int; v_c int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Aged', 178, 64, 10, 10, true) returning id into w;
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

  -- 1. Grape wine kept ${KEPT} days, drawn off the top of a pile of two empty buckets.
  update placed set liquid = 'grape_wine', litres = 30, ql = ${BASE}, ferment = 0, level = 0 where id = v_bar;
  update placed set aged_from = v_now - ${KEPT} * day_seconds() where id = v_bar;
  v_b := give(w, u, 'bucket', 2, ${PAIL});
  ${item('fill_bucket', 'v_b')}
  insert into said values ('D:aged', ${qls(['bucket', 'grape_wine_bucket'])} || '#' || ${lastSaid});
  ${barrel('D:barrel')}
  select id into v_w from item where world_id = w and holder_uid = u and def = 'grape_wine_bucket';

  -- 2. Ale, which does not age, drawn into an empty bucket.
  update placed set liquid = 'ale', litres = 30, ql = ${ALE} where id = v_bar;
  v_b := give(w, u, 'bucket', 1, ${PAIL});
  ${item('fill_bucket', 'v_b')}
  insert into said values ('D:ale', ${qls(['ale_bucket'])} || '#' || ${lastSaid});
  ${barrel('D:alebarrel')}

  -- 3. Water, which is no brew: the bucket keeps its own.
  update placed set liquid = 'water', litres = 30, ql = ${WATER} where id = v_bar;
  v_b := give(w, u, 'bucket', 1, ${PAIL});
  ${item('fill_bucket', 'v_b')}
  insert into said values ('D:water', ${qls(['water_bucket'])});

  -- 4. The aged bucket poured into the barrel emptied: it is at the bucket's QL and does not age.
  update placed set litres = 0, liquid = null, ql = ${WATER} where id = v_bar;
  ${item('pour_into_barrel', 'v_w')}
  ${barrel('P:empty')}
  insert into said select 'P:later', brew_ql(pl, v_now + 50 * day_seconds())::text || '|' || wine_age_says(pl, v_now + 50 * day_seconds()) || '|'
    || (select def from item where id = v_w) from placed pl where pl.id = v_bar;

  -- 5. A bucket of grape wine poured into a barrel of it kept ${KEPT} days.
  update placed set liquid = 'grape_wine', litres = 30, ql = ${BASE} where id = v_bar;
  update placed set aged_from = v_now - ${KEPT} * day_seconds() where id = v_bar;
  insert into said select 'P:before', brew_ql(pl, v_now)::text from placed pl where pl.id = v_bar;
  v_b := give(w, u, 'grape_wine_bucket', 1, ${POURED});
  ${item('pour_into_barrel', 'v_b')}
  ${barrel('P:same')}

  -- 6. Mead set going: its ageing stamped as it goes.
  update placed set liquid = 'water', litres = 80, ql = 40, knack = null where id = v_bar;
  perform give(w, u, 'honey', ${BREW_BY_ID.get('mead')?.count}, 60);
  perform pg_temp.dice('0.01');
  perform act_perform(w, u, 'start_brew', jsonb_build_object('kind', 'furniture', 'id', v_bar, 'brew', 'mead'));
  perform pg_temp.nodice();
  insert into said select 'M:set', pl.liquid || '|' || pl.litres || '|' || pl.ql::double precision::text || '|' || pl.ferment || '|'
      || (pl.aged_from = v_now + pl.ferment)::text from placed pl where pl.id = v_bar;

  -- 7. Mead kept so many days, out of a cellar and in one, at two QLs: the QL, and what Examine says.
  for v_c in 0..1 loop
    for v_i in 1..array_length(v_ages, 1) loop
      update placed set ql = ${BASE}, level = case when v_c = 1 then -1 else 0 end, litres = 15, ferment = 0,
          aged_from = v_now - v_ages[v_i] where id = v_bar;
      select * into p from placed where id = v_bar;
      insert into said values ('A:' || v_c || ':' || v_i, brew_ql(p, v_now)::text || '|' || vessel_says(p));
      update placed set ql = ${TOP} where id = v_bar;
      select * into p from placed where id = v_bar;
      insert into said values ('A:top:' || v_c || ':' || v_i, brew_ql(p, v_now)::text);
    end loop;
  end loop;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

/* ---- in the browser, the same ----------------------------------------------------------------------- */

const NOW = Number(isle.get('NOW'));
const g = Game.create(178, 256);
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
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number, n = 1): Item => g.gather(id, { count: n, ql });
const use = (action: string, it: Item): void => { act(action).perform({ kind: 'item', uid: it.uid } as Target, g); };
const qlsHere = (defs: string[]): string => g.inventory.items.filter((it) => defs.includes(it.id))
  .sort((a, b) => (a.id === b.id ? Math.fround(a.ql) - Math.fround(b.ql) : a.id < b.id ? -1 : 1))
  .map((it) => `${it.id}:${it.count}:${real(it.ql)}`).join(',') || '-';
const barrelItem = thing('barrel', 40);
act('place_furniture').perform({ kind: 'tile', x: 10, y: 9, sx: 1, sy: 1, itemUid: barrelItem.uid, facing: 's' } as Target, g);
const bar = [...g.furniture.values()].find((p) => p.kind === 'barrel') as PlacedFurniture;
const barrelHere = (): string => `${bar.liquid ?? '-'}|${bar.litres ?? 0}|${real(bar.ql)}|${bar.agedFrom ?? '-'}`;
const same = (k: string, here: string, what: string): void => {
  check(`${what}: “${here}”, the same on both sides`, isle.get(k) === here, `${isle.get(k)} / ${here}`);
};

/* 1. Aged grape wine drawn off. */
const aged = { ...bar, items: [], liquid: 'grape_wine', litres: 30, ql: BASE, ferment: 0, agedFrom: NOW - KEPT * DAY } as PlacedFurniture;
const agedQl = brewQl(aged, NOW);
Object.assign(bar, { liquid: 'grape_wine', litres: 30, ql: BASE, ferment: 0, agedFrom: NOW - KEPT * DAY });
const pile = thing('bucket', PAIL, 2);
use('fill_bucket', pile);
same('D:aged', `${qlsHere(['bucket', 'grape_wine_bucket'])}#${lastHere()}`,
  `a bucket drawn off grape wine kept ${KEPT} days at QL ${BASE} is at its aged QL ${agedQl.toFixed(4)}, the other bucket of the pile left at ${PAIL}`);
check(`and that is the barrel's QL as it is drawn, not the bucket's ${PAIL} nor the brew's ${BASE}`,
  qlsHere(['grape_wine_bucket']) === `grape_wine_bucket:1:${real(agedQl)}` && agedQl > BASE && agedQl === BASE + ageGain('grape_wine', KEPT * DAY, false));
same('D:barrel', barrelHere(), 'and the barrel goes on ageing, a bucket lighter');
const wineBucket = g.inventory.items.find((it) => it.id === 'grape_wine_bucket') as Item;

/* 2. Ale. */
Object.assign(bar, { liquid: 'ale', litres: 30, ql: ALE });
delete bar.agedFrom;
use('fill_bucket', thing('bucket', PAIL));
same('D:ale', `${qlsHere(['ale_bucket'])}#${lastHere()}`, `a bucket drawn off ale, which does not age, is at the ale's QL ${ALE}`);
same('D:alebarrel', barrelHere(), 'and the barrel of ale has no age');

/* 3. Water. */
Object.assign(bar, { liquid: 'water', litres: 30, ql: WATER });
use('fill_bucket', thing('bucket', PAIL));
same('D:water', qlsHere(['water_bucket']), `a bucket drawn off water, which is no brew, keeps its own QL ${PAIL}`);

/* 4. The aged bucket poured into the barrel emptied. */
Object.assign(bar, { litres: 0, liquid: undefined, ql: WATER });
// The bucket as the island wrote it down.
wineBucket.ql = Math.fround(wineBucket.ql);
use('pour_into_barrel', wineBucket);
same('P:empty', barrelHere(), `aged wine poured into an empty barrel puts the barrel at its QL ${wineBucket.ql.toFixed(4)}, with no age`);
const later = brewQl(bar, NOW + 50 * DAY);
check(`and fifty days on it is still at that QL on both sides: it does not age where it was poured (${later.toFixed(4)})`,
  (isle.get('P:later') ?? '') === `${later}||${wineBucket.id}` && later === bar.ql, `${isle.get('P:later')} / ${later}||${wineBucket.id}`);

/* 5. A bucket poured into a barrel of the same. */
Object.assign(bar, { liquid: 'grape_wine', litres: 30, ql: BASE, agedFrom: NOW - KEPT * DAY });
const before = brewQl(bar, NOW);
check(`the barrel of grape wine is at QL ${before.toFixed(4)} before, on both sides`, isle.get('P:before') === String(before), isle.get('P:before'));
use('pour_into_barrel', thing('grape_wine_bucket', POURED));
const mixed = (30 * before + 5 * Math.fround(POURED)) / 35;
same('P:same', barrelHere(), `a bucket at QL ${POURED} poured into it puts it at the average by litres, ${mixed.toFixed(4)}, and it stops ageing`);
check('which is the rule', bar.ql === mixed && bar.agedFrom === undefined);

/* 6. Mead set going. */
Object.assign(bar, { liquid: 'water', litres: 80, ql: 40 });
delete bar.knack;
delete bar.agedFrom;
thing('honey', 60, BREW_BY_ID.get('mead')?.count ?? 0);
dice(0.01);
act('start_brew').perform({ kind: 'furniture', id: bar.id, brew: 'mead' } as Target, g);
const mead = BREW_BY_ID.get('mead');
check(`mead set going stamps its ageing at the moment it stops working, on both sides: ${bar.liquid}, QL ${bar.ql}`,
  isle.get('M:set') === `mead|${mead?.litres}|${real(bar.ql)}|${mead?.time}|true` && bar.liquid === 'mead' && bar.agedFrom === NOW + (mead?.time ?? 0),
  `${isle.get('M:set')} / ${bar.liquid} ${bar.ql} ${bar.agedFrom}`);

/* 7. Mead kept. */
let qlOk = true;
let saysOk = true;
let capOk = true;
const detail: string[] = [];
for (const c of [0, 1]) {
  AGES.forEach((age, i) => {
    const f: PlacedFurniture = { ...bar, items: [], ql: BASE, level: c ? -1 : undefined, litres: 15, ferment: 0, agedFrom: NOW - age, liquid: 'mead' };
    const ql = brewQl(f, NOW);
    const [qlIsle, saysIsle] = (isle.get(`A:${c}:${i + 1}`) ?? '').split('|');
    if (qlIsle !== String(ql)) { qlOk = false; detail.push(`${c}:${age / DAY}d ${qlIsle} vs ${ql}`); }
    if (saysIsle !== vesselSays(f, NOW)) { saysOk = false; detail.push(`${saysIsle} vs ${vesselSays(f, NOW)}`); }
    const top = brewQl({ ...f, ql: TOP }, NOW);
    if (isle.get(`A:top:${c}:${i + 1}`) !== String(top)) { qlOk = false; detail.push(`top ${c}:${age / DAY}d ${isle.get(`A:top:${c}:${i + 1}`)} vs ${top}`); }
    if (ql > BASE + MEAD_AGE_CAP || top > 100 || ql !== Math.min(100, BASE + Math.min(MEAD_AGE_CAP, MEAD_AGE_RATE * (c ? CELLAR_AGEING : 1) * (age / DAY)))) capOk = false;
  });
}
check(`a barrel of mead at QL ${BASE} is at the same QL to the last bit on both sides after ${AGES.map((a) => a / DAY).join(', ')} days, in a cellar and out`, qlOk, detail.slice(0, 4).join('; '));
const q = (days: number, cellar: boolean, base = BASE): number => brewQl({ ...bar, items: [], ql: base, level: cellar ? -1 : undefined, litres: 15, agedFrom: NOW - days * DAY, liquid: 'mead' }, NOW);
check(`ten days out of a cellar it is QL ${q(10, false)}, ten in one QL ${q(10, true)}; capped at ${BASE + MEAD_AGE_CAP} in and out, and at a QL of ${TOP} at 100`, capOk
  && near(q(10, false), BASE + 10 * MEAD_AGE_RATE) && near(q(10, true), BASE + 10 * MEAD_AGE_RATE * CELLAR_AGEING)
  && q(MEAD_AGE_CAP / (MEAD_AGE_RATE * CELLAR_AGEING) + 1, true) === BASE + MEAD_AGE_CAP && q(1000, false) === BASE + MEAD_AGE_CAP
  && q(1000, true, TOP) === 100);
const sayIn = vesselSays({ ...bar, items: [], ql: BASE, level: -1, litres: 15, agedFrom: NOW - 7.3 * DAY, liquid: 'mead' }, NOW);
check(`Examine says a mead's own rate and cap, the same on both sides: “${sayIn}”`, saysOk
  && sayIn.includes(`${(MEAD_AGE_RATE * CELLAR_AGEING).toFixed(2)} QL a day`) && sayIn.includes(`up to +${MEAD_AGE_CAP.toFixed(2)}`) && sayIn.includes('Kept 7.3 days in a cellar'),
  detail.slice(0, 2).join('; '));

/* ---- what was found ------------------------------------------------------------------------------- */

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\naged — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

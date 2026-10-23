/**
 * Maps (`cartography.ts`), on both sides.
 *
 * The map, its three jobs and its numbers the same on both sides; Draw a map on
 * a sheet of papyrus records the square round the tile you stand on, as far
 * each way as its QL reaches, at your papyrusmaking and never above the
 * sheet; Study map puts that square on the reader's map -- `charted` and a
 * `charted` line on the island, the fog in the browser -- for somebody who
 * never walked it; Copy map is capped by the original's QL and the sheet's,
 * and reaches no further than its own QL; every refusal in the same words;
 * and Examine says what a map holds.
 *
 * Every roll is set. Runs against the database the suite leaves behind; the
 * island half is rolled back.
 *
 *   npx esbuild supabase/test/maps.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/maps.mjs && node node_modules/.cache/maps.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import {
  CHART_ITEM, CHART_LEAST, CHART_QL_PER_TILE, CHART_SAID, CHART_SHEET, CHART_SKILL, chartedSquare, chartExtra, chartItemSays, chartOf, chartReach,
  copiedSaid, COPY_MAP, DRAW_MAP, drawnSaid, learnChart, STUDY_MAP, studiedSaid,
} from '../../src/game/cartography';
import { ITEM_DEFS, type Item } from '../../src/game/items';
import { QL_TOP } from '../../src/game/limits';
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

/* ---- the map, its jobs and its numbers, on both sides ----------------------------------------------- */

const item = ITEM_DEFS[CHART_ITEM];
const itemIsle = psql(`select d.name || '|' || d.weight || '|' || d.decay || '|' || d.stackable || '|' || d.description from item_def d where d.id = '${CHART_ITEM}'`);
check('the map is the same item on both sides', itemIsle === `${item?.name}|${item?.weight}|${item?.decay}|${!!item?.stackable}|${item?.description}`, itemIsle);
check(`its description says how far it reaches off the rule: ${CHART_LEAST} each way and one more every ${CHART_QL_PER_TILE} QL, ${chartReach(QL_TOP)} at QL ${QL_TOP}`,
  !!item?.description?.includes(`${CHART_LEAST} tiles each way and one tile further for every ${CHART_QL_PER_TILE} QL, so ${chartReach(QL_TOP)} each way at QL ${QL_TOP}`)
    && !item?.description?.includes('{'), item?.description);
const JOBS = [COPY_MAP, DRAW_MAP, STUDY_MAP];
const jobsIsle = psql(`select string_agg(id || ':' || label || ':' || coalesce(skill, '-') || ':' || base_time || ':' || stamina, '|' order by id)
  from action_def where id in (${JOBS.map((j) => `'${j}'`).join(', ')})`);
const jobsHere = JOBS.map((id) => {
  const a = ACTION_BY_ID.get(id) as ActionDef;
  return `${a.id}:${a.label}:${a.skill ?? '-'}:${a.baseTime}:${a.stamina}`;
}).join('|');
check(`its three jobs are the same rows on both sides: ${jobsHere}`, jobsIsle === jobsHere && jobsHere.includes(`${DRAW_MAP}:Draw a map:${CHART_SKILL}`), jobsIsle);
const QLS = [0, 1, 4.99, 5, 30, 33, 50, 99.9, QL_TOP];
const reachIsle = psql(`select string_agg(chart_reach(q)::text, ',' order by o) from unnest(array[${QLS.join(', ')}]::double precision[]) with ordinality u(q, o)`);
check(`how far a map reaches by its QL is the same on both sides: ${QLS.map(chartReach).join(',')}`, reachIsle === QLS.map(chartReach).join(','), reachIsle);
const SQ = [{ x: 512, y: 300, r: 14 }, { x: 0, y: 7, r: 4 }];
const wordsIsle = psql(`select concat_ws('#', ${SQ.map((c) => `chart_extra(${c.x}, ${c.y}, ${c.r}), chart_item_says('${CHART_ITEM}', chart_extra(${c.x}, ${c.y}, ${c.r})),
  chart_done_said('draw_map', ${c.x}, ${c.y}, ${c.r}, 41.25), chart_done_said('study_map', ${c.x}, ${c.y}, ${c.r}, 41.25), chart_done_said('copy_map', ${c.x}, ${c.y}, ${c.r}, 7)`).join(', ')},
  chart_item_says('${CHART_ITEM}', 'nonsense'), chart_item_says('papyrus', chart_extra(1, 2, 3)), coalesce(chart_of('${CHART_ITEM}', '14 tiles round 512, 300')::text, '-'),
  chart_said('noSheet'), chart_said('notMap'), chart_said('blank'), chart_said('noCopySheet'))`);
const wordsHere = [...SQ.flatMap((c) => [chartExtra(c), chartItemSays({ id: CHART_ITEM, extra: chartExtra(c) }), drawnSaid(c, 41.25), studiedSaid(c), copiedSaid(c, 7)]),
  chartItemSays({ id: CHART_ITEM, extra: 'nonsense' }), chartItemSays({ id: 'papyrus', extra: chartExtra({ x: 1, y: 2, r: 3 }) }),
  `{${[512, 300, 14].join(',')}}`, CHART_SAID.noSheet, CHART_SAID.notMap, CHART_SAID.blank, CHART_SAID.noCopySheet].join('#');
check('every sentence it says, and what it writes on the map, is the same on both sides', wordsIsle === wordsHere, `${wordsIsle}\n     / ${wordsHere}`);
check('and Examine says exactly the square it holds and how many tiles studying it adds',
  chartItemSays({ id: CHART_ITEM, extra: '14 tiles round 512, 300' }) === ' Map: 29×29 tiles round 512, 300. Study it to add all 841 tiles to your map.'
    && JSON.stringify(chartOf({ id: CHART_ITEM, extra: '14 tiles round 512, 300' })) === JSON.stringify({ r: 14, x: 512, y: 300 }));

/* ---- on the island --------------------------------------------------------------- */

const MIRA = 'c4a7e000-0000-4000-8000-0000000000a1';
const OTTO = 'c4a7e000-0000-4000-8000-0000000000a2';
const SKILL = 40;
const ROLL = 0.5;
const T = (id: string): string => `jsonb_build_object('kind', 'item', 'uid', ${id})`;
const lastSaid = (who = 'u', kind = 'event'): string =>
  `(select e.text from event e where e.world_id = w and e.uid = ${who} and e.kind = '${kind}' order by e.n desc limit 1)`;
const refusal = (key: string, who: string, action: string, id: string): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, ${who}, '${action}', ${T(id)}), 'none'));`;
const mapRow = (key: string, id: string): string =>
  `insert into said select '${key}', i.extra || '|' || to_char(i.ql, 'FM990.00') || '|' || i.def from item i where i.id = ${id};`;
const newest = (who = 'u'): string => `(select max(id) from item where world_id = w and holder_uid = ${who} and def = '${CHART_ITEM}')`;

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
declare w uuid; u uuid := '${MIRA}'; o uuid := '${OTTO}'; v_sheet bigint; v_map bigint; v_copy bigint; v_low bigint; v_skill double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Maps', 161, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
  perform rpc_join(w, 'Otto');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  update player set body_at = now(), x = 40.5, y = 30.5 where world_id = w and uid = o;
  insert into skill (world_id, uid, id, value) values (w, u, '${CHART_SKILL}', ${SKILL}), (w, o, '${CHART_SKILL}', ${SKILL})
    on conflict (world_id, uid, id) do update set value = excluded.value;

  -- 1. Refusals with nothing to draw on, and a map job asked of a sheet.
  v_sheet := give(w, u, 'reed', 1, 30);
  ${refusal('R:draw:reed', 'u', DRAW_MAP, 'v_sheet')}
  ${refusal('R:draw:gone', 'u', DRAW_MAP, '987654')}
  delete from item where id = v_sheet;
  v_sheet := give(w, u, '${CHART_SHEET}', 2, 30);
  ${refusal('R:draw:none', 'u', DRAW_MAP, 'v_sheet')}
  ${refusal('R:study:sheet', 'u', STUDY_MAP, 'v_sheet')}
  ${refusal('R:copy:sheet', 'u', COPY_MAP, 'v_sheet')}

  -- 2. Drawn on a QL 30 sheet at papyrusmaking ${SKILL}: the sheet is the cap.
  select value into v_skill from skill where world_id = w and uid = u and id = '${CHART_SKILL}';
  perform pg_temp.dice('${ROLL}');
  perform act_perform(w, u, '${DRAW_MAP}', ${T('v_sheet')});
  perform pg_temp.nodice();
  v_map := ${newest()};
  ${mapRow('DRAWN', 'v_map')}
  insert into said values ('DRAWNSAID', ${lastSaid()});
  insert into said select 'SHEETS', coalesce((select sum(count) from item where world_id = w and holder_uid = u and def = '${CHART_SHEET}'), 0)::text
    || '|' || ((select value from skill where world_id = w and uid = u and id = '${CHART_SKILL}') > v_skill)::text;
  insert into said select 'EXAMINE', examine_item_text(w, u, i) from item i where i.id = v_map;

  -- 3. Drawn on a fine sheet: papyrusmaking is the cap.
  v_sheet := give(w, u, '${CHART_SHEET}', 1, 90);
  perform pg_temp.dice('${ROLL}');
  perform act_perform(w, u, '${DRAW_MAP}', ${T('v_sheet')});
  perform pg_temp.nodice();
  ${mapRow('DRAWNFINE', newest())}
  delete from item where id = ${newest()};

  -- 4. Copy: refused with no sheet left, then onto a fine sheet (capped by the original) and a poor one (capped by the sheet).
  delete from item where world_id = w and holder_uid = u and def = '${CHART_SHEET}';
  ${refusal('R:copy:none', 'u', COPY_MAP, 'v_map')}
  ${refusal('R:study:ok', 'u', STUDY_MAP, 'v_map')}
  perform give(w, u, '${CHART_SHEET}', 1, 80);
  ${refusal('R:copy:ok', 'u', COPY_MAP, 'v_map')}
  perform pg_temp.dice('${ROLL}');
  perform act_perform(w, u, '${COPY_MAP}', ${T('v_map')});
  perform pg_temp.nodice();
  v_copy := ${newest()};
  ${mapRow('COPY', 'v_copy')}
  insert into said values ('COPYSAID', ${lastSaid()});
  perform give(w, u, '${CHART_SHEET}', 1, 12);
  perform pg_temp.dice('${ROLL}');
  perform act_perform(w, u, '${COPY_MAP}', ${T('v_map')});
  perform pg_temp.nodice();
  v_low := ${newest()};
  ${mapRow('COPYLOW', 'v_low')}
  insert into said select 'LEFT', coalesce((select sum(count) from item where world_id = w and holder_uid = u and def = '${CHART_SHEET}'), 0)::text;
  -- And a copy of the poor copy, on a fine sheet, is no better than the poor copy.
  perform give(w, u, '${CHART_SHEET}', 1, 80);
  perform pg_temp.dice('${ROLL}');
  perform act_perform(w, u, '${COPY_MAP}', ${T('v_low')});
  perform pg_temp.nodice();
  ${mapRow('COPYCOPY', newest())}

  -- 5. A blank map, which is no map.
  update item set extra = null where id = v_low;
  ${refusal('R:study:blank', 'u', STUDY_MAP, 'v_low')}

  -- 6. Handed to Otto, who never stood there, and studied by him.
  update item set holder_uid = o where id = v_copy;
  insert into said values ('OTTO0', (select count(*) from charted where world_id = w and uid = o)::text);
  perform act_perform(w, o, '${STUDY_MAP}', ${T('v_copy')});
  insert into said select 'OTTOCHART', string_agg(x || ',' || y || ',' || r, ';') from charted where world_id = w and uid = o;
  insert into said values ('OTTOSAID', ${lastSaid('o')});
  insert into said values ('OTTOLINE', ${lastSaid('o', 'charted')});
  insert into said values ('OTTOKEPT', (select count(*) from item where id = v_copy and holder_uid = o)::text);
  insert into said values ('MIRACHART', (select count(*) from charted where world_id = w and uid = u)::text);
  -- Studied twice is one square, not two.
  perform act_perform(w, o, '${STUDY_MAP}', ${T('v_copy')});
  insert into said values ('OTTOTWICE', (select count(*) from charted where world_id = w and uid = o)::text);
  -- And it is Otto's to read through the front door, and nobody else's.
  insert into said values ('POLICY', (select string_agg(policyname || ':' || cmd, ',') from pg_policies where tablename = 'charted'));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(161, 64);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(10.5, 10.5, 0);
g.skills.values.set(CHART_SKILL, SKILL);
const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
const lastHere = (): string => said[said.length - 1] ?? '';
g.rand = () => ROLL;
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const at = (uid: number): Target => ({ kind: 'item', uid });
const ask = (id: string, uid: number): string => act(id).check?.(at(uid), g) ?? 'none';
const maps = (): Item[] => g.inventory.items.filter((it) => it.id === CHART_ITEM);
const row = (it: Item | undefined): string => (it ? `${it.extra}|${it.ql.toFixed(2)}|${it.id}` : '-');
const sheets = (): number => g.inventory.items.filter((it) => it.id === CHART_SHEET).reduce((n, it) => n + it.count, 0);

/* 1. Refusals. */
const reed = g.inventory.add('reed', { ql: 30 });
const R: Record<string, string> = {};
R['R:draw:reed'] = ask(DRAW_MAP, reed.uid);
R['R:draw:gone'] = ask(DRAW_MAP, 987654);
g.inventory.remove(reed.uid, 1);
const sheet = g.inventory.add(CHART_SHEET, { ql: 30, count: 2 });
R['R:draw:none'] = ask(DRAW_MAP, sheet.uid);
R['R:study:sheet'] = ask(STUDY_MAP, sheet.uid);
R['R:copy:sheet'] = ask(COPY_MAP, sheet.uid);

/* 2. Drawn on a QL 30 sheet. */
const skillBefore = g.skills.get(CHART_SKILL);
g.requestAction(act(DRAW_MAP), at(sheet.uid));
for (let i = 0; i < 4000 && g.action; i++) g.update(0.05);
const finished = !g.action;
const map = maps()[0];
const drawnQl = Math.min(SKILL * (0.6 + ROLL * 0.8) + 1, 30);
const wantDrawn = { x: 10, y: 10, r: chartReach(drawnQl) };
check(`Draw a map records the square round where you stand, its reach off its QL: ${row(map)}`,
  isle.get('DRAWN') === row(map) && map?.extra === chartExtra(wantDrawn) && Math.abs((map?.ql ?? 0) - drawnQl) < 1e-9,
  `island ${isle.get('DRAWN')} / browser ${row(map)}`);
check(`and says so in the same words: ${drawnSaid(wantDrawn, drawnQl)}`, isle.get('DRAWNSAID') === said.find((s) => s.startsWith('Drawn: ')) && said.includes(drawnSaid(wantDrawn, drawnQl)),
  `${isle.get('DRAWNSAID')} / ${said.find((s) => s.startsWith('Drawn: '))}`);
check('a sheet is used up and papyrusmaking is trained, on both sides',
  finished && part('SHEETS', 0) === '1' && sheets() === 1 && part('SHEETS', 1) === 'true' && g.skills.get(CHART_SKILL) > skillBefore, `${isle.get('SHEETS')} / ${sheets()}`);
act('examine_item').perform(at(map?.uid ?? -1), g);
const tail = chartItemSays(map as Item);
check(`Examine on it says the square it holds: ${tail.trim()}`, (isle.get('EXAMINE') ?? '').includes(tail) && lastHere().includes(tail) && tail.includes('21×21'),
  isle.get('EXAMINE'));

/* 3. Drawn on a fine sheet, capped by the skill. */
const fine = g.inventory.add(CHART_SHEET, { ql: 90 });
act(DRAW_MAP).perform(at(fine.uid), g);
const fineMap = maps().find((m) => m.uid !== map?.uid);
const fineQl = SKILL * (0.6 + ROLL * 0.8) + 1;
check(`on a finer sheet than your hands the map is at your papyrusmaking's roll: ${row(fineMap)}`,
  isle.get('DRAWNFINE') === row(fineMap) && fineMap?.extra === chartExtra({ x: 10, y: 10, r: chartReach(fineQl) }), `island ${isle.get('DRAWNFINE')} / browser ${row(fineMap)}`);
if (fineMap) g.inventory.remove(fineMap.uid, 1);

/* 4. Copies. */
for (const it of [...g.inventory.items]) if (it.id === CHART_SHEET) g.inventory.remove(it.uid, it.count);
R['R:copy:none'] = ask(COPY_MAP, map?.uid ?? -1);
R['R:study:ok'] = ask(STUDY_MAP, map?.uid ?? -1);
g.inventory.add(CHART_SHEET, { ql: 80 });
R['R:copy:ok'] = ask(COPY_MAP, map?.uid ?? -1);
act(COPY_MAP).perform(at(map?.uid ?? -1), g);
const copy = maps()[maps().length - 1];
check(`a copy onto a finer sheet is capped at the original's QL, the same square: ${row(copy)}`,
  isle.get('COPY') === row(copy) && copy?.ql === map?.ql && copy?.extra === map?.extra && isle.get('COPYSAID') === lastHere()
    && lastHere() === copiedSaid(wantDrawn, drawnQl), `island ${isle.get('COPY')} / browser ${row(copy)}`);
g.inventory.add(CHART_SHEET, { ql: 12 });
act(COPY_MAP).perform(at(map?.uid ?? -1), g);
const low = maps()[maps().length - 1];
check(`a copy onto a poorer sheet is capped at the sheet, and reaches only as far as its own QL: ${row(low)}`,
  isle.get('COPYLOW') === row(low) && low?.ql === 12 && low?.extra === chartExtra({ ...wantDrawn, r: chartReach(12) }) && chartReach(12) < wantDrawn.r,
  `island ${isle.get('COPYLOW')} / browser ${row(low)}`);
check('each copy uses up a sheet', isle.get('LEFT') === '0' && sheets() === 0, `${isle.get('LEFT')} / ${sheets()}`);
g.inventory.add(CHART_SHEET, { ql: 80 });
act(COPY_MAP).perform(at(low?.uid ?? -1), g);
const copyCopy = maps()[maps().length - 1];
check(`and a copy of a copy is no better than the copy: ${row(copyCopy)}`, isle.get('COPYCOPY') === row(copyCopy) && copyCopy?.ql === 12,
  `island ${isle.get('COPYCOPY')} / browser ${row(copyCopy)}`);

/* 5. Blank. */
if (low) low.extra = undefined;
R['R:study:blank'] = ask(STUDY_MAP, low?.uid ?? -1);

const WANT: Record<string, string> = {
  'R:draw:reed': CHART_SAID.noSheet, 'R:draw:gone': CHART_SAID.noSheet, 'R:draw:none': 'none', 'R:study:sheet': CHART_SAID.notMap,
  'R:copy:sheet': CHART_SAID.notMap, 'R:copy:none': CHART_SAID.noCopySheet, 'R:study:ok': 'none', 'R:copy:ok': 'none', 'R:study:blank': CHART_SAID.blank,
};
for (const [k, want] of Object.entries(WANT)) {
  check(`${k.slice(2)}: ${want}`, isle.get(k) === want && R[k] === want, `island ${isle.get(k)} / browser ${R[k]}`);
}

/* 6. Studied by somebody who never stood there. */
const o = Game.create(161, 64);
o.world.water = null;
o.world.heights.fill(10);
o.world.tiles.fill(TileType.Grass);
o.world.data.fill(0);
o.inventory.items.length = 0;
o.putBody(40.5, 30.5, 0);
const seenIn = (gg: Game, c: { x: number; y: number; r: number }): number => {
  let n = 0;
  for (let y = c.y - c.r; y <= c.y + c.r; y++) for (let x = c.x - c.r; x <= c.x + c.r; x++) if (gg.world.inBounds(x, y) && gg.world.seen[y * gg.world.w + x]) n++;
  return n;
};
const side = wantDrawn.r * 2 + 1;
const before = seenIn(o, wantDrawn);
const handed = o.inventory.add(CHART_ITEM, { ql: copy?.ql, extra: copy?.extra });
const oSaid: string[] = [];
o.logMsg = (m: string) => { oSaid.push(m); };
const oAsk = act(STUDY_MAP).check?.(at(handed.uid), o) ?? 'none';
act(STUDY_MAP).perform(at(handed.uid), o);
check(`Study map puts the whole square on the reader's map: ${side * side} tiles, none of them walked`,
  oAsk === 'none' && before < side * side && seenIn(o, wantDrawn) === side * side && o.inventory.get(handed.uid)?.id === CHART_ITEM, `${before} -> ${seenIn(o, wantDrawn)}`);
check(`on the island it is kept for the reader alone, in the same words: ${oSaid[oSaid.length - 1]}`,
  isle.get('OTTO0') === '0' && isle.get('OTTOCHART') === `${wantDrawn.x},${wantDrawn.y},${wantDrawn.r}` && isle.get('MIRACHART') === '0'
    && isle.get('OTTOSAID') === oSaid[oSaid.length - 1] && oSaid[oSaid.length - 1] === studiedSaid(wantDrawn) && isle.get('OTTOKEPT') === '1',
  `${isle.get('OTTOCHART')} ${isle.get('OTTOSAID')}`);
check('studied twice it is one square', isle.get('OTTOTWICE') === '1', isle.get('OTTOTWICE'));
check('and only the reader may read it through the front door', isle.get('POLICY') === 'charted_read:SELECT', isle.get('POLICY'));
{
  // The line the island says to the browser that studied it, put on a map that has never seen the place.
  const fresh = Game.create(161, 64);
  fresh.putBody(55.5, 55.5, 0);
  const c = chartedSquare(isle.get('OTTOLINE') ?? '');
  const n = c ? learnChart(fresh, c) : -1;
  check(`the island's charted line is the square, and puts it on the browser's map: ${isle.get('OTTOLINE')}`,
    JSON.stringify(c) === JSON.stringify(wantDrawn) && seenIn(fresh, wantDrawn) === side * side && n > 0, `${n}`);
  // And a square past the edge of the island is cut at the edge.
  const edge = Game.create(161, 64);
  const m = learnChart(edge, { x: 1, y: 1, r: 3 });
  check('a square over the edge of the island is cut at the edge', seenIn(edge, { x: 1, y: 1, r: 3 }) === 5 * 5 && m <= 5 * 5 && !edge.world.seen[5 * edge.world.w + 5], `${m}`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`maps — ${ok.length} of ${ok.length}`);

/**
 * Signed masterworks (`signing.ts`), on both sides.
 *
 * The job, the QL a thing is made at to carry its maker's name, the longest
 * line and every sentence, the same on both sides; a mallet carved at the
 * bench at the signing QL or better carries its maker's name and one carved
 * under it does not, on both sides; Sign refused for a thing made under the
 * QL, for rare work under it, for a pile and for a piece of furniture, for
 * somebody who did not make it, for blank words and, on the island, for
 * somebody a keeper has muted -- every refusal in the same words; the line
 * cleaned as talk is and cut at the longest; signed once and refused after;
 * and Examine saying the maker and the line, the same on both sides, through
 * the pack's row and a save.
 *
 * Every roll is set. Runs against the database the suite leaves behind; the
 * island half is rolled back.
 *
 *   npx esbuild supabase/test/signed.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/signed.mjs && node node_modules/.cache/signed.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { cleanSaid } from '../../src/game/chat';
import { type Item } from '../../src/game/items';
import { MEMORIAL } from '../../src/game/memorial';
import {
  cleanSignature, madeBy, makerLine, SIGN, SIGN_MAX, SIGN_QL, SIGN_SAID, SIGN_TIME, signedSaid, signNotYours,
} from '../../src/game/signing';
import { packWorld, unpack, packLand } from '../../src/game/save';
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
const E = (s: string): string => `E${sq(s).replace(/\n/g, '\\n').replace(/\t/g, '\\t')}`;

/* ---- the job, the numbers and the words, on both sides ----------------------------------- */

const job = ACTION_BY_ID.get(SIGN) as ActionDef;
const jobIsle = psql(`select id || ':' || label || ':' || coalesce(skill, '-') || ':' || coalesce(tool, '-') || ':' || base_time || ':' || instant
  from action_def where id = '${SIGN}'`);
check(`Sign is the same row on both sides: ${jobIsle}`, !!job && jobIsle === `${SIGN}:${job.label}:-:-:${job.baseTime}:false`
  && job.label === 'Sign' && job.baseTime === SIGN_TIME, jobIsle);
check(`it is dispatched with a memorial stone's jobs, and its numbers are the browser's: QL ${SIGN_QL}, ${SIGN_MAX} characters`,
  psql(`select memorial_action('${SIGN}') || '|' || sign_action() || '|' || sign_ql() || '|' || sign_max()`) === `true|${SIGN}|${SIGN_QL}|${SIGN_MAX}`);
check(`the box says the longest line, ${SIGN_MAX} characters, and that it is once, off the rule`,
  job.asks?.max === SIGN_MAX && !!job.asks?.question.includes(`${SIGN_MAX} characters`) && !!job.asks?.question.includes('once'), job.asks?.question);

const LINES = ['For Otto, who taught me', '  For\nOtto\tand   Sorrel  ', '\n\t \n', 'x'.repeat(SIGN_MAX + 30), `${' '.repeat(10)}${'y'.repeat(SIGN_MAX)}`];
const cleanIsle = psql(`select string_agg(sign_clean(t), '#' order by o) from unnest(array[${LINES.map(E).join(', ')}]::text[]) with ordinality u(t, o)`);
const cleanHere = LINES.map(cleanSignature);
check(`a line is cleaned the same on both sides, as talk is, and cut at ${SIGN_MAX} characters`,
  cleanIsle === cleanHere.join('#') && cleanHere[1] === 'For Otto and Sorrel' && cleanHere[2] === '' && cleanHere[3].length === SIGN_MAX
    && cleanHere[4] === 'y'.repeat(SIGN_MAX) && LINES.every((l) => cleanSignature(l) === cleanSaid(l).slice(0, SIGN_MAX)), cleanIsle);

const wordsIsle = psql(`select concat_ws('#', sign_said('notMade'), sign_said('signed'), sign_said('nothing'), sign_not_yours_said('Mira'),
  signed_said('For Otto'), maker_says('Mira', null), maker_says('Mira', 'For Otto'), maker_says(null, 'For Otto'))`);
const wordsHere = [SIGN_SAID.notMade, SIGN_SAID.signed, SIGN_SAID.nothing, signNotYours('Mira'), signedSaid('For Otto'),
  makerLine('Mira', undefined), makerLine('Mira', 'For Otto'), makerLine(undefined, 'For Otto')].join('#');
check('every sentence it says is the same on both sides, and the QL in it is the rule\'s', wordsIsle === wordsHere
  && SIGN_SAID.notMade.includes(`QL ${SIGN_QL}`) && makerLine('Mira', 'For Otto') === ' Made and signed by Mira: “For Otto”.', `${wordsIsle} / ${wordsHere}`);

// Who carries a maker's name, made: one thing at the QL or better, and rare work, the same on both sides.
const CASES: Array<[string, number, number]> = [
  ['mallet', SIGN_QL, 0], ['mallet', SIGN_QL - 0.01, 0], ['mallet', SIGN_QL - 40, 1], ['plank', 99, 0], ['plank', 30, 1], [MEMORIAL, 95, 0],
];
const madeIsle = psql(`
begin;
do $t$
declare w uuid; u uuid := 'e1c4a170-0000-4000-8000-0000000000b1';
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Signing names', 162, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  create temp table made (o int, v text);
  insert into made select o, coalesce(made_by(w, u, case when r = 1 then 'rare' end, d, q), '-')
    from (values ${CASES.map(([d, q, r], i) => `(${i}, '${d}', ${q}::double precision, ${r})`).join(', ')}) c(o, d, q, r);
end $t$;
select string_agg(v, '|' order by o) from made;
rollback;`).split('\n').filter(Boolean).pop();
const madeHere = CASES.map(([d, q, r]) => madeBy('Mira', d, q, r || undefined) ?? '-').join('|');
check(`a thing made carries its maker's name at QL ${SIGN_QL} or better and not under it, rare work always, a pile only when rare, the same on both sides`,
  madeIsle === madeHere && madeHere === 'Mira|-|Mira|-|Mira|Mira', `island ${madeIsle}, browser ${madeHere}`);

/* ---- on the island --------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-0000000000b1';
const OTTO = 'e1c4a170-0000-4000-8000-0000000000b2';
const LINE = '  For Otto,\nwho taught   me  ';
const LONG = 'For Otto and Sorrel and the hounds, who came in the spring and stayed';
const T = (id: string, name?: string): string => `jsonb_build_object('kind', 'item', 'uid', ${id}${name === undefined ? '' : `, 'name', ${E(name)}`})`;
const lastSaid = (who = 'u'): string => `(select e.text from event e where e.world_id = w and e.uid = ${who} and e.kind = 'event' order by e.n desc limit 1)`;
const refusal = (key: string, who: string, id: string, name?: string): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, ${who}, '${SIGN}', ${T(id, name)}), 'none'));`;

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
-- Nothing made here comes out rare: what carries a name is carried for its QL.
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; o uuid := '${OTTO}'; v_log bigint; v_hi bigint; v_lo bigint; v_x bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Signed', 163, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
  perform rpc_join(w, 'Otto');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  insert into skill (world_id, uid, id, value) values (w, u, 'carpentry', 95), (w, o, 'carpentry', 50)
    on conflict (world_id, uid, id) do update set value = excluded.value;

  -- 1. A mallet carved at the signing QL or better carries its maker's name; one carved under it does not.
  perform give(w, u, 'carving_knife', 1, 99);
  perform give(w, o, 'carving_knife', 1, 99);
  v_log := give(w, u, 'log', 1, 40, 'Oak');
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, 'make_mallet', jsonb_build_object('kind', 'item', 'uid', v_log));
  perform pg_temp.nodice();
  select id into v_hi from item where world_id = w and holder_uid = u and def = 'mallet';
  insert into said select 'HI', round(i.ql::numeric, 2) || '|' || coalesce(i.maker, '-') from item i where i.id = v_hi;
  v_log := give(w, o, 'log', 1, 40, 'Oak');
  perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
  perform pg_temp.dice('0.01');
  perform perform_craft(w, o, 'make_mallet', jsonb_build_object('kind', 'item', 'uid', v_log));
  perform pg_temp.nodice();
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  select id into v_lo from item where world_id = w and holder_uid = o and def = 'mallet';
  insert into said select 'LO', round(i.ql::numeric, 2) || '|' || coalesce(i.maker, '-') from item i where i.id = v_lo;

  -- 2. The refusals, in order: gone, made under the QL, rare under it, a pile, a piece, not yours, the words.
  ${refusal('R:gone', 'u', '987654321', 'x')}
  ${refusal('R:low', 'o', 'v_lo', LINE)}
  insert into item (world_id, holder, holder_uid, def, ql, count, extra, rare, maker)
    values (w, 'player', u, 'mallet', ${SIGN_QL - 40}, 1, 'Oak', 'rare', 'Mira') returning id into v_x;
  ${refusal('R:rare', 'u', 'v_x', LINE)}
  insert into item (world_id, holder, holder_uid, def, ql, count, extra, rare, maker)
    values (w, 'player', u, 'plank', 95, 4, 'Oak', 'rare', 'Mira') returning id into v_x;
  ${refusal('R:pile', 'u', 'v_x', LINE)}
  insert into item (world_id, holder, holder_uid, def, ql, count, maker)
    values (w, 'player', u, '${MEMORIAL}', 95, 1, 'Mira') returning id into v_x;
  ${refusal('R:piece', 'u', 'v_x', LINE)}
  update item set holder_uid = o where id = v_hi;
  ${refusal('R:other', 'o', 'v_hi', LINE)}
  update item set holder_uid = u where id = v_hi;
  ${refusal('R:unasked', 'u', 'v_hi')}
  ${refusal('R:blank', 'u', 'v_hi', '  \n\t  ')}
  ${refusal('R:none', 'u', 'v_hi', LINE)}
  insert into private.island_mute (world_id, uid, until, by_uid) values (w, u, null, o);
  ${refusal('R:muted', 'u', 'v_hi', LINE)}
  insert into said values ('MUTEDWHY', private.muted_why(w, u));
  delete from private.island_mute where world_id = w and uid = u;
  insert into said select 'LOOK0', examine_item_text(w, u, i) from item i where i.id = v_hi;

  -- 3. Signed, through the job; and then never again.
  perform act_perform(w, u, '${SIGN}', ${T('v_hi', LINE)});
  insert into said select 'SIGNED', coalesce(i.engraving, '-') || '|' || ${lastSaid()} from item i where i.id = v_hi;
  ${refusal('R:again', 'u', 'v_hi', LONG)}
  perform act_perform(w, u, '${SIGN}', ${T('v_hi', LONG)});
  insert into said select 'KEPT', coalesce(i.engraving, '-') from item i where i.id = v_hi;
  insert into said select 'LOOK', examine_item_text(w, u, i) from item i where i.id = v_hi;
  insert into said select 'ROW', (to_jsonb(i) - 'world_id')::text from item i where i.id = v_hi;

  -- 4. And a long line is cut at the longest: a second masterwork, signed long.
  insert into item (world_id, holder, holder_uid, def, ql, count, extra, maker)
    values (w, 'player', u, 'mallet', 95, 1, 'Oak', 'Mira') returning id into v_x;
  perform act_perform(w, u, '${SIGN}', ${T('v_x', LONG)});
  insert into said select 'LONG', coalesce(i.engraving, '-') from item i where i.id = v_x;
  -- And handed to somebody else, it still says who made it and what they signed.
  update item set holder_uid = o where id = v_hi;
  insert into said select 'THEIRS', examine_item_text(w, o, i) from item i where i.id = v_hi;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(163, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(10.5, 10.5, 0);
g.settings.fromStores = false;
g.player.name = 'Mira';
const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
const lastHere = (): string => said[said.length - 1] ?? '';
const dice = (...xs: number[]): void => {
  let n = 0;
  g.rand = () => xs[n++ % xs.length];
};
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const at = (it: Item | undefined, name?: string): Target => ({ kind: 'item', uid: it?.uid ?? -1, ...(name === undefined ? {} : { name }) } as Target);
const ask = (t: Target): string => job.check?.(t, g) ?? 'none';
const carve = (skill: number): Item | undefined => {
  g.skills.values.set('carpentry', skill);
  const log = g.inventory.add('log', { ql: 40, extra: 'Oak' });
  const before = new Set(g.inventory.items.filter((it) => it.id === 'mallet').map((it) => it.uid));
  dice(0.01);
  act('make_mallet').perform({ kind: 'item', uid: log.uid }, g);
  return g.inventory.items.find((it) => it.id === 'mallet' && !before.has(it.uid));
};

/* 1. Made. */
g.inventory.add('carving_knife', { ql: 99 });
const hi = carve(95);
const lo = carve(50);
check(`a mallet carved at QL ${part('HI', 0)} carries its maker's name, on both sides`,
  Number(part('HI', 0)) >= SIGN_QL && part('HI', 1) === 'Mira' && !!hi && hi.ql >= SIGN_QL && hi.maker === 'Mira', `${isle.get('HI')} / ${hi?.ql} ${hi?.maker}`);
check(`and one carved at QL ${part('LO', 0)}, under ${SIGN_QL}, carries none, on both sides`,
  Number(part('LO', 0)) < SIGN_QL && part('LO', 1) === '-' && !!lo && lo.ql < SIGN_QL && lo.maker === undefined, `${isle.get('LO')} / ${lo?.ql} ${lo?.maker}`);

/* 2. Refusals. */
const R: Record<string, string> = {};
R['R:gone'] = ask({ kind: 'item', uid: 987654321, name: 'x' } as Target);
R['R:low'] = ask(at(lo, LINE));
R['R:rare'] = ask(at(g.inventory.addItem({ uid: g.inventory.nextUid++, id: 'mallet', ql: SIGN_QL - 40, dmg: 0, count: 1, extra: 'Oak', rare: 1, maker: 'Mira' }), LINE));
R['R:pile'] = ask(at(g.inventory.addItem({ uid: g.inventory.nextUid++, id: 'plank', ql: 95, dmg: 0, count: 4, extra: 'Oak', rare: 1, maker: 'Mira' }), LINE));
R['R:piece'] = ask(at(g.inventory.addItem({ uid: g.inventory.nextUid++, id: MEMORIAL, ql: 95, dmg: 0, count: 1, maker: 'Mira' }), LINE));
g.player.name = 'Otto';
R['R:other'] = ask(at(hi, LINE));
const offered = job.applies({ kind: 'item', uid: hi?.uid ?? -1 } as Target, g);
g.player.name = 'Mira';
R['R:unasked'] = ask(at(hi));
R['R:blank'] = ask(at(hi, '  \n\t  '));
R['R:none'] = ask(at(hi, LINE));
const WANT: Record<string, string> = {
  'R:gone': 'It is gone.', 'R:low': SIGN_SAID.notMade, 'R:rare': SIGN_SAID.notMade, 'R:pile': SIGN_SAID.notMade, 'R:piece': SIGN_SAID.notMade,
  'R:other': signNotYours('Mira'), 'R:unasked': 'none', 'R:blank': SIGN_SAID.nothing, 'R:none': 'none',
};
for (const [k, want] of Object.entries(WANT)) {
  check(`Sign ${k.slice(2)}: ${want}`, isle.get(k) === want && R[k] === want, `island ${isle.get(k)} / browser ${R[k]}`);
}
check('and Sign is offered on a masterwork to its maker and nobody else', !offered && job.applies({ kind: 'item', uid: hi?.uid ?? -1 } as Target, g));
check('somebody a keeper has muted signs nothing, in the keeper\'s own words, on the island where there are keepers',
  !!isle.get('MUTEDWHY') && isle.get('R:muted') === isle.get('MUTEDWHY'), isle.get('R:muted'));
act('examine_item').perform(at(hi), g);
const made0 = makerLine('Mira', undefined);
check(`unsigned, Examine says who made it, the same on both sides: ${made0.trim()}`,
  (isle.get('LOOK0') ?? '').includes(made0) && lastHere().includes(made0) && !lastHere().includes('signed'), isle.get('LOOK0'));

/* 3. Signed, and once. */
act(SIGN).perform(at(hi, LINE), g);
const line = cleanSignature(LINE);
check(`it is signed with the line cleaned, the same on both sides: ${signedSaid(line)}`,
  part('SIGNED', 0) === line && hi?.engraving === line && part('SIGNED', 1) === lastHere() && lastHere() === signedSaid(line) && line === 'For Otto, who taught me',
  `${isle.get('SIGNED')} / ${hi?.engraving} ${lastHere()}`);
const again = ask(at(hi, LONG));
act(SIGN).perform(at(hi, LONG), g);
check(`and once: signing it again is refused, "${again}", and the first line stays, on both sides`,
  again === SIGN_SAID.signed && isle.get('R:again') === again && isle.get('KEPT') === line && hi?.engraving === line, `${isle.get('R:again')} ${isle.get('KEPT')}`);
check('and is not offered again', !job.applies({ kind: 'item', uid: hi?.uid ?? -1 } as Target, g));
act('examine_item').perform(at(hi), g);
const signedTail = makerLine('Mira', line);
check(`Examine says who made it and what they signed it with, the same on both sides: ${signedTail.trim()}`,
  (isle.get('LOOK') ?? '').includes(signedTail) && lastHere().includes(signedTail) && !lastHere().includes(' It reads:'),
  `${isle.get('LOOK')} / ${lastHere()}`);
check('in the browser\'s words as the island says the whole of it',
  isle.get('LOOK')?.slice(isle.get('LOOK')?.indexOf(' Made') ?? 0) === lastHere().slice(lastHere().indexOf(' Made')), `${isle.get('LOOK')} / ${lastHere()}`);
check('and to whoever has it after, on the island', (isle.get('THEIRS') ?? '').includes(signedTail), isle.get('THEIRS'));

/* 4. The longest. */
const long = cleanSignature(LONG);
const other = g.inventory.addItem({ uid: g.inventory.nextUid++, id: 'mallet', ql: 95, dmg: 0, count: 1, extra: 'Oak', maker: 'Mira' });
act(SIGN).perform(at(other, LONG), g);
check(`a long line is cut at ${SIGN_MAX} characters, the same on both sides`,
  isle.get('LONG') === long && other.engraving === long && long.length === SIGN_MAX && LONG.length > SIGN_MAX, `${isle.get('LONG')} / ${other.engraving}`);

/* 5. Where it goes. */
const rowBack = packed(JSON.parse(isle.get('ROW') ?? '{}') as ItemRow, { since: () => 0 });
check('the island\'s row comes into the browser with its maker and its line', rowBack.engraving === line && rowBack.maker === 'Mira' && rowBack.id === 'mallet',
  JSON.stringify(rowBack));
{
  const land = await packLand(g);
  const back = await unpack(land, JSON.parse(JSON.stringify(packWorld(g))));
  const kept = back?.inventory.items.find((it) => it.uid === hi?.uid);
  check('and it keeps both through a save and a load in the browser', kept?.engraving === line && kept?.maker === 'Mira', JSON.stringify(kept));
}

for (const l of [...ok, ...bad]) console.log(l);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`signed masterworks — ${ok.length} of ${ok.length}`);

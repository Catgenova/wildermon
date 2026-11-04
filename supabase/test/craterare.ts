/**
 * A rare thing put into a crate stays rare, and a pile in a crate is of one kind of thing.
 *
 * Reported: "Nakatari just placed a 4ql supreme plank into his settlement crate and it lost its rarity." `crate_put`
 * folded a stackable thing into the crate's first pile of the same def, extra and piece, and the browser's `crateAdd`
 * the same: the supreme plank went onto the plain planks and was a plank. This puts supreme planks into a crate of
 * plain ones, on both sides, and asks what the crate holds.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { cratePut } from '../../src/game/crates';
import { RARITIES, type Item } from '../../src/game/items';

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

const SUPREME = RARITIES.findIndex((r) => r.name === 'supreme');
const NELL = 'd71c4a17-0000-4000-8000-0000000000e7';

/*
 * The steps, the same on both sides:
 *   1. a crate of 10 plain planks at 20;
 *   2. one of 3 supreme planks at 4 put in;
 *   3. the other 2 put in;
 *   4. 3 of 5 plain planks at 30 put in;
 *   5. 2 plain planks at 50 brought by a worker (`crate_add`, the browser's `crateAdd`).
 * After each, the crate's plank piles as "rarity count ql" sorted.
 */
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${NELL}'; v_sup bigint; v_plain bigint; v_c int := 1;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Rare crates', 182, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Nell');
  delete from item where world_id = w and holder = 'player';
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by, material) values (w, v_c, 'plank', 11, 10, 1, 1, false, u, 'pine');
  insert into item (world_id, holder, crate, gx, gy, def, ql, count) values (w, 'crate', v_c, 11, 10, 'plank', 20, 10);
  insert into said select '1', string_agg(coalesce(rare, '-') || ' ' || count || ' ' || round(ql::numeric), ',' order by rare nulls first, ql)
    from item where world_id = w and holder = 'crate' and crate = v_c;

  v_sup := give(w, u, 'plank', 3, 4, null, 'supreme');
  perform crate_put(w, u, v_c, v_sup, 1);
  insert into said select '2', string_agg(coalesce(rare, '-') || ' ' || count || ' ' || round(ql::numeric), ',' order by rare nulls first, ql)
    from item where world_id = w and holder = 'crate' and crate = v_c;
  insert into said select '2_PACK', string_agg(coalesce(rare, '-') || ' ' || count, ',') from item where world_id = w and holder = 'player' and def = 'plank';

  perform crate_put(w, u, v_c, v_sup, 2);
  insert into said select '3', string_agg(coalesce(rare, '-') || ' ' || count || ' ' || round(ql::numeric), ',' order by rare nulls first, ql)
    from item where world_id = w and holder = 'crate' and crate = v_c;

  v_plain := give(w, u, 'plank', 5, 30);
  perform crate_put(w, u, v_c, v_plain, 3);
  insert into said select '4', string_agg(coalesce(rare, '-') || ' ' || count || ' ' || round(ql::numeric), ',' order by rare nulls first, ql)
    from item where world_id = w and holder = 'crate' and crate = v_c;

  perform crate_add(w, v_c, 'plank', 2, 50);
  insert into said select '5', string_agg(coalesce(rare, '-') || ' ' || count || ' ' || round(ql::numeric), ',' order by rare nulls first, ql)
    from item where world_id = w and holder = 'crate' and crate = v_c;
end $t$;
select k || '=' || v from said;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

/* ---- in the browser ------------------------------------------------------------------------------------------- */

const g = Game.create(182, 256);
g.crates.clear();
g.inventory.items.length = 0;
const c = g.addCrate('plank', 11, 10, 1, 1, [{ uid: g.inventory.nextUid++, id: 'plank', ql: 20, dmg: 0, count: 10 }], false, 'pine');
const piles = (): string => c.items.filter((it) => it.id === 'plank')
  .map((it) => ({ r: it.rare ? RARITIES[it.rare].name : '-', it }))
  .sort((a, b) => (a.r === '-' ? 0 : 1) - (b.r === '-' ? 0 : 1) || a.r.localeCompare(b.r) || a.it.ql - b.it.ql)
  .map(({ r, it }) => `${r} ${it.count} ${Math.round(it.ql)}`).join(',');
const mine = new Map<string, string>();
mine.set('1', piles());
const sup: Item = g.inventory.add('plank', { ql: 4, count: 3, rare: SUPREME });
cratePut(g, c, sup.uid, 1);
mine.set('2', piles());
mine.set('2_PACK', g.inventory.items.filter((it) => it.id === 'plank').map((it) => `${it.rare ? RARITIES[it.rare].name : '-'} ${it.count}`).join(','));
cratePut(g, c, sup.uid, 2);
mine.set('3', piles());
const plain = g.inventory.add('plank', { ql: 30, count: 5 });
cratePut(g, c, plain.uid, 3);
mine.set('4', piles());
g.crateAdd(c, { uid: g.inventory.nextUid++, id: 'plank', ql: 50, dmg: 0, count: 2 });
mine.set('5', piles());

/* ---- what both say -------------------------------------------------------------------------------------------- */

const want: [string, string, string][] = [
  ['1', 'a crate of ten plain planks', '- 10 20'],
  ['2', 'one supreme plank in: a pile of its own, still supreme, at its quality', '- 10 20,supreme 1 4'],
  ['2_PACK', 'the other two still supreme in the pack', 'supreme 2'],
  ['3', 'the other two in: onto the supreme pile', '- 10 20,supreme 3 4'],
  ['4', 'three plain planks in: onto the plain pile, its quality averaged', '- 13 22,supreme 3 4'],
  ['5', 'two plain planks from a worker: onto the plain pile, not the supreme', '- 15 26,supreme 3 4'],
];
for (const [k, what, w] of want) {
  check(`${what} (island)`, isle.get(k) === w, `"${isle.get(k)}", want "${w}"`);
  check(`${what} (browser)`, mine.get(k) === w, `"${mine.get(k)}", want "${w}"`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na rare thing in a crate — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

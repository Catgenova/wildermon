/**
 * Packs are improvable: a sack with a needle and cloth, by Tailoring; a satchel and a backpack with an awl, a needle
 * and leather, by Leatherworking.
 *
 * Asked for: "Make packs like backpacks improveable". A pack was none of the things `improvable` asks about, so
 * Improve was never offered on one, and a backpack's carry bonus (by its quality) stayed what it was stitched at.
 *
 * Both sides: each pack is improvable, of that material and skill, and the island's list is the browser's; every
 * bag that holds things of any kind is a pack on the list. On the island, a backpack at 30 in a pack with an awl, a
 * needle and leather is not refused, and passes at it raise its quality; a sack refused without cloth, in the words
 * the browser uses.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { canImprove, improvable, PACKS } from '../../src/game/improve';
import { ITEM_DEFS } from '../../src/game/items';

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

const ids = Object.keys(PACKS).sort();
const said = (id: string): string => { const w = improvable(id); return w ? `${w.material.id}:${w.skill}` : 'no'; };
check('a sack, a satchel and a backpack improvable', ids.join(',') === 'backpack,sack,satchel' && ids.every((id) => canImprove(id)), ids.join(','));
check('the sack cloth by Tailoring; the satchel and backpack leather by Leatherworking',
  said('sack') === 'cloth:tailoring' && said('satchel') === 'leather:leatherworking' && said('backpack') === 'leather:leatherworking',
  ids.map((id) => `${id} ${said(id)}`).join(', '));
const bags = Object.entries(ITEM_DEFS).filter(([, d]) => d.holds && !d.oneKind).map(([id]) => id).sort();
check('every bag that holds things of any kind is a pack on the list', bags.join(',') === ids.join(','), bags.join(','));

const U = 'a9c1e000-0000-4000-8000-0000000000b7';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v bigint; s bigint; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Packs', 978, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Stitcher');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'leatherworking', 70), (w, u, 'tailoring', 70)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into said select 'LIST', string_agg(item || ':' || material || ':' || skill, ',' order by item) from improvable_def
   where item in ('sack', 'satchel', 'backpack');

  v := give(w, u, 'backpack', 1, 30);
  perform give(w, u, 'awl', 1, 50);
  perform give(w, u, 'needle', 1, 50);
  perform give(w, u, 'leather', 10, 60);
  insert into said values ('ASK', coalesce(act_refusal(w, u, 'improve_item', jsonb_build_object('kind', 'item', 'uid', v)), 'none'));
  for i in 1 .. 8 loop
    perform perform_item(w, u, 'improve_item', jsonb_build_object('kind', 'item', 'uid', v));
  end loop;
  insert into said select 'QL', round(ql::numeric, 2)::text from item where id = v;

  -- A sack, with a needle and no cloth.
  s := give(w, u, 'sack', 1, 30);
  insert into said values ('SACK', coalesce(act_refusal(w, u, 'improve_item', jsonb_build_object('kind', 'item', 'uid', s)), 'none'));
end $t$;
select k || '=' || v from said;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('the island\'s list is the browser\'s', at('LIST') === ids.map((id) => `${id}:${said(id)}`).join(','), at('LIST'));
check('island: a backpack at 30 with an awl, a needle and leather is not refused', at('ASK') === 'none', at('ASK'));
check('island: passes at it raise its quality', Number(at('QL')) > 30, at('QL'));

// The browser: a sack in the pack with a needle and no cloth, refused in the same words.
const g = Game.create(978, 64);
g.inventory.items.length = 0;
g.skills.values.set('tailoring', 70);
const sack = g.inventory.add('sack', { ql: 30 });
g.inventory.add('needle', { ql: 50 });
const act = ACTION_BY_ID.get('improve_item');
const t = { kind: 'item', uid: sack.uid } as Target;
const mine = act?.applies(t, g) ? (act.check?.(t, g) ?? 'none') : 'not offered';
check('a sack without cloth: refused, the same words both sides', at('SACK') !== 'none' && at('SACK') === mine, `island "${at('SACK')}", browser "${mine}"`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\npacks improvable — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

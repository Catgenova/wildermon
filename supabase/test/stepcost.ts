/**
 * What a step costs the island, and that it is the same step.
 *
 * `rpc_move` is the call a walking browser makes constantly. Most of a step went on two things that decide nothing
 * new: `carried_weight` weighing every thing in the pack through three function calls a thing, and twenty-odd small
 * SQL lookups (`path_fx`, `land_height`, `worn_enchant`, ...) planned again on every step because a SQL function that
 * cannot be inlined is planned again by every statement that calls it. `carried_weight` reads the weights in one pass
 * now, `carry_limit` adds up only the enchanted things, `over_carry` asks the limit once, and the lookups are plpgsql,
 * which keeps its plans for the life of a connection.
 *
 * Asks, of Dane on Hoarding with a pack of every kind of thing there is to weigh -- vessels with and without what is
 * in them, a dye bucket, milk, things of a material, things inside a backpack, Packmules and a perk on a kind -- that
 * the weight, the limit and the share are the same numbers, to the last bit, as `item_weight` and `enchant_of` work
 * them out thing by thing; that the vehicle and the mount a body has are NULL where there are none, not a row of
 * NULLs, and the row where there is one; that every lookup a step asks is planned once a session; and that a step
 * still walks and still stops at the water.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on it. Rolled back.
 */
import { execFileSync } from 'node:child_process';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/** Every lookup a step asks that is planned once a session (`20261101351002`, with `stage_of` and `world_time` from `20261101350001`). */
const PLANNED = [
  'path_fx', 'pk', 'worn_enchant', 'bags_carry', 'carry_limit', 'over_carry', 'land_height', 'in_deep_water',
  'skill_standing', 'region_at', 'spiral_at', 'water_bed', 'water_surface', 'runestone_near', 'darkness', 'aware_dark',
  'chunk_slope', 'walk_length', 'walk_tiles', 'nutrition_fedness', 'stage_of', 'placed_enchant', 'is_boat', 'driving',
  'mount_of', 'nutrition_balance', 'jewel_gain', 'stones_of', 'world_time', 'worn',
];

const out = psql(`
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid; v_pack bigint; v_go int; c int;
begin
  select id into w from world where name = 'Hoarding';
  select uid into u from player where world_id = w and name = 'Dane';
  -- A pack of everything there is to weigh.
  for v_go in 1 .. 3 loop
    perform give(w, u, d, 1 + v_go, 30 + v_go * 5) from unnest(array['water_bucket', 'milk_bucket', 'log', 'plank', 'iron_lump', 'rope']) d;
  end loop;
  insert into item (world_id, holder, holder_uid, def, ql, count, charges, extra, enchant) values
    (w, 'player', u, 'water_bucket', 40, 1, 7, null, null),
    (w, 'player', u, 'lye_bucket', 40, 2, null, null, jsonb_build_object('id', 'packmule', 'ql', 55)),
    (w, 'player', u, 'dye_bucket', 40, 1, null, null, null),
    (w, 'player', u, 'milk_part', 40, 1, 4, null, null),
    (w, 'player', u, 'plank', 40, 5, null, 'oak', null),
    (w, 'player', u, 'log', 40, 2, null, 'Willow', jsonb_build_object('id', 'packmule', 'ql', 80)),
    (w, 'player', u, 'log', 40, 1, null, 'no such wood', jsonb_build_object('id', 'gale', 'ql', 30));
  v_pack := give(w, u, 'backpack', 1, 70);
  insert into item (world_id, holder, holder_uid, inside, def, ql, count, extra) values
    (w, 'player', u, v_pack, 'iron_lump', 30, 4, null), (w, 'player', u, v_pack, 'plank', 30, 2, 'maple'),
    (w, 'player', u, v_pack, 'water_bucket', 30, 1, null);
  update player set class_mul = jsonb_build_object('fx', jsonb_build_object('weight:log', 0.75, 'weight:iron_lump', 0.5, 'carry', 12))
   where world_id = w and uid = u;
  insert into said select 'THINGS', count(*)::text || '|' || count(*) filter (where i.inside is not null) || '|'
      || count(*) filter (where i.enchant is not null) || '|' || count(*) filter (where i.def in (select item from vessel_def))
    from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u;
  -- Weighed as every thing weighs itself, in the same order, and as the island weighs a pack.
  insert into said select 'WEIGHT', encode(float8send(carried_weight(w, u)), 'hex') || '|' ||
      encode(float8send((select coalesce(sum(item_weight(i) * pk(m.mul, 'weight:' || i.def, 1)), 0)
                           from item i cross join (select class_mul as mul from player where world_id = w and uid = u) m
                          where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.inside is null)), 'hex');
  insert into said select 'LIMIT', encode(float8send(carry_limit(w, u)), 'hex') || '|' ||
      encode(float8send((carry_base() + skill_of(w, u, 'body_strength') * carry_per_strength() + pk(w, u, 'carry', 0)
                         + path_fx(w, u, 'mule', 0)
                         + coalesce((select sum(enchant_of(i, 'mule')) from item i
                                      where i.world_id = w and i.holder = 'player' and i.holder_uid = u), 0))
                        * (1 + bags_carry(w, u))), 'hex');
  insert into said select 'SHARE', encode(float8send(over_carry(w, u)), 'hex') || '|' ||
      encode(float8send(carried_weight(w, u) / carry_limit(w, u)), 'hex');
  -- No vehicle and no mount: NULL, not a row of NULLs.
  update placed set driver = null where world_id = w and driver = u;
  update creature set rider = null where world_id = w and rider = u;
  insert into said select 'NONE', (driving(w, u)::text is null)::text || '|' || (mount_of(w, u)::text is null)::text;
  c := creature_spawn(w, 'orse', 20.5, 20.5, 'active', now() - interval '90 days', u);
  update creature set rider = u, tacked = true where world_id = w and id = c;
  insert into said select 'MOUNT', ((mount_of(w, u)).id = c)::text || '|' || ((mount_of(w, u)).species)::text;
end $t$;
insert into said select 'PLANNED', string_agg(p.proname, ',' order by p.proname)
  from pg_proc p join pg_language l on l.oid = p.prolang join pg_namespace s on s.oid = p.pronamespace
 where s.nspname = 'public' and l.lanname = 'plpgsql' and p.proname in (${PLANNED.map((n) => `'${n}'`).join(', ')});
insert into said select 'STILLSQL', coalesce(string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ','), '-')
  from pg_proc p join pg_language l on l.oid = p.prolang join pg_namespace s on s.oid = p.pronamespace
 where s.nspname = 'public' and l.lanname = 'sql' and p.proname in (${PLANNED.filter((n) => n !== 'pk').map((n) => `'${n}'`).join(', ')});
select k || '=' || v from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const say = (k: string): string => said.get(k) ?? 'unsaid';

const [things, inside, enchanted, vessels] = say('THINGS').split('|').map(Number);
check('a pack of everything: things inside a thing, enchanted things, vessels', inside >= 3 && enchanted >= 3 && vessels >= 8,
  `${things} things, ${inside} inside, ${enchanted} enchanted, ${vessels} vessels`);
const same = (k: string, what: string): void => {
  const [a, b] = say(k).split('|');
  check(what, a !== undefined && a === b, say(k));
};
same('WEIGHT', 'what the pack weighs, to the last bit, as every thing in it weighs itself');
same('LIMIT', 'what the back takes, to the last bit, with every Packmule counted');
same('SHARE', 'and the share of it carried');
check('no vehicle and no mount: NULL, not a row of NULLs', say('NONE') === 'true|true', say('NONE'));
check('a mount ridden is the row', say('MOUNT') === 'true|orse', say('MOUNT'));
const planned = say('PLANNED').split(',');
check(`every lookup a step asks is planned once a session (${PLANNED.length})`,
  PLANNED.every((n) => planned.includes(n)), PLANNED.filter((n) => !planned.includes(n)).join(', ') || say('PLANNED'));
check('and none of them is still a SQL function', say('STILLSQL') === '-', say('STILLSQL'));

/* ---- a step still walks, and still stops ---------------------------------- */

const step = psql(`
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '57e90000-0000-4000-8000-0000000000a1'; r jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stepcost', 311, 32, 8, 8, true) returning id into w;
  perform land_blank(w, 32);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 31) x, generate_series(0, 31) y;
  -- A line of trees at x = 20, which nobody walks into.
  perform land_set_tile(w, 20, y, tile_id('Tree')) from generate_series(0, 31) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Pace');
  update player set x = 10.5, y = 10.5, moved_at = now() - interval '1 second', walk_ahead = 0 where world_id = w and uid = u;
  r := rpc_move(w, 11.5, 10.5);
  insert into said values ('OPEN', concat_ws('|', r->>'x', r->>'y', r->>'blocked', r->>'pulled'));
  delete from caller where uid = u;
  update player set x = 18.5, y = 10.5, moved_at = now() - interval '1 second', walk_ahead = 0 where world_id = w and uid = u;
  r := rpc_move(w, 21.5, 10.5);
  insert into said values ('TREES', concat_ws('|', ((r->>'x')::double precision < 20)::text, r->>'blocked'));
end $t$;
select k || '=' || v from said;
rollback;`);
const stepSaid = new Map(step.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
check('a step on open ground goes where it was asked', stepSaid.get('OPEN') === '11.5|10.5|false|false', stepSaid.get('OPEN'));
check('and a step into the trees stops short of them', stepSaid.get('TREES') === 'true|true', stepSaid.get('TREES'));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`what a step costs the island — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

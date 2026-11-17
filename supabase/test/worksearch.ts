/**
 * A worker's search for its next tile (`find_work_tile`), asked over the square it needs and no more.
 *
 * Read off the island: a Snout seeking over its settlement of radius 126 asked `private.work_tile_may` of all 64,009
 * tiles of the square before every dig, a second a time, and found a tile in the first few rings.
 *
 *   * a Snout on a settlement of radius 126 with the middle to dig: that tile, in under `MOST_MS`;
 *   * the middle dug out 40 tiles round: a tile on the nearest ring out from the middle with any to dig, ring by ring
 *     as `worker_gatherable` has it, past the first two bands of the search (16 and 32).
 *
 * Makes its own island and rolls it back.
 */
import { psql, check, finish } from './harness';

const T = 200;
const U = '7e5b0000-0000-4000-8000-000000000b38';
const R = 126;
const DUG = 40;
const MOST_MS = 50;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; m int; c creature; s record; t0 timestamptz; v_ms double precision := 0; i int; v_ring int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Worksearch', 263, 420, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 420);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - R - 2}, ${T + R + 2}) x, generate_series(${T - R - 2}, ${T + R + 2}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Seeker');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Wideland', ${T}, ${T}, ${R}, 5, u);
  update player set x = ${T} + 1.5, y = ${T} + 9.5, body_at = now(), swim_at = now(), seen_at = now() where world_id = w;
  m := creature_spawn(w, 'snout', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set keeper = u, job = 'seek', post = null, around = null where world_id = w and id = m;
  select * into c from creature where world_id = w and id = m;
  for i in 1 .. 3 loop
    t0 := clock_timestamp();
    select * into s from find_work_tile(w, ${T}, ${T}, ${R}, 'seek', c);
    v_ms := greatest(v_ms, extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
  insert into said values ('MIDDLE', s.x || ',' || s.y), ('MS', round(v_ms)::text);
  -- The middle dug out: nothing for a nose there until the marks wear off.
  insert into foraged (world_id, x, y, kind, at)
    select w, ${T} + dx, ${T} + dy, 'dig', now() from generate_series(-${DUG}, ${DUG}) dx, generate_series(-${DUG}, ${DUG}) dy
    on conflict do nothing;
  select min(greatest(abs(dx), abs(dy))) into v_ring from generate_series(-${R}, ${R}) dx, generate_series(-${R}, ${R}) dy
   where greatest(abs(dx), abs(dy)) between ${DUG} and ${DUG + 4} and worker_gatherable(w, ${T} + dx, ${T} + dy, 'seek', c);
  select * into s from find_work_tile(w, ${T}, ${T}, ${R}, 'seek', c);
  insert into said values ('RING', coalesce(greatest(abs(s.x - ${T}), abs(s.y - ${T}))::text, 'none')), ('WANT', coalesce(v_ring::text, 'none')),
    ('OK', coalesce(worker_gatherable(w, s.x, s.y, 'seek', c)::text, 'none'));
end $t$;
select k || chr(9) || coalesce(v, '') from said;
rollback;
`);
const isle = new Map(out.split('\n').filter(Boolean).map((l) => l.split('\t') as [string, string]));

check(`a Snout on a settlement of radius ${R}: the middle tile, in under ${MOST_MS} ms (${isle.get('MS')} ms at the most of three)`,
  isle.get('MIDDLE') === `${T},${T}` && Number(isle.get('MS')) < MOST_MS, `${isle.get('MIDDLE')} in ${isle.get('MS')} ms`);
check(`the middle dug out ${DUG} round: a tile it may dig on the nearest ring with any (${isle.get('WANT')})`,
  isle.get('RING') === isle.get('WANT') && isle.get('WANT') !== 'none' && isle.get('OK') === 'true', `ring ${isle.get('RING')}, ${isle.get('OK')}`);

finish("A worker's search for its next tile");

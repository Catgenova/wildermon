/**
 * A Hoardback's think on a settlement with a full store: well under a second.
 *
 * Reported: players' frames and actions lagging, more each day for a week. One Hoardback (fetch, idle "namedfull")
 * on a settlement with 949 stacks in its stores took 12 s a think, and the clock's round with it. Its store sort
 * (`sort_stack`) read the name of the box of every stack against the whole item list (`private.hoard_items`, about
 * 12 ms a name), and with every container named for what lay about full, `private.hoard_move` asked each named
 * container's room for every stack of the same item.
 *
 *   * a name is for the same items on the island as in the browser (`hoardItems`), for every item's id, name, plural
 *     and plural id, any case;
 *   * a Hoardback on a settlement with 900 stacks of dirt in a chest named "Storage", its only bin full and a chest
 *     named "Dirt" full: idle on "namedfull", in under a second a think, nothing moved.
 *
 * Makes its own island and rolls it back.
 */
import { furnitureCentre, type PlacedFurniture } from '../../src/game/furniture';
import { hoardItems, hoardPlural } from '../../src/game/hoard';
import { ITEM_DEFS } from '../../src/game/items';
import { psql, check, finish } from './harness';

const T = 60;
const U = '7e5b0000-0000-4000-8000-000000000b01';
const STACKS = 900;
const MOST_MS = 1000;

const names = new Set<string>();
for (const [id, d] of Object.entries(ITEM_DEFS)) {
  names.add(id);
  names.add(d.name.toUpperCase());
  names.add(` ${hoardPlural(d.name)} `);
  names.add(hoardPlural(id).toUpperCase());
}
names.add('Storage');
const sq = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const centre = (kind: string, x: number, y: number): string =>
  furnitureCentre({ kind, x, y, sx: 0, sy: 0, facing: 0 } as unknown as PlacedFurniture).join(', ');

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table asked (v text);
insert into asked values ${[...names].map((n) => `(${sq(n)})`).join(', ')};
do $t$
declare w uuid; u uuid := '${U}'; m int; v_store bigint; v_dirt bigint; v_bin bigint; t0 timestamptz; i int; v_ms double precision := 0;
begin
  insert into said select 'FOR:' || v, coalesce(array_to_string(private.hoard_items(v), ','), '') from asked;

  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hoardspeed', 261, 400, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 400);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 30}, ${T + 30}) x, generate_series(${T - 30}, ${T + 30}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Hoarder');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Fullstead', ${T}, ${T}, 10, 5, u);
  update player set x = ${T} + 1.5, y = ${T} + 9.5, body_at = now(), swim_at = now(), seen_at = now() where world_id = w;

  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name)
    values (w, 'furniture', 'chest', ${T - 3}, ${T}, 0, 0, ${centre('chest', T - 3, T)}, 50, u, 'Storage') returning id into v_store;
  insert into item (world_id, holder, placed, def, ql, count)
    select w, 'furniture', v_store, 'dirt', 10 + (g % 80), 1 from generate_series(1, ${STACKS}) g;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name)
    values (w, 'furniture', 'chest', ${T + 4}, ${T}, 0, 0, ${centre('chest', T + 4, T)}, 50, u, 'Dirt') returning id into v_dirt;
  insert into item (world_id, holder, placed, def, ql, count)
    select w, 'furniture', v_dirt, 'dirt', 30, furniture_capacity(p) from placed p where p.id = v_dirt;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'bulk_bin', ${T + 2}, ${T + 4}, 0, 0, ${centre('bulk_bin', T + 2, T + 4)}, 50, u) returning id into v_bin;
  insert into item (world_id, holder, placed, def, ql, count)
    select w, 'furniture', v_bin, 'dirt', 30, furniture_capacity(p) from placed p where p.id = v_bin;

  m := creature_spawn(w, 'magga', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, form_size = null, keeper = u, phase = 'idle', carrying = null, job = 'fetch', post = null, hunger = 1,
         from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5
   where world_id = w and id = m;
  for i in 1 .. 3 loop
    update creature set until = now() - interval '1 millisecond', leg_at = now() - interval '2 milliseconds',
           leg_ends = now() - interval '1 millisecond', hunger = 1
     where world_id = w and id = m;
    t0 := clock_timestamp();
    perform worker_settle(w, m);
    v_ms := greatest(v_ms, extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
  insert into said values ('MS', round(v_ms)::text);
  insert into said select 'IDLE', coalesce(idle_why, '') || '|' || coalesce(job, '') || '|' || coalesce(carrying::text, '') from creature where world_id = w and id = m;
  insert into said select 'LEFT', sum(count)::text from item where placed = v_store;
end $t$;
select k || chr(9) || coalesce(v, '') from said;
rollback;
`);
const isle = new Map(out.split('\n').filter(Boolean).map((l) => l.split('\t') as [string, string]));

const differ = [...names].filter((n) => (isle.get(`FOR:${n}`) ?? '?') !== hoardItems(n).join(','));
check(`a name is for the same items on the island as in the browser, for all ${names.size} ids, names and plurals`,
  differ.length === 0, differ.slice(0, 5).map((n) => `${n}: ${isle.get(`FOR:${n}`)} / ${hoardItems(n).join(',')}`).join('; '));
check('"Storage" is for nothing; "Dirt" is for dirt', isle.get('FOR:Storage') === '' && hoardItems('Dirt').join(',') === 'dirt');
check(`${STACKS} stacks of dirt in "Storage", the bin and "Dirt" full: idle on "namedfull", nothing carried, nothing moved`,
  isle.get('IDLE') === 'namedfull|fetch|' && isle.get('LEFT') === String(STACKS), `${isle.get('IDLE')}, ${isle.get('LEFT')} left`);
check(`its think in under ${MOST_MS} ms (${isle.get('MS')} ms at the most of three)`, Number(isle.get('MS')) < MOST_MS, isle.get('MS'));

finish('A Hoardback on a full store');

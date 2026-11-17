/**
 * A load to a container named for it first, for every worker on its settlement.
 *
 * Asked for: fragments can be sorted into a box named "fragment", all of them. A Snout bringing up a fragment carried it
 * to the nearest store with room, named or not; only a Hoardback used the names (`private.hoard_into`).
 *
 *   * a name is for fragments, every relic's alike, as "fragment", "fragments" or "FRAGMENT", on both sides, and a
 *     relic's own name is not;
 *   * a Snout on its settlement with a fragment of each of two relics: each to the chest named "Fragments", not the
 *     unnamed chest beside it;
 *   * that chest full: to the unnamed chest, as before.
 *
 * Makes its own island and rolls it back.
 */
import { furnitureCentre, type PlacedFurniture } from '../../src/game/furniture';
import { hoardItems } from '../../src/game/hoard';
import { RELICS } from '../../src/game/archaeology';
import { psql, check, finish } from './harness';

const T = 60;
const U = '7e5b0000-0000-4000-8000-000000000b37';
const centre = (kind: string, x: number, y: number): string =>
  furnitureCentre({ kind, x, y, sx: 0, sy: 0, facing: 0 } as unknown as PlacedFurniture).join(', ');
const [A, B] = RELICS;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; m int; v_near bigint; v_named bigint; c creature; r record;
begin
  insert into said values ('ISLE:fragment', array_to_string(private.hoard_items('fragment'), ',')),
    ('ISLE:Fragments', array_to_string(private.hoard_items(' Fragments '), ',')),
    ('ISLE:relic', coalesce(array_to_string(private.hoard_items('${A.name}'), ','), ''));
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Namedfirst', 262, 400, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 400);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 30}, ${T + 30}) x, generate_series(${T - 30}, ${T + 30}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Seeker');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Fragstead', ${T}, ${T}, 10, 5, u);
  update player set x = ${T} + 1.5, y = ${T} + 9.5, body_at = now(), swim_at = now(), seen_at = now() where world_id = w;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${T + 1}, ${T}, 0, 0, ${centre('chest', T + 1, T)}, 50, u) returning id into v_near;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name)
    values (w, 'furniture', 'chest', ${T + 6}, ${T + 6}, 0, 0, ${centre('chest', T + 6, T + 6)}, 50, u, 'Fragments') returning id into v_named;
  m := creature_spawn(w, 'snout', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set keeper = u, job = 'seek', post = null, around = null where world_id = w and id = m;
  select * into c from creature where world_id = w and id = m;
  for r in select * from (values ('${A.name} 1/${A.parts}'), ('${B.name} 2/${B.parts}')) v(extra) loop
    c.carrying := jsonb_build_object('def', 'fragment', 'count', 1, 'ql', 40, 'extra', r.extra);
    insert into said select 'TO:' || r.extra, case s.id when v_named then 'named' when v_near then 'near' else coalesce(s.id::text, 'none') end
      from (select (worker_store(w, c, 'fragment', 1)).id) s;
  end loop;
  -- The named chest full.
  insert into item (world_id, holder, placed, def, ql, count)
    select w, 'furniture', v_named, 'dirt', 30, furniture_capacity(p) from placed p where p.id = v_named;
  insert into said select 'FULL', case s.id when v_named then 'named' when v_near then 'near' else coalesce(s.id::text, 'none') end
    from (select (worker_store(w, c, 'fragment', 1)).id) s;
end $t$;
select k || chr(9) || coalesce(v, '') from said;
rollback;
`);
const isle = new Map(out.split('\n').filter(Boolean).map((l) => l.split('\t') as [string, string]));

check('"fragment", " Fragments " and "FRAGMENT": fragments, on both sides',
  isle.get('ISLE:fragment') === 'fragment' && isle.get('ISLE:Fragments') === 'fragment'
  && hoardItems('fragment').join(',') === 'fragment' && hoardItems(' Fragments ').join(',') === 'fragment' && hoardItems('FRAGMENT').join(',') === 'fragment',
  `${isle.get('ISLE:fragment')} / ${isle.get('ISLE:Fragments')} / ${hoardItems('fragments').join(',')}`);
check(`"${A.name}": not fragments, on both sides`, !(isle.get('ISLE:relic') ?? '').split(',').includes('fragment') && !hoardItems(A.name).includes('fragment'),
  `${isle.get('ISLE:relic')} / ${hoardItems(A.name).join(',')}`);
for (const r of [`${A.name} 1/${A.parts}`, `${B.name} 2/${B.parts}`]) {
  check(`a Snout's fragment (${r}): to the chest named "Fragments", past the unnamed one beside it`, isle.get(`TO:${r}`) === 'named', isle.get(`TO:${r}`));
}
check('"Fragments" full: to the unnamed chest', isle.get('FULL') === 'near', isle.get('FULL'));

finish('A load to a container named for it first');

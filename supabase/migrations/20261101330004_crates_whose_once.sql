-- The crates near you: whose each one is, worked out once for them all rather than once for each.
--
-- Every crate in a ground read says whether it is yours to take from (`mine`, `crate_yours`): your own, or in a
-- settlement whose rank lets you at its stores (`deed_may_at`). That looked up your settlements and your rank in
-- each again for every crate in forty tiles, on every ground read, and the ground read sends every crate every time.
-- Measured on a test island with 25 crates in a settlement, asked by somebody who did not found it: 20 ms of a 69 ms
-- read. The settlements whose stores you may use are the same for every crate, so they are found once
-- (`deeds_of`, `deed_may`), and each crate asks only whether one of them covers it (`deed_covers`): the same answer,
-- key for key (`supabase/test/grounddelta.ts`), for every crate and every body.

set local lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.crates_near(p_world uuid, p_uid uuid, p_range double precision)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  -- The settlements whose stores this body may use (`deed_may_at` for every crate, found once).
  with may as materialized (
    select coalesce(array_agg(d), '{}') as ds from deeds_of(p_world, p_uid) d
     where deed_may(p_world, d.founded_by, p_uid, power_bit('stores')))
  select coalesce((select jsonb_agg((to_jsonb(c) - 'world_id' - 'made_by')
        || jsonb_build_object(
             -- Yours: your own, or covered by a settlement whose stores you may use (`crate_yours`).
             'mine', coalesce(c.made_by = p_uid, true) or exists (select 1 from unnest(may.ds) d where deed_covers(d, c.x, c.y)),
             -- How full it is, for every crate in sight: a label does not need
             -- the contents and the contents are not free.
             /*
              * How full it is, counted once for the lot rather than once for
              * each of them.
              *
              * `crate_units` is a `sum` over `item`, and this ran it as a
              * correlated subquery for every crate within forty tiles, on
              * every ground read, for every player — a second apart. One
              * grouped pass over the same index answers all of them, and the
              * answer is the same answer.
              */
             'units', coalesce(u.units, 0),
             -- And what is actually in it, for the ones you could reach into.
             -- You must be within two and a half tiles to put anything in or
             -- take anything out, so six is generous and keeps a yard full of
             -- crates from costing a phone a hundred kilobytes every three
             -- seconds.
             'things', case when greatest(abs(crate_centre_x(c) - p.x), abs(crate_centre_y(c) - p.y)) <= 6
               then coalesce((select jsonb_agg(jsonb_build_object(
                     'id', i.id, 'def', i.def, 'ql', i.ql, 'dmg', i.dmg,
                     'count', i.count, 'extra', i.extra,
                     -- And its rarity, its colour and its enchantment, as a chest's (`storedThing`).
                     'rare', i.rare, 'dye', i.dye, 'enchant', i.enchant, 'creature', i.creature, 'occupant', case when i.creature is not null then occupant_name(i.world_id, i.creature) end) order by i.id)
                   from item i where i.world_id = p_world and i.holder = 'crate' and i.crate = c.id),
                 '[]'::jsonb)
               else '[]'::jsonb end) order by c.id)
      from crate c
      left join (select i.crate, sum(i.count)::int as units
                   from item i
                  where i.world_id = p_world and i.holder = 'crate'
                  group by i.crate) u on u.crate = c.id
      where c.world_id = p_world
        -- The box first, for `crate_near`; the exact question after it. See
        -- the note in `rpc_ground`.
        and c.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and c.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(c.x + 0.5 - p.x), abs(c.y + 0.5 - p.y)) <= p_range), '[]'::jsonb)
    from player p, may where p.world_id = p_world and p.uid = p_uid
$function$;

select private.lock_doors();

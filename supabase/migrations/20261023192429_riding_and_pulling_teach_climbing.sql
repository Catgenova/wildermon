set local lock_timeout = '3s';

-- Asked for: "fix it so riding and pulling teach climbing". A Thistlekit's, a Gorral's and a Shaggan's level is its
-- climbing (`haul_skill`), and the island never paid it: `rpc_move` let the mount carry its rider and the team pull the
-- wagon, and taught the rider their driving and a Cartling its own, and the beast whose level is climbing nothing.
--
-- Now every tile gone into on the ground, as the walk's climbing reads them (`walk_climbs`), is a go of climbing
-- (`worker_learn`) at `haul_learn_of` its rise: `haul_learn` on the flat, and one more for every `haul_learn_rise` of
-- height between the two tiles' centres, to `haul_learn_steep` more -- the browser's `haulLearn`. Paid to the mount
-- under its rider, and to every beast in the traces of a cart that is pulled whose kind keeps climbing there: not one
-- that learns its own skill by pulling (`learns_by` 'pull'), which has that already.

create or replace function haul_learn_of(p_rise double precision) returns double precision
  language sql immutable as $$ select haul_learn() + least(haul_learn_steep(), abs(p_rise) / haul_learn_rise()) $$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- The mount, for the tiles it carried its rider into.
    (1, $$  if cart.id is not null and p_level = 0 and p.level = 0 then
    v_tiles :=$$,
     $$  /*
   * And what a saddle teaches the beast under it: a go of climbing a tile it carries its rider into, more for a
   * steeper one (`haul_learn_of`). On the ground only, as the walk's own climbing.
   */
  if beast.id is not null and p_level = 0 and p.level = 0 then
    foreach c in array walk_climbs(p_world, p.x, p.y, p_x, p_y) loop
      perform worker_learn(p_world, beast.id, haul_skill(), haul_learn_of(c));
    end loop;
  end if;
  if cart.id is not null and p_level = 0 and p.level = 0 then
    v_tiles :=$$),
    -- The team, for the tiles it pulled the cart into.
    (2, $$        update creature t set gear = gear_wear(p_world, t, 'harness', v_tiles)
         where t.world_id = p_world and t.hitched_to = cart.id and t.gear ? 'harness';
$$,
     $$        update creature t set gear = gear_wear(p_world, t, 'harness', v_tiles)
         where t.world_id = p_world and t.hitched_to = cart.id and t.gear ? 'harness';
        -- And climbing, a go a tile and more for a steeper one, to every beast in them that keeps climbing in the traces.
        foreach c in array walk_climbs(p_world, p.x, p.y, p_x, p_y) loop
          for v_puller in select t.* from team_of(p_world, cart.id) t join species_def sd on sd.id = t.species
                           where sd.learns_by is distinct from 'pull' loop
            perform worker_learn(p_world, v_puller.id, haul_skill(), haul_learn_of(c));
          end loop;
        end loop;
$$)
  ) as t(ord, old, new) order by ord loop
    v_def := pg_get_functiondef('rpc_move'::regproc);
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'rpc_move has % of change %, not 1', v_n, r.ord; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();

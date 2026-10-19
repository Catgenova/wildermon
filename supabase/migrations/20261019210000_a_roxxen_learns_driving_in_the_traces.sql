-- A Roxxen learns driving in the traces, and its level is its driving.
--
-- Asked for: "Roxxen need to have the Driving trade and gain experience in it when pulling a large cart or wagon".
-- A Roxxen had no trade: it was a draught beast, and what a draught beast keeps is climbing (`haul_skill`), which is
-- its level and what a team's pace and the steepest step its wheels take read (`team_climb`, through `beast_climb`).
-- Now it learns its own skill, driving, the way a kind with no trade does (`species_def.learns`, `learns_by`), and
-- what teaches it is new: pulling (`learns_by` 'pull', which the defs after this set on the Roxxen).
--
-- `rpc_move` pays it. Every tile the cart under its driver goes into is already a go of Driving for the driver
-- (`driving_learn`), and only when the team is pulling it (`vehicle_speed` over nothing). Each of those tiles is now
-- also a go for every beast in its traces whose kind learns by pulling, at `learns_gain_pull` -- the same base the
-- driver is paid, as the browser has it (`PULL_LEARN`). Only a large cart or a wagon has traces at all
-- (`vehicle_def`), a hull has none, and a beast standing still is paid nothing because no tile was gone into.
--
-- The job climbing did in the traces is not lost with it: `beast_climb` reads a kind's own skill in climbing's place
-- for a kind that learns by pulling (`tracesSkill` in the browser), so a Roxxen's driving sets the team's pace and
-- pitch as its climbing did.
--
-- And nobody's Roxxen comes out of this a level lower: whatever climbing one had is its driving now, the higher of the
-- two where it somehow has both, and the climbing goes. One update of the Roxxen alone, on rows that have climbing --
-- on an island that has never paid a beast climbing that is few or none.

-- What the definitions bring in, ahead of them, so the doors below close on it: the number (`LEARNS_GAIN.pull`, which
-- is `PULL_LEARN`, which is `DRIVING_LEARN`), which the definitions that come in after this write again from the
-- browser's.
set local lock_timeout = '3s';
create or replace function learns_gain_pull() returns double precision language sql immutable as $fn$ select 0.003::double precision $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A kind that learns by pulling: a go at `learns_gain_pull`.
    (1, 'beast_learns',
     $$when 'out' then learns_gain_out() else learns_gain_dark() end$$,
     $$when 'out' then learns_gain_out() when 'pull' then learns_gain_pull() else learns_gain_dark() end$$, 1),
    -- What a beast keeps in the traces: its kind's own skill for a kind that learns by pulling, climbing for the rest.
    (2, 'beast_climb',
     $$(c.skills->>haul_skill())$$,
     $$(c.skills->>coalesce((select sd.learns from species_def sd where sd.id = c.species and sd.learns_by = 'pull'), haul_skill()))$$, 1),
    (3, 'rpc_move',
     $$cart placed; beast creature; c double precision; v_tiles int;$$,
     $$cart placed; beast creature; c double precision; v_tiles int; v_puller creature;$$, 1),
    (4, 'rpc_move',
     $$                            case when is_boat(cart) then sailing_learn() else driving_learn() end);
      end loop;
$$,
     $$                            case when is_boat(cart) then sailing_learn() else driving_learn() end);
      end loop;
      /*
       * And each of the same tiles is a go for every beast in the cart's traces whose kind learns its own skill by
       * pulling, a Roxxen its driving (`beast_learns` 'pull', `learns_gain_pull`), as the browser pays it in a game
       * of its own. A hull has no traces; only a large cart or a wagon does.
       */
      if not is_boat(cart) then
        for v_puller in select t.* from team_of(p_world, cart.id) t join species_def sd on sd.id = t.species
                         where sd.learns_by = 'pull' loop
          for i in 1 .. v_tiles loop
            perform beast_learns(p_world, v_puller.id, 'pull');
          end loop;
        end loop;
      end if;
$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn and strpos(pg_get_functiondef(p.oid), r.old) > 0;
    if v_def is null then raise exception '% has no change %', r.fn, r.ord; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

-- Every Roxxen's climbing is its driving now, so none drops a level (`carriedSkills` does the same to a saved game).
update creature
   set skills = (skills - 'climbing')
     || jsonb_build_object('driving', greatest(coalesce((skills->>'driving')::double precision, 0), (skills->>'climbing')::double precision))
 where species = 'roxxen' and skills ? 'climbing';

select private.lock_doors();

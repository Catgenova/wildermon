-- A worker set to work far from its ground walks back to it, a short leg at a time, before it takes any job.
--
-- Reported: "I had sent a Tinka home to work on the deed from about 300 tiles away, but it didnt move and I couldn't
-- select it". Assigned, a wildermon stays where it is (`perform_creature`'s assign_deed) and the settle loop takes it
-- from there, and nothing in that loop walks a worker home: a gathering trade that finds nothing wanders three tiles
-- round the token in one leg, which from three hundred tiles is a leg no player near it can see (`rpc_creatures`
-- looks for legs ending within `leg_slack` of them), and an errand trade such as a Tinka's mending, finding nothing
-- within its range of the token from out there, stood where it was for ever.
--
-- Now, between jobs, a worker more than `home_slack` tiles past the edge of the ground it works round its token (or
-- work post) walks towards it first, `home_leg` tiles a leg, round what stands in the way where a straight line is
-- blocked (`chase_leg`), and takes up its trade from there; an errand trade with nothing to run there wanders the rest
-- of the way in, to within three tiles of the token, as every other trade does when it has nothing to do.

set local lock_timeout = '3s';

create or replace function home_leg() returns double precision language sql immutable as $fn$ select 2::double precision $fn$;
-- How far past the edge of the ground it works it may be before it walks home: a store on a settlement wider than its
-- range, and the tile beside a tile it works, are this side of it.
create or replace function home_slack() returns double precision language sql immutable as $fn$ select 8::double precision $fn$;

do $do$
declare v_def text;
  v_old text := '    if fight_trade(kind) and c.phase = ''idle'' and c.carrying is not null then';
  v_new text := '    /*
     * Off its ground: it walks back to it before anything else, a short leg at a time (`home_leg`), so that every leg
     * stays one a player beside it is told of.
     */
    if c.phase = ''idle'' and greatest(abs(v_site.x + 0.5 - cx), abs(v_site.y + 0.5 - cy)) > v_site.radius + home_slack() then
      dist := sqrt((v_site.x + 0.5 - cx) ^ 2 + (v_site.y + 0.5 - cy) ^ 2);
      select * into v_step from chase_leg(p_world, cx, cy,
        cx + (v_site.x + 0.5 - cx) * home_leg() / dist, cy + (v_site.y + 0.5 - cy) * home_leg() / dist);
      if v_step.x is null then
        c.from_x := cx; c.from_y := cy;
        c.leg_at := now(); c.leg_ends := now();
        c.until := now() + interval ''4 seconds'';
        exit;
      end if;
      c.from_x := cx; c.from_y := cy; c.to_x := v_step.x; c.to_y := v_step.y;
      c.leg_at := c.until;
      c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, sqrt((c.to_x - cx) ^ 2 + (c.to_y - cy) ^ 2) / greatest(0.1, pace)));
      c.until := c.leg_ends;
      continue;
    end if;

' || v_old;
begin
  select pg_get_functiondef('public.worker_settle'::regproc) into v_def;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'worker_settle does not take a fighter''s load home where it was expected to';
  end if;
  v_def := replace(v_def, v_old, v_new);

  -- And an errand trade with nothing to run, on the edge of its ground or past it, wanders in round the token as the
  -- other trades do, instead of standing where it was.
  v_old := '          -- Nothing to run. Replaying an afternoon of that produces nothing.
          c.from_x := cx; c.from_y := cy;
          c.leg_at := now(); c.leg_ends := now();';
  v_new := '          -- Nothing to run. Replaying an afternoon of that produces nothing.
          c.from_x := cx; c.from_y := cy;
          -- Off its ground, it wanders back in round the token while it waits, as a trade with nothing to gather does.
          if greatest(abs(v_site.x + 0.5 - cx), abs(v_site.y + 0.5 - cy)) > v_site.radius then
            c.to_x := v_site.x + 0.5 + (hash_tile(p_id, guard, 601) * 2 - 1) * 3;
            c.to_y := v_site.y + 0.5 + (hash_tile(p_id, guard, 701) * 2 - 1) * 3;
            if not creature_tile_ok(p_world, floor(c.to_x)::int, floor(c.to_y)::int) then
              c.to_x := cx; c.to_y := cy;
            end if;
            c.leg_at := now();
            c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, sqrt((c.to_x - cx) ^ 2 + (c.to_y - cy) ^ 2) / greatest(0.1, pace)));
            c.until := c.leg_ends + interval ''4 seconds'';
            exit;
          end if;
          c.leg_at := now(); c.leg_ends := now();';
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'worker_settle does not wait out an empty errand where it was expected to';
  end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();

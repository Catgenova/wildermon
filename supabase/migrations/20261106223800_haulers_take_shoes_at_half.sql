-- Haulers take shoes, at half a mount's.
--
-- Asked for: "Allow shoeing haulers at half bonus". A draught beast (a Cartling, a Wagonox, a Haulhorn) takes shoes as
-- a mount does: four horseshoes and a mallet, a week. In a vehicle's traces a shod beast is worth `haul_shoe_share`
-- of a mount's shoes, at its share of the team (`shod_share`): that share of `shoe_pace`'s gain on laid stone, under
-- the cap as a mount's shoes are, and of `shoe_step` on the step the vehicle takes. The browser's `shoeTeam`,
-- `shoeTeamStep` and `shoeable`.

set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

-- How much of a vehicle's team is shod, 0 to 1.
create or replace function public.shod_share(p_world uuid, p_id bigint) returns double precision
language sql stable as $fn$
  select coalesce(count(*) filter (where shod(t))::double precision / nullif(count(*), 0), 0) from team_of(p_world, p_id) t
$fn$;

select pg_temp.patch_fn('public.vehicle_speed(uuid,bigint)'::regprocedure,
  $o$    (sum_pace / n) * pull * worst * footing(team_climb(p_world, p_id)) * roll_ease(p.material)) * mark_of(p.mark, 'speed')$o$,
  $n$    (sum_pace / n) * pull * worst * footing(team_climb(p_world, p_id)) * roll_ease(p.material)
    -- And its shod beasts, on laid stone, at half a mount's shoes (`shoeTeam`).
    * case when paved(land_tile(p_world, p.x, p.y)) then 1 + (shoe_pace() - 1) * haul_shoe_share() * shod_share(p_world, p_id) else 1 end)
    * mark_of(p.mark, 'speed')$n$);

select pg_temp.patch_fn('public.vehicle_step(uuid,bigint)'::regprocedure,
  $o$  select max_step() / 2 + team_climb(p_world, p_id) * climb_pitch()$o$,
  $n$  select max_step() / 2 + team_climb(p_world, p_id) * climb_pitch() + shoe_step() * haul_shoe_share() * shod_share(p_world, p_id)$n$);

select pg_temp.patch_fn('public.ride_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$      if d.mount is null then return 'Mounts only.'; end if;$o$,
  $n$      if d.mount is null and not coalesce(d.draught, false) then return 'Mounts and draught beasts only.'; end if;$n$);

select private.lock_doors();

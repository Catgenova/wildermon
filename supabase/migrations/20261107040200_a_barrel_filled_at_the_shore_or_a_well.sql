-- A barrel filled with water where it stands.
--
-- Asked for: "No logical way to fill a barrel. Allow it to be filled at a well or water". Fill with water on a barrel
-- (`fill_barrel`): to the brim from a shore within a tile of you (`near_water`), or else as much as the fullest well or
-- fountain within reach has (`vessels_near`, a well's). Not a well, not while it ferments, not over another liquid. It
-- teaches nothing, like the rest of the pouring. The browser's `fill_barrel` and `fillBarrelReason`.

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

-- The well a barrel is filled from when there is no shore beside you: the fullest within reach with water in it (`wellFor`).
create or replace function private.well_for(p_world uuid, p_uid uuid) returns placed
language sql stable as $fn$
  select v.* from vessels_near(p_world, p_uid, 'water') v where is_well(v) limit 1
$fn$;

select pg_temp.patch_fn('public.liquid_action(text)'::regprocedure,
  $o$'pour_into_barrel', 'leach_lye',$o$,
  $n$'pour_into_barrel', 'leach_lye', 'fill_barrel',$n$);

select pg_temp.patch_fn('public.teaches_nothing(text)'::regprocedure,
  $o$'empty_vessel', 'pour_into_barrel')$o$,
  $n$'empty_vessel', 'pour_into_barrel', 'fill_barrel')$n$);

select pg_temp.patch_fn('public.liquid_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'empty_vessel' then$o$,
  $n$  elsif p_action = 'fill_barrel' then
    if not holds_liquid(p) or is_well(p) then return 'Not a barrel.'; end if;
    if is_working(p) then return 'Still fermenting.'; end if;
    if placed_litres(p) > 0 and coalesce(placed_liquid(p), 'water') <> 'water' then
      return 'Holds ' || (select name from liquid_def where id = placed_liquid(p)) || ': empty it first.';
    end if;
    if liquid_capacity(p) - placed_litres(p) < 1 then return 'Already full.'; end if;
    if not near_water(p_world, p_uid) and (private.well_for(p_world, p_uid)).id is null then
      return 'Need water: shore or well.';
    end if;

  elsif p_action = 'empty_vessel' then$n$);

select pg_temp.patch_fn('public.perform_liquid(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'empty_vessel' then$o$,
  $n$  elsif p_action = 'fill_barrel' then
    if liquid_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
    if not near_water(p_world, p_uid) then v_from := private.well_for(p_world, p_uid); end if;
    v_had := placed_litres(p);
    v_n := floor(liquid_capacity(p) - v_had)::int;
    if v_from.id is not null then v_n := least(v_n, floor(placed_litres(v_from))::int); end if;
    if v_n <= 0 then return; end if;
    if v_from.id is not null and not draw_from(v_from.id, v_n) then return; end if;
    update placed set litres = v_had + v_n, liquid = 'water', knack = null, dye = null, aged_from = null, since = now()
      where id = p.id;
    perform tell(p_world, p_uid, 'Filled: ' || v_n || ' L water into the ' || lower(placed_name(p)) || ', from the '
      || case when v_from.id is not null then lower(placed_name(v_from)) else 'shore' end || '. '
      || to_char(v_had + v_n, 'FM990') || '/' || to_char(liquid_capacity(p), 'FM990') || '.', 'event');

  elsif p_action = 'empty_vessel' then$n$);

select private.lock_doors();

-- Lye one ash a litre, and in a barrel too.
--
-- Asked for: "Making lye requires 1 unit of ash per L. Allow lye to be made in barrels as well as buckets". The bucket's
-- recipe takes an ash a litre of its water (the definitions, `make_lye`); and a barrel of water is leached in place
-- (`leach_lye`): every litre of water in it, one ash a litre (`private.lye_ash_for`), out of the pack, a bag or a store
-- within reach, at the bucket's difficulty. Not in a well or a fountain. A failure damages the ashes drawn and leaves the
-- water as it was. The browser's `leach_lye` and `leachLyeReason`.

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

-- Ashes it takes to turn so many litres of water into lye: one a litre, a part litre a whole ash (`lyeAshFor`).
create or replace function private.lye_ash_for(p_litres double precision) returns int
language sql immutable as $fn$ select ceil(p_litres * lye_ash_per_litre() - 1e-9)::int $fn$;

select pg_temp.patch_fn('public.liquid_action(text)'::regprocedure,
  $o$                      'empty_vessel', 'drink_from_vessel', 'pour_into_barrel',$o$,
  $n$                      'empty_vessel', 'drink_from_vessel', 'pour_into_barrel', 'leach_lye',$n$);

select pg_temp.patch_fn('public.liquid_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'empty_vessel' then$o$,
  $n$  elsif p_action = 'leach_lye' then
    if not holds_liquid(p) or is_well(p) then return 'Not a barrel.'; end if;
    if is_working(p) then return 'Still fermenting.'; end if;
    if coalesce(placed_liquid(p), '') <> 'water' or placed_litres(p) <= 0 then return 'Needs water.'; end if;
    if craft_count(p_world, p_uid, 'ash') < private.lye_ash_for(placed_litres(p)) then
      return 'Need ' || private.lye_ash_for(placed_litres(p)) || ' × ashes; have ' || craft_count(p_world, p_uid, 'ash') || '.';
    end if;

  elsif p_action = 'empty_vessel' then$n$);

select pg_temp.patch_fn('public.perform_liquid(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'empty_vessel' then$o$,
  $n$  elsif p_action = 'leach_lye' then
    if liquid_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
    v_had := placed_litres(p);
    v_n := private.lye_ash_for(v_had);
    v_ql := coalesce((select i.ql from craft_stock(p_world, p_uid) h join item i on i.id = h.id
                       where h.def = 'ash' order by h.draw limit 1), 20);
    -- Failed: the ashes drawn are damaged by their QL, and the water stays water.
    if not skill_check(skill_of(p_world, p_uid, 'alchemy'),
                       (select r.difficulty from recipe r where r.id = 'make_lye'), 0) then
      perform skill_raise(p_world, p_uid, 'alchemy', try_gain(false));
      perform tell(p_world, p_uid, fail_damaged_said('Failed: lye.', craft_fail_damage(p_world, p_uid, 'ash', v_n)), 'event');
      return;
    end if;
    if not craft_consume(p_world, p_uid, 'ash', v_n) then return; end if;
    update placed set liquid = 'lye', knack = null, since = now(),
        ql = greatest(1, least(100, (v_ql + skill_of(p_world, p_uid, 'alchemy')) / 2))
      where id = p.id;
    perform skill_raise(p_world, p_uid, 'alchemy', try_gain(true));
    perform tell(p_world, p_uid, 'Lye: ' || round(v_had::numeric, 1)::double precision || ' L in the '
      || lower(placed_name(p)) || '. Ashes: ' || v_n || '.', 'event');

  elsif p_action = 'empty_vessel' then$n$);

select private.lock_doors();

-- Food with the starting kit: cheese, a full food bar's worth, on a first coming ashore.
--
-- Asked: food in the starter kit, so a new player is fed through their first hour before a campfire is up. Given
-- beside the stake (`starter_kit`, the first coming ashore only), not issued and not in `kit_topup`: food is eaten,
-- and a kit piece missing is given again on every coming ashore and waking, so food there would be food for nothing
-- at every refresh. The browser's `STARTER_FOOD` and `STARTER_FOOD_COUNT` (game.ts): as many as Eat takes to fill the
-- bar from empty at the kit's QL, `food` × (0.7 + QL/200) each (`perform_item`'s eat); supabase/test/kit.ts holds the
-- two sides to each other.

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

select pg_temp.patch_fn('public.starter_kit(uuid, uuid)'::regprocedure,
  $o$  values (p_world, 'player', p_uid, 'deed_stake', 50, 'Pine');$o$,
  $n$  values (p_world, 'player', p_uid, 'deed_stake', 50, 'Pine');
  -- And food, the first time only: a full food bar of cheese at the kit's QL (`STARTER_FOOD`).
  insert into item (world_id, holder, holder_uid, def, ql, count)
  values (p_world, 'player', p_uid, 'cheese', 20, 5);$n$);

select private.lock_doors();

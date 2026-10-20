-- The island says "wildermon crate" where it said "creature crate".
--
-- Asked for: 'Everywhere change "per go" to "per action". Identify other potentially ambiguous verbiage.' The
-- ambiguous terms were listed, and the answer was "Do them all": a tamed animal is a wildermon, so the crate one is
-- shut in is a wildermon crate (the item's name in the definitions; `creature_crate` stays its id). These are the
-- refusals and lines the island writes itself with the name typed in.
--
-- Text only: no rule, number or behaviour changes.

set local lock_timeout = '3s';

do $do$
declare r record; v_def text; v_n int := 0;
begin
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ~* 'creature crate'
      and p.proname = any (array['artifact_refusal', 'class_spell_cast', 'companion_swap', 'crate_open_refusal',
        'creature_refusal', 'drop_young', 'fire_refusal', 'occupied_crate_stays', 'perform_creature',
        'perform_settlement', 'perform_trap', 'ride_refusal', 'rpc_work_deliver', 'tame_room_refusal',
        'team_out_crate', 'team_out_refusal'])
  loop
    v_def := replace(replace(pg_get_functiondef(r.oid), 'creature crate', 'wildermon crate'), 'Creature crate', 'Wildermon crate');
    if v_def ~* 'creature crate' then raise exception '%: creature crate left after the rename', r.proname; end if;
    execute v_def;
    v_n := v_n + 1;
  end loop;
  if v_n <> 16 then raise exception 'expected 16 functions saying creature crate, found %', v_n; end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname in ('public', 'private') and p.prosrc ~* 'creature crate') then
    raise exception 'a function still says creature crate';
  end if;
end
$do$;

select private.lock_doors();

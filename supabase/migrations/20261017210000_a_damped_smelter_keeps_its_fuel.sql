-- A damped smelter keeps its fuel, not its wood.
--
-- Reported: damping a smelter said "You smother the fire. The wood is saved
-- for later." -- the campfire's line, said for a smelter and a kiln too,
-- whatever they were burning. Each now says what it is and how long the fuel
-- left in it burns, as the browser does: "You damp the smelter down. Its 2.5
-- hours of fuel keeps for later."

do $do$
declare v_def text; v_n int;
  v_old text := $$    perform tell(p_world, p_uid, 'You smother the fire. The wood is saved for later.', 'event');$$;
  v_new text := $$    perform tell(p_world, p_uid, case p_action
        when 'damp_smelter' then 'You damp the smelter down.'
        when 'damp_kiln' then 'You close the kiln down and let it cool.'
        else 'You smother the fire.' end
      || ' Its ' || burns_for(p.fuel / placed_burn_rate(p)) || ' of fuel keeps for later.', 'event');$$;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'perform_fire';
  if v_def is null then raise exception 'perform_fire is not on this island'; end if;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_fire has % of the line to change, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();

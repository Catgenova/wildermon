set local lock_timeout = '3s';

-- A wildermon crate in a store says who is in it.
--
-- Asked for: "Add wildermon names to wildermon crates when in all storage spots like stalls". A piece's things, a
-- crate's things and a shop counter's goods carried the crate's item and not the wildermon in it, and a buyer's
-- browser knows nothing of somebody else's wildermon: each now carries the crate's `creature` and its name
-- (`occupant`), the browser's `storedThing` and `Item.occupant`.
create or replace function occupant_name(p_world uuid, p_creature int) returns text language sql stable as $fn$
  select c.name from creature c where c.world_id = p_world and c.id = p_creature
$fn$;

do $do$
declare v_def text; v_n int; i int;
  v_fix text[][] := array[
    array['rpc_ground', '''enchant'', i.enchant) order by i.id)',
      '''enchant'', i.enchant, ''creature'', i.creature, ''occupant'', case when i.creature is not null then occupant_name(i.world_id, i.creature) end) order by i.id)'],
    array['crates_near', '''enchant'', i.enchant) order by i.id)',
      '''enchant'', i.enchant, ''creature'', i.creature, ''occupant'', case when i.creature is not null then occupant_name(i.world_id, i.creature) end) order by i.id)'],
    array['counter_json', '''creature'', i.creature, ''enchant'', i.enchant) order by i.id)',
      '''creature'', i.creature, ''occupant'', case when i.creature is not null then occupant_name(i.world_id, i.creature) end, ''enchant'', i.enchant) order by i.id)']];
begin
  for i in 1 .. array_length(v_fix, 1) loop
    v_def := pg_get_functiondef(v_fix[i][1]::regproc);
    v_n := (length(v_def) - length(replace(v_def, v_fix[i][2], ''))) / length(v_fix[i][2]);
    if v_n <> 1 then raise exception '% has % of %', v_fix[i][1], v_n, v_fix[i][2]; end if;
    execute replace(v_def, v_fix[i][2], v_fix[i][3]);
  end loop;
end $do$;

select private.lock_doors();

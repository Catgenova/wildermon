-- Every blacksmithing job takes a hammer.
--
-- Reported by a player: "i've yet to use a hammer to do so and have been smithing by sheer force of will". Asked: all
-- smithing needs a hammer. Firing a mould takes one through its recipe (`recipe.tool`, from the browser's
-- `MOULD_RECIPES` in the definitions); pouring a mould, casting an anvil, smithing a casting, striking coins and fitting
-- a padlock answer before the general tool check (`act_refusal_rules`), so each says it here, in the browser's words
-- and order (`SMITH_TOOL`).

set local lock_timeout = '3s';

create or replace function smith_tool() returns text language sql immutable as $fn$ select 'hammer' $fn$;

do $do$
declare r record; v_def text; v_n int;
  v_ham constant text := $$if need_tool(p_world, p_uid, smith_tool()) is not null then return need_tool(p_world, p_uid, smith_tool()); end if;$$;
begin
  for r in select * from (values
    ('forge_refusal',
     $$  if not near_piece(p_world, p_uid, p) then return 'Stand at the anvil.'; end if;$$,
     $$  if not near_piece(p_world, p_uid, p) then return 'Stand at the anvil.'; end if;
  $$ || v_ham),
    ('firing_refusal',
     $$    if d.makes = 'anvil' then return 'Use Cast an anvil.'; end if;$$,
     $$    if d.makes = 'anvil' then return 'Use Cast an anvil.'; end if;
    $$ || v_ham),
    ('firing_refusal',
     $$    if pack_count(p_world, p_uid, 'anvil_mould') <= 0 then return 'Need an anvil mould.'; end if;$$,
     $$    if pack_count(p_world, p_uid, 'anvil_mould') <= 0 then return 'Need an anvil mould.'; end if;
    $$ || v_ham),
    ('lock_refusal_for',
     $$      return 'Need a padlock: forge one at a smelter.';
    end if;$$,
     $$      return 'Need a padlock: forge one at a smelter.';
    end if;
    $$ || v_ham),
    ('gate_lock_refusal',
     $$      return 'Need a padlock: forge one at a smelter.';
    end if;$$,
     $$      return 'Need a padlock: forge one at a smelter.';
    end if;
    $$ || v_ham)
  ) as t(fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of the lines to change, not 1', r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();

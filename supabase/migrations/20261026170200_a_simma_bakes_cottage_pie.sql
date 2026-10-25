/*
 * A simma bakes cottage pie too: the island's list of what a cook works
 * through (`tend_recipes('cook')`), in the browser's order (`cookRecipes`).
 */
set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_n int;
begin
  v_def := pg_get_functiondef('tend_recipes'::regproc);
  v_old := $$'make_cherry_preserves', 'make_stew'$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'tend_recipes has % of its cherry preserves and stew, not 1', v_n; end if;
  execute replace(v_def, v_old, $$'make_cherry_preserves', 'make_cottage_pie', 'make_stew'$$);
end $do$;

select private.lock_doors();

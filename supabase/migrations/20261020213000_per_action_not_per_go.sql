-- "Per go" is "per action" now, in the island's words as in the browser's (`enchanting.ts`).
--
-- Asked for: 'Everywhere change "per go" to "per action".' The one line the island writes itself is a knackstone's
-- worn enchantment (`enchant_line`); the rest of the text that says it comes from the definitions.

set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text := $$'Worn: knack chance per go +{v}.'$$; v_n int;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'enchant_line';
  if v_def is null then raise exception 'enchant_line is not there'; end if;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'enchant_line has % of the knackstone line, not 1', v_n; end if;
  execute replace(v_def, v_old, $$'Worn: knack chance per action +{v}.'$$);
end $do$;

select private.lock_doors();

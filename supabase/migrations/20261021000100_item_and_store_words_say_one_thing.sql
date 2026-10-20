-- The island's item, crate, store and crafting lines in the words the browser uses now.
--
-- Asked for: 'Everywhere change "per go" to "per action". Identify other potentially ambiguous verbiage.' and, of the
-- list that came back, "Do them all". This is the island's half of the items, crates, stores and crafting:
--   a deed crate and deed workers are a settlement crate and settlement workers, and the token is the totem;
--   a creature crate is a wildermon crate (it holds one wildermon and nothing else);
--   a settlement store says it is one ("settlement store of Hearth");
--   a maker's mark that lengthens a meal's or a drink's boost says so, not "knack" (that is the skill-gain knack),
--   and a gem's mark names its stone's skill, not a "trade", per action, not "every go";
--   Examine of a vessel says "Quality" for QL;
--   a failed Improve says the damage as "N damage".
-- Item, furniture, recipe and material texts reach the island through the definitions.
--
-- Each line is patched where it stands (`pg_get_functiondef`, one anchor each, asserted to occur exactly once), so
-- the rest of every function is left as it is.

set local lock_timeout = '3s';

do $do$
declare
  v_patch text[][] := array[
    -- [function, old, new]
    ['crate_name', $$'Deed crate ('$$, $$'Settlement crate ('$$],
    ['crate_refusal', $$'Not on the token.'$$, $$'Not on the totem.'$$],
    ['perform_crate', $$' Deed workers leave their finds by the token until a deed crate is set down.'$$,
                      $$' Settlement workers leave their finds by the totem until a settlement crate is set down.'$$],
    ['perform_last', $$'. Deed workers called: '$$, $$'. Settlement workers called: '$$],
    ['counter_no_pieces_said', $$'No furniture on a counter (creature crates allowed).'$$,
                               $$'No furniture on a counter (wildermon crates allowed).'$$],
    ['furniture_refuses', $$'Creature crates go on a stall only.'$$, $$'Wildermon crates go on a stall only.'$$],
    ['store_refusal', $$': store of '$$, $$': settlement store of '$$],
    ['store_move_said', $$': store of '$$, $$': settlement store of '$$],
    ['rpc_store_mark', $$': already a store of '$$, $$': already a settlement store of '$$],
    ['vessel_says', $$': QL ' || to_char(p.ql, 'FM990.00')$$, $$': Quality ' || to_char(p.ql, 'FM990.00')$$],
    ['mark_says', $$'gives a knack that lasts '$$, $$'gives a meal or drink boost that lasts '$$],
    ['mark_says', $$'% more than a plain setting on its stone''s trade'$$, $$'% more than a plain setting on its stone''s skill'$$],
    ['mark_says', $$'% more skill from every go at its stone''s trade, by its quality'$$,
                  $$'% more skill from every action in its stone''s skill, by its quality'$$],
    ['perform_item', $$'Improve failed: ' || v_name || ' damage '
        || to_char((select dmg from item where id = v_it.id), 'FM990.0') || '.'$$,
                     $$'Improve failed: ' || v_name || ', '
        || to_char((select dmg from item where id = v_it.id), 'FM990.0') || ' damage.'$$]
  ];
  v_fns text[];
  v_fn text;
  v_def text;
  v_n int;
  i int;
begin
  select array_agg(distinct v_patch[k][1]) into v_fns from generate_subscripts(v_patch, 1) k;
  foreach v_fn in array v_fns loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = v_fn;
    if v_def is null then raise exception '% is not there', v_fn; end if;
    for i in 1 .. array_length(v_patch, 1) loop
      continue when v_patch[i][1] <> v_fn;
      v_n := (length(v_def) - length(replace(v_def, v_patch[i][2], ''))) / length(v_patch[i][2]);
      if v_n <> 1 then raise exception '% has % of %, not 1', v_fn, v_n, v_patch[i][2]; end if;
      v_def := replace(v_def, v_patch[i][2], v_patch[i][3]);
    end loop;
    execute v_def;
  end loop;
end $do$;

select private.lock_doors();

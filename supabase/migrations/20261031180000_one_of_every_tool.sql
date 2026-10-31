-- One of every tool, QL 20, issued; kept through a death; given again when missing.
--
-- Reported with a screenshot of an empty pack: "Players spawn with no tools at all. They should spawn with one of each,
-- 20ql, unimproveable". The kit was ten tools, and a death put it in the grave with everything else, so a player woke
-- with nothing. Now:
-- * The kit is one of every tool an action, recipe, build or improvement asks for (`action_def`, `recipe`,
--   `build_material_def`, `bridge_def`, `improve_tool`), each at QL 20 and issued; issued cannot be improved
--   (`item_refusal`). The water skin stays at 30. The browser's `STARTER_KIT` is the same list.
-- * Issued gear stays on the body when you die (`bury`).
-- * `kit_topup` gives any kit tool you hold no issued copy of: on coming ashore again (`rpc_join`) and on waking after
--   a death (`player_die`). The first coming ashore still gives the stake too (`starter_kit`).

set local lock_timeout = '3s';

create or replace function kit_topup(p_world uuid, p_uid uuid) returns int
language plpgsql as $$
declare r record; v_n int := 0;
begin
  for r in select * from (values
      ('hatchet', 20, 'Copper'), ('shovel', 20, 'Copper'), ('pickaxe', 20, 'Copper'),
      ('carving_knife', 20, 'Copper'), ('chisel', 20, 'Copper'), ('mallet', 20, 'Pine'),
      ('trowel', 20, 'Copper'), ('saw', 20, 'Copper'), ('butchering_knife', 20, 'Copper'),
      ('rake', 20, 'Copper'), ('sickle', 20, 'Copper'), ('hammer', 20, 'Copper'),
      ('file', 20, null), ('whetstone', 20, null), ('awl', 20, null), ('needle', 20, null),
      ('rope_tool', 20, null), ('brush', 20, null), ('fishing_rod', 20, null), ('fishing_net', 20, null),
      ('frying_pan', 20, null), ('clay_bowl', 20, null), ('clay_pot', 20, null), ('clay_jar', 20, null),
      ('quern', 20, null), ('water_skin', 30, null)) v(def, ql, made)
  loop
    continue when exists (select 1 from item i where i.world_id = p_world and i.holder_uid = p_uid
                                                   and i.def = r.def and i.issued);
    insert into item (world_id, holder, holder_uid, def, ql, extra, issued, charges)
    values (p_world, 'player', p_uid, r.def, r.ql, r.made, true,
            (select charges from item_def where id = r.def));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function starter_kit(p_world uuid, p_uid uuid) returns void
language plpgsql as $$
begin
  perform kit_topup(p_world, p_uid);
  -- And the stake, which is the only thing in the kit that is not a tool, and only the first time.
  insert into item (world_id, holder, holder_uid, def, ql, extra)
  values (p_world, 'player', p_uid, 'deed_stake', 50, 'Pine');
end $$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('rpc_join', $$  else
    v_was_away := p.away;$$, $$  else
    if kit_topup(p_world, me) > 0 then
      perform tell(p_world, me, 'Starting kit: missing tools given.', 'system');
    end if;
    v_was_away := p.away;$$),
    ('player_die', $$  v_said := bury(p_world, p_uid);$$, $$  v_said := bury(p_world, p_uid);
  perform kit_topup(p_world, p_uid);$$),
    -- Issued gear stays on the body, as what is worn does.
    ('bury', $$          and i.creature is null and i.deal is null and not (i.id = any(v_worn))) then$$,
             $$          and i.creature is null and i.deal is null and not i.issued and not (i.id = any(v_worn))) then$$),
    ('bury', $$  update item i set holder = 'furniture', holder_uid = null, placed = v_grave
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
     and i.creature is null and i.deal is null and not (i.id = any(v_worn));$$,
             $$  update item i set holder = 'furniture', holder_uid = null, placed = v_grave
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
     and i.creature is null and i.deal is null and not i.issued and not (i.id = any(v_worn));$$)
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

-- Sleeves are shawls: the slot and the plate shawl's fur. What is already made is carried across in the migration
-- after this one (20261120000011).
--
-- Asked for: the 'sleeves' equipment type is a 'shawl' type, every sleeves already made is a shawl, and the plate shawl
-- takes metal and fur.
--
-- The slot: `arms` is `shawl` (`src/game/gear.ts`, `Slot`). Where a blow lands is unchanged: a blow still lands on the
-- arms (`hit_location.slot`, a wound's `part`, `player.hurt_where`), on the piece worn over them, which the snapshot
-- before this one says in `hit_location.worn` (`COVERS`): `shawl`. So:
--
--   * `part_worn` is the slot whose piece covers a place a blow lands, and `hurt_player` soaks the blow in it and takes
--     it off when it breaks;
--   * `worn_kg` and `swing_burden` read the armour slots off `hit_location.worn` rather than a list of their own;
--   * `bury` keeps on the body whatever is worn over a place a blow lands, off `hit_location.worn`.
--
-- The pieces are renamed in the rulebook (20261120000009): cloth, leather, chain and scale sleeves and plate arms are
-- cloth, leather, chain, scale and plate shawls; those already made come across in 20261120000011.
--
-- The plate shawl: still poured in its mould from metal lumps and beaten out on an anvil, of the metal it was poured
-- from, and now spending `mould_def.also_n` of `mould_def.also_item` (two fur) at the anvil with the casting
-- (`MouldDef.also`): refused without them (`forge_refusal`, the browser's `mouldAlsoRefusal`), spent only when the
-- piece is made (`perform_forge`). A plate arms mould already made is a plate shawl mould and pours as it did; a
-- casting of plate arms is a casting of a plate shawl.

set local lock_timeout = '3s';

-- The slot whose piece covers a place a blow lands; anything else is its own slot.
create or replace function part_worn(p_part text) returns text language sql stable as $fn$
  select coalesce((select h.worn from hit_location h where h.slot = p_part), p_part)
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('public', 'hurt_player', 1,
     $$  piece := worn(p_world, p_uid, part);$$,
     $$  -- The piece worn over where it landed: a blow to the arms lands on the shawl (`part_worn`).
  piece := worn(p_world, p_uid, part_worn(part));$$),
    ('public', 'hurt_player', 1,
     $$      update player set equipped = equipped - part where world_id = p_world and uid = p_uid;$$,
     $$      update player set equipped = equipped - part_worn(part) where world_id = p_world and uid = p_uid;$$),
    ('public', 'worn_kg', 1,
     $$    from unnest(array['head', 'chest', 'arms', 'legs', 'feet']) s(slot)$$,
     $$    from (select h.worn as slot from hit_location h) s$$),
    ('public', 'swing_burden', 1,
     $$    cross join unnest(array['head', 'chest', 'arms', 'legs', 'feet', 'offhand']) s(slot)$$,
     $$    cross join (select h.worn as slot from hit_location h union all select 'offhand') s$$),
    ('public', 'bury', 2,
     $$(select h.slot from hit_location h)$$,
     $$(select h.worn from hit_location h)$$),
    ('public', 'forge_refusal', 1,
     $$  if not exists (select 1 from mould_def where makes = v_cast.piece) then return 'Choose a casting.'; end if;
  return null;$$,
     $$  if not exists (select 1 from mould_def where makes = v_cast.piece) then return 'Choose a casting.'; end if;
  -- And what else the piece takes at the anvil, at hand (`mould_def.also_item`): the plate shawl's fur. The browser's
  -- `mouldAlsoRefusal`.
  return (select 'Need ' || d.also_n || ' × ' || lower(f.name) || '.'
            from mould_def d join item_def f on f.id = d.also_item
           where d.makes = v_cast.piece and d.also_n > 0
             and craft_count(p_world, p_uid, d.also_item) < d.also_n);$$),
    ('public', 'perform_forge', 1,
     $$  if not spend_stack(p_world, p_uid, v_cast.id, 1) then return; end if;$$,
     $$  -- And what else the piece takes at the anvil, at hand before the casting goes and spent with it (`mould_def.also_item`).
  if d.also_n > 0 and craft_count(p_world, p_uid, d.also_item) < d.also_n then return; end if;
  if not spend_stack(p_world, p_uid, v_cast.id, 1) then return; end if;
  if d.also_n > 0 then perform craft_consume(p_world, p_uid, d.also_item, d.also_n); end if;$$)
  ) as t(sch, fn, n, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '%.% has % of the lines to change, not %', r.sch, r.fn, v_n, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();

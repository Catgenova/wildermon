-- Improve and repair, in one window.
--
-- Asked for: "a single custom UI for Improving and Repairing. One section to queue repairing all held equipment
-- or using held ancient whetstones. For improving item a comprehensive interface to show material needed/held to
-- improve and a way to bulk queue improve&repair cycles". The window is the browser's (`src/ui/panels/mend.ts`);
-- what it asks for is three runs the queue could not hold, each a job that is followed by the next of itself when
-- it ends, rather than a line of jobs three deep:
--
--   * Improve and repair: `improve_item` with `mend` on its target. When the run stops with the piece over
--     `improve_damage` (10) -- a failed pass, or the count asked for done with the piece left over it -- a Repair
--     of it to nought goes in front of the line (`repair_item`, the goes it needs), and the rest of the run after
--     it. The count is passes of Improve; a repair is no pass.
--   * Repair all: `repair_item` with `all`, the pieces in all. When the piece is repaired, the next goes in front:
--     the most damaged held equipment Repair takes now (`private.held_gear`), until `all` are done.
--   * Hone all: `hone_whetstone` with `all`, the same, a whetstone a piece, while whetstones are held.
--
-- And a run of Improve may be held to one kind of stock (`stock`, the item, and `stockOf`, what it is made of or
-- nothing): it draws that kind and no other (`private.improve_stock`), and stops when it is gone, "Out of iron
-- lump." -- never going on with another wood, another metal or an ingot in a lump's place, as a bulk saw once
-- went on with the next log at hand. The browser's `StockLock` (`src/game/improve.ts`), in the same words.
--
-- Held equipment: in the pack loose (not in a bag), worn or improvable (`improvable_def`). The browser's
-- `heldEquipment` (`src/game/mending.ts`). The order: the most damaged first, then the oldest row.
set local lock_timeout = '3s';

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

-- The target keys the window sends, taken at the door.
select pg_temp.patch_fn('private.spec_target()'::regprocedure,
  $o$"patron": {"t": "text"}$o$,
  $n$"patron": {"t": "text"},
  "mend": {"t": "bool"}, "stock": {"t": "text", "len": 64}, "stockOf": {"t": "text", "len": 64},
  "all": {"t": "int", "min": 1, "max": 1000}$n$);

/** Held equipment: loose in the pack, and worn or improvable. The browser's `heldEquipment`. */
create or replace function private.held_gear(p_world uuid, p_uid uuid) returns setof item
language sql stable as $fn$
  select i.* from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
     and (exists (select 1 from improvable_def d where d.item = i.def)
          or exists (select 1 from player p, jsonb_each_text(coalesce(p.equipped, '{}'::jsonb)) e
                      where p.world_id = p_world and p.uid = p_uid and e.value = i.id::text))
$fn$;

/** Goes of Repair to take this much damage to nought in these hands, at most a job's. The browser's `repairGoes`. */
create or replace function private.repair_goes(p_world uuid, p_uid uuid, p_dmg double precision) returns int
language sql stable as $fn$
  select case when p_dmg <= 0 then 0 else greatest(1, least(100, ceil(p_dmg
    / ((1.2 + skill_of(p_world, p_uid, 'repair') * 0.1) * pk(p_world, p_uid, 'mend:repair_item', 1)) - 1e-9)))::int end
$fn$;

/**
 * The stock a pass draws, as `stock_for` has it, held to the kind a target names when it names one: that item,
 * made of that or of nothing (`stockOf`), and no other. The browser's `stockFor` with a `StockLock`.
 */
create or replace function private.improve_stock(p_world uuid, p_uid uuid, p_material text, p_made text, p_target jsonb)
returns item language sql stable as $fn$
  select i.* from craft_stock(p_world, p_uid) h
  join item i on i.id = h.id
  join improve_stock s on s.item = i.def and s.material = p_material
  cross join lateral (select (mat_of_item(i.def, i.extra)).name as made) k
  where (p_made is null or k.made is null or lower(k.made) = lower(p_made))
    and (not (p_target ? 'stock')
         or (i.def = p_target->>'stock' and lower(coalesce(k.made, '')) = lower(coalesce(p_target->>'stockOf', ''))))
  order by h.carried desc, i.ql, h.draw limit 1
$fn$;

/** "Out of iron lump.", "Out of plank (oak).": a run held to a kind that is gone. The browser's `outOfSaid`. */
create or replace function private.out_of_said(p_target jsonb) returns text
language sql stable as $fn$
  select 'Out of ' || lower(coalesce(d.name, p_target->>'stock'))
      || case when coalesce(p_target->>'stockOf', '') <> ''
                   and position(lower(p_target->>'stockOf') in lower(coalesce(d.name, ''))) = 0
              then ' (' || lower(p_target->>'stockOf') || ')' else '' end || '.'
    from (select (select name from item_def where id = p_target->>'stock') as name) d
$fn$;

select pg_temp.patch_fn('public.item_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    v_made := (mat_of(v_it.extra)).name;
    if (stock_for(p_world, p_uid, v_mat.id, v_made)).id is null then$o$,
  $n$    v_made := (mat_of(v_it.extra)).name;
    -- Held to one kind of stock: that kind gone is the end of the run, whatever else is at hand.
    if p_target ? 'stock' and (private.improve_stock(p_world, p_uid, v_mat.id, v_made, p_target)).id is null then
      return private.out_of_said(p_target);
    end if;
    if (stock_for(p_world, p_uid, v_mat.id, v_made)).id is null then$n$);

select pg_temp.patch_fn('public.perform_item(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    v_stock := stock_for(p_world, p_uid, v_mat.id, v_made);$o$,
  $n$    v_stock := private.improve_stock(p_world, p_uid, v_mat.id, v_made, p_target);$n$);

/**
 * What goes in front of the line when a run ends, or null: the Repair and the rest of an Improve and repair,
 * the next piece of a Repair all or a Hone all. `p_left` is the goes the run had not done.
 */
create or replace function private.job_follow(p_world uuid, p_uid uuid, p_action text, p_target jsonb, p_left int)
returns jsonb language plpgsql stable as $fn$
declare v_it item; v_next item; v_all int;
begin
  if p_action not in ('improve_item', 'repair_item', 'hone_whetstone') or jsonb_typeof(p_target) is distinct from 'object' then
    return null;
  end if;
  if p_action = 'improve_item' then
    if not coalesce((p_target->>'mend')::boolean, false) then return null; end if;
    v_it := carried(p_world, p_uid, target_item(p_target));
    if v_it.id is null or v_it.dmg <= 10 or item_refusal(p_world, p_uid, 'repair_item', p_target) is not null then
      return null;
    end if;
    return jsonb_build_array(jsonb_build_object('action', 'repair_item',
             'target', jsonb_build_object('kind', 'item', 'uid', v_it.id),
             'goes', private.repair_goes(p_world, p_uid, v_it.dmg)))
        || case when p_left > 0
                then jsonb_build_array(jsonb_build_object('action', 'improve_item', 'target', p_target, 'goes', p_left))
                else '[]'::jsonb end;
  end if;
  v_all := case when jsonb_typeof(p_target->'all') = 'number' then (p_target->>'all')::int else 0 end;
  if v_all <= 1 then return null; end if;
  select g.* into v_next from private.held_gear(p_world, p_uid) g
   where g.dmg > 0
     and case when p_action = 'repair_item'
              then item_refusal(p_world, p_uid, 'repair_item', jsonb_build_object('kind', 'item', 'uid', g.id))
              else relic_use_refusal(p_world, p_uid, 'hone_whetstone', jsonb_build_object('kind', 'item', 'uid', g.id)) end is null
   order by g.dmg desc, g.id
   limit 1;
  if v_next.id is null then return null; end if;
  return jsonb_build_array(jsonb_build_object('action', p_action,
           'target', jsonb_build_object('kind', 'item', 'uid', v_next.id, 'all', v_all - 1),
           'goes', case when p_action = 'repair_item' then private.repair_goes(p_world, p_uid, v_next.dmg) else 1 end));
end $fn$;

select pg_temp.patch_fn('public.settle(uuid,uuid)'::regprocedure,
  $o$        loop
          nxt := p.act_queue -> 0;$o$,
  $n$        -- What follows this run of its own, in front of the line (`private.job_follow`).
        nxt := private.job_follow(p_world, p_uid, p.act, p.act_target,
                 greatest(0, coalesce(p.act_left, 1) - case when v_stop is null then 1 else 0 end));
        if nxt is not null then
          update player set act_queue = nxt || act_queue where world_id = p_world and uid = p_uid returning * into p;
        end if;
        loop
          nxt := p.act_queue -> 0;$n$);

revoke all on function private.held_gear(uuid, uuid) from public, anon, authenticated;
revoke all on function private.repair_goes(uuid, uuid, double precision) from public, anon, authenticated;
revoke all on function private.improve_stock(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.out_of_said(jsonb) from public, anon, authenticated;
revoke all on function private.job_follow(uuid, uuid, text, jsonb, int) from public, anon, authenticated;

select private.lock_doors();

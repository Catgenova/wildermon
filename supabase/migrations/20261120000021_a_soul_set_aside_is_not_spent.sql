-- A soul set aside is not spent, and absorbing one spends the soul chosen and no other.
--
-- Reported: "if a soul is locked it can be used infinite times". Absorbing gave the thing the soul's rarity and then
-- took a soul by `consume`, which passes over what is set aside (`item.locked`): so a locked soul was never taken and
-- could be absorbed again and again, and with another soul in the pack, that one went instead, whatever its rarity.
--
-- So a soul set aside is refused as everything set aside is at the altar ('Set aside: return it to the pack first.',
-- the browser's `SACRIFICE_SAID.locked`), and absorbing takes one of the very soul it names, or does nothing.

set local lock_timeout = '3s';

create or replace function absorb_setting(p_world uuid, p_uid uuid, p_target jsonb, out o_why text, out o_soul item, out o_item item)
  returns record language plpgsql stable as $fn$
begin
  select * into o_soul from item i where i.world_id = p_world and i.id = nullif(p_target->>'soul', '')::bigint
    and i.holder = 'player' and i.holder_uid = p_uid;
  if o_soul.id is null or o_soul.def <> 'soul' or o_soul.rare is null then o_why := 'Choose a soul to absorb.'; return; end if;
  if o_soul.locked then o_why := 'Set aside: return it to the pack first.'; return; end if;
  select * into o_item from item i where i.world_id = p_world and i.id = target_item(p_target)
    and i.holder = 'player' and i.holder_uid = p_uid;
  if o_item.id is null then o_why := 'Choose an item.'; return; end if;
  if o_item.def = 'soul' then o_why := 'Not into another soul.'; return; end if;
  if o_item.def = 'tarnished_bauble' or exists (select 1 from bauble_tier t where t.item = o_item.def) then
    o_why := 'Not on a bauble: its rarity is set by chance when restored.'; return;
  end if;
  if o_item.rare is not null then
    o_why := 'Only ordinary items take a soul; this is ' || o_item.rare || '.'; return;
  end if;
end $fn$;

create or replace function perform_absorb(p_world uuid, p_uid uuid, p_target jsonb) returns void
  language plpgsql as $fn$
declare s record; v_soul text; v_name text; v_left int;
begin
  select * into s from absorb_setting(p_world, p_uid, p_target);
  if s.o_why is not null then return; end if;
  -- One of the soul named, under the hold, before anything takes its rarity.
  delete from item where id = (s.o_soul).id and count = 1 and not locked returning 0 into v_left;
  if v_left is null then
    update item set count = count - 1 where id = (s.o_soul).id and count > 1 and not locked returning count into v_left;
  end if;
  if v_left is null then return; end if;
  v_soul := lower(item_name(s.o_soul));
  v_name := lower(item_name(s.o_item));
  perform item_takes_rarity((s.o_item).id, (s.o_soul).rare);
  perform tell(p_world, p_uid, 'Absorbed: ' || v_soul || ' into ' || v_name || '. Now ' || (s.o_soul).rare || '.', 'event');
end $fn$;

select private.lock_doors();

/*
 * Digging up a treasure map's hoard teaches digging on the island too.
 *
 * In the browser, `unearth` is a job on the digging skill with a shovel, and
 * the job settle (`completeAction`) raises that skill by a full go (1) for it,
 * since there is no roll to miss: the hoard is either under your feet or the
 * job is refused. `perform_treasure` never raised it, so a hoard dug up on an
 * island taught Mind logic (`hoard_head`) and nothing of the trade it was dug
 * with. It raises the job's own skill (`action_def.skill`, which is digging)
 * by 1 now, after the Mind logic, as the browser does.
 *
 * The body is already the same on both sides: `settle` runs `spend_wind` after
 * every go, which teaches body control (`work_hand`), the back for a heavy
 * trade (`work_back`; digging is one) and stamina off the wind spent, which is
 * what the browser's settle does for this go.
 *
 * Replaced, from its newest definition (`20261013181000_maps_drawn_studied_and_copied`):
 *   perform_treasure  -- the digging raise; the map jobs (`chart_action`) and
 *                        `hoard_head` are kept as they were
 */
CREATE OR REPLACE FUNCTION public.perform_treasure(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_map item; v_t treasure; v_tier treasure_def; v_i int; v_got text;
        v_ql double precision; v_rare text; v_c int;
begin
  -- Maps drawn on papyrus, the other map (`cartography.ts`).
  if chart_action(p_action) then
    perform perform_chart(p_world, p_uid, p_action, p_target);
    return;
  end if;
  v_map := carried(p_world, p_uid, target_item(p_target));
  if v_map.id is null then return; end if;
  v_t := treasure_at(v_map.id);
  if v_t.item_id is null then return; end if;
  select * into v_tier from treasure_def where id = v_t.tier;

  -- What was left to watch it, before anything is worth picking up.
  for v_i in 1..v_tier.guards loop
    perform creature_spawn(p_world, v_tier.guard, v_t.x + 0.5, v_t.y + 0.5, 'wild');
  end loop;

  for v_i in 1..v_tier.lumps loop
    select item into v_got from hoard_metal order by random() limit 1;
    v_ql := greatest(1, least(100, v_map.ql * (0.7 + random() * 0.5)));
    perform drop_on_ground(p_world, v_t.x, v_t.y, v_got, v_ql);
  end loop;
  for v_i in 1..v_tier.things loop
    /*
     * A tool or a blade, not a wardrobe. `improvable_def` is everything worth
     * bettering and that includes the furniture and the boats — the suite's
     * first hoard came up with a cart and a chest in it, which is a thing
     * nobody buried. `item_def.category` already draws the line: 55 tools,
     * heaviest eleven kilos, against 38 pieces of `misc` that run to a
     * six-hundred-kilo sailing boat.
     */
    select i.item into v_got from improvable_def i join item_def d on d.id = i.item
     where d.category = 'tool' order by random() limit 1;
    v_ql := greatest(1, least(100, v_map.ql * (0.7 + random() * 0.5)));
    v_rare := rarity_roll();
    v_c := drop_on_ground(p_world, v_t.x, v_t.y, v_got, v_ql);
    update item set rare = v_rare where world_id = p_world and holder = 'ground'
      and gx = v_t.x and gy = v_t.y and def = v_got and rare is null and v_rare is not null;
  end loop;

  perform consume(p_world, p_uid, 'treasure_map', 1, v_map.id);
  perform journal_note(p_world, p_uid, 'hoard');
  -- Matching a map's picture to the ground it was drawn from is head work (`HOARD_HEAD`).
  perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, hoard_head()));
  -- And the trade it was dug with, a full go: there is no roll in it to miss (`completeAction`).
  perform skill_raise(p_world, p_uid, (select a.skill from action_def a where a.id = p_action), 1);
  perform tell(p_world, p_uid, 'The spade goes through rotten board and the hoard is open — '
    || v_tier.lumps || ' lump' || case when v_tier.lumps = 1 then '' else 's' end
    || ' and ' || v_tier.things || ' thing' || case when v_tier.things = 1 then '' else 's' end
    || ' lying where they fell. And something was left to watch over it.', 'event');
  perform land_announce(p_world, v_t.x, v_t.y);
end $function$;

select private.lock_doors();

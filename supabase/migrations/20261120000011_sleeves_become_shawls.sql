-- Sleeves are shawls: every one already made, carried across.
--
-- The rulebook (20261120000009) knows cloth_sleeves, leather_sleeves, chain_sleeves, scale_sleeves and plate_arms as
-- cloth_shawl, leather_shawl, chain_shawl, scale_shawl and plate_shawl, the moulds chain_sleeves_mould and
-- plate_arms_mould as chain_shawl_mould and plate_shawl_mould, and the recipes that make them as make_*_shawl and
-- make_*_shawl_mould; the slot `arms` is `shawl` (20261120000010). So every one already held, worn, kept in a store,
-- a crate, a cart, a stall or a grave, put up for sale, bartered, ordered, cooling in a smelter as a casting of one,
-- carried by a worker, counted in a ledger or a tally, known, queued or on a toolbelt is carried across here, with its
-- quality, damage, rarity, metal, dye, enchantment and maker's mark as they were. Run again, it changes nothing
-- (`supabase/test/shawls.ts`).

set local lock_timeout = '3s';
-- What the island's watch sees change here, it puts down to this migration (`private.origin_kind`), not to a go.
select set_config('wildermon.source', 'migration', true);

-- An id as it is now: every sleeves and the plate arms a shawl, and their moulds and recipes with them. Ids are
-- replaced where they stand in a word, so `make_plate_arms_mould` and `made:cloth_sleeves` come across too; none of
-- the new ids was in use, so nothing lands on a key already there.
create function private.sleeves_shawled(t text) returns text language sql immutable as $fn$
  select replace(replace(replace(replace(replace(t,
    'cloth_sleeves', 'cloth_shawl'), 'leather_sleeves', 'leather_shawl'), 'chain_sleeves', 'chain_shawl'),
    'scale_sleeves', 'scale_shawl'), 'plate_arms', 'plate_shawl')
$fn$;

-- The pieces and their moulds, wherever they are (`item.holder`: a pack, a store, a crate, a stall, a grave, a worker,
-- a wildermon), and a casting of one.
update item set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update item set piece = private.sleeves_shawled(piece) where piece ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update item set mark = private.sleeves_shawled(mark::text)::jsonb where mark::text ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
-- And the door it came out of, where that was a recipe (`act:make_cloth_sleeves`).
update item set origin_fn = private.sleeves_shawled(origin_fn) where origin_fn ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
-- Counted, bartered, ordered, for sale, logged in a settlement's stores and ledger and asked of its workers.
update away_tally set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update barter_item set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update buy_order set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update sale set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update deed_ledger set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update deed_store_log set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update deed_work set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
-- Worn: in the slot it is worn in now.
update player set equipped = (equipped - 'arms') || jsonb_build_object('shawl', equipped -> 'arms') where equipped ? 'arms';
-- On a toolbelt, in the action queue and its target, the tool in hand for it, a ledger, a tally, a perk's figures
-- (a Smith's Plate Maker on the plate shawl) and the rest of a body's own record.
update player set
    belt = private.sleeves_shawled(belt::text)::jsonb,
    act_queue = private.sleeves_shawled(act_queue::text)::jsonb,
    act_target = private.sleeves_shawled(act_target::text)::jsonb,
    act_tool = private.sleeves_shawled(act_tool::text)::jsonb,
    ledger = private.sleeves_shawled(ledger::text)::jsonb,
    tally = private.sleeves_shawled(tally::text)::jsonb,
    class_mul = private.sleeves_shawled(class_mul::text)::jsonb,
    stats = private.sleeves_shawled(stats::text)::jsonb,
    used_at = private.sleeves_shawled(used_at::text)::jsonb
  where concat_ws(' ', belt::text, act_queue::text, act_target::text, act_tool::text, ledger::text, tally::text,
                  class_mul::text, stats::text, used_at::text) ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
-- Carried, fetched, kept and counted by a worker; what it is idle for want of.
update creature set
    carrying = private.sleeves_shawled(carrying::text)::jsonb,
    kept = private.sleeves_shawled(kept::text)::jsonb,
    ledger = private.sleeves_shawled(ledger::text)::jsonb,
    work_stats = private.sleeves_shawled(work_stats::text)::jsonb,
    fetching = private.sleeves_shawled(fetching),
    job = private.sleeves_shawled(job),
    idle_what = (select array_agg(private.sleeves_shawled(w) order by o) from unnest(idle_what) with ordinality u(w, o))
  where concat_ws(' ', carrying::text, kept::text, ledger::text, work_stats::text, fetching, job, idle_what::text)
        ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
-- Cooling in a smelter as a casting, or anything else a placed piece keeps in its state.
update placed set state = private.sleeves_shawled(state::text)::jsonb where state::text ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update placed set mark = private.sleeves_shawled(mark::text)::jsonb where mark::text ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
-- Recipes known, and what the island keeps watch over.
update private.recipe_known set recipe = private.sleeves_shawled(recipe) where recipe ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update private.item_flag set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update private.item_quarantine set was = private.sleeves_shawled(was::text)::jsonb where was::text ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update private.watch_made set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update private.watch_made_new set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';
update private.watch_stock set def = private.sleeves_shawled(def) where def ~ '(cloth|leather|chain|scale)_sleeves|plate_arms';

drop function private.sleeves_shawled(text);
select set_config('wildermon.source', '', true);

select private.lock_doors();

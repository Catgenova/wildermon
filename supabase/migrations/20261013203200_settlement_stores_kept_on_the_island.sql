/*
 * Shared settlement stores, kept on the island.
 *
 * The rule `20261013203100_settlement_stores.sql` sets out, asked where a
 * store is opened, taken from, put into, moved and drawn on:
 *
 *   crate_refusal     a crate's take-all, put and take-one: a settlement store
 *                     asks Use the stores (`store_refusal`) in place of
 *                     Crates and stores and its padlock; picking one up is
 *                     for whoever set it down and the founder. And a take of
 *                     one thing now asks the padlock of a store that is no
 *                     settlement store, as take-all and put always did -- out
 *                     of a crate and out of a piece of furniture alike.
 *   holding_refusal   a piece of furniture's take-all and put: the same rule,
 *                     and its padlock asked at last (`store_shut_piece`); the
 *                     browser always asked it, the island never had.
 *   nearest_store     a put with no store named goes into the nearest one that
 *                     opens for you, not into one that will refuse it.
 *   act_refusal       moving, turning and picking up a piece of furniture that
 *                     is a settlement store (`store_move_refusal`), beside the
 *                     grave's own rule.
 *   perform_crate,
 *   perform_holding   the store's row is locked before anything comes out of
 *                     it or goes into it, and the thing taken is read again
 *                     under that lock, so two people at one store never both
 *                     get the same thing; a settlement store's rule is asked
 *                     again when the go lands, and every take and every put
 *                     is written to its settlement's log (`store_log_add`).
 *   craft_stock,
 *   hod_stock,
 *   spoil_near,
 *   take_spoil        a craft, a build and a drop of dirt never draw on a
 *                     settlement store: everything that leaves one is logged.
 *
 * Rewritten here, each from its newest definition:
 *   crate_refusal, perform_crate -- 20261013003000_ranks_of_your_own.sql and after
 *   holding_refusal, nearest_store, perform_holding, act_refusal,
 *   craft_stock, hod_stock, spoil_near, take_spoil
 *     -- each as `pg_get_functiondef` gave it on the island built from every
 *        migration before this one.
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

/**
 * Why a piece of furniture that is a settlement store is not yours to move,
 * turn or pick up: only whoever set it down and the founder of the
 * settlement it is a store of may. Nothing for anything else.
 */
create or replace function store_move_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
  language plpgsql stable as $fn$
declare p placed; k deed;
begin
  if p_action not in ('pick_up_furniture', 'turn_furniture') then return null; end if;
  select * into p from placed
   where world_id = p_world and id = nullif(p_target->>'id', '')::bigint and kind = 'furniture';
  if not found then return null; end if;
  k := store_kept(p_world, p.store_of, p.x, p.y);
  if k.founded_by is null or p_uid = k.founded_by or p.made_by is not distinct from p_uid then return null; end if;
  return store_move_said(lower(placed_name(p)), k.name);
end $fn$;

CREATE OR REPLACE FUNCTION public.crate_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare v_p player; v_it item; v_c crate; v_pl placed;
        v_tx int; v_ty int; v_sx int; v_sy int; v_want int;
        -- The settlement a store is marked for, and why it will not open (`store_refusal`).
        v_kept deed; v_why text;
begin
  select * into v_p from player where world_id = p_world and uid = p_uid;

  if p_action = 'place_crate' then
    v_tx := (p_target->>'x')::int; v_ty := (p_target->>'y')::int;
    v_sx := (p_target->>'sx')::int; v_sy := (p_target->>'sy')::int;
    if v_tx is null or v_sx is null or v_sy is null or target_item(p_target) is null then
      return 'Choose a crate and a spot.';
    end if;
    select * into v_it from item where id = target_item(p_target)
      and world_id = p_world and holder = 'player' and holder_uid = p_uid;
    if not found or crate_kind_of_item(v_it.def) is null then return 'That is not a crate.'; end if;
    /*
     * A rack's deck is a crate spot, and the ground under it is the rack's
     * business rather than the crate's: whoever set the rack there already
     * answered for the footing. So the ground rules are asked on bare earth
     * and skipped on a deck, which is the only difference between the two — a
     * crate on a rack is an ordinary crate at an ordinary subtile, with its own
     * contents, its own name and its own deed flag.
     */
    if (rack_at(p_world, v_tx, v_ty, v_sx, v_sy)).id is null then
      -- Piers: a finished deck is dry, level floor whatever is under it, and one not built yet nothing to stand on.
      if on_piers(p_world, v_tx, v_ty) then
        if deck_surface(p_world, v_tx, v_ty) is null then return 'Crates need dry, open ground.'; end if;
      elsif not passable(p_world, v_tx, v_ty) or has_water(p_world, v_tx, v_ty) then
        return 'Crates need dry, open ground.';
      elsif tile_slope(p_world, v_tx, v_ty) > 20 then return 'The ground is too steep for a crate to stand.';
      end if;
    elsif crate_kind_of_item(v_it.def) <> 'plank' then
      return 'A ' || lower((select name from item_def where id = v_it.def))
        || ' will not sit on the runners. The rack takes plank crates.';
    end if;
    if (crate_at(p_world, v_tx, v_ty, v_sx, v_sy)).id is not null then return 'There is already a crate on that spot.'; end if;
    if is_token(p_world, v_tx, v_ty) then return 'Not on the token.'; end if;
    return null;

  elsif p_action in ('pick_up_crate', 'crate_take_all') then
    v_c := target_crate(p_world, p_target);
    if v_c.id is null then return 'It is gone.'; end if;
    /*
     * A settlement store: emptied by its founder and by every citizen whose
     * rank holds Use the stores, and by nobody else, key or not; picked up
     * only by whoever set it down and its founder.
     */
    v_kept := store_kept(p_world, v_c.store_of, v_c.x, v_c.y);
    if v_kept.founded_by is not null then
      if p_action = 'pick_up_crate' then
        if p_uid is distinct from v_kept.founded_by and v_c.made_by is distinct from p_uid then
          return store_move_said(lower(crate_name(v_c)), v_kept.name);
        end if;
      else
        v_why := store_refusal(p_world, p_uid, v_kept, lower(crate_name(v_c)));
        if v_why is not null then return v_why; end if;
      end if;
    end if;
    if (v_kept.founded_by is null or p_action = 'pick_up_crate') and not crate_yours(p_world, p_uid, v_c.id) then
      return coalesce(rank_lacks_at(p_world, p_uid, v_c.x, v_c.y, 'stores'),
                      'The ' || lower(crate_name(v_c)) || ' is not yours.');
    end if;
    if sqrt((crate_centre_x(v_c) - v_p.x) ^ 2 + (crate_centre_y(v_c) - v_p.y) ^ 2) > 2.4 then
      return 'Stand next to the crate.';
    end if;
    -- A crate with a padlock on it opens for its key and for the founder of
    -- the settlement it stands on, and for nobody else. Picking it up is
    -- shut the same way: a locked thing you could simply carry off is not
    -- locked at all. A settlement store's padlock is not asked of those it opens for.
    if (v_kept.founded_by is null or p_action = 'pick_up_crate') and lock_shut(p_world, p_uid, v_c.lock, v_c.x, v_c.y) then
      return lock_refusal(p_world, p_uid, v_c.lock, v_c.x, v_c.y);
    end if;
    if p_action = 'pick_up_crate' then
      return case when crate_units(p_world, v_c.id) > 0 then 'Empty it first.' end;
    end if;
    return case when crate_units(p_world, v_c.id) = 0 then 'The crate is empty.' end;

  elsif p_action = 'store_in_crate' then
    -- The crate the ask names, when it names one you can reach; the nearest
    -- when it names none, which is what an item's own menu means by it.
    v_c := named_crate(p_world, v_p.x, v_p.y, p_target);
    if v_c.id is null then v_c := nearest_crate(p_world, v_p.x, v_p.y); end if;
    if v_c.id is null then return 'Stand next to a crate.'; end if;
    v_kept := store_kept(p_world, v_c.store_of, v_c.x, v_c.y);
    if v_kept.founded_by is not null then
      -- A settlement store: Use the stores, in place of whose it is and its padlock.
      v_why := store_refusal(p_world, p_uid, v_kept, lower(crate_name(v_c)));
      if v_why is not null then return v_why; end if;
    else
      -- Putting your things into somebody else's crate is a way of losing them.
      if not crate_yours(p_world, p_uid, v_c.id) then
        return coalesce(rank_lacks_at(p_world, p_uid, v_c.x, v_c.y, 'stores'),
                        'The ' || lower(crate_name(v_c)) || ' is not yours to put anything in.');
      end if;
      if lock_shut(p_world, p_uid, v_c.lock, v_c.x, v_c.y) then
        return lock_refusal(p_world, p_uid, v_c.lock, v_c.x, v_c.y);
      end if;
    end if;
    select * into v_it from item where id = target_item(p_target)
      and world_id = p_world and holder = 'player' and holder_uid = p_uid;
    if not found then return 'It is gone.'; end if;
    if crate_kind_of_item(v_it.def) is not null then return 'A crate does not go in a crate.'; end if;
    v_want := greatest(1, least(v_it.count, coalesce((p_target->>'count')::int, 1)));
    /*
     * Room for some of it is enough.
     *
     * Asked for: "when trying to put 48 items in a container that has room for
     * 13, deposit 13 and reject the 35." It was all or nothing, so an armful
     * of ore and a nearly full crate meant counting the difference yourself
     * and splitting the stack by hand. A thing that stacks goes in as far as
     * there is room; a thing that does not is one row and goes in whole or not
     * at all, which is what it always was.
     */
    if crate_spare(p_world, v_c)
       < (case when coalesce((select stackable from item_def where id = v_it.def), false)
               then 1 else v_want end) then
      return 'The ' || lower(crate_name(v_c)) || ' is full.';
    end if;
    return null;

  elsif p_action = 'take_from_store' then
    /*
     * Taking one thing out, which the island could not do until now.
     *
     * There has been a way to put a thing in and a way to take *everything*
     * out, and nothing in between — so the browser did the in-between itself,
     * moving the row from one window to the other in its own copy and never
     * telling anybody. On an island the next answer put it back, which is what
     * "it rubber bands from crate to inventory" was.
     */
    select * into v_it from item where id = target_item(p_target) and world_id = p_world;
    if not found or v_it.holder not in ('crate', 'furniture', 'bag') then return 'It is gone.'; end if;
    -- A bag is worn rather than stood next to, so there is nothing to walk to
    -- and the only question is whether it is on you.
    if v_it.holder = 'bag' then
      if (carried(p_world, p_uid, v_it.id)).id is null then return 'It is gone.'; end if;
      return null;
    end if;
    if v_it.holder = 'crate' then
      select * into v_c from crate where world_id = p_world and id = v_it.crate;
      if not found then return 'It is gone.'; end if;
      if sqrt((crate_centre_x(v_c) - v_p.x) ^ 2 + (crate_centre_y(v_c) - v_p.y) ^ 2) > 2.4 then
        return 'Stand next to the crate.';
      end if;
      v_kept := store_kept(p_world, v_c.store_of, v_c.x, v_c.y);
      if v_kept.founded_by is not null then
        return store_refusal(p_world, p_uid, v_kept, lower(crate_name(v_c)));
      end if;
      if not crate_yours(p_world, p_uid, v_c.id) then
        return 'The ' || lower(crate_name(v_c)) || ' is not yours.';
      end if;
      -- One thing out of a padlocked crate is as shut as everything out of it.
      return lock_refusal(p_world, p_uid, v_c.lock, v_c.x, v_c.y);
    else
      select * into v_pl from placed where id = v_it.placed and world_id = p_world;
      if not found then return 'It is gone.'; end if;
      if greatest(abs(v_pl.cx - v_p.x), abs(v_pl.cy - v_p.y)) > 2.4 then
        return 'Stand next to the ' || lower(placed_name(v_pl)) || '.';
      end if;
      if v_pl.kind = 'furniture' and coalesce((select stall from furniture_def where id = v_pl.sub), false)
         and v_pl.made_by is distinct from p_uid then
        return 'That is on somebody else''s stall. Buy it at the counter.';
      end if;
      -- A settlement store by its rule, anything else by its padlock.
      if v_pl.kind = 'furniture' then return store_shut_piece(p_world, p_uid, v_pl); end if;
    end if;
    return null;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.holding_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare it item; p placed; v_bag item; v_want int; v_why text; v_other placed;
begin
  if p_action in ('furniture_take_all') then
    select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    if not found then return 'It is gone.'; end if;
    if not near_piece(p_world, p_uid, p) then return 'Stand next to it.'; end if;
    -- A settlement store by its rule, anything else by its padlock (`store_shut_piece`).
    v_why := store_shut_piece(p_world, p_uid, p);
    if v_why is not null then return v_why; end if;
    if furniture_units(p) = 0 then return 'It is empty.'; end if;
    return null;
  end if;

  select * into it from item where world_id = p_world and id = target_item(p_target)
    and holder = 'player' and holder_uid = p_uid;
  if not found then return 'It is gone.'; end if;
  v_want := greatest(1, least(coalesce((p_target->>'count')::int, 1), it.count));

  if p_action = 'stow_item' then
    if is_bag(it.def) then return 'One bag will not go inside another.'; end if;
    if (first_bag(p_world, p_uid, it.def, 1)).id is null then
      return 'There is no bag with room for it.';
    end if;

  elsif p_action = 'empty_bag' then
    if not is_bag(it.def) then return 'That does not hold things.'; end if;
    if bag_units(it.id) = 0 then return 'There is nothing in it.'; end if;

  elsif p_action = 'store_in_furniture' then
    /*
     * A piece the ask names answers for itself, full or not: dragging a plank
     * into an open chest that has no room in it should say that the chest is
     * full, not put the plank in the barrel behind you.
     */
    p := named_store(p_world, p_uid, p_target);
    if p.id is not null then
      v_why := store_shut_piece(p_world, p_uid, p);
      if v_why is not null then return v_why; end if;
      v_why := furniture_refuses(p, it.def);
      if v_why is not null then return v_why; end if;
      if furniture_room(p, it.def) <= 0 then
        return 'The ' || lower(placed_name(p)) || ' is full.';
      end if;
      return null;
    end if;
    p := nearest_store(p_world, p_uid, it.def, 1);
    if p.id is null then
      -- Say why the thing beside you will not take it, rather than that
      -- nothing will: standing at a barrel with a plank, "a barrel holds
      -- liquid and nothing else" is the answer somebody wanted.
      for v_other in select o.* from placed o
        where o.world_id = p_world and o.kind = 'furniture' and near_piece(p_world, p_uid, o, 2.6)
        order by furniture_size(o, it.def) desc, o.id
      loop
        -- `nearest_store` passes over a store that is shut to you: say so.
        v_why := coalesce(store_shut_piece(p_world, p_uid, v_other), furniture_refuses(v_other, it.def));
        if v_why is not null then return v_why; end if;
        if furniture_room(v_other, it.def) <= 0 then
          return 'The ' || lower(placed_name(v_other)) || ' is full.';
        end if;
      end loop;
      return 'Stand next to something that will take it.';
    end if;

  elsif p_action = 'throw_away' then
    p := trash_near(p_world, p_uid);
    if p.id is null then return 'There is no trash crate beside you.'; end if;
    if v_want > furniture_room(p, it.def) then
      return 'The trash crate is full. Wait for it to rot down.';
    end if;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.nearest_store(p_world uuid, p_uid uuid, p_def text, p_count integer)
 RETURNS placed
 LANGUAGE sql
 STABLE
AS $function$
  select p.* from placed p
  where p.world_id = p_world and p.kind = 'furniture'
    and near_piece(p_world, p_uid, p, 2.6)
    and furniture_refuses(p, p_def) is null
    and p_count <= furniture_room(p, p_def)
    -- Not one shut to you: a settlement store you may not use, or a padlock you have no key to.
    and store_shut_piece(p_world, p_uid, p) is null
  order by furniture_size(p, p_def) desc, p.id
  limit 1
$function$;

CREATE OR REPLACE FUNCTION public.perform_crate(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_p player; v_it item; v_c crate; v_back bigint; v_tx int; v_ty int; v_sx int; v_sy int; v_new_id int;
        v_want int; v_fit int; v_names text[] := '{}'; v_r record; v_kind text;
        -- The settlement a store is marked for, which every take and put out of it is logged to.
        v_kept deed; v_pl placed; v_store text;
begin
  select * into v_p from player where world_id = p_world and uid = p_uid;

  if p_action = 'place_crate' then
    v_tx := (p_target->>'x')::int; v_ty := (p_target->>'y')::int;
    v_sx := (p_target->>'sx')::int; v_sy := (p_target->>'sy')::int;
    select * into v_it from item where id = target_item(p_target);
    v_kind := crate_kind_of_item(v_it.def);
    if v_kind is null or not consume(p_world, p_uid, v_it.def, 1, v_it.id) then return; end if;
    select coalesce(max(id), 0) + 1 into v_new_id from crate where world_id = p_world;
    -- The wood was already coming across; the rarity was not, so a rare crate
    -- stopped being rare the moment it stood on the ground -- and a rare crate
    -- is the one that holds more.
    -- And its enchantment and its wear, which it keeps standing and takes up again (`enchanting.ts`).
    insert into crate (world_id, id, kind, x, y, sx, sy, material, made_by, rare, ql, enchant, dmg)
    values (p_world, v_new_id, v_kind, v_tx, v_ty, v_sx, v_sy, v_it.extra, p_uid, v_it.rare, v_it.ql, v_it.enchant, v_it.dmg);
    select * into v_c from crate where world_id = p_world and id = v_new_id;
    perform journal_note(p_world, p_uid, 'crate');
    perform tell(p_world, p_uid, 'You set the ' || lower(crate_name(v_c)) || ' down.', 'event');

  elsif p_action = 'pick_up_crate' then
    v_c := target_crate(p_world, p_target);
    if v_c.id is null or crate_units(p_world, v_c.id) > 0 then return; end if;
    delete from crate where world_id = p_world and id = v_c.id;
    v_back := give(p_world, p_uid, (select item from crate_def where crate_def.kind = v_c.kind), 1, v_c.ql, v_c.material, v_c.rare);
    update item set enchant = v_c.enchant, dmg = v_c.dmg where id = v_back;
    perform tell(p_world, p_uid, 'You pick up the '
      || lower((select name from crate_def where crate_def.kind = v_c.kind)) || '.'
      || case when v_c.deed then ' Deed workers will leave their finds by the token until a deed crate stands again.'
              else '' end, 'event');

  elsif p_action = 'crate_take_all' then
    v_c := target_crate(p_world, p_target);
    if v_c.id is null then return; end if;
    /*
     * The crate's row first, so that two people emptying it, or one emptying
     * it while another takes one thing out, go one after the other: what the
     * first took is gone from the second's reading of it, and nothing is
     * handed out twice. Under that lock a settlement store's rule is asked
     * again, for a go that started before somebody's rank changed.
     */
    select * into v_c from crate where world_id = p_world and id = v_c.id for update;
    if not found then return; end if;
    v_kept := store_kept(p_world, v_c.store_of, v_c.x, v_c.y);
    if v_kept.founded_by is not null and store_refusal(p_world, p_uid, v_kept, lower(crate_name(v_c))) is not null then
      perform tell(p_world, p_uid, store_refusal(p_world, p_uid, v_kept, lower(crate_name(v_c))), 'error');
      return;
    end if;
    for v_r in select * from item where world_id = p_world and holder = 'crate' and crate = v_c.id order by id for update loop
      v_names := v_names || (case when v_r.count > 1 then v_r.count || ' × ' else '' end
        || made_name(v_r.def, v_r.piece));
      update item set holder = 'player', holder_uid = p_uid, crate = null, gx = null, gy = null
        where id = v_r.id;
      if v_kept.founded_by is not null then
        perform store_log_add(p_world, v_kept.founded_by, p_uid, false, v_r.def,
          (select lower(item_name(i)) from item i where i.id = v_r.id), v_r.count, crate_name(v_c));
      end if;
    end loop;
    -- And onto the piles already in the pack. Emptying a crate is the loudest
    -- of these: a worker fills it a load at a time, so a crate of seeds is a
    -- dozen stacks, and taking them all used to put a dozen stacks in the pack.
    perform pack_fold(p_world, p_uid);
    if array_length(v_names, 1) is null then return; end if;
    perform tell(p_world, p_uid, 'You take ' || array_to_string(v_names, ', ') || ' from the crate.', 'event');

  elsif p_action = 'store_in_crate' then
    v_c := named_crate(p_world, v_p.x, v_p.y, p_target);
    if v_c.id is null then v_c := nearest_crate(p_world, v_p.x, v_p.y); end if;
    if v_c.id is null then return; end if;
    -- The crate's row, so two puts into one crate are measured against its room one after the other.
    select * into v_c from crate where world_id = p_world and id = v_c.id for update;
    if not found then return; end if;
    v_kept := store_kept(p_world, v_c.store_of, v_c.x, v_c.y);
    if v_kept.founded_by is not null and store_refusal(p_world, p_uid, v_kept, lower(crate_name(v_c))) is not null then
      perform tell(p_world, p_uid, store_refusal(p_world, p_uid, v_kept, lower(crate_name(v_c))), 'error');
      return;
    end if;
    select * into v_it from item where id = target_item(p_target)
      and world_id = p_world and holder = 'player' and holder_uid = p_uid for update;
    if not found then return; end if;
    v_want := greatest(1, least(v_it.count, coalesce((p_target->>'count')::int, 1)));
    if coalesce((select stackable from item_def where id = v_it.def), false) then
      -- Stackables merge into the crate's own stack of them, a part at a time,
      -- and as far as there is room: what is over stays in the pack.
      v_fit := least(v_want, crate_spare(p_world, v_c));
      if v_fit <= 0 or not crate_add(p_world, v_c.id, v_it.def, v_fit, v_it.ql, v_it.extra, v_it.piece) then
        perform tell(p_world, p_uid, 'The ' || lower(crate_name(v_c)) || ' is full.', 'error');
        return;
      end if;
      if v_fit >= v_it.count then delete from item where id = v_it.id;
      else update item set count = count - v_fit where id = v_it.id; end if;
    else
      -- Anything else is the same row moved into the crate, so a bag keeps
      -- what is in it: the contents belong to the bag, wherever the bag is.
      -- The row used to be copied and the original deleted, and the deletion
      -- took the bag's contents with it.
      if crate_units(p_world, v_c.id) + v_it.count > crate_capacity(v_c) then
        perform tell(p_world, p_uid, 'The ' || lower(crate_name(v_c)) || ' is full.', 'error');
        return;
      end if;
      update item set holder = 'crate', holder_uid = null, crate = v_c.id, gx = v_c.x, gy = v_c.y, inside = null, placed = null
        where id = v_it.id;
      v_fit := v_it.count;
    end if;
    perform tell(p_world, p_uid,
      stored_line(v_fit, made_name(v_it.def, v_it.piece), crate_name(v_c), v_want - v_fit), 'event');
    if v_kept.founded_by is not null then
      perform store_log_add(p_world, v_kept.founded_by, p_uid, true, v_it.def, lower(item_name(v_it)), v_fit, crate_name(v_c));
    end if;

  elsif p_action = 'take_from_store' then
    select * into v_it from item where id = target_item(p_target) and world_id = p_world;
    if not found or v_it.holder not in ('crate', 'furniture', 'bag') then return; end if;
    /*
     * The store's row, and then the thing again under it: two people taking
     * the last of a stack, or one taking it while another empties the store,
     * go one after the other, and the second finds it gone rather than
     * lifting it out of the first one's pack.
     */
    if v_it.holder = 'crate' then
      select * into v_c from crate where world_id = p_world and id = v_it.crate for update;
      if not found then return; end if;
      v_kept := store_kept(p_world, v_c.store_of, v_c.x, v_c.y);
      v_store := crate_name(v_c);
    elsif v_it.holder = 'furniture' then
      select * into v_pl from placed where world_id = p_world and id = v_it.placed for update;
      if not found then return; end if;
      v_kept := store_kept(p_world, v_pl.store_of, v_pl.x, v_pl.y);
      v_store := placed_name(v_pl);
    end if;
    select * into v_it from item i where i.id = v_it.id and i.world_id = p_world and i.holder = v_it.holder
      and i.crate is not distinct from v_it.crate and i.placed is not distinct from v_it.placed
      and i.inside is not distinct from v_it.inside for update;
    if not found then return; end if;
    if v_kept.founded_by is not null and store_refusal(p_world, p_uid, v_kept, lower(v_store)) is not null then
      perform tell(p_world, p_uid, store_refusal(p_world, p_uid, v_kept, lower(v_store)), 'error');
      return;
    end if;
    v_want := greatest(1, least(v_it.count, coalesce((p_target->>'count')::int, 1)));
    -- `move_part` splits the stack, merges into one you already carry, and
    -- clears whichever of `crate` and `placed` was holding it.
    if move_part(v_it.id, v_want, 'player', p_uid, null, null) is null then return; end if;
    if v_kept.founded_by is not null then
      perform store_log_add(p_world, v_kept.founded_by, p_uid, false, v_it.def, lower(item_name(v_it)), v_want, v_store);
    end if;
    perform tell(p_world, p_uid, 'You take '
      || case when v_want > 1 then v_want || ' × ' else 'the ' end
      || lower((select coalesce(name, v_it.def) from item_def where id = v_it.def))
      || ' out.', 'event');
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.perform_holding(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare it item; p placed; v_bag item; v_want int; v_fit int; v_moved bigint; v_names text; v_n int;
        -- The settlement a store is marked for, which every take and put out of it is logged to.
        v_kept deed; v_why text;
begin
  if p_action = 'furniture_take_all' then
    -- Its row first, so that two people at one store go one after the other and nothing comes out twice.
    select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint for update;
    if not found then return; end if;
    -- And a settlement store's rule again, for a go that started before somebody's rank changed.
    v_kept := store_kept(p_world, p.store_of, p.x, p.y);
    if v_kept.founded_by is not null then
      v_why := store_refusal(p_world, p_uid, v_kept, lower(placed_name(p)));
      if v_why is not null then perform tell(p_world, p_uid, v_why, 'error'); return; end if;
    end if;
    select string_agg(case when q.count > 1 then q.count || ' × ' || lower(item_name(q))
                           else lower(item_name(q)) end, ', ' order by q.id), count(*)
      into v_names, v_n
      from item q where q.placed = p.id and q.holder = 'furniture';
    if v_n = 0 then return; end if;
    if v_kept.founded_by is not null then
      perform store_log_add(p_world, v_kept.founded_by, p_uid, false, q.def, lower(item_name(q)), q.count, placed_name(p))
         from item q where q.placed = p.id and q.holder = 'furniture' order by q.id;
    end if;
    update item set holder = 'player', holder_uid = p_uid, placed = null
      where placed = p.id and holder = 'furniture';
    perform pack_fold(p_world, p_uid);
    perform tell(p_world, p_uid, 'You take ' || v_names || ' out of the '
      || lower(placed_name(p)) || '.', 'event');
    return;
  end if;

  select * into it from item where world_id = p_world and id = target_item(p_target)
    and holder = 'player' and holder_uid = p_uid;
  if not found then return; end if;
  v_want := greatest(1, least(coalesce((p_target->>'count')::int, 1), it.count));

  if p_action = 'stow_item' then
    v_bag := first_bag(p_world, p_uid, it.def, 1);
    if v_bag.id is null then return; end if;
    v_fit := least(v_want, bag_spare(v_bag));
    if v_fit <= 0 then return; end if;
    v_moved := move_part(it.id, v_fit, 'bag', p_uid, v_bag.id, null);
    if v_moved is null then return; end if;
    perform tell(p_world, p_uid, stored_line(v_fit, item_name(it),
      (select name from item_def where id = v_bag.def), v_want - v_fit), 'event');

  elsif p_action = 'empty_bag' then
    select count(*) into v_n from item where inside = it.id and holder = 'bag';
    -- Back through `move_part` rather than a bare update, so what comes out
    -- merges into the stack it left rather than sitting beside it.
    for v_bag in select * from item where inside = it.id and holder = 'bag' order by id loop
      perform move_part(v_bag.id, v_bag.count, 'player', p_uid, null, null);
    end loop;
    perform tell(p_world, p_uid, 'You turn the '
      || lower((select name from item_def where id = it.def)) || ' out: ' || v_n
      || case when v_n = 1 then ' thing' else ' things' end || ' back in your pack.', 'event');

  elsif p_action = 'store_in_furniture' then
    p := named_store(p_world, p_uid, p_target);
    if p.id is null then p := nearest_store(p_world, p_uid, it.def, 1); end if;
    if p.id is null then return; end if;
    -- Its row, so two puts into one store are measured against its room one after the other.
    select * into p from placed where world_id = p_world and id = p.id for update;
    if not found then return; end if;
    v_kept := store_kept(p_world, p.store_of, p.x, p.y);
    if v_kept.founded_by is not null then
      v_why := store_refusal(p_world, p_uid, v_kept, lower(placed_name(p)));
      if v_why is not null then perform tell(p_world, p_uid, v_why, 'error'); return; end if;
    end if;
    v_fit := least(v_want, furniture_room(p, it.def));
    if v_fit <= 0 then return; end if;
    v_moved := move_part(it.id, v_fit, 'furniture', null, null, p.id);
    if v_moved is null then return; end if;
    perform tell(p_world, p_uid,
      stored_line(v_fit, item_name(it), placed_name(p), v_want - v_fit), 'event');
    if v_kept.founded_by is not null then
      perform store_log_add(p_world, v_kept.founded_by, p_uid, true, it.def, lower(item_name(it)), v_fit, placed_name(p));
    end if;

  elsif p_action = 'throw_away' then
    p := trash_near(p_world, p_uid);
    if p.id is null then return; end if;
    v_moved := move_part(it.id, v_want, 'furniture', null, null, p.id);
    if v_moved is null then return; end if;
    perform tell(p_world, p_uid, 'You throw '
      || case when v_want > 1 then v_want || ' × ' else 'the ' end || lower(item_name(it))
      || ' in the trash crate. It will not last long in there.', 'event');
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.craft_stock(p_world uuid, p_uid uuid, p_chosen bigint DEFAULT NULL::bigint)
 RETURNS TABLE(id bigint, def text, count integer, extra text, ql real, carried boolean, draw bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with me as (
    select p.x, p.y, floor(p.x)::int as tx, floor(p.y)::int as ty,
           coalesce(p.craft_from_stores, true) as stores,
           coalesce(p.craft_spare_rare, false) as spare,
           -- Asked once: three tiles, or further for a Smith's Forge Reach at the smelter or the anvil.
           craft_reach() as r
      from player p where p.world_id = p_world and p.uid = p_uid
  ),
  crates as materialized (
    select c.id, sqrt((crate_centre_x(c) - me.x) ^ 2 + (crate_centre_y(c) - me.y) ^ 2) as d
      from crate c, me
     where me.stores and c.world_id = p_world
       and c.x between me.tx - me.r and me.tx + me.r
       and c.y between me.ty - me.r and me.ty + me.r
       and crate_yours(p_world, p_uid, c.id)
       and same_floor(c.level, c.world_id, c.x, c.y) -- cellar
       and not lock_shut(p_world, p_uid, c.lock, c.x, c.y)
       -- Never a settlement store: what leaves one goes through its log.
       and c.store_of is null
  ),
  pieces as materialized (
    select pl.id, sqrt((pl.cx - me.x) ^ 2 + (pl.cy - me.y) ^ 2) as d
      from placed pl join furniture_def f on f.id = pl.sub, me
     where me.stores and pl.world_id = p_world and pl.kind = 'furniture'
       and pl.x between me.tx - me.r and me.tx + me.r
       and pl.y between me.ty - me.r and me.ty + me.r
       and furniture_holds(pl)
       and same_floor(pl.level, pl.world_id, pl.x, pl.y) -- cellar
       and coalesce(f.trash, 0) = 0 and not f.stall
       -- Yours, or on a settlement of yours -- or a cart, a wagon or a boat,
       -- which is anybody's to load and to empty, and so anybody's to use.
       and (pl.made_by = p_uid or deed_may_at(p_world, p_uid, pl.x, pl.y, power_bit('stores')) or f.cart or is_driveable(pl))
       and not lock_shut(p_world, p_uid, pl.lock, pl.x, pl.y)
       -- Never a settlement store: what leaves one goes through its log.
       and pl.store_of is null
  ),
  stock as (
    -- Loose in your hands.
    select i.id, i.def, i.count, i.extra, i.ql, i.rare, true as carried,
           0 as rank, 0::double precision as d, 0 as kind, 0::bigint as store
      from item i
     where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
       and not i.locked and i.deal is null
    union all
    -- In a bag you are carrying: `carried`, the lookup `in_the_bag` made.
    select i.id, i.def, i.count, i.extra, i.ql, i.rare, true, 1, 0, 0, b.id
      from item b join item i on i.inside = b.id and i.holder = 'bag'
     where b.world_id = p_world and b.holder = 'player' and b.holder_uid = p_uid
       and not i.locked and i.deal is null
    union all
    select i.id, i.def, i.count, i.extra, i.ql, i.rare, false, 2, c.d, 0, c.id::bigint
      from crates c join item i on i.world_id = p_world and i.holder = 'crate' and i.crate = c.id
     where not i.locked and i.deal is null and i.price is null and i.letter is null
    union all
    select i.id, i.def, i.count, i.extra, i.ql, i.rare, false, 2, pc.d, 1, pc.id
      from pieces pc join item i on i.world_id = p_world and i.holder = 'furniture' and i.placed = pc.id
     where not i.locked and i.deal is null and i.price is null and i.letter is null
  )
  select s.id, s.def, s.count, s.extra, s.ql, s.carried,
         row_number() over (order by s.rank, s.d, s.kind, s.store, s.id)
    from stock s
   where coalesce(s.rare, '') = ''
      or s.id is not distinct from p_chosen
      or not coalesce((select m.spare from me m), false)
$function$;

CREATE OR REPLACE FUNCTION public.hod_stock(p_world uuid, p_uid uuid, p_item text, p_reach double precision)
 RETURNS TABLE(id bigint, count integer, draw bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with me as (
    select p.x, p.y, floor(p.x)::int as tx, floor(p.y)::int as ty, ceil(p_reach)::int as r
      from player p where p.world_id = p_world and p.uid = p_uid and p_reach > 0
  ),
  crates as materialized (
    select c.id, sqrt((crate_centre_x(c) - me.x) ^ 2 + (crate_centre_y(c) - me.y) ^ 2) as d
      from crate c, me
     where c.world_id = p_world
       and c.x between me.tx - me.r and me.tx + me.r
       and c.y between me.ty - me.r and me.ty + me.r
       and crate_yours(p_world, p_uid, c.id)
       and same_floor(c.level, c.world_id, c.x, c.y) -- cellar
       and not lock_shut(p_world, p_uid, c.lock, c.x, c.y)
       -- Never a settlement store: what leaves one goes through its log.
       and c.store_of is null
  ),
  pieces as materialized (
    select pl.id, sqrt((pl.cx - me.x) ^ 2 + (pl.cy - me.y) ^ 2) as d
      from placed pl join furniture_def f on f.id = pl.sub, me
     where pl.world_id = p_world and pl.kind = 'furniture'
       and pl.x between me.tx - me.r and me.tx + me.r
       and pl.y between me.ty - me.r and me.ty + me.r
       and furniture_holds(pl)
       and same_floor(pl.level, pl.world_id, pl.x, pl.y) -- cellar
       and coalesce(f.trash, 0) = 0 and not f.stall
       and (pl.made_by = p_uid or deed_may_at(p_world, p_uid, pl.x, pl.y, power_bit('stores')) or f.cart or is_driveable(pl))
       and not lock_shut(p_world, p_uid, pl.lock, pl.x, pl.y)
       -- Never a settlement store: what leaves one goes through its log.
       and pl.store_of is null
  ),
  stock as (
    select i.id, i.count, c.d, 0 as kind, c.id::bigint as store
      from crates c join item i on i.world_id = p_world and i.holder = 'crate' and i.crate = c.id
     where i.def = p_item and i.count > 0 and not i.locked and i.deal is null and i.price is null and i.letter is null
    union all
    select i.id, i.count, pc.d, 1, pc.id
      from pieces pc join item i on i.world_id = p_world and i.holder = 'furniture' and i.placed = pc.id
     where i.def = p_item and i.count > 0 and not i.locked and i.deal is null and i.price is null and i.letter is null
  )
  select s.id, s.count, row_number() over (order by s.d, s.kind, s.store, s.id) from stock s
$function$;

CREATE OR REPLACE FUNCTION public.spoil_near(p_world uuid, p_uid uuid, p_item bigint)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare v_def text; v_want text[] := array['dirt', 'clay', 'sand'];
begin
  v_def := spoil_in_hand(p_world, p_uid, p_item);
  if v_def is not null or p_item is not null then return v_def; end if;
  select i.def into v_def from item i
    join crate c on c.world_id = i.world_id and c.id = i.crate
   where i.world_id = p_world and i.holder = 'crate' and i.def = any(v_want) and not i.locked
     -- Never a settlement store, whose takes are all logged.
     and c.store_of is null
     and c.id = (select cc.id from nearest_crate(p_world, crate_centre_x(c), crate_centre_y(c),
                                                    pk(p_world, p_uid, 'reach:soil', spoil_reach())) cc limit 1)
   order by array_position(v_want, i.def), i.id limit 1;
  if v_def is not null then return v_def; end if;
  select i.def into v_def from item i
    join placed p on p.world_id = i.world_id and p.id = i.placed
   where i.world_id = p_world and i.holder = 'furniture' and i.def = any(v_want) and not i.locked
     and near_piece(p_world, p_uid, p, pk(p_world, p_uid, 'reach:soil', spoil_reach()))
     -- Not out of a grave, whoever's it is: what is in one comes out through its own doors or not at all.
     and p.crumbles_at is null
     -- Nor a settlement store, whose takes are all logged.
     and p.store_of is null
   order by array_position(v_want, i.def), i.id limit 1;
  return v_def;
end $function$;

CREATE OR REPLACE FUNCTION public.take_spoil(p_world uuid, p_uid uuid, p_def text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
declare v_id bigint;
begin
  if consume(p_world, p_uid, p_def, 1) then return true; end if;
  select i.id into v_id from item i
    join crate c on c.world_id = i.world_id and c.id = i.crate
   where i.world_id = p_world and i.holder = 'crate' and i.def = p_def and not i.locked
     -- Never a settlement store, whose takes are all logged.
     and c.store_of is null
     and same_floor(c.level, c.world_id, c.x, c.y) -- cellar
     and sqrt((crate_centre_x(c) - (select pl.x from player pl where pl.world_id = p_world and pl.uid = p_uid)) ^ 2
            + (crate_centre_y(c) - (select pl.y from player pl where pl.world_id = p_world and pl.uid = p_uid)) ^ 2)
         -- As far as a Terraformer's Long Reach, or the reach everybody has.
         <= pk(p_world, p_uid, 'reach:soil', spoil_reach())
   order by i.id limit 1;
  if v_id is null then
    select i.id into v_id from item i
      join placed p on p.world_id = i.world_id and p.id = i.placed
     where i.world_id = p_world and i.holder = 'furniture' and i.def = p_def and not i.locked
       and near_piece(p_world, p_uid, p, pk(p_world, p_uid, 'reach:soil', spoil_reach()))
       -- Not out of a grave, as `spoil_near` asks.
       and p.crumbles_at is null
       -- Nor a settlement store, whose takes are all logged.
       and p.store_of is null
     order by i.id limit 1;
  end if;
  if v_id is null then return false; end if;
  update item set count = count - 1 where id = v_id and count > 1;
  if found then return true; end if;
  delete from item where id = v_id;
  return found;
end $function$;

CREATE OR REPLACE FUNCTION public.act_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare why text; was_pk text; was_act text; was_floor text; v_fx jsonb; v_floor int; v_cellar int; -- cellar
begin
  why := body_refusal(p_world, p_uid, p_action);
  if why is not null then return why; end if;
  -- A grave opens for whoever lies under it, and only to be emptied.
  why := grave_refusal(p_world, p_uid, p_action, p_target);
  if why is not null then return why; end if;
  -- A settlement store is moved, turned and picked up by whoever set it down and its founder (`store_move_refusal`).
  why := store_move_refusal(p_world, p_uid, p_action, p_target);
  if why is not null then return why; end if;
  -- cellar: the body's perks and its side of the ground floor, in the one read of its row (the perks were read below).
  select pl.class_mul->'fx', floor_of(pl.level), -- cellar
         case when pl.level < 0 then (cellar_at(p_world, floor(pl.x)::int, floor(pl.y)::int)).building end -- cellar
    into v_fx, v_floor, v_cellar from player pl where pl.world_id = p_world and pl.uid = p_uid; -- cellar
  v_floor := coalesce(v_floor, 0); -- cellar
  -- cellar: a thing down in the cellar is reached from down there, a thing up top from up top, and from one cellar
  -- cellar: nothing in the cellar next door -- asked down there, or of the five kinds of thing that can be down there.
  if v_floor < 0 or p_target->>'kind' in ('crate', 'furniture', 'ground', 'item', 'person') then -- cellar
    why := cellar_gate(p_world, p_uid, p_action, p_target, v_floor, v_cellar); -- cellar
    if why is not null then return why; end if; -- cellar
  end if; -- cellar
  /*
   * The go's perks, for the rules too deep to be handed the body (`pkx`), as
   * the clock sets them for a go: so a Smith's Forge Reach reaches the same
   * stores for the refusal as for the go. Put back as they were after.
   */
  was_pk := current_setting('wurm.pk', true);
  was_act := current_setting('wurm.pk_act', true);
  perform set_config('wurm.pk', coalesce(v_fx, '{}'::jsonb)::text, true); -- cellar: read above, with the storey
  perform set_config('wurm.pk_act', coalesce(p_action, ''), true);
  -- cellar: and the side of the ground floor it is asked from (`actor_floor`, `actor_cellar`), put back after.
  was_floor := current_setting('wurm.floor', true); -- cellar
  perform set_config('wurm.floor', v_floor || ':' || coalesce(v_cellar::text, ''), true); -- cellar
  why := act_refusal_rules(p_world, p_uid, p_action, p_target);
  perform set_config('wurm.floor', coalesce(was_floor, ''), true); -- cellar
  perform set_config('wurm.pk', coalesce(was_pk, ''), true);
  perform set_config('wurm.pk_act', coalesce(was_act, ''), true);
  return why;
end $function$;


reset check_function_bodies;
select private.lock_doors();

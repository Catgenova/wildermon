-- A cleared lair's hoard chest, and a lair nobody picks up or names.
--
-- Asked for: "goblin warrens should not be able to be picked up or renamed", and "when all the mobs are cleared
-- create the loot chest in place of the warren". A lair's piece is the island's: every action on it is refused in its
-- kind's words (`lair_refusal`), now by its kind rather than by the lair row that points at it, so a piece that stands
-- for a lair is refused whichever row it is. When the boss dies (its garrison dead before it) the lair's piece goes and
-- a hoard chest (`lair_chest`, `lairs.ts`) is set down on its tile in its place, holding the hoard that used to go
-- straight into each share-holder's pack: a share for each body that dealt `hoard_share` of the boss's health, the
-- treasure map at its kind's odds, the trophy with its slayer's name, a dragon's hoard scales, and the book at
-- `hoard_book` (`lair_hoard_give`). Anybody takes from it, one thing or all; nobody moves, names, fills or works it
-- (`lair_chest_shut`), and it is no settlement's store. It goes once emptied (`lair_chest_emptied`, after each take
-- and on the lair's turn) and, with whatever is left in it, at the restock, when the lair's piece stands again on its
-- tile -- its new site, for a lair that moves (`lair_turn`).
--
-- On the island this lands on: every lair already cleared has its hoard handed out already, so its piece goes and no
-- chest is set down; it stands again at its restock. A name, a dye or a padlock somebody put on a lair's piece is taken
-- off. Both counted in a notice.

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

/* ---- The chest a lair's hoard is in -------------------------------------------------------------------------- */

-- Its hoard chest, while one stands; gone with the chest.
select private.shut('alter table lair add column if not exists chest bigint references placed (id) on delete set null');

/** A thing put into a hoard chest as it is: its own row, never folded into another share's. */
create or replace function lair_chest_put(p_world uuid, p_chest bigint, p_def text, p_n int, p_ql double precision,
                                          p_extra text default null, p_maker text default null) returns bigint
language sql as $$
  insert into item (world_id, holder, placed, def, ql, count, extra, maker)
  values (p_world, 'furniture', p_chest, p_def, greatest(0, least(100, p_ql)), p_n, p_extra, p_maker)
  returning id
$$;

/** The lair's piece gone and its hoard chest set down in its place, on the middle of its tile; the chest's id. */
create or replace function lair_chest_stand(p_world uuid, p_lair int) returns bigint
language plpgsql as $$
declare l lair; v_id bigint;
begin
  select * into l from lair where world_id = p_world and id = p_lair for update;
  if l.id is null then return null; end if;
  if l.chest is not null then delete from placed where world_id = p_world and id = l.chest; end if;
  if l.placed is not null then delete from placed where world_id = p_world and id = l.placed; end if;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, since)
    values (p_world, 'furniture', lair_chest(), l.x, l.y, 1, 1, l.x + 0.5, l.y + 0.5, 50, now())
  returning id into v_id;
  update lair set placed = null, chest = v_id where world_id = p_world and id = p_lair;
  return v_id;
end $$;

/** A hoard chest with nothing left in it, gone; true when it went. Anything else asked of is left as it is. */
create or replace function lair_chest_emptied(p_world uuid, p_placed bigint) returns boolean
language plpgsql as $$
begin
  if p_placed is null then return false; end if;
  delete from placed pl where pl.world_id = p_world and pl.id = p_placed and pl.kind = 'furniture' and pl.sub = lair_chest()
     and not exists (select 1 from item i where i.placed = pl.id and i.holder = 'furniture');
  return found;
end $$;

/* ---- The hoard, into the chest ------------------------------------------------------------------------------- */

drop function if exists lair_hoard_give(uuid, uuid, int, jsonb, double precision);
create or replace function lair_hoard_give(p_world uuid, p_uid uuid, p_lair int, p_roll jsonb, p_ql double precision, p_chest bigint)
returns jsonb language plpgsql as $$
declare l lair; k record; v_said text[] := '{}'; v_book text; v_got text; v_title text; v_out jsonb := '{}'::jsonb;
        v_spot record; v_tier treasure_def; v_id bigint;
begin
  select * into l from lair where world_id = p_world and id = p_lair;
  select * into k from lair_kinds() lk where lk.id = l.kind;
  -- A map to a hoard of its own, its finder the share's: `bury_treasure`, into the chest.
  if (p_roll->>'map')::boolean then
    select * into v_spot from treasure_spot_for(p_world, l.x + 0.5, l.y + 0.5, (treasure_tier(p_ql)).guard);
    if v_spot.x is not null then
      v_tier := treasure_tier(p_ql);
      v_id := lair_chest_put(p_world, p_chest, 'treasure_map', 1, p_ql, v_tier.id);
      insert into treasure (item_id, world_id, x, y, tier, finder) values (v_id, p_world, v_spot.x, v_spot.y, v_tier.id, p_uid);
      v_said := v_said || 'treasure map'::text;
      v_out := v_out || '{"map": true}';
    end if;
  end if;
  -- Its slayer's name on it, which a trophy plaque shows under it (`garden.ts`).
  perform lair_chest_put(p_world, p_chest, k.trophy, 1, p_ql, null, (select py.name from player py where py.world_id = p_world and py.uid = p_uid));
  v_said := v_said || lower((select d.name from item_def d where d.id = k.trophy));
  v_out := v_out || jsonb_build_object('trophy', k.trophy);
  if k.scales > 0 then
    perform lair_chest_put(p_world, p_chest, 'dragon_scale', k.scales, p_ql, hoard_scale());
    v_said := v_said || (k.scales || ' hoard dragon scales');
    v_out := v_out || jsonb_build_object('scales', k.scales);
  end if;
  -- A Recipe or a Formula its share-holder has not read.
  if (p_roll->>'book')::boolean then
    v_book := (select bd.book from book_drops() bd where bd.kind = k.species);
    v_got := private.recipe_to_drop(p_world, p_uid, v_book);
    if v_got is not null then
      v_title := (select lr.title from locked_recipes() lr where lr.id = v_got);
      perform lair_chest_put(p_world, p_chest, book_item(v_book), 1, p_ql, v_title);
      v_said := v_said || (lower((select d.name from item_def d where d.id = book_item(v_book))) || ' (' || lower(v_title) || ')');
      v_out := v_out || jsonb_build_object('book', v_got);
    end if;
  end if;
  perform tell(p_world, p_uid, 'Hoard (' || lower(k.name) || '), in its hoard chest: ' || listed(v_said) || '.', 'event');
  return v_out || jsonb_build_object('chest', p_chest);
end $$;

create or replace function lair_cleared(p_world uuid, p_lair int, p_top double precision) returns int
language plpgsql as $$
declare b record; v_n int := 0; v_clears timestamptz[]; v_chest bigint;
begin
  -- The lair's piece gone, its hoard chest in its place, a share in it for each who dealt enough.
  v_chest := lair_chest_stand(p_world, p_lair);
  for b in select * from lair_blow where world_id = p_world and lair = p_lair and dealt >= hoard_share() * p_top order by uid loop
    perform lair_hoard_give(p_world, b.uid, p_lair, hoard_roll((select kind from lair where world_id = p_world and id = p_lair),
      random(), random()), map_ql_beast(p_top), v_chest);
    v_n := v_n + 1;
  end loop;
  -- Nobody's share in it: no chest.
  perform lair_chest_emptied(p_world, v_chest);
  delete from lair_blow where world_id = p_world and lair = p_lair;
  select array(select t from unnest(l.clears) t where t > now() - make_interval(days => lair_move_days()::int)) || now()
    into v_clears from lair l where l.world_id = p_world and l.id = p_lair;
  update lair set state = 'cleared', cleared_at = now(), clears = v_clears,
      moving = moving or cardinality(v_clears) >= lair_move_clears()
    where world_id = p_world and id = p_lair;
  -- An orc camp's fire out.
  perform lair_fire(p_world, p_lair, false);
  return v_n;
end $$;

/* ---- The restock: the chest gone, the lair's piece back ------------------------------------------------------ */

create or replace function lair_turn(p_world uuid, p_lair int) returns void
language plpgsql as $$
declare l lair; k record; v_up int; v_due int; s record;
begin
  select * into l from lair where world_id = p_world and id = p_lair for update skip locked;
  if l.id is null then return; end if;
  select * into k from lair_kinds() lk where lk.id = l.kind;
  if l.state = 'cleared' then
    -- Its hoard chest, gone once emptied.
    perform lair_chest_emptied(p_world, l.chest);
    if now() < l.cleared_at + make_interval(secs => k.restock) then
      perform lair_ring_stock(p_world, p_lair);
      return;
    end if;
    update lair set state = 'held', size = lair_size_roll(l.kind), stocked_at = now(), cleared_at = null
      where world_id = p_world and id = p_lair;
    -- The chest gone, with whatever is left in it.
    if l.chest is not null then delete from placed where world_id = p_world and id = l.chest; end if;
    if l.moving then
      select * into s from lair_site(p_world, l.kind, p_lair);
      if s.x is not null then
        update placed set x = s.x, y = s.y, cx = s.x + 0.5, cy = s.y + 0.5 where world_id = p_world and id = l.placed;
        update lair set x = s.x, y = s.y where world_id = p_world and id = p_lair;
        delete from lair_seen where world_id = p_world and lair = p_lair;
      end if;
      update lair set moving = false, clears = '{}' where world_id = p_world and id = p_lair;
    end if;
    -- And its piece standing again on its tile, where it went with the clearing.
    update lair lr set placed = lair_piece(p_world, lr.kind, lr.x, lr.y)
      where lr.world_id = p_world and lr.id = p_lair and lr.placed is null;
    -- And an orc camp's fire lit again.
    perform lair_fire(p_world, p_lair, true);
    perform lair_restock(p_world, p_lair, 1);
    if lair_garrison_up(p_world, p_lair) = 0 then perform lair_boss_out(p_world, p_lair); end if;
    return;
  end if;
  if l.state = 'boss' then
    if not exists (select 1 from creature c where c.world_id = p_world and c.lair = p_lair and c.boss) then
      perform lair_boss_out(p_world, p_lair);
    end if;
    return;
  end if;
  v_up := lair_garrison_up(p_world, p_lair);
  if v_up = 0 then
    perform lair_boss_out(p_world, p_lair);
  elsif v_up >= l.size then
    update lair set stocked_at = now() where world_id = p_world and id = p_lair;
  else
    v_due := floor(extract(epoch from (now() - l.stocked_at)) / k.restock)::int;
    if v_due > 0 then
      perform lair_restock(p_world, p_lair, least(v_due, l.size - v_up));
      update lair set stocked_at = case when lair_garrison_up(p_world, p_lair) >= l.size then now()
                                        else l.stocked_at + make_interval(secs => k.restock * v_due) end
        where world_id = p_world and id = p_lair;
    end if;
  end if;
end $$;

/* ---- Examine: the chest and what is in it -------------------------------------------------------------------- */

create or replace function lair_says(p_world uuid, p_x int, p_y int) returns text
language plpgsql stable as $$
declare l lair; k record; v_d double precision; v_n bigint;
begin
  select lr.* into l from lair lr where lr.world_id = p_world
     and (p_x - lr.x) ^ 2 + (p_y - lr.y) ^ 2 <= lair_leash() ^ 2
   order by (p_x - lr.x) ^ 2 + (p_y - lr.y) ^ 2, lr.id limit 1;
  if l.id is null then return ''; end if;
  select * into k from lair_kinds() lk where lk.id = l.kind;
  v_d := sqrt((p_x - l.x) ^ 2 + (p_y - l.y) ^ 2);
  if l.chest is not null then
    select coalesce(sum(i.count), 0) into v_n from item i where i.placed = l.chest and i.holder = 'furniture';
  end if;
  return ' Lair: ' || k.name || case when v_d >= 1 then ' (' || floor(v_d)::int || ' tiles)' else '' end || ': '
    || case l.state
         when 'held' then 'garrison ' || lair_garrison_up(p_world, l.id) || '/' || l.size
         when 'boss' then coalesce(k.boss, (select sd.name from species_def sd where sd.id = k.species)) || ' out'
         else 'cleared, safe ring ' || lair_ring()::int || ' tiles, restock in '
              || wait_words(greatest(1, extract(epoch from (l.cleared_at + make_interval(secs => k.restock) - now()))))
              || case when v_n is null then ''
                      else '; ' || lower((select f.name from furniture_def f where f.id = lair_chest())) || ' ' || v_n
                           || case when v_n = 1 then ' thing' else ' things' end || ', gone at the restock or once emptied' end end
    || '.';
end $$;

/* ---- Nobody's to do anything with ---------------------------------------------------------------------------- */

/*
 * A lair's piece, by its kind: everything refused. Its hoard chest: taken from, one thing or all, by anybody, and
 * nothing else. Asked of the piece, a thing in it, or one a thing is being put into, as `grave_refusal` asks.
 */
create or replace function lair_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $$
declare v_piece bigint; v_kind text; v_name text;
begin
  if p_target->>'kind' = 'furniture' then
    v_piece := nullif(p_target->>'id', '')::bigint;
  elsif p_target->>'kind' = 'item' then
    select i.placed into v_piece from item i
     where i.world_id = p_world and i.id = target_item(p_target) and i.holder = 'furniture';
  end if;
  if v_piece is null and p_target ? 'into' then v_piece := nullif(p_target->>'into', '')::bigint; end if;
  if v_piece is null then return null; end if;
  select pl.sub into v_kind from placed pl where pl.world_id = p_world and pl.id = v_piece and pl.kind = 'furniture';
  if v_kind is null then return null; end if;
  if v_kind = lair_chest() then
    return case when p_action in ('furniture_take_all', 'take_from_store') then null else lair_chest_shut() end;
  end if;
  select k.name into v_name from lair_kinds() k where k.id = v_kind;
  if v_name is null then return null; end if;
  return v_name || ': cannot be moved, taken, used or worked.';
end $$;

-- And no settlement's store, however it is asked (`rpc_store_mark`).
select pg_temp.patch_fn('public.store_markable_refusal(placed)',
  'and not f.stall and coalesce(f.trash, 0) = 0 and not f.cart and f.id <> ''mailbox''',
  'and not f.stall and coalesce(f.trash, 0) = 0 and not f.cart and f.id <> ''mailbox'' and f.id <> lair_chest()');

-- Gone once emptied: after taking it all, and after taking the last of it.
select pg_temp.patch_fn('public.perform_holding(uuid, uuid, text, jsonb)',
  $o$    perform tell(p_world, p_uid, 'Taken from ' || lower(placed_name(p)) || ': ' || v_names || '.', 'event');
$o$,
  $n$    perform tell(p_world, p_uid, 'Taken from ' || lower(placed_name(p)) || ': ' || v_names || '.', 'event');
    -- A lair's hoard chest, gone once emptied (`lair_chest_emptied`).
    perform lair_chest_emptied(p_world, p.id);
$n$);
select pg_temp.patch_fn('public.perform_crate(uuid, uuid, text, jsonb)',
  $o$    -- Honey out of a hive, for the journal.
    if v_it.def = 'honey' and v_it.holder = 'furniture' and v_pl.sub = 'hive' then$o$,
  $n$    -- A lair's hoard chest, gone once emptied (`lair_chest_emptied`).
    if v_it.holder = 'furniture' then perform lair_chest_emptied(p_world, v_pl.id); end if;
    -- Honey out of a hive, for the journal.
    if v_it.def = 'honey' and v_it.holder = 'furniture' and v_pl.sub = 'hive' then$n$);

/* ---- The island this lands on -------------------------------------------------------------------------------- */

do $d$
declare v_cleared int := 0; v_named int; l record;
begin
  -- A name, a dye or a padlock on a lair's piece, off it.
  update placed pl set name = null, dye = null, lock = null
   where pl.kind = 'furniture' and pl.sub in (select k.id from lair_kinds() k)
     and (pl.name is not null or pl.dye is not null or pl.lock is not null);
  get diagnostics v_named = row_count;
  -- A lair already cleared: its hoard handed out at its clearing, so its piece goes and no chest is set down.
  for l in select lr.world_id, lr.id, lr.placed from lair lr where lr.state = 'cleared' and lr.placed is not null order by lr.world_id, lr.id loop
    delete from placed where world_id = l.world_id and id = l.placed;
    update lair set placed = null where world_id = l.world_id and id = l.id;
    v_cleared := v_cleared + 1;
  end loop;
  raise notice 'lairs: % cleared lairs, piece taken down; % lair pieces with a name, dye or padlock taken off', v_cleared, v_named;
end $d$;

select private.lock_doors();

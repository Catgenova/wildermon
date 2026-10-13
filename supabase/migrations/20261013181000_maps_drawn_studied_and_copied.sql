/*
 * Maps (`src/game/cartography.ts`): a square of the island drawn on papyrus.
 *
 * The map window shows only ground you have seen -- the fog of war, which the
 * browser keeps and hands over as `fog`. A map carries somebody's walking onto
 * somebody else's map. The defs just before this crossed the three jobs
 * (`chart_action`: Draw a map, Study map, Copy map), the map and the sheet
 * (`chart_item`, `chart_sheet`), the trade (`chart_skill`), how far a map of a
 * quality reaches (`chart_reach`) and every refusal (`chart_said`). What is
 * here is the doing of it:
 *
 *   * what a map holds is written on its `extra`, as treasure maps write their
 *     tier there and fragments their piece: "14 tiles round 512, 300", which
 *     its name shows (`chart_extra`, read back by `chart_of`);
 *   * Draw a map, aimed at a sheet of papyrus: the square round the tile you
 *     stand on, at `product_ql` of your papyrusmaking with no tool, never above
 *     the sheet's QL; the sheet is used up, papyrusmaking is trained a go's
 *     worth;
 *   * Study map: the square goes into `charted`, one row per square studied by
 *     whom, which the browser reads back with the fog when it comes ashore;
 *     and it is said to the browser now as a `charted` line, which it puts on
 *     the map rather than in the log. The map is not used up;
 *   * Copy map: onto the best sheet of papyrus in the pack (`chart_sheet_for`),
 *     at the roll, never above the original's QL or the sheet's, and reaching
 *     no further than the copy's own QL does;
 *   * Examine on a map says the square and how many tiles studying it adds
 *     (`chart_item_says`).
 *
 * The family is dispatched with treasure maps -- the other map -- through
 * `treasure_action`, `treasure_refusal` and `perform_treasure`, so the big
 * dispatchers are untouched.
 *
 * Everything here that calls a def is plpgsql, which is not checked against
 * the functions it calls until it runs: this goes in before or after the defs
 * that cross `chart_*`, whichever is newer.
 *
 * `supabase/test/maps.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';

/*
 * Every square a map you studied holds, kept as the fog is: yours to read and
 * nobody else's. Written only by `perform_chart`; read back by the browser on
 * the way ashore (`restoreCharted`).
 */
create table if not exists charted (
  world_id uuid not null references world (id) on delete cascade,
  uid uuid not null,
  x int not null,
  y int not null,
  r int not null,
  at timestamptz not null default now(),
  primary key (world_id, uid, x, y, r)
);
alter table charted enable row level security;
drop policy if exists charted_read on charted;
create policy charted_read on charted for select to authenticated
  using (uid = (select auth.uid()));
revoke all on table charted from anon, authenticated;
grant select on table charted to authenticated;

/* ---- what a map holds, and the words for it ---------------------------------------------------------- */

/** What is written on a map's `extra` (`chartExtra`). */
create or replace function chart_extra(p_x int, p_y int, p_r int) returns text language sql immutable as $fn$
  select p_r || ' tiles round ' || p_x || ', ' || p_y
$fn$;

/** And read back: array[x, y, r], or null for anything that is not a map with a square on it (`chartOf`). */
create or replace function chart_of(p_def text, p_extra text) returns int[] language plpgsql immutable as $fn$
declare m text[] := regexp_match(coalesce(p_extra, ''), '^(\d+) tiles round (\d+), (\d+)$');
begin
  if p_def is distinct from chart_item() or m is null then return null; end if;
  return array[m[2]::int, m[3]::int, m[1]::int];
end $fn$;

/** "the 29 by 29 tiles round 512, 300" (`square`). */
create or replace function chart_square(p_x int, p_y int, p_r int) returns text language sql immutable as $fn$
  select 'the ' || (p_r * 2 + 1) || ' by ' || (p_r * 2 + 1) || ' tiles round ' || p_x || ', ' || p_y
$fn$;

/** A QL as the browser prints it: one place (`toFixed(1)`). */
create or replace function chart_ql_text(p_ql double precision) returns text language sql immutable as $fn$
  select to_char(round(p_ql::numeric, 1), 'FM9990.0')
$fn$;

/** What Examine adds of a map (`chartItemSays`). */
create or replace function chart_item_says(p_def text, p_extra text) returns text language sql immutable as $fn$
  select case when c is null then '' else
    ' It holds ' || chart_square(c[1], c[2], c[3]) || ', ' || c[3] || ' each way from where it was drawn. Study it and all '
    || ((c[3] * 2 + 1) * (c[3] * 2 + 1)) || ' of them go on your own map.' end
  from (select chart_of(p_def, p_extra) as c) s
$fn$;

/** What drawing, studying and copying say (`drawnSaid`, `studiedSaid`, `copiedSaid`). */
create or replace function chart_done_said(p_action text, p_x int, p_y int, p_r int, p_ql double precision)
  returns text language sql immutable as $fn$
  select case p_action
    when 'draw_map' then 'You draw ' || chart_square(p_x, p_y, p_r) || ' onto the sheet. (QL ' || chart_ql_text(p_ql)
      || ', ' || p_r || ' tiles each way)'
    when 'study_map' then 'You study the map: ' || chart_square(p_x, p_y, p_r) || ' are on your own map now.'
    else 'You copy the map onto a fresh sheet: ' || chart_square(p_x, p_y, p_r) || '. (QL ' || chart_ql_text(p_ql)
      || ', ' || p_r || ' tiles each way)' end
$fn$;

/**
 * The best sheet of papyrus in the pack, which a copy goes onto (`bestSheet`).
 * Sheets fold into one stack as any stackable thing does, so this is the
 * stack, and a locked one is left alone as a craft leaves it.
 */
create or replace function chart_sheet_for(p_world uuid, p_uid uuid) returns item language plpgsql stable as $fn$
declare v item;
begin
  select i.* into v from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = chart_sheet() and not i.locked
   order by i.ql desc, i.id limit 1;
  return v;
end $fn$;

/** One sheet off a stack, whichever stack it is. */
create or replace function chart_take_sheet(p_id bigint) returns void language plpgsql as $fn$
begin
  delete from item where id = p_id and count <= 1;
  if not found then update item set count = count - 1 where id = p_id; end if;
end $fn$;

/* ---- the three jobs ----------------------------------------------------------------------------------- */

/** Why a map job will not go, or null: the browser's `chartRefusal`, question for question. */
create or replace function chart_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare v_it item;
begin
  v_it := carried(p_world, p_uid, target_item(p_target));
  if p_action = 'draw_map' then
    return case when v_it.def = chart_sheet() then null else chart_said('noSheet') end;
  end if;
  if v_it.def is distinct from chart_item() then return chart_said('notMap'); end if;
  if chart_of(v_it.def, v_it.extra) is null then return chart_said('blank'); end if;
  if p_action = 'copy_map' and (chart_sheet_for(p_world, p_uid)).id is null then return chart_said('noCopySheet'); end if;
  return null;
end $fn$;

create or replace function perform_chart(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
declare v_it item; v_sheet item; p player; c int[]; v_ql double precision; v_x int; v_y int; v_r int;
begin
  if chart_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
  v_it := carried(p_world, p_uid, target_item(p_target));
  if p_action = 'draw_map' then
    select * into p from player where world_id = p_world and uid = p_uid;
    v_ql := greatest(1, least(product_ql(skill_of(p_world, p_uid, chart_skill()), 0), v_it.ql));
    v_x := floor(p.x)::int; v_y := floor(p.y)::int; v_r := chart_reach(v_ql);
    perform chart_take_sheet(v_it.id);
    perform give(p_world, p_uid, chart_item(), 1, v_ql, chart_extra(v_x, v_y, v_r));
    perform skill_raise(p_world, p_uid, chart_skill(), 1);
    perform tell(p_world, p_uid, chart_done_said(p_action, v_x, v_y, v_r, v_ql), 'event');
    return;
  end if;
  c := chart_of(v_it.def, v_it.extra);
  if p_action = 'study_map' then
    insert into charted (world_id, uid, x, y, r) values (p_world, p_uid, c[1], c[2], c[3])
      on conflict (world_id, uid, x, y, r) do update set at = now();
    perform tell(p_world, p_uid, chart_done_said(p_action, c[1], c[2], c[3], v_it.ql), 'event');
    -- And to the browser, which puts it on the map rather than in the log.
    perform tell(p_world, p_uid, jsonb_build_object('x', c[1], 'y', c[2], 'r', c[3])::text, 'charted');
    return;
  end if;
  -- Copy map.
  v_sheet := chart_sheet_for(p_world, p_uid);
  v_ql := greatest(1, least(product_ql(skill_of(p_world, p_uid, chart_skill()), 0), v_sheet.ql, v_it.ql));
  v_r := least(c[3], chart_reach(v_ql));
  perform chart_take_sheet(v_sheet.id);
  perform give(p_world, p_uid, chart_item(), 1, v_ql, chart_extra(c[1], c[2], v_r));
  perform skill_raise(p_world, p_uid, chart_skill(), 1);
  perform tell(p_world, p_uid, chart_done_said(p_action, c[1], c[2], v_r, v_ql), 'event');
end $fn$;

/* ---- dispatched with treasure maps ------------------------------------------------------------------- */

/* treasure_action: from 20260916330000_a_map_is_a_picture.sql, the newest that defines it. With the three map jobs. */
-- plpgsql rather than sql, so that it is not checked against `chart_action` before the defs that make it have run.
CREATE OR REPLACE FUNCTION public.treasure_action(p_action text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$ begin return p_action = 'unearth' or chart_action(p_action); end $function$;

/* treasure_refusal: from 20260917140000_one_name_for_the_thing_in_your_hand.sql, the newest that defines it. With a map drawn on papyrus. */
CREATE OR REPLACE FUNCTION public.treasure_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare v_map item; v_t treasure; p player; v_d double precision; v_say text;
begin
  -- Maps drawn on papyrus, the other map (`cartography.ts`).
  if chart_action(p_action) then
    return chart_refusal(p_world, p_uid, p_action, p_target);
  end if;
  v_map := carried(p_world, p_uid, target_item(p_target));
  if v_map.id is null then return 'You are not holding a map.'; end if;
  if v_map.def <> 'treasure_map' then return 'That is not a map.'; end if;
  v_t := treasure_at(v_map.id);
  if v_t.item_id is null then
    return 'The hide is worn blank. Whatever was drawn on it is gone.';
  end if;
  select * into p from player where world_id = p_world and uid = p_uid;
  if not found then return 'You are not on this island.'; end if;
  v_d := sqrt((p.x - (v_t.x + 0.5)) ^ 2 + (p.y - (v_t.y + 0.5)) ^ 2);
  if v_d <= unearth_reach() then return null; end if;
  select b.say into v_say from map_band b where v_d <= b.within order by b.ord limit 1;
  return coalesce(v_say, 'Nothing here looks anything like the map.');
end $function$;

/* perform_treasure: from 20260917140000_one_name_for_the_thing_in_your_hand.sql, the newest that defines it. With a map drawn on papyrus. */
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
  perform tell(p_world, p_uid, 'The spade goes through rotten board and the hoard is open — '
    || v_tier.lumps || ' lump' || case when v_tier.lumps = 1 then '' else 's' end
    || ' and ' || v_tier.things || ' thing' || case when v_tier.things = 1 then '' else 's' end
    || ' lying where they fell. And something was left to watch over it.', 'event');
  perform land_announce(p_world, v_t.x, v_t.y);
end $function$;

/* examine_item_text: from 20261011060546_memorial_stones.sql, the newest that defines it. With the square a map holds. */
CREATE OR REPLACE FUNCTION public.examine_item_text(p_world uuid, p_uid uuid, it item)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare d item_def; m material_def; r rarity_def; v_worth double precision;
        v_skill text; v_out text;
begin
  select * into d from item_def where id = it.def;
  if not found then return 'It is nothing you have a name for.'; end if;
  m := mat_of(it.extra);
  select * into r from rarity_def where id = it.rare;
  v_worth := tool_worth(it.ql, it.dmg, it.extra, it.rare, it.bless);

  v_out := item_name(it) || ': QL ' || to_char(it.ql, 'FM990.00')
    || ', damage ' || to_char(it.dmg, 'FM990.00')
    || ', weight ' || to_char(item_weight(it), 'FM990.00') || ' kg.';
  if d.category = 'tool' and abs(v_worth - it.ql) >= 0.05 then
    v_out := v_out || ' It works as a ' || to_char(v_worth, 'FM990.0') || ' today.';
  end if;
  if d.description is not null then v_out := v_out || ' ' || d.description; end if;
  -- What dye is in it, or what colour it was dyed (`dyestuffs.ts`).
  v_out := v_out || dye_item_says(it);
  if r.id is not null then
    v_out := v_out || ' It is ' || r.id || ': better at what it is for by a '
      || case when r.boost > 1.3 then 'half' when r.boost > 1.15 then 'quarter' else 'tenth' end
      || ', slower to wear and to rot, and can be bettered ' || to_char(r.ceiling, 'FM990')
      || ' past your own skill.';
  end if;
  -- Rare work is signed.
  if it.maker is not null then v_out := v_out || ' Made by ' || it.maker || '.'; end if;
  -- And what a maker's perks put into it.
  v_out := v_out || mark_says(it.mark);
  -- And what is enchanted into it, at its quality (`enchantSays`).
  v_out := v_out || enchant_says(it.enchant);
  -- And the line cut into a memorial stone (`engravedItemSays`).
  v_out := v_out || engraved_item_says(it.engraving);
  -- And the square a map holds (`cartography.ts`).
  v_out := v_out || chart_item_says(it.def, it.extra);
  v_skill := boon_of((select seed from world where id = p_world), it.def);
  if v_skill is not null then
    v_out := v_out || ' It favours '
      || lower(coalesce((select name from skill_def where id = v_skill), v_skill)) || '.';
  end if;
  -- What it is made of is half of what it is — when it is made of anything.
  if m.name is not null and m.note is not null then
    v_out := v_out || ' ' || m.name || ': ' || m.note;
  end if;
  -- And to a Cook's tongue, what a helping of it does (a Cook's Taste).
  if pk(p_world, p_uid, 'taste', 0) > 0 then v_out := v_out || taste_says(p_world, it); end if;
  return v_out;
end $function$;

select private.lock_doors();

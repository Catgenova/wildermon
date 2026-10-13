/*
 * Signed masterworks (`src/game/signing.ts`) and dyed glass in a window
 * (`src/game/dyes.ts`, `TINTED_PANE`).
 *
 * The defs cross the job (`sign_action`, and `memorial_action` now names it
 * beside Engrave, so it is dispatched with the stone's two and the big
 * dispatchers are untouched), the QL a thing is made at to carry its maker's
 * name (`sign_ql`), the longest line (`sign_max`), every sentence
 * (`sign_said`, `sign_not_yours_said`, `signed_said`, `maker_says`), the pane
 * a window takes the colour of (`tinted_pane`), and a glass panel among what
 * takes a dye, at its own litres (`dyeable_item`, `dye_size_def`,
 * `dye_litres_def`). What is here is the doing of it:
 *
 *   * `made_by`: the maker's name a thing just made carries -- rare work, as
 *     `maker_mark` always gave it, and one thing (not a pile) made at
 *     `sign_ql()` or better. The bench (`perform_craft`) and the anvil
 *     (`perform_forge`) write it on; the browser's `madeBy`;
 *   * Sign (`sign_refusal`, `perform_sign`): a thing loose in the pack, one
 *     thing and not a piece of furniture (`signable_kind`), carrying a maker
 *     and at `sign_ql()` or better, signed by the one its maker's name is and
 *     nobody else, once, and never by somebody a keeper has muted; its line
 *     cleaned as talk is (`sign_clean`, a memorial stone's cleaning at its
 *     own length) and kept on `item.engraving`, which goes wherever the row
 *     goes. Dispatched through `memorial_refusal` and `perform_memorial`;
 *   * Examine says who made a thing and what they signed it with
 *     (`examine_item_text`, `maker_says`); a memorial stone's line is still
 *     its own (`engraved_item_says`);
 *   * `wall.glass`: the colour of the glass in a window or a bay window, the
 *     colour of the last pane fitted into it. `take_material` notes the dye
 *     of the pane it takes (`pane_taken`, a setting local to the
 *     transaction), and `wall_glass_tint` puts it on the wall as its glass
 *     bill goes down -- so `perform_building` is untouched. The ground read
 *     says it on the wall (`wall_gear`), and the browser tints the panes.
 *
 * Everything here that calls a def is plpgsql, which is not checked against
 * the functions it calls until it runs: this goes in before or after the defs
 * that cross them, whichever is newer.
 *
 * `supabase/test/signed.ts` and `supabase/test/dyedglass.ts` hold the two
 * sides to each other.
 */
set local lock_timeout = '3s';

alter table wall add column if not exists glass text;

/* ---- signed masterworks ------------------------------------------------------------------------------- */

/** Whether a thing of this kind is ever signed: one thing, not a pile, and not a piece of furniture (`signableKind`). */
create or replace function signable_kind(p_def text) returns boolean language sql stable as $fn$
  select not coalesce((select d.stackable from item_def d where d.id = p_def), true)
     and not exists (select 1 from furniture_def f where f.id = p_def)
$fn$;

/** The maker's name a thing just made carries, or null: rare work, and one thing made at `sign_ql()` or better (`madeBy`). */
create or replace function made_by(p_world uuid, p_uid uuid, p_rare text, p_item text, p_ql double precision) returns text
language plpgsql stable as $fn$
begin
  if p_rare is null and (p_ql < sign_ql() or coalesce(item_stackable(p_item), false)) then return null; end if;
  return (select p.name from player p where p.world_id = p_world and p.uid = p_uid);
end $fn$;

/** A line as it will be signed: `rpc_say`'s cleaning, at a signature's own length (`cleanSignature`). */
create or replace function sign_clean(p_text text) returns text language plpgsql immutable as $fn$
begin
  return left(btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[\r\n\t]+', ' ', 'g'), '\s{2,}', ' ', 'g')), sign_max());
end $fn$;

/**
 * Why a thing cannot be signed now, or null: the browser's `signRefusal`,
 * question for question -- there, made at the QL, by you, not signed yet, and
 * the words. And muted, which only an island has keepers to say.
 */
create or replace function sign_refusal(p_world uuid, p_uid uuid, p_target jsonb) returns text
language plpgsql stable as $fn$
declare it item; v_me text; v_why text;
begin
  select * into it from item where world_id = p_world and id = target_item(p_target)
    and holder = 'player' and holder_uid = p_uid;
  if not found then return 'It is gone.'; end if;
  if it.maker is null or not signable_kind(it.def) or it.ql < sign_ql() then return sign_said('notMade'); end if;
  select p.name into v_me from player p where p.world_id = p_world and p.uid = p_uid;
  if it.maker is distinct from v_me then return sign_not_yours_said(it.maker); end if;
  if coalesce(it.engraving, '') <> '' then return sign_said('signed'); end if;
  v_why := private.muted_why(p_world, p_uid);
  if v_why is not null then return v_why; end if;
  if p_target->>'name' is null then return null; end if;
  if sign_clean(p_target->>'name') = '' then return sign_said('nothing'); end if;
  return null;
end $fn$;

create or replace function perform_sign(p_world uuid, p_uid uuid, p_target jsonb) returns void
language plpgsql as $fn$
declare v_text text;
begin
  if sign_refusal(p_world, p_uid, p_target) is not null then return; end if;
  v_text := sign_clean(p_target->>'name');
  if v_text = '' then return; end if;
  update item set engraving = v_text where world_id = p_world and id = target_item(p_target)
    and holder = 'player' and holder_uid = p_uid and engraving is null;
  if not found then return; end if;
  perform tell(p_world, p_uid, signed_said(v_text), 'event');
end $fn$;

/* ---- dyed glass --------------------------------------------------------------------------------------- */

/** Note the colour of the pane just taken, or that it was clear, for the window it goes into (`wall_glass_tint`). */
create or replace function pane_taken(p_dye text) returns void language plpgsql as $fn$
begin
  perform set_config('wurm.pane', coalesce(p_dye, ''), true);
end $fn$;

/**
 * A window's or a bay window's glass is the colour of the last pane fitted
 * into it (`build_wall`, `paneTint`): as its glass bill goes down, the colour
 * `take_material` noted, or clear.
 */
create or replace function wall_glass_tint() returns trigger language plpgsql as $fn$
begin
  new.glass := nullif(current_setting('wurm.pane', true), '');
  return new;
end $fn$;

drop trigger if exists wall_glass_tint on wall;
create trigger wall_glass_tint before update of needed on wall for each row
  when (coalesce((new.needed->>'glass')::int, 0) < coalesce((old.needed->>'glass')::int, 0))
  execute function wall_glass_tint();

/* take_material(6): from 20260927020525_the_mason_moved_onto_perks.sql, the newest that defines it. With the colour of a pane taken. */
CREATE OR REPLACE FUNCTION public.take_material(p_world uuid, p_uid uuid, p_item text, p_x integer, p_y integer, p_material text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
declare v_id bigint; v_pane boolean := p_item = tinted_pane();
begin
  if pack_count(p_world, p_uid, p_item) > 0 then
    -- Dyed glass: the colour of the pane `consume` is about to take, the lowest numbered loose one (`pane_taken`).
    if v_pane then
      perform pane_taken((select i.dye from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                            and i.def = p_item and not i.locked order by i.id limit 1));
    end if;
    return consume(p_world, p_uid, p_item, 1);
  end if;
  -- And of the one `site_take` is about to take out of the crate on the site.
  if v_pane then
    perform pane_taken((select i.dye from crate c
      join item i on i.world_id = c.world_id and i.holder = 'crate' and i.crate = c.id and i.def = p_item
     where c.world_id = p_world and c.x = p_x and c.y = p_y and i.count > 0 order by i.ql, i.id limit 1));
  end if;
  if site_take(p_world, p_x, p_y, p_item) then return true; end if;
  select h.id into v_id from hod_stock(p_world, p_uid, p_item, build_reach(p_world, p_uid, p_material)) h
   order by h.draw limit 1;
  if v_id is null then return false; end if;
  -- And of the one out of a Hod Carrier's stores.
  if v_pane then perform pane_taken((select i.dye from item i where i.id = v_id)); end if;
  update item set count = count - 1 where id = v_id and count > 1;
  if found then return true; end if;
  delete from item where id = v_id;
  return found;
end $function$;

/* wall_gear: from 20261002180114_portcullis_drawbridge_and_hidden_doors.sql, the newest that defines it. With the colour of the glass. */
CREATE OR REPLACE FUNCTION public.wall_gear(p_world uuid, p_uid uuid, w wall)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select case when w.lowered then jsonb_build_object('lowered', true) else '{}'::jsonb end
      || case when w.lock is null then '{}'::jsonb
              when wall_seen_type(p_world, p_uid, w) = 'solid' then '{}'::jsonb
              else jsonb_build_object('lock', w.lock) end
      -- Dyed glass: the colour of a window's or a bay window's glass (`Wall.glass`).
      || case when w.glass is null then '{}'::jsonb else jsonb_build_object('glass', w.glass) end
$function$;

/* ---- the newest definitions, with signing ------------------------------------------------------------ */

/* memorial_refusal: from 20261011060546_memorial_stones.sql, the newest that defines it. With Sign. */
CREATE OR REPLACE FUNCTION public.memorial_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare pl placed; v_why text; v_text text;
begin
  -- Signing a masterwork, dispatched with the stone's two (`signing.ts`).
  if p_action = sign_action() then return sign_refusal(p_world, p_uid, p_target); end if;
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint
    and kind = 'furniture' and sub = memorial_kind();
  if not found then return 'It is gone.'; end if;
  if not placed_in_reach(p_world, p_uid, pl.id) then
    return lamp_too_far_said(lower((select f.name from furniture_def f where f.id = pl.sub)));
  end if;
  if p_action <> 'engrave_memorial' then return null; end if;
  if not may_engrave(p_world, p_uid, pl) then return memorial_said('notYours'); end if;
  v_why := private.muted_why(p_world, p_uid);
  if v_why is not null then return v_why; end if;
  if not exists (select 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                   and i.def = engrave_tool()) then
    return memorial_said('noChisel');
  end if;
  if p_target->>'name' is null then return null; end if;
  v_text := memorial_clean(p_target->>'name');
  if v_text = '' then return memorial_said('nothing'); end if;
  if v_text = pl.engraving then return memorial_said('same'); end if;
  return null;
end $function$;

/* perform_memorial: from 20261011060546_memorial_stones.sql, the newest that defines it. With Sign. */
CREATE OR REPLACE FUNCTION public.perform_memorial(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare pl placed; v_text text;
begin
  -- Signing a masterwork, dispatched with the stone's two (`signing.ts`).
  if p_action = sign_action() then
    perform perform_sign(p_world, p_uid, p_target);
    return;
  end if;
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint
    and kind = 'furniture' and sub = memorial_kind() for update;
  if not found then return; end if;
  if p_action = 'read_memorial' then
    perform tell(p_world, p_uid, memorial_says(pl.engraving), 'event');
    return;
  end if;
  v_text := memorial_clean(p_target->>'name');
  if v_text = '' or v_text is not distinct from pl.engraving then return; end if;
  update placed set engraving = v_text where id = pl.id;
  perform tell(p_world, p_uid, engraved_said(v_text, pl.engraving is not null), 'event');
  -- A go's worth of masonry and of the chisel, as the browser's finished job takes them.
  perform skill_raise(p_world, p_uid, engrave_skill(), 1);
  perform wear_tool((select i.id from item i where i.world_id = p_world and i.holder = 'player'
    and i.holder_uid = p_uid and i.def = engrave_tool()
    order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1), 1);
  perform land_announce(p_world, pl.x, pl.y);
end $function$;

/* examine_item_text: from 20261013181000_maps_drawn_studied_and_copied.sql, the newest that defines it. With a signed masterwork. */
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
  -- Rare work, and one thing made at the signing QL, carries its maker's name, and the line it was signed with (`makerSays`).
  v_out := v_out || maker_says(it.maker, case when signable_kind(it.def) then it.engraving end);
  -- And what a maker's perks put into it.
  v_out := v_out || mark_says(it.mark);
  -- And what is enchanted into it, at its quality (`enchantSays`).
  v_out := v_out || enchant_says(it.enchant);
  -- And the line cut into a memorial stone (`engravedItemSays`).
  if not signable_kind(it.def) then v_out := v_out || engraved_item_says(it.engraving); end if;
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

/* perform_craft: from 20261011031657_enchanted_where_it_stands.sql, the newest that defines it. With the maker's name on one thing made at the signing QL. */
CREATE OR REPLACE FUNCTION public.perform_craft(p_world uuid, p_uid uuid, p_recipe text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare r recipe; i record; v_n int; prefer bigint; mat text; hard double precision; tq double precision;
        s double precision; made_ql double precision; rare text; total double precision := 0;
        v_made bigint; weight double precision := 0; one double precision; share double precision;
        only_mat boolean; was text; v_base int; spared boolean := false; v_mark jsonb;
        v_parts jsonb := '{}'::jsonb; v_part jsonb; v_own jsonb; v_lye double precision; v_kept boolean := false;
        v_keep double precision; v_spare recipe_input; v_spare_ql double precision;
        v_tool bigint; v_tool_mark jsonb; v_stone boolean := false;
        v_scroll boolean; v_sheet double precision; v_harm text;
begin
  select * into r from recipe where id = p_recipe;
  prefer := target_item(p_target);
  -- What the run is aimed at, while it is still there to ask.
  select it.def into was from item it where it.id = prefer and it.world_id = p_world;
  mat := craft_material(p_world, p_uid, p_recipe, prefer);
  s := skill_of(p_world, p_uid, r.skill);
  tq := case when r.tool is null then 0 else tool_ql(p_world, p_uid, r.tool) end;
  /*
   * The tool wears on every go, whether or not the go comes off, as it does in
   * the hand and always has in the browser (`Game.act`). The island's bench
   * never wore anything, so a saw sawed for ever -- and a Carpenter's Saw
   * Care, which is how much less it wears (`wear_tool`), spared nothing.
   */
  if r.tool is not null then
    -- The one it is done with, and what its maker put into it, read before it
    -- is worn: a pot's, a bowl's or a jar's (an Artisan's Deep Pot and Sealed Jar).
    v_tool := held_tool(p_world, p_uid, r.tool);
    select it.mark into v_tool_mark from item it where it.id = v_tool;
    perform wear_tool(v_tool);
  end if;
  -- Oak and the deep metals fight the hands that shape them.
  hard := craft_hardness(p_recipe, mat);
  -- Bars broken into for what loose lumps are short of (a Smith's Ingots),
  -- before anything reads the lumps: what they weigh in the quality, and what
  -- a failed batch throws away.
  for i in select ri.item, ri.count from recipe_input ri join metal_def m on m.lump = ri.item where ri.recipe = p_recipe loop
    perform break_bars(p_world, p_uid, i.item,
      recipe_need(p_world, p_uid, p_recipe, i.count) - craft_count_loose(p_world, p_uid, i.item, null, prefer), prefer);
  end loop;

  -- An enchantment scroll (`enchant.ts`), and the sheet it would be written on, read before anything is spent.
  v_scroll := exists (select 1 from enchantments() e where e.scroll = r.result);
  if v_scroll then
    select st.ql into v_sheet from craft_stock(p_world, p_uid, prefer) st
     where st.def = 'papyrus' order by (st.id = prefer) desc, st.draw limit 1;
  end if;

  -- A Mason's Sure Chisel fails half as often on stonecutting (`fail:` and the recipe).
  if r.difficulty is not null and not perk_pass(skill_check(s, hard, tq), pk(p_world, p_uid, 'fail:' || p_recipe, 1)) then
    -- A scroll that fails loses its motes and damages the sheet it was being written on (`scroll_fails`).
    if v_scroll then
      v_harm := scroll_fails(p_world, p_uid, p_recipe, prefer);
      perform craft_carry_on(p_world, p_uid, p_recipe, p_target, was, mat);
      perform skill_raise(p_world, p_uid, r.skill, try_gain(false));
      perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, craft_head()));
      perform tell(p_world, p_uid, concat_ws(' ', r.fail, nullif(scroll_harm_said(v_harm), '')), 'event');
      return;
    end if;
    -- And a Mason's Nothing Wasted keeps what went into a failed smelter or kiln.
    spared := r.consume_on_fail and random() < pk(p_world, p_uid, 'spare:' || p_recipe, 0);
    -- And the stone out of it whole, whatever else is lost, for an Artisan's Keep the Stone.
    v_stone := r.consume_on_fail and not spared and pk(p_world, p_uid, 'stone:' || p_recipe, 0) > 0
               and exists (select 1 from recipe_input where recipe = p_recipe and item = 'gem');
    if r.consume_on_fail and not spared then
      for i in select * from recipe_input where recipe = p_recipe order by ord loop
        continue when v_stone and i.item = 'gem';
        perform craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat);
      end loop;
      -- The batch is wasted, not the vessel: you tip the ruin out and keep the
      -- bucket. Salvage if the recipe names any, otherwise whatever it returns.
      for i in
        select g.item, g.count from recipe_gives g
        where g.recipe = p_recipe
          and g.kind = (case when exists (select 1 from recipe_gives where recipe = p_recipe and kind = 'salvage')
                             then 'salvage' else 'return' end)
      loop
        perform give(p_world, p_uid, i.item, i.count, 20);
      end loop;
      perform craft_carry_on(p_world, p_uid, p_recipe, p_target, was, mat);
    end if;
    perform skill_raise(p_world, p_uid, r.skill, try_gain(false));
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(false, craft_head()));
    perform tell(p_world, p_uid, case when v_stone
      then 'The claw goes over too far and the silver is spoiled, but you have the stone out whole.'
      else coalesce(r.fail, 'You fail to make ' || lower((select coalesce(name, r.result) from item_def where id = r.result)) || '.') end,
      'event');
    if spared then perform tell(p_world, p_uid, 'Nothing that went into it is lost.', 'event'); end if;
    return;
  end if;

  -- The quality of what is about to be used up, worked out before it is used
  -- up, since using it up changes the answer: off the stack each input would
  -- be spent from first, which is the clicked one where it is one of them.
  if r.ql_from_inputs then
    for i in select * from recipe_input where recipe = p_recipe order by ord loop
      only_mat := mat is not null and craft_count(p_world, p_uid, i.item, mat, prefer) >= recipe_need(p_world, p_uid, p_recipe, i.count);
      select st.ql into one from craft_stock(p_world, p_uid, prefer) st
        where st.def = i.item and (not only_mat or st.extra is not distinct from mat)
        order by (st.id = prefer) desc, st.draw limit 1;
      if one is not null then
        -- By mass, not by the count. Two nails weigh two hundredths of a
        -- kilogram between them and do not get to decide what a pickaxe is.
        share := coalesce((select d.weight from item_def d where d.id = i.item), 1) * i.count;
        total := total + one * share;
        weight := weight + share;
      end if;
    end loop;
  end if;

  /*
   * What the parts carry of their makers' marks, off the stack each would be
   * spent from first, before spending them: a Smith's Keen Edge in a sword
   * blade goes into the sword whoever fits it. Only the parts the anvil beats
   * out, which are the only ones that carry a mark into anything, and only for
   * a thing made one at a time, which has a row to carry it; the larger where
   * two say the same, and never a temper, which is for whoever finishes it,
   * nor a seal or a glaze, which is on the part and not on what it goes into.
   */
  if not item_stackable(r.result) then
    for i in select ri.* from recipe_input ri where ri.recipe = p_recipe
               and (exists (select 1 from mould_def md where md.makes = ri.item)
                    -- And a yoke's pace into the cart or wagon it goes on (a Tailor's Saddler).
                    or ri.item in ('yoke')) order by ri.ord loop
      only_mat := mat is not null and craft_count(p_world, p_uid, i.item, mat, prefer) >= recipe_need(p_world, p_uid, p_recipe, i.count);
      select it.mark into v_part from craft_stock(p_world, p_uid, prefer) st join item it on it.id = st.id
        where st.def = i.item and (not only_mat or st.extra is not distinct from mat)
        order by (st.id = prefer) desc, st.draw limit 1;
      if v_part is not null then
        select v_parts || coalesce(jsonb_object_agg(k.key, greatest(k.value::text::double precision,
                 coalesce((v_parts->>k.key)::double precision, k.value::text::double precision))), '{}'::jsonb)
          into v_parts
          from jsonb_each(v_part - 'temper' - 'seal' - 'glaze') k;
      end if;
    end loop;
  end if;
  /*
   * A Cook's Frugal Cook: one of the first ingredient that is not a vessel
   * back now and then, at the quality of the stack it would be spent from
   * first -- asked before the spending, which changes the answer. Only asked
   * of a recipe the perk is on.
   */
  v_keep := pk(p_world, p_uid, 'keep:' || p_recipe, 0);
  if v_keep > 0 then
    select ri.* into v_spare from recipe_input ri
     where ri.recipe = p_recipe and ri.item <> 'bucket'
       and not exists (select 1 from vessel_def v where v.item = ri.item)
     order by ri.ord limit 1;
    if v_spare.item is not null then
      only_mat := mat is not null and craft_count(p_world, p_uid, v_spare.item, mat, prefer) >= recipe_need(p_world, p_uid, p_recipe, v_spare.count);
      select st.ql into v_spare_ql from craft_stock(p_world, p_uid, prefer) st
        where st.def = v_spare.item and (not only_mat or st.extra is not distinct from mat)
        order by (st.id = prefer) desc, st.draw limit 1;
    end if;
  end if;
  -- A Tailor's Lye Saver: now and then the vessel's liquid is not used up,
  -- and the full vessel stays as it was rather than coming back empty.
  v_lye := pk(p_world, p_uid, 'lye:' || p_recipe, 0);
  v_kept := v_lye > 0 and random() < v_lye;
  for i in select * from recipe_input where recipe = p_recipe order by ord loop
    continue when v_kept and exists (select 1 from vessel_def v where v.item = i.item);
    if not craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat) then return; end if;
  end loop;
  perform craft_carry_on(p_world, p_uid, p_recipe, p_target, was, mat);

  if r.ql_from_inputs then
    made_ql := greatest(1, least(100, (case when weight > 0 then total / weight else 1 end) * (0.78 + s / 460)));
  else
    made_ql := product_ql(s, tq);
  end if;
  -- And the tree, on the trade the recipe belongs to: the quality of what came
  -- off the bench, however it was arrived at. A hundred is still a hundred.
  made_ql := least(100, made_ql * class_mul(p_world, p_uid, 'fine', r.skill));
  -- And better for a perk on the recipe (a Cook's Fine Fare).
  -- And higher for a Masterwork on the station it is made at (`station_master`).
  made_ql := least(100, made_ql * pk(p_world, p_uid, 'ql:' || p_recipe, 1) + station_master(p_world, p_uid, r.station));
  -- And a scroll never better than the sheet it was written on.
  if v_scroll and v_sheet is not null then made_ql := least(made_ql, v_sheet); end if;
  -- A Carpenter's Master Joiner: the first step of rarity at better odds on the joinery (`rare:` and the recipe).
  rare := perk_rare(pk(p_world, p_uid, 'rare:' || p_recipe, (select d.odds from rarity_def d order by d.ord limit 1)));
  -- More, the go a bauble on the trade comes up in the altar of the settlement you work on.
  -- A Mason's Three from a Shard and Good Mix: more of it at a go (`count:` and what it makes).
  v_base := pk(p_world, p_uid, 'count:' || r.result, r.count)::int;
  -- And a serving more of a dish cooked in a pot or a bowl its maker had Deep Pot for, whoever cooks.
  if is_dish(r.result) then v_base := v_base + floor(coalesce((v_tool_mark->>'serve')::double precision, 0))::int; end if;
  -- But not on a dye boil, which fills the one bucket it is done in (`boiledDye`).
  v_n := case when r.result = 'dye_bucket' then v_base else bauble_yield(p_world, p_uid, r.result, v_base) end;
  /*
   * What the maker's perks put into it, which stays with it whoever has it
   * after (a Carpenter's Deep Drawers, Keel Layer, True Bow; a Cook's Hearty),
   * over what its parts carried (a Smith's Keen Edge). A pile of the same
   * thing marked the same way is one pile, so a thing made by the handful goes
   * into the pack with its mark and stacks by it; a thing made one at a time
   * is a row of its own and takes it after.
   */
  v_own := coalesce(made_mark((select pl.class_mul from player pl
                                where pl.world_id = p_world and pl.uid = p_uid), r.result), '{}'::jsonb);
  v_mark := v_parts || v_own;
  -- A pace is multiplied, since a yoke's and a builder's are two reasons to go
  -- faster; the maker's own stands over the parts' in everything else.
  if v_parts ? 'speed' and v_own ? 'speed' then
    v_mark := jsonb_set(v_mark, '{speed}', to_jsonb((v_parts->>'speed')::double precision * (v_own->>'speed')::double precision));
  end if;
  -- And what is put up in a jar its maker had Sealed Jar for rots the slower for it.
  if v_tool_mark ? 'keeps' then
    v_mark := v_mark || jsonb_build_object('rot', mark_of(v_mark, 'rot') * mark_of(v_tool_mark, 'keeps'));
  end if;
  v_mark := nullif(v_mark, '{}'::jsonb);
  if item_stackable(r.result) then
    v_made := give(p_world, p_uid, r.result, v_n, made_ql, coalesce(r.extra, mat), rare, maker_mark(p_world, p_uid, rare), null, v_mark);
  else
    -- One thing made at the signing QL carries its maker's name, as rare work does (`made_by`).
    v_made := give(p_world, p_uid, r.result, v_n, made_ql, coalesce(r.extra, mat), rare, made_by(p_world, p_uid, rare, r.result, made_ql));
    if v_mark is not null then update item set mark = v_mark where id = v_made; end if;
  end if;
  -- A boil leaves its dye in the bucket it was boiled in (`boiledDye`).
  if r.result = 'dye_bucket' then perform dye_boiled(p_world, p_uid, v_made, p_recipe); end if;
  -- A vessel comes off the bench full: a bucket of juice holds its five drinks.
  update item set charges = d.charges from item_def d
    where item.id = v_made and item.charges is null and d.id = item.def and d.charges is not null;
  -- Into the ledger, which is the only memory this island has of what you have
  -- made. It says so when it is your first of a kind or your best.
  perform journal_made(p_world, p_uid, r.result, made_ql, v_n, rare);
  if rare is not null then
    perform journal_note(p_world, p_uid, rare);
    perform tell(p_world, p_uid, rarity_word(rare), 'skill');
  end if;
  for i in select g.item, g.count from recipe_gives g where g.recipe = p_recipe and g.kind = 'return' loop
    continue when v_kept and exists (select 1 from recipe_input ri join vessel_def v on v.item = ri.item
                                      where ri.recipe = p_recipe and v.empty = i.item);
    perform give(p_world, p_uid, i.item, i.count, 20);
  end loop;
  if v_kept then perform tell(p_world, p_uid, 'There is enough left in the bucket for another.', 'event'); end if;
  if v_spare.item is not null and random() < v_keep then
    perform give(p_world, p_uid, v_spare.item, 1, coalesce(v_spare_ql, made_ql));
    perform tell(p_world, p_uid, 'You save '
      || case when lower((select coalesce(name, v_spare.item) from item_def where id = v_spare.item)) ~ '^[aeiou]' then 'an ' else 'a ' end
      || lower((select coalesce(name, v_spare.item) from item_def where id = v_spare.item)) || ' from the pot.', 'event');
  end if;

  perform skill_raise(p_world, p_uid, r.skill, 1);
  -- Working a thing out with your hands is what sharpens the head.
  perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, craft_head()));
  perform tell(p_world, p_uid, count_said(r.done, r.count, v_base) || ' (' || case when mat is not null then lower(mat) || ', ' else '' end
    || 'QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');
end $function$;

/* perform_forge: from 20261011031657_enchanted_where_it_stands.sql, the newest that defines it. With the maker's name on one thing made at the signing QL. */
CREATE OR REPLACE FUNCTION public.perform_forge(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_struck boolean; v_pure boolean; p placed; it item; v_mould item; d mould_def; v_lump item; m metal_def; v_cast item;
        v_per double precision; v_room double precision; v_fits int; v_whole int;
        v_ql double precision; v_mould_ql double precision; v_hard double precision;
        v_rare text; v_made bigint; v_broke boolean; v_sz int[]; v_sx int; v_sy int; v_left double precision;
        v_count int; v_kept boolean;
begin
  if p_action in ('fuel_oven', 'light_oven', 'put_out_oven', 'take_ashes_oven') then
    perform placed_settle((p_target->>'id')::bigint);
    select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;

    if p_action = 'fuel_oven' then
      select i.* into it from craft_stock(p_world, p_uid, target_item(p_target)) s join item i on i.id = s.id
        where fuel_value(s.def) is not null
          and (target_item(p_target) is null or s.id = target_item(p_target))
        order by s.draw limit 1;
      if not found then return; end if;
      v_per := fuel_value(it.def);
      v_room := greatest(0, hearth_capacity(p) - p.fuel);
      v_fits := greatest(1, least(least(coalesce((p_target->>'count')::int, 1), it.count),
                                  ceil(v_room / v_per)::int));
      if not spend_stack(p_world, p_uid, it.id, v_fits) then return; end if;
      update placed set fuel = least(hearth_capacity(p), p.fuel + v_per * v_fits), since = now()
        where id = p.id;
      perform tell(p_world, p_uid, 'You feed '
        || case when v_fits > 1 then v_fits || ' × ' else 'a ' end
        || lower((select name from item_def where id = it.def)) || ' into the oven. '
        || oven_burns_for(least(hearth_capacity(p), p.fuel + v_per * v_fits) / placed_burn_rate(p)) || ' of fuel.', 'event');

    elsif p_action = 'light_oven' then
      update placed set lit = true, since = now() where id = p.id;
      perform tell(p_world, p_uid, 'The oven draws and the fire takes hold. '
        || oven_burns_for(p.fuel) || ' of fuel.', 'event');

    elsif p_action = 'put_out_oven' then
      update placed set lit = false, since = now() where id = p.id;
      perform tell(p_world, p_uid,
        'You rake the fire out of the oven. It will keep its heat for nobody.', 'event');

    elsif p_action = 'take_ashes_oven' then
      v_whole := floor(p.ash)::int;
      update placed set ash = p.ash - v_whole, since = now() where id = p.id;
      perform give(p_world, p_uid, 'ash', v_whole, 20);
      perform tell(p_world, p_uid, 'You rake ' || v_whole
        || case when v_whole = 1 then ' lot' else ' lots' end
        || ' of ashes out of the oven. (QL 20)', 'event');
    end if;
    return;
  end if;

  if p_action in ('candle_lantern', 'light_lantern', 'douse_lantern') then
    perform lantern_settle(target_item(p_target));
    select * into it from item where world_id = p_world and id = target_item(p_target);
    if not found then return; end if;
    if p_action = 'candle_lantern' then
      if not consume(p_world, p_uid, 'candle', 1) then return; end if;
      update item set charges = round(held_burn(it))::int, lit = false, lit_at = null
        where id = it.id;
      perform tell(p_world, p_uid, 'You set a candle in the lantern. '
        || ceil(held_burn(it) / 60) || ' minutes of it, at a guess.', 'event');
    elsif p_action = 'light_lantern' then
      -- A torch is wound and then lit; the pitch in it only starts burning at
      -- the moment it catches, so its clock starts here rather than at the bench.
      if it.def = 'torch' and candle_left(it) <= 0 then
        update item set charges = round(held_burn(it))::int where id = it.id;
        select * into it from item where id = it.id;
      end if;
      update item set lit = true, lit_at = now() where id = it.id;
      perform tell(p_world, p_uid, case when it.def = 'torch'
        then 'You touch the torch to the ' || flame_near(p_world, p_uid, it.id)
             || ' and it takes. ' || ceil(candle_left(it) / 60) || ' minutes of it, throwing '
             || held_reach_of(it) || ' tiles.'
        else 'You take a light off the ' || flame_near(p_world, p_uid, it.id)
             || ' and the lantern throws it ' || held_reach_of(it) || ' tiles.' end, 'event');
    else
      v_left := candle_left(it);
      update item set lit = false, lit_at = null, charges = round(v_left)::int where id = it.id;
      perform tell(p_world, p_uid, case when it.def = 'torch'
        then 'You smother the torch. ' || ceil(v_left / 60)
             || ' minutes of it left, if it will take again.'
        else 'You pinch the wick out. ' || ceil(v_left / 60) || ' minutes of candle saved.' end, 'event');
    end if;
    return;
  end if;

  if p_action = 'place_anvil' then
    select * into it from item where world_id = p_world and holder = 'player' and holder_uid = p_uid
      and def = 'anvil' and not locked
      and (target_item(p_target) is null or id = target_item(p_target))
      order by id limit 1;
    if not found then return; end if;
    v_sx := least(subtiles() - anvil_subtiles(), greatest(0, coalesce((p_target->>'sx')::int, 0)));
    v_sy := least(subtiles() - anvil_subtiles(), greatest(0, coalesce((p_target->>'sy')::int, 0)));
    -- An anvil's metal rides in `sub`, and its rarity now rides beside it.
    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, rare, enchant, dmg)
    values (p_world, 'anvil', coalesce(it.extra, 'copper'),
            (p_target->>'x')::int, (p_target->>'y')::int, v_sx, v_sy,
            (p_target->>'x')::int + (v_sx + 1.0) / subtiles(),
            (p_target->>'y')::int + (v_sy + 1.0) / subtiles(), it.ql, p_uid, it.rare, it.enchant, it.dmg)
    returning * into p;
    delete from item where id = it.id;
    perform tell(p_world, p_uid, 'You set the ' || lower(anvil_name(p))
      || ' down. Bring a casting to it.', 'event');
    perform land_announce(p_world, p.x, p.y);
    return;
  end if;

  select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint;
  if not found then return; end if;

  if p_action = 'pick_up_anvil' then
    v_made := give(p_world, p_uid, 'anvil', 1, p.ql, p.sub, p.rare);
    -- Its enchantment and its wear come up with it (`enchanting.ts`).
    update item set enchant = p.enchant, dmg = p.dmg where id = v_made;
    perform tell(p_world, p_uid, 'You heave the ' || lower(anvil_name(p))
      || ' up onto your shoulder.', 'event');
    delete from placed where id = p.id;
    perform land_announce(p_world, p.x, p.y);
    return;
  end if;

  -- Smithing: the mould, the metal, the anvil and the hands, in that order.
  if p_action = 'strike_coins' then
    -- The die wears with every strike, good or bad, and no die can be mended.
    select * into v_mould from item where world_id = p_world and holder = 'player' and holder_uid = p_uid
      and def = 'coin_die' order by tool_worth(ql, dmg, extra, rare, bless) desc limit 1;
    v_lump := smith_lump(p_world, p_uid, target_item(p_target));
    m := metal_by_bar(v_lump.def);
    if v_mould.id is null or v_lump.id is null or m.id is null or not m.coins then return; end if;
    -- A bar is broken into for the lump a strike takes (a Smith's Ingots).
    v_lump := unbar(p_world, p_uid, v_lump.id, 1);
    if v_lump.id is null or not spend_stack(p_world, p_uid, v_lump.id, 1) then return; end if;
    v_mould_ql := greatest(1, v_mould.ql - v_mould.dmg / 2);
    v_broke := v_mould.dmg + die_wear() >= 100;
    if v_broke then
      delete from item where id = v_mould.id;
    else
      update item set dmg = least(100, v_mould.dmg + die_wear()) where id = v_mould.id;
    end if;
    v_hard := coin_difficulty() + (mat_of(v_lump.extra)).difficulty;
    -- The smith's hand, and then the gold itself: poor metal will not take the
    -- die however well it is struck (`coinPurity`). A Smith's Sure Hammer fails
    -- half as often (`fail:` and the job). The lump is gone either way.
    v_struck := skill_check(skill_of(p_world, p_uid, 'blacksmithing'), v_hard, anvil_ql(p), mind_ease(p_world, p_uid));
    v_pure := random() < 1 - coin_ql_weight() * (1 - least(100, greatest(0, v_lump.ql)) / 100);
    if not perk_pass(v_struck and v_pure, pk(p_world, p_uid, 'fail:' || p_action, 1)) then
      perform skill_raise(p_world, p_uid, 'blacksmithing', try_gain(false, smith_gain()));
      perform tell(p_world, p_uid, case when v_struck then 'The gold is too poor to take the die and the blanks crack'
                                        else 'The blanks come out smeared' end || '; the lump is lost.'
        || case when v_broke then ' The die is worn through.' else '' end, 'event');
      return;
    end if;
    -- And higher for a Masterwork on the anvil (`enchanting.ts`).
    v_ql := least(100, smith_ql(p_world, p_uid, 'blacksmithing', v_mould_ql, v_lump.ql, anvil_ql(p)) + placed_enchant(p, 'master'));
    perform skill_raise(p_world, p_uid, 'blacksmithing', try_gain(true, smith_gain()));
    v_rare := rarity_roll();
    v_made := give(p_world, p_uid, 'coin', coins_per_lump()::int, v_ql, m.name, v_rare, maker_mark(p_world, p_uid, v_rare));
    perform journal_made(p_world, p_uid, 'coin', v_ql, coins_per_lump()::int, v_rare);
    perform journal_note(p_world, p_uid, 'minted');
    if v_rare is not null then
      perform journal_note(p_world, p_uid, v_rare);
      perform tell(p_world, p_uid, rarity_word(v_rare), 'skill');
    end if;
    perform tell(p_world, p_uid, 'You strike ' || coins_per_lump()::int || ' ' || lower(m.name)
      || ' coins on the ' || lower(anvil_name(p)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')'
      || case when v_broke then ' The die is worn through and done.'
              else ' The die has ' || ceil((100 - (v_mould.dmg + die_wear())) / die_wear())::int || ' strikes left.' end, 'event');
    return;
  end if;

  -- Smithing: a casting poured at the smelter, beaten true on the anvil.
  v_cast := smith_casting(p_world, p_uid, target_item(p_target));
  select * into d from mould_def where makes = v_cast.piece;
  m := metal_by_name(v_cast.extra);
  if v_cast.id is null or d.id is null or m.id is null then return; end if;

  -- The deeper the seam it came out of, the harder it is to beat into shape.
  -- Rolled before the casting is spent, so that a Smith's Second Heat has a
  -- casting to keep; and a Smith's Sure Hammer fails half as often.
  v_hard := d.difficulty + (mat_of(v_cast.extra)).difficulty;
  if not perk_pass(skill_check(skill_of(p_world, p_uid, d.skill), v_hard, anvil_ql(p),
                               mind_ease(p_world, p_uid)), pk(p_world, p_uid, 'fail:' || p_action, 1)) then
    v_kept := random() < pk(p_world, p_uid, 'spare:' || p_action, 0);
    if not v_kept and not spend_stack(p_world, p_uid, v_cast.id, 1) then return; end if;
    perform skill_raise(p_world, p_uid, d.skill, try_gain(false, smith_gain()));
    perform tell(p_world, p_uid, 'The '
      || lower((select name from item_def where id = d.makes))
      || ' comes out misshapen and '
      || case when v_kept then 'goes back into the fire: the casting is kept.' else 'you throw the metal back.' end, 'event');
    return;
  end if;
  if not spend_stack(p_world, p_uid, v_cast.id, 1) then return; end if;

  -- The casting carries the mould and the metal it was poured from, so it stands for both.
  -- Better for a Smith's Toolsmith on a tool's head or blade (`ql:` and the piece).
  v_ql := least(100, smith_ql(p_world, p_uid, d.skill, v_cast.ql, v_cast.ql, anvil_ql(p))
                     * pk(p_world, p_uid, 'ql:' || d.makes, 1) + placed_enchant(p, 'master'));
  perform skill_raise(p_world, p_uid, d.skill, try_gain(true, smith_gain()));
  -- Rarer odds for a Smith's Master's Mark (`rare:smith`).
  v_rare := perk_rare(pk(p_world, p_uid, 'rare:smith', (select r.odds from rarity_def r order by r.ord limit 1)));
  -- More to a filling for a Smith's Nail Maker (`count:` and the piece).
  v_count := floor(pk(p_world, p_uid, 'count:' || d.makes, d.per))::int;
  -- And what the smith's perks put into it (Keen Edge, Balanced, Mail Maker,
  -- Plate Maker, Temper Bath), which goes with a head into what it is fitted to.
  -- And one thing beaten out at the signing QL carries its maker's name, as rare work does (`made_by`).
  v_made := give(p_world, p_uid, d.makes, v_count, v_ql, m.name, v_rare, made_by(p_world, p_uid, v_rare, d.makes, v_ql), null,
                 made_mark((select pl.class_mul from player pl where pl.world_id = p_world and pl.uid = p_uid), d.makes));
  perform journal_made(p_world, p_uid, d.makes, v_ql, v_count, v_rare);
  perform journal_note(p_world, p_uid, 'smithed');
  -- The four that come out of the deep seams, which are worth a line of their own.
  if m.id in ('adamantine', 'glimmersteel', 'mithril', 'seryll') then
    perform journal_note(p_world, p_uid, 'moonmetal');
  end if;
  if v_rare is not null then
    perform journal_note(p_world, p_uid, v_rare);
    perform tell(p_world, p_uid, rarity_word(v_rare), 'skill');
  end if;
  perform tell(p_world, p_uid, 'You beat out '
    || case when v_count > 1 then v_count || ' ' else 'a ' end
    || lower(m.name) || ' '
    || case when v_count > 1 and right(lower((select name from item_def where id = d.makes)), 1) <> 's'
            then lower((select name from item_def where id = d.makes)) || 's'
            else lower((select name from item_def where id = d.makes)) end
    || ' on the ' || lower(anvil_name(p)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');
  -- And what the go taught, said: it was raised and never told, which read as nothing learned.
end $function$;

select private.lock_doors();

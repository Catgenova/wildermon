-- Litres: every vessel holds litres, and anything that uses a liquid takes litres of it.
--
-- Asked for: "Build out that any container can hold X liters. Anything that uses liquid will have a liter
-- requirement. A bucket that holds 5 liters of water would decrease by 1 liter each time 1 dough is made. A bucket of
-- lye would apply 1 liter per wound ... Use L instead of kg for what they hold, but the container still weighs kg."
--
-- A bucket of water, of lye or of whey holds its litres in `charges` as the drinks did (the defs give them 5); one made
-- before has none and is full (`item_litres`). A recipe input with `recipe_input.litres` takes that many litres out of
-- the vessels of it carried (the emptiest first), then in the stores within reach, then the barrels, wells and
-- fountains of it within reach (`litre_sources`), and a vessel at its last litre is an empty bucket (`drain_vessel`).
-- A recipe that turns a bucket into another (lye, cheese, a dye boil, distilling) takes only a full one
-- (`whole_item`). Cleaning a wound, removing dye or paint take `lye_use()` litres of the lye carried. A drink takes
-- `drink_litres()`; a bucket drunk dry is empty. Fill with water tops up a skin or a part bucket of water. A pour pours
-- what is in the bucket, as much as there is room for. Workers take litres out of the settlement stores. A vessel
-- weighs its empty bucket and `litre_kg()` a litre; its name says its litres: Bucket of water (3 L). The browser's
-- `litresOf`, `litreSources`, `drainVessel`, `takeLitres`, `unitWeight` and `itemName`.

set local lock_timeout = '3s';

-- The litres in a vessel or a skin: its charges, or full where it has none; a bucket of dye, its dye's; a part bucket of milk, as milked.
create or replace function item_litres(it item) returns double precision
language sql stable as $fn$
  select case when it.def = 'dye_bucket' then coalesce((dye_in(it)).litres, 0)::double precision
              when it.def = 'milk_part' then coalesce(it.charges, 0)::double precision
              else coalesce(it.charges, (select d.charges from item_def d where d.id = it.def), 0)::double precision end
$fn$;

-- Litres off one vessel of a pile, in place: off the top of its pile where there are more, empty at its last litre.
create or replace function drain_vessel(p_id bigint, p_n double precision) returns boolean
language plpgsql as $fn$
declare it item; v_have double precision; v_left int;
begin
  select * into it from item where id = p_id for update;
  if not found or it.count < 1 then return false; end if;
  v_have := item_litres(it);
  if p_n <= 0 or v_have < p_n then return false; end if;
  v_left := round(v_have - p_n)::int;
  if v_left <= 0 then
    return vessel_becomes(p_id, coalesce((select v.empty from vessel_def v where v.item = it.def), 'bucket'));
  end if;
  if it.count = 1 then
    update item set charges = v_left where id = p_id;
    return true;
  end if;
  update item set count = count - 1 where id = p_id;
  insert into item (world_id, holder, holder_uid, gx, gy, inside, def, ql, dmg, count, extra, rare,
                    dye, bless, charges, locked, issued, made_at, crate, lit, lit_at, placed, rot_at, maker, piece, mark)
  values (it.world_id, it.holder, it.holder_uid, it.gx, it.gy, it.inside, it.def, it.ql, it.dmg, 1, it.extra, it.rare,
          it.dye, it.bless, v_left, it.locked, it.issued, it.made_at,
          it.crate, it.lit, it.lit_at, it.placed, it.rot_at, it.maker, it.piece, it.mark);
  return true;
end $fn$;

-- Whether a thing serves as a whole input: a vessel only full, since what it becomes is a full bucket of something else.
create or replace function whole_item(p_id bigint) returns boolean
language sql stable as $fn$
  select coalesce((select not exists (select 1 from vessel_def v where v.item = it.def)
                          or d.charges is null or item_litres(it) >= d.charges
                     from item it join item_def d on d.id = it.def where it.id = p_id), true)
$fn$;

-- Everywhere a litre of one liquid can be had from, in the order it is taken (`litreSources`). Without p_placed: only what is carried.
create or replace function litre_sources(p_world uuid, p_uid uuid, p_vessel text, p_placed boolean default true)
returns table(kind text, id bigint, litres double precision, ord bigint)
language sql stable as $fn$
  with v as (select vd.liquid from vessel_def vd where vd.item = p_vessel),
  q as (
    select 'item'::text as kind, s.id, item_litres(it) * s.count as litres,
           case when s.carried then 0 else 1 end as band, item_litres(it) as k1, s.draw::double precision as k2
      from craft_stock(p_world, p_uid) s join item it on it.id = s.id
     where s.def = p_vessel and item_litres(it) > 0 and (p_placed or s.carried)
    union all
    select 'placed'::text, p.id, placed_litres(p), 2, -placed_litres(p), p.id::double precision
      from placed p, v
     where p_placed and p.world_id = p_world and p.kind = 'furniture' and holds_liquid(p)
       and placed_liquid(p) = v.liquid and not is_working(p) and placed_litres(p) > 0
       and near_piece(p_world, p_uid, p, craft_reach())
  )
  select q.kind, q.id, q.litres, row_number() over (order by q.band, q.k1, q.k2) from q
$fn$;

create or replace function litres_at_hand(p_world uuid, p_uid uuid, p_vessel text, p_placed boolean default true)
returns double precision
language sql stable as $fn$
  select coalesce(sum(s.litres), 0) from litre_sources(p_world, p_uid, p_vessel, p_placed) s
$fn$;

-- Take p_n litres across them, in their order (`takeLitres`); false, and nothing taken, when there are not that many.
create or replace function take_litres(p_world uuid, p_uid uuid, p_vessel text, p_n double precision, p_placed boolean default true)
returns boolean
language plpgsql as $fn$
declare r record; v_left double precision := p_n; m double precision; it item;
begin
  if p_n <= 0 then return true; end if;
  if litres_at_hand(p_world, p_uid, p_vessel, p_placed) < p_n then return false; end if;
  for r in select * from litre_sources(p_world, p_uid, p_vessel, p_placed) s order by s.ord loop
    exit when v_left <= 0;
    if r.kind = 'item' then
      loop
        exit when v_left <= 0;
        select * into it from item i where i.id = r.id;
        exit when not found or it.def <> p_vessel or it.count < 1 or item_litres(it) <= 0;
        m := least(v_left, item_litres(it));
        exit when not drain_vessel(r.id, m);
        v_left := v_left - m;
      end loop;
    else
      m := least(v_left, r.litres);
      if draw_from(r.id, m) then v_left := v_left - m; end if;
    end if;
  end loop;
  return v_left <= 0;
end $fn$;

-- The litres of a liquid in its vessels in a keeper's settlement stores, and taking them, the emptiest first (a worker's).
create or replace function stores_litres(p_world uuid, p_uid uuid, p_vessel text) returns double precision
language sql stable as $fn$
  select coalesce(sum(item_litres(s.it) * (s.it).count), 0) from deed_store_items(p_world, p_uid) s
   where (s.it).def = p_vessel and not coalesce((s.it).locked, false)
$fn$;

create or replace function take_litres_stored(p_world uuid, p_uid uuid, p_vessel text, p_n double precision) returns boolean
language plpgsql as $fn$
declare r record; v_left double precision := p_n; m double precision; it item;
begin
  for r in select (s.it).id as id from deed_store_items(p_world, p_uid) s
            where (s.it).def = p_vessel and not coalesce((s.it).locked, false) and item_litres(s.it) > 0
            order by item_litres(s.it), s.kind, s.sid, (s.it).id loop
    loop
      exit when v_left <= 0;
      select * into it from item i where i.id = r.id;
      exit when not found or it.def <> p_vessel or it.count < 1 or item_litres(it) <= 0;
      m := least(v_left, item_litres(it));
      exit when not drain_vessel(r.id, m);
      v_left := v_left - m;
    end loop;
    exit when v_left <= 0;
  end loop;
  return v_left <= 0;
end $fn$;

-- What one of a thing weighs: a vessel, its empty make and the litres in it.
create or replace function unit_weight(it item) returns double precision
language sql stable as $fn$
  select coalesce((select (select e.weight from item_def e where e.id = v.empty) + item_litres(it) * litre_kg()
                     from vessel_def v where v.item = it.def),
                  (select weight from item_def where id = it.def))
       * coalesce((mat_of(it.extra)).weight, 1)
$fn$;

-- A vessel's name says its litres: a Bucket of water (3 L), a Bucket of purple dye (3 L).
create or replace function item_name(it item) returns text
language sql stable as $fn$
  select case when w.words = '' then b.base
              else upper(left(w.words, 1)) || substr(w.words, 2) || ' ' || lower(b.base) end
      || coalesce(' (' || lower(it.extra) || ')', '')
      || case when dye_in(it) is not null then ' (' || ((dye_in(it)).litres)::double precision::text || ' L)'
              when d.charges is not null or it.def = 'milk_part' then ' (' || item_litres(it)::text || ' L)'
              else '' end
      -- And what is enchanted into it: a Sword (iron) (Firebrand) (`enchantMarker`).
      || coalesce(' (' || (select e.name from enchantments() e where e.id = it.enchant->>'id') || ')', '')
  from item_def d
  cross join lateral (select case when it.def = 'casting' and it.piece is not null
                                  then coalesce((select c.name from item_def c where c.id = it.piece), it.piece) || ' casting'
                                  -- A bucket of dye is called by the colour of what is in it: a Bucket of purple dye.
                                  when dye_in(it) is not null
                                  then regexp_replace(d.name, ' dye$', '') || ' ' || colour_word(dye_hex(dye_in(it))) || ' dye'
                                  else d.name end as base) b
  cross join lateral (select btrim(concat_ws(' ',
      case when dye_in(it) is null then dye_word_of(it.dye) end, it.rare)) as words) w
  where d.id = it.def
$fn$;

-- Whole inputs: a vessel only full.
create or replace function craft_count_loose(p_world uuid, p_uid uuid, p_item text, p_mat text default null, p_chosen bigint default null)
returns integer
language sql stable as $fn$
  select coalesce(sum(s.count), 0)::int from craft_stock(p_world, p_uid, p_chosen) s
   where s.def = p_item and (p_mat is null or s.extra is not distinct from p_mat) and whole_item(s.id)
$fn$;

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  -- A craft's whole inputs out of the stock: a vessel only full.
  v_def := pg_get_functiondef('craft_consume'::regproc);
  v_old := $q$     where s.def = p_item and (not only_mat or s.extra is not distinct from p_mat)$q$;
  v_new := $q$     where s.def = p_item and (not only_mat or s.extra is not distinct from p_mat) and whole_item(s.id)$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'craft_consume: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- A craft: litres out of the litre sources, on a failed batch and a good one.
  v_def := pg_get_functiondef('perform_craft'::regproc);
  v_old := $q$        perform craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat);$q$;
  v_new := $q$        if i.litres is not null then perform take_litres(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.litres));
        else perform craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat); end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_craft: fail anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$    if not craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat) then return; end if;$q$;
  v_new := $q$    if i.litres is not null then
      if not take_litres(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.litres)) then return; end if;
      continue;
    end if;
    if not craft_consume(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat) then return; end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_craft: consume anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$'Lye Saver: bucket not used up.'$q$;
  v_new := $q$'Lye Saver: lye kept.'$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_craft: saver anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- What a craft is short of: litres, said in litres.
  v_def := pg_get_functiondef('craft_refusal'::regproc);
  v_old := $q$  for i in select * from recipe_input where recipe = p_recipe order by ord loop
    have := $q$;
  v_new := $q$  for i in select * from recipe_input where recipe = p_recipe order by ord loop
    if i.litres is not null then
      if litres_at_hand(p_world, p_uid, i.item) < recipe_need(p_world, p_uid, p_recipe, i.litres) then
        return 'Need ' || recipe_need(p_world, p_uid, p_recipe, i.litres) || ' L '
          || (select l.name from vessel_def v join liquid_def l on l.id = v.liquid where v.item = i.item) || '.';
      end if;
      continue;
    end if;
    have := $q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'craft_refusal: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- A worker's recipe: litres in the stores, and out of them.
  v_def := pg_get_functiondef('recipe_in_stores'::regproc);
  v_old := $q$and stores_count(p_world, p_uid, ri.item) < ri.count)$q$;
  v_new := $q$and case when ri.litres is not null then stores_litres(p_world, p_uid, ri.item) < ri.litres
                                                                            else stores_count(p_world, p_uid, ri.item) < ri.count end)$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'recipe_in_stores: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('errand_do'::regproc);
  v_old := $q$        for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item], c.work_x, c.work_y); end loop;$q$;
  v_new := $q$        if ri.litres is not null then perform take_litres_stored(p_world, c.keeper, ri.item, ri.litres);
        else for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item], c.work_x, c.work_y); end loop; end if;$q$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 2 then raise exception 'errand_do: stored-at anchor % times', v_n; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$        for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item]); end loop;$q$;
  v_new := $q$        if ri.litres is not null then perform take_litres_stored(p_world, c.keeper, ri.item, ri.litres);
        else for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item]); end loop; end if;$q$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 2 then raise exception 'errand_do: stored anchor % times', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- Lye: a litre of what is carried, for a wound, a colour or a wall's paint.
  v_def := pg_get_functiondef('fight_refusal'::regproc);
  v_old := $q$    if pack_count(p_world, p_uid, 'lye_bucket') <= 0 then
      return 'Need a bucket of lye.';
    end if;$q$;
  v_new := $q$    if litres_at_hand(p_world, p_uid, 'lye_bucket', false) < lye_use() then
      return 'Need ' || lye_use() || ' L lye.';
    end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'fight_refusal: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('perform_fight'::regproc);
  v_old := $q$    select i.* into lye from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'lye_bucket'
      order by i.ql desc limit 1;
    if lye.id is null or not consume(p_world, p_uid, 'lye_bucket', 1, lye.id) then return; end if;
    perform give(p_world, p_uid, 'bucket', 1, lye.ql);$q$;
  v_new := $q$    select i.* into lye from craft_stock(p_world, p_uid) s join item i on i.id = s.id
      where s.carried and s.def = 'lye_bucket' and item_litres(i) > 0
      order by s.draw limit 1;
    if lye.id is null or not take_litres(p_world, p_uid, 'lye_bucket', lye_use(), false) then return; end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_fight: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('last_refusal'::regproc);
  v_old := $q$      if pack_count(p_world, p_uid, 'lye_bucket') <= 0 then
        return 'Need a bucket of lye.';
      end if;$q$;
  v_new := $q$      if litres_at_hand(p_world, p_uid, 'lye_bucket', false) < lye_use() then
        return 'Need ' || lye_use() || ' L lye.';
      end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'last_refusal: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('perform_last'::regproc);
  v_old := $q$    if dye.id is null or not consume(p_world, p_uid, 'lye_bucket', 1) then return; end if;
    perform give(p_world, p_uid, 'bucket', 1, dye.ql);$q$;
  v_new := $q$    if dye.id is null or not take_litres(p_world, p_uid, 'lye_bucket', lye_use(), false) then return; end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_last: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('build_refusal'::regproc);
  v_old := $q$if pack_count(p_world, p_uid, 'lye_bucket') <= 0 then return 'Need a bucket of lye.'; end if;$q$;
  v_new := $q$if litres_at_hand(p_world, p_uid, 'lye_bucket', false) < lye_use() then return 'Need ' || lye_use() || ' L lye.'; end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'build_refusal: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('perform_building'::regproc);
  v_old := $q$    if pot.id is null or not consume(p_world, p_uid, 'lye_bucket', 1) then return; end if;
    perform give(p_world, p_uid, 'bucket', 1, pot.ql);$q$;
  v_new := $q$    if pot.id is null or not take_litres(p_world, p_uid, 'lye_bucket', lye_use(), false) then return; end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_building: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- A drink: a litre; a bucket drunk dry is an empty bucket.
  v_def := pg_get_functiondef('item_refusal'::regproc);
  v_old := $q$    if coalesce(v_it.charges, 0) <= 0 then return 'It is empty.'; end if;$q$;
  v_new := $q$    if item_litres(v_it) <= 0 then return 'It is empty.'; end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'item_refusal: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('perform_item'::regproc);
  v_old := $q$    update item set charges = coalesce(charges, 1) - 1 where id = v_it.id;$q$;
  v_new := $q$    if item_litres(v_it) - drink_litres() <= 0 and exists (select 1 from vessel_def v where v.item = v_it.def) then
      perform vessel_becomes(v_it.id, (select v.empty from vessel_def v where v.item = v_it.def));
    else
      update item set charges = greatest(0, round(item_litres(v_it) - drink_litres()))::int where id = v_it.id;
    end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_item: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- Fill with water: a skin, or a bucket of water with room in it.
  v_def := pg_get_functiondef('liquid_refusal'::regproc);
  v_old := $q$    if (select charges from item_def where id = it.def) is null then
      return 'That does not hold water.';
    end if;
    if coalesce(it.charges, 0) >= (select charges from item_def where id = it.def) then$q$;
  v_new := $q$    if it.def not in ('water_skin', 'water_bucket') then
      return 'That does not hold water.';
    end if;
    if item_litres(it) >= (select charges from item_def where id = it.def) then$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'liquid_refusal: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('perform_liquid'::regproc);
  v_old := $q$      || lower((select name from item_def where id = it.def)) || ', water.', 'event');$q$;
  v_new := $q$      || lower((select name from item_def where id = it.def)) || ', '
      || (select charges from item_def where id = it.def) || ' L water.', 'event');$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_liquid: fill anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  -- A pour: what is in the bucket, as much as there is room for; the rest stays in it.
  v_old := $q$    v_poured := least(bucket_litres(), v_room);$q$;
  v_new := $q$    v_poured := least(item_litres(it), floor(v_room));$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_liquid: pour anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$    if not vessel_becomes(it.id, (select empty from vessel_def where item = it.def)) then return; end if;$q$;
  v_new := $q$    if v_poured >= item_litres(it) then
      if not vessel_becomes(it.id, (select empty from vessel_def where item = it.def)) then return; end if;
    elsif not drain_vessel(it.id, v_poured) then return; end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_liquid: empty anchor not once'; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();

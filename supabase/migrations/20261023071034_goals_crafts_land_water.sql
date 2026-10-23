/*
 * Thirty-six more goals in the journal's crafts, land and water chapters
 * (`src/game/journal-b.ts`), and the counts they read, noted on the island
 * for whoever does the thing, where it is done (`journal_note`):
 *
 *   * `sheared` a shearing or a plucking, `milked:<kind>` a milking;
 *   * `glazed` a glaze; `improved70` a pass of yours that takes a thing past
 *     `improved_to()` (`IMPROVED_TO`), once a thing;
 *   * `melted` a melting down; `fired:<ware>` each piece of green ware packed
 *     into a kiln, by what it fires into;
 *   * `dyed:<item>` a dyeing, by the thing dyed;
 *   * `harvest:<crop>` a crop harvested, a field or a patch; `fruit:<fruit>`
 *     fruit picked off a tree; `reeds` reeds cut; `flowers:<season>` and
 *     `skep:<season>` wildflowers picked and honey taken out of a skep, by the
 *     season it was done in; `grapes` a vine picked;
 *   * `charted` a map drawn; `signed` a masterwork signed;
 *   * `fished:sea` and `fished:pond` a fish landed or a net hauled in the sea
 *     or in water a spring has filled (`water_kind`), and `catch:<rarity>` a
 *     rare one;
 *   * and on the walk (`journal_move`), only once it has left its tile:
 *     `sailed` every tile a hull under your helm goes into; `circled` once a
 *     hull of yours has gone right round the middle of the island under your
 *     helm (its turn kept on the hull, `state.round`); `landed:dragon` once
 *     you are ashore on the dragon's island (`monster_isle`), off a hull and
 *     out of a seat; `cartbridge` once a cart with anything in it is driven
 *     onto the deck of a bridge you built. Each of the last three is looked
 *     for only until it has been noted.
 */
set local lock_timeout = '3s';

/* The QL a pass of yours takes a thing past that the journal counts: the browser's `IMPROVED_TO`. */
create or replace function improved_to() returns double precision language sql immutable as $fn$ select 70::double precision $fn$;

/* Which water a tile is, for the journal: the sea where a corner of it is below nothing, and a spring's pond elsewhere (`waterKind`). */
create or replace function water_kind(p_world uuid, p_x integer, p_y integer) returns text
language sql stable as $fn$
  select case when least(land_height(p_world, p_x, p_y), land_height(p_world, p_x + 1, p_y),
                         land_height(p_world, p_x + 1, p_y + 1), land_height(p_world, p_x, p_y + 1)) < 0
              then 'sea' else 'pond' end
$fn$;

/*
 * The journal's counts off a walk the island has let stand (`rpc_move`): `p`
 * is the body as it stood before it, `cart` what it drives, and `p_xs`/`p_ys`
 * the walk's turns. Nothing at all unless the walk left the tile it started
 * in.
 */
create or replace function journal_move(p_world uuid, p_uid uuid, p player, p_x double precision, p_y double precision,
                                        cart placed, p_xs double precision[], p_ys double precision[])
returns void language plpgsql as $fn$
declare v_tiles int; v_mid double precision; v_turn double precision; v_round double precision;
begin
  if floor(p_x) = floor(p.x) and floor(p_y) = floor(p.y) then return; end if;
  if cart.id is not null and is_boat(cart) then
    v_tiles := least(20, walk_tiles(p_xs, p_ys))::int;
    if v_tiles <= 0 then return; end if;
    perform journal_note(p_world, p_uid, 'sailed', v_tiles);
    if coalesce(p.tally ? 'circled', false) then return; end if;
    -- Round the middle of the island, which is land: the turn about it, kept on the hull for whoever has her helm.
    select w.size / 2.0 into v_mid from world w where w.id = p_world;
    v_turn := atan2(p_y - v_mid, p_x - v_mid) - atan2(p.y - v_mid, p.x - v_mid);
    if v_turn > pi() then v_turn := v_turn - 2 * pi(); elsif v_turn < -pi() then v_turn := v_turn + 2 * pi(); end if;
    v_round := v_turn + case when cart.state->'round'->>'by' = p_uid::text then coalesce((cart.state->'round'->>'a')::double precision, 0) else 0 end;
    if abs(v_round) >= 2 * pi() then
      perform journal_note(p_world, p_uid, 'circled');
      update placed set state = coalesce(state, '{}'::jsonb) - 'round' where id = cart.id;
    else
      update placed set state = coalesce(state, '{}'::jsonb) || jsonb_build_object('round', jsonb_build_object('by', p_uid, 'a', v_round))
       where id = cart.id;
    end if;
  elsif cart.id is not null then
    if coalesce(p.tally ? 'cartbridge', false) then return; end if;
    if vehicle_speed(p_world, cart.id) > 0
       and exists (select 1 from bridge_span s join bridge b on b.world_id = s.world_id and b.id = s.bridge
                    where s.world_id = p_world and s.x = floor(p_x)::int and s.y = floor(p_y)::int and b.made_by = p_uid)
       and exists (select 1 from item i where i.world_id = p_world and i.holder = 'furniture' and i.placed = cart.id) then
      perform journal_note(p_world, p_uid, 'cartbridge');
    end if;
  elsif p.aboard is null and not coalesce(p.tally ? 'landed:dragon', false) then
    if region_at(p_world, p_x, p_y) = monster_isle('dragon') and not has_water(p_world, floor(p_x)::int, floor(p_y)::int) then
      perform journal_note(p_world, p_uid, 'landed:dragon');
    end if;
  end if;
end $fn$;

do $do$
declare r record; v_def text; v_n int; v_want int; i int;
begin
  for r in select * from (values
    (1, 'perform_creature', array[$a$    update creature set fleece = 0 where world_id = p_world and id = c.id;
    perform beast_learns(p_world, c.id, 'tended');
    perform skill_told(p_world, p_uid, 'tailoring', 0.4);$a$],
       array[$a$    update creature set fleece = 0 where world_id = p_world and id = c.id;
    perform journal_note(p_world, p_uid, 'sheared');
    perform beast_learns(p_world, c.id, 'tended');
    perform skill_told(p_world, p_uid, 'tailoring', 0.4);$a$]),
    (2, 'milk_go', array[$a$  perform skill_told(p_world, p_uid, 'farming', 0.3);
  perform tell(p_world, p_uid, milked_says($a$],
       array[$a$  perform skill_told(p_world, p_uid, 'farming', 0.3);
  perform journal_note(p_world, p_uid, 'milked:' || c.species);
  perform tell(p_world, p_uid, milked_says($a$]),
    (3, 'perform_item', array[
       $a$v_circlet item; v_gem text;$a$,
       $a$    perform skill_raise(p_world, p_uid, 'pottery', 1);
    perform tell(p_world, p_uid, 'Glazed: '$a$,
       $a$    v_ceiling := least(99.9, improve_ceiling(p_world, p_uid, v_what.skill, v_it.rare));$a$,
       $a$    if v_it.ql >= 90 then perform journal_note(p_world, p_uid, 'improved90'); end if;$a$],
       array[
       $a$v_circlet item; v_gem text; v_was double precision;$a$,
       $a$    perform skill_raise(p_world, p_uid, 'pottery', 1);
    perform journal_note(p_world, p_uid, 'glazed');
    perform tell(p_world, p_uid, 'Glazed: '$a$,
       $a$    v_was := v_it.ql;
    v_ceiling := least(99.9, improve_ceiling(p_world, p_uid, v_what.skill, v_it.rare));$a$,
       $a$    if v_it.ql >= 90 then perform journal_note(p_world, p_uid, 'improved90'); end if;
    -- And a thing this pass took past `improved_to`, once a thing.
    if v_was < improved_to() and v_it.ql >= improved_to() then perform journal_note(p_world, p_uid, 'improved70'); end if;$a$]),
    (4, 'perform_firing', array[
       $a$    perform tell(p_world, p_uid, 'Melting: '$a$,
       $a$    perform tell(p_world, p_uid, 'Packed: '$a$],
       array[
       $a$    perform journal_note(p_world, p_uid, 'melted');
    perform tell(p_world, p_uid, 'Melting: '$a$,
       $a$    perform journal_note(p_world, p_uid, 'fired:' || v_makes, v_n);
    perform tell(p_world, p_uid, 'Packed: '$a$]),
    (5, 'perform_last', array[$a$    perform journal_note(p_world, p_uid, 'dyed');$a$],
       array[$a$    perform journal_note(p_world, p_uid, 'dyed');
    perform journal_note(p_world, p_uid, 'dyed:' || it.def);$a$]),
    (6, 'reap_one', array[$a$  delete from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;$a$],
       array[$a$  perform journal_note(p_world, p_uid, 'harvest:' || r.o_produce);
  delete from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;$a$]),
    (7, 'perform_ground', array[
       $a$    perform mark_foraged(p_world, tx, ty, 'forage');
    perform skill_raise(p_world, p_uid, 'forestry', 0.35);
    perform tell(p_world, p_uid, 'Picked: '$a$,
       $a$    perform tell(p_world, p_uid, 'Cut: ' || v_n || ' reeds.', 'event');$a$],
       array[
       $a$    perform mark_foraged(p_world, tx, ty, 'forage');
    perform skill_raise(p_world, p_uid, 'forestry', 0.35);
    perform journal_note(p_world, p_uid, 'fruit:' || v_tree.fruit);
    perform tell(p_world, p_uid, 'Picked: '$a$,
       $a$    perform journal_note(p_world, p_uid, 'reeds');
    perform tell(p_world, p_uid, 'Cut: ' || v_n || ' reeds.', 'event');$a$]),
    (8, 'perform_flowers', array[$a$  perform skill_raise(p_world, p_uid, 'foraging', 1);
  perform tell(p_world, p_uid, 'Picked: '$a$],
       array[$a$  perform skill_raise(p_world, p_uid, 'foraging', 1);
  perform journal_note(p_world, p_uid, 'flowers:' || season_at(now()));
  perform tell(p_world, p_uid, 'Picked: '$a$]),
    (9, 'perform_skep', array[$a$  perform journal_note(p_world, p_uid, 'honey');$a$],
       array[$a$  perform journal_note(p_world, p_uid, 'honey');
  perform journal_note(p_world, p_uid, 'skep:' || season_at(v_now));$a$]),
    (10, 'perform_vine', array[$a$  update placed set picked_at = vine_now() where id = pl.id;$a$],
       array[$a$  update placed set picked_at = vine_now() where id = pl.id;
  perform journal_note(p_world, p_uid, 'grapes');$a$]),
    (11, 'perform_chart', array[$a$    perform tell(p_world, p_uid, chart_done_said(p_action, v_x, v_y, v_r, v_ql), 'event');$a$],
       array[$a$    perform journal_note(p_world, p_uid, 'charted');
    perform tell(p_world, p_uid, chart_done_said(p_action, v_x, v_y, v_r, v_ql), 'event');$a$]),
    (12, 'perform_sign', array[$a$  perform tell(p_world, p_uid, signed_said(v_text), 'event');$a$],
       array[$a$  perform journal_note(p_world, p_uid, 'signed');
  perform tell(p_world, p_uid, signed_said(v_text), 'event');$a$]),
    (13, 'perform_fish', array[
       $a$perform journal_note(p_world, p_uid, v_rare);$a$,
       $a$perform journal_note(p_world, p_uid, 'fish:' || got);$a$,
       $a$perform journal_note(p_world, p_uid, 'netted');$a$],
       array[
       $a$perform journal_note(p_world, p_uid, v_rare);
        perform journal_note(p_world, p_uid, 'catch:' || v_rare);$a$,
       $a$perform journal_note(p_world, p_uid, 'fish:' || got);
      perform journal_note(p_world, p_uid, 'fished:' || water_kind(p_world, spot.x, spot.y));$a$,
       $a$perform journal_note(p_world, p_uid, 'netted');
    perform journal_note(p_world, p_uid, 'fished:' || water_kind(p_world, spot.x, spot.y));$a$]),
    (14, 'rpc_move', array[$a$  /*
   * And the wildlife is *not* put out here any more.$a$],
       array[$a$  -- And the journal's counts off the walk: tiles sailed, round the island, ashore on the dragon's, a laden cart on your bridge.
  perform journal_move(p_world, me, p, p_x, p_y, cart, v_xs, v_ys);
  /*
   * And the wildlife is *not* put out here any more.$a$])
  ) as t(ord, fn, olds, news) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    -- Patched once: a second run finds it done.
    continue when position(r.news[array_length(r.news, 1)] in v_def) > 0;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      -- A rare fish is said in two places, the line and the net; everything else is one.
      v_want := 1;
      if r.fn = 'perform_fish' and i = 1 then v_want := 2; end if;
      if v_n <> v_want then raise exception '% has % of %, not %', r.fn, v_n, r.olds[i], v_want; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
    end loop;
    execute v_def;
  end loop;
end $do$;

revoke all on function improved_to() from public, anon, authenticated;
revoke all on function water_kind(uuid, integer, integer) from public, anon, authenticated;
revoke all on function journal_move(uuid, uuid, player, double precision, double precision, placed, double precision[], double precision[])
  from public, anon, authenticated;

notify pgrst, 'reload schema';
select private.lock_doors();

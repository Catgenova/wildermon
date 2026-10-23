/*
 * The journal's goals for the island, for fighting and faith, and for people
 * and trade (`src/game/journal-c.ts`): what the island counts for them.
 *
 * Each count is one `journal_note` at the event, for whoever did the thing:
 *
 *   stone:<id>      a Runestone stood beside (`journal_walk`), or travelled to
 *   telestone       a journey by Telestone (`perform_telestone`)
 *   region:<n>      dry ground of a region stood on (`journal_walk`)
 *   snowline        ground at `snow_line` or higher stood on (`journal_walk`)
 *   trail           a tile worn into a trail under your feet (`wear_step`)
 *   fragment        a relic fragment dug up (`perform_dig`, investigate)
 *   restored:<id>   a relic restored, by what it restores into (`perform_dig`)
 *   ore:<id>        ore mined, by the ore (`perform_terrain`, `perform_cellar`)
 *   gem:<id>        a stone out of the rock, by the stone (`maybe_gem`)
 *   hoard:theirs    a hoard dug up off a map somebody else found (`perform_treasure`)
 *   fighter         a fighting trade taken (`rpc_take_class`)
 *   classtop        a fighting trade's last class tier opened (`class_learn`)
 *   cast:<id>       a class or faith spell off the bar (`rpc_cast_spell`), as a
 *                   path technique already was
 *   slewrare        a rare, supreme or fantastic wildermon killed (`wound_beast`)
 *   staunched       a bleeding wound dressed and held (`perform_fight`)
 *   sacrificed      a rare thing given up at an altar (`perform_sacrifice`)
 *   swirl           motes collected from a swirl (`perform_swirl`)
 *   grave           everything taken back out of your own grave (`perform_holding`)
 *   sold            a thing sold off your stall or counter, to its keeper (`rpc_buy`)
 *   filled          goods brought to somebody else's buy order (`rpc_order_fill`)
 *   letter          a letter sent (`rpc_letter`)
 *   citizen         a citizen of somebody else's settlement (`rpc_invite_answer`, `rpc_join_answer`)
 *   board           a place of yours on a skill or the wildermon board, read (`rpc_boards`)
 *
 * Where you stand is counted where the island is told it, on `rpc_move`, and
 * only while something there is still uncounted: a region and a stone are an
 * arithmetic look and a keyed read, the height one corner's row, and a body
 * that has all of them reads nothing past its own tally.
 *
 * A map remembers who found it (`treasure.finder`), from now on.
 *
 * Who already holds a fighting trade, its last tier or a citizenship is
 * counted once now, as the trade or the roll stands.
 */
set local lock_timeout = '3s';

alter table treasure add column if not exists finder uuid;

/** The snow line: `BANDS.snow` (`src/world/atlas-world.ts`), the height above which the ground was laid down snow or bare rock. */
create or replace function snow_line() returns int language sql immutable as $$ select 410 $$;

/**
 * How near a stone's centre counts as standing beside it, each way: the
 * outermost ring a Telestone sets a traveller down on (`landing_ring`), the
 * browser's `STONE_VISIT`.
 */
create or replace function stone_visit() returns int language sql immutable as $$
  select max(greatest(abs(dx), abs(dy)))::int from landing_ring()
$$;

/**
 * Where a walk ended, for the journal: a region's dry ground, the ground
 * beside a Runestone, and ground at the snow line or above, each counted the
 * first time. Read off the tally the walker already holds, so nothing is
 * looked up once all three are counted, and the ground's height only while
 * something is still to count.
 */
create or replace function journal_walk(p_world uuid, p_uid uuid, p_tally jsonb, p_x double precision, p_y double precision)
  returns void language plpgsql as $fn$
declare v_tally jsonb := coalesce(p_tally, '{}'::jsonb); v_size int; v_region int; v_stone text; v_h int;
        v_new_region boolean; v_new_stone boolean; v_new_snow boolean;
        tx int := floor(p_x)::int; ty int := floor(p_y)::int;
begin
  v_region := region_at(p_world, p_x, p_y);
  v_new_region := v_region is not null and region_middle(v_region) is not null and not v_tally ? ('region:' || v_region);
  select w.size into v_size from world w where w.id = p_world;
  select c.id into v_stone from runestone_centres(v_size) c
   where greatest(abs(tx - c.x), abs(ty - c.y)) <= stone_visit() order by c.ord limit 1;
  v_new_stone := v_stone is not null and not v_tally ? ('stone:' || v_stone);
  v_new_snow := not v_tally ? 'snowline';
  if not (v_new_region or v_new_stone or v_new_snow) then return; end if;
  -- On the ground, not in the water: a hull, a swim and a wade count for none of it.
  v_h := land_height(p_world, tx, ty);
  if v_h is null or v_h < 0 then return; end if;
  if v_new_region then perform journal_note(p_world, p_uid, 'region:' || v_region); end if;
  if v_new_stone then perform journal_note(p_world, p_uid, 'stone:' || v_stone); end if;
  if v_new_snow and v_h >= snow_line() then perform journal_note(p_world, p_uid, 'snowline'); end if;
end $fn$;

/*
 * The wear a step puts on the ground knows whose feet they were, so the step
 * that wears a trail is counted for them. The walker goes on the end of both,
 * defaulted, so a call without one is the same call it was.
 */
do $do$
declare v_def text; v_n int; r record;
begin
  for r in select * from (values
    ('wear_step', 'public.wear_step(uuid, integer, integer)',
     array[$$wear_step(p_world uuid, p_x integer, p_y integer)$$,
           $a$  perform land_announce(p_world, p_x, p_y);
end $function$$a$],
     array[$$wear_step(p_world uuid, p_x integer, p_y integer, p_uid uuid DEFAULT NULL::uuid)$$,
           $a$  perform land_announce(p_world, p_x, p_y);
  -- And worn by whoever walked it, for the journal.
  if p_uid is not null then perform journal_note(p_world, p_uid, 'trail'); end if;
end $function$$a$]),
    ('wear_walk', 'public.wear_walk(uuid, double precision, double precision, double precision, double precision)',
     array[$$p_y1 double precision)$$, $$perform wear_step(p_world, tx, ty);$$],
     array[$$p_y1 double precision, p_uid uuid DEFAULT NULL::uuid)$$, $$perform wear_step(p_world, tx, ty, p_uid);$$])
  ) as t(fn, sig, olds, news) loop
    select pg_get_functiondef(r.sig::regprocedure) into v_def;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      if v_n <> 1 then raise exception '% has % of %, not 1', r.fn, v_n, r.olds[i]; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
    end loop;
    execute format('drop function %s', r.sig);
    execute v_def;
  end loop;
end $do$;

/*
 * And every count at its event, patched into each function as it stands: an
 * anchor that must be there exactly as many times as said, and the anchor
 * again with the count beside it.
 */
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Where a walk ends, and the walker on the wear it puts on the ground.
    (1, 'rpc_move', $$  perform drag_along(p_world, me, p_x, p_y);
$$, $$  perform drag_along(p_world, me, p_x, p_y);
  -- And where it ended, for the journal: a region, a Runestone, the snow line (`journal_walk`).
  if p_level = 0 then perform journal_walk(p_world, me, p.tally, p_x, p_y); end if;
$$, 1),
    (2, 'rpc_move', $$perform wear_walk(p_world, v_xs[v_leg - 1], v_ys[v_leg - 1], v_xs[v_leg], v_ys[v_leg]);$$,
     $$perform wear_walk(p_world, v_xs[v_leg - 1], v_ys[v_leg - 1], v_xs[v_leg], v_ys[v_leg], me);$$, 1),
    -- A journey by Telestone, and the stone it went to.
    (3, 'perform_telestone', $$  insert into telestone_journey (world_id, uid, used_at, until)$$,
     $$  perform journal_note(p_world, p_uid, 'telestone');
  perform journal_note(p_world, p_uid, 'stone:' || s.id);
  insert into telestone_journey (world_id, uid, used_at, until)$$, 1),
    -- A relic fragment out of the ground, and a relic restored by what it restores into.
    (4, 'perform_dig', $$    v_left := coalesce(array_length(parts_missing(p_world, p_uid, r.name), 1), 0);
$$, $$    perform journal_note(p_world, p_uid, 'fragment');
    v_left := coalesce(array_length(parts_missing(p_world, p_uid, r.name), 1), 0);
$$, 1),
    (5, 'perform_dig', $$  perform journal_note(p_world, p_uid, 'restored');
$$, $$  perform journal_note(p_world, p_uid, 'restored');
  perform journal_note(p_world, p_uid, 'restored:' || r.result);
$$, 1),
    -- Ore, by the ore: off a face, a corner cut and a cellar dug.
    (6, 'perform_terrain', $$if yields like '%\_ore' then perform journal_note(p_world, p_uid, 'ore'); end if;$$,
     $$if yields like '%\_ore' then
      perform journal_note(p_world, p_uid, 'ore');
      perform journal_note(p_world, p_uid, 'ore:' || yields);
    end if;$$, 2),
    (7, 'perform_cellar', $$if r.yields like '%\_ore' then perform journal_note(p_world, p_uid, 'ore'); end if;$$,
     $$if r.yields like '%\_ore' then
      perform journal_note(p_world, p_uid, 'ore');
      perform journal_note(p_world, p_uid, 'ore:' || r.yields);
    end if;$$, 1),
    -- A stone out of the rock, by the stone.
    (8, 'maybe_gem', $$  perform gather(p_world, p_uid, 'gem', 1, v_ql, v_gem);
$$, $$  perform gather(p_world, p_uid, 'gem', 1, v_ql, v_gem);
  perform journal_note(p_world, p_uid, 'gem:' || lower(v_gem));
$$, 1),
    -- Who found a map, and a hoard dug up off somebody else's.
    (9, 'bury_treasure', $$  insert into treasure (item_id, world_id, x, y, tier)
    values (v_id, p_world, v_spot.x, v_spot.y, v_tier.id);$$,
     $$  insert into treasure (item_id, world_id, x, y, tier, finder)
    values (v_id, p_world, v_spot.x, v_spot.y, v_tier.id, p_uid);$$, 1),
    (10, 'perform_treasure', $$  perform journal_note(p_world, p_uid, 'hoard');
$$, $$  perform journal_note(p_world, p_uid, 'hoard');
  if v_t.finder is not null and v_t.finder <> p_uid then perform journal_note(p_world, p_uid, 'hoard:theirs'); end if;
$$, 1),
    -- A fighting trade taken, and its last class tier opened.
    (11, 'rpc_take_class', $$    perform spell_bar_clear_class(p_world, me);
$$, $$    perform spell_bar_clear_class(p_world, me);
    perform journal_note(p_world, me, 'fighter');
$$, 1),
    (12, 'class_learn', $$  update player set class_level = v_now where world_id = p_world and uid = p_uid;
$$, $$  update player set class_level = v_now where world_id = p_world and uid = p_uid;
  if p.class_level < (select max(t.at) from class_tier t) and v_now >= (select max(t.at) from class_tier t) then
    perform journal_note(p_world, p_uid, 'classtop');
  end if;
$$, 1),
    -- A class spell and a faith spell cast, as a path technique is.
    (13, 'rpc_cast_spell', $$    perform class_momentum(p_world, me);
$$, $$    perform class_momentum(p_world, me);
    perform journal_note(p_world, me, 'cast:' || s.id);
$$, 1),
    (14, 'rpc_cast_spell', $$  perform skill_raise(p_world, me, faith_skill(), 0.6);
$$, $$  perform skill_raise(p_world, me, faith_skill(), 0.6);
  perform journal_note(p_world, me, 'cast:' || s.id);
$$, 1),
    -- A rare wildermon killed.
    (15, 'wound_beast', $$    perform journal_note(p_world, p_teller, 'slew:' || c.species);
$$, $$    perform journal_note(p_world, p_teller, 'slew:' || c.species);
    if c.rare is not null then perform journal_note(p_world, p_teller, 'slewrare'); end if;
$$, 1),
    -- A bleeding wound dressed, and the dressing held.
    (16, 'perform_fight', $$    perform journal_note(p_world, p_uid, 'dressed');
$$, $$    perform journal_note(p_world, p_uid, 'dressed');
    if clean and coalesce((hurt->>'bleeding')::boolean, false) then perform journal_note(p_world, p_uid, 'staunched'); end if;
$$, 1),
    -- A rare thing given up at an altar.
    (17, 'perform_sacrifice', $$  perform consume(p_world, p_uid, (s.o_item).def, 1, (s.o_item).id);
$$, $$  perform consume(p_world, p_uid, (s.o_item).def, 1, (s.o_item).id);
  perform journal_note(p_world, p_uid, 'sacrificed');
$$, 1),
    -- Motes out of a swirl.
    (18, 'perform_swirl', $$  perform gather(p_world, p_uid, s.element || '_mote', v_n, product_ql(v_skill));
$$, $$  perform gather(p_world, p_uid, s.element || '_mote', v_n, product_ql(v_skill));
  perform journal_note(p_world, p_uid, 'swirl');
$$, 1),
    -- Everything taken back out of your own grave.
    (19, 'perform_holding', $$    -- Honey out of a hive, for the journal.
$$, $$    -- Your own grave emptied, for the journal.
    if p.crumbles_at is not null and p.made_by = p_uid then perform journal_note(p_world, p_uid, 'grave'); end if;
    -- Honey out of a hive, for the journal.
$$, 1),
    -- Sold off a stall or a counter, to whoever keeps it.
    (20, 'rpc_buy', $$    perform away_count(p_world, v_pl.made_by, 'sold', v_it.def, v_it.count, v_it.price);
$$, $$    perform away_count(p_world, v_pl.made_by, 'sold', v_it.def, v_it.count, v_it.price);
    perform journal_note(p_world, v_pl.made_by, 'sold');
$$, 1),
    -- Goods brought to somebody else's order.
    (21, 'rpc_order_fill', $$  perform give_coins(p_world, me, v_paid);
$$, $$  perform give_coins(p_world, me, v_paid);
  perform journal_note(p_world, me, 'filled');
$$, 1),
    -- A letter sent: words of your own, not the line a parcel without a note travels with.
    (22, 'rpc_letter', $$    returning n into v_n;
$$, $$    returning n into v_n;
  if v_text <> parcel_note() then perform journal_note(p_world, me, 'letter'); end if;
$$, 1),
    -- A citizen of somebody else's settlement, asked in or let in.
    (23, 'rpc_invite_answer', $$  insert into deed_member (world_id, founder, uid) values (p_world, p_founder, me);
$$, $$  insert into deed_member (world_id, founder, uid) values (p_world, p_founder, me);
  perform journal_note(p_world, me, 'citizen');
$$, 1),
    (24, 'rpc_join_answer', $$  insert into deed_member (world_id, founder, uid) values (p_world, p_founder, p_uid);
$$, $$  insert into deed_member (world_id, founder, uid) values (p_world, p_founder, p_uid);
  perform journal_note(p_world, p_uid, 'citizen');
$$, 1),
    -- A place of yours on a skill board or the wildermon board, as the boards are read.
    (25, 'rpc_boards', $$declare me uuid := auth.uid(); v_top int := board_top();$$,
     $$declare me uuid := auth.uid(); v_top int := board_top(); v_out jsonb;$$, 1),
    (26, 'rpc_boards', $$  return jsonb_build_object(
    'skills', ($$, $$  v_out := jsonb_build_object(
    'skills', ($$, 1),
    (27, 'rpc_boards', $a$               order by n limit v_top) r));
end $function$$a$, $a$               order by n limit v_top) r));
  -- Once: a board read again and again writes nothing more.
  if (jsonb_path_exists(v_out, '$.skills.*[*] ? (@.mine == true)')
      or jsonb_path_exists(v_out, '$.wildermon[*] ? (@.mine == true)'))
     and not exists (select 1 from player where world_id = p_world and uid = me and tally ? 'board') then
    perform journal_note(p_world, me, 'board');
  end if;
  return v_out;
end $function$$a$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of the line to change, not %: %', r.fn, v_n, r.n, r.old; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

-- Counted once now for whoever already holds them: a fighting trade, its last tier, a citizenship.
update player p set tally = coalesce(p.tally, '{}'::jsonb) || jsonb_build_object('fighter', 1)
 where p.combat_class is not null and not coalesce(p.tally, '{}'::jsonb) ? 'fighter';
update player p set tally = coalesce(p.tally, '{}'::jsonb) || jsonb_build_object('classtop', 1)
 where p.combat_class is not null and p.class_level >= (select max(t.at) from class_tier t)
   and not coalesce(p.tally, '{}'::jsonb) ? 'classtop';
update player p set tally = coalesce(p.tally, '{}'::jsonb) || jsonb_build_object('citizen', 1)
 where exists (select 1 from deed_member m where m.world_id = p.world_id and m.uid = p.uid and m.founder <> p.uid)
   and not coalesce(p.tally, '{}'::jsonb) ? 'citizen';

notify pgrst, 'reload schema';
select private.lock_doors();

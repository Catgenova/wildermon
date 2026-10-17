-- The journal counts only your own work, and counts what each goal says.
--
-- Reported: "Journal is largely bugged, often receiving completions when
-- another online player completes a task. Some journal tasks seem completely
-- bugged." The browser reads the journal off the counts the island keeps for
-- each player (`journal_note`); a dozen goals read something else, or read a
-- count nothing on the island ever made. Each now has a count of its own,
-- noted here for whoever did the thing, and noted the same in the browser
-- playing alone:
--
--   smelted         ore charged into a smelter. The goal read the lump, which
--                   a furnace hands back on its own clock and nobody noted.
--   improved50/90   an Improve pass that leaves the thing at QL 50 / 90. The
--                   goal read anything that good in the pack, bought or not.
--   sowed           seed sown in a field. The goal read Farming 3.
--   honey           honey taken out of a hive, one or all, or a skep. The goal
--                   read honey sitting in a hive, before anybody took it.
--   walled          a wall of a building finished (a fence is not one), and
--   storey          a floor finished on a second storey or higher. The goals
--                   read every building in view, which keeps no builder, so a
--                   neighbour's house finished yours.
--   restored        a relic put back together. The goal read Restoration 5.
--   fantasticblood  a young one with a fantastic trait born to your dam. The
--                   goal read any of yours with one, bought or traded.
--   team:<vehicle>  a cart or a wagon with its whole team in its yokes. The
--                   wagon's was read off the creatures in view, and a yoke of
--                   anything ticked the large cart.
--   slept:own       a night in a bed you built. Anybody's bed did.

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('perform_firing', $$      || '. Each charge is about ' || round(v_secs) || ' seconds of heat and comes out as one lump.', 'event');
$$, $$      || '. Each charge is about ' || round(v_secs) || ' seconds of heat and comes out as one lump.', 'event');
    -- Smelting, for the journal: ore into the fire, which is the job; the lump comes back on the furnace's clock.
    perform journal_note(p_world, p_uid, 'smelted');
$$),
    ('perform_item', $$    perform tell(p_world, p_uid, 'The ' || v_name || ' is better than it was. (QL '
$$, $$    -- The journal's two Improve goals, at the quality a pass of yours leaves it at.
    if v_it.ql >= 50 then perform journal_note(p_world, p_uid, 'improved50'); end if;
    if v_it.ql >= 90 then perform journal_note(p_world, p_uid, 'improved90'); end if;
    perform tell(p_world, p_uid, 'The ' || v_name || ' is better than it was. (QL '
$$),
    ('sow_one', $$  perform crop_sown(p_world, p_x, p_y, cd.id);
$$, $$  perform crop_sown(p_world, p_x, p_y, cd.id);
  -- Seed in a field, for the journal.
  perform journal_note(p_world, p_uid, 'sowed');
$$),
    ('perform_crate', $$    if move_part(v_it.id, v_want, 'player', p_uid, null, null) is null then return; end if;
$$, $$    if move_part(v_it.id, v_want, 'player', p_uid, null, null) is null then return; end if;
    -- Honey out of a hive, for the journal.
    if v_it.def = 'honey' and v_it.holder = 'furniture' and v_pl.sub = 'hive' then
      perform journal_note(p_world, p_uid, 'honey');
    end if;
$$),
    ('perform_holding', $$    update item set holder = 'player', holder_uid = p_uid, placed = null
      where placed = p.id and holder = 'furniture';
$$, $$    -- Honey out of a hive, for the journal.
    if p.sub = 'hive' and exists (select 1 from item q where q.placed = p.id and q.holder = 'furniture' and q.def = 'honey') then
      perform journal_note(p_world, p_uid, 'honey');
    end if;
    update item set holder = 'player', holder_uid = p_uid, placed = null
      where placed = p.id and holder = 'furniture';
$$),
    ('perform_skep', $$  perform gather(p_world, p_uid, 'honey', v_honey, v_ql);
$$, $$  perform gather(p_world, p_uid, 'honey', v_honey, v_ql);
  -- A skep is a hive too, for the journal.
  perform journal_note(p_world, p_uid, 'honey');
$$),
    ('perform_building', $$    if bill_done(bill) then
      what := case when wt.low then lower(wt.name) else 'wall' end;
$$, $$    if bill_done(bill) then
      what := case when wt.low then lower(wt.name) else 'wall' end;
      -- A wall of a building finished, for the journal; a fence is not one.
      if not coalesce(wt.low, false) then perform journal_note(p_world, p_uid, 'walled'); end if;
$$),
    ('perform_building', $$    if bill_done(bill) then
      perform tell(p_world, p_uid, 'You finish the ' || what || '.', 'event');
$$, $$    if bill_done(bill) then
      -- A floor finished on a second storey or higher, for the journal.
      if f.kind = 'floor' and lvl >= 1 then perform journal_note(p_world, p_uid, 'storey'); end if;
      perform tell(p_world, p_uid, 'You finish the ' || what || '.', 'event');
$$),
    ('perform_dig', $$  v_new := give(p_world, p_uid, r.result, 1, v_ql);
$$, $$  v_new := give(p_world, p_uid, r.result, 1, v_ql);
  -- A relic put back together, for the journal.
  perform journal_note(p_world, p_uid, 'restored');
$$),
    ('drop_young', $$      perform journal_note(p_world, v_dam.keeper, 'goodblood');
    end if;
$$, $$      perform journal_note(p_world, v_dam.keeper, 'goodblood');
    end if;
    if exists (select 1 from unnest(coalesce(v_traits, '{}')) t
               join trait_def td on td.id = t where td.tier = 'fantastic') then
      perform journal_note(p_world, v_dam.keeper, 'fantasticblood');
    end if;
$$),
    ('perform_ride', $$      perform journal_note(p_world, p_uid, 'hitched');
$$, $$      perform journal_note(p_world, p_uid, 'hitched');
      -- A whole team in its yokes, for the journal's cart and wagon.
      if v_n >= v.needs then perform journal_note(p_world, p_uid, 'team:' || p.sub); end if;
$$),
    ('perform_last', $$    perform journal_note(p_world, p_uid, 'slept');
$$, $$    perform journal_note(p_world, p_uid, 'slept');
    -- In a bed you built, for the journal.
    if pc.made_by = p_uid then perform journal_note(p_world, p_uid, 'slept:own'); end if;
$$)
  ) as t(fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of the line to change, not 1', r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();

-- Goals of the wildermon and of a settlement: the counts they read.
--
-- Thirty-eight goals joined the journal's The wildermon and Standing (`src/game/journal-a.ts`). Those that read what
-- the browser holds of your own need nothing here; these are the counts the rest read, each noted for whoever did the
-- thing, where it is done (`journal_note`), and the same in the browser (`Game.note`):
--
--   evolved:<stage>    one of yours reaching a stage (1 its second, 2 its third), at the go that evolves it
--   mutated            a young one born to your dam with a mutation
--   line:<depth>       a young one born to your dam, the deepest its line runs on any channel, past one
--   bred:form          a young one born to your dam in a wild form
--   tamed:form         a wild form tamed, by an offering, a trap or a spell: its Field guide mark (the trigger below)
--   guide:seen         a kind's own page marked seen in your Field guide, a stage's or a form's not (the trigger below)
--   guide:page         a kind's page marked tamed and bred both (the trigger below)
--   tracked            a trail read from the Field guide, a wild one found
--   mirrored           a covering a bronze mirror's mark copies a trait into
--   rekindled          an ancient lamp that kindles a trait
--   bedded:own         a worker of yours lying down in a bed you built (once: it comes round every rest)
--   sparred            a spar on a settlement, for the Sparra's keeper (once: it comes round every go)
--   built:<wall type>  a wall of any type finished: a rune gate, a portcullis, a hidden door
--   bridged:<kind>     a bridge's last span decked, by its kind: a drawbridge
--   storey:<n>         a floor finished on storey n, n of 2 and over
--   pier               a ground-floor floor finished on a tile that stands on piers
--   outstair           an outside staircase finished: a staircase on a storey over a tile no building stands on
--   cellar             a cellar tile dug out to its whole depth
--   cellared           something dropped on a cellar floor
--   spring             a spring dug
--   aqueduct           an aqueduct's last span laid, with a spring's water running along it
--   well:own           a bucket filled out of a well you built
--   harvest:glass      a crop harvested that grew under glass
--   stones / waterplant  stepping stones laid; a water lily or a lotus planted
--   binfull            a raw material bin filled to the last of its room, by you or a worker of yours (once)
--   delivered          work you set on your settlement delivered toward by another citizen
--
-- A count that comes round on a clock (a spar, a worker's rest, a bin a worker keeps full) is noted once, by
-- `journal_once`, which writes nothing when the count is already there. The Field guide's counts are kept off its own
-- rows, so every way a mark is made counts; and the book kept before them is counted once, here.

set local lock_timeout = '3s';

-- A count noted once and never again: nothing is written when it is already there.
create or replace function journal_once(p_world uuid, p_uid uuid, p_key text) returns void language sql as $fn$
  update player set tally = jsonb_set(coalesce(tally, '{}'::jsonb), array[p_key], '1'::jsonb), tally_at = now()
   where world_id = p_world and uid = p_uid and p_uid is not null and p_key is not null and p_key <> ''
     and not (coalesce(tally, '{}'::jsonb) ? p_key)
$fn$;

/* ---- The Field guide ------------------------------------------------------------------------------------------- */

-- Whether a key in the book is a kind's own page: not a stage's (`species:stage`) nor a form's (`species/form`).
create or replace function guide_kind_page(p_key text) returns boolean language sql immutable as $fn$
  select position(':' in p_key) = 0 and position('/' in p_key) = 0
$fn$;

-- A mark in somebody's book, counted for their journal as it is made.
create or replace function guide_journal() returns trigger language plpgsql as $fn$
begin
  if guide_kind_page(new.species) then
    if tg_op = 'INSERT' then perform journal_note(new.world_id, new.uid, 'guide:seen'); end if;
    if new.tamed and new.bred and (tg_op = 'INSERT' or not (old.tamed and old.bred)) then
      perform journal_note(new.world_id, new.uid, 'guide:page');
    end if;
  elsif position('/' in new.species) > 0 and new.tamed and (tg_op = 'INSERT' or not old.tamed) then
    perform journal_note(new.world_id, new.uid, 'tamed:form');
  end if;
  return null;
end $fn$;
select private.shut('drop trigger if exists guide_journal on public.guide');
select private.shut($ddl$create trigger guide_journal after insert or update of tamed, bred on public.guide
  for each row execute function guide_journal()$ddl$);

-- The book kept before these counts, counted once: never fewer than its rows say.
update player p set tally = coalesce(p.tally, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'guide:seen', nullif(greatest(g.seen, coalesce((p.tally->>'guide:seen')::int, 0)), 0),
      'guide:page', nullif(greatest(g.page, coalesce((p.tally->>'guide:page')::int, 0)), 0),
      'tamed:form', nullif(greatest(g.form, coalesce((p.tally->>'tamed:form')::int, 0)), 0))),
    tally_at = now()
  from (select world_id, uid,
               count(*) filter (where guide_kind_page(species))::int as seen,
               count(*) filter (where guide_kind_page(species) and tamed and bred)::int as page,
               count(*) filter (where position('/' in species) > 0 and tamed)::int as form
          from guide group by world_id, uid) g
 where p.world_id = g.world_id and p.uid = g.uid;

/* ---- Where each is noted --------------------------------------------------------------------------------------- */

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Each stage reached by one of yours.
    (1, 'worker_learn_paced', 1, $$    if c.mode <> 'wild' and c.keeper is not null then
      perform tell(p_world, c.keeper, c.name || ' evolved: '$$,
     $$    if c.mode <> 'wild' and c.keeper is not null then
      -- Each stage it reached, for the journal.
      perform journal_note(p_world, c.keeper, 'evolved:' || st) from generate_series(stage_of(c) + 1, stage_of(c2)) st;
      perform tell(p_world, c.keeper, c.name || ' evolved: '$$),
    -- A mutation, its line's depth and a wild form, at the birth, for the dam's keeper.
    (2, 'drop_young', 1, $$    perform tell(p_world, v_dam.keeper, 'Born to ' || v_dam.name$$,
     $$    -- A mutation, the depth of its line and a wild form, for the journal.
    if v_dam.mode <> 'wild' then
      if exists (select 1 from jsonb_each_text(coalesce(v_coming->'from', '{}'::jsonb)) f where f.value = 'mutation') then
        perform journal_note(p_world, v_dam.keeper, 'mutated');
      end if;
      perform journal_note(p_world, v_dam.keeper, 'line:' || l.depth)
        from (select max(e.value::int) as depth from jsonb_each_text(coalesce(v_coming->'line', '{}'::jsonb)) e) l
       where l.depth > 1;
      if coalesce((v_coming->>'formColour')::boolean, false) or v_coming->>'formSize' is not null then
        perform journal_note(p_world, v_dam.keeper, 'bred:form');
      end if;
    end if;
    perform tell(p_world, v_dam.keeper, 'Born to ' || v_dam.name$$),
    -- A trail read.
    (3, 'perform_track', 1, $$  perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(true));$$,
     $$  perform journal_note(p_world, p_uid, 'tracked');
  perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(true));$$),
    -- A bronze mirror's copy at a covering.
    (4, 'pair_them', 1, $$      perform tell(p_world, p_uid, 'Bronze mirror: '$$,
     $$      perform journal_note(p_world, p_uid, 'mirrored');
      perform tell(p_world, p_uid, 'Bronze mirror: '$$),
    -- An ancient lamp that kindles.
    (5, 'perform_artifact', 1, $$      perform tell(p_world, p_uid, lamp_says(c.name, v_name, v_was, v_from, v_now, v_up), 'event');$$,
     $$      perform journal_note(p_world, p_uid, 'rekindled');
      perform tell(p_world, p_uid, lamp_says(c.name, v_name, v_was, v_from, v_now, v_up), 'event');$$),
    -- A worker lying down in a bed its keeper built.
    (6, 'worker_settle', 1, $$        update placed set sleeper = c.id where id = c.bed;$$,
     $$        update placed set sleeper = c.id where id = c.bed;
        if c.keeper is not null and exists (select 1 from placed b where b.id = c.bed and b.made_by = c.keeper) then
          perform journal_once(p_world, c.keeper, 'bedded:own');
        end if;$$),
    -- A spar on a settlement, for the Sparra's keeper.
    (7, 'spar_go', 1, $$  -- Yielded: it says until when.$$,
     $$  -- A spar, for the journal of the Sparra's keeper.
  perform journal_once(p_world, s.keeper, 'sparred');
  -- Yielded: it says until when.$$),
    -- A wall finished, by its type.
    (8, 'perform_building', 1, $$      if not coalesce(wt.low, false) then perform journal_note(p_world, p_uid, 'walled'); end if;$$,
     $$      if not coalesce(wt.low, false) then perform journal_note(p_world, p_uid, 'walled'); end if;
      -- And by its type: a rune gate, a portcullis, a hidden door.
      perform journal_note(p_world, p_uid, 'built:' || w.type);$$),
    -- A floor finished: the storey it is on, a deck on piers, an outside staircase.
    (9, 'perform_building', 1, $$      if f.kind = 'floor' and lvl >= 1 then perform journal_note(p_world, p_uid, 'storey'); end if;$$,
     $$      if f.kind = 'floor' and lvl >= 1 then perform journal_note(p_world, p_uid, 'storey'); end if;
      -- And the storey it is on, a deck on piers and an outside staircase, for the journal.
      if f.kind = 'floor' and lvl >= 1 then perform journal_note(p_world, p_uid, 'storey:' || (lvl + 1)); end if;
      if f.kind = 'floor' and lvl = 0
         and exists (select 1 from building_tile bt where bt.world_id = p_world and bt.x = tx and bt.y = ty and bt.pier) then
        perform journal_note(p_world, p_uid, 'pier');
      end if;
      if f.kind = 'stairs' and lvl >= 1
         and not exists (select 1 from building_tile bt where bt.world_id = p_world and bt.x = tx and bt.y = ty) then
        perform journal_note(p_world, p_uid, 'outstair');
      end if;$$),
    -- A bridge's last span, by its kind.
    (10, 'perform_last', 1, $$        perform journal_note(p_world, p_uid, 'bridged');$$,
     $$        perform journal_note(p_world, p_uid, 'bridged');
        perform journal_note(p_world, p_uid, 'bridged:' || b.kind);$$),
    -- A cellar dug out, with a shovel or a pickaxe.
    (11, 'perform_cellar', 2, $$      perform tell(p_world, p_uid, 'Cellar fully dug: ' || metres(cellar_depth()) || ' m down.', 'event');$$,
     $$      perform journal_note(p_world, p_uid, 'cellar');
      perform tell(p_world, p_uid, 'Cellar fully dug: ' || metres(cellar_depth()) || ' m down.', 'event');$$),
    -- And something dropped on its floor.
    (12, 'perform_cellar', 1, $$    perform tell(p_world, p_uid, 'Dropped: '$$,
     $$    perform journal_note(p_world, p_uid, 'cellared');
    perform tell(p_world, p_uid, 'Dropped: '$$),
    -- A spring dug.
    (13, 'perform_spring', 1, $$    perform skill_raise(p_world, p_uid, 'digging', 1);$$,
     $$    perform skill_raise(p_world, p_uid, 'digging', 1);
    perform journal_note(p_world, p_uid, 'spring');$$),
    -- An aqueduct finished, with water running along it once its springs are settled.
    (14, 'perform_aqueduct', 1, $$    perform tell(p_world, p_uid, aqueduct_says(p_world, b), 'system');$$,
     $$    if exists (select 1 from aqueduct_feed f where f.world_id = p_world and f.bridge_id = b.id) then
      perform journal_note(p_world, p_uid, 'aqueduct');
    end if;
    perform tell(p_world, p_uid, aqueduct_says(p_world, b), 'system');$$),
    -- A bucket out of a well you built.
    (15, 'perform_liquid', 1, $$    if not vessel_becomes(it.id, v_full, v_from.knack, v_ql) then return; end if;$$,
     $$    if not vessel_becomes(it.id, v_full, v_from.knack, v_ql) then return; end if;
    if v_from.made_by = p_uid and (select coalesce(fd.well, 0) > 0 from furniture_def fd where fd.id = v_from.sub) then
      perform journal_note(p_world, p_uid, 'well:own');
    end if;$$),
    -- A crop that grew under glass, harvested.
    (16, 'reap_one', 1, $$  delete from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;$$,
     $$  if c.glass then perform journal_note(p_world, p_uid, 'harvest:glass'); end if;
  delete from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;$$),
    -- Stepping stones laid, and a water plant planted.
    (17, 'perform_water_garden', 1, $$    perform tell(p_world, p_uid, 'Stepping stones laid: '$$,
     $$    perform journal_note(p_world, p_uid, 'stones');
    perform tell(p_world, p_uid, 'Stepping stones laid: '$$),
    (18, 'perform_water_garden', 1, $$    perform tell(p_world, p_uid, 'Planted: '$$,
     $$    perform journal_note(p_world, p_uid, 'waterplant');
    perform tell(p_world, p_uid, 'Planted: '$$),
    -- A raw material bin filled to the last of its room: by your hands, and by a worker of yours.
    (19, 'perform_holding', 1, $$    perform tell(p_world, p_uid,
      stored_line(v_fit, item_name(it), placed_name(p), v_want - v_fit), 'event');$$,
     $$    if exists (select 1 from furniture_def fd where fd.id = p.sub and fd.takes = 'raw') and furniture_spare(p) <= 0 then
      perform journal_once(p_world, p_uid, 'binfull');
    end if;
    perform tell(p_world, p_uid,
      stored_line(v_fit, item_name(it), placed_name(p), v_want - v_fit), 'event');$$),
    (20, 'worker_put', 1, $$    if v_in then return; end if;$$,
     $$    if v_in and v_at.kind = 'furniture' and c.keeper is not null
       and exists (select 1 from placed b join furniture_def fd on fd.id = b.sub
                    where b.id = v_at.id and fd.takes = 'raw' and furniture_spare(b) <= 0) then
      perform journal_once(p_world, c.keeper, 'binfull');
    end if;
    if v_in then return; end if;$$),
    -- Work delivered toward by another citizen, for whoever set it.
    (21, 'rpc_work_deliver', 1, $$  perform tell(p_world, me, settle_line('delivered', d.name, null, v_what, v_moved), 'event');$$,
     $$  if w.set_by is distinct from me then perform journal_note(p_world, w.set_by, 'delivered'); end if;
  perform tell(p_world, me, settle_line('delivered', d.name, null, v_what, v_moved), 'event');$$)
  ) as t(ord, fn, want, old, new) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.want then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.want; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();

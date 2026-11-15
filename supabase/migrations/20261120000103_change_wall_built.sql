/*
 * Change wall: the change built by a hod carrier too, and timed by what it is made of.
 *
 * Asked: "change wall/floor function doesn't seem to work, the wall retains
 * the same type and doesn't allow adding the new materials". A change planned
 * on a finished wall (`change_wall`) keeps its own bill in `wall_change`, and
 * the wall stands as it is till the last of that bill is in. A builder's go
 * reached it (`perform_change_build`); nothing else did:
 *
 *   * a hod carrier works what `hod_work` lists, and that listed the walls
 *     with their own bill still open and never a change: a finished wall's
 *     bill is paid, so a change on it was never brought a thing. Listed now,
 *     as the wall it is planned on (`kind` 'wall'), at the change's bill, so
 *     `hod_needing`, `hod_wanted`, `hod_left` and the rest see it as they
 *     see a wall; `hod_may` asks the change's gates, its material and type;
 *     and `hod_fit` fits a piece into the change, and with the last of it the
 *     wall is the new one;
 *   * the wall becoming the new one is `change_built`, the builder's go and
 *     the hod carrier's alike (`Game.changeBuilt` in the browser);
 *   * a go of Build wall on a change was timed by the standing wall's
 *     material on the storey the building is worked on (`work_kind` off
 *     `wall_at`): now the change's material, on the storey the job names, as
 *     its tool already was (`private.build_job_tool`).
 *
 * The browser's half: the walls ride the ground read's slow half, which a
 * browser asked for as a job was asked and not again for a minute, so a change
 * planned (or built) showed with no change on the wall, no Build change row,
 * and the old type (`src/net/island.ts`).
 */
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

/* ---- the change become the wall ------------------------------------------------------------------ */

-- A change planned for a finished wall with the last of its bill in: the wall is the new one -- its type, material
-- and bill, bare of paint, no padlock, no pane's colour, not let down -- the standing one's counter shut and the new
-- one's opened (`counters.ts`). The ivy is the wall's triggers' (`green_wall`). The new wall, or the wall as it was.
create or replace function change_built(p_world uuid, w wall) returns wall
language plpgsql as $$
declare ch wall_change := wall_change_of(p_world, w);
begin
  if ch.world_id is null or not bill_done(ch.needed) then return w; end if;
  perform counter_gone(p_world, w);
  delete from wall_change where world_id = p_world and level = w.level and dir = w.dir and x = w.x and y = w.y;
  update wall set type = ch.type, material = ch.material, needed = ch.needed, total = ch.total,
         dye = null, glass = null, lock = null, lowered = false, planned_by = coalesce(ch.planned_by, planned_by)
   where world_id = p_world and level = w.level and dir = w.dir and x = w.x and y = w.y
  returning * into w;
  -- A shop counter's store opens as it is finished (`counters.ts`).
  perform counter_finished(p_world, w);
  return w;
end $$;

create or replace function perform_change_build(p_world uuid, p_uid uuid, w wall, p_x integer, p_y integer)
returns void language plpgsql as $$
declare ch wall_change := wall_change_of(p_world, w); mat build_material_def; wt wall_type_def;
        bill jsonb; used text; v_laid text[] := '{}'; v_i int;
begin
  if ch.world_id is null or bill_done(ch.needed) then return; end if;
  select * into mat from build_material_def where id = ch.material;
  bill := ch.needed;
  for v_i in 1 .. greatest(1, floor(pk(p_world, p_uid, 'lay:' || build_work(mat.kind), 1))::int) loop
    exit when bill_done(bill);
    used := next_material(p_world, p_uid, ch.material, bill, p_x, p_y);
    exit when used is null or not take_material(p_world, p_uid, used, p_x, p_y, ch.material);
    bill := jsonb_set(bill, array[used], to_jsonb((bill->>used)::int - 1));
    v_laid := v_laid || used;
  end loop;
  if coalesce(array_length(v_laid, 1), 0) = 0 then return; end if;
  perform skill_raise(p_world, p_uid, mat.skill, 0.4);
  update wall_change set needed = bill
   where world_id = p_world and level = w.level and dir = w.dir and x = w.x and y = w.y;
  if not bill_done(bill) then
    perform tell(p_world, p_uid, 'Added: ' || laid_text(v_laid) || '. Still needed: '
      || bill_text(ch.material, bill) || '.', 'event');
    return;
  end if;
  -- The wall is the new one (`change_built`), as with a hod carrier's last piece.
  perform change_built(p_world, w);
  select * into wt from wall_type_def where id = ch.type;
  -- A wall of a building finished, for the journal, and by its type; a fence is not one.
  if not coalesce(wt.low, false) then perform journal_note(p_world, p_uid, 'walled'); end if;
  perform journal_note(p_world, p_uid, 'built:' || ch.type);
  perform tell(p_world, p_uid, 'Built: ' || lower(mat.name) || ' '
    || case when wt.low then lower(wt.name) else 'wall' end || '.', 'event');
end $$;

/* ---- a hod carrier ------------------------------------------------------------------------------- */

-- A change planned for a finished wall is work as the wall is, at the change's bill. A wall with a change on it is
-- finished, so it is not in the walls above it: each border once.
select pg_temp.patch_fn('hod_work(uuid, integer, integer, integer)',
  $o$   where wl.l is not null
  union all
  -- A garden bed's iron ribbons$o$,
  $n$   where wl.l is not null
  union all
  -- A change planned for a finished wall (`change_wall`): the wall's work, at the change's bill.
  select 'wall', c.level, c.dir, c.x, c.y, null, null, c.needed, c.total
    from wall_change c
   where c.world_id = p_world
     and c.x between p_cx - p_range and p_cx + p_range and c.y between p_cy - p_range and p_cy + p_range
     and c.needed @? '$.* ? (@ > 0)'
  union all
  -- A garden bed's iron ribbons$n$);

select pg_temp.patch_fn('hod_fit(uuid, text, integer, text, integer, integer, bigint, integer, text)',
  $o$declare w wall; s bridge_span;$o$,
  $n$declare w wall; ch wall_change; s bridge_span;$n$);

select pg_temp.patch_fn('hod_fit(uuid, text, integer, text, integer, integer, bigint, integer, text)',
  $o$  if p_kind = 'wall' then
    update wall set$o$,
  $n$  if p_kind = 'wall' then
    -- A change planned for a finished wall takes the piece; with the last of it the wall is the new one (`change_built`).
    update wall_change set needed = jsonb_set(needed, array[p_item], to_jsonb((needed->>p_item)::int - 1))
     where world_id = p_world and level = p_level and dir = p_dir and x = p_x and y = p_y
       and coalesce((needed->>p_item)::int, 0) > 0
    returning * into ch;
    if ch.world_id is not null then
      if bill_done(ch.needed) then
        select * into w from wall where world_id = p_world and level = p_level and dir = p_dir and x = p_x and y = p_y;
        perform change_built(p_world, w);
      end if;
      return true;
    end if;
    update wall set$n$);

-- And may fit it at the change's gates, its material and type (`craftgates.ts`, `hodMay`).
select pg_temp.patch_fn('hod_may(uuid, creature, text, integer, text, integer, integer)',
  $o$    when 'wall' then coalesce((select worker_build_open(c, w.material, w.type, null, null) from wall w
                                where w.world_id = p_world$o$,
  $n$    when 'wall' then coalesce((select worker_build_open(c, coalesce(ch.material, w.material), coalesce(ch.type, w.type), null, null)
                                 from wall w
                                 left join wall_change ch on ch.world_id = w.world_id and ch.level = w.level and ch.dir = w.dir
                                                         and ch.x = w.x and ch.y = w.y
                                where w.world_id = p_world$n$);

/* ---- a go's time --------------------------------------------------------------------------------- */

select pg_temp.patch_fn('work_kind(uuid, text, jsonb)',
  $o$declare v_mat text; v_building int; tx int; ty int;$o$,
  $n$declare v_mat text; v_building int; tx int; ty int; w wall;$n$);

select pg_temp.patch_fn('work_kind(uuid, text, jsonb)',
  $o$    v_mat := (wall_at(p_world, tx, ty, p_target->>'side')).material;$o$,
  $n$    -- On the storey the job names, and a change planned on it in its own material (`change_wall`).
    w := frame_wall_at(p_world, tx, ty, p_target->>'side', p_target);
    v_mat := coalesce((wall_change_of(p_world, w)).material, w.material);$n$);

select private.lock_doors();

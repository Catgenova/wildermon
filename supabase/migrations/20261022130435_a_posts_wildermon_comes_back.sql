-- A post's wildermon comes back when the post goes, as the browser's `leavePost` has it.
--
-- Reported: "When work posts expire or are pulled up the hitched wildermon disappear into the void." Pulled up, a post
-- let its worker go with its post cleared and nothing else: a settlement worker with no settlement, which nothing
-- draws or works; rotted away with no settlement, it went wild. Now, pulled up, rotted away or called off alike
-- (`post_release`): back to you to follow when you have no follower, else back to work at your settlement, else into
-- an empty wildermon crate in your pack, and only with none of those wild, each said in the browser's words.

set local lock_timeout = '3s';

create or replace function post_release(p_world uuid, p placed, p_why text) returns void
language plpgsql as $fn$
declare c creature; dd deed; v_crate bigint;
begin
  for c in select * from creature where world_id = p_world and post = p.id for update loop
    if c.keeper is null then
      update creature set post = null, mode = 'wild', phase = 'idle' where world_id = p_world and id = c.id;
      continue;
    end if;
    select * into dd from my_deed(p_world, c.keeper) md where md.world_id is not null;
    if companion_of(p_world, c.keeper) is null then
      update creature set post = null, mode = 'active', phase = 'idle', enemy = null, hunting = null,
          from_x = p.cx, from_y = p.cy + 0.6, to_x = p.cx, to_y = p.cy + 0.6,
          leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
        where world_id = p_world and id = c.id;
      perform tell(p_world, c.keeper, 'Post ' || p_why || ': ' || c.name || ' returns to you.', 'system');
    elsif dd.world_id is not null then
      update creature set post = null, mode = 'deed', phase = 'idle', enemy = null, hunting = null,
          from_x = dd.x + 0.5, from_y = dd.y + 1.5, to_x = dd.x + 0.5, to_y = dd.y + 1.5,
          leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
        where world_id = p_world and id = c.id;
      perform tell(p_world, c.keeper, 'Post ' || p_why || ': ' || c.name || ' back to work at ' || dd.name || '.', 'system');
    else
      v_crate := empty_crate(p_world, c.keeper);
      if v_crate is not null then
        perform crate_shut_in(p_world, c.id, v_crate, null);
        perform tell(p_world, c.keeper, 'Post ' || p_why || ': ' || c.name || ' into the wildermon crate in your pack.', 'system');
      else
        update creature set post = null, mode = 'wild', phase = 'idle' where world_id = p_world and id = c.id;
        perform tell(p_world, c.keeper, 'Post ' || p_why || ': no settlement, no empty wildermon crate, active slot taken. '
          || c.name || ' went wild.', 'error');
      end if;
    end if;
  end loop;
end $fn$;

do $do$
declare v_def text; v_old text; v_new text; v_from int; v_to int;
begin
  -- Rotted away.
  v_def := pg_get_functiondef('post_settle'::regproc);
  v_from := position('  select * into dd from my_deed(p.world_id, p.made_by) md where md.world_id is not null;' in v_def);
  v_to := position('  delete from placed where id = p_id;' in v_def);
  if v_from = 0 or v_to = 0 or v_to < v_from then raise exception 'post_settle: anchors'; end if;
  v_def := substr(v_def, 1, v_from - 1) || '  perform post_release(p.world_id, p, ''rotted away'');' || chr(10) || substr(v_def, v_to);
  execute v_def;

  -- Pulled up, and called off.
  v_def := pg_get_functiondef('perform_settlement'::regproc);
  v_old := $q$    update creature set post = null, phase = 'idle' where world_id = p_world and post = p.id;
    delete from placed where id = p.id;$q$;
  v_new := $q$    perform post_release(p_world, p, 'pulled up');
    delete from placed where id = p.id;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_settlement: pick anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_from := position('  elsif p_action = ''unassign_post'' then' in v_def);
  v_to := position('    perform tell(p_world, p_uid, c.name || '' is called off the post.'', ''system'');' in v_def);
  if v_from = 0 or v_to = 0 or v_to < v_from then raise exception 'perform_settlement: unassign anchors'; end if;
  v_to := v_to + length('    perform tell(p_world, p_uid, c.name || '' is called off the post.'', ''system'');');
  v_def := substr(v_def, 1, v_from - 1) || $q$  elsif p_action = 'unassign_post' then
    perform post_release(p_world, p, 'stood down');$q$ || substr(v_def, v_to);
  execute v_def;
end $do$;

select private.lock_doors();

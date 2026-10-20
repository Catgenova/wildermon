-- A work post takes a wildermon that follows you or sits in a crate you carry or stand beside, as Hitch does.
--
-- Asked for: "Bug: workposts aren't working. Make it work almost like a Hitch, able to select the wildermon following
-- or held in crates in inventory in a menu on the post." The browser named the wildermon `creatureId` and the island
-- read `creature`, so every pick came back "Choose a wildermon."; the browser now sends `creature`. Here the island
-- also asks what Hitch asks: the wildermon is yours, and it follows you within 4 tiles or is in a crate to hand
-- (`crate_to_hand`); one in a crate comes out of it at the post (`crate_let_out`).

set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_new text;
begin
  v_def := pg_get_functiondef('settlement_refusal'::regproc);
  v_old := $q$    if c.mode = 'wild' then return c.name || ' is not yours to set to work.'; end if;
    -- The browser's words, which the island never had.
    if c.hitched_to is not null or c.rider is not null then return c.name || ' is in harness.'; end if;
$q$;
  v_new := $q$    if c.mode = 'wild' or c.keeper is distinct from p_uid then return c.name || ' is not yours to set to work.'; end if;
    -- The browser's words, which the island never had.
    if c.hitched_to is not null or c.rider is not null then return c.name || ' is in harness.'; end if;
    -- As Hitch: one following you, near, or one in a crate you carry or stand beside.
    if c.mode = 'stored' then
      if not crate_to_hand(p_world, p_uid, c) then return c.name || ' is in a crate out of reach.'; end if;
    elsif c.mode <> 'active' or c.post is not null then
      return c.name || ' is not following you.';
    elsif not creature_in_reach(p_world, p_uid, c, 4) then
      return c.name || ' is too far.';
    end if;
$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'settlement_refusal: anchor not found once'; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('perform_settlement'::regproc);
  v_old := $q$    select * into c from creature where world_id = p_world and id = (p_target->>'creature')::int;
    if not found then return; end if;
    update creature set post = p.id, mode = 'deed',$q$;
  v_new := $q$    select * into c from creature where world_id = p_world and id = (p_target->>'creature')::int;
    if not found then return; end if;
    -- Out of its crate first; it is set down at the post below.
    if c.mode = 'stored' then perform crate_let_out(p_world, c.id); end if;
    update creature set post = p.id, mode = 'deed',$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_settlement: anchor not found once'; end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

select private.lock_doors();

-- Wildermon text without prose: the island's words for taming, keeping, breeding, trapping, tracking, crates and
-- deed workers, rewritten to match the browser's.
--
-- Asked for: "Review all game text for cryptic AI talk. We dont need 'a boat under oars'. Just say 'boat row speed'.
-- We want no prose." Every message here keeps its numbers and conditions and loses the narration around them, and the
-- browser (src/game/creatures.ts, creatureActions.ts, creaturecrate.ts, husbandry.ts, traps.ts, tracking.ts) says the
-- same words. A failed taming and a release no longer narrate what the creature did ("Taming failed.", "Released:
-- Reedpup."), so the two columns that held that narration, `species_def.tame_fail` and `species_def.leaves`, go.
--
-- Each change is a text patch on the function as it stands (`private.patch_text`): the old text must occur exactly as
-- often as expected, or the migration stops.

set local lock_timeout = '3s';

-- Replace text in one function's definition, asserting how many times it occurs, and re-create the function.
create or replace function private.patch_text(p_fn text, p_old text, p_new text, p_count int default 1)
returns void language plpgsql as $fn$
declare v_def text; v_n int; v_fns int;
begin
  select count(*) into v_fns from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = p_fn;
  if v_fns <> 1 then raise exception '% has % definitions, not 1', p_fn, v_fns; end if;
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = p_fn;
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_count then raise exception '% has % of %, not %', p_fn, v_n, left(p_old, 80), p_count; end if;
  execute replace(v_def, p_old, p_new);
end $fn$;

select private.patch_text('creature_refusal', $t$  if c.world_id is null then return 'It is gone.'; end if;$t$, $t$  if c.world_id is null then return 'Gone.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$    return c.name || ' is in the traces. Take it out first.';$t$, $t$    return c.name || ' is in the traces: unhitch it first.';$t$, 1);
select private.patch_text('creature_refusal', $t$    if c.hitched_to is not null then return c.name || ' is in the traces. Take it out first.'; end if;$t$, $t$    if c.hitched_to is not null then return c.name || ' is in the traces: unhitch it first.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$    return c.name || ' is not yours.';$t$, $t$    return c.name || ': not yours.';$t$, 1);
select private.patch_text('creature_refusal', $t$    return case when c.mode = 'wild' then 'The ' || lower(d.name) || ' is not close enough.'$t$, $t$    return case when c.mode = 'wild' then d.name || ': too far.'$t$, 1);
select private.patch_text('creature_refusal', $t$      return 'A ' || lower(d.name) || ' is not a wildermon. There is nothing to be done with it but kill it.';$t$, $t$      return d.name || ': cannot be tamed.';$t$, 1);
select private.patch_text('creature_refusal', $t$      return 'You need taming ' || to_char((tame_needs(c)).level, 'FM990.#') || ' to try.';$t$, $t$      return 'Need taming ' || to_char((tame_needs(c)).level, 'FM990.#') || '.';$t$, 1);
select private.patch_text('creature_refusal', $t$      return d.name || 's take ' || diet_text(c.species) || '. Bring some.';$t$, $t$      return 'Need an offering: ' || diet_text(c.species) || '.';$t$, 1);
select private.patch_text('creature_refusal', $t$    if c.mode = 'wild' then return 'It is not yours to set to work.'; end if;
    if c.mode = 'stored' then return c.name || ' is in a creature crate. Open the crate to set it to work.'; end if;
    if (my_deed(p_world, p_uid)).world_id is null then
      return 'You have no settlement to assign it to.';
    end if;
    if d.gathers is null then return 'A ' || lower(d.name) || ' has no trade to be set to.'; end if;$t$, $t$    if c.mode = 'wild' then return 'Not yours.'; end if;
    if c.mode = 'stored' then return c.name || ' is in a creature crate: open it first.'; end if;
    if (my_deed(p_world, p_uid)).world_id is null then
      return 'No settlement.';
    end if;
    if d.gathers is null then return d.name || ': no trade.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$      return 'A ' || lower(d.name) || ' cannot be set to that.';$t$, $t$      return d.name || ': not one of its trades.';$t$, 1);
select private.patch_text('creature_refusal', $t$      return 'Nobody has taught this island what '
        || (select plain from gather_def where id = coalesce(nullif(p_target->>'job', ''), d.gathers))
        || ' looks like yet.';$t$, $t$      return 'Not on islands yet: '
        || (select verb from gather_def where id = coalesce(nullif(p_target->>'job', ''), d.gathers))
        || '.';$t$, 1);
select private.patch_text('creature_refusal', $t$        return (my_deed(p_world, p_uid)).name || ' has work for ' || cap
          || ' wildermon at level ' || cap || '. Upgrade the settlement to take on more.';$t$, $t$        return (my_deed(p_world, p_uid)).name || ' full: ' || cap
          || ' workers at level ' || cap || '.';$t$, 1);
select private.patch_text('creature_refusal', $t$    if c.mode not in ('active', 'deed') then return 'It is not yours to feed.'; end if;$t$, $t$    if c.mode not in ('active', 'deed') then return 'Not yours.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$      return 'It eats ' || diet_text(c.species) || ', or drinks a bucket of whey.';$t$, $t$      return 'Eats: ' || diet_text(c.species) || ', or a bucket of whey.';$t$, 1);
select private.patch_text('creature_refusal', $t$    if d.monster then return 'Not that. Not ever.'; end if;
    if c.mode = 'wild' then return 'It is not yours to brush.'; end if;
    if pack_count(p_world, p_uid, 'brush') <= 0 then return 'You need a brush.'; end if;
    if c.care >= 0.995 then return c.name || ' has been brushed to a shine already.'; end if;$t$, $t$    if d.monster then return d.name || ': cannot be brushed.'; end if;
    if c.mode = 'wild' then return 'Not yours.'; end if;
    if pack_count(p_world, p_uid, 'brush') <= 0 then return 'Need a brush.'; end if;
    if c.care >= 0.995 then return c.name || ': care full.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$    if d.fleece is null then return 'There is nothing on it worth shearing.'; end if;
    if c.mode = 'wild' then return 'Tame it first; it will not stand still for you otherwise.'; end if;
    if pack_count(p_world, p_uid, 'carving_knife') <= 0 then return 'You need a knife to shear with.'; end if;
    if c.fleece < 0.35 then
      return c.name || ' has hardly any '
        || case when d.shear_yield = 'feather' then 'feathers' else 'fleece' end || ' back yet.';$t$, $t$    if d.fleece is null then return 'Nothing to shear.'; end if;
    if c.mode = 'wild' then return 'Tame it first.'; end if;
    if pack_count(p_world, p_uid, 'carving_knife') <= 0 then return 'Need a carving knife.'; end if;
    if c.fleece < 0.35 then
      return c.name || ': '
        || case when d.shear_yield = 'feather' then 'feathers' else 'fleece' end || ' under 35% grown.';$t$, 1);
select private.patch_text('creature_refusal', $t$    if not d.milk then return 'That is not something you milk.'; end if;
    if c.mode in ('wild', 'stored') then return 'It is not yours to milk.'; end if;$t$, $t$    if not d.milk then return 'Cannot be milked.'; end if;
    if c.mode in ('wild', 'stored') then return 'Not yours.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$      return 'You need an empty bucket.';
    end if;
    if c.sex <> 'female' then return c.name || ' is male. Nothing is coming out of him.'; end if;
    if c.fleece < milk_ready() then return c.name || ' has nothing to give yet.'; end if;$t$, $t$      return 'Need an empty bucket.';
    end if;
    if c.sex <> 'female' then return c.name || ' is male.'; end if;
    if c.fleece < milk_ready() then return c.name || ': no milk yet.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$    if c.mode <> 'active' then return 'Only a companion takes orders like that.'; end if;$t$, $t$    if c.mode <> 'active' then return 'Companions only.'; end if;$t$, 3);
select private.patch_text('creature_refusal', $t$      return 'Passive, defensive, guarding you or aggressive.';$t$, $t$      return 'Stance: passive, defensive, guarding you or aggressive.';$t$, 1);
select private.patch_text('creature_refusal', $t$then return 'Mark something wild first, or fight it.'; end if;$t$, $t$then return 'No target: mark a wild one or fight it.'; end if;$t$, 2);
select private.patch_text('creature_refusal', $t$      return 'It is more than ' || pk(pl.class_mul, 'leash:companion', companion_leash()) || ' tiles from you.';$t$, $t$      return 'Too far: max ' || pk(pl.class_mul, 'leash:companion', companion_leash()) || ' tiles.';$t$, 1);
select private.patch_text('creature_refusal', $t$    if c.mode = 'wild' then return 'It is not yours to name.'; end if;
    if nullif(btrim(coalesce(p_target->>'name', '')), '') is null then return 'Choose a name.'; end if;$t$, $t$    if c.mode = 'wild' then return 'Not yours.'; end if;
    if nullif(btrim(coalesce(p_target->>'name', '')), '') is null then return 'Need a name.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$    if c.mode = 'stored' then return c.name || ' is in a creature crate. Open the crate to let it out.'; end if;
    if c.mode <> 'deed' then return 'It is already with you.'; end if;$t$, $t$    if c.mode = 'stored' then return c.name || ' is in a creature crate: open it first.'; end if;
    if c.mode <> 'deed' then return 'Already with you.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$    if c.mode not in ('active', 'deed') then return 'It is not yours to put in a crate.'; end if;$t$, $t$    if c.mode not in ('active', 'deed') then return 'Not yours.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$    if empty_crate(p_world, p_uid) is null then return 'You need an empty creature crate in your pack.'; end if;$t$, $t$    if empty_crate(p_world, p_uid) is null then return 'Need an empty creature crate in your pack.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$    if c.mode = 'wild' then return 'It is already wild.'; end if;$t$, $t$    if c.mode = 'wild' then return 'Already wild.'; end if;$t$, 1);
select private.patch_text('creature_refusal', $t$      return c.name || '''s crate is on offer, on a stall or in the post. Take it back first.';$t$, $t$      return c.name || '''s crate is on offer, on a stall or in the post: take it back first.';$t$, 2);
select private.patch_text('creature_refusal', $t$    if c.mode = 'wild' then return 'That one is nobody''s. Fight it if you mean it.'; end if;$t$, $t$    if c.mode = 'wild' then return 'Not yours.'; end if;$t$, 1);
select private.patch_text('tame_room_refusal', $t$  select c.name || ' already follows you. Carry an empty creature crate to tame another: it goes into the crate.'$t$, $t$  select c.name || ' already follows you. Need an empty creature crate.'$t$, 1);
select private.patch_text('companion_swap', $t$  if v_cur.hitched_to is not null then v_why := v_cur.name || ' is in the traces. Take it out first.'; return; end if;$t$, $t$  if v_cur.hitched_to is not null then v_why := v_cur.name || ' is in the traces: unhitch it first.'; return; end if;$t$, 1);
select private.patch_text('companion_swap', $t$    then v_cur.name || ' has nowhere to go: ' || v_dd.name || ' has work for ' || worker_cap(p_world, p_uid)
         || ' wildermon at level ' || v_dd.level || ', and you carry no empty creature crate.'
    else v_cur.name || ' has nowhere to go: you have no settlement to set it to work on, and you carry no empty creature crate.' end;$t$, $t$    then v_cur.name || ' has nowhere to go: ' || v_dd.name || ' full (' || worker_cap(p_world, p_uid)
         || ' workers at level ' || v_dd.level || '), no empty creature crate.'
    else v_cur.name || ' has nowhere to go: no settlement, no empty creature crate.' end;$t$, 1);
select private.patch_text('perform_creature', $t$      perform tell(p_world, p_uid, 'A ' || lower(d.name) || ': ' || d.description
        || ' It has ' || ceil(c.health) || ' of ' || max_health(c) || ' in it and hits for '
        || to_char(attack_of(c), 'FM990') || '. It cannot be tamed. Kill it and butcher it, or keep well clear.', 'error');$t$, $t$      perform tell(p_world, p_uid, d.name || ': ' || case when d.description <> '' then d.description || ' ' else '' end
        || 'Health ' || ceil(c.health) || '/' || max_health(c) || ', blow '
        || to_char(attack_of(c), 'FM990') || '. Cannot be tamed.', 'error');$t$, 1);
select private.patch_text('perform_creature', $t$      perform tell(p_world, p_uid, 'A wild ' || lower(d.name) || ': ' || d.description
        || ' It eats ' || diet_text(c.species) || '.'
        || case when warm > 0 then ' It has taken ' ||
             case when c.coaxed = 1 then 'an offering' else c.coaxed || ' offerings' end
             || ' from your hand and is ' || to_char(warm * 100, 'FM990') || '% readier for the next.'
           else '' end
        || ' You would have to tame it to learn more.', 'event');$t$, $t$      perform tell(p_world, p_uid, 'Wild ' || lower(d.name) || ': ' || case when d.description <> '' then d.description || ' ' else '' end
        || 'Eats: ' || diet_text(c.species) || '.'
        || case when warm > 0 then ' Offerings taken: ' || c.coaxed
             || ', next +' || to_char(warm * 100, 'FM990') || '% chance.'
           else '' end, 'event');$t$, 1);
select private.patch_text('perform_creature', $t$        || '): ' || d.description || ' Level ' || creature_level(c.skills)
        || '. Health ' || ceil(c.health) || '/' || max_health(c) || '. It is ' || care_word(c.care)
        || ' and carries ' || trait_names(c.traits) || '. '
        || case when c.hunger < 0.3 then 'It looks hungry.' when c.hunger < 0.6 then 'It could eat.'
                else 'It looks well fed.' end
        || ' It eats ' || diet_text(c.species) || '.'$t$, $t$        || '): ' || case when d.description <> '' then d.description || ' ' else '' end || 'Level ' || creature_level(c.skills)
        || '. Health ' || ceil(c.health) || '/' || max_health(c) || '. Care: ' || care_word(c.care)
        || '. Traits: ' || trait_names(c.traits) || '. '
        || case when c.hunger < 0.3 then 'Hungry.' when c.hunger < 0.6 then 'Peckish.'
                else 'Fed.' end
        || ' Eats: ' || diet_text(c.species) || '.'$t$, 1);
select private.patch_text('perform_creature', $t$      perform tell(p_world, p_uid, 'The ' || lower(d.name) || ' takes the '
        || material_name(food, 1) || ' from your hand and trusts you. '
        || case when held is null then c.name || ' now follows you.'
             else 'It goes into the creature crate in your pack: set the crate down, or open it to have it follow you or work the deed.' end,
        'system');$t$, $t$      perform tell(p_world, p_uid, 'Tamed: ' || c.name || '. '
        || case when held is null then 'Follows you.'
             else 'In the creature crate in your pack.' end,
        'system');$t$, 1);
select private.patch_text('perform_creature', $t$      perform tell(p_world, p_uid, 'The ' || lower(d.name) || ' '
        || replace(d.tame_fail, '{food}', material_name(food, 1)) || '.'$t$, $t$      perform tell(p_world, p_uid, 'Taming failed.'$t$, 1);
select private.patch_text('perform_creature', $t$        || case when warm > 0 then ' It is growing used to you: '
             || to_char(warm * 100, 'FM990') || '% readier than the first time.'$t$, $t$        || case when warm > 0 then ' Next offering +'
             || to_char(warm * 100, 'FM990') || '% chance.'$t$, 1);
select private.patch_text('perform_creature', $t$      perform tell(p_world, p_uid, c.name || ' gobbles up the ' || material_name(food, 1) || '.', 'event');$t$, $t$      perform tell(p_world, p_uid, 'Fed ' || c.name || ': ' || material_name(food, 1) || '.', 'event');$t$, 1);
select private.patch_text('perform_creature', $t$    perform tell(p_world, p_uid, 'You '
      || case when coalesce(d.shear_yield, 'wool') = 'wool' then 'shear' else 'pluck' end
      || ' ' || c.name || ' and come away with ' || n || ' '
      || lower((select coalesce(name, 'wool') from item_def where id = coalesce(d.shear_yield, 'wool')))
      || '. (QL ' || to_char(made_ql, 'FM990.0') || ') It will grow back.', 'event');$t$, $t$    perform tell(p_world, p_uid,
      case when coalesce(d.shear_yield, 'wool') = 'wool' then 'Sheared' else 'Plucked' end
      || ' ' || c.name || ': ' || n || ' '
      || lower((select coalesce(name, 'wool') from item_def where id = coalesce(d.shear_yield, 'wool')))
      || ', QL ' || to_char(made_ql, 'FM990.0') || '.', 'event');$t$, 1);
select private.patch_text('perform_creature', $t$    perform tell(p_world, p_uid, c.name || ' will be '$t$, $t$    perform tell(p_world, p_uid, c.name || ' stance: '$t$, 1);
select private.patch_text('perform_creature', $t$    perform tell(p_world, p_uid, c.name || ' goes for the ' || lower((select sd.name from creature q$t$, $t$    perform tell(p_world, p_uid, c.name || ' attacks: ' || lower((select sd.name from creature q$t$, 1);
select private.patch_text('perform_creature', $t$    perform tell(p_world, p_uid, c.name || ' falls back to your side, and starts no fight for ' || fall_back() || ' seconds.', 'info');$t$, $t$    perform tell(p_world, p_uid, c.name || ' falls back: no new fights for ' || fall_back() || ' seconds.', 'info');$t$, 1);
select private.patch_text('perform_creature', $t$    perform tell(p_world, p_uid, 'It answers to ' || nm || ' now.', 'info');$t$, $t$    perform tell(p_world, p_uid, 'Renamed: ' || nm || '.', 'info');$t$, 1);
select private.patch_text('perform_creature', $t$    perform tell(p_world, p_uid, c.name || ' now follows you.', 'system');$t$, $t$    perform tell(p_world, p_uid, c.name || ' follows you.', 'system');$t$, 1);
select private.patch_text('perform_creature', $t$      perform tell(p_world, p_uid, c.name || ' stays behind in its place, and will ' || deed_job_line(c) || '.', 'info');$t$, $t$      perform tell(p_world, p_uid, c.name || ' assigned in its place: ' || deed_job_line(c) || '.', 'info');$t$, 1);
select private.patch_text('perform_creature', $t$        || ' goes into the creature crate in your pack.', 'info');$t$, $t$        || ': into the creature crate in your pack.', 'info');$t$, 1);
select private.patch_text('perform_creature', $t$    perform tell(p_world, p_uid, c.name || ' goes into the creature crate. Set the crate down and it can be seen inside.', 'system');$t$, $t$    perform tell(p_world, p_uid, c.name || ': into the creature crate.', 'system');$t$, 1);
select private.patch_text('perform_creature', $t$    perform tell(p_world, p_uid, c.name || ' will '
      || coalesce((select plain from gather_def where id = coalesce(nullif(p_target->>'job', ''), d.gathers)), 'stay around the settlement')
      || ' within ' || work_range(c) || ' tiles of the token and bring what it finds to the crate.', 'system');$t$, $t$    perform tell(p_world, p_uid, c.name || ' assigned: '
      || (select deed_job_line(q) from creature q where q.world_id = p_world and q.id = c.id) || '.', 'system');$t$, 1);
select private.patch_text('perform_creature', $t$    perform tell(p_world, p_uid, 'The ' || lower(d.name) || ' ' || d.leaves || '.', 'system');$t$, $t$    perform tell(p_world, p_uid, 'Released: ' || c.name || '.', 'system');$t$, 1);
select private.patch_text('perform_creature', $t$    perform tell(p_world, p_uid, 'You put ' || nm || ' down. The ' || lower(d.name)
      || '''s carcass lies where it stood, ready for the knife.', 'fight');$t$, $t$    perform tell(p_world, p_uid, 'Culled: ' || nm || '. ' || d.name || ' carcass left.', 'fight');$t$, 1);
select private.patch_text('deed_job_line', $t$                          || case when g.id in ('hive', 'scrub') or tend_job(g.id) then '' else ' and bring what it finds to the crate' end$t$, $t$                          || case when g.id in ('hive', 'scrub') or tend_job(g.id) then '' else '; output to the crate' end$t$, 1);
select private.patch_text('deed_job_line', $t$                  'stay around the settlement')$t$, $t$                  'no trade')$t$, 1);
select private.patch_text('artifact_refusal', $t$  if c.mode = 'wild' then return 'It is not yours.'; end if;
  if c.keeper is distinct from p_uid then return c.name || ' is not yours.'; end if;
  if c.mode = 'stored' then return c.name || ' is in a creature crate. Open the crate first.'; end if;$t$, $t$  if c.mode = 'wild' then return 'Not yours.'; end if;
  if c.keeper is distinct from p_uid then return c.name || ': not yours.'; end if;
  if c.mode = 'stored' then return c.name || ' is in a creature crate: open it first.'; end if;$t$, 1);
select private.patch_text('artifact_refusal', $t$then return 'You need ' || article(v_name) || ' ' || v_name || '.'; end if;$t$, $t$then return 'Need ' || article(v_name) || ' ' || v_name || '.'; end if;$t$, 1);
select private.patch_text('artifact_refusal', $t$    return c.name || ' is young already, and nothing is younger than young.';$t$, $t$    return c.name || ' is already young.';$t$, 1);
select private.patch_text('artifact_refusal', $t$    return c.name || ' is ' || c.rare || ' already, as rare as there is.';$t$, $t$    return c.name || ' is already ' || c.rare || ', the top rarity.';$t$, 1);
select private.patch_text('artifact_refusal', $t$    return 'Every base stat of ' || c.name || ' has ' || pot_most()::int || ' points from ancient pots, the most one takes.';$t$, $t$    return c.name || ': every base stat at ' || pot_most()::int || ' ancient pot points, the max.';$t$, 1);
select private.patch_text('lamp_kindled', $t$  select coalesce(d.name, p_id) || ', ' || article(coalesce(d.tier, 'common')) || ' ' || coalesce(d.tier, 'common') || ' trait'
      || coalesce(' (' || trait_says(p_id) || ')', '')$t$, $t$  select coalesce(d.name, p_id) || ' (' || concat_ws(', ', case when d.family is null then coalesce(d.tier, 'common') end,
      nullif(trait_says(p_id), '')) || ')'$t$, 1);
select private.patch_text('lamp_says', $t$      then 'You light the ' || p_lamp || ' over ' || p_creature || ': its ' || coalesce((select d.name from trait_def d where d.id = p_was), p_was)
        || ', ' || article(p_from) || ' ' || p_from || ' trait, goes out, and ' || lamp_kindled(p_now) || ' is kindled in its place'
      else 'You light the ' || p_lamp || ' over ' || p_creature || ': ' || lamp_kindled(p_now) || ' is kindled in an empty slot'
    end
    || case when p_up then ', a tier above ' || p_from else '' end
    || '. The lamp is used up'
    || case when not p_up and exists (select 1 from tier_odds t where t.ord > (select f.ord from tier_odds f where f.tier = p_from))
         then '; one time in ' || lamp_tier_odds()::int || ' it kindles one a tier above' else '' end
    || '.'$t$, $t$      then upper(left(p_lamp, 1)) || substr(p_lamp, 2) || ' used on ' || p_creature || ': ' || coalesce((select d.name from trait_def d where d.id = p_was), p_was)
        || ' (' || p_from || ') replaced by ' || lamp_kindled(p_now)
      else upper(left(p_lamp, 1)) || substr(p_lamp, 2) || ' used on ' || p_creature || ': ' || lamp_kindled(p_now) || ' added to an empty slot'
    end
    || case when p_up then ', a tier above ' || p_from else '' end
    || '.'
    || case when not p_up and exists (select 1 from tier_odds t where t.ord > (select f.ord from tier_odds f where f.tier = p_from))
         then ' Tier-up chance: 1 in ' || lamp_tier_odds()::int || '.' else '' end$t$, 1);
select private.patch_text('perform_artifact', $t$      then 'You comb ' || c.name || ' with the ' || v_name || ', and it is grown again: as old as one only just grown, at its full pace and pull. The comb is used up.'
      else 'You comb ' || c.name || ' with the ' || v_name || ', and it is young again: as young as one only just born, and it cannot be worked, ridden or put in the traces until it is grown. The comb is used up.'$t$, $t$      then upper(left(v_name, 1)) || substr(v_name, 2) || ' used on ' || c.name || ': now just grown, full pace and pull.'
      else upper(left(v_name, 1)) || substr(v_name, 2) || ' used on ' || c.name || ': now newborn; cannot be worked, ridden or put in the traces until grown.'$t$, 1);
select private.patch_text('perform_artifact', $t$      perform tell(p_world, p_uid, 'You go over ' || c.name || ' with the ' || v_name || ', and it comes up ' || v_rare
        || ': every figure its blood decides is ' || pct_say((select r.blood from rarity_def r where r.id = v_rare))
        || ' over an ordinary one''s. The file is used up.', 'event');$t$, $t$      perform tell(p_world, p_uid, upper(left(v_name, 1)) || substr(v_name, 2) || ' used on ' || c.name || ': now ' || v_rare
        || ', blood figures ' || pct_say((select r.blood from rarity_def r where r.id = v_rare))
        || '.', 'event');$t$, 1);
select private.patch_text('perform_artifact', $t$      perform tell(p_world, p_uid, 'You go over ' || c.name || ' with the ' || v_name || ', and it is no rarer. The file is used up; one time in '
        || file_rarity_odds()::int || ' it makes one a step rarer.', 'event');$t$, $t$      perform tell(p_world, p_uid, upper(left(v_name, 1)) || substr(v_name, 2) || ' used on ' || c.name || ': no change. Rarity-up chance: '
        || whole_pct(1 / file_rarity_odds()) || '.', 'event');$t$, 1);
select private.patch_text('perform_artifact', $t$      perform tell(p_world, p_uid, 'You light the ' || v_name || ' over ' || c.name || ', and nothing is kindled. The lamp is used up.', 'event');$t$, $t$      perform tell(p_world, p_uid, upper(left(v_name, 1)) || substr(v_name, 2) || ' used on ' || c.name || ': nothing kindled.', 'event');$t$, 1);
select private.patch_text('perform_artifact', $t$    perform tell(p_world, p_uid, 'You use the ' || v_name || ' on ' || c.name || ': its ' || lower(base_stat_name(v_stat))
      || ' takes a point, ' || pot_says(v_stat, v_points) || '. The pot is used up.', 'event');$t$, $t$    perform tell(p_world, p_uid, upper(left(v_name, 1)) || substr(v_name, 2) || ' used on ' || c.name || ': ' || lower(base_stat_name(v_stat))
      || ' ' || pot_says(v_stat, v_points) || '.', 'event');$t$, 1);
select private.patch_text('pot_says', $t$  select p_points || ' of ' || pot_most()::int || ': ' || base_stat_says(p_stat) || ' is '
      || whole_pct(pot_step() * p_points) || ' more than its kind and blood give it'$t$, $t$  select p_points || '/' || pot_most()::int || ' points, ' || base_stat_says(p_stat) || ' +'
      || whole_pct(pot_step() * p_points)$t$, 1);
select private.patch_text('base_stat_says', $t$    when 'hardy' then 'the health it can carry'
    when 'tough' then 'what each of its blows lands for'
    when 'speed' then 'its pace on its feet, under a rider and in the traces'
    when 'work' then 'the pace it gets each go of its task done at' end$t$, $t$    when 'hardy' then 'max health'
    when 'tough' then 'blow damage'
    when 'speed' then 'pace on foot, under a rider and in the traces'
    when 'work' then 'task speed' end$t$, 1);
select private.patch_text('care_word', $t$  select case when p_care >= 0.75 then 'well looked after' when p_care >= 0.4 then 'kept'
              when p_care >= 0.12 then 'wanting a brush' else 'neglected' end$t$, $t$  select case when p_care >= 0.75 then 'well kept' when p_care >= 0.4 then 'kept'
              when p_care >= 0.12 then 'needs brushing' else 'neglected' end$t$, 1);
select private.patch_text('spar_said', $t$  select 'You land one on ' || c.name || '. It is down to ' || greatest(0, ceil(p_health)) || ' of ' || max_health(c)
         || case when spar_yielded(c, p_health) then ', and yields' else '' end || '.'$t$, $t$  select 'Hit: ' || c.name || ' ' || greatest(0, ceil(p_health)) || '/' || max_health(c)
         || case when spar_yielded(c, p_health) then ', yields' else '' end || '.'$t$, 1);
select private.patch_text('side_blow', $t$perform tell(p_world, p_uid, 'You knock the ' || v_name || ' off its stroke.', 'fight');$t$, $t$perform tell(p_world, p_uid, 'Heavy blow broken: ' || v_name || '.', 'fight');$t$, 1);
select private.patch_text('class_riposte', $t$    perform tell(p_world, p_uid, 'You answer the ' || (b->>'name')
      || case when not (b->>'landed')::boolean then ' and miss.'
              when (b->>'died')::boolean then ', and it dies.'
              else case when (b->>'crit')::boolean then ' with a critical blow' else '' end
                || '. It is down to ' || (b->>'left') || ' of ' || (b->>'of') || '.' end, 'fight');$t$, $t$    perform tell(p_world, p_uid,
      case when not (b->>'landed')::boolean then 'Riposte missed: ' || (b->>'name') || '.'
              when (b->>'died')::boolean then 'Riposte: ' || (b->>'name') || ' killed.'
              else 'Riposte' || case when (b->>'crit')::boolean then ', critical' else '' end
                || ': ' || (b->>'name') || ' ' || (b->>'left') || '/' || (b->>'of') || '.' end, 'fight');$t$, 1);
select private.patch_text('fight_refusal', $t$    if c.world_id is null then return 'It is dead or gone.'; end if;$t$, $t$    if c.world_id is null then return 'Gone.'; end if;$t$, 1);
select private.patch_text('fight_refusal', $t$then return 'That one is tame. Release it first if you mean it.'; end if;$t$, $t$then return 'Tame: release it first.'; end if;$t$, 2);
select private.patch_text('fight_refusal', $t$then return c.name || ' has yielded. Let it get its breath back first.'; end if;$t$, $t$then return c.name || ' has yielded: wait.'; end if;$t$, 1);
select private.patch_text('fight_refusal', $t$      if dist > melee_reach(p_world, p_uid) then return 'It is out of reach.'; end if;$t$, $t$      if dist > melee_reach(p_world, p_uid) then return 'Out of reach.'; end if;$t$, 1);
select private.patch_text('fight_refusal', $t$      if not found then return 'You have no bow in your hands.'; end if;$t$, $t$      if not found then return 'Need a bow in hand.'; end if;$t$, 1);
select private.patch_text('fight_refusal', $t$      if dist < draw_nearest(p_world, p_uid) then return 'It is too close to draw on.'; end if;$t$, $t$      if dist < draw_nearest(p_world, p_uid) then return 'Too close to draw.'; end if;$t$, 1);
select private.patch_text('perform_fight', $t$      perform tell(p_world, p_uid, 'You swing at the ' || lower(d.name)
        || case when held.id is null then '' else ' with your '
             || lower((select name from item_def where id = held.def)) end || ' and miss.', 'fight');$t$, $t$      perform tell(p_world, p_uid, 'Missed: ' || lower(d.name) || '.', 'fight');$t$, 1);
select private.patch_text('perform_fight', $t$        perform tell(p_world, p_uid, 'You strike the ' || lower(d.name)
          || case when held.id is null then '' else ' with your '
               || lower((select name from item_def where id = held.def)) end
          || case when v_crit then ', a critical blow' else '' end
          || '. It is down to ' || greatest(0, ceil(c.health - dmg)) || ' of ' || max_health(c) || '.', 'fight');$t$, $t$        perform tell(p_world, p_uid, 'Hit'
          || case when v_crit then ', critical' else '' end
          || ': ' || lower(d.name) || ' ' || greatest(0, ceil(c.health - dmg)) || '/' || max_health(c) || '.', 'fight');$t$, 1);
select private.patch_text('perform_fight', $t$      perform tell(p_world, p_uid, 'Your arrow goes wide of the ' || lower(d.name) || '.', 'fight');$t$, $t$      perform tell(p_world, p_uid, 'Arrow missed: ' || lower(d.name) || '.', 'fight');$t$, 1);
select private.patch_text('perform_fight', $t$        perform tell(p_world, p_uid, 'Your arrow goes home'
          || case when v_crit then ', a critical hit' else '' end || '. The ' || lower(d.name)
          || ' is down to ' || greatest(0, ceil(c.health - dmg)) || ' of ' || max_health(c) || '.', 'fight');$t$, $t$        perform tell(p_world, p_uid, 'Arrow hit'
          || case when v_crit then ', critical' else '' end || ': ' || lower(d.name)
          || ' ' || greatest(0, ceil(c.health - dmg)) || '/' || max_health(c) || '.', 'fight');$t$, 1);
select private.patch_text('ride_refusal', $t$    if c.world_id is null then return 'It is gone.'; end if;$t$, $t$    if c.world_id is null then return 'Gone.'; end if;$t$, 1);
select private.patch_text('ride_refusal', $t$      return c.name || ' is in a creature crate. Let it out first.';$t$, $t$      return c.name || ' is in a creature crate: let it out first.';$t$, 1);
select private.patch_text('ride_refusal', $t$        return c.name || ' is not grown. Nothing that young takes a saddle.';$t$, $t$        return c.name || ' is not grown.';$t$, 1);
select private.patch_text('ride_refusal', $t$      if want is not null then return 'You need ' || want || '.'; end if;$t$, $t$      if want is not null then return 'Need ' || want || '.'; end if;$t$, 1);
select private.patch_text('ride_refusal', $t$      if d.mount is null then return 'Only a mount takes shoes.'; end if;$t$, $t$      if d.mount is null then return 'Mounts only.'; end if;$t$, 1);
select private.patch_text('ride_refusal', $t$        return c.name || ' is not grown. Nothing that young takes a shoe.';$t$, $t$        return c.name || ' is not grown.';$t$, 1);
select private.patch_text('ride_refusal', $t$        return 'You need four horseshoes and a mallet.';$t$, $t$        return 'Need ' || shoes_per_mount()::int || ' horseshoes and a mallet.';$t$, 1);
select private.patch_text('ride_refusal', $t$      if not c.tacked then return c.name || ' has no saddle or bridle on.'; end if;
      if not (age_row(c.born, old_of(c), age_pace(c))).works then return c.name || ' is not grown enough to carry you.'; end if;$t$, $t$      if not c.tacked then return c.name || ': no saddle and bridle.'; end if;
      if not (age_row(c.born, old_of(c), age_pace(c))).works then return c.name || ' is not grown.'; end if;$t$, 1);
select private.patch_text('ride_refusal', $t$        return 'Get down off what you are driving first.';$t$, $t$        return 'Stop driving first.';$t$, 1);
select private.patch_text('ride_refusal', $t$      if p.id is null then return 'There is no cart or wagon here with an empty yoke.'; end if;$t$, $t$      if p.id is null then return 'No cart or wagon with an empty yoke here.'; end if;$t$, 1);
select private.patch_text('ride_refusal', $t$        return c.name || ' is too far off. Call it over first.';$t$, $t$        return c.name || ' is too far.';$t$, 1);
select private.patch_text('ride_refusal', $t$        return c.name || ' is not grown. A yearling is no use in the traces.';$t$, $t$        return c.name || ' is not grown.';$t$, 1);
select private.patch_text('ride_refusal', $t$        return c.name || ' is too hungry to pull anything. Feed it first.';$t$, $t$        return c.name || ' is too hungry: feed it first.';$t$, 1);
select private.patch_text('perform_ride', $t$      perform tell(p_world, p_uid, 'You saddle ' || c.name
        || ' and slip the bit into its mouth. It stands for it.', 'event');$t$, $t$      perform tell(p_world, p_uid, 'Saddled and bridled: ' || c.name || '.', 'event');$t$, 1);
select private.patch_text('perform_ride', $t$      perform tell(p_world, p_uid, 'You nail four shoes onto ' || c.name
        || '''s hooves. They will hold a week: quicker on stone, and up what it would have baulked at.', 'event');$t$, $t$      perform tell(p_world, p_uid, 'Shod: ' || c.name || ', ' || shoe_days()::int
        || ' days. Faster on stone, climbs steeper.', 'event');$t$, 1);
select private.patch_text('perform_ride', $t$      perform tell(p_world, p_uid, 'You strip the saddle and bridle off ' || c.name || '.', 'event');$t$, $t$      perform tell(p_world, p_uid, 'Tack removed: ' || c.name || '.', 'event');$t$, 1);
select private.patch_text('perform_ride', $t$      perform tell(p_world, p_uid, 'You take a fistful of mane and swing up onto '
        || c.name || '.', 'event');$t$, $t$      perform tell(p_world, p_uid, 'Mounted: ' || c.name || '.', 'event');$t$, 1);
select private.patch_text('perform_ride', $t$      perform tell(p_world, p_uid, 'You swing down off ' || c.name || '.', 'event');$t$, $t$      perform tell(p_world, p_uid, 'Dismounted: ' || c.name || '.', 'event');$t$, 1);
select private.patch_text('perform_ride', $t$          'You could not get ' || c.name || ' into the traces.'), 'error');$t$, $t$          'Could not hitch ' || c.name || '.'), 'error');$t$, 1);
select private.patch_text('perform_ride', $t$        then ' It needs ' || (v.needs - v_n) || ' more before it will move.' else '' end;$t$, $t$        then ' Needs ' || (v.needs - v_n) || ' more to move.' else '' end;$t$, 1);
select private.patch_text('perform_ride', $t$      perform tell(p_world, p_uid, case when v_crated then c.name || ' comes out of the crate. ' else '' end
        || 'You back ' || c.name || ' into a yoke of the '
        || lower(placed_name(p)) || '. ' || v_n || ' of ' || v.yokes || ' filled.' || v_short, 'event');$t$, $t$      perform tell(p_world, p_uid, 'Hitched' || case when v_crated then ' from the crate' else '' end
        || ': ' || c.name || ' to the '
        || lower(placed_name(p)) || ', ' || v_n || '/' || v.yokes || ' yokes.' || v_short, 'event');$t$, 1);
select private.patch_text('perform_ride', $t$      perform tell(p_world, p_uid, 'You unbuckle ' || c.name || ' from the '$t$, $t$      perform tell(p_world, p_uid, 'Unhitched: ' || c.name || ' from the '$t$, 1);
select private.patch_text('drop_young', $t$      v_where := ' It follows you.';$t$, $t$      v_where := ' Follows you.';$t$, 1);
select private.patch_text('drop_young', $t$        v_where := ' It goes into the creature crate in your pack.';$t$, $t$        v_where := ' In the creature crate in your pack.';$t$, 1);
select private.patch_text('drop_young', $t$        select ' It goes into the empty creature crate at (' || pl.x || ', ' || pl.y || ') on '$t$, $t$        select ' In the empty creature crate at (' || pl.x || ', ' || pl.y || ') on '$t$, 1);
select private.patch_text('drop_young', $t$        v_where := ' Something already follows you and there is no empty creature crate in your pack or standing on your settlement, so it goes off into the wild.';$t$, $t$        v_where := ' No free companion slot or empty creature crate in your pack or on your settlement: released into the wild.';$t$, 1);
select private.patch_text('drop_young', $t$    perform tell(p_world, v_dam.keeper, v_dam.name || ' drops a young ' || lower(v_d.name)
      || ' (' || (v_coming->>'sex') || '): ' || trait_names(coalesce(v_traits, '{}'))$t$, $t$    perform tell(p_world, v_dam.keeper, 'Born to ' || v_dam.name || ': ' || (v_coming->>'sex') || ' ' || lower(v_d.name)
      || ', ' || trait_names(coalesce(v_traits, '{}'))$t$, 1);
select private.patch_text('mutation_said', $t$  select coalesce((select ' It is born with a mutation: ' || d.name || case when d.family is null then ' (' || d.tier || ')' else '' end
                          || ', which neither parent carries: '$t$, $t$  select coalesce((select ' Mutation, in neither parent: ' || d.name || case when d.family is null then ' (' || d.tier || ')' else '' end
                          || ', '$t$, 1);
select private.patch_text('worker_learn', $t$      perform tell(p_world, c.keeper, c.name || ' evolves into ' || article((select sd.stages[stage_of(c2)] from species_def sd where sd.id = c.species)) || ' '
        || (select sd.stages[stage_of(c2)] from species_def sd where sd.id = c.species) || '!', 'event');$t$, $t$      perform tell(p_world, c.keeper, c.name || ' evolved: '
        || (select sd.stages[stage_of(c2)] from species_def sd where sd.id = c.species) || '.', 'event');$t$, 1);
select private.patch_text('engage_beast', $t$    perform tell(p_world, p_uid, 'The ' || v_name || ' turns back on you.', 'fight');$t$, $t$    perform tell(p_world, p_uid, upper(left(v_name, 1)) || substr(v_name, 2) || ' attacks you again.', 'fight');$t$, 1);
select private.patch_text('hunt_settle', $t$      perform tell(p_world, p.uid, 'The ' || lower(d.name) || ' turns tail.', 'fight');$t$, $t$      perform tell(p_world, p.uid, d.name || ' fled.', 'fight');$t$, 1);
select private.patch_text('hunt_settle', $t$    perform tell(p_world, p.uid, case when m.id is not null then 'Another ' || lower(d.name) || ' comes with it.'
                                      else 'A ' || lower(d.name) || ' has your scent.' end, 'fight');$t$, $t$    perform tell(p_world, p.uid, case when m.id is not null then 'Another ' || lower(d.name) || ' joins.'
                                      else d.name || ' hunting you.' end, 'fight');$t$, 1);
select private.patch_text('hunt_settle', $t$        perform tell(p_world, p.uid, 'The ' || lower(d.name) || '''s heavy blow falls short.', 'fight');$t$, $t$        perform tell(p_world, p.uid, d.name || ' heavy blow: missed.', 'fight');$t$, 1);
select private.patch_text('hunt_settle', $t$      perform tell(p_world, p.uid, 'The ' || lower(d.name) || ' draws back for a heavy blow. Step out of its reach.', 'fight');$t$, $t$      perform tell(p_world, p.uid, d.name || ' winding up a heavy blow: step out of reach.', 'fight');$t$, 1);
select private.patch_text('brawl_settle', $t$    if q.keeper is not null then perform tell(p_world, q.keeper, 'The ' || lower(d.name) || ' turns tail.', 'fight'); end if;$t$, $t$    if q.keeper is not null then perform tell(p_world, q.keeper, d.name || ' fled.', 'fight'); end if;$t$, 1);
select private.patch_text('worker_nowhere', $t$  perform tell(p_world, c.keeper, c.name || ' is holding '
    || lower(coalesce((select coalesce(name, c.carrying->>'def') from item_def where id = c.carrying->>'def'), 'a load'))
    || ' with nowhere on the deed to put it. Empty something, or build more storage.', 'error');$t$, $t$  perform tell(p_world, c.keeper, c.name || ' holding '
    || lower(coalesce((select coalesce(name, c.carrying->>'def') from item_def where id = c.carrying->>'def'), 'a load'))
    || ': settlement storage full.', 'error');$t$, 1);
select private.patch_text('beast_threat', $t$    perform tell(p_world, b.keeper, 'The ' || lower((select name from species_def where id = c.species))
      || ' turns on ' || b.name || '.', 'fight');$t$, $t$    perform tell(p_world, b.keeper, (select name from species_def where id = c.species)
      || ' attacks ' || b.name || '.', 'fight');$t$, 1);
select private.patch_text('style_blow', $t$        perform tell(p_world, a.keeper, 'The ' || r.name || ' turns on ' || a.name || '.', 'fight');$t$, $t$        perform tell(p_world, a.keeper, upper(left(r.name, 1)) || substr(r.name, 2) || ' attacks ' || a.name || '.', 'fight');$t$, 1);
select private.patch_text('wound_beast', $t$      perform tell(p_world, p_teller, 'The ' || lower(d.name)
        || ' goes down. Butcher it before it rots: there is a great deal on it.', 'fight');
    else
      perform tell(p_world, p_teller, 'You kill the wild ' || lower(d.name)
        || '. Its corpse lies where it fell.', 'fight');$t$, $t$      perform tell(p_world, p_teller, 'Killed: ' || lower(d.name)
        || '. Butcher it before it rots.', 'fight');
    else
      perform tell(p_world, p_teller, 'Killed: wild ' || lower(d.name)
        || '.', 'fight');$t$, 1);
select private.patch_text('companion_settle', $t$      perform tell(p_world, c.keeper, c.name || ' goes for the '$t$, $t$      perform tell(p_world, c.keeper, c.name || ' attacks: '$t$, 1);
select private.patch_text('crate_open_refusal', $t$then return 'The crate is empty.'; end if;$t$, $t$then return 'Crate empty.'; end if;$t$, 2);
select private.patch_text('crate_open_refusal', $t$  if v_c.keeper is distinct from p_uid then return v_c.name || ' is not yours to let out.'; end if;$t$, $t$  if v_c.keeper is distinct from p_uid then return v_c.name || ': not yours.'; end if;$t$, 1);
select private.patch_text('crate_open_refusal', $t$    return 'That crate is offered in a deal. Take the offer back first.';$t$, $t$    return 'Crate offered in a deal: take the offer back first.';$t$, 1);
select private.patch_text('crate_open_refusal', $t$      return 'Get down off ' || v_cur.name || ' first: it goes into the crate in its place.';$t$, $t$      return 'Get down off ' || v_cur.name || ' first.';$t$, 1);
select private.patch_text('crate_open_refusal', $t$  if v_dd.world_id is null then return 'You have no settlement to set it to work on.'; end if;$t$, $t$  if v_dd.world_id is null then return 'No settlement.'; end if;$t$, 1);
select private.patch_text('crate_open_refusal', $t$  if v_d.gathers is null then return 'A ' || lower(v_d.name) || ' has no trade to be set to.'; end if;$t$, $t$  if v_d.gathers is null then return v_d.name || ': no trade.'; end if;$t$, 1);
select private.patch_text('crate_open_refusal', $t$    return 'Nobody has taught this island what '
      || (select plain from gather_def where id = v_d.gathers) || ' looks like yet.';$t$, $t$    return 'Not on islands yet: '
      || (select verb from gather_def where id = v_d.gathers) || '.';$t$, 1);
select private.patch_text('crate_open_refusal', $t$    return v_dd.name || ' has work for ' || worker_cap(p_world, p_uid) || ' wildermon at level '
      || v_dd.level || '. Upgrade the settlement to take on more.';$t$, $t$    return v_dd.name || ' full: ' || worker_cap(p_world, p_uid) || ' workers at level '
      || v_dd.level || '.';$t$, 1);
select private.patch_text('perform_crate_open', $t$      perform tell(p_world, p_uid, v_c.name || ' comes out of the crate and follows you. '
        || v_cur.name || ' goes into the crate in its place.', 'system');$t$, $t$      perform tell(p_world, p_uid, v_c.name || ' out of the crate, follows you. '
        || v_cur.name || ' into the crate in its place.', 'system');$t$, 1);
select private.patch_text('perform_crate_open', $t$      perform tell(p_world, p_uid, v_c.name || ' comes out of the crate and follows you.', 'system');$t$, $t$      perform tell(p_world, p_uid, v_c.name || ' out of the crate, follows you.', 'system');$t$, 1);
select private.patch_text('perform_crate_open', $t$    perform tell(p_world, p_uid, v_c.name || ' comes out of the crate and will ' || deed_job_line(v_c) || '.', 'system');$t$, $t$    perform tell(p_world, p_uid, v_c.name || ' out of the crate, assigned: ' || deed_job_line(v_c) || '.', 'system');$t$, 1);
select private.patch_text('team_out_refusal', $t$    return v_follows || ' already follows you. Carry an empty creature crate to take ' || v_first
      || ' out of the traces: it goes into the crate.';$t$, $t$    return v_follows || ' already follows you. Need an empty creature crate for ' || v_first || '.';$t$, 1);
select private.patch_text('team_out_refusal', $t$  return 'Only one wildermon follows you. Carry '
    || case when cardinality(o.crated) = 1 then 'an empty creature crate'
            else number_word(cardinality(o.crated)) || ' empty creature crates' end
    || ' to take this team out of the traces: ' || v_follows || ' follows you and the rest go into them.';$t$, $t$  return '1 wildermon follows you. Need ' || cardinality(o.crated)
    || case when cardinality(o.crated) = 1 then ' empty creature crate' else ' empty creature crates' end
    || ' for this team: ' || v_follows || ' follows you, the rest go in crates.';$t$, 1);
select private.patch_text('team_out_crate', $t$  return ' ' || case when cardinality(v_names) < 2 then v_names[1]
                     else array_to_string(v_names[1:cardinality(v_names) - 1], ', ') || ' and ' || v_names[cardinality(v_names)] end
    || case when cardinality(v_names) = 1 then ' goes into a creature crate' else ' go into creature crates' end
    || ' in your pack: ' || (select name from creature where world_id = p_world and id = p_follows) || ' follows you.';$t$, $t$  return ' Into creature crates in your pack: ' || case when cardinality(v_names) < 2 then v_names[1]
                     else array_to_string(v_names[1:cardinality(v_names) - 1], ', ') || ' and ' || v_names[cardinality(v_names)] end
    || '. ' || (select name from creature where world_id = p_world and id = p_follows) || ' follows you.';$t$, 1);
select private.patch_text('occupied_crate_refusal', $t$         || ' is in that crate. A crate with a wildermon in it can be carried, set down, opened or traded, and nothing else.'$t$, $t$         || ' is in that crate. An occupied crate can only be carried, set down, opened or traded.'$t$, 1);
select private.patch_text('crate_open_refusal', $t$then return 'That is not a creature crate.'; end if;$t$, $t$then return 'Not a creature crate.'; end if;$t$, 1);
select private.patch_text('perform_creature', $t$    perform tell(p_world, p_uid, case when before < 0.12 and c.care >= 0.12
        then 'You work the dust out of ' || c.name || '''s coat. It leans into the brush. ('
        else 'You brush ' || c.name || ' down. (' end || care_word(c.care) || ')', 'event');$t$, $t$    perform tell(p_world, p_uid, 'Brushed ' || c.name || ': ' || care_word(c.care) || '.', 'event');$t$, 1);
select private.patch_text('pair_refuses', $t$      return c.name || case when stage = 'young' then ' is not grown.' else ' is past it.' end;$t$, $t$      return c.name || case when stage = 'young' then ' is not grown.' else ' is too old.' end;$t$, 1);
select private.patch_text('pair_refuses', $t$    if c.hunger < 0.5 then return c.name || ' is too hungry to think about it. Feed it first.'; end if;
    if c.bred_at is not null and now() - c.bred_at < make_interval(secs => breed_rest()) then
      return c.name || ' has been put to a mate lately and wants '
        || clock_left(breed_rest() - extract(epoch from (now() - c.bred_at))) || ' to itself.';$t$, $t$    if c.hunger < 0.5 then return c.name || ' is too hungry: feed it first.'; end if;
    if c.bred_at is not null and now() - c.bred_at < make_interval(secs => breed_rest()) then
      return c.name || ' bred recently: '
        || clock_left(breed_rest() - extract(epoch from (now() - c.bred_at))) || ' left.';$t$, 1);
select private.patch_text('stud_book', $t$  return ' Put to ' || mate.name || ', it takes ' || round((breed_chance(v_skill, v_care) * 100)::numeric)::int
    || '% of the time; each of the young''s ' || trait_slots() || ' traits is drawn from their blood '
    || round((least(1, inherit_chance(v_skill, v_care) + pk(p_world, p_uid, 'breed:inherit', 0)) * 100)::numeric)::int
    || '% of the time and comes out a tier better '
    || round((least(1, upgrade_chance(v_skill, v_care) + pk(p_world, p_uid, 'breed:upgrade', 0)) * 100)::numeric)::int
    || '% of the time.';$t$, $t$  return ' Paired with ' || mate.name || ': success ' || round((breed_chance(v_skill, v_care) * 100)::numeric)::int
    || '%; each of ' || trait_slots() || ' traits inherited '
    || round((least(1, inherit_chance(v_skill, v_care) + pk(p_world, p_uid, 'breed:inherit', 0)) * 100)::numeric)::int
    || '%, tier-up '
    || round((least(1, upgrade_chance(v_skill, v_care) + pk(p_world, p_uid, 'breed:upgrade', 0)) * 100)::numeric)::int
    || '%.';$t$, 1);
select private.patch_text('blood_read', $t$    then ' She is in young, due in about '
         || clock_left(extract(epoch from (c.due - now()))) || '.' else '' end;
  return c.name || ', ' || c.sex || ' ' || lower(d.name) || ', ' || age_of(c.born, old_of(c), age_pace(c))
    || ' and ' || care_word(c.care) || '. It carries '
    || case when array_length(seen, 1) > 0 then trait_names(seen) else 'nothing you can read' end
    || case when hidden > 0 then ', and ' || case when hidden = 1 then 'one thing'
                                                  else hidden || ' things' end
                                 || ' you cannot read yet' else '' end$t$, $t$    then ' In young, due in '
         || clock_left(extract(epoch from (c.due - now()))) || '.' else '' end;
  return c.name || ', ' || c.sex || ' ' || lower(d.name) || ', ' || age_of(c.born, old_of(c), age_pace(c))
    || ', ' || care_word(c.care) || '. Traits: '
    || case when array_length(seen, 1) > 0 then trait_names(seen) else 'none readable' end
    || case when hidden > 0 then ', ' || hidden || ' unreadable' else '' end$t$, 1);
select private.patch_text('blood_read', $t$    || coalesce(' That blood comes to ' || trait_worth(seen) || '.', '') || carrying;$t$, $t$    || coalesce(' Blood: ' || trait_worth(seen) || '.', '') || carrying;$t$, 1);
select private.patch_text('last_refusal', $t$      return 'Breeding is settled work. Found a settlement first: the young one goes to the token.';$t$, $t$      return 'Need a settlement: the young go to its token.';$t$, 1);
select private.patch_text('last_refusal', $t$      return 'There is no ' || lower((select name from species_def where id = c.species))$t$, $t$      return 'No ' || lower((select name from species_def where id = c.species))$t$, 1);
select private.patch_text('perform_last', $t$      perform tell(p_world, p_uid, dam.name || ' and ' || sire.name
        || ' will have nothing to do with one another. Brush them, feed them, and try again.', 'error');$t$, $t$      perform tell(p_world, p_uid, 'Pairing failed: ' || dam.name || ' and ' || sire.name || '.', 'error');$t$, 1);
select private.patch_text('perform_last', $t$    perform tell(p_world, p_uid, sire.name || ' is put to ' || dam.name
      || '. She is in young and will drop in about ' || clock_left(gestation() * pk(p_world, p_uid, 'breed:gestation', 1))
      || '. Between them they carry '$t$, $t$    perform tell(p_world, p_uid, 'Paired: ' || sire.name || ' with ' || dam.name
      || '. Due in ' || clock_left(gestation() * pk(p_world, p_uid, 'breed:gestation', 1))
      || '. Traits between them: '$t$, 1);
select private.patch_text('trait_names', $t$  select coalesce(string_agg(d.name, ', ' order by o.ord), 'nothing in particular')$t$, $t$  select coalesce(string_agg(d.name, ', ' order by o.ord), 'none')$t$, 1);
select private.patch_text('perform_trap', $t$      then 'You sink the ' || lower(trap_name(p)) || ' and make the line fast. It will fish about '
           || round(trap_life(p.sub, p.ql) * kept_life(p) / 60) || ' minutes and holds ' || creel_hold(p) || '. Bait it.'
      else 'You set the ' || lower(trap_name(p)) || ' and cover the sign of it. It will stand about '
           || round(trap_life(p.sub, p.ql) * kept_life(p) / 60) || ' minutes and will hold anything up to taming '
           || to_char(trap_holds(p), 'FM990') || '. Bait it.' end, 'event');$t$, $t$      then 'Set: ' || lower(trap_name(p)) || ', about '
           || round(trap_life(p.sub, p.ql) * kept_life(p) / 60) || ' minutes, holds ' || creel_hold(p) || '. Needs bait.'
      else 'Set: ' || lower(trap_name(p)) || ', about '
           || round(trap_life(p.sub, p.ql) * kept_life(p) / 60) || ' minutes, holds up to taming '
           || to_char(trap_holds(p), 'FM990') || '. Needs bait.' end, 'event');$t$, 1);
select private.patch_text('perform_trap', $t$      perform tell(p_world, p_uid, 'You put the '
        || lower((select name from item_def where id = it.def))
        || ' in the creel and sink it again. '
        || coalesce((select note from bait_def where id = it.def), ''), 'event');$t$, $t$      perform tell(p_world, p_uid, 'Baited: creel, '
        || lower((select name from item_def where id = it.def))
        || '.' || coalesce(' ' || (select note from bait_def where id = it.def), ''), 'event');$t$, 1);
select private.patch_text('perform_trap', $t$      perform tell(p_world, p_uid, 'You lay the '
        || lower((select name from item_def where id = it.def)) || ' in the ' || lower(trap_name(p))
        || '. ' || case when v_comers = 0 then 'Nothing this trap will hold eats that.'
                        when v_comers = 1 then 'One sort would come to that.'
                        else v_comers || ' sorts would come to that.' end, 'event');$t$, $t$      perform tell(p_world, p_uid, 'Baited: ' || lower(trap_name(p)) || ', '
        || lower((select name from item_def where id = it.def))
        || '. ' || case when v_comers = 0 then 'No kind this trap holds eats it.'
                        else 'Kinds it draws: ' || v_comers || '.' end, 'event');$t$, 1);
select private.patch_text('perform_trap', $t$      perform tell(p_world, p_uid, 'The ' || lower(s.name)
        || ' thrashes and you cannot get a hand on it. It is still held.', 'error');$t$, $t$      perform tell(p_world, p_uid, 'Handling failed: ' || lower(s.name)
        || ' still held.', 'error');$t$, 1);
select private.patch_text('perform_trap', $t$      perform tell(p_world, p_uid, 'You get the noose off the ' || lower(s.name)
        || ' and it stays. It comes with you.', 'event');$t$, $t$      perform tell(p_world, p_uid, 'Taken: ' || lower(s.name)
        || '. Follows you.', 'event');$t$, 1);
select private.patch_text('perform_trap', $t$      perform tell(p_world, p_uid, 'You get the noose off the ' || lower(s.name)
        || ' and put it straight into the creature crate in your pack.', 'event');$t$, $t$      perform tell(p_world, p_uid, 'Taken: ' || lower(s.name)
        || ', into the creature crate in your pack.', 'event');$t$, 1);
select private.patch_text('perform_trap', $t$    perform spring_trap(p.id,
      'You lift the board and it is gone into the grass before you have straightened up.');$t$, $t$    perform spring_trap(p.id,
      coalesce((select 'Released: ' || lower(sd.name) || '.' from creature q join species_def sd on sd.id = q.species
                 where q.world_id = p_world and q.id = p.caught), 'Released.'));$t$, 1);
select private.patch_text('perform_trap', $t$    perform tell(p_world, p_uid, 'You lift the creel and tip it out: ' || v_names || '.', 'event');$t$, $t$    perform tell(p_world, p_uid, 'Creel emptied: ' || v_names || '.', 'event');$t$, 1);
select private.patch_text('perform_trap', $t$    perform tell(p_world, p_uid, 'You take the ' || lower(trap_name(p)) || ' up'
      || case when p.bait is not null then ' and pocket the bait' else '' end || '.', 'event');$t$, $t$    perform tell(p_world, p_uid, 'Taken up: ' || lower(trap_name(p))
      || case when p.bait is not null then ', bait returned' else '' end || '.', 'event');$t$, 1);
select private.patch_text('trap_refusal', $t$    if not found then return 'You have no trap to set.'; end if;$t$, $t$    if not found then return 'Need a trap.'; end if;$t$, 1);
select private.patch_text('trap_refusal', $t$  if not found then return 'It is gone.'; end if;$t$, $t$  if not found then return 'Gone.'; end if;$t$, 1);
select private.patch_text('trap_refusal', $t$    if p.caught is not null then return 'There is something in it already.'; end if;$t$, $t$    if p.caught is not null then return 'Already holds a catch.'; end if;$t$, 1);
select private.patch_text('trap_refusal', $t$        then 'You have nothing a fish would come to. Dig worms, or use corn, meat or a small fish.'
        else 'You have nothing anything would come to. Carry a berry, a vegetable, a nut, a spice.' end;$t$, $t$        then 'Need bait: worms, corn, meat or a small fish.'
        else 'Need bait: a berry, vegetable, nut or spice.' end;$t$, 1);
select private.patch_text('trap_refusal', $t$    if p.caught is null then return 'There is nothing in it.'; end if;$t$, $t$    if p.caught is null then return 'Empty.'; end if;$t$, 2);
select private.patch_text('trap_refusal', $t$    if not found then return 'Whatever was in it is gone.'; end if;$t$, $t$    if not found then return 'Catch gone.'; end if;$t$, 1);
select private.patch_text('trap_refusal', $t$      return 'A ' || lower(s.name) || ' takes taming ' || to_char((tame_needs(c)).level, 'FM990')
        || ' to handle, trapped or not. It is held; come back when you can.';$t$, $t$      return 'Need taming ' || to_char((tame_needs(c)).level, 'FM990')
        || ' to handle a ' || lower(s.name) || '. Still held.';$t$, 1);
select private.patch_text('trap_refusal', $t$    if not d.water then return 'That is not a creel.'; end if;$t$, $t$    if not d.water then return 'Not a creel.'; end if;$t$, 1);
select private.patch_text('trap_refusal', $t$      return 'There is nothing in it yet.';$t$, $t$      return 'Empty.';$t$, 1);
select private.patch_text('trap_refusal', $t$    if p.caught is not null then return 'Deal with what is in it first.'; end if;$t$, $t$    if p.caught is not null then return 'Holds a catch: take it or let it go first.'; end if;$t$, 1);
select private.patch_text('track_said', $t$    return 'You find no sign of ' || article(p_kind) || ' ' || p_kind || ' within ' || p_range || ' tiles.';$t$, $t$    return 'No ' || lower(p_kind) || ' within ' || p_range || ' tiles.';$t$, 1);
select private.patch_text('track_said', $t$    return 'Fresh tracks: ' || article(v_name) || ' ' || v_name || ', level ' || p_level || ', ' || (p_reading->>'way') || ', '
      || track_dist_says(p_reading) || ', ' || case when p_moving then 'on the move' else 'standing still' end || '.';$t$, $t$    return 'Tracks: ' || v_name || ', level ' || p_level || ', ' || (p_reading->>'way') || ', '
      || track_dist_says(p_reading) || ', ' || case when p_moving then 'moving' else 'still' end || '.';$t$, 1);
select private.patch_text('track_said', $t$    return 'You pick up the trail of ' || article(v_name) || ' ' || v_name || ': somewhere to the ' || (p_reading->>'way') || ', '
      || track_dist_says(p_reading) || '.';$t$, $t$    return 'Tracks: ' || v_name || ', ' || (p_reading->>'way') || ', '
      || track_dist_says(p_reading) || '.';$t$, 1);
select private.patch_text('track_said', $t$  return 'Tracks of ' || article(v_name) || ' ' || v_name || ' lead ' || (p_reading->>'way') || ', ' || track_dist_says(p_reading) || '.';$t$, $t$  return 'Tracks: ' || v_name || ', ' || (p_reading->>'way') || ', ' || track_dist_says(p_reading) || '.';$t$, 1);
select private.patch_text('track_refusal', $t$  if sd.id is null then return 'There is no such kind to track.'; end if;$t$, $t$  if sd.id is null then return 'No such kind.'; end if;$t$, 1);
select private.patch_text('track_refusal', $t$    return upper(left(article(sd.name), 1)) || substr(article(sd.name), 2) || ' ' || sd.name || ' is no wildermon, and leaves no trail you can read.';$t$, $t$    return sd.name || ': not a wildermon, no trail.';$t$, 1);
select private.patch_text('track_refusal', $t$    return 'You have not seen ' || article(sd.name) || ' ' || sd.name || ' yet. Only a kind marked seen in your field guide can be tracked.';$t$, $t$    return sd.name || ' not seen yet: only kinds marked seen in your field guide can be tracked.';$t$, 1);
select private.patch_text('worker_settle', $t$        c.name || ' has no settlement to work for and has gone back to its own business.', 'event');$t$, $t$        c.name || ': no settlement, returned to the wild.', 'event');$t$, 1);
select private.patch_text('worker_idle', $t$      perform tell(p_world, c.keeper, c.name || ' has nothing it can mine within '
        || p_radius || ' tiles of ' || v_where || '. The ' || lower(v_hard.what) || ' at '
        || v_hard.x || ',' || v_hard.y || ' wants mining '
        || rtrim(rtrim(to_char(v_hard.want, 'FM990.99'), '0'), '.')
        || ' and ' || c.name || ' is at ' || to_char(task_skill(c), 'FM990.0') || '. '
        || 'Mining is learned by mining, so it cannot work its way up to that one: '
        || 'give it a softer seam — copper and coal want 1 apiece — or move it to one.', 'error');$t$, $t$      perform tell(p_world, c.keeper, c.name || ' idle: nothing it can mine within '
        || p_radius || ' tiles of ' || v_where || '. ' || v_hard.what || ' at '
        || v_hard.x || ',' || v_hard.y || ' needs mining '
        || rtrim(rtrim(to_char(v_hard.want, 'FM990.99'), '0'), '.')
        || '; ' || c.name || ' has ' || to_char(task_skill(c), 'FM990.0') || ' and cannot level up on it. '
        || 'Needs a softer seam (copper and coal: 1) or a move.', 'error');$t$, 1);
select private.patch_text('worker_idle', $t$  perform tell(p_world, c.keeper, c.name || ' can find no ' || work_words(p_kind)
    || ' within ' || p_radius || ' tiles of ' || v_where || '. '
    || case when p_kind in ('mine', 'quarry')
         then 'A seam under soil or paving is not a face; the rock has to be bare. '
         else '' end
    || 'Put it on a work post nearer the work, or raise its skill to widen the search.', 'error');$t$, $t$  perform tell(p_world, c.keeper, c.name || ' idle: no ' || work_words(p_kind)
    || ' within ' || p_radius || ' tiles of ' || v_where || '. '
    || case when p_kind in ('mine', 'quarry')
         then 'Needs bare rock, not under soil or paving. '
         else '' end
    || 'Fix: a work post nearer the work, or more skill for more range.', 'error');$t$, 1);

-- Nothing reads them now: a failed taming says "Taming failed." and a release "Released: <name>.".
do $do$
begin
  alter table species_def drop column if exists tame_fail;
  alter table species_def drop column if exists leaves;
end $do$;

drop function private.patch_text(text, text, text, int);

select private.lock_doors();

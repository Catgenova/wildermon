/*
 * A settlement's notices, sent as letters to whoever has been away a while.
 *
 * Asked for: a notice should also reach a citizen's mail if they have not
 * been ashore for a while. The mail on this island is `letter`: one person
 * to another, kept, read in the Social window, which counts what is unread
 * by whoever wrote it (`rpc_social`'s `unread`, `rpc_letters`). So:
 *
 *   * A citizen -- or the founder -- whose last time ashore
 *     (`coalesce(left_at, seen_at)`, what `rpc_join` counts "while you were
 *     away" from) is more than `notice_mail_days()` days ago is sent every
 *     notice of that settlement they have not seen as a letter, from whoever
 *     posted it, reading as the log line does: "Notice at Hearth from Ivar:
 *     ..." (`settle_said('heard')`). Never to its own author.
 *   * A notice sent as a letter counts as seen (`deed_notice_seen`), which is
 *     what makes it once: the next look does not send it again, and coming
 *     ashore (`rpc_notices_ashore`) does not show it a second time. Coming
 *     ashore still marks everything seen, as it did.
 *   * It is looked at as a notice is posted (`rpc_notice_post`, for whoever is
 *     already away that long) and every hour after (`notice_mail_sweep`, a
 *     pg_cron job, `notice-mail`), for whoever has been away that long since.
 *     On a database without pg_cron -- the suite's -- there is no job, and the
 *     sweep is called by hand.
 *
 * Written straight into `letter` rather than through `rpc_letter`, which is a
 * door for the person writing: the author is not the one sending it, and is
 * not asked to be signed in, nor held to the letter allowance a minute.
 *
 * Rewritten here, from the newest migration that defines it:
 *   rpc_notice_post -- 20261013202300_notices_work_and_a_ledger.sql
 */
set local lock_timeout = '3s';

/**
 * Send a settlement's unseen notices as letters to every one of its people
 * away longer than `notice_mail_days()`, oldest first, and count them seen.
 * Returns how many letters went.
 */
create or replace function notice_mail(p_world uuid, p_founder uuid) returns int
language plpgsql as $fn$
declare r record; d deed; v int := 0;
begin
  select * into d from deed where world_id = p_world and founded_by = p_founder;
  if not found then return 0; end if;
  for r in
    select x.n, x.author, x.body, c.uid
      from deed_notice x
      cross join (select p_founder as uid
                  union select m.uid from deed_member m where m.world_id = p_world and m.founder = p_founder) c
      join player p on p.world_id = p_world and p.uid = c.uid
      left join deed_notice_seen s on s.world_id = p_world and s.founder = p_founder and s.uid = c.uid
     where x.world_id = p_world and x.founder = p_founder
       and c.uid <> x.author and x.n > coalesce(s.upto, 0)
       and coalesce(p.left_at, p.seen_at, p.joined_at) < now() - make_interval(days => notice_mail_days())
     order by c.uid, x.n
  loop
    insert into letter (world_id, sender, reader, text)
    values (p_world, r.author, r.uid,
            left(settle_line('heard', d.name, folk_name(p_world, r.author)) || ' ' || r.body, 400));
    perform settle_seen(p_world, p_founder, r.uid, r.n);
    v := v + 1;
  end loop;
  return v;
end $fn$;

/** Every settlement with notices, looked at once: the hourly job. Returns how many letters went. */
create or replace function notice_mail_sweep() returns int
language plpgsql as $fn$
declare r record; v int := 0;
begin
  for r in select distinct x.world_id, x.founder from deed_notice x loop
    v := v + notice_mail(r.world_id, r.founder);
  end loop;
  return v;
end $fn$;

/**
 * A notice posted to a settlement: by its founder, or a citizen whose rank
 * holds Post notices. The oldest past `notice_keep()` goes. Whoever of its
 * people is ashore hears it now, and has seen it; whoever has been away
 * longer than `notice_mail_days()` is sent it as a letter.
 */
create or replace function rpc_notice_post(p_world uuid, p_founder uuid, p_text text)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_why text; v_text text; v_n bigint; v_by text; u uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  -- Held, so two notices posted at once trim the board one after the other.
  select * into d from deed where world_id = p_world and founded_by = p_founder for update;
  if not found then return jsonb_build_object('why', settle_line('gone')); end if;
  v_why := rank_member_refusal(p_world, p_founder, me, 'notices');
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  v_text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
  if v_text = '' then return jsonb_build_object('why', settle_line('empty')); end if;
  if char_length(v_text) > notice_max() then return jsonb_build_object('why', settle_line('long')); end if;
  insert into deed_notice (world_id, founder, author, body) values (p_world, p_founder, me, v_text)
  returning n into v_n;
  delete from deed_notice x
   where x.world_id = p_world and x.founder = p_founder
     and x.n not in (select y.n from deed_notice y where y.world_id = p_world and y.founder = p_founder
                      order by y.n desc limit notice_keep());
  perform settle_seen(p_world, p_founder, me, v_n);
  v_by := folk_name(p_world, me);
  for u in select p_founder union select m.uid from deed_member m where m.world_id = p_world and m.founder = p_founder loop
    if u <> me and private.here(p_world, u) then
      perform tell(p_world, u, settle_line('heard', d.name, v_by) || ' ' || v_text, 'system');
      perform settle_seen(p_world, p_founder, u, v_n);
    end if;
  end loop;
  -- And to whoever has been away long enough, by letter.
  perform notice_mail(p_world, p_founder);
  return jsonb_build_object('posted', v_n);
end $fn$;

-- Every hour, for whoever has been away long enough since a notice went up.
do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  -- `cron.schedule` is an upsert on the name, so a second deploy re-times the job rather than winding another.
  perform cron.schedule('notice-mail', '23 * * * *', 'select public.notice_mail_sweep()');
end $$;

select private.lock_doors();

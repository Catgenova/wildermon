/*
 * A settlement's notices, the work it wants, and the ledger of who brought it.
 *
 * Asked for: a noticeboard for a settlement's citizens, and citizen jobs with
 * a ledger. The browser's `src/game/noticeboard.ts` says every rule and every
 * sentence; the island reads the same numbers and words from the definitions
 * (`notice_max`, `notice_keep`, `work_open_max`, `work_count_max`,
 * `work_ql_top`, `deliver_reach`, `work_done_keep`, `ledger_keep`,
 * `settle_said`; `scripts/dump-defs.ts`). Everything here is plpgsql, so it
 * goes in whether the definitions land before it or after it.
 *
 *   * Two new rank powers, at the next two bits: `notices` (Post notices) and
 *     `work` (Set work). The founder holds every power; Mayor -- every
 *     settlement's highest rank to start with -- is given both, on every
 *     settlement standing and in `deed_ranks_seed` for every new one.
 *   * **Notices** (`deed_notice`). `rpc_notice_post` and `rpc_notice_drop`,
 *     for the founder and a rank holding Post notices. A notice is trimmed and
 *     every run of spaces made one; at most `notice_max()` characters. A
 *     settlement keeps the newest `notice_keep()`. Whoever is ashore of its
 *     people hears a new one in the log at once; `deed_notice_seen` keeps how
 *     far each has seen, and `rpc_notices_ashore` -- asked once as the
 *     browser comes ashore -- hands over the rest, once.
 *   * **Work** (`deed_work`). `rpc_work_set` and `rpc_work_drop`, for the
 *     founder and a rank holding Set work: a kind of thing, how many, and a
 *     lowest quality or none, up to `work_open_max()` open at once.
 *   * **Delivering** (`rpc_work_deliver`). Any citizen within
 *     `deliver_reach()` tiles of the token. What matches in the pack -- the
 *     thing, at the quality or better, not worn or held, not kept back, not in
 *     a deal, with nothing in it -- goes into the founder's deed crate,
 *     lowest quality first, until the work has what it wants or the crate is
 *     full. The same rows, moved; part of a stack is split off into a row of
 *     its own. The work, the crate and every row taken are locked first, in
 *     that order, so two deliveries cannot both fill the last of a work or
 *     the last of a crate, and a thing eaten or dropped at the same moment is
 *     not also delivered.
 *   * **The ledger** (`deed_ledger`): a line for every work set, every
 *     delivery (who, how many, of what, at what quality, toward which work),
 *     every work done and every one taken down. A work done is closed and
 *     its line written in the same statement as the delivery that finished
 *     it. It keeps the newest `ledger_keep()`; a settlement keeps its newest
 *     `work_done_keep()` closed works listed.
 *   * **Reading** (`rpc_settlement`): a settlement's notices, work and
 *     ledger, for its founder and its citizens. Anybody else is told they
 *     are not a citizen of it, and is told nothing else.
 *
 * Every table is shut to browsers; the doors are `security definer`, and
 * `lock_doors` grants them.
 *
 * Rewritten here, each from the newest migration that defines it:
 *   power_bit, deed_ranks_seed -- 20261013003000_ranks_of_your_own.sql
 */
set local lock_timeout = '3s';

-- ---------------------------------------------------------------- the powers

insert into rank_power (id, bit, may, may_not) values
  ('notices', 12, 'post and take down its notices', 'post or take down its notices'),
  ('work', 13, 'set and take down the work it wants', 'set or take down the work it wants')
on conflict (id) do update set bit = excluded.bit, may = excluded.may, may_not = excluded.may_not;

/** A power's bit, written out so a check on every dig is a constant: `rank_power.bit`, and the browser's `powerBit`. */
create or replace function power_bit(p_id text) returns int language sql immutable as $fn$
  select case p_id
    when 'shape' then 1 when 'stores' then 2 when 'locks' then 4 when 'gate' then 8
    when 'served' then 16 when 'set_bauble' then 32 when 'replace_bauble' then 64
    when 'invite' then 128 when 'send_away' then 256 when 'set_ranks' then 512
    when 'upgrade' then 1024 when 'rename' then 2048 when 'notices' then 4096 when 'work' then 8192
    else 0 end
$fn$;

/**
 * What every settlement starts with, highest first: Mayor, Builder and Guest,
 * and Builder for newcomers. The browser's `DEFAULT_RANKS` and
 * `NEWCOMER_RANK`. Mayor posts notices and sets work besides. Nothing, for a
 * settlement that has ranks already.
 */
create or replace function deed_ranks_seed(p_world uuid, p_founder uuid) returns void
  language sql as $fn$
  insert into deed_rank_def (world_id, founder, name, ord, perms, newcomer)
  select p_world, p_founder, r.name, r.ord, r.perms, r.newcomer
    from (values
      ('Mayor', 1, power_bits(array['shape', 'stores', 'gate', 'served', 'set_bauble', 'replace_bauble',
                                    'invite', 'send_away', 'set_ranks', 'notices', 'work']), false),
      ('Builder', 2, power_bits(array['shape', 'stores', 'gate', 'served', 'set_bauble']), true),
      ('Guest', 3, power_bits(array['stores']), false)) r(name, ord, perms, newcomer)
   where not exists (select 1 from deed_rank_def x where x.world_id = p_world and x.founder = p_founder)
$fn$;

-- Every settlement's mayors, standing now.
update deed_rank_def set perms = perms | power_bits(array['notices', 'work']) where lower(name) = 'mayor';

-- ---------------------------------------------------------------- the tables

create table if not exists deed_notice (
  world_id uuid not null,
  founder uuid not null,
  n bigint generated always as identity,
  author uuid not null,
  -- The limit is `notice_max()`, asked by the door; this only keeps a row sane.
  body text not null check (length(body) between 1 and 2000),
  made_at timestamptz not null default now(),
  primary key (world_id, n),
  foreign key (world_id, founder) references deed (world_id, founded_by) on delete cascade
);
create index if not exists deed_notice_board on deed_notice (world_id, founder, n);

-- How far each of a settlement's people has seen its notices: the newest `n` shown to them.
create table if not exists deed_notice_seen (
  world_id uuid not null,
  founder uuid not null,
  uid uuid not null,
  upto bigint not null default 0,
  primary key (world_id, founder, uid),
  foreign key (world_id, founder) references deed (world_id, founded_by) on delete cascade
);

create table if not exists deed_work (
  world_id uuid not null,
  founder uuid not null,
  id bigint generated always as identity,
  def text not null,
  want int not null check (want > 0),
  -- The lowest quality it takes, a whole number; null takes any.
  min_ql int check (min_ql is null or min_ql between 1 and 100),
  got int not null default 0 check (got >= 0),
  set_by uuid not null,
  made_at timestamptz not null default now(),
  closed_at timestamptz,
  -- done: it had all it wanted; dropped: taken down.
  how text check (how in ('done', 'dropped')),
  primary key (world_id, id),
  foreign key (world_id, founder) references deed (world_id, founded_by) on delete cascade,
  constraint deed_work_closed check ((closed_at is null) = (how is null))
);
create index if not exists deed_work_board on deed_work (world_id, founder) where closed_at is null;

/*
 * The ledger. `work` names the work by its id and is no foreign key: a
 * finished work trimmed off the list still has its lines. `def` and `count`
 * are kept on every line for the same reason.
 */
create table if not exists deed_ledger (
  world_id uuid not null,
  founder uuid not null,
  n bigint generated always as identity,
  work bigint not null,
  what text not null check (what in ('set', 'delivered', 'done', 'dropped')),
  uid uuid not null,
  def text not null,
  count int not null check (count >= 0),
  ql real,
  at timestamptz not null default now(),
  primary key (world_id, n),
  foreign key (world_id, founder) references deed (world_id, founded_by) on delete cascade
);
create index if not exists deed_ledger_board on deed_ledger (world_id, founder, n);

-- Nobody reads or writes any of them but the doors below.
alter table deed_notice enable row level security;
alter table deed_notice_seen enable row level security;
alter table deed_work enable row level security;
alter table deed_ledger enable row level security;
revoke all on deed_notice from anon, authenticated;
revoke all on deed_notice_seen from anon, authenticated;
revoke all on deed_work from anon, authenticated;
revoke all on deed_ledger from anon, authenticated;

-- ---------------------------------------------------------------- the words and the questions

/** One of the browser's sentences (`settleLine`), filled in. */
create or replace function settle_line(p_key text, p_deed text default null, p_who text default null,
                                       p_what text default null, p_n bigint default null)
returns text language plpgsql stable as $fn$
begin
  return replace(replace(replace(replace(settle_said(p_key), '{deed}', coalesce(p_deed, '')),
    '{who}', coalesce(p_who, '')), '{what}', coalesce(p_what, '')), '{n}', coalesce(p_n, 0)::text);
end $fn$;

/** Whether somebody is one of a settlement's people: its founder, or on its roll. */
create or replace function settle_citizen(p_world uuid, p_founder uuid, p_uid uuid) returns boolean
language plpgsql stable as $fn$
begin
  return p_uid = p_founder
      or exists (select 1 from deed_member m where m.world_id = p_world and m.founder = p_founder and m.uid = p_uid);
end $fn$;

/**
 * Why somebody may not use a settlement's board: gone, or not one of its
 * people. Nothing for its founder and its citizens.
 */
create or replace function settle_refusal(p_world uuid, p_founder uuid, p_uid uuid) returns text
language plpgsql stable as $fn$
declare d deed;
begin
  select * into d from deed where world_id = p_world and founded_by = p_founder;
  if not found then return settle_line('gone'); end if;
  if not settle_citizen(p_world, p_founder, p_uid) then return settle_line('stranger', d.name); end if;
  return null;
end $fn$;

/** A thing's name as the item list has it, or its id when the list has none. */
create or replace function settle_thing(p_def text) returns text language plpgsql stable as $fn$
begin
  return coalesce((select name from item_def where id = p_def), p_def);
end $fn$;

/** Mark a settlement's notices as seen by somebody, up to this one. */
create or replace function settle_seen(p_world uuid, p_founder uuid, p_uid uuid, p_upto bigint) returns void
language plpgsql as $fn$
begin
  if p_upto is null then return; end if;
  insert into deed_notice_seen (world_id, founder, uid, upto) values (p_world, p_founder, p_uid, p_upto)
  on conflict (world_id, founder, uid) do update set upto = greatest(deed_notice_seen.upto, excluded.upto);
end $fn$;

/** Keep a settlement's ledger to its newest `ledger_keep()` lines. */
create or replace function settle_ledger_trim(p_world uuid, p_founder uuid) returns void
language plpgsql as $fn$
begin
  delete from deed_ledger l
   where l.world_id = p_world and l.founder = p_founder
     and l.n < coalesce((select x.n from deed_ledger x where x.world_id = p_world and x.founder = p_founder
                          order by x.n desc offset ledger_keep() - 1 limit 1), 0);
end $fn$;

/** Keep a settlement's closed works to its newest `work_done_keep()`. */
create or replace function settle_work_trim(p_world uuid, p_founder uuid) returns void
language plpgsql as $fn$
begin
  delete from deed_work w
   where w.world_id = p_world and w.founder = p_founder and w.closed_at is not null
     and w.id not in (select x.id from deed_work x where x.world_id = p_world and x.founder = p_founder
                        and x.closed_at is not null order by x.closed_at desc, x.id desc limit work_done_keep());
end $fn$;

/** A settlement's board as one of its people sees it: the browser's `SettleBoard`. */
create or replace function settle_board(d deed, p_me uuid) returns jsonb
language plpgsql stable as $fn$
declare cr crate;
begin
  cr := deed_crate(d.world_id, d.founded_by);
  return jsonb_build_object(
    'deed', d.name, 'founder', d.founded_by, 'x', d.x, 'y', d.y,
    'post', deed_may(d.world_id, d.founded_by, p_me, power_bit('notices')),
    'set', deed_may(d.world_id, d.founded_by, p_me, power_bit('work')),
    'room', case when cr.id is not null then crate_spare(d.world_id, cr) end,
    'notices', coalesce((select jsonb_agg(jsonb_build_object(
        'n', x.n, 'uid', x.author, 'by', folk_name(d.world_id, x.author), 'text', x.body,
        'at', extract(epoch from x.made_at)) order by x.n desc)
      from deed_notice x where x.world_id = d.world_id and x.founder = d.founded_by), '[]'::jsonb),
    'work', coalesce((select jsonb_agg(jsonb_build_object(
        'id', w.id, 'def', w.def, 'want', w.want, 'got', w.got, 'minQl', w.min_ql,
        'by', folk_name(d.world_id, w.set_by), 'at', extract(epoch from w.made_at),
        'closed', extract(epoch from w.closed_at), 'how', w.how)
        order by (w.closed_at is null) desc, case when w.closed_at is null then w.id end, w.closed_at desc, w.id desc)
      from deed_work w where w.world_id = d.world_id and w.founder = d.founded_by), '[]'::jsonb),
    'ledger', coalesce((select jsonb_agg(jsonb_build_object(
        'n', l.n, 'work', l.work, 'what', l.what, 'uid', l.uid, 'by', folk_name(d.world_id, l.uid),
        'def', l.def, 'count', l.count, 'ql', l.ql, 'at', extract(epoch from l.at)) order by l.n desc)
      from deed_ledger l where l.world_id = d.world_id and l.founder = d.founded_by), '[]'::jsonb));
end $fn$;

-- ---------------------------------------------------------------- reading

/**
 * A settlement's notices, work and ledger, for its founder and its citizens.
 * `p_seen` says the Notices tab is showing them, which marks them seen.
 */
create or replace function rpc_settlement(p_world uuid, p_founder uuid, p_seen boolean default false)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_why text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  v_why := settle_refusal(p_world, p_founder, me);
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  select * into d from deed where world_id = p_world and founded_by = p_founder;
  if coalesce(p_seen, false) then
    perform settle_seen(p_world, p_founder, me,
      (select max(x.n) from deed_notice x where x.world_id = p_world and x.founder = p_founder));
  end if;
  return settle_board(d, me);
end $fn$;

/**
 * Coming ashore: every notice of every settlement of yours that you have not
 * been shown and did not write, oldest first, each settlement's together --
 * and from now on, seen.
 */
create or replace function rpc_notices_ashore(p_world uuid)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); v jsonb;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'deed', d.name, 'founder', d.founded_by, 'n', x.n, 'uid', x.author, 'by', folk_name(p_world, x.author),
      'text', x.body, 'at', extract(epoch from x.made_at)) order by d.founded_at, x.n), '[]'::jsonb)
    into v
    from deeds_of(p_world, me) d
    join deed_notice x on x.world_id = p_world and x.founder = d.founded_by
    left join deed_notice_seen s on s.world_id = p_world and s.founder = d.founded_by and s.uid = me
   where x.n > coalesce(s.upto, 0) and x.author <> me;
  perform settle_seen(p_world, d.founded_by, me,
      (select max(x.n) from deed_notice x where x.world_id = p_world and x.founder = d.founded_by))
    from deeds_of(p_world, me) d;
  return jsonb_build_object('notices', v);
end $fn$;

-- ---------------------------------------------------------------- notices

/**
 * A notice posted to a settlement: by its founder, or a citizen whose rank
 * holds Post notices. The oldest past `notice_keep()` goes. Whoever of its
 * people is ashore hears it now, and has seen it.
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
  return jsonb_build_object('posted', v_n);
end $fn$;

/** A notice taken down: by its founder, or a citizen whose rank holds Post notices. */
create or replace function rpc_notice_drop(p_world uuid, p_founder uuid, p_n bigint)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); v_why text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from deed where world_id = p_world and founded_by = p_founder) then
    return jsonb_build_object('why', settle_line('gone'));
  end if;
  v_why := rank_member_refusal(p_world, p_founder, me, 'notices');
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  delete from deed_notice where world_id = p_world and founder = p_founder and n = p_n;
  if not found then return jsonb_build_object('why', settle_line('noNotice')); end if;
  return jsonb_build_object('dropped', p_n);
end $fn$;

-- ---------------------------------------------------------------- work

/**
 * Work a settlement wants: by its founder, or a citizen whose rank holds Set
 * work. A thing the item list has, that a deed crate takes; at least one and
 * at most `work_count_max()`; a lowest quality, a whole number up to
 * `work_ql_top()`, or none (null or nought); up to `work_open_max()` open.
 */
create or replace function rpc_work_set(p_world uuid, p_founder uuid, p_def text, p_count int, p_min_ql int default null)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_why text; v_ql int := nullif(greatest(coalesce(p_min_ql, 0), 0), 0); v_id bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  -- Held, so two works set at once cannot both be the last one there is room for.
  select * into d from deed where world_id = p_world and founded_by = p_founder for update;
  if not found then return jsonb_build_object('why', settle_line('gone')); end if;
  v_why := rank_member_refusal(p_world, p_founder, me, 'work');
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  if p_def is null or not exists (select 1 from item_def where id = p_def) then
    return jsonb_build_object('why', settle_line('what'));
  end if;
  if p_def = 'coin' or crate_kind_of_item(p_def) is not null then
    return jsonb_build_object('why', settle_line('unstored', null, null, settle_thing(p_def)));
  end if;
  if p_count is null or p_count < 1 or p_count > work_count_max() then
    return jsonb_build_object('why', settle_line('count'));
  end if;
  if v_ql > work_ql_top() then return jsonb_build_object('why', settle_line('ql')); end if;
  if (select count(*) from deed_work w where w.world_id = p_world and w.founder = p_founder and w.closed_at is null)
     >= work_open_max() then
    return jsonb_build_object('why', settle_line('full', d.name));
  end if;
  insert into deed_work (world_id, founder, def, want, min_ql, set_by)
  values (p_world, p_founder, p_def, p_count, v_ql, me) returning id into v_id;
  insert into deed_ledger (world_id, founder, work, what, uid, def, count)
  values (p_world, p_founder, v_id, 'set', me, p_def, p_count);
  perform settle_ledger_trim(p_world, p_founder);
  return jsonb_build_object('set', v_id);
end $fn$;

/** Work taken down: by its founder, or a citizen whose rank holds Set work. What was delivered stays delivered. */
create or replace function rpc_work_drop(p_world uuid, p_founder uuid, p_id bigint)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); v_why text; w deed_work;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from deed where world_id = p_world and founded_by = p_founder) then
    return jsonb_build_object('why', settle_line('gone'));
  end if;
  v_why := rank_member_refusal(p_world, p_founder, me, 'work');
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  select * into w from deed_work x
   where x.world_id = p_world and x.founder = p_founder and x.id = p_id and x.closed_at is null for update;
  if not found then return jsonb_build_object('why', settle_line('noWork')); end if;
  update deed_work set closed_at = now(), how = 'dropped' where world_id = p_world and id = p_id;
  insert into deed_ledger (world_id, founder, work, what, uid, def, count)
  values (p_world, p_founder, p_id, 'dropped', me, w.def, w.got);
  perform settle_ledger_trim(p_world, p_founder);
  perform settle_work_trim(p_world, p_founder);
  return jsonb_build_object('dropped', p_id);
end $fn$;

/**
 * Deliver toward a work: any of a settlement's people, standing within
 * `deliver_reach()` tiles of its token. What matches goes from the pack into
 * the founder's deed crate, lowest quality first, until the work has what it
 * wants or the crate is full -- the rows themselves, moved, and part of a
 * stack split off into a row of its own in the crate. The refusals are the
 * browser's `deliverRefusal`, in its order.
 */
create or replace function rpc_work_deliver(p_world uuid, p_founder uuid, p_id bigint)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_why text; w deed_work; p player; cr crate; it item;
        v_need int; v_room int; v_take int; v_moved int := 0; v_qls double precision := 0;
        v_what text; v_cols text; v_by text; v_done boolean := false;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  v_why := settle_refusal(p_world, p_founder, me);
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  select * into d from deed where world_id = p_world and founded_by = p_founder;
  -- The work first: two deliveries toward it go one after the other.
  select * into w from deed_work x
   where x.world_id = p_world and x.founder = p_founder and x.id = p_id and x.closed_at is null for update;
  if not found then return jsonb_build_object('why', settle_line('noWork')); end if;
  v_what := lower(settle_thing(w.def));
  select * into p from player where world_id = p_world and uid = me;
  if not found or greatest(abs(p.x - (d.x + 0.5)), abs(p.y - (d.y + 0.5))) > deliver_reach() then
    return jsonb_build_object('why', settle_line('far', d.name));
  end if;
  -- Then the crate: two deliveries into it count its room one after the other.
  cr := deed_crate(p_world, p_founder);
  if cr.id is not null then select * into cr from crate where world_id = p_world and id = cr.id for update; end if;
  if cr.id is null then return jsonb_build_object('why', settle_line('noCrate', d.name)); end if;
  v_need := w.want - w.got;
  v_room := crate_spare(p_world, cr);
  /*
   * Then every row that could go, held: a thing eaten, dropped, traded or put
   * on in the same moment is either delivered or that, never both. In the
   * pack itself, not in a bag in it; not worn or held, kept back, in a deal or
   * a creature crate; with nothing in it; at the work's quality or better.
   */
  for it in
    select i.* from item i
     where i.world_id = p_world and i.holder = 'player' and i.holder_uid = me and i.def = w.def
       and i.inside is null and i.deal is null and not i.locked and i.creature is null
       and i.ql >= coalesce(w.min_ql, 0)
       and not exists (select 1 from item c where c.inside = i.id)
       and not exists (select 1 from jsonb_each_text(p.equipped) e where e.value = i.id::text)
     order by i.ql, i.id
     for update of i
  loop
    if v_room <= 0 then
      -- One to deliver, and no room for it: said only when nothing at all went in.
      if v_moved = 0 then return jsonb_build_object('why', settle_line('crateFull', d.name)); end if;
      exit;
    end if;
    exit when v_moved >= v_need;
    v_take := least(it.count, v_need - v_moved, v_room);
    if v_take = it.count then
      update item set holder = 'crate', holder_uid = null, crate = cr.id, gx = cr.x, gy = cr.y,
                      inside = null, placed = null, price = null, locked = false
       where id = it.id;
    else
      -- Part of the stack: a row of its own in the crate, everything about it copied but how many and where.
      select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
        from pg_attribute a
       where a.attrelid = 'public.item'::regclass and a.attnum > 0 and not a.attisdropped
         and a.attidentity = '' and a.attgenerated = ''
         and a.attname not in ('id', 'count', 'holder', 'holder_uid', 'crate', 'gx', 'gy', 'inside', 'placed',
                               'price', 'locked', 'deal');
      execute format('insert into item (holder, crate, gx, gy, count, %s) select ''crate'', $1, $2, $3, $4, %s from item where id = $5',
                     v_cols, v_cols)
        using cr.id, cr.x, cr.y, v_take, it.id;
      update item set count = count - v_take where id = it.id;
    end if;
    v_moved := v_moved + v_take;
    v_room := v_room - v_take;
    v_qls := v_qls + it.ql * v_take;
  end loop;
  if v_moved = 0 then
    return jsonb_build_object('why', case when w.min_ql is null then settle_line('none', null, null, v_what)
                                          else settle_line('poor', null, null, v_what, w.min_ql) end);
  end if;
  update deed_work set got = got + v_moved where world_id = p_world and id = p_id returning * into w;
  insert into deed_ledger (world_id, founder, work, what, uid, def, count, ql)
  values (p_world, p_founder, p_id, 'delivered', me, w.def, v_moved, round((v_qls / v_moved)::numeric, 2));
  perform tell(p_world, me, settle_line('delivered', d.name, null, v_what, v_moved), 'event');
  v_by := folk_name(p_world, me);
  if me <> p_founder then
    perform tell(p_world, p_founder, settle_line('deliveredBy', d.name, v_by, v_what, v_moved), 'event');
  end if;
  if w.got >= w.want then
    v_done := true;
    update deed_work set closed_at = now(), how = 'done' where world_id = p_world and id = p_id;
    insert into deed_ledger (world_id, founder, work, what, uid, def, count)
    values (p_world, p_founder, p_id, 'done', me, w.def, w.want);
    perform tell(p_world, u, settle_line('finished', d.name, null, v_what, w.want), 'system')
      from (select distinct x as u from unnest(array[me, p_founder, w.set_by]) x) q;
    perform settle_work_trim(p_world, p_founder);
  end if;
  perform settle_ledger_trim(p_world, p_founder);
  return jsonb_build_object('delivered', v_moved, 'got', w.got, 'want', w.want, 'done', v_done);
end $fn$;

select private.lock_doors();

/*
 * Four traits on four new channels (`traits.ts`, part C):
 *
 *   night-eyed      `night` ×0: what the dark takes of its sight for you. Sight for you is the browser's (`keptSight`,
 *                   off the island's creatures); the island keeps the trait, its figure and its card.
 *   deep-pocketed   `loads` +1: a channel that counts (`channel_def.adds`), added up by `trait_add`, on the loads a
 *                   trip and things a go of `stage_loads`.
 *   lucky finder    `find` ×1.5: the chance a seek go turns up a relic fragment (`worker_do`), by `beast_mul`.
 *   settler         `idle` ×0.8, communal: a worker's wait before it looks for work again (`worker_rest` in
 *                   `worker_settle`), by `beast_mul`, its herd's with its own.
 *
 * And a figure of nought: `trait_mul` and `trait_worth` multiplied by `exp(sum(ln(mul)))`, which a nought throws on.
 *
 * And a channel out of the blood (`channel_def.blood`, the browser's `ChannelDef.blood`): every channel new with these
 * traits, here and in the parts before and after, is moved by a trait's own figure alone; neither a rarity
 * (`rarity_blood`) nor a line (`bred_line`, `line_mul`) moves it.
 */
set local lock_timeout = '3s';

alter table channel_def add column if not exists adds boolean not null default false;
alter table channel_def add column if not exists blood boolean not null default true;

-- What a rarity makes of a channel; one on a channel out of the blood. The browser's `rarityMul`.
create or replace function rarity_blood(p_rare text, p_channel text) returns double precision
  language sql stable as $fn$
  select coalesce((select case when ch.blood is false then 1
                               when coalesce(ch.up, true) then r.blood else 1 / r.blood end
    from rarity_def r left join channel_def ch on ch.id = p_channel
    where r.id = p_rare), 1)
$fn$;

-- What its line is worth on a channel; one where nothing past one is written, or on a channel out of the blood (`lineMul`).
create or replace function line_mul(p_traits text[], p_line jsonb, p_channel text)
returns double precision language sql stable as $fn$
  select case when coalesce((p_line->>p_channel)::int, 1) <= 1 then 1::double precision
              when (select ch.blood is false from channel_def ch where ch.id = p_channel) then 1::double precision
              else depth_mul(line_depth(p_traits, p_line, p_channel), p_channel) end
$fn$;

-- One creature's own traits on a channel, multiplied; nought where any of them is nought. The browser's `traitMul`.
create or replace function trait_mul(p_traits text[], p_channel text) returns double precision
language sql stable as $fn$
  select case when bool_or(e.mul = 0) then 0 else coalesce(exp(sum(ln(nullif(e.mul, 0)))), 1) end
  from trait_effect e
  where e.channel = p_channel and e.trait = any(coalesce(p_traits, '{}'))
$fn$;

-- One creature's own traits on a channel that counts, added up. The browser's `traitAdd`.
create or replace function trait_add(p_traits text[], p_channel text) returns double precision
language sql stable as $fn$
  select coalesce(sum(e.mul), 0)::double precision
  from trait_effect e
  where e.channel = p_channel and e.trait = any(coalesce(p_traits, '{}'))
$fn$;

-- A trait's figure on a channel as a card prints it: `trait_pct`, or on a channel that counts the count, "+1". The
-- browser's `figSays`.
create or replace function trait_fig(p_mul real, p_adds boolean) returns text language sql immutable as $fn$
  select case when not coalesce(p_adds, false) then trait_pct(p_mul)
              else case when round(p_mul) < 0 then '−' else '+' end || abs(round(p_mul))::int end
$fn$;

-- What one trait does, as a card says it. The browser's `traitSays`.
create or replace function trait_says(p_id text) returns text language sql stable as $fn$
  select string_agg(trait_fig(e.mul, ch.adds) || ' ' || ch.label, ', ' order by ch.ord)
  from trait_effect e join channel_def ch on ch.id = e.channel
  where e.trait = p_id
$fn$;

-- What a set of traits comes to, channel by channel: multiplied, nought where any is nought, or added up on a count.
create or replace function trait_worth(p_traits text[]) returns text
language sql stable as $fn$
  select string_agg(s.say, ', ' order by s.ord)
  from (
    select cd.ord, case when cd.adds then trait_fig(x.n::real, true) else pct_say(x.m) end || ' ' || cd.label as say,
           cd.adds, x.n, x.m
    from (
      select e.channel, sum(e.mul) as n,
             case when bool_or(e.mul = 0) then 0 else exp(sum(ln(nullif(e.mul, 0)))) end as m
      from unnest(coalesce(p_traits, '{}')) u(id)
      join trait_effect e on e.trait = u.id
      group by e.channel
    ) x
    join channel_def cd on cd.id = x.channel
  ) s
  where case when s.adds then s.n <> 0 else abs(s.m - 1) >= 0.005 end
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Its blood's loads a trip (`deep-pocketed`).
    ('stage_loads', $a$       + case when c.gear is null then 0 else pack_loads_of(c) end;$a$,
                    $b$       + case when c.gear is null then 0 else pack_loads_of(c) end
       -- And its blood's loads a trip (`trait_add`, `deep-pocketed`).
       + trait_add(c.traits, 'loads')::int;$b$, 1),
    -- A line runs on a channel in the blood alone (`bredLine`, `BLOOD_CHANNELS`).
    ('bred_line', $a$   where carries_on(p_young, ch.id) and d.depth > 1$a$,
                  $b$   where ch.blood and carries_on(p_young, ch.id) and d.depth > 1$b$, 1),
    -- Its blood and its herd's on a seek go's find (`lucky finder`).
    ('worker_do', $a$if random() > find_chance(skill, 30) then return null; end if;$a$,
                  $b$if random() > find_chance(skill, 30) * beast_mul(c, 'find') then return null; end if;$b$, 1),
    -- Its blood and its herd's on a worker's wait before it looks again (`settler`): all four places it waits.
    ('worker_settle', $a$worker_rest(c.idle_since)$a$, $b$worker_rest(c.idle_since) * beast_mul(c, 'idle')$b$, 4)
  ) as t(fn, anchor, repl, times) loop
    v_def := pg_get_functiondef(r.fn::regproc);
    v_n := (length(v_def) - length(replace(v_def, r.anchor, ''))) / length(r.anchor);
    if v_n <> r.times then raise exception '% has % of its anchor, not %: %', r.fn, v_n, r.times, r.anchor; end if;
    execute replace(v_def, r.anchor, r.repl);
  end loop;
end $do$;

select private.lock_doors();

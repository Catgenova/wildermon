-- Three restored relics can be used on a wildermon of yours, and its base stats are said on its card.
--
-- Asked for: "Time to make another use for Archaeology: restored artifacts can be used on Wildermon. Bone comb reduces
-- the age of a wildermon by 1 stage. Old file has a 1/20 chance of increasing the wildermon rarity by one step. Old pot
-- increases one base stat randomly by 1 (max 10 per stat per wildermon). Make stats visible in Wildermon UI".
--
-- An old pot, a bone comb and an old file restore into an ancient pot, an ancient comb and an ancient file
-- (`relic_def.result`, which the snapshot after this one gives the rulebook, with the three items). The pot and the
-- file used to come back an ordinary clay pot and file, the same as one made at a bench, and nothing marked them; any
-- restored before this stay what they are. The comb was `bone_comb` and is `ancient_comb` now, so every comb already
-- held, kept, ordered or counted is carried across here, as the soul was (20261019125000).
--
-- Used from a wildermon's menu, on one of yours that is out of its crate and beside you (`artifact_refusal`), each is
-- used up whatever comes of it, and one that would do nothing is refused and kept (`perform_artifact`):
--
--   * an ancient comb takes one stage off its age: its birth is moved on to `comb_into` seconds into the stage below,
--     as its keeper's Kin and Long-lived age it (`age_pace`), so an old one is as old as one only just grown and a
--     grown one as one only just born. A young one is refused;
--   * an ancient file makes it one step rarer one time in `file_rarity_odds`, never past the rarest (`rarity_next`);
--   * an ancient pot puts a point into one of its four base stats, chosen at random among those not yet at
--     `pot_most`, in the new `boosts` column: health (`hardy`), attack (`tough`), speed (`speed`) and work (`work`).
--     Each point is `pot_step` more of that stat than its kind and its blood give it, through `beast_mul`, which is
--     what every rule of fighting, travelling and working reads them by (`pot_mul`).
--
-- And `rpc_creatures` sends your own wildermon's `boosts`, which its card says beside each stat.
--
-- The four numbers are the browser's (`COMB_INTO`, `FILE_RARITY_ODDS`, `POT_STEP`, `POT_MOST`); they are made here as
-- well as in the snapshot after this, so that `beast_mul`, which is plain SQL and checked as it is made, can name them,
-- and so that they are shut to players with everything else below.

set local lock_timeout = '3s';

alter table creature add column if not exists boosts jsonb;

create or replace function comb_into() returns double precision language sql immutable as $fn$ select 1::double precision $fn$;
create or replace function file_rarity_odds() returns double precision language sql immutable as $fn$ select 20::double precision $fn$;
create or replace function pot_step() returns double precision language sql immutable as $fn$ select 0.03::double precision $fn$;
create or replace function pot_most() returns double precision language sql immutable as $fn$ select 10::double precision $fn$;

-- The four base stats, in the order the card says them, and what each is: the browser's `BASE_STATS`.
create or replace function base_stats() returns text[] language sql immutable as $fn$
  select array['hardy', 'tough', 'speed', 'work']
$fn$;
create or replace function base_stat_name(p_stat text) returns text language sql immutable as $fn$
  select case p_stat when 'hardy' then 'Health' when 'tough' then 'Attack' when 'speed' then 'Speed' when 'work' then 'Work' end
$fn$;
create or replace function base_stat_says(p_stat text) returns text language sql immutable as $fn$
  select case p_stat
    when 'hardy' then 'the health it can carry'
    when 'tough' then 'what each of its blows lands for'
    when 'speed' then 'its pace on its feet, under a rider and in the traces'
    when 'work' then 'the pace it gets each go of its task done at' end
$fn$;

-- The points ancient pots have put into one of its stats, as many as there may be: the browser's `potPoints`.
create or replace function pot_points(c creature, p_stat text) returns int language sql stable as $fn$
  select greatest(0, least(pot_most(), floor(coalesce((c.boosts->>p_stat)::double precision, 0))))::int
$fn$;
-- What they make of one channel: `pot_step` more for each point, on the four base stats and nothing else (`potMul`).
create or replace function pot_mul(c creature, p_channel text) returns double precision language sql stable as $fn$
  select case when p_channel = any(base_stats()) then 1 + pot_step() * pot_points(c, p_channel) else 1 end
$fn$;

-- And what they make of one, wherever its blood is read.
do $do$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef('beast_mul(creature, text)'::regprocedure) into v_def;
  v_old := $$       * case when c.rare is null then 1 else rarity_blood(c.rare, p_channel) end
$$;
  v_new := v_old || $$       -- And what ancient pots have put into its base stats (`pot_mul`); none at all on nearly everything.
       * case when c.boosts is null then 1 else pot_mul(c, p_channel) end
$$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'beast_mul does not read its rarity where it did';
  end if;
  execute replace(v_def, v_old, v_new);
end $do$;

-- Which actions are an artifact used on a wildermon, and the item each uses: the browser's `ARTIFACT_FOR`.
create or replace function artifact_item(p_action text) returns text language sql immutable as $fn$
  select case p_action when 'use_ancient_comb' then 'ancient_comb' when 'use_ancient_file' then 'ancient_file'
                       when 'use_ancient_pot' then 'ancient_pot' end
$fn$;
create or replace function artifact_action(p_action text) returns boolean language sql immutable as $fn$
  select artifact_item(p_action) is not null
$fn$;

-- What the points from ancient pots in one stat come to: "3 of 10: the health it can carry is 9% more than ...". `potSays`.
create or replace function pot_says(p_stat text, p_points int) returns text language sql immutable as $fn$
  select p_points || ' of ' || pot_most()::int || ': ' || base_stat_says(p_stat) || ' is '
      || whole_pct(pot_step() * p_points) || ' more than its kind and blood give it'
$fn$;

/*
 * Why an artifact would do nothing for this one, or null, in the browser's words (`artifactRefusal`). Reach is
 * `creature_refusal`'s, asked before this as it is of everything done beside a creature.
 */
create or replace function artifact_refusal(p_world uuid, p_uid uuid, p_action text, c creature)
  returns text language plpgsql stable as $fn$
declare v_def text := artifact_item(p_action); v_name text;
begin
  if c.mode = 'wild' then return 'It is not yours.'; end if;
  if c.keeper is distinct from p_uid then return c.name || ' is not yours.'; end if;
  if c.mode = 'stored' then return c.name || ' is in a creature crate. Open the crate first.'; end if;
  v_name := lower((select name from item_def where id = v_def));
  -- A locked one is not offered up, as nothing else spends one (`consume`).
  if pack_count(p_world, p_uid, v_def) <= 0 then return 'You need ' || article(v_name) || ' ' || v_name || '.'; end if;
  if p_action = 'use_ancient_comb' and age_of(c.born, old_of(c), age_pace(c)) = 'young' then
    return c.name || ' is young already, and nothing is younger than young.';
  end if;
  if p_action = 'use_ancient_file' and c.rare is not null and rarity_next(c.rare) is null then
    return c.name || ' is ' || c.rare || ' already, as rare as there is.';
  end if;
  if p_action = 'use_ancient_pot' and not exists (select 1 from unnest(base_stats()) s where pot_points(c, s) < pot_most()) then
    return 'Every base stat of ' || c.name || ' has ' || pot_most()::int || ' points from ancient pots, the most one takes.';
  end if;
  return null;
end $fn$;

/*
 * The artifact used, and used up: the browser's `artifactAction`. Asked again first, so nothing is spent on one that
 * became young, fantastic or full between the asking and the doing.
 */
create or replace function perform_artifact(p_world uuid, p_uid uuid, p_action text, c creature)
  returns void language plpgsql as $fn$
declare v_def text := artifact_item(p_action); v_name text; v_age text; v_stat text; v_points int; v_rare text;
begin
  if artifact_refusal(p_world, p_uid, p_action, c) is not null then return; end if;
  v_name := lower((select name from item_def where id = v_def));
  if not consume(p_world, p_uid, v_def, 1) then return; end if;

  if p_action = 'use_ancient_comb' then
    -- The start of the stage below, `comb_into` into it, at the pace its keeper's perks age it.
    v_age := age_of(c.born, old_of(c), age_pace(c));
    update creature set born = now() - make_interval(secs => ((case when v_age = 'old' then young_for() else 0 end)
                                                              + comb_into()) / age_pace(c))
     where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, case when v_age = 'old'
      then 'You comb ' || c.name || ' with the ' || v_name || ', and it is grown again: as old as one only just grown, at its full pace and pull. The comb is used up.'
      else 'You comb ' || c.name || ' with the ' || v_name || ', and it is young again: as young as one only just born, and it cannot be worked, ridden or put in the traces until it is grown. The comb is used up.'
      end, 'event');

  elsif p_action = 'use_ancient_file' then
    -- One time in `file_rarity_odds`, a step and no more.
    if random() < 1 / file_rarity_odds() then
      v_rare := rarity_next(c.rare);
      update creature set rare = v_rare where world_id = p_world and id = c.id;
      perform tell(p_world, p_uid, 'You go over ' || c.name || ' with the ' || v_name || ', and it comes up ' || v_rare
        || ': every figure its blood decides is ' || pct_say((select r.blood from rarity_def r where r.id = v_rare))
        || ' over an ordinary one''s. The file is used up.', 'event');
    else
      perform tell(p_world, p_uid, 'You go over ' || c.name || ' with the ' || v_name || ', and it is no rarer. The file is used up; one time in '
        || file_rarity_odds()::int || ' it makes one a step rarer.', 'event');
    end if;

  else
    -- A stat not yet at the most it takes, any of them as likely as another.
    select s into v_stat from unnest(base_stats()) s where pot_points(c, s) < pot_most() order by random() limit 1;
    v_points := pot_points(c, v_stat) + 1;
    update creature set boosts = coalesce(boosts, '{}'::jsonb) || jsonb_build_object(v_stat, v_points)
     where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, 'You use the ' || v_name || ' on ' || c.name || ': its ' || lower(base_stat_name(v_stat))
      || ' takes a point, ' || pot_says(v_stat, v_points) || '. The pot is used up.', 'event');
  end if;
end $fn$;

-- The three are creature actions, asked and done as the rest are.
create or replace function creature_action(p_action text) returns boolean language sql immutable as $function$
  select p_action in ('examine_creature', 'tame', 'feed', 'groom', 'shear', 'milk_creature',
                      'set_stance', 'order_attack', 'order_heel', 'rename_creature', 'take_creature', 'crate_creature',
                      'crate_follow', 'crate_work',
                      'release_creature', 'cull_creature', 'assign_deed')
      -- An ancient comb, file or pot used on one (`artifact_action`).
      or artifact_action(p_action)
$function$;

do $do$
declare r record; v_def text; v_n int; i int;
begin
  for r in select * from (values
    -- Asked once it is known to be within reach, before anything else is asked of it.
    (1, 'creature_refusal', array[$$
  if p_action = 'tame' then
$$], array[$$
  -- An ancient comb, file or pot (`artifact_refusal`).
  if artifact_action(p_action) then return artifact_refusal(p_world, p_uid, p_action, c); end if;

  if p_action = 'tame' then
$$], array[1]),
    (2, 'perform_creature', array[$$
  if p_action = 'examine_creature' then
$$], array[$$
  -- An ancient comb, file or pot (`perform_artifact`).
  if artifact_action(p_action) then
    perform perform_artifact(p_world, p_uid, p_action, c);
    return;
  end if;

  if p_action = 'examine_creature' then
$$], array[1]),
    -- And what ancient pots have put into your own, for its card.
    (3, 'rpc_creatures', array[$$           'fleece', c.fleece,
$$], array[$$           'fleece', c.fleece,
           -- What ancient pots have put into its base stats, which its card says beside each.
           'boosts', c.boosts,
$$], array[1])
  ) as t(ord, fn, olds, news, ns) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      if v_n <> r.ns[i] then raise exception '% has % of %, not %', r.fn, v_n, r.olds[i], r.ns[i]; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
    end loop;
    execute v_def;
  end loop;
end $do$;

-- A bone comb held, kept, put up for sale, bartered, ordered, stored, counted or carried is an ancient comb.
update item set def = 'ancient_comb' where def = 'bone_comb';
update away_tally set def = 'ancient_comb' where def = 'bone_comb';
update barter_item set def = 'ancient_comb' where def = 'bone_comb';
update buy_order set def = 'ancient_comb' where def = 'bone_comb';
update sale set def = 'ancient_comb' where def = 'bone_comb';
update deed_ledger set def = 'ancient_comb' where def = 'bone_comb';
update deed_store_log set def = 'ancient_comb' where def = 'bone_comb';
update deed_work set def = 'ancient_comb' where def = 'bone_comb';
update player set ledger = (ledger - 'bone_comb') || jsonb_build_object('ancient_comb', ledger -> 'bone_comb') where ledger ? 'bone_comb';
update creature set carrying = carrying || jsonb_build_object('def', 'ancient_comb') where carrying->>'def' = 'bone_comb';

select private.lock_doors();

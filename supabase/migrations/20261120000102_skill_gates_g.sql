-- Skill gates, the seventh set (batch G): the user's answers to batch F's questions.
--
--   * Rows of `skill_gate` (`20261120000093_defs.sql`, `npm run defs`): wemp sown at farming 1 (was 30); the bucket at
--     carpentry 1 and lye at alchemy 1 (were 10); an alloy poured and its casting worked at the level of the recipe
--     that mixes it (pewter 5, bronze and brass 10, steel and electrum 20, fire-tempered steel 40); everything made
--     with obsidian or built of it at 99, in its own making skill.
--   * A treasure map under its tier's gate is read; only digging it up is gated (`20261120000101_skill_gates_f.sql`
--     no longer patches `rpc_treasure_map`).
--   * A hod carrier whose only work within reach is bridge spans over its own level is idle `gate`, naming the lowest
--     bridge, then the nearest, in the one wording ("Pip idle: … Drawbridge: needs carpentry 50; have 1.0."), not
--     "no work".

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

-- A hod carrier's only work within reach being bridge spans over its own level: the lowest such bridge, then the
-- nearest (rings from the totem), by kind; nothing where any work it may fit wants something (`hodGatedSpan`).
create or replace function hod_span_gate(p_world uuid, c creature, p_cx int, p_cy int, p_range int, out kind text, out n int)
language sql stable as $$
  with w as (
    select h.* from hod_work(p_world, p_cx, p_cy, p_range) h
     where hod_work_mine(p_world, c.keeper, h.dir, h.x, h.y)
       and exists (select 1 from jsonb_each_text(h.needed) e where e.value::int > 0)
  )
  select b.kind, greatest(abs(w.x - p_cx), abs(w.y - p_cy))::int
    from w join bridge b on b.world_id = p_world and b.id = w.ref
   where w.kind = 'span' and not hod_may(p_world, c, w.kind, w.level, w.dir, w.x, w.y)
     and not exists (select 1 from w o where hod_may(p_world, c, o.kind, o.level, o.dir, o.x, o.y))
   order by (skill_gate_of('bridge', b.kind)).level, 2, b.kind collate "C"
   limit 1
$$;

select pg_temp.patch_fn('errand_step(uuid,integer,text)',
$o$        if why_n is not null then why := 'stairs'; return next; return; end if;$o$,
$n$        if why_n is not null then why := 'stairs'; return next; return; end if;
        -- Only bridge spans over its own level within reach: `gate`, naming the lowest bridge, then the nearest.
        select array['bridge', s.kind], s.n into why_what, why_n from hod_span_gate(p_world, c, dd.x, dd.y, rng) s;
        if why_what is not null then why := 'gate'; return next; return; end if;$n$);

select private.lock_doors();

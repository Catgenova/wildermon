/**
 * A Sparra on a settlement spars with your guards there.
 *
 * Asked for: "Fighting only type wildermon have no real way to gain experience. If paired with Sparra on deed, both
 * fight and gain experience for doing so." This asks, of both sides (`sparTaskSays`, the island's `worker_settle`):
 *
 *   * that the numbers are the same (`SPAR_REACH`, `GUARD_LEARN`, and the guard's factor in `LEARN_PACE`);
 *   * that a Sparra on a settlement with no guard of yours there says so (`nospar`), and with one picks it, and the
 *     guard walks to it and spars: a go at its task (`workDuration` over its pace), a blow each way at the end of it;
 *   * that the go teaches the guard its level skill at `GUARD_LEARN` and the Sparra its fighting at `LEARNS_GAIN.bout`,
 *     the guard at its trade's factor and the Sparra at a spar on a settlement's (`LEARN_PACE.bout`), not your spar's,
 *     and counts a go of stamina and of the ledger to each;
 *   * that nobody goes below `SPAR_YIELD` of its health, and one at it has yielded and stands, its card saying until
 *     when (`sparBack`), and spars again once it has its breath back;
 *   * that a guard drops a spar at once for something wild on the settlement;
 *   * that two guards take turns, the one that sparred longest ago first;
 *   * that the island says who is sparring with whom (`sparWith`), and that a Sparra takes a worker place;
 *   * and the words: the Sparra's settlement task and a guard's level line, the same on both sides.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import {
  GATHER_SKILL, GUARD_LEARN, GUARD_LEVEL, LEARN_PACE, LEARNS_GAIN, learnPace, maxHealth, SPAR_REACH, SPAR_SLACK, SPAR_YIELD, sparBack,
  sparFloor, sparTaskSays, SPECIES, workDuration, type Creature,
} from '../../src/game/creatures';
import { ACTION_BY_ID } from '../../src/game/actions';
import { idleSays } from '../../src/game/workerlog';
import { skillGain } from '../../src/game/skills';
import { TileType } from '../../src/world/tiles';
import { percent } from '../../src/game/words';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number, by = 1e-6): boolean => Math.abs(a - b) <= by;
const T = 16;
const U = '7e5b0000-0000-4000-8000-0000000000e9';
/** The guard each side sets to spar, and its level skill, at a level of its first stage. */
const GUARD = 'testa';
const OTHER = 'skulka';
const LEVEL = 10;
const SKILL = GATHER_SKILL.guard;

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; s int; a int; b int; x int; i int; j int; c creature; r jsonb; v_at timestamptz; v_s0 double precision;
        v_a0 double precision; v_picks text := '';
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Spar', 179, 40, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x2, y2, tile_id('Grass')) from generate_series(0, 39) x2, generate_series(0, 39) y2;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, seen_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Sparstead', ${T}, ${T}, 10, 5, u);
  insert into said values ('NUMS', spar_reach() || '|' || guard_learn() || '|' || (select pace from learn_pace_def where id = 'guard')
    || '|' || learns_gain_bout() || '|' || (select pace from learn_pace_def where id = 'bout'));
  insert into said select 'WORDS', description from species_def where id = 'sparra';
  insert into said select 'GUARDWORDS', description from species_def where id = 'thumpa';

  -- A Sparra alone on the settlement: nobody to spar with.
  s := creature_spawn(w, 'sparra', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', worn = 0, carrying = null,
         skills = jsonb_build_object('fighting', ${LEVEL}), phase = 'idle',
         from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5,
         until = now() - interval '0.3 seconds', leg_at = now() - interval '0.3 seconds', leg_ends = now() - interval '0.3 seconds'
   where world_id = w and id = s;
  perform worker_settle(w, s);
  insert into said select 'ALONE', coalesce(idle_why, '-') || '|' || coalesce(spar_with::text, '-') from creature where world_id = w and id = s;

  -- A guard: the Sparra picks it, and it walks over.
  a := creature_spawn(w, '${GUARD}', ${T} + 4.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', worn = 0, carrying = null,
         skills = jsonb_build_object('${SKILL}', ${LEVEL}), phase = 'idle',
         from_x = ${T} + 4.5, from_y = ${T} + 0.5, to_x = ${T} + 4.5, to_y = ${T} + 0.5,
         until = now() - interval '0.3 seconds', leg_at = now() - interval '0.3 seconds', leg_ends = now() - interval '0.3 seconds'
   where world_id = w and id = a;
  update creature set until = now() - interval '0.3 seconds', to_x = ${T} + 0.5, from_x = ${T} + 0.5 where world_id = w and id = s;
  perform worker_settle(w, s);
  insert into said select 'PICK', (spar_with = a)::text || '|' || coalesce(idle_why, '-') from creature where world_id = w and id = s;
  perform worker_settle(w, a);
  insert into said select 'WALK', round(sqrt((g.to_x - q.to_x) ^ 2 + (g.to_y - q.to_y) ^ 2)::numeric, 3) || '|' || g.phase || '|' || (g.spar_with = s)::text
    from creature g, creature q where g.world_id = w and g.id = a and q.world_id = w and q.id = s;
  -- There: it squares up, a go at its task.
  v_at := now() - interval '0.3 seconds';
  update creature set from_x = to_x, from_y = to_y, until = v_at, leg_at = v_at, leg_ends = v_at where world_id = w and id = a;
  perform worker_settle(w, a);
  select * into c from creature where world_id = w and id = a;
  insert into said values ('GO', c.phase || '|' || extract(epoch from c.spar_at - v_at) || '|' || worker_pace(w, c, 'guard'));
  r := rpc_creatures(w, 40);
  insert into said select 'SENT', string_agg((e->>'id') || '>' || coalesce(e->>'sparWith', '-'), ',' order by (e->>'id')::int)
    from jsonb_array_elements(r) e where (e->>'id')::int in (s, a);
  -- The go done: a blow each way, and what each learns.
  select health into v_s0 from creature where world_id = w and id = s;
  select health into v_a0 from creature where world_id = w and id = a;
  update creature set spar_at = now() - interval '0.3 seconds', until = now() - interval '0.3 seconds' where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'AFTER_' || id, health || '|' || max_health(creature) || '|' || (skills->>(case when id = s then 'fighting' else '${SKILL}' end))
    || '|' || worn || '|' || coalesce(ledger->'now'->>'goes', '0') || '|' || phase || '|' || coalesce(spar_with::text, '-')
    from creature where world_id = w and id in (s, a);
  insert into said values ('BEFORE', v_s0 || '|' || v_a0);

  -- At the edge of yielding: neither goes below it, and both have yielded.
  update creature set health = max_health(creature) * spar_yield() + spar_slack() + 0.05 where world_id = w and id in (s, a);
  update creature set until = now() - interval '0.3 seconds', phase = 'idle' where world_id = w and id in (s, a);
  perform worker_settle(w, s);
  perform worker_settle(w, a);
  update creature set from_x = to_x, from_y = to_y, until = now() - interval '0.3 seconds', leg_ends = now() - interval '0.3 seconds' where world_id = w and id = a;
  perform worker_settle(w, a);
  update creature set spar_at = now() - interval '0.3 seconds', until = now() - interval '0.3 seconds' where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'YIELD_' || id, (health = max_health(creature) * spar_yield())::text || '|' || coalesce(idle_why, '-') || '|' || coalesce(idle_n::text, '-')
    from creature where world_id = w and id in (s, a);
  -- Yielded, it stands and spars with nobody until it has its breath back.
  update creature set until = now() - interval '0.3 seconds' where world_id = w and id in (s, a);
  perform worker_settle(w, s);
  perform worker_settle(w, a);
  insert into said select 'STANDS_' || id, coalesce(idle_why, '-') || '|' || coalesce(spar_with::text, '-') || '|' || (from_x = to_x and from_y = to_y)::text
    from creature where world_id = w and id in (s, a);
  update creature set health = max_health(creature) where world_id = w and id in (s, a);
  update creature set until = now() - interval '0.3 seconds' where world_id = w and id in (s, a);
  perform worker_settle(w, a);
  perform worker_settle(w, s);
  insert into said select 'BREATH', (spar_with = a)::text || '|' || coalesce(idle_why, '-') from creature where world_id = w and id = s;

  -- Something wild on the settlement mid-spar: the guard drops it at once.
  for i in 1..4 loop
    update creature set from_x = to_x, from_y = to_y, until = now() - interval '0.3 seconds', leg_ends = now() - interval '0.3 seconds' where world_id = w and id = a;
    perform worker_settle(w, a);
    exit when (select phase from creature where world_id = w and id = a) = 'spar';
  end loop;
  insert into said select 'MIDGO', phase from creature where world_id = w and id = a;
  x := creature_spawn(w, 'ulva', ${T} + 6.5, ${T} + 2.5, 'wild', now() - interval '30 days', null);
  update creature set until = now() - interval '0.3 seconds' where world_id = w and id = a;
  perform worker_settle(w, a);
  insert into said select 'INTRUDER', phase || '|' || coalesce(spar_with::text, '-') || '|' || (enemy = x)::text from creature where world_id = w and id = a;
  update creature set until = now() - interval '0.3 seconds' where world_id = w and id = s;
  perform worker_settle(w, s);
  insert into said select 'LEFT', coalesce(spar_with::text, '-') || '|' || coalesce(idle_why, '-') from creature where world_id = w and id = s;
  delete from creature where world_id = w and id = x;
  update creature set enemy = null, phase = 'idle', spar_at = now() - interval '30 minutes', health = max_health(creature) where world_id = w and id in (s, a);

  -- Two guards: turns, the one that sparred longest ago first.
  b := creature_spawn(w, '${OTHER}', ${T} - 3.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', worn = 0, carrying = null,
         skills = jsonb_build_object('${SKILL}', ${LEVEL}), phase = 'idle',
         from_x = ${T} - 3.5, from_y = ${T} + 0.5, to_x = ${T} - 3.5, to_y = ${T} + 0.5
   where world_id = w and id = b;
  update creature set spar_at = now() - interval '1 hour' where world_id = w and id = b;
  update creature set spar_with = null where world_id = w and id in (s, a, b);
  for i in 1..3 loop
    update creature set until = now() - interval '0.3 seconds', phase = 'idle', health = max_health(creature) where world_id = w and id = s;
    perform worker_settle(w, s);
    select spar_with into x from creature where world_id = w and id = s;
    v_picks := v_picks || case when x = a then 'a' when x = b then 'b' else '-' end;
    exit when x is null;
    update creature set phase = 'idle' where world_id = w and id = x;
    for j in 1..4 loop
      update creature set from_x = to_x, from_y = to_y, until = now() - interval '0.3 seconds', leg_ends = now() - interval '0.3 seconds' where world_id = w and id = x;
      perform worker_settle(w, x);
      exit when (select phase from creature where world_id = w and id = x) = 'spar';
    end loop;
    update creature set spar_at = now() - interval '0.3 seconds' - make_interval(secs => 3 - i), until = now() - interval '0.3 seconds' - make_interval(secs => 3 - i)
     where world_id = w and id = x;
    perform worker_settle(w, x);
  end loop;
  insert into said values ('TURNS', v_picks);

  -- A Sparra takes a worker place: with the settlement full, one more is refused.
  update deed set level = 1 where world_id = w;
  x := creature_spawn(w, 'sparra', ${T} + 1.5, ${T} + 1.5, 'active', now() - interval '30 days', u);
  insert into said values ('FULL', coalesce(act_refusal(w, u, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', x)), 'none')
    || '|' || (select count(*) from creature where world_id = w and keeper = u and mode = 'deed'));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const byId = (prefix: string): string[] => [...isle.keys()].filter((k) => k.startsWith(prefix)).sort((x, y) => Number(x.slice(prefix.length)) - Number(y.slice(prefix.length))).map((k) => isle.get(k)!);

check(`the numbers are the same on both sides: reach ${SPAR_REACH}, a guard's lesson ${GUARD_LEARN} and factor ${LEARN_PACE.guard}, the Sparra's ${LEARNS_GAIN.bout} and ${LEARN_PACE.bout}`,
  at('NUMS') === `${SPAR_REACH}|${GUARD_LEARN}|${LEARN_PACE.guard}|${LEARNS_GAIN.bout}|${LEARN_PACE.bout}`, at('NUMS'));
check(`a Sparra learns on a settlement at a factor of its own, and from your spar at its own still (${LEARN_PACE.spar}), its words saying both`,
  LEARN_PACE.bout !== LEARN_PACE.spar && SPECIES.sparra.description.includes(percent(LEARN_PACE.bout)) && SPECIES.sparra.description.includes(percent(LEARN_PACE.spar)),
  SPECIES.sparra.description);
check('the Sparra\'s words are the same on both sides, its settlement task in them', at('WORDS') === SPECIES.sparra.description && SPECIES.sparra.description.includes(sparTaskSays()), at('WORDS'));
check('a guard\'s level line says it learns sparring with a Sparra, on both sides', at('GUARDWORDS') === SPECIES.thumpa.description && SPECIES.thumpa.description.includes(GUARD_LEVEL), at('GUARDWORDS'));

/* ---- on the island: what it does --------------------------------------------------------------------------------- */

check('on the island, a Sparra alone on a settlement has nobody to spar with, and says so', at('ALONE') === 'nospar|-', at('ALONE'));
check('with a guard of yours there it picks it', at('PICK') === 'true|-', at('PICK'));
{
  const [d, phase, paired] = at('WALK').split('|');
  check(`and the guard walks to within ${SPAR_REACH} of it`, Number(d) <= SPAR_REACH + 1e-6 && phase === 'idle' && paired === 'true', at('WALK'));
}
const goSecs = (pace: number): number => workDuration(LEVEL) / pace;
{
  const [phase, secs, pace] = at('GO').split('|');
  check('there it spars, a go at its task: its time per action at its level, over its pace', phase === 'spar' && near(Number(secs), goSecs(Number(pace)), 1e-3), at('GO'));
}
check('the island says who is sparring with whom', /^\d+>\d+,\d+>\d+$/.test(at('SENT')) && at('SENT').split(',').every((p, i, all) => p.split('>')[1] === all[1 - i].split('>')[0]), at('SENT'));
{
  const [sAfter, aAfter] = byId('AFTER_');
  const [sh, smax, sskill, sworn, sgoes, sphase, swith] = sAfter.split('|');
  const [ah, amax, askill, aworn, agoes, aphase, awith] = aAfter.split('|');
  const [s0, a0] = at('BEFORE').split('|').map(Number);
  check('a go is a blow each way, neither below where it yields', Number(sh) < s0 && Number(ah) < a0
    && Number(sh) >= Number(smax) * SPAR_YIELD && Number(ah) >= Number(amax) * SPAR_YIELD, `${sAfter} / ${aAfter} from ${at('BEFORE')}`);
  // The gain at a roll between the least and the most: what the browser's `gainSkill` makes of the same base and factor.
  const within = (v: number, base: number, pace: number): boolean => v - LEVEL >= skillGain(LEVEL, base * pace, 0.6) - 1e-9 && v - LEVEL <= skillGain(LEVEL, base * pace, 1.4) + 1e-9;
  check(`the guard learns its ${SKILL} at ${GUARD_LEARN} × ${LEARN_PACE.guard}, the Sparra its fighting at ${LEARNS_GAIN.bout} × ${LEARN_PACE.bout}`,
    within(Number(askill), GUARD_LEARN, learnPace({ species: GUARD, trade: null }, SKILL)) && within(Number(sskill), LEARNS_GAIN.bout, LEARN_PACE.bout),
    `${askill} / ${sskill}`);
  check('a go of stamina and of the ledger each', sworn === '1' && aworn === '1' && sgoes === '1' && agoes === '1', `${sworn} ${aworn} ${sgoes} ${agoes}`);
  check('both strike, and the Sparra is free to pick again', sphase === 'strike' && aphase === 'strike' && swith === '-' && awith === '-', `${sphase} ${aphase} ${swith} ${awith}`);
}
{
  const ys = byId('YIELD_');
  check(`at the edge of yielding a blow takes each to ${SPAR_YIELD} of its health and no lower, and each has yielded, saying until when`,
    ys.length === 2 && ys.every((y) => y.startsWith('true|yielded|')) && Number(ys[0].split('|')[2]) === Math.ceil(SPECIES.sparra.health * SPAR_YIELD + SPAR_SLACK),
    ys.join(' / '));
  const st = byId('STANDS_');
  check('yielded, each stands and spars with nobody', st.length === 2 && st.every((y) => y === 'yielded|-|true'), st.join(' / '));
}
check('with its breath back it spars again', at('BREATH') === 'true|-', at('BREATH'));
check('mid-spar', at('MIDGO') === 'spar', at('MIDGO'));
check('something wild on the settlement and the guard drops the spar at once, and goes for it', at('INTRUDER').split('|')[1] === '-' && at('INTRUDER').endsWith('|true') && !at('INTRUDER').startsWith('spar'), at('INTRUDER'));
check('and the Sparra, its guard gone after it, has nobody to spar with', at('LEFT') === '-|nospar', at('LEFT'));
check('two guards take turns, the one that sparred longest ago first', at('TURNS') === 'bab', at('TURNS'));

/* ---- in the browser ---------------------------------------------------------------------------------------------- */

const g = Game.create(4259);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = T - 12; y <= T + 12; y++) for (let x = T - 12; x <= T + 18; x++) { g.world.setHeight(x, y, 4); g.world.setDirt(x, y, 5); g.world.setTile(x, y, TileType.Grass, 0); }
g.player.x = T + 0.5;
g.player.y = T + 0.5;
g.deed = { name: 'Sparstead', x: T, y: T, radius: 10, level: 5, mine: true };
const cr = g.creatures as unknown as Record<string, (...a: unknown[]) => unknown>;
const call = (name: string, ...a: unknown[]): unknown => cr[name].call(g.creatures, ...a);
const worker = (sp: string, skills: Record<string, number>, x: number, y: number): Creature => {
  const c = g.creatures.spawn(sp, x, y, 'deed', g.rand, g.time - 3600 * 24 * 30);
  c.traits = [];
  c.rare = 0;
  c.care = 0;
  c.hunger = 1;
  c.stance = 'passive';
  c.skills = skills;
  c.until = g.time - 1;
  return c;
};
const step = (cs: Creature[], secs: number, dt = 0.25): void => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    for (const c of cs) call('updateWorker', c, dt, g);
  }
};
const s = worker('sparra', { fighting: LEVEL }, T + 0.5, T + 0.5);
step([s], 1);
check('in the browser, a Sparra alone on a settlement has nobody to spar with, and says so', s.idle?.why === 'nospar' && s.sparWith == null, JSON.stringify(s.idle));
check('and its card says it the same way', idleSays({ why: 'nospar', n: 0 }, null) === 'Idle: no guard of yours on the settlement free to spar.', idleSays({ why: 'nospar', n: 0 }, null));
const a = worker(GUARD, { [SKILL]: LEVEL }, T + 4.5, T + 0.5);
s.until = g.time;
step([s, a], 0.25);
check('with a guard there it picks it', s.sparWith === a.id, `${s.sparWith}`);
step([s, a], 8);
check(`and the guard walks to within ${SPAR_REACH} of it and spars, a go at its task`, a.state === 'spar' && Math.hypot(a.x - s.x, a.y - s.y) <= SPAR_REACH
  && near(a.until - g.time, goSecs(g.creatures.taskMul(a, 'guard')), goSecs(1) / 2), `${a.state} ${Math.hypot(a.x - s.x, a.y - s.y)} ${a.until - g.time}`);
{
  const s0 = s.health;
  const a0 = a.health;
  const sk = [s.skills.fighting, a.skills[SKILL]];
  g.time = a.until;
  step([a], 0.25);
  check('a go is a blow each way, neither below where it yields, and each learns', s.health < s0 && a.health < a0 && s.health >= sparFloor(s) && a.health >= sparFloor(a)
    && s.skills.fighting > sk[0] && a.skills[SKILL] > sk[1], `${s.health} ${a.health} ${s.skills.fighting} ${a.skills[SKILL]}`);
  // At the factor of a spar on a settlement, its learning at its care and meal as the island reads them (`learnMul`).
  const mul = g.creatures.learnMul(s, g.time);
  const gs = s.skills.fighting - sk[0];
  check(`the Sparra learns at ${LEARNS_GAIN.bout} × ${LEARN_PACE.bout} in the browser too`,
    gs >= skillGain(LEVEL, LEARNS_GAIN.bout * mul * LEARN_PACE.bout, 0.6) - 1e-9 && gs <= skillGain(LEVEL, LEARNS_GAIN.bout * mul * LEARN_PACE.bout, 1.4) + 1e-9, `${gs}`);
  check('a go of stamina and of the ledger each, and the Sparra free to pick again', s.worn === 1 && a.worn === 1 && s.ledger?.now.goes === 1 && a.ledger?.now.goes === 1 && s.sparWith == null,
    `${s.worn} ${a.worn} ${s.ledger?.now.goes} ${a.ledger?.now.goes} ${s.sparWith}`);
  check('both strike as they do', s.act === 'strike' && a.act === 'strike', `${s.act} ${a.act}`);
}
{
  s.health = sparFloor(s) + SPAR_SLACK + 0.05;
  a.health = sparFloor(a) + SPAR_SLACK + 0.05;
  step([s, a], 2);
  g.time = Math.max(g.time, a.until);
  step([s, a], 0.25);
  check(`at the edge of yielding a blow takes each to ${SPAR_YIELD} of its health and no lower, and each has yielded, saying until when`,
    s.health === sparFloor(s) && a.health === sparFloor(a) && s.idle?.why === 'yielded' && a.idle?.why === 'yielded' && s.idle.n === sparBack(s),
    `${s.health} ${a.health} ${JSON.stringify(s.idle)} ${JSON.stringify(a.idle)}`);
  check('and its card says it', idleSays({ why: 'yielded', n: sparBack(s) }, null) === `Yielded: spars again above ${sparBack(s)} health.`, idleSays({ why: 'yielded', n: sparBack(s) }, null));
  step([s, a], 3);
  check('yielded, each stands and spars with nobody', s.sparWith == null && a.sparWith == null && !s.moving && a.state !== 'spar', `${s.sparWith} ${a.sparWith} ${a.state}`);
  s.health = s.health + SPAR_SLACK * 3;
  a.health = a.health + SPAR_SLACK * 3;
  step([s, a], 1);
  check('with its breath back it spars again', s.sparWith === a.id, `${s.sparWith}`);
}
{
  step([s, a], 8);
  const mid = a.state;
  const x = g.creatures.spawn('ulva', a.x + 0.8, a.y, 'wild', g.rand, g.time - 3600 * 24 * 30);
  step([s, a], 2);
  check('something wild on the settlement mid-spar and the guard drops it at once, and goes for it', mid === 'spar' && a.state !== 'spar' && a.sparWith == null && a.enemy === x.id,
    `${mid} ${a.state} ${a.sparWith} ${a.enemy}`);
  check('and the Sparra, its guard gone after it, has nobody to spar with', s.sparWith == null && s.idle?.why === 'nospar', `${s.sparWith} ${JSON.stringify(s.idle)}`);
  g.creatures.remove(x.id);
  a.enemy = null;
}
{
  const b = worker(OTHER, { [SKILL]: LEVEL }, T - 3.5, T + 0.5);
  for (const o of [s, a]) {
    o.health = maxHealth(o, SPECIES[o.species]);
    o.idle = null;
    o.state = 'idle';
  }
  b.sparAt = g.time - 3600;
  a.sparAt = g.time - 60;
  const picks: string[] = [];
  for (let i = 0; i < 3; i++) {
    s.until = g.time;
    step([s, a, b], 0.25);
    const p = s.sparWith === a.id ? 'a' : s.sparWith === b.id ? 'b' : '-';
    picks.push(p);
    const gd = p === 'a' ? a : b;
    step([s, a, b], 8);
    g.time = Math.max(g.time, gd.until);
    step([s, a, b], 0.25);
  }
  check('two guards take turns, the one that sparred longest ago first', picks.join('') === 'bab', picks.join(''));
}
{
  g.deed.level = 1;
  const x = g.creatures.spawn('sparra', T + 1.5, T + 1.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  const refused = ACTION_BY_ID.get('assign_deed')!.check!({ kind: 'creature', id: x.id }, g);
  const [island, n] = at('FULL').split('|');
  check('a Sparra takes a worker place: with the settlement full, one more is refused, the same words on both sides',
    !!refused && refused === island && Number(n) >= g.workerCap, `${refused} / ${at('FULL')}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na Sparra on a settlement spars with your guards — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

/**
 * Seven that fight.
 *
 * Asked for off a list of combat wildermon. This asks, of both sides, that
 * each of the seven fights by its style (`FightStyle`) wherever a blow of one
 * of yours lands on another creature, and a wild one does not:
 *
 *   * a testa turns what is after you or one of yours, near it, onto itself;
 *   * a skulka lands `BLINDSIDE` on what is fighting something else;
 *   * a gasha bleeds what it bites as a knife does;
 *   * a thumpa stuns with the last of every `HEAVY_EVERY` blows;
 *   * a spitta leaves venom;
 *   * an awla lands `BODKIN_HIDE` on anything with a hide;
 *   * a sparra of yours may be attacked, no lower than `SPAR_YIELD` of its
 *     health, where it yields and will not be sparred with until it is back
 *     above it; and a swing at it teaches as a swing at a wild thing does.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { maxHealth, SPAR_SLACK, SPAR_YIELD, SPECIES, type Creature } from '../../src/game/creatures';
import { ACTION_BY_ID } from '../../src/game/actions';
import { BLINDSIDE, BODKIN_HIDE, GUARD_RANGE, HEAVY_EVERY, KNIFE_BLEED_SECS, STUN_SECS, VENOM_DRAIN, VENOM_SECS } from '../../src/game/fight';

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

const STYLES: Array<[string, string]> = [
  ['testa', 'shield'], ['skulka', 'flank'], ['gasha', 'bleed'], ['thumpa', 'stun'], ['spitta', 'venom'], ['awla', 'bore'], ['sparra', 'spar'],
];

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000d7';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; a int; t int; t2 int; t3 int; v_n int; c creature; v_before double precision; v_fight double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Seven', 174, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;

  insert into said select 'STYLE:' || s.id, coalesce(s.style, '-') from species_def s where s.id in (${STYLES.map(([id]) => `'${id}'`).join(', ')});
  insert into said values ('NUMBERS', spar_yield() || '|' || spar_slack());

  -- Gasha: a bite on a wild rabba of no hide.
  a := creature_spawn(w, 'gasha', 18.5, 16.5, 'active', now() - interval '60 days', u);
  t := creature_spawn(w, 'ulva', 19, 16.5, 'wild', now() - interval '60 days', null);
  update creature set health = 500 where world_id = w and id = t;
  perform creature_attack(w, a, t);
  insert into said select 'BLEED', (coalesce(bleed_rate, 0) > 0)::text || '|' || round(extract(epoch from bleed_until - now())::numeric) from creature where world_id = w and id = t;
  -- And a wild one bites as any other does.
  update creature set bleed_rate = null, bleed_until = null where world_id = w and id = t;
  update creature set mode = 'wild', keeper = null where world_id = w and id = a;
  perform creature_attack(w, a, t);
  insert into said select 'WILDBLEED', coalesce(bleed_rate, 0)::text from creature where world_id = w and id = t;
  delete from creature where world_id = w and id in (a, t);

  -- Spitta: venom, a share of its health a second.
  a := creature_spawn(w, 'spitta', 18.5, 16.5, 'active', now() - interval '60 days', u);
  t := creature_spawn(w, 'ulva', 19, 16.5, 'wild', now() - interval '60 days', null);
  -- No blood and no rarity, which would lift the venom it takes (\`venom\`).
  update creature set health = 500, traits = '{}', rare = null where world_id = w and id = t;
  update creature set traits = '{}', rare = null where world_id = w and id = a;
  perform creature_attack(w, a, t);
  select * into c from creature where world_id = w and id = t;
  insert into said values ('VENOM', round((c.bleed_rate / max_health(c))::numeric, 4) || '|' || round(extract(epoch from c.bleed_until - now())::numeric));
  delete from creature where world_id = w and id in (a, t);

  -- Thumpa: stunned on the last of every few blows, and not before.
  a := creature_spawn(w, 'thumpa', 18.5, 16.5, 'active', now() - interval '60 days', u);
  t := creature_spawn(w, 'ulva', 19, 16.5, 'wild', now() - interval '60 days', null);
  update creature set health = 5000 where world_id = w and id = t;
  for v_n in 1..${HEAVY_EVERY - 1} loop perform creature_attack(w, a, t); end loop;
  insert into said select 'STUNBEFORE', count(*)::text from class_mark where world_id = w and creature_id = t and kind = 'stun' and until > now();
  perform creature_attack(w, a, t);
  insert into said select 'STUN', count(*)::text || '|' || coalesce(round(extract(epoch from max(until) - now())::numeric)::text, '-') from class_mark where world_id = w and creature_id = t and kind = 'stun' and until > now();
  delete from creature where world_id = w and id in (a, t);

  -- Awla and skulka: what their blows are multiplied by.
  a := creature_spawn(w, 'awla', 18.5, 16.5, 'active', now() - interval '60 days', u);
  t := creature_spawn(w, 'bura', 19, 16.5, 'wild', now() - interval '60 days', null);
  t2 := creature_spawn(w, 'rabba', 19, 17.5, 'wild', now() - interval '60 days', null);
  insert into said select 'BORE', (select hide from species_def where id = 'bura') || '|' || style_dealt(a2, h) || '|' || style_dealt(a2, s)
    from creature a2, creature h, creature s where a2.world_id = w and a2.id = a and h.world_id = w and h.id = t and s.world_id = w and s.id = t2;
  a := creature_spawn(w, 'skulka', 18.5, 17.5, 'active', now() - interval '60 days', u);
  update creature set hunting = u where world_id = w and id = t;
  update creature set brawl = a where world_id = w and id = t2;
  insert into said select 'FLANK', style_dealt(a2, h) || '|' || style_dealt(a2, s)
    from creature a2, creature h, creature s where a2.world_id = w and a2.id = a and h.world_id = w and h.id = t and s.world_id = w and s.id = t2;
  delete from creature where world_id = w and id in (a, t, t2) or world_id = w and species = 'awla';

  -- Testa: two hunters after you beside it, and one too far off.
  a := creature_spawn(w, 'testa', 17.5, 16.5, 'active', now() - interval '60 days', u);
  t := creature_spawn(w, 'ulva', 18.5, 16.5, 'wild', now() - interval '60 days', null);
  t2 := creature_spawn(w, 'ulva', 17.5, 18.5, 'wild', now() - interval '60 days', null);
  t3 := creature_spawn(w, 'ulva', 17.5 + ${GUARD_RANGE} + 3, 16.5, 'wild', now() - interval '60 days', null);
  update creature set hunting = u, health = 500 where world_id = w and id in (t, t2, t3);
  perform creature_attack(w, a, t);
  insert into said select 'SHIELD', string_agg(case when brawl = a then 'on' else 'off' end, ',' order by id) from creature where world_id = w and id in (t, t2, t3);
  delete from creature where world_id = w and id in (a, t, t2, t3);

  -- Dummicub (was Sparra): yours may be sparred with, down to where it yields and no further; another tame thing may not.
  a := creature_spawn(w, 'sparra', 17.2, 16.5, 'active', now() - interval '60 days', u);
  t := creature_spawn(w, 'gasha', 16.5, 17.2, 'active', now() - interval '60 days', u);
  insert into said select 'SPARASK', coalesce(act_refusal(w, u, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', a)), 'none')
    || '|' || coalesce(act_refusal(w, u, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', t)), 'none');
  v_fight := skill_of(w, u, 'fighting');
  for v_n in 1..300 loop
    perform perform_fight(w, u, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', a));
  end loop;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('SPAR', c.health || '|' || max_health(c) || '|' || (c.hunting is null)::text || '|' || (skill_of(w, u, 'fighting') > v_fight)::text
    || '|' || coalesce(act_refusal(w, u, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', a)), 'none'));
  insert into said values ('SPARSAID', spar_said(c, c.health));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the species ------------------------------------------------------------------- */

for (const [id, style] of STYLES) {
  check(`a ${id} fights by ${style} on both sides`, SPECIES[id]?.style === style && at(`STYLE:${id}`) === style, at(`STYLE:${id}`));
  check(`a ${id}'s description is filled in`, !!SPECIES[id] && !/[{}]/.test(SPECIES[id].description), SPECIES[id]?.description);
}
check(`a spar holds at ${SPAR_YIELD} of its health, give or take ${SPAR_SLACK}, on both sides`, at('NUMBERS') === `${SPAR_YIELD}|${SPAR_SLACK}`, at('NUMBERS'));

/* ---- on the island ----------------------------------------------------------------- */

const [bled, bleedSecs] = at('BLEED').split('|');
check(`on the island, a gasha's bite bleeds what it bites for ${KNIFE_BLEED_SECS} seconds`, bled === 'true' && Number(bleedSecs) === KNIFE_BLEED_SECS, at('BLEED'));
check('and a wild one\'s does not', at('WILDBLEED') === '0', at('WILDBLEED'));
check(`a spitta's bite leaves venom of ${VENOM_DRAIN} of its health a second for ${VENOM_SECS} seconds`, at('VENOM') === `${VENOM_DRAIN.toFixed(4)}|${VENOM_SECS}`, at('VENOM'));
check(`a thumpa stuns nothing on its first ${HEAVY_EVERY - 1} blows, and for ${STUN_SECS} seconds on the next`,
  at('STUNBEFORE') === '0' && at('STUN') === `1|${STUN_SECS}`, `${at('STUNBEFORE')} / ${at('STUN')}`);
check(`an awla lands ${BODKIN_HIDE} on a bura's hide and 1 on a rabba`, at('BORE') === `thick|${BODKIN_HIDE}|1`, at('BORE'));
check(`a skulka lands ${BLINDSIDE} on one after you and 1 on one fighting it`, at('FLANK') === `${BLINDSIDE}|1`, at('FLANK'));
check(`a testa's blow turns the two hunters after you within ${GUARD_RANGE} tiles onto it, and not the one further off`, at('SHIELD') === 'on,on,off', at('SHIELD'));
const [sparAsk, tameAsk] = at('SPARASK').split('|');
check('a sparra of yours may be attacked; another of yours may not', sparAsk === 'none' && tameAsk.startsWith('Tame: release it first'), at('SPARASK'));
const [sh, smax, shunt, slearnt, sAfter] = at('SPAR').split('|');
check(`sparred with, it goes no lower than ${SPAR_YIELD} of its health, never comes for you, and the swings teach fighting`,
  Number(sh) === Number(smax) * SPAR_YIELD && shunt === 'true' && slearnt === 'true', at('SPAR'));
check('and then it has yielded', sAfter.endsWith('has yielded: wait.') && at('SPARSAID').endsWith(', yields.'), `${sAfter} / ${at('SPARSAID')}`);

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(4251);
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
const px = g.player.x;
const py = g.player.y;
const mine = (id: string, dx = 1, dy = 0): Creature => {
  const c = g.creatures.spawn(id, px + dx, py + dy, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.stance = 'passive';
  return c;
};
const wild = (id: string, dx = 1.5, dy = 0, health = 500): Creature => {
  const c = g.creatures.spawn(id, px + dx, py + dy, 'wild', g.rand, g.time - 3600 * 24 * 30);
  c.health = health;
  c.traits = [];
  c.rare = 0;
  return c;
};
const clear = (): void => { for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id); };
{
  const a = mine('gasha');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  const tamed = t.bleedRate > 0 && Math.abs(t.bleedUntil - g.time - KNIFE_BLEED_SECS) < 1e-9;
  t.bleedRate = 0;
  t.bleedUntil = 0;
  a.mode = 'wild';
  g.creatures.attack(g, a, t);
  check(`in the browser, a gasha's bite bleeds for ${KNIFE_BLEED_SECS} seconds, and a wild one's does not`, tamed && t.bleedRate === 0, `${t.bleedRate}`);
  clear();
}
{
  const a = mine('spitta');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  check('a spitta leaves venom', Math.abs(t.bleedRate / maxHealth(t, SPECIES[t.species]) - VENOM_DRAIN) < 1e-9 && Math.abs(t.bleedUntil - g.time - VENOM_SECS) < 1e-9, `${t.bleedRate}`);
  clear();
}
{
  const a = mine('thumpa');
  const t = wild('ulva', 1.5, 0, 5000);
  for (let n = 1; n < HEAVY_EVERY; n++) g.creatures.attack(g, a, t);
  const before = (t.stunUntil ?? 0) > g.time;
  g.creatures.attack(g, a, t);
  check(`a thumpa stuns on the last of every ${HEAVY_EVERY} blows`, !before && Math.abs((t.stunUntil ?? 0) - g.time - STUN_SECS) < 1e-9, `${before} ${t.stunUntil}`);
  clear();
}
{
  // Its blow over many, against the same blow of a kind with no style: the spread averages out.
  const mean = (id: string, target: string, setup?: (t: Creature, a: Creature) => void): number => {
    let sum = 0;
    for (let n = 0; n < 4000; n++) {
      const a = mine(id);
      const t = wild(target, 1.5, 0, 1e6);
      setup?.(t, a);
      g.creatures.attack(g, a, t);
      sum += 1e6 - t.health;
      clear();
    }
    return sum / 4000 / SPECIES[id].attack;
  };
  const hide = mean('awla', 'bura') / mean('awla', 'rabba');
  check(`an awla lands ${BODKIN_HIDE} as hard on a bura's hide as on a rabba`, Math.abs(hide - BODKIN_HIDE) < 0.04, hide.toFixed(3));
  const flank = mean('skulka', 'rabba', (t) => { t.enemy = -1; }) / mean('skulka', 'rabba', (t, a) => { t.brawl = a.id; });
  check(`a skulka lands ${BLINDSIDE} as hard on one after you as on one fighting it`, Math.abs(flank - BLINDSIDE) < 0.04, flank.toFixed(3));
}
{
  const a = mine('testa', 0, 0);
  const near = [wild('ulva', 1, 0), wild('ulva', 0, 2)];
  const far = wild('ulva', GUARD_RANGE + 3, 0);
  for (const o of [...near, far]) o.enemy = -1;
  g.creatures.attack(g, a, near[0]);
  check(`a testa's blow turns the hunters after you within ${GUARD_RANGE} tiles onto it, and not one further off`,
    near.every((o) => o.brawl === a.id) && far.brawl === null, [...near, far].map((o) => o.brawl).join(','));
  clear();
}
{
  const ATTACK = ACTION_BY_ID.get('attack_creature')!;
  const s = mine('sparra', 0.6, 0);
  const other = mine('gasha', 0, 0.6);
  const target = (c: Creature) => ({ kind: 'creature' as const, id: c.id });
  check('a sparra of yours may be sparred with, and is offered as Spar; another of yours may not be attacked',
    ATTACK.applies(target(s), g) && ATTACK.labelFor?.(target(s), g) === 'Spar' && ATTACK.check?.(target(s), g) === null
    && !ATTACK.applies(target(other), g) && ATTACK.check?.(target(other), g)?.startsWith('Tame: release it first') === true);
  const before = g.skills.get('fighting') ?? 0;
  for (let n = 0; n < 300 && ATTACK.check?.(target(s), g) === null; n++) ATTACK.perform(target(s), g);
  const top = maxHealth(s, SPECIES.sparra);
  check(`sparred with, it goes no lower than ${SPAR_YIELD} of its health and has yielded, and the swings teach fighting`,
    s.health >= top * SPAR_YIELD && s.health <= top * SPAR_YIELD + SPAR_SLACK && g.creatures.list.has(s.id) && (g.skills.get('fighting') ?? 0) > before
    && ATTACK.check?.(target(s), g)?.endsWith('has yielded: wait.') === true,
    `${s.health} of ${top}, ${ATTACK.check?.(target(s), g)}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nseven that fight — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

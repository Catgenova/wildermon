/**
 * Abilities on a cooldown.
 *
 * Asked for off a list of combat wildermon, each with an ability it uses on a
 * cooldown. This asks, of both sides, that each of the seventeen uses its
 * fighting trade's spell -- or a frost breath -- at that spell's numbers, the
 * first time it strikes and not again until its rest is out, and that a wild
 * one of its kind does not.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { abilityFx, abilityRest, COMPANION_REACH, FROST_BREATH_REST, maxHealth, markOn, SPECIES, WARD_SKIN, type AbilityId, type Creature } from '../../src/game/creatures';
import { FROST_PACE } from '../../src/game/enchant';
import { CLASS_SPELL_BY_ID } from '../../src/game/talents';
import { TileType } from '../../src/world/tiles';

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

const KINDS: Array<[string, AbilityId]> = [
  ['lungra', 'beastmaster_pounce'], ['hamma', 'blade_hamstring'], ['crakka', 'berserker_skull_crack'], ['bashka', 'blade_shield_bash'],
  ['executa', 'berserker_execute'], ['whirla', 'berserker_whirlwind'], ['scorcha', 'kindler_scorch'], ['frosta', 'frost_breath'],
  ['rootle', 'binder_root'], ['dulla', 'binder_dull_claws'], ['brittla', 'binder_brittle'], ['shova', 'pikeman_keep_away'],
  ['howla', 'blade_guardians_call'], ['marka', 'skirmisher_marked_for_death'], ['wardo', 'warder_ward'], ['stona', 'warder_stoneskin'],
  ['leecha', 'chirurgeon_leech'],
];
const f = abilityFx;

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000e7';
// One of yours of a kind, beside a wild ulva with health to spare.
const pair = (kind: string, dx = 1): string => `
  a := creature_spawn(w, '${kind}', 16.5, 16.5, 'active', now() - interval '30 days', u);
  t := creature_spawn(w, 'ulva', 16.5 + ${dx}, 16.5, 'wild', now() - interval '30 days', null);
  update creature set health = 5000 where world_id = w and id = t;`;
// Creature ids are handed out again once the last is gone, so the marks go with them.
const tidy = `delete from creature where world_id = w; delete from class_mark where world_id = w;`;
const ready = (key: string): string =>
  `insert into said select '${key}', coalesce(round(extract(epoch from until - now())::numeric)::text, '-') from class_mark where world_id = w and creature_id = a and kind = 'ability';`;
const mark = (key: string, kind: string, on = 't'): string =>
  `insert into said select '${key}', coalesce((select round(val::numeric, 4) || '|' || round(extract(epoch from until - now())::numeric) from class_mark where world_id = w and creature_id = ${on} and kind = '${kind}' and until > now()), '-');`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; a int; t int; t2 int; t3 int; c creature; q creature; v_h double precision; v_died boolean;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Abilities', 175, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 14.5, y = 14.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into said select 'AB:' || s.id, coalesce(s.ability, '-') || '|' || coalesce(ability_rest(s.ability)::text, '-')
    from species_def s where s.id in (${KINDS.map(([id]) => `'${id}'`).join(', ')});

  -- Lungra: three tiles off, a pounce.
  ${pair('lungra', 3)}
  select * into c from creature where world_id = w and id = a;
  select * into q from creature where world_id = w and id = t;
  insert into said values ('POUNCE', beast_pounce(w, c, q, 3)::text);
  select * into c from creature where world_id = w and id = a;
  select * into q from creature where world_id = w and id = t;
  insert into said values ('POUNCED', round(sqrt((c.to_x - creature_x(q)) ^ 2 + (c.to_y - creature_y(q)) ^ 2)::numeric, 2) || '|' || (q.health < 5000)::text
    || '|' || round(extract(epoch from q.until - now())::numeric, 1) || '|' || beast_pounce(w, c, q, 3)::text);
  ${ready('POUNCEREADY')}
  ${tidy}

  -- Hamma: slowed.
  ${pair('hamma')}
  perform creature_attack(w, a, t);
  insert into said select 'HAMSTRING', round(slow::numeric, 2) || '|' || round(extract(epoch from slow_until - now())::numeric) from creature where world_id = w and id = t;
  ${ready('HAMREADY')}
  -- And not again until its rest is out: the next is a plain blow.
  update creature set slow = null, slow_until = null where world_id = w and id = t;
  perform creature_attack(w, a, t);
  insert into said select 'HAMAGAIN', coalesce(slow::text, '-') from creature where world_id = w and id = t;
  ${tidy}

  -- Crakka: held.
  ${pair('crakka')}
  perform creature_attack(w, a, t);
  ${mark('HOLD', 'hold')}
  ${tidy}

  -- Bashka: its next blow put back.
  ${pair('bashka')}
  update creature set until = now(), windup_at = now() where world_id = w and id = t;
  perform creature_attack(w, a, t);
  insert into said select 'BASH', round(extract(epoch from until - now())::numeric) || '|' || (windup_at is null)::text from creature where world_id = w and id = t;
  ${tidy}

  -- Executa: nothing at full health; the blow below its line.
  ${pair('executa')}
  perform creature_attack(w, a, t);
  ${ready('EXECFULL')}
  update creature set health = max_health(creature) * ${f('berserker_execute', 'low') / 2} where world_id = w and id = t;
  perform creature_attack(w, a, t);
  ${ready('EXECLOW')}
  ${tidy}

  -- Whirla: two beside it, one further off.
  ${pair('whirla')}
  t2 := creature_spawn(w, 'ulva', 16.5, 17.5, 'wild', now() - interval '30 days', null);
  t3 := creature_spawn(w, 'ulva', 16.5 + ${f('berserker_whirlwind', 'reach')} + 2, 16.5, 'wild', now() - interval '30 days', null);
  update creature set health = 5000 where world_id = w and id in (t2, t3);
  perform creature_attack(w, a, t);
  insert into said select 'WHIRL', string_agg((health < 5000)::text, ',' order by id) from creature where world_id = w and id in (t, t2, t3);
  ${tidy}

  -- Scorcha: burning.
  ${pair('scorcha')}
  perform creature_attack(w, a, t);
  select * into q from creature where world_id = w and id = t;
  insert into said values ('SCORCH', round((q.bleed_rate / max_health(q))::numeric, 4) || '|' || round(extract(epoch from q.bleed_until - now())::numeric));
  ${tidy}

  -- Frosta: slowed as a Frostbite slows.
  ${pair('frosta')}
  perform creature_attack(w, a, t);
  insert into said select 'FROST', round(slow::numeric, 2)::text from creature where world_id = w and id = t;
  ${ready('FROSTREADY')}
  ${tidy}

  -- Rootle, Dulla, Brittla, Marka: a mark, and no blow.
${(['rootle:root', 'dulla:dull', 'brittla:brittle', 'marka:marked'] as const).map((s) => {
  const [k, m] = s.split(':');
  return `  ${pair(k)}
  perform creature_attack(w, a, t);
  ${mark(`MARK:${k}`, m)}
  insert into said select 'UNHURT:${k}', (health = 5000)::text from creature where world_id = w and id = t;
  ${tidy}`;
}).join('\n')}

  -- Shova: a keep-away on it, and the blow that comes with it pushes the ulva off.
  ${pair('shova')}
  select * into q from creature where world_id = w and id = t;
  v_h := sqrt((creature_x(q) - 16.5) ^ 2 + (creature_y(q) - 16.5) ^ 2);
  perform creature_attack(w, a, t);
  ${mark('KEEPAWAY', 'keep_away', 'a')}
  select * into q from creature where world_id = w and id = t;
  insert into said values ('PUSHED', round((sqrt((q.to_x - 16.5) ^ 2 + (q.to_y - 16.5) ^ 2) - v_h)::numeric, 2)::text);
  ${tidy}

  -- Howla: two after you near it turn on it, and stay on it.
  ${pair('howla')}
  t2 := creature_spawn(w, 'ulva', 16.5, 18, 'wild', now() - interval '30 days', null);
  update creature set hunting = u where world_id = w and id in (t, t2);
  perform creature_attack(w, a, t);
  insert into said select 'CALL', string_agg((brawl = a)::text || ':' || round(extract(epoch from threat_at - now())::numeric), ',' order by id) from creature where world_id = w and id in (t, t2);
  ${tidy}

  -- Wardo: a skin over you, which then takes a blow.
  ${pair('wardo')}
  perform creature_attack(w, a, t);
  insert into said select 'WARD', coalesce(stats->>'aegis', '-') from player where world_id = w and uid = u;
  ${tidy}

  -- Stona: a stone skin on itself.
  ${pair('stona')}
  perform creature_attack(w, a, t);
  ${mark('STONE', 'stone', 'a')}
  insert into said values ('STONETAKEN', round(class_brittle(w, a)::numeric, 4)::text);
  ${tidy}

  -- Leecha: some of its health back.
  ${pair('leecha')}
  update creature set health = max_health(creature) / 2 where world_id = w and id = a;
  select health into v_h from creature where world_id = w and id = a;
  perform creature_attack(w, a, t);
  insert into said select 'LEECH', (health > v_h)::text from creature where world_id = w and id = a;
  ${tidy}

  -- A wild hamma does nothing of the kind.
  a := creature_spawn(w, 'hamma', 16.5, 16.5, 'wild', now() - interval '30 days', null);
  t := creature_spawn(w, 'gasha', 17.5, 16.5, 'active', now() - interval '30 days', u);
  update creature set health = 5000 where world_id = w and id = t;
  perform creature_attack(w, a, t);
  insert into said select 'WILD', coalesce(slow::text, '-') from creature where world_id = w and id = t;
  ${ready('WILDREADY')}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the species --------------------------------------------------------------------- */

for (const [id, ab] of KINDS) {
  const rest = abilityRest(ab);
  check(`a ${id} uses ${ab} once every ${rest} seconds on both sides`,
    SPECIES[id]?.ability === ab && at(`AB:${id}`) === `${ab}|${rest}` && rest === (ab === 'frost_breath' ? FROST_BREATH_REST : CLASS_SPELL_BY_ID.get(ab)?.rest), at(`AB:${id}`));
  check(`a ${id}'s description is filled in`, !!SPECIES[id] && !/[{}]/.test(SPECIES[id].description) && SPECIES[id].description.includes(`once every ${rest} seconds`), SPECIES[id]?.description);
}

/* ---- on the island ----------------------------------------------------------------- */

const [pd, ph, pback, again] = at('POUNCED').split('|');
check(`on the island, a lungra pounces from 3 tiles, lands within its reach, strikes and puts the next blow back ${f('beastmaster_pounce', 'back')} s`,
  at('POUNCE') === 'true' && Number(pd) <= COMPANION_REACH && ph === 'true' && Number(pback) >= f('beastmaster_pounce', 'back') - 0.05 && again === 'false', `${at('POUNCE')} ${at('POUNCED')}`);
check(`and not again for ${abilityRest('beastmaster_pounce')} seconds`, at('POUNCEREADY') === String(abilityRest('beastmaster_pounce')), at('POUNCEREADY'));
check(`a hamma slows what it strikes to ${f('blade_hamstring', 'pace')} for ${f('blade_hamstring', 'secs')} s`, at('HAMSTRING') === `${f('blade_hamstring', 'pace').toFixed(2)}|${f('blade_hamstring', 'secs')}`, at('HAMSTRING'));
check(`and its next blow inside its rest is a plain one`, at('HAMREADY') === String(abilityRest('blade_hamstring')) && at('HAMAGAIN') === '-', `${at('HAMREADY')} ${at('HAMAGAIN')}`);
check(`a crakka holds it for ${f('berserker_skull_crack', 'hold')} s`, at('HOLD').endsWith(`|${f('berserker_skull_crack', 'hold')}`), at('HOLD'));
check(`a bashka puts its next blow back ${f('blade_shield_bash', 'back')} s and knocks off its stroke`, at('BASH') === `${f('blade_shield_bash', 'back')}|true`, at('BASH'));
check(`an executa holds its blow at full health and lands it below ${f('berserker_execute', 'low')}`, at('EXECFULL') === '(not said)' && at('EXECLOW') === String(abilityRest('berserker_execute')), `${at('EXECFULL')} ${at('EXECLOW')}`);
check(`a whirla strikes both within ${f('berserker_whirlwind', 'reach')} tiles and not the one further off`, at('WHIRL') === 'true,true,false', at('WHIRL'));
check(`a scorcha sets it burning at ${f('kindler_scorch', 'each')} a second for ${f('kindler_scorch', 'secs')} s`, at('SCORCH') === `${f('kindler_scorch', 'each').toFixed(4)}|${f('kindler_scorch', 'secs')}`, at('SCORCH'));
check(`a frosta leaves it at ${FROST_PACE} of its pace, once every ${FROST_BREATH_REST} s`, at('FROST') === FROST_PACE.toFixed(2) && at('FROSTREADY') === String(FROST_BREATH_REST), `${at('FROST')} ${at('FROSTREADY')}`);
const marks: Array<[string, AbilityId, string, number]> = [
  ['rootle', 'binder_root', 'root', 0], ['dulla', 'binder_dull_claws', 'dull', f('binder_dull_claws', 'dealt')],
  ['brittla', 'binder_brittle', 'brittle', f('binder_brittle', 'taken')], ['marka', 'skirmisher_marked_for_death', 'marked', f('skirmisher_marked_for_death', 'crit')],
];
for (const [k, ab, m, val] of marks) {
  check(`a ${k} puts ${m} on it at ${val} for ${f(ab, 'secs')} s, and does not strike that go`,
    at(`MARK:${k}`) === `${val.toFixed(4)}|${f(ab, 'secs')}` && at(`UNHURT:${k}`) === 'true', `${at(`MARK:${k}`)} ${at(`UNHURT:${k}`)}`);
}
check(`a shova takes up a keep-away for ${f('pikeman_keep_away', 'secs')} s and its blow pushes the ulva ${f('pikeman_keep_away', 'push')} tile off`,
  at('KEEPAWAY') === `${f('pikeman_keep_away', 'push').toFixed(4)}|${f('pikeman_keep_away', 'secs')}` && Math.abs(Number(at('PUSHED')) - f('pikeman_keep_away', 'push')) < 0.05, `${at('KEEPAWAY')} ${at('PUSHED')}`);
check(`a howla turns both hunters after you onto it, held for ${f('blade_guardians_call', 'secs')} s`,
  at('CALL').split(',').every((x) => x.startsWith('true:') && Number(x.split(':')[1]) >= f('blade_guardians_call', 'secs') - 3 - 1), at('CALL'));
check(`a wardo lays a skin of ${WARD_SKIN} over you`, Number(at('WARD')) === WARD_SKIN, at('WARD'));
check(`a stona takes ${f('warder_stoneskin', 'cut')} less for ${f('warder_stoneskin', 'secs')} s`,
  at('STONE') === `${(1 - f('warder_stoneskin', 'cut')).toFixed(4)}|${f('warder_stoneskin', 'secs')}` && at('STONETAKEN') === (1 - f('warder_stoneskin', 'cut')).toFixed(4), `${at('STONE')} ${at('STONETAKEN')}`);
check('a leecha gets some of its health back', at('LEECH') === 'true', at('LEECH'));
check('a wild hamma uses no ability', at('WILD') === '-' && at('WILDREADY') === '(not said)', `${at('WILD')} ${at('WILDREADY')}`);

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(4252);
// Open, level grass round the player, so nothing stands in the way of a leap or a shove.
for (let y = 10; y <= 30; y++) for (let x = 10; x <= 30; x++) { g.world.setHeight(x, y, 4); g.world.setDirt(x, y, 3); }
for (let y = 10; y <= 29; y++) for (let x = 10; x <= 29; x++) g.world.setTile(x, y, TileType.Grass, 0);
g.player.x = 15.5;
g.player.y = 20.5;
const cr = g.creatures as unknown as { pounce: (g: Game, c: Creature, e: Creature, d: number) => boolean };
const clear = (): void => { for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id); };
clear();
const px = g.player.x;
const py = g.player.y;
const mine = (id: string): Creature => {
  const c = g.creatures.spawn(id, px + 2, py, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.stance = 'passive';
  return c;
};
const wild = (id: string, dx = 1, dy = 0, health = 5000): Creature => {
  const c = g.creatures.spawn(id, px + 2 + dx, py + dy, 'wild', g.rand, g.time - 3600 * 24 * 30);
  c.health = health;
  return c;
};
const near = (x: number, y: number): boolean => Math.abs(x - y) < 1e-6;
{
  const a = mine('lungra');
  const t = wild('ulva', 3);
  t.cooldown = 0;
  const went = cr.pounce(g, a, t, 3);
  check(`in the browser, a lungra pounces from 3 tiles, lands within its reach, strikes and puts the next blow back`,
    went && Math.hypot(a.x - t.x, a.y - t.y) <= COMPANION_REACH && t.health < 5000 && near(t.cooldown, f('beastmaster_pounce', 'back')) && !cr.pounce(g, a, t, 3));
  clear();
}
{
  const a = mine('hamma');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  const first = t.slowPace === f('blade_hamstring', 'pace') && near((t.slowUntil ?? 0) - g.time, f('blade_hamstring', 'secs'));
  t.slowPace = undefined;
  t.slowUntil = undefined;
  g.creatures.attack(g, a, t);
  check('a hamma slows it, and its next blow inside its rest is a plain one', first && t.slowPace === undefined);
  clear();
}
{
  const a = mine('crakka');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  check(`a crakka holds it for ${f('berserker_skull_crack', 'hold')} s`, near((t.stunUntil ?? 0) - g.time, f('berserker_skull_crack', 'hold')));
  clear();
}
{
  const a = mine('bashka');
  const t = wild('ulva');
  t.cooldown = 0;
  t.windup = 1;
  g.creatures.attack(g, a, t);
  check('a bashka puts its next blow back and knocks off its stroke', near(t.cooldown, f('blade_shield_bash', 'back')) && t.windup === 0);
  clear();
}
{
  const a = mine('executa');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  const full = markOn(g, a, 'ability', 0) === 0;
  t.health = maxHealth(t, SPECIES.ulva) * f('berserker_execute', 'low') / 2;
  g.creatures.attack(g, a, t);
  check('an executa holds its blow at full health and lands it below its line', full && markOn(g, a, 'ability', 0) > 0);
  clear();
}
{
  const a = mine('whirla');
  const ts = [wild('ulva'), wild('ulva', 0, 1), wild('ulva', f('berserker_whirlwind', 'reach') + 2)];
  g.creatures.attack(g, a, ts[0]);
  check('a whirla strikes both beside it and not the one further off', ts.map((t) => t.health < 5000).join(',') === 'true,true,false');
  clear();
}
{
  const a = mine('scorcha');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  check('a scorcha sets it burning', near(t.bleedRate / maxHealth(t, SPECIES.ulva), f('kindler_scorch', 'each')) && near(t.bleedUntil - g.time, f('kindler_scorch', 'secs')));
  clear();
}
{
  const a = mine('frosta');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  check('a frosta slows it as a Frostbite does', t.slowPace === FROST_PACE && near(markOn(g, a, 'ability', 0) && (a.marks!.ability!.until - g.time), FROST_BREATH_REST));
  clear();
}
for (const [k, ab, m, val] of marks) {
  const a = mine(k);
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  const kind = m as 'root' | 'dull' | 'brittle' | 'marked';
  check(`a ${k} puts ${m} on it and does not strike that go`, near(t.marks?.[kind]?.val ?? -1, kind === 'root' ? 1 : val)
    && near((t.marks?.[kind]?.until ?? 0) - g.time, f(ab, 'secs')) && t.health === 5000);
  clear();
}
{
  const a = mine('rootle');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  const [x, y] = [t.x, t.y];
  t.enemy = -1;
  for (let i = 0; i < 20; i++) g.creatures.update(0.1, g);
  check('and a rooted thing stays where it is', t.x === x && t.y === y, `${t.x - x}`);
  clear();
}
{
  const a = mine('shova');
  const t = wild('ulva');
  const was = Math.hypot(t.x - a.x, t.y - a.y);
  g.creatures.attack(g, a, t);
  check('a shova takes up a keep-away and its blow pushes the ulva off', near(markOn(g, a, 'keep_away', 0), f('pikeman_keep_away', 'push'))
    && Math.abs(Math.hypot(t.x - a.x, t.y - a.y) - was - f('pikeman_keep_away', 'push')) < 0.05);
  clear();
}
{
  const a = mine('howla');
  const ts = [wild('ulva'), wild('ulva', 0, 1.5)];
  for (const t of ts) t.enemy = -1;
  g.creatures.attack(g, a, ts[0]);
  check('a howla turns both hunters after you onto it', ts.every((t) => t.brawl === a.id && t.threatAt > g.time));
  clear();
}
{
  g.player.skin = { size: 0, mine: false, by: null };
  const a = mine('wardo');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  const laid = g.player.skin.size === WARD_SKIN;
  const health = g.player.stats.health;
  g.hurtPlayer(WARD_SKIN / 2, 'A test blow');
  check(`a wardo lays a skin of ${WARD_SKIN} over you, which takes a blow smaller than it`, laid && g.player.stats.health === health && near(g.player.skin.size, WARD_SKIN / 2));
  clear();
}
{
  const a = mine('stona');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  const before = a.health;
  g.creatures.hurt(g, a, 4, t);
  check('a stona takes less inside its stone skin', near(markOn(g, a, 'stone'), 1 - f('warder_stoneskin', 'cut')) && before - a.health < 4);
  clear();
}
{
  const a = mine('leecha');
  a.health = maxHealth(a, SPECIES.leecha) / 2;
  const before = a.health;
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  check('a leecha gets some of its health back', a.health > before);
  clear();
}
{
  const a = g.creatures.spawn('hamma', px + 2, py, 'wild', g.rand, g.time - 3600 * 24 * 30);
  const t = mine('gasha');
  t.x = px + 3;
  t.health = 5000;
  g.creatures.attack(g, a, t);
  check('a wild hamma uses no ability', t.slowPace === undefined && markOn(g, a, 'ability', 0) === 0);
  clear();
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nabilities on a cooldown — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

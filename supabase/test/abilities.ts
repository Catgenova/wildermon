/**
 * Abilities on a cooldown.
 *
 * Asked for off a list of combat wildermon, each with an ability it uses on a
 * cooldown. This asks, of both sides, that each of the two that keep one (a
 * lungra, a stona) uses its fighting trade's spell at that spell's numbers,
 * the first time it strikes and not again until its rest is out, and that a
 * wild one of its kind does not. The hamma, bashka, executa, shova, howla,
 * marka and wardo are gone from the game (What's new 405, `repurpose.ts`), the brittla (What's new 503) and the rootle
 * (What's new 511). The six that took up a settlement task have none: a crakka holds nothing, a whirla strikes only what
 * it strikes, a scorcha burns nothing, a frosta slows nothing, a dulla puts no mark on it, and a leecha gets nothing back.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { Game } from '../../src/game/game';
import { REMOVED_KINDS, abilityFx, abilityRest, COMPANION_REACH, FROST_BREATH_REST, maxHealth, markOn, SPECIES, type AbilityId, type Creature } from '../../src/game/creatures';
import { CLASS_SPELL_BY_ID } from '../../src/game/talents';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const KINDS: Array<[string, AbilityId]> = [['lungra', 'beastmaster_pounce'], ['stona', 'warder_stoneskin']];
/** The seven with an ability that are gone from the game, and the ability each had. */
const GONE: Array<[string, AbilityId]> = [
  ['hamma', 'blade_hamstring'], ['bashka', 'blade_shield_bash'], ['executa', 'berserker_execute'], ['shova', 'pikeman_keep_away'],
  ['howla', 'blade_guardians_call'], ['marka', 'skirmisher_marked_for_death'], ['wardo', 'warder_ward'],
];
/** The six that had an ability until they took up a settlement task, and the ability each had (the brittla's and the rootle's gone). */
const RETIRED: Array<[string, AbilityId]> = [
  ['crakka', 'berserker_skull_crack'], ['whirla', 'berserker_whirlwind'], ['scorcha', 'kindler_scorch'], ['frosta', 'frost_breath'],
  ['dulla', 'binder_dull_claws'], ['leecha', 'chirurgeon_leech'],
];
const f = abilityFx;
const listedAbilities = (): string => GONE.map(([, ab]) => ab).join(', ');

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000e7';
// One of yours of a kind, beside a wild ulva with health to spare.
const pair = (kind: string, dx = 1): string => `
  a := creature_spawn(w, '${kind}', 16.5, 16.5, 'active', now() - interval '60 days', u);
  t := creature_spawn(w, 'ulva', 16.5 + ${dx}, 16.5, 'wild', now() - interval '60 days', null);
  -- No blood and no rarity, which would lift its rest and what it does (\`cooldown\`, \`fear\`).
  update creature set traits = '{}', rare = null where world_id = w and id in (a, t);
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
    from species_def s where s.id in (${[...KINDS, ...RETIRED].map(([id]) => `'${id}'`).join(', ')});
  insert into said select 'GONE', count(*)::text from species_def s where s.id in (${GONE.map(([id]) => `'${id}'`).join(', ')});

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

  -- Crakka: nothing held.
  ${pair('crakka')}
  perform creature_attack(w, a, t);
  ${mark('HOLD', 'hold')}
  ${ready('HOLDREADY')}
  ${tidy}

  -- Whirla: two beside it, one further off; only the one it strikes is struck.
  ${pair('whirla')}
  t2 := creature_spawn(w, 'ulva', 16.5, 17.5, 'wild', now() - interval '60 days', null);
  t3 := creature_spawn(w, 'ulva', 16.5 + ${f('berserker_whirlwind', 'reach')} + 2, 16.5, 'wild', now() - interval '60 days', null);
  update creature set health = 5000 where world_id = w and id in (t2, t3);
  perform creature_attack(w, a, t);
  insert into said select 'WHIRL', string_agg((health < 5000)::text, ',' order by id) from creature where world_id = w and id in (t, t2, t3);
  ${tidy}

  -- Scorcha: nothing burning.
  ${pair('scorcha')}
  perform creature_attack(w, a, t);
  select * into q from creature where world_id = w and id = t;
  insert into said values ('SCORCH', coalesce(round((q.bleed_rate / max_health(q))::numeric, 4) || '|' || round(extract(epoch from q.bleed_until - now())::numeric), '-'));
  ${tidy}

  -- Frosta: nothing slowed.
  ${pair('frosta')}
  perform creature_attack(w, a, t);
  insert into said select 'FROST', coalesce(round(slow::numeric, 2)::text, '-') from creature where world_id = w and id = t;
  ${ready('FROSTREADY')}
  ${tidy}

  -- Dulla: no mark.
${(['dulla:dull'] as const).map((s) => {
  const [k, m] = s.split(':');
  return `  ${pair(k)}
  perform creature_attack(w, a, t);
  ${mark(`MARK:${k}`, m)}
  insert into said select 'UNHURT:${k}', (health = 5000)::text from creature where world_id = w and id = t;
  ${tidy}`;
}).join('\n')}

  -- Stona: a stone skin on itself.
  ${pair('stona')}
  perform creature_attack(w, a, t);
  ${mark('STONE', 'stone', 'a')}
  insert into said values ('STONETAKEN', round(class_brittle(w, a)::numeric, 4)::text);
  ${tidy}

  -- Leecha: none of its health back.
  ${pair('leecha')}
  update creature set health = max_health(creature) / 2 where world_id = w and id = a;
  select health into v_h from creature where world_id = w and id = a;
  perform creature_attack(w, a, t);
  insert into said select 'LEECH', (health > v_h)::text from creature where world_id = w and id = a;
  ${tidy}

  -- A wild stona does nothing of the kind.
  a := creature_spawn(w, 'stona', 16.5, 16.5, 'wild', now() - interval '60 days', null);
  t := creature_spawn(w, 'thumpa', 17.5, 16.5, 'active', now() - interval '60 days', u);
  update creature set health = 5000 where world_id = w and id = t;
  perform creature_attack(w, a, t);
  ${mark('WILD', 'stone', 'a')}
  ${ready('WILDREADY')}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the species --------------------------------------------------------------------- */

check(`the ${GONE.length} that had ${listedAbilities()} are gone from both sides`,
  GONE.every(([id]) => !SPECIES[id] && !!REMOVED_KINDS[id]) && at('GONE') === '0', at('GONE'));
for (const [id, ab] of RETIRED) {
  check(`a ${id} has no ability on either side (it had ${ab})`, !SPECIES[id]?.ability && at(`AB:${id}`) === '-|-' && !SPECIES[id].description.includes('cooldown'), at(`AB:${id}`));
}
for (const [id, ab] of KINDS) {
  const rest = abilityRest(ab);
  check(`a ${id} uses ${ab} once every ${rest} seconds on both sides`,
    SPECIES[id]?.ability === ab && at(`AB:${id}`) === `${ab}|${rest}` && rest === (ab === 'frost_breath' ? FROST_BREATH_REST : CLASS_SPELL_BY_ID.get(ab)?.rest), at(`AB:${id}`));
  check(`a ${id}'s description is filled in`, !!SPECIES[id] && !/[{}]/.test(SPECIES[id].description) && SPECIES[id].description.includes(`cooldown ${rest} seconds`), SPECIES[id]?.description);
}

/* ---- on the island ----------------------------------------------------------------- */

const [pd, ph, pback, again] = at('POUNCED').split('|');
check(`on the island, a lungra pounces from 3 tiles, lands within its reach, strikes and puts the next blow back ${f('beastmaster_pounce', 'back')} s`,
  at('POUNCE') === 'true' && Number(pd) <= COMPANION_REACH && ph === 'true' && Number(pback) >= f('beastmaster_pounce', 'back') - 0.05 && again === 'false', `${at('POUNCE')} ${at('POUNCED')}`);
check(`and not again for ${abilityRest('beastmaster_pounce')} seconds`, at('POUNCEREADY') === String(abilityRest('beastmaster_pounce')), at('POUNCEREADY'));
check('a crakka holds nothing, and has no ability to rest from', at('HOLD') === '-' && at('HOLDREADY') === '(not said)', `${at('HOLD')} ${at('HOLDREADY')}`);
check('a whirla strikes only what it strikes, not the one beside it', at('WHIRL').endsWith(',false,false'), at('WHIRL'));
check('a scorcha sets nothing burning', at('SCORCH') === '-', at('SCORCH'));
check('a frosta slows nothing, and has no ability to rest from', at('FROST') === '-' && at('FROSTREADY') === '(not said)', `${at('FROST')} ${at('FROSTREADY')}`);
const marks: Array<[string, AbilityId, string, number]> = [
  ['dulla', 'binder_dull_claws', 'dull', f('binder_dull_claws', 'dealt')],
];
for (const [k, ab, m, val] of marks) {
  if (RETIRED.some(([id]) => id === k)) {
    check(`a ${k} puts no ${m} on it`, at(`MARK:${k}`) === '-', at(`MARK:${k}`));
    continue;
  }
  check(`a ${k} puts ${m} on it at ${val} for ${f(ab, 'secs')} s, and does not strike that go`,
    at(`MARK:${k}`) === `${val.toFixed(4)}|${f(ab, 'secs')}` && at(`UNHURT:${k}`) === 'true', `${at(`MARK:${k}`)} ${at(`UNHURT:${k}`)}`);
}
check(`a stona takes ${f('warder_stoneskin', 'cut')} less for ${f('warder_stoneskin', 'secs')} s`,
  at('STONE') === `${(1 - f('warder_stoneskin', 'cut')).toFixed(4)}|${f('warder_stoneskin', 'secs')}` && at('STONETAKEN') === (1 - f('warder_stoneskin', 'cut')).toFixed(4), `${at('STONE')} ${at('STONETAKEN')}`);
check('a leecha gets none of its health back', at('LEECH') === 'false', at('LEECH'));
check('a wild stona uses no ability', at('WILD') === '-' && at('WILDREADY') === '(not said)', `${at('WILD')} ${at('WILDREADY')}`);

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
  c.traits = [];
  c.rare = 0;
  return c;
};
const wild = (id: string, dx = 1, dy = 0, health = 5000): Creature => {
  const c = g.creatures.spawn(id, px + 2 + dx, py + dy, 'wild', g.rand, g.time - 3600 * 24 * 30);
  c.health = health;
  c.traits = [];
  c.rare = 0;
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
  const a = mine('crakka');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  check('in the browser, a crakka holds nothing', (t.stunUntil ?? 0) <= g.time && markOn(g, a, 'ability', 0) === 0);
  clear();
}
{
  const a = mine('whirla');
  const ts = [wild('ulva'), wild('ulva', 0, 1), wild('ulva', f('berserker_whirlwind', 'reach') + 2)];
  g.creatures.attack(g, a, ts[0]);
  check('in the browser, a whirla strikes only what it strikes, not the one beside it', ts.slice(1).every((t) => t.health === 5000));
  clear();
}
{
  const a = mine('scorcha');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  check('in the browser, a scorcha sets nothing burning', !(t.bleedUntil > g.time && t.bleedRate > 0));
  clear();
}
{
  const a = mine('frosta');
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  check('in the browser, a frosta slows nothing', t.slowPace === undefined && markOn(g, a, 'ability', 0) === 0);
  clear();
}
for (const [k, ab, m, val] of marks) {
  const a = mine(k);
  const t = wild('ulva');
  g.creatures.attack(g, a, t);
  const kind = m as 'root' | 'dull' | 'brittle' | 'marked';
  if (RETIRED.some(([id]) => id === k)) {
    check(`in the browser, a ${k} puts no ${m} on it`, !t.marks?.[kind]);
    clear();
    continue;
  }
  check(`a ${k} puts ${m} on it and does not strike that go`, near(t.marks?.[kind]?.val ?? -1, kind === 'root' ? 1 : val)
    && near((t.marks?.[kind]?.until ?? 0) - g.time, f(ab, 'secs')) && t.health === 5000);
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
  check('in the browser, a leecha gets none of its health back', a.health <= before);
  clear();
}
{
  const a = g.creatures.spawn('stona', px + 2, py, 'wild', g.rand, g.time - 3600 * 24 * 30);
  const t = mine('thumpa');
  t.x = px + 3;
  t.health = 5000;
  g.creatures.attack(g, a, t);
  check('a wild stona uses no ability', markOn(g, a, 'stone', 0) === 0 && markOn(g, a, 'ability', 0) === 0);
  clear();
}

finish('abilities on a cooldown');

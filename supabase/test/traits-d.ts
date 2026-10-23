/**
 * Six traits for a fight, on six channels of their own (part D).
 *
 * Asked for: venom-proof (rare, venom damage ×0), quick-clotting (four grades, bleed ×0.8 at common), fearless (rare,
 * immune to a Whispet's Fear), crushing (four grades, +3 points at common on the chance a blow lands as a heavy blow:
 * wildermon have no critical hit), ripping (four grades, +5 points at common on the chance a blow bleeds) and
 * quick-recovering (rare, ability cooldown ×0.85). This asks, of both sides:
 *
 *   * that every one of them is on the table at its tier, its grades named as every fighting family's are, and that
 *     its card says the same on both sides, word for word, off its channels;
 *   * that each comes up in the wild's rolls at its tier, on both sides;
 *   * that each channel changes its rule by the same number on both sides: the venom a bite or a weapon leaves
 *     (`venom`, `enchant_venom`), what a bleed takes a second (`body`, `creature_settle`), how long a Fear makes it run
 *     (`ability`, `beast_ability`), an ability's rest (`abilityRestOf`, `beast_ability`), and the chances a blow lands
 *     heavy or bleeds (`chance`, `beast_chance`, `attack`, `creature_attack`), each counted over a few hundred blows.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { abilityFx, abilityRest, attackOf, maxHealth, SPECIES, type Creature } from '../../src/game/creatures';
import { venom } from '../../src/game/enchanting';
import { HEAVY_HIT, KNIFE_BLEED, VENOM_DRAIN } from '../../src/game/fight';
import { CHANNEL_BY_ID, FIGHTING, gradeId, rollTrait, TIERS, traitOf, traitSays, type TraitChannel, type TraitTier } from '../../src/game/traits';

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

/** The plain traits and the fighting families of part D, and what each was asked to be. */
const PLAIN: Array<[string, TraitTier, TraitChannel, number]> = [
  ['venom_proof', 'rare', 'venom', 0],
  ['fearless', 'rare', 'fear', 0],
  ['quick_recovering', 'rare', 'cooldown', 0.85],
];
const FAMILIES: Array<[string, TraitChannel, number]> = [
  ['quick_clotting', 'bleed', 0.8],
  ['crushing', 'heavy', 1.03],
  ['ripping', 'rip', 1.05],
];
const IDS = [...PLAIN.map(([id]) => id), ...FAMILIES.flatMap(([f]) => TIERS.map((t) => gradeId(f, t)))];
const CHANNELS_D: TraitChannel[] = ['venom', 'bleed', 'fear', 'heavy', 'rip', 'cooldown'];
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const arr = (a: string[]): string => `array[${a.map(q).join(', ')}]::text[]`;
const BLOWS = 400;
const ROLLS = 20000;
const ROLL_SKILL = 100;
const ROLL_RARE = 3;
const MIRA = '7e5b0000-0000-4000-8000-0000000000d4';

/* ---- on the island --------------------------------------------------------------- */

// Blows of an active ulva carrying a trait at a wild ulva with health to spare, no fighting skill on it so every blow is
// alike: what each took off, and whether it was left bleeding (cleared after each).
const blows = (key: string, trait: string): string => `
  a := creature_spawn(w, 'ulva', 16.5, 16.5, 'active', now() - interval '30 days', u);
  t := creature_spawn(w, 'ulva', 17.5, 16.5, 'wild', now() - interval '30 days', null);
  update creature set traits = ${arr([trait])}, skills = '{}'::jsonb, rare = null where world_id = w and id = a;
  update creature set traits = '{}', rare = null, health = 1000000, bleed_rate = null, bleed_until = null where world_id = w and id = t;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('${key}:BASE', attack_of(c)::text);
  insert into said values ('${key}:CHANCE', beast_chance(c, '${key === 'HEAVY' ? 'heavy' : 'rip'}')::text);
  for i in 1..${BLOWS} loop
    select health into v_h from creature where world_id = w and id = t;
    perform creature_attack(w, a, t);
    select * into q from creature where world_id = w and id = t;
    insert into said values ('${key}:' || i, (v_h - q.health)::text || '|' || coalesce(q.bleed_rate::text, '-'));
    update creature set health = 1000000, bleed_rate = null, bleed_until = null where world_id = w and id = t;
  end loop;
  delete from creature where world_id = w; delete from class_mark where world_id = w;`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; a int; t int; c creature; q creature; v_h double precision; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Traits D', 276, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 14.5, y = 14.5, body_at = now(), swim_at = now() where world_id = w and uid = u;

  -- The table and the cards.
  insert into said select 'DEF:' || d.id, d.name || '|' || d.tier || '|' || coalesce(d.family, '-') || '|' || coalesce(trait_says(d.id), '')
    from trait_def d where d.id = any(${arr(IDS)});
  insert into said select 'CH:' || ch.id, ch.label || '|' || ch.up::text from channel_def ch where ch.id = any(${arr(CHANNELS_D)});
  insert into said select 'MUL:' || x.id, trait_mul(array[x.id], e.channel)::text
    from unnest(${arr(IDS)}) x(id) join trait_effect e on e.trait = x.id;
  insert into said select 'WORTH', trait_worth(${arr(['venom_proof', 'quick_clotting_rare'])});

  -- The wild's rolls: as the wild throws them, and lifted so the rarer tiers come up often enough to count.
  insert into said select 'ROLL:' || r.id, count(*)::text
    from (select roll_trait('{}') as id from generate_series(1, ${ROLLS})
          union all select roll_trait('{}', ${ROLL_SKILL}, ${ROLL_RARE}) from generate_series(1, ${ROLLS})) r
   where r.id = any(${arr(IDS)}) group by r.id;

  -- Venom: a bite's venom on a wild ulva, venom-proof and not.
  t := creature_spawn(w, 'ulva', 20.5, 20.5, 'wild', now() - interval '30 days', null);
  update creature set traits = '{}', rare = null where world_id = w and id = t;
  perform enchant_venom(w, t);
  select * into q from creature where world_id = w and id = t;
  insert into said values ('VENOM:plain', coalesce((q.bleed_rate / max_health(q))::text, '-'));
  update creature set traits = ${arr(['venom_proof'])}, bleed_rate = null, bleed_until = null where world_id = w and id = t;
  perform enchant_venom(w, t);
  select * into q from creature where world_id = w and id = t;
  insert into said values ('VENOM:proof', coalesce((q.bleed_rate / max_health(q))::text, '-'));
  delete from creature where world_id = w;

  -- A bleed: two seconds of 5 a second, on each grade of quick-clotting and on none.
${['', ...TIERS.map((tier) => gradeId('quick_clotting', tier))].map((id) => `  t := creature_spawn(w, 'ulva', 20.5, 20.5, 'wild', now() - interval '30 days', null);
  update creature set traits = ${arr(id ? [id] : [])}, rare = null, bleed_rate = 5, bleed_until = now() + interval '60 seconds',
      settled_at = now() - interval '2 seconds', hurt_at = now() - interval '2 seconds' where world_id = w and id = t;
  update creature set health = max_health(creature) / 2 where world_id = w and id = t;
  select health into v_h from creature where world_id = w and id = t;
  perform creature_settle(w, t);
  insert into said select 'BLEED:${id || 'none'}', (v_h - health)::text from creature where world_id = w and id = t;
  delete from creature where world_id = w;`).join('\n')}

  -- A Fear: a Whispet of yours on a wild ulva, fearless and not; and the Whispet's rest, quick-recovering and not.
${(['plain', 'fearless'] as const).map((k) => `  a := creature_spawn(w, 'whispet', 16.5, 16.5, 'active', now() - interval '30 days', u);
  t := creature_spawn(w, 'ulva', 17.5, 16.5, 'wild', now() - interval '30 days', null);
  update creature set traits = ${arr(k === 'fearless' ? ['quick_recovering'] : [])}, rare = null where world_id = w and id = a;
  update creature set traits = ${arr(k === 'fearless' ? ['fearless'] : [])}, rare = null, health = 5000 where world_id = w and id = t;
  perform creature_attack(w, a, t);
  insert into said select 'FEAR:${k}', coalesce((select round(extract(epoch from until - now())::numeric, 3)::text from class_mark
    where world_id = w and creature_id = t and kind = 'fear' and until > now()), '-');
  insert into said select 'REST:${k}', coalesce((select round(extract(epoch from until - now())::numeric, 3)::text from class_mark
    where world_id = w and creature_id = a and kind = 'ability' and until > now()), '-');
  delete from creature where world_id = w; delete from class_mark where world_id = w;`).join('\n')}

  -- A Whispet's rest when it is quick-recovering: a Fear on an ulva that can be frightened.
  a := creature_spawn(w, 'whispet', 16.5, 16.5, 'active', now() - interval '30 days', u);
  t := creature_spawn(w, 'ulva', 17.5, 16.5, 'wild', now() - interval '30 days', null);
  update creature set traits = ${arr(['quick_recovering'])}, rare = null where world_id = w and id = a;
  update creature set traits = '{}', rare = null, health = 5000 where world_id = w and id = t;
  perform creature_attack(w, a, t);
  insert into said select 'REST:quick', coalesce((select round(extract(epoch from until - now())::numeric, 3)::text from class_mark
    where world_id = w and creature_id = a and kind = 'ability' and until > now()), '-');
  delete from creature where world_id = w; delete from class_mark where world_id = w;

  -- Heavy blows and bleeds.
  ${blows('HEAVY', 'crushing_fantastic')}
  ${blows('RIP', 'ripping_fantastic')}
  ${blows('NONE', 'light_footed')}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const close = (a: number, b: number, within = 1e-4): boolean => Math.abs(a - b) <= within;

/* ---- the table and the cards ------------------------------------------------------- */

for (const [id, tier, ch, mul] of PLAIN) {
  const t = traitOf(id);
  check(`${id} is a plain ${tier} trait at ×${mul} ${ch}`, !!t && t.tier === tier && !t.family && t.effects[ch] === mul && Object.keys(t.effects).length === 1, JSON.stringify(t));
}
for (const [fam, ch, mul] of FAMILIES) {
  const f = FIGHTING.find((x) => x.id === fam);
  const muls = TIERS.map((tier) => traitOf(gradeId(fam, tier))?.effects[ch]);
  check(`${fam} is a fighting family at ×${mul} ${ch} at common, climbing each grade`, !!f && muls[0] === mul
    && muls.every((m, i) => i === 0 || (CHANNEL_BY_ID.get(ch)?.up ? (m as number) > (muls[i - 1] as number) : (m as number) < (muls[i - 1] as number))), JSON.stringify(muls));
}
for (const ch of CHANNELS_D) {
  const c = CHANNEL_BY_ID.get(ch);
  check(`the ${ch} channel has its words and its way on both sides`, !!c && at(`CH:${ch}`) === `${c.label}|${c.up}`, at(`CH:${ch}`));
}
for (const id of IDS) {
  const t = traitOf(id);
  if (!t) {
    check(`${id} is on the table`, false);
    continue;
  }
  check(`${id}'s card: "${traitSays(t)}", on both sides`, at(`DEF:${id}`) === `${t.name}|${t.tier}|${t.family ?? '-'}|${traitSays(t)}`, at(`DEF:${id}`));
  for (const [ch, m] of Object.entries(t.effects)) {
    check(`${id} multiplies ${ch} by ${m} on the island`, close(Number(at(`MUL:${id}`)), m as number, 1e-6), at(`MUL:${id}`));
  }
}
check('a trait at nought multiplies to nought and is said, on the island', at('WORTH').includes('−100% venom taken'), at('WORTH'));

/* ---- the wild's rolls ------------------------------------------------------------- */

{
  let s = 0x5eed;
  const rand = (): number => (s = (s * 48271) % 2147483647) / 2147483647;
  const seen = new Map<string, number>();
  for (let i = 0; i < 2 * ROLLS; i++) {
    const id = i < ROLLS ? rollTrait(rand) : rollTrait(rand, [], ROLL_SKILL, ROLL_RARE);
    if (id && IDS.includes(id)) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  for (const id of IDS) {
    check(`${id} comes up in the wild at its tier, in the browser and on the island`, (seen.get(id) ?? 0) > 0 && Number(at(`ROLL:${id}`)) > 0,
      `${seen.get(id) ?? 0} and ${at(`ROLL:${id}`)} in ${2 * ROLLS}`);
  }
}

/* ---- the rules, in the browser ----------------------------------------------------- */

const g = Game.create(2760);
const clear = (): void => { for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id); };
clear();
const px = g.player.x;
const py = g.player.y;
const spawn = (species: string, mode: 'active' | 'wild', traits: string[], dx = 0): Creature => {
  const c = g.creatures.spawn(species, px + 2 + dx, py, mode, g.rand, g.time - 3600 * 24 * 30);
  c.traits = traits;
  c.rare = 0;
  if (mode === 'active') c.stance = 'passive';
  return c;
};
const cr = g.creatures as unknown as { body: (g: Game, c: Creature, elapsed: number) => void };

// Venom.
{
  const t = spawn('ulva', 'wild', []);
  venom(g, t);
  const plain = t.bleedRate / maxHealth(t, SPECIES.ulva);
  const p = spawn('ulva', 'wild', ['venom_proof'], 1);
  venom(g, p);
  check(`venom: ${VENOM_DRAIN} of its health a second, and none on a venom-proof one, on both sides`,
    close(plain, VENOM_DRAIN) && close(Number(at('VENOM:plain')), plain) && p.bleedRate === 0 && at('VENOM:proof') === '-',
    `browser ${plain} and ${p.bleedRate}; island ${at('VENOM:plain')} and ${at('VENOM:proof')}`);
  clear();
}
// A bleed.
for (const id of ['', ...TIERS.map((tier) => gradeId('quick_clotting', tier))]) {
  const t = spawn('ulva', 'wild', id ? [id] : []);
  t.health = maxHealth(t, SPECIES.ulva) / 2;
  const was = t.health;
  t.bleedRate = 5;
  t.bleedFrom = g.time - 10;
  t.bleedUntil = g.time + 60;
  cr.body(g, t, 2);
  const lost = was - t.health;
  const want = 5 * 2 * (id ? (traitOf(id)?.effects.bleed as number) : 1);
  check(`a bleed of 5 a second takes ${want.toFixed(2)} in two seconds ${id ? `off one ${id}` : 'off one with no clotting'}, on both sides`,
    close(lost, want, 1e-3) && close(Number(at(`BLEED:${id || 'none'}`)), want, 0.01), `browser ${lost}, island ${at(`BLEED:${id || 'none'}`)}`);
  clear();
}
// A Fear, and a Whispet's rest.
{
  const secs = abilityFx('fear', 'secs');
  const rest = abilityRest('fear');
  const quick = traitOf('quick_recovering')?.effects.cooldown as number;
  const a = spawn('whispet', 'active', []);
  const t = spawn('ulva', 'wild', [], 1);
  t.health = 5000;
  g.creatures.attack(g, a, t);
  const fear = (t.marks?.fear?.until ?? g.time) - g.time;
  const r1 = (a.marks?.ability?.until ?? g.time) - g.time;
  clear();
  const b = spawn('whispet', 'active', ['quick_recovering']);
  const f = spawn('ulva', 'wild', ['fearless'], 1);
  f.health = 5000;
  g.creatures.attack(g, b, f);
  const none = (f.marks?.fear?.until ?? g.time) - g.time;
  const r2 = (b.marks?.ability?.until ?? g.time) - g.time;
  clear();
  const c = spawn('whispet', 'active', ['quick_recovering']);
  const v = spawn('ulva', 'wild', [], 1);
  v.health = 5000;
  g.creatures.attack(g, c, v);
  const r3 = (c.marks?.ability?.until ?? g.time) - g.time;
  clear();
  check(`a Fear: ${secs} seconds of running, on both sides`, close(fear, secs) && close(Number(at('FEAR:plain')), secs, 1e-3), `browser ${fear}, island ${at('FEAR:plain')}`);
  check('a fearless one is never frightened, and the Fear is not spent on it, on both sides',
    none === 0 && r2 === 0 && at('FEAR:fearless') === '-' && at('REST:fearless') === '-', `browser ${none}, ${r2}; island ${at('FEAR:fearless')}, ${at('REST:fearless')}`);
  check(`a Whispet's rest: ${rest} seconds, ${(rest * quick).toFixed(2)} when quick-recovering, on both sides`,
    close(r1, rest) && close(r3, rest * quick) && close(Number(at('REST:plain')), rest, 1e-3) && close(Number(at('REST:quick')), rest * quick, 1e-3),
    `browser ${r1}, ${r3}; island ${at('REST:plain')}, ${at('REST:quick')}`);
}
// Heavy blows and bleeds.
const blowsHere = (trait: string): { base: number; chance: number; lost: number[]; bled: number[] } => {
  const a = spawn('ulva', 'active', [trait]);
  a.skills = {};
  const t = spawn('ulva', 'wild', [], 1);
  const lost: number[] = [];
  const bled: number[] = [];
  const chance = g.creatures.chance(a, trait.startsWith('crushing') ? 'heavy' : 'rip');
  for (let i = 0; i < BLOWS; i++) {
    t.health = 1000000;
    t.bleedRate = 0;
    t.bleedUntil = 0;
    g.creatures.attack(g, a, t);
    lost.push(1000000 - t.health);
    bled.push(t.bleedUntil > g.time ? t.bleedRate : -1);
  }
  const base = attackOf(a, SPECIES.ulva);
  clear();
  return { base, chance, lost, bled };
};
const islandBlows = (key: string): { base: number; chance: number; lost: number[]; bled: number[] } => {
  const lost: number[] = [];
  const bled: number[] = [];
  for (let i = 1; i <= BLOWS; i++) {
    const [l, b] = at(`${key}:${i}`).split('|');
    lost.push(Number(l));
    bled.push(b === '-' ? -1 : Number(b));
  }
  return { base: Number(at(`${key}:BASE`)), chance: Number(at(`${key}:CHANCE`)), lost, bled };
};
/** Within four standard deviations of the share asked for, over the blows that landed. */
const inBand = (hits: number, n: number, p: number): boolean => Math.abs(hits - n * p) <= 4 * Math.sqrt(n * p * (1 - p)) + 1;
{
  const want = (traitOf('crushing_fantastic')?.effects.heavy as number) - 1;
  for (const [side, b] of [['in the browser', blowsHere('crushing_fantastic')], ['on the island', islandBlows('HEAVY')]] as const) {
    const landed = b.lost.filter((l) => l > 0);
    // A plain blow is 0.7 to 1.3 of its attack, a heavy one `HEAVY_HIT` times that: nothing falls between.
    const heavy = landed.filter((l) => l > b.base * 1.5);
    const between = landed.filter((l) => l > b.base * 1.3 + 1e-6 && l < b.base * 0.7 * HEAVY_HIT - 1e-6);
    check(`crushing (fantastic): ${want.toFixed(2)} of its blows land ×${HEAVY_HIT} ${side}`,
      close(b.chance, want, 1e-6) && inBand(heavy.length, landed.length, want) && between.length === 0 && landed.length > BLOWS / 2,
      `chance ${b.chance}; ${heavy.length} heavy of ${landed.length} landed`);
  }
  const none = islandBlows('NONE');
  const plain = blowsHere('light_footed');
  check('one with no crushing never lands a heavy blow, on both sides',
    none.lost.every((l) => l <= none.base * 1.3 + 1e-6) && plain.lost.every((l) => l <= plain.base * 1.3 + 1e-6) && none.chance === 0 && plain.chance === 0,
    `${Math.max(...none.lost) / none.base} ${Math.max(...plain.lost) / plain.base}`);
  check('nor bleeds what it strikes, on both sides', none.bled.every((x) => x < 0) && plain.bled.every((x) => x < 0));
}
{
  const want = (traitOf('ripping_fantastic')?.effects.rip as number) - 1;
  for (const [side, b] of [['in the browser', blowsHere('ripping_fantastic')], ['on the island', islandBlows('RIP')]] as const) {
    const landed = b.lost.map((l, i) => [l, b.bled[i]]).filter(([l]) => l > 0);
    const bleeding = landed.filter(([, x]) => x >= 0);
    check(`ripping (fantastic): ${want.toFixed(2)} of its blows bleed the target ${KNIFE_BLEED} of the blow a second ${side}`,
      close(b.chance, want, 1e-6) && inBand(bleeding.length, landed.length, want) && bleeding.every(([l, x]) => close(x / l, KNIFE_BLEED, 0.01)),
      `chance ${b.chance}; ${bleeding.length} bleeding of ${landed.length} landed`);
  }
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nsix traits for a fight (part D) — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

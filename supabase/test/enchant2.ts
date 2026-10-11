/**
 * Enchanting, part 2 (`enchant.ts`, `enchanting.ts`), on both sides: the
 * enchantments after the first three.
 *
 * For each: its scroll's recipe, the same on both sides (Leeching's a life
 * mote and a dark one, the rest two of one element); what Examine says it does
 * at its quality, with the exact figure; the refusal that names what it goes
 * on; and what it does, measured the same way on both sides:
 *
 *   * Venomfang: a roll just over its chance does nothing, just under puts
 *     venom in the creature (its bleed at `VENOM_DRAIN` of its full health);
 *   * Gale: a swing's time, with it and without;
 *   * Nightblade: the chance of a critical blow, with it and without;
 *   * Sunstrike: a blow's damage on a hostile monster and on a creature that
 *     is not one;
 *   * Leeching: the health a hit gives back, every hit, with no roll;
 *   * Tidecaller: how far a hit puts the creature's next blow back.
 *
 * Every roll is set: dice on the island (`random()` read off a list) and the
 * same list as the browser's `rand`. Runs against the database the suite
 * leaves behind; the island half is rolled back.
 *
 *   npx esbuild supabase/test/enchant2.ts --bundle --platform=node --format=esm \
 *     --external:typescript --outfile=node_modules/.cache/enchant2.mjs && node node_modules/.cache/enchant2.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import type { Item } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { ENCHANT_SAID, ENCHANTERS_PLINTH, ENCHANTMENT_LIST, ENCHANTMENTS, enchantHitChance, enchantValue, wrongKind, type EnchantmentDef } from '../../src/game/enchant';
import { drainSecs, enchantLineAt, enchantRoll, enchantSays, enchantWorks, leechHeal } from '../../src/game/enchanting';
import { classDealt } from '../../src/game/creatureActions';
import { blowEvery, fightBase, myCritChance, VENOM_DRAIN } from '../../src/game/fight';
import { WEAPON_BY_ID } from '../../src/game/gear';
import { BLOW_SHARE, maxHealth, SPECIES } from '../../src/game/creatures';
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
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

/** Everything after the first three: what this test is about. */
const LATER = ENCHANTMENT_LIST.slice(3);
const E = (id: string): EnchantmentDef => ENCHANTMENTS[id];
const [VENOM, GALE, NIGHT, SUN, LEECH, TIDE] = ['venomfang', 'gale', 'nightblade', 'sunstrike', 'leeching', 'tidecaller'].map(E);

/* ---- the scrolls and the words, on both sides ------------------------------ */

const billIsle = psql(`select string_agg(r.id || '=' || (select string_agg(ri.item || '*' || ri.count, '+' order by ri.item) from recipe_input ri where ri.recipe = r.id),
  '|' order by r.id) from recipe r where r.id like 'make\\_%\\_scroll'`);
const billHere = ENCHANTMENT_LIST.map((e) => `make_${e.scroll}=${[...(RECIPE_BY_ID.get(`make_${e.scroll}`)?.inputs ?? [])]
  .sort((a, b) => a.item.localeCompare(b.item)).map((i) => `${i.item}*${i.count ?? 1}`).join('+')}`).sort().join('|');
check(`every scroll is written from the same papyrus and motes on both sides: ${LATER.map((e) => `${e.name} (${e.motes.map(([m, n]) => `${n} ${m}`).join(' + ')})`).join(', ')}`,
  billIsle === billHere && billHere.includes('make_leeching_scroll=dark_mote*1+life_mote*1+papyrus*1') && billHere.includes('make_gale_scroll=papyrus*1+wind_mote*2'),
  billIsle === billHere ? '' : `${billIsle} / ${billHere}`);

const QLS = [0.4, 37.48, 50, 100, 140];
const saysIsle = psql(`select string_agg(enchant_says(jsonb_build_object('id', e.id, 'ql', q)), '#' order by e.ord, o)
  from enchantments() e, unnest(array[${QLS.join(',')}]::float8[]) with ordinality u(q, o) where e.ord >= 3`);
// Trimmed as the island's answer is: each line starts with a space.
const saysHere = LATER.flatMap((e) => QLS.map((q) => enchantSays({ enchant: { id: e.id, ql: q } }))).join('#').trim();
check('Examine says each at its quality in the same words on both sides', saysIsle === saysHere,
  saysIsle === saysHere ? '' : (() => { const i = [...saysIsle].findIndex((ch, k) => ch !== saysHere[k]); return `at ${i}: ${saysIsle.slice(i - 40, i + 60)} / ${saysHere.slice(i - 40, i + 60)}`; })());
const at100 = (e: EnchantmentDef): string => enchantLineAt(e, 100);
check('and the figures at QL 100 are the owner\'s: Venomfang 25% of hits, Gale 10% off a swing, Nightblade 5 points of critical chance, Sunstrike 25% on a monster, Leeching 10% of the damage, Tidecaller 20% of the time between blows',
  at100(VENOM).includes('puts venom in the target 25% of the time') && at100(GALE).includes('takes 10% less time')
    && at100(NIGHT).startsWith('5% more of its blows') && at100(SUN).includes('does 25% more damage to a hostile monster')
    && at100(LEECH).includes('gives you back 10% of the damage') && at100(TIDE).includes('back by 20% of the time between its blows')
    && near(enchantValue(GALE, 140), 0.1),
  LATER.map(at100).join(' # '));

/* ---- on the island --------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-000000000002';
const HIT_QL = 50;
const out = psql(`
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
declare xs text[] := string_to_array(current_setting('wurm.dice'), ',');
        n int := coalesce(nullif(current_setting('wurm.dice_n', true), ''), '0')::int;
begin
  perform set_config('wurm.dice_n', (n + 1)::text, true);
  return xs[1 + n % array_length(xs, 1)]::double precision;
end $f$;
create function pg_temp.dice(v text) returns void language plpgsql as $f$
begin
  perform set_config('wurm.dice', v, true);
  perform set_config('wurm.dice_n', '0', true);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
end $f$;
create function pg_temp.nodice() returns void language plpgsql as $f$
begin
  perform set_config('search_path', '"$user", public', true);
end $f$;
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; v_sw bigint; v_bow bigint; v_s bigint; v_c creature; v_g creature; v_until timestamptz;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Enchanting 2', 218, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = 40.5, y = 40.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         class_mul = null, combat_class = null, craft_class = null, wounds = '[]'::jsonb, blessings = '{}'::jsonb,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'swords', 30), (w, u, 'enchanting', 100)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  v_sw := give(w, u, 'sword', 1, 100, 'Iron');
  v_bow := give(w, u, 'short_bow', 1, 50, 'Willow');

  -- 1. Refused away from an enchanter's plinth; then at one, refused on a thing of the wrong kind, in words that name the right one.
  v_s := give(w, u, 'gale_scroll', 1, 90);
  insert into said values ('R:plinth', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_sw, 'scroll', v_s)), 'none'));
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'enchanters_plinth', 40, 39, 0, 0, 40.25, 39.25, 50);
  insert into said values ('R:bow', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_bow, 'scroll', v_s)), 'none'));
  insert into said values ('R:sword', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_sw, 'scroll', v_s)), 'none'));

  -- 2. Gale, Nightblade, Sunstrike: in the hand, and what each makes of a swing.
  update player set equipped = jsonb_build_object('weapon', v_sw) where world_id = w and uid = u;
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex)
    values (w, 9201, 'shaggan', 'Shaggan', 'wild', 41.2, 40.5, 41.2, 40.5, 90, 'female'),
           (w, 9202, 'goblin', 'Goblin', 'wild', 40.5, 41.2, 40.5, 41.2, 60, 'male');
  select * into v_c from creature where world_id = w and id = 9201;
  select * into v_g from creature where world_id = w and id = 9202;
  insert into said values ('PLAIN', act_base(w, u, 'attack_creature', 2.5)::text || '|' || my_crit_chance(w, u, swung_with(w, u))::text
    || '|' || class_dealt(w, u, v_c)::text || '|' || class_dealt(w, u, v_g)::text);
  update item set enchant = '{"id": "gale", "ql": 100}'::jsonb where id = v_sw;
  insert into said values ('GALE', act_base(w, u, 'attack_creature', 2.5)::text);
  update item set enchant = '{"id": "nightblade", "ql": 100}'::jsonb where id = v_sw;
  insert into said values ('NIGHT', my_crit_chance(w, u, swung_with(w, u))::text);
  update item set enchant = '{"id": "sunstrike", "ql": 100}'::jsonb where id = v_sw;
  insert into said values ('SUN', class_dealt(w, u, v_c)::text || '|' || class_dealt(w, u, v_g)::text);

  -- 3. Venomfang at QL ${HIT_QL}: a roll just over its chance, then just under.
  update item set enchant = jsonb_build_object('id', 'venomfang', 'ql', ${HIT_QL}) where id = v_sw;
  perform pg_temp.dice((enchant_hit_chance('venomfang', ${HIT_QL}) + 0.001)::text);
  perform enchant_hit(w, u, 9201, (select i from item i where i.id = v_sw), 10);
  insert into said select 'VOVER', coalesce((c.bleed_until > now())::text, 'null') from creature c where c.world_id = w and c.id = 9201;
  perform pg_temp.dice((enchant_hit_chance('venomfang', ${HIT_QL}) - 0.001)::text);
  perform enchant_hit(w, u, 9201, (select i from item i where i.id = v_sw), 10);
  perform pg_temp.nodice();
  insert into said select 'VUNDER', (c.bleed_until > now())::text || '|' || round(c.bleed_rate::numeric, 6)::text
    || '|' || round(extract(epoch from (c.bleed_until - now()))::numeric, 1)::text
    || '|' || (select e.text from event e where e.world_id = w and e.uid = u order by e.n desc limit 1)
    from creature c where c.world_id = w and c.id = 9201;

  -- 4. Leeching at QL ${HIT_QL}: a hit of 10 from half health, every time and with no roll.
  update item set enchant = jsonb_build_object('id', 'leeching', 'ql', ${HIT_QL}) where id = v_sw;
  update player set stats = stats || jsonb_build_object('health', 0.5) where world_id = w and uid = u;
  perform pg_temp.dice('0.999');
  perform enchant_hit(w, u, 9201, (select i from item i where i.id = v_sw), 10);
  perform enchant_hit(w, u, 9201, (select i from item i where i.id = v_sw), 10);
  insert into said select 'LEECH', (p.stats->>'health') || '|' || coalesce(current_setting('wurm.dice_n', true), '0')
    from player p where p.world_id = w and p.uid = u;
  perform pg_temp.nodice();

  -- 5. Tidecaller at QL ${HIT_QL}: how far one hit puts the shaggan's next blow back.
  update item set enchant = jsonb_build_object('id', 'tidecaller', 'ql', ${HIT_QL}) where id = v_sw;
  update creature set until = now() + interval '1 second' where world_id = w and id = 9201;
  select until into v_until from creature where world_id = w and id = 9201;
  perform enchant_hit(w, u, 9201, (select i from item i where i.id = v_sw), 10);
  insert into said select 'TIDE', round(extract(epoch from (c.until - v_until))::numeric, 6)::text
    from creature c where c.world_id = w and c.id = 9201;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(218, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(40.5, 40.5, 0);
g.settings.fromStores = false;
g.player.stats.stamina = 1;
g.player.stats.health = 1;
g.player.wounds = [];
const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
const dice = (...xs: number[]): void => {
  let n = 0;
  g.rand = () => xs[n++ % xs.length];
};
let rolls = 0;
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number, extra?: string): Item => g.gather(id, { count: 1, ql, ...(extra ? { extra } : {}) });
g.skills.values.set('swords', 30);
g.skills.values.set('enchanting', 100);
const sword = thing('sword', 100, 'Iron');
const bow = thing('short_bow', 50, 'Willow');

/* 1. Refusals. */
const galeScroll = thing(GALE.scroll, 90);
const ask = (uid: number): string => act('enchant').check?.({ kind: 'item', uid, scroll: galeScroll.uid } as Target, g) ?? 'none';
const away = ask(sword.uid);
check(`away from an enchanter's plinth Enchant is refused on both sides: ${ENCHANT_SAID.plinth}`,
  isle.get('R:plinth') === ENCHANT_SAID.plinth && away === ENCHANT_SAID.plinth, `${isle.get('R:plinth')} / ${away}`);
g.addFurniture(ENCHANTERS_PLINTH, 40, 39, 0, 0, 50);
check(`a Gale scroll is refused on a bow in words that name what it goes on, on both sides: ${wrongKind(GALE)}`,
  isle.get('R:bow') === wrongKind(GALE) && ask(bow.uid) === wrongKind(GALE) && wrongKind(GALE) === 'Gale goes on a melee weapon, not a bow or a thrown weapon.',
  `${isle.get('R:bow')} / ${ask(bow.uid)}`);
check('and taken on a sword, on both sides', isle.get('R:sword') === 'none' && ask(sword.uid) === 'none', `${isle.get('R:sword')} / ${ask(sword.uid)}`);

/* 2. Gale, Nightblade, Sunstrike. */
g.player.equipped.weapon = sword.uid;
const shaggan = g.creatures.spawn('shaggan', 41.2, 40.5, 'wild', () => 0.5, 0);
shaggan.health = 90;
const goblin = g.creatures.spawn('goblin', 40.5, 41.2, 'wild', () => 0.5, 0);
goblin.health = 60;
const swingDef = { id: 'attack_creature', baseTime: 2.5 };
const swordDef = WEAPON_BY_ID.get('sword')!;
const plainHere = [fightBase(g, swingDef) ?? 0, myCritChance(g, swordDef), classDealt(g, shaggan), classDealt(g, goblin)];
const plainIsle = (isle.get('PLAIN') ?? '').split('|').map(Number);
check('without an enchantment a swing\'s time, the critical chance and the damage on a shaggan and a goblin are the same on both sides',
  plainHere.every((x, i) => near(x, plainIsle[i])), `${plainIsle.join(' ')} / ${plainHere.join(' ')}`);
sword.enchant = { id: GALE.id, ql: 100 };
const galeHere = fightBase(g, swingDef) ?? 0;
check(`a Gale at QL 100 takes ${enchantValue(GALE, 100) * 100}% off a swing on both sides: ${plainHere[0]} s to ${galeHere} s`,
  near(galeHere, plainHere[0] * (1 - enchantValue(GALE, 100))) && near(Number(isle.get('GALE')), galeHere), `island ${isle.get('GALE')}`);
sword.enchant = { id: NIGHT.id, ql: 100 };
const nightHere = myCritChance(g, swordDef);
check(`a Nightblade at QL 100 adds ${enchantValue(NIGHT, 100) * 100} points to the critical chance on both sides: ${plainHere[1]} to ${nightHere}`,
  near(nightHere, plainHere[1] + enchantValue(NIGHT, 100)) && near(Number(isle.get('NIGHT')), nightHere), `island ${isle.get('NIGHT')}`);
sword.enchant = { id: SUN.id, ql: 100 };
const sunHere = [classDealt(g, shaggan), classDealt(g, goblin)];
check(`a Sunstrike at QL 100 does ${enchantValue(SUN, 100) * 100}% more to a goblin, a hostile monster, and nothing more to a shaggan, on both sides`,
  SPECIES.goblin.monster === true && !SPECIES.shaggan.monster && near(sunHere[0], plainHere[2]) && near(sunHere[1], plainHere[3] * (1 + enchantValue(SUN, 100)))
    && near(Number(part('SUN', 0)), sunHere[0]) && near(Number(part('SUN', 1)), sunHere[1]),
  `${isle.get('SUN')} / ${sunHere.join('|')}`);

/* 3. Venomfang. */
sword.enchant = { id: VENOM.id, ql: HIT_QL };
const vc = g.creatures.spawn('shaggan', 30.5, 30.5, 'wild', () => 0.5, 0);
vc.health = 90;
const vchance = enchantHitChance(VENOM, HIT_QL);
dice(vchance + 0.001);
const vover = enchantRoll(g, sword, vc);
dice(vchance - 0.001);
const vunder = enchantRoll(g, sword, vc);
if (vunder) enchantWorks(g, vunder, HIT_QL, vc, 10, { burn: () => {}, bleed: () => {} });
const venomRate = maxHealth(vc, SPECIES.shaggan) * VENOM_DRAIN;
check(`a Venomfang at QL ${HIT_QL} (${vchance * 100}%): a roll just over does nothing and just under puts venom in it, ${VENOM_DRAIN * 100}% of its full health a second, on both sides`,
  part('VOVER') !== 'true' && vover === null && vunder?.id === VENOM.id && part('VUNDER', 0) === 'true'
    && near(Number(part('VUNDER', 1)), venomRate, 1e-5) && near(vc.bleedRate, venomRate) && vc.bleedUntil > g.time
    && part('VUNDER', 3) === said[said.length - 1] && said[said.length - 1] === 'Your Venomfang puts venom in the shaggan.',
  `${isle.get('VOVER')} ${isle.get('VUNDER')} / ${vc.bleedRate} ${said[said.length - 1]}`);

/* 4. Leeching. */
sword.enchant = { id: LEECH.id, ql: HIT_QL };
g.player.stats.health = 0.5;
dice(0.999);
rolls = 0;
const counted = g.rand;
g.rand = () => { rolls++; return counted(); };
for (let i = 0; i < 2; i++) {
  const e = enchantRoll(g, sword, shaggan);
  if (e) enchantWorks(g, e, HIT_QL, shaggan, 10, { burn: () => {}, bleed: () => {} });
}
const leeched = 0.5 + 2 * leechHeal(LEECH, HIT_QL, 10);
check(`a Leeching at QL ${HIT_QL} gives back ${enchantValue(LEECH, HIT_QL) * 100}% of each hit of 10 as health, at ${BLOW_SHARE * 100}% of your health a point, every hit and with no roll, on both sides`,
  near(g.player.stats.health, leeched) && near(Number(part('LEECH', 0)), leeched) && part('LEECH', 1) === '0' && rolls === 0
    && near(leechHeal(LEECH, HIT_QL, 10), 10 * 0.05 * BLOW_SHARE),
  `${isle.get('LEECH')} / ${g.player.stats.health} ${rolls} rolls`);

/* 5. Tidecaller. */
sword.enchant = { id: TIDE.id, ql: HIT_QL };
shaggan.cooldown = 1;
const e5 = enchantRoll(g, sword, shaggan);
if (e5) enchantWorks(g, e5, HIT_QL, shaggan, 10, { burn: () => {}, bleed: () => {} });
const tideSecs = blowEvery(SPECIES.shaggan) * enchantValue(TIDE, HIT_QL);
check(`a Tidecaller at QL ${HIT_QL} puts a shaggan's next blow back ${enchantValue(TIDE, HIT_QL) * 100}% of the ${blowEvery(SPECIES.shaggan)} s between its blows (${tideSecs} s), on both sides`,
  near(shaggan.cooldown, 1 + tideSecs) && near(drainSecs(TIDE, HIT_QL, shaggan), tideSecs) && near(Number(isle.get('TIDE')), tideSecs, 1e-3),
  `${isle.get('TIDE')} / ${shaggan.cooldown - 1}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nenchanting, part 2 — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

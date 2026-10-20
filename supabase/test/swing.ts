/**
 * A swing takes the seconds its weapon says, and longer in armour and over
 * what your back takes.
 *
 * Reported: "i've got a short sword that says it should be 2 seconds per
 * attack but in combat it takes me 5 seconds per attack". A go of a fight was
 * priced as a job weight; it is the weapon's own seconds now. And then asked
 * for: "Have armor weight affect attack speed minimally, and pack weight only
 * when overburdened affect by 20%." What this asks of both sides
 * (`swingSeconds`, `Game.duration`, `Game.swingBurden`; `go_secs`,
 * `swing_burden`, `settle`, `rpc_act`, `fight_back`):
 *
 *   * a short sword in the hand and nothing on, under the limit, at fighting
 *     1, 20, 47 and 70, swings every 2 seconds less a part in 140 a point of
 *     fighting, never under the floor, the next go timed by `settle` as the
 *     browser times it and as the card says;
 *   * full plate makes it longer by its kilograms' share as they count,
 *     each piece's weight times its family's (`ARMOUR_SWING_BY`) at
 *     `armourSwingKg` a counted kilogram, no more than `ARMOUR_SWING_FULL`;
 *     a part of a set by its own counted kilograms' share, in proportion;
 *     plate and a metal shield, the heaviest set there is as it counts, by
 *     exactly `ARMOUR_SWING_FULL`;
 *   * a full set of leather (8.2 kg, counting half) and of plate (31 kg,
 *     counting a quarter again) make it longer by what they count for, on
 *     both sides and in `swing_burden` itself, so leather slows a swing
 *     less a kilogram than plate by exactly the ratio of their shares;
 *   * a pack over what the back takes makes it `OVERBURDEN_SWING` longer,
 *     and plate with it the two together;
 *   * a wagon driven with a load in it, and a pack under the limit, change
 *     nothing;
 *   * tired arms and wounded ones slow it by the same on both sides, on top;
 *   * every melee weapon swings at its own pace at fighting 30, and a bow
 *     draws at its own;
 *   * a fight asked for (`rpc_act`) and a bite turned on (`fight_back`) are
 *     timed the same as the go after, armour and pack included;
 *   * mining is timed as it was, in plate and over the limit;
 *   * the card a weapon shows says the seconds and names armour, its
 *     kilograms as they weigh and as they count, and being overburdened,
 *     with their shares; and the card a piece of armour shows says what it
 *     adds to every swing.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { ARMOUR_SWING_BY, ARMOUR_SWING_FULL, armourSwingKg, heaviestSet, OVERBURDEN_SWING, SHIELD_SWING_BY, SWING_FLOOR, swingSeconds } from '../../src/game/fight';
import { CHAR_START, Game, goSeconds } from '../../src/game/game';
import { ARMOUR_BY_ID, SHIELDS, WEAPON_BY_ID, WEAPONS, type Slot } from '../../src/game/gear';
import { itemDef } from '../../src/game/items';
import { finePercent, percent } from '../../src/game/words';
import type { Wound } from '../../src/game/wounds';
import { compareLines, swingNote } from '../../src/ui/compare';
import { TileType } from '../../src/world/tiles';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
const ATTACK = ACTION_BY_ID.get('attack_creature');
const SHOOT = ACTION_BY_ID.get('shoot_creature');
const MINE = ACTION_BY_ID.get('mine');
if (!ATTACK || !SHOOT || !MINE) throw new Error('no fight');
const SWORD = WEAPON_BY_ID.get('short_sword');
if (!SWORD) throw new Error('no short sword');
const SKILLS = [1, 20, 47, 70];
const PLATE: Array<[string, Slot]> = [['helm', 'head'], ['plate_breastplate', 'chest'], ['plate_arms', 'arms'], ['plate_legs', 'legs'], ['plate_boots', 'feet']];
const PART = PLATE.slice(0, 2);
const LEATHER: Array<[string, Slot]> = [['leather_cap', 'head'], ['leather_jerkin', 'chest'], ['leather_sleeves', 'arms'], ['leather_trousers', 'legs'], ['leather_boots', 'feet']];
/** What the two sets weigh, written down here so that a piece made heavier or lighter is caught rather than followed. */
const LEATHER_KG = 8.2;
const PLATE_KG = 31;
const SHIELD = 'metal_shield';
/** Enough logs to be over the limit on a starting back, and a wagon's load of them. */
const LOGS = 10;
const WAGON_LOGS = 200;
const TIRED = 0.2;
const ARM_WOUNDS: Wound[] = [{ id: 1, kind: 'cut', part: 'arms', severity: 0.08, bleeding: false, infected: false, dressing: null, at: 0 } as Wound];

/** The kilograms of a set, at each piece's make weight. */
const kgOf = (ids: string[]): number => ids.reduce((n, id) => n + itemDef(id).weight, 0);
/** The kilograms a set counts for against a swing: each piece's weight times its family's share, or a shield's. */
const countedOf = (ids: string[]): number => ids.reduce((n, id) => {
  const a = ARMOUR_BY_ID.get(id);
  return n + itemDef(id).weight * (a ? ARMOUR_SWING_BY[a.cls] : SHIELDS[id] ? SHIELD_SWING_BY : NaN);
}, 0);
/** What armour of these pieces makes of a swing, worked out here rather than asked of the rule. */
const armourBy = (ids: string[]): number => 1 + countedOf(ids) * (ARMOUR_SWING_FULL / heaviestSet().counted);

/* ---- The island's half -------------------------------------------------- */

/*
 * Each go is put in hand and made due now; `settle` performs it and times the
 * next, which is what is read back: the seconds, and the fighting, body
 * control, wind and wounds that next go was timed off (a go teaches, and
 * spends wind, before the next is timed).
 */
const out = psql(`
begin;
create temp table said (k text, v text);
create function pg_temp.next_go(p_world uuid, p_uid uuid, p_target int) returns text language plpgsql as $f$
declare r player;
begin
  update player set act = 'attack_creature', act_target = jsonb_build_object('kind', 'creature', 'id', p_target),
         act_started = now() - interval '10 seconds', act_ends = now(), act_left = 100, act_goes = 100,
         act_queue = '[]'::jsonb
    where world_id = p_world and uid = p_uid;
  perform settle(p_world, p_uid);
  select * into r from player where world_id = p_world and uid = p_uid;
  return pg_temp.timed(r, p_world, p_uid);
end $f$;
create function pg_temp.timed(r player, p_world uuid, p_uid uuid) returns text language sql as $f$
  select coalesce(extract(epoch from (r.act_ends - r.act_started))::text, 'none')
    || '|' || skill_of(p_world, p_uid, 'fighting') || '|' || skill_of(p_world, p_uid, 'body_control')
    || '|' || coalesce(r.stats->>'stamina', '1') || '|' || coalesce(r.wounds, '[]'::jsonb)::text
$f$;
create function pg_temp.fresh(p_world uuid, p_uid uuid, p_fighting double precision, p_stamina double precision, p_eq jsonb) returns void
  language sql as $f$
  insert into skill (world_id, uid, id, value) values (p_world, p_uid, 'fighting', p_fighting)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into skill (world_id, uid, id, value) values (p_world, p_uid, 'body_control', char_start())
    on conflict (world_id, uid, id) do update set value = excluded.value;
  update player set equipped = p_eq, wounds = '[]'::jsonb, act = null, act_queue = '[]'::jsonb,
         stats = jsonb_set(stats, '{stamina}', to_jsonb(p_stamina))
    where world_id = p_world and uid = p_uid;
$f$;
create function pg_temp.laden(p_world uuid, p_uid uuid) returns text language sql as $f$
  select carried_weight(p_world, p_uid) || '|' || carry_limit(p_world, p_uid) || '|'
      || coalesce((driving(p_world, p_uid)).id::text, 'none')
$f$;
do $b$
declare w record; v_px double precision; v_py double precision; v_ogre int; v_sword bigint; v_eq jsonb; v_plated jsonb;
        v_part jsonb; v_shielded jsonb; v_logs bigint; f int; v_item bigint; s text[]; r record; v_cart placed;
        v_ctl double precision; v_act text; v_leather jsonb;
begin
  -- Off the beach of the biggest island there is, with land under it (\`at_peace\`).
  select p.world_id, p.uid, wd.size, wd.spawn_x, wd.spawn_y into w
    from player p join world wd on wd.id = p.world_id
   where exists (select 1 from land_tile t where t.world_id = wd.id)
   order by wd.size desc, p.world_id, p.uid limit 1;
  v_px := case when w.spawn_x + peace_reach() + 6 < w.size then w.spawn_x + peace_reach() + 6.5
               else w.spawn_x - peace_reach() - 5.5 end;
  v_py := w.spawn_y + 0.5;
  delete from item where world_id = w.world_id and holder = 'player' and holder_uid = w.uid;
  update player set act = null, act_target = null, act_ends = null, act_left = null, act_goes = null,
         act_queue = '[]'::jsonb, equipped = '{}'::jsonb, fight_stance = 'balanced', fight_back = true,
         moved_at = now() - interval '1 minute', x = v_px, y = v_py, level = 0, wounds = '[]'::jsonb,
         class_mul = '{}'::jsonb, blessings = '{}'::jsonb,
         stats = coalesce(stats, '{}'::jsonb)
           || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1, 'aegis', 1000)
    where world_id = w.world_id and uid = w.uid;
  perform set_config('request.jwt.claims', json_build_object('sub', w.uid)::text, true);
  -- Something to swing at that neither dies nor wanders off, and a ward so its blows do not end the test.
  v_ogre := creature_spawn(w.world_id, 'ogre', v_px + 0.7, v_py, 'wild', now() - interval '2 hours');
  update creature set health = 1e9, traits = '{}' where world_id = w.world_id and id = v_ogre;
  v_sword := give(w.world_id, w.uid, 'short_sword', 1, 40, 'iron');
  v_eq := jsonb_build_object('weapon', v_sword);

  -- A short sword, nothing else on or in the pack.
  foreach f in array array[${SKILLS.join(', ')}] loop
    perform pg_temp.fresh(w.world_id, w.uid, f, 1, v_eq);
    insert into said values ('BARE:' || f, pg_temp.next_go(w.world_id, w.uid, v_ogre));
  end loop;

  -- Iron plate on every place it goes, a part of it, and plate with a metal shield.
  v_plated := v_eq;
  v_part := v_eq;
  foreach s slice 1 in array array[${PLATE.map(([id, slot]) => `['${id}', '${slot}']`).join(', ')}] loop
    v_item := give(w.world_id, w.uid, s[1], 1, 40, 'iron');
    v_plated := v_plated || jsonb_build_object(s[2], v_item);
    if s[1] in (${PART.map(([id]) => `'${id}'`).join(', ')}) then v_part := v_part || jsonb_build_object(s[2], v_item); end if;
  end loop;
  v_shielded := v_plated || jsonb_build_object('offhand', give(w.world_id, w.uid, '${SHIELD}', 1, 40, 'iron'));
  v_leather := v_eq;
  foreach s slice 1 in array array[${LEATHER.map(([id, slot]) => `['${id}', '${slot}']`).join(', ')}] loop
    v_leather := v_leather || jsonb_build_object(s[2], give(w.world_id, w.uid, s[1], 1, 40));
  end loop;
  insert into said values ('UNDER', pg_temp.laden(w.world_id, w.uid));
  foreach f in array array[${SKILLS.join(', ')}] loop
    perform pg_temp.fresh(w.world_id, w.uid, f, 1, v_plated);
    insert into said values ('PLATE:' || f, pg_temp.next_go(w.world_id, w.uid, v_ogre));
  end loop;
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_part);
  insert into said values ('PART', pg_temp.next_go(w.world_id, w.uid, v_ogre));
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_shielded);
  insert into said values ('SHIELD', pg_temp.next_go(w.world_id, w.uid, v_ogre));
  -- A full set of leather and one of plate, timed and asked of \`swing_burden\` itself.
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_leather);
  insert into said values ('LEATHER', pg_temp.next_go(w.world_id, w.uid, v_ogre));
  insert into said values ('BURDEN:LEATHER', swing_burden(w.world_id, w.uid, 'attack_creature')::text);
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_plated);
  insert into said values ('BURDEN:PLATE', swing_burden(w.world_id, w.uid, 'attack_creature')::text);

  -- A wagon driven, with a load in it far over what a back takes, and the pack under it.
  v_item := give(w.world_id, w.uid, 'wagon', 1, 50, 'Pine');
  perform act_perform(w.world_id, w.uid, 'place_furniture',
    jsonb_build_object('kind', 'item', 'uid', v_item, 'x', floor(v_px)::int - 3, 'y', floor(v_py)::int, 'sx', 0, 'sy', 0));
  select * into v_cart from placed where world_id = w.world_id and sub = 'wagon' and made_by = w.uid order by id desc limit 1;
  insert into item (world_id, holder, placed, def, ql, count) values (w.world_id, 'furniture', v_cart.id, 'log', 30, ${WAGON_LOGS});
  update placed set driver = w.uid where world_id = w.world_id and id = v_cart.id;
  insert into said values ('WAGONED', pg_temp.laden(w.world_id, w.uid) || '|'
    || (select coalesce(sum(i.count * idf.weight), 0) from item i join item_def idf on idf.id = i.def
         where i.world_id = w.world_id and i.holder = 'furniture' and i.placed = v_cart.id));
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_eq);
  insert into said values ('WAGON', pg_temp.next_go(w.world_id, w.uid, v_ogre));

  -- And a pack over the limit: on its own, and with plate on.
  v_logs := give(w.world_id, w.uid, 'log', ${LOGS}, 30);
  insert into said values ('OVER', pg_temp.laden(w.world_id, w.uid));
  foreach f in array array[${SKILLS.join(', ')}] loop
    perform pg_temp.fresh(w.world_id, w.uid, f, 1, v_eq);
    insert into said values ('OVER:' || f, pg_temp.next_go(w.world_id, w.uid, v_ogre));
    perform pg_temp.fresh(w.world_id, w.uid, f, 1, v_plated);
    insert into said values ('BOTH:' || f, pg_temp.next_go(w.world_id, w.uid, v_ogre));
  end loop;

  -- Tired arms, and wounded ones, in plate and over the limit.
  perform pg_temp.fresh(w.world_id, w.uid, 20, ${TIRED}, v_plated);
  insert into said values ('TIRED', pg_temp.next_go(w.world_id, w.uid, v_ogre));
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_plated);
  update player set wounds = '${JSON.stringify(ARM_WOUNDS)}'::jsonb where world_id = w.world_id and uid = w.uid;
  insert into said values ('WOUNDED', pg_temp.next_go(w.world_id, w.uid, v_ogre));

  -- A fight asked for, and a bite turned on, with the short sword at fighting 20, in plate and over the limit.
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_plated);
  delete from caller where uid = w.uid;
  perform rpc_act(w.world_id, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', v_ogre), 100);
  insert into said select 'ASKED', pg_temp.timed(p, w.world_id, w.uid) from player p where world_id = w.world_id and uid = w.uid;
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_plated);
  perform fight_back(w.world_id, w.uid, v_ogre);
  insert into said select 'TURNED', pg_temp.timed(p, w.world_id, w.uid) from player p where world_id = w.world_id and uid = w.uid;

  -- And a job that is not a fight, in plate and over the limit, at the pace and on the floor it always had.
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_plated);
  insert into said select 'JOB:' || x, go_secs('mine', 8, x, 40, 1, swing_burden(w.world_id, w.uid, 'mine'))
      || '|' || act_duration(8, x, 40, 1) || '|' || swing_burden(w.world_id, w.uid, 'mine')
    from unnest(array[1, 50, 100]) x;
  delete from item where id = v_logs;

  -- Every weapon there is at fighting and archery 30, nothing else on, timed as \`settle\` times it.
  insert into skill (world_id, uid, id, value) values (w.world_id, w.uid, 'archery', 30)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  for r in select id, ammo is not null as bow from weapon_def order by id loop
    perform pg_temp.fresh(w.world_id, w.uid, 30, 1, jsonb_build_object('weapon', give(w.world_id, w.uid, r.id, 1, 40)));
    v_ctl := control_speed(w.world_id, w.uid);
    v_act := case when r.bow then 'shoot_creature' else 'attack_creature' end;
    insert into said values ('W:' || r.id, go_secs(v_act, act_base(w.world_id, w.uid, v_act, 2.5),
      skill_of(w.world_id, w.uid, case when r.bow then 'archery' else 'fighting' end), 0, v_ctl,
      swing_burden(w.world_id, w.uid, v_act))::text);
  end loop;
end $b$;
select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const at = line.indexOf('=');
  if (at > 0) said.set(line.slice(0, at), line.slice(at + 1));
}
const island = (k: string): string => said.get(k) ?? 'MISSING';

interface Timed { secs: number; fighting: number; control: number; stamina: number; wounds: Wound[] }
const timed = (k: string): Timed => {
  const [secs, fighting, control, stamina, ...wounds] = island(k).split('|');
  return { secs: Number(secs), fighting: Number(fighting), control: Number(control), stamina: Number(stamina), wounds: JSON.parse(wounds.join('|') || '[]') };
};

/* ---- The browser's half -------------------------------------------------- */

/**
 * A body on level grass with what the island's had: a short sword in its
 * hand, iron plate and a metal shield in the pack, and logs when it is over
 * the limit. What is worn is put on by `wear`.
 */
const g = Game.create(4242);
{
  const w = g.world;
  for (let y = 16; y <= 26; y++) for (let x = 16; x <= 26; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); }
  for (let y = 16; y <= 25; y++) for (let x = 16; x <= 25; x++) w.setTile(x, y, TileType.Grass, 0);
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.player.stats.health = 1;
}
const sword = g.inventory.add('short_sword', { ql: 40, extra: 'Iron' });
g.equip('weapon', sword.uid);
const pieces = new Map<string, number>();
for (const [id] of PLATE) pieces.set(id, g.inventory.add(id, { ql: 40, extra: 'Iron' }).uid);
pieces.set(SHIELD, g.inventory.add(SHIELD, { ql: 40, extra: 'Iron' }).uid);
for (const [id] of LEATHER) pieces.set(id, g.inventory.add(id, { ql: 40 }).uid);
let logs: number | null = null;
const laden = (over: boolean): void => {
  if (over && logs === null) logs = g.inventory.add('log', { ql: 30, count: LOGS }).uid;
  if (!over && logs !== null) { g.inventory.remove(logs, LOGS); logs = null; }
};
/** Put on these pieces and take off every other. */
const wear = (ids: string[]): void => {
  for (const slot of ['head', 'chest', 'arms', 'legs', 'feet', 'offhand'] as Slot[]) g.equip(slot, null);
  for (const id of ids) g.equip(id === SHIELD ? 'offhand' : ([...PLATE, ...LEATHER].find(([p]) => p === id)?.[1] as Slot), pieces.get(id) ?? null);
};
/** That body as the island had it when it timed the go. */
const asTimed = (t: Timed): Game => {
  g.skills.values.set('fighting', t.fighting);
  g.skills.values.set('body_control', t.control);
  g.player.stats.stamina = t.stamina;
  g.player.wounds = t.wounds;
  return g;
};
const card = (): number => g.swingTime(SWORD, sword).secs;
const fresh = (t: Timed): number => swingSeconds(SWORD.swing, t.fighting, g.controlSpeed());

const PLATE_IDS = PLATE.map(([id]) => id);
const PART_IDS = PART.map(([id]) => id);
const LEATHER_IDS = LEATHER.map(([id]) => id);
const leather = armourBy(LEATHER_IDS);
const full = armourBy(PLATE_IDS);
const part = armourBy(PART_IDS);
const over = 1 + OVERBURDEN_SWING;

{
  const set = heaviestSet();
  check(`the heaviest set as it counts is plate and a metal shield, ${set.kg} kg counting ${set.counted} kg, and a counted kilogram of it is ${finePercent(armourSwingKg())} of a swing`,
    set.pieces.join() === [...PLATE_IDS, SHIELD].join() && near(set.kg, kgOf(set.pieces)) && near(set.counted, countedOf(set.pieces))
      && near(armourSwingKg() * set.counted, ARMOUR_SWING_FULL),
    `${set.pieces.join(', ')}: ${set.kg} kg, counting ${set.counted} kg`);
  check(`leather weighs ${LEATHER_KG} kg and counts for ${ARMOUR_SWING_BY.leather} of it, plate ${PLATE_KG} kg and ${ARMOUR_SWING_BY.plate} of it`,
    near(kgOf(LEATHER_IDS), LEATHER_KG) && near(kgOf(PLATE_IDS), PLATE_KG)
      && near(countedOf(LEATHER_IDS), LEATHER_KG * ARMOUR_SWING_BY.leather) && near(countedOf(PLATE_IDS), PLATE_KG * ARMOUR_SWING_BY.plate),
    `leather ${kgOf(LEATHER_IDS)} kg counting ${countedOf(LEATHER_IDS)}, plate ${kgOf(PLATE_IDS)} kg counting ${countedOf(PLATE_IDS)}`);
  check(`full plate adds its ${kgOf(PLATE_IDS)} kg's share, ${percent(full - 1)}, no more than ${percent(ARMOUR_SWING_FULL)}`,
    full > 1 && full - 1 <= ARMOUR_SWING_FULL + 1e-12, `${full}`);
}
{
  const [, limit, driving, load] = island('WAGONED').split('|');
  const [kgU, limitU] = island('UNDER').split('|').map(Number);
  const [kgO, limitO] = island('OVER').split('|').map(Number);
  check('the island had the pack under the limit with plate and a shield in it, over it with logs, and a wagon driven with more in it than a back takes',
    kgU <= limitU && kgO > limitO && driving !== 'none' && Number(load) > Number(limit),
    `under ${kgU}/${limitU}, over ${kgO}/${limitO}, wagon ${load} kg, driving ${driving}`);
}

for (const f of SKILLS) {
  laden(false);
  const t = timed(`BARE:${f}`);
  wear([]);
  asTimed(t);
  const mine = g.duration(ATTACK);
  check(`a short sword at fighting ${f}, nothing on, under the limit: as before, on the island, in the browser and on the card`,
    near(t.secs, mine) && near(mine, card()) && near(mine, fresh(t)) && g.overloaded() === 0
      && t.secs <= SWORD.swing + 1e-9 && t.secs >= SWING_FLOOR - 1e-9,
    `island ${t.secs}, browser ${mine}, card ${card()}, at fighting ${t.fighting}`);

  const p = timed(`PLATE:${f}`);
  wear(PLATE_IDS);
  asTimed(p);
  check(`a short sword at fighting ${f} in full plate: ${percent(full - 1)} longer, on both sides and on the card`,
    near(p.secs, g.duration(ATTACK)) && near(p.secs, card()) && near(p.secs, fresh(p) * full),
    `island ${p.secs}, browser ${g.duration(ATTACK)}, card ${card()}, fresh ${fresh(p)}`);

  laden(true);
  const o = timed(`OVER:${f}`);
  wear([]);
  asTimed(o);
  check(`a short sword at fighting ${f}, nothing on, over the limit: ${percent(OVERBURDEN_SWING)} longer, on both sides and on the card`,
    g.overloaded() > 0 && near(o.secs, g.duration(ATTACK)) && near(o.secs, card()) && near(o.secs, fresh(o) * over),
    `island ${o.secs}, browser ${g.duration(ATTACK)}, card ${card()}, fresh ${fresh(o)}`);

  const b = timed(`BOTH:${f}`);
  wear(PLATE_IDS);
  asTimed(b);
  check(`a short sword at fighting ${f} in full plate and over the limit: both, ×${+(full * over).toFixed(4)}`,
    near(b.secs, g.duration(ATTACK)) && near(b.secs, card()) && near(b.secs, fresh(b) * full * over),
    `island ${b.secs}, browser ${g.duration(ATTACK)}, card ${card()}, fresh ${fresh(b)}`);
}

laden(false);
{
  const t = timed('PART');
  wear(PART_IDS);
  asTimed(t);
  check(`a helm and a breastplate, ${kgOf(PART_IDS)} kg: ${percent(part - 1)} longer, in proportion to full plate's ${percent(full - 1)}`,
    near(t.secs, g.duration(ATTACK)) && near(t.secs, fresh(t) * part)
      && near((part - 1) / (full - 1), countedOf(PART_IDS) / countedOf(PLATE_IDS)),
    `island ${t.secs}, browser ${g.duration(ATTACK)}, fresh ${fresh(t)}`);
}
{
  const t = timed('SHIELD');
  wear([...PLATE_IDS, SHIELD]);
  asTimed(t);
  check(`plate and a metal shield, the heaviest set: exactly ${percent(ARMOUR_SWING_FULL)} longer`,
    near(t.secs, g.duration(ATTACK)) && near(t.secs, fresh(t) * (1 + ARMOUR_SWING_FULL)),
    `island ${t.secs}, browser ${g.duration(ATTACK)}, fresh ${fresh(t)}`);
}
{
  const t = timed('LEATHER');
  wear(LEATHER_IDS);
  asTimed(t);
  const browser = g.swingBurden().armour;
  const islandLeather = Number(said.get('BURDEN:LEATHER'));
  check(`a full set of leather, ${LEATHER_KG} kg counting ${LEATHER_KG * ARMOUR_SWING_BY.leather} kg: ${finePercent(leather - 1)} longer, on both sides, on the card and in swing_burden`,
    near(t.secs, g.duration(ATTACK)) && near(t.secs, card()) && near(t.secs, fresh(t) * leather) && near(browser, leather) && near(islandLeather, leather),
    `island ${t.secs} (burden ${islandLeather}), browser ${g.duration(ATTACK)} (burden ${browser}), card ${card()}, fresh ${fresh(t)}`);
  wear(PLATE_IDS);
  const plate = g.swingBurden().armour;
  const islandPlate = Number(said.get('BURDEN:PLATE'));
  check(`a full set of plate, ${PLATE_KG} kg counting ${PLATE_KG * ARMOUR_SWING_BY.plate} kg: ${finePercent(full - 1)} longer in swing_burden, on both sides`,
    near(plate, full) && near(islandPlate, full), `island ${islandPlate}, browser ${plate}, worked out ${full}`);
  check(`so a kilogram of leather slows a swing ${+(ARMOUR_SWING_BY.leather / ARMOUR_SWING_BY.plate).toFixed(4)} times what a kilogram of plate does, on the island`,
    near(((islandLeather - 1) / LEATHER_KG) / ((islandPlate - 1) / PLATE_KG), ARMOUR_SWING_BY.leather / ARMOUR_SWING_BY.plate),
    `${(islandLeather - 1) / LEATHER_KG} against ${(islandPlate - 1) / PLATE_KG} a kilogram`);
  const piece = (compareLines(g, g.inventory.get(pieces.get('plate_breastplate') as number)!) ?? [])
    .map((l) => (typeof l === 'string' ? l : l.text)).find((l) => l.startsWith('Swing or draw time'));
  check('the card a breastplate shows says what it adds to every swing, at its counted kilograms',
    piece === `Swing or draw time +${finePercent(countedOf(['plate_breastplate']) * armourSwingKg())}`, piece ?? 'no line');
}
{
  const t = timed('WAGON');
  wear([]);
  asTimed(t);
  const wagon = g.addFurniture('wagon', 18, 20, 0, 0, 50, [{ uid: g.inventory.nextUid++, id: 'log', ql: 30, dmg: 0, count: WAGON_LOGS }], 'Pine');
  wagon.driven = true;
  check(`driving a wagon with ${WAGON_LOGS} logs in it, the pack under the limit: no slower, on both sides`,
    g.overloaded() === 0 && near(t.secs, g.duration(ATTACK)) && near(t.secs, fresh(t)),
    `island ${t.secs}, browser ${g.duration(ATTACK)}, fresh ${fresh(t)}`);
  wagon.driven = false;
}

laden(true);
wear(PLATE_IDS);
for (const [k, what] of [['TIRED', 'tired arms slow'], ['WOUNDED', 'a wounded arm slows']] as const) {
  const t = timed(k);
  asTimed(t);
  const plain = fresh(t) * full * over;
  check(`${what} a swing in plate and over the limit by the same on both sides, on top of both`,
    near(t.secs, g.duration(ATTACK)) && near(t.secs, card()) && t.secs > plain,
    `island ${t.secs}, browser ${g.duration(ATTACK)}, without ${plain}`);
  asTimed({ ...t, stamina: 1, wounds: [] });
}

for (const k of ['ASKED', 'TURNED']) {
  const t = timed(k);
  asTimed(t);
  check(`a fight ${k === 'ASKED' ? 'asked for' : 'turned on at a bite'} in plate and over the limit is timed as the swing after it`,
    near(t.secs, g.duration(ATTACK)) && near(t.secs, fresh(t) * full * over), `island ${t.secs}, browser ${g.duration(ATTACK)}`);
}

{
  const t = timed('BOTH:20');
  asTimed(t);
  const note = swingNote(g.swingTime(SWORD, sword));
  const line = (compareLines(g, sword) ?? []).map((l) => (typeof l === 'string' ? l : l.text)).find((l) => l.startsWith('Swing time'));
  check('the card says the seconds and names armour and being overburdened with their shares',
    (line?.startsWith(`Swing time ${g.duration(ATTACK).toFixed(2)} s`) ?? false)
      && note.includes(`armour ${kgOf(PLATE_IDS).toFixed(1)} kg, counting ${countedOf(PLATE_IDS).toFixed(1)} kg +${percent(full - 1)}`)
      && note.includes(`overburdened +${percent(OVERBURDEN_SWING)}`),
    `${line ?? 'no line'} / ${note}`);
}

{
  // In plate and over the limit, mining takes what it always took.
  g.skills.values.set('mining', 50);
  const inPlate = g.duration(MINE);
  laden(false);
  wear([]);
  const bare = g.duration(MINE);
  const jobs = [1, 50, 100].map((x) => island(`JOB:${x}`).split('|').map(Number));
  check('mining and every other job are timed as they were, in plate and over the limit, on both sides',
    near(inPlate, bare) && jobs.every(([go, was, burden], i) => burden === 1 && near(go, was) && near(go, goSeconds(8, [1, 50, 100][i], 40, 1))),
    `browser ${inPlate} / ${bare}; island ${jobs.map((j) => j.join('/')).join(', ')}`);
}

{
  const t = { fighting: 30, control: CHAR_START, stamina: 1, wounds: [] as Wound[], secs: 0 };
  asTimed(t);
  g.skills.values.set('archery', 30);
  const wrong: string[] = [];
  const paces = new Set<number>();
  for (const w of WEAPONS) {
    g.equip('weapon', g.inventory.add(w.id, { ql: 40 }).uid);
    g.player.stats.stamina = 1;
    const mine = g.duration(w.ammo ? SHOOT : ATTACK);
    const theirs = Number(island(`W:${w.id}`));
    if (!near(mine, theirs) || !near(mine, swingSeconds(w.swing, 30, g.controlSpeed()))) wrong.push(`${w.id} island ${theirs}, browser ${mine}`);
    if (!w.ammo) paces.add(Math.round(mine * 1000));
  }
  check('every weapon at fighting 30, nothing else on, swings or draws at its own pace, the same on both sides', wrong.length === 0 && paces.size > 3,
    wrong.join('; ') || `${paces.size} paces among the melee weapons`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a swing takes the seconds its weapon says, and longer in armour and over the limit — ${ok.length} of ${ok.length}`);

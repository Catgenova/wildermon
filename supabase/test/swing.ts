/**
 * A swing takes the seconds its weapon says.
 *
 * Reported: "i've got a short sword that says it should be 2 seconds per
 * attack but in combat it takes me 5 seconds per attack, is that my plate
 * armor/wagon slowing me down". Neither: a go of a fight was priced as a job
 * weight, at `ACTION_PACE` seconds to the unit and never under the job floor,
 * so a short sword swung every 7.5 seconds before skill and every melee weapon
 * every 4.5 seconds from fighting 56 up. What this asks of both sides
 * (`swingSeconds`, `Game.duration`; `go_secs`, `settle`, `rpc_act`,
 * `fight_back`):
 *
 *   * a short sword in the hand, at fighting 1, 20, 47 and 70, swings every
 *     2 seconds less a part in 140 a point of fighting, never under the floor,
 *     the next go timed by `settle` as the browser times it;
 *   * plate on every place it goes, a pack far over what a back takes and a
 *     wagon you are driving leave that time as it was, on both sides;
 *   * tired arms and wounded ones slow it by the same on both sides;
 *   * every melee weapon swings at its own pace at fighting 30, and a bow
 *     draws at its own;
 *   * a fight asked for (`rpc_act`) and a bite turned on (`fight_back`) are
 *     timed the same as the go after;
 *   * every other job is timed as it was (`act_duration`, `goSeconds`);
 *   * the card a weapon shows says the seconds the fight takes.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { SWING_FLOOR, swingSeconds } from '../../src/game/fight';
import { CHAR_START, Game, goSeconds } from '../../src/game/game';
import { WEAPON_BY_ID, WEAPONS } from '../../src/game/gear';
import type { Wound } from '../../src/game/wounds';
import { compareLines } from '../../src/ui/compare';
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
if (!ATTACK || !SHOOT) throw new Error('no fight');
const SWORD = WEAPON_BY_ID.get('short_sword');
if (!SWORD) throw new Error('no short sword');
const SKILLS = [1, 20, 47, 70];
const PLATE: Array<[string, string]> = [['helm', 'head'], ['plate_breastplate', 'chest'], ['plate_arms', 'arms'], ['plate_legs', 'legs'], ['plate_boots', 'feet']];
const LOGS = 40;
const TIRED = 0.2;
const ARM_WOUNDS: Wound[] = [{ id: 1, kind: 'cut', part: 'arms', severity: 0.08, bleeding: false, infected: false, dressing: null, at: 0 } as Wound];

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
do $b$
declare w record; v_px double precision; v_py double precision; v_ogre int; v_sword bigint; v_eq jsonb; v_plated jsonb;
        f int; v_item bigint; s text[]; r record; v_cart placed; v_ctl double precision;
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

  -- A short sword, nothing else on.
  foreach f in array array[${SKILLS.join(', ')}] loop
    perform pg_temp.fresh(w.world_id, w.uid, f, 1, v_eq);
    insert into said values ('BARE:' || f, pg_temp.next_go(w.world_id, w.uid, v_ogre));
  end loop;

  -- Plate on every place it goes, a pack of logs, and a wagon you are driving.
  v_plated := v_eq;
  foreach s slice 1 in array array[${PLATE.map(([id, slot]) => `['${id}', '${slot}']`).join(', ')}] loop
    v_item := give(w.world_id, w.uid, s[1], 1, 40, 'iron');
    v_plated := v_plated || jsonb_build_object(s[2], v_item);
  end loop;
  perform give(w.world_id, w.uid, 'log', ${LOGS}, 30);
  v_item := give(w.world_id, w.uid, 'wagon', 1, 50, 'Pine');
  perform act_perform(w.world_id, w.uid, 'place_furniture',
    jsonb_build_object('kind', 'item', 'uid', v_item, 'x', floor(v_px)::int - 3, 'y', floor(v_py)::int, 'sx', 0, 'sy', 0));
  select * into v_cart from placed where world_id = w.world_id and sub = 'wagon' and made_by = w.uid order by id desc limit 1;
  update placed set driver = w.uid where world_id = w.world_id and id = v_cart.id;
  insert into said values ('LADEN', (select coalesce(sum(i.count * idf.weight), 0) from item i join item_def idf on idf.id = i.def
      where i.world_id = w.world_id and i.holder = 'player' and i.holder_uid = w.uid)
    || '|' || carry_limit(w.world_id, w.uid) || '|' || coalesce((driving(w.world_id, w.uid)).id::text, 'none'));
  foreach f in array array[${SKILLS.join(', ')}] loop
    perform pg_temp.fresh(w.world_id, w.uid, f, 1, v_plated);
    insert into said values ('PLATED:' || f, pg_temp.next_go(w.world_id, w.uid, v_ogre));
  end loop;
  update placed set driver = null where world_id = w.world_id and id = v_cart.id;

  -- Tired arms, and wounded ones.
  perform pg_temp.fresh(w.world_id, w.uid, 20, ${TIRED}, v_plated);
  insert into said values ('TIRED', pg_temp.next_go(w.world_id, w.uid, v_ogre));
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_plated);
  update player set wounds = '${JSON.stringify(ARM_WOUNDS)}'::jsonb where world_id = w.world_id and uid = w.uid;
  insert into said values ('WOUNDED', pg_temp.next_go(w.world_id, w.uid, v_ogre));

  -- Every weapon there is at fighting and archery 30, timed as \`settle\` times it.
  insert into skill (world_id, uid, id, value) values (w.world_id, w.uid, 'archery', 30)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  for r in select id, ammo is not null as bow from weapon_def order by id loop
    perform pg_temp.fresh(w.world_id, w.uid, 30, 1, jsonb_build_object('weapon', give(w.world_id, w.uid, r.id, 1, 40)));
    v_ctl := control_speed(w.world_id, w.uid);
    insert into said values ('W:' || r.id, go_secs(case when r.bow then 'shoot_creature' else 'attack_creature' end,
      act_base(w.world_id, w.uid, case when r.bow then 'shoot_creature' else 'attack_creature' end, 2.5),
      skill_of(w.world_id, w.uid, case when r.bow then 'archery' else 'fighting' end), 0, v_ctl)::text);
  end loop;

  -- A fight asked for, and a bite turned on, with the short sword at fighting 20.
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_eq);
  delete from caller where uid = w.uid;
  perform rpc_act(w.world_id, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', v_ogre), 100);
  insert into said select 'ASKED', pg_temp.timed(p, w.world_id, w.uid) from player p where world_id = w.world_id and uid = w.uid;
  perform pg_temp.fresh(w.world_id, w.uid, 20, 1, v_eq);
  perform fight_back(w.world_id, w.uid, v_ogre);
  insert into said select 'TURNED', pg_temp.timed(p, w.world_id, w.uid) from player p where world_id = w.world_id and uid = w.uid;

  -- And a job that is not a fight, at the pace and on the floor it always had.
  insert into said select 'JOB:' || x, go_secs('mine', 8, x, 40, 1) || '|' || act_duration(8, x, 40, 1)
    from unnest(array[1, 50, 100]) x;
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

/** A body on level grass with a short sword in its hand, and plate, a pack of logs, or neither. */
const body = (plated: boolean): Game => {
  const g = Game.create(4242);
  const w = g.world;
  for (let y = 16; y <= 26; y++) for (let x = 16; x <= 26; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); }
  for (let y = 16; y <= 25; y++) for (let x = 16; x <= 25; x++) w.setTile(x, y, TileType.Grass, 0);
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.player.stats.health = 1;
  g.equip('weapon', g.inventory.add('short_sword', { ql: 40 }).uid);
  if (plated) {
    for (const [id, slot] of PLATE) g.equip(slot as Parameters<Game['equip']>[0], g.inventory.add(id, { ql: 40 }).uid);
    g.inventory.add('log', { ql: 30, count: LOGS });
  }
  return g;
};
/** That body as the island had it when it timed the go. */
const asTimed = (g: Game, t: Timed): Game => {
  g.skills.values.set('fighting', t.fighting);
  g.skills.values.set('body_control', t.control);
  g.player.stats.stamina = t.stamina;
  g.player.wounds = t.wounds;
  return g;
};

const bare = body(false);
const plated = body(true);
for (const f of SKILLS) {
  const t = timed(`BARE:${f}`);
  const g = asTimed(bare, t);
  const mine = g.duration(ATTACK);
  const card = g.swingTime(SWORD, g.worn('weapon') ?? null).secs;
  check(`a short sword at fighting ${f}: the island times the next swing as the browser does, and as the card says`,
    near(t.secs, mine) && near(mine, card) && near(mine, swingSeconds(SWORD.swing, t.fighting, g.controlSpeed())),
    `island ${t.secs}, browser ${mine}, card ${card}, at fighting ${t.fighting}`);
  check(`a short sword at fighting ${f}: its own ${SWORD.swing} seconds less skill, no more than that and never under the ${SWING_FLOOR.toFixed(1)} s floor`,
    t.secs <= SWORD.swing + 1e-9 && t.secs >= SWING_FLOOR - 1e-9
      && near(t.secs, Math.max(SWING_FLOOR, SWORD.swing * (1 - t.fighting / 140) * g.controlSpeed())),
    `${t.secs} s`);
  const p = timed(`PLATED:${f}`);
  const gp = asTimed(plated, p);
  check(`a short sword at fighting ${f} in plate, with a full pack, driving a wagon: no slower, on both sides`,
    near(p.secs, gp.duration(ATTACK)) && near(p.secs, swingSeconds(SWORD.swing, p.fighting, gp.controlSpeed()))
      && gp.burden() > 0.2 && gp.overloaded() > 0,
    `island ${p.secs}, browser ${gp.duration(ATTACK)}; burden ${gp.burden().toFixed(2)}`);
}
{
  const [kg, limit, driving] = island('LADEN').split('|');
  check('the island had the pack over what the back takes, and the wagon driven', Number(kg) > Number(limit) && driving !== 'none', island('LADEN'));
}

for (const [k, what] of [['TIRED', 'tired arms slow'], ['WOUNDED', 'a wounded arm slows']] as const) {
  const t = timed(k);
  const g = asTimed(plated, t);
  const fresh = swingSeconds(SWORD.swing, t.fighting, g.controlSpeed());
  check(`${what} a swing by the same on both sides`, near(t.secs, g.duration(ATTACK)) && t.secs > fresh,
    `island ${t.secs}, browser ${g.duration(ATTACK)}, fresh ${fresh}`);
  asTimed(plated, { ...t, stamina: 1, wounds: [] });
}

{
  const g = body(false);
  g.skills.values.set('fighting', 30);
  g.skills.values.set('archery', 30);
  g.skills.values.set('body_control', CHAR_START);
  const bad: string[] = [];
  const paces = new Set<number>();
  for (const w of WEAPONS) {
    g.equip('weapon', g.inventory.add(w.id, { ql: 40 }).uid);
    g.player.stats.stamina = 1;
    const mine = g.duration(w.ammo ? SHOOT : ATTACK);
    const theirs = Number(island(`W:${w.id}`));
    if (!near(mine, theirs) || !near(mine, swingSeconds(w.swing, 30, g.controlSpeed()))) bad.push(`${w.id} island ${theirs}, browser ${mine}`);
    if (!w.ammo) paces.add(Math.round(mine * 1000));
  }
  check('every weapon at fighting 30 swings or draws at its own pace, the same on both sides', bad.length === 0 && paces.size > 3,
    bad.join('; ') || `${paces.size} paces among the melee weapons`);
}

for (const k of ['ASKED', 'TURNED']) {
  const t = timed(k);
  const g = asTimed(bare, t);
  check(`a fight ${k === 'ASKED' ? 'asked for' : 'turned on at a bite'} is timed as the swing after it`,
    near(t.secs, g.duration(ATTACK)), `island ${t.secs}, browser ${g.duration(ATTACK)}`);
}

for (const x of [1, 50, 100]) {
  const [go, was] = island(`JOB:${x}`).split('|').map(Number);
  check(`a go of mining at skill ${x} is timed as it always was`, near(go, was) && near(go, goSeconds(8, x, 40, 1)),
    `go_secs ${go}, act_duration ${was}, browser ${goSeconds(8, x, 40, 1)}`);
}

{
  const g = asTimed(bare, timed('BARE:20'));
  const line = (compareLines(g, g.worn('weapon') ?? bare.inventory.items[0]) ?? [])
    .map((l) => (typeof l === 'string' ? l : l.text)).find((l) => l.startsWith('A swing every'));
  check('the card says the seconds a swing takes in your hands', line?.startsWith(`A swing every ${g.duration(ATTACK).toFixed(2)} s`) ?? false,
    line ?? 'no line');
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a swing takes the seconds its weapon says — ${ok.length} of ${ok.length}`);

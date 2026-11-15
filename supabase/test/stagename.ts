/**
 * An evolved wildermon is named for its stage in a fight and on its carcass.
 *
 * Reported: "evolved forms of wildermon appear as their base form in combat logs and corpses, eg a bunnycourser's
 * corpse is shown as a thistlekit". The fight, the kill and the carcass took the line's name (`species_def.name`,
 * `SpeciesDef.name`) where the stage's (`kind_name_at`, `stageName`) was meant
 * (`20261120000080_stage_names.sql`). This fights a second-stage Thistlekit (a Bunnycourser), a third-stage Sparra
 * line (a Dummititan) and a first-stage Thistlekit, on the island and in the browser, and asks:
 *
 *   * every fight line naming it, both ways, names its stage: blows, shots, a dodge of its blow, fighting back, the
 *     kill, and a companion's kill told to its keeper; and never the line's first name;
 *   * its carcass carries its stage's name: on the ground, Examine, picked up into the pack, and Butchered; and a
 *     carcass left by old age, by a blow taken for its keeper and by a cull, the same;
 *   * a first stage is still called its line's name;
 *   * in the browser, a blow, a miss, the kill, the carcass (on the ground and its name), Butchered, and the line that
 *     sums up a fight from the island's lines name the stage.
 *
 * The island half makes its own island and rolls it back.
 */
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { corpseKind } from '../../src/game/butcher';
import { EVOLVE_AT, levelSkill, stageName, SPECIES } from '../../src/game/creatures';
import { Game } from '../../src/game/game';
import { itemName, type Item } from '../../src/game/items';
import { TileType } from '../../src/world/tiles';
import { psql, ok, bad, check } from './harness';

const LINE = SPECIES.orse;
const BASE = LINE.name;
const SECOND = LINE.stages![0].name;
const OTHER = SPECIES.sparra;
const THIRD = OTHER.stages![1].name;
const U = '5a5a5a5a-0000-4000-8000-000000000628';
const low = (s: string): string => s.toLowerCase();

/* ---- the island ------------------------------------------------------------ */

/** One kind at one level, fought to the death by `U` on the island: what was said, and what its carcass is. */
const fight = (kind: string, level: number, tag: string): string => `
  -- ${tag}: struck, shot at, its blow dodged, fought back, and killed.
  c := creature_spawn(w, '${kind}', px + 0.8, py, 'wild', now() - interval '60 days');
  update creature set traits = '{}', rare = null, skills = jsonb_build_object(level_skill('${kind}'), ${level}) where world_id = w and id = c;
  update creature set health = 1e6 where world_id = w and id = c;
  insert into said (k, v) select '${tag}:NAME', name || '|' || stage_of(cr) from creature cr where world_id = w and id = c;
  select coalesce(max(n), 0) into mark from event where world_id = w;
  update player set equipped = jsonb_build_object('weapon', v_knife), x = px, y = py where world_id = w and uid = u;
  for i in 1..30 loop
    update creature set from_x = px + 0.8, from_y = py, to_x = px + 0.8, to_y = py, leg_at = now(), leg_ends = now(),
        until = now() + interval '1 hour', settled_at = now(), hunting = null, brawl = null where world_id = w and id = c;
    update player set stats = stats || jsonb_build_object('stamina', 1, 'health', 1) where world_id = w and uid = u;
    perform perform_fight(w, u, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', c));
  end loop;
  update player set equipped = jsonb_build_object('weapon', v_bow) where world_id = w and uid = u;
  perform give(w, u, 'arrow', 10, 40);
  for i in 1..6 loop
    update creature set from_x = px + 4, from_y = py, to_x = px + 4, to_y = py, leg_at = now(), leg_ends = now(),
        until = now() + interval '1 hour', settled_at = now(), hunting = null, brawl = null where world_id = w and id = c;
    update player set stats = stats || jsonb_build_object('stamina', 1, 'health', 1) where world_id = w and uid = u;
    perform perform_fight(w, u, 'shoot_creature', jsonb_build_object('kind', 'creature', 'id', c));
  end loop;
  update creature set from_x = px + 0.8, from_y = py, to_x = px + 0.8, to_y = py, leg_at = now(), leg_ends = now(),
      until = now() + interval '1 hour', settled_at = now() where world_id = w and id = c;
  update player set stats = stats || jsonb_build_object('aegis', 1000), equipped = jsonb_build_object('weapon', v_knife)
    where world_id = w and uid = u;
  for i in 1..40 loop
    perform mark_attacker(w, u, c);
    perform hurt_player(w, u, 0.001, 'blow', 'bite');
  end loop;
  update player set act = null, act_target = null, act_queue = '[]'::jsonb, moved_at = now() - interval '1 minute',
      fight_back = true, stats = stats || jsonb_build_object('stamina', 1, 'health', 1, 'aegis', 0) where world_id = w and uid = u;
  perform fight_back(w, u, c);
  update player set act = null, act_target = null, act_queue = '[]'::jsonb where world_id = w and uid = u;
  update creature set health = 0.01 where world_id = w and id = c;
  for i in 1..60 loop
    exit when not exists (select 1 from creature where world_id = w and id = c);
    update creature set from_x = px + 0.8, from_y = py, to_x = px + 0.8, to_y = py, leg_at = now(), leg_ends = now(),
        until = now() + interval '1 hour', settled_at = now() where world_id = w and id = c;
    update player set stats = stats || jsonb_build_object('stamina', 1, 'health', 1) where world_id = w and uid = u;
    perform perform_fight(w, u, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', c));
  end loop;
  insert into said (k, v) values ('${tag}:DEAD', (not exists (select 1 from creature where world_id = w and id = c))::text);
  insert into said (k, v) select '${tag}:LINE', e.text from event e where e.world_id = w and e.uid = u and e.n > mark and e.kind = 'fight' order by e.n;
  -- Its carcass: on the ground, Examine, into the pack, Examine there, and butchered from it.
  select * into it from item where world_id = w and def = 'corpse' and holder = 'ground' order by id desc limit 1;
  insert into said (k, v) values ('${tag}:GROUND', coalesce(it.extra, '-') || '|' || coalesce(item_name(it), '-'));
  select coalesce(max(n), 0) into mark from event where world_id = w;
  perform act_perform(w, u, 'examine_item', jsonb_build_object('kind', 'item', 'uid', it.id));
  perform act_perform(w, u, 'pick_up', jsonb_build_object('kind', 'ground', 'x', it.gx, 'y', it.gy, 'uid', it.id));
  select * into it from item where id = it.id;
  insert into said (k, v) values ('${tag}:PACK', it.holder || '|' || item_name(it));
  perform act_perform(w, u, 'examine_item', jsonb_build_object('kind', 'item', 'uid', it.id));
  update player set stats = stats || jsonb_build_object('stamina', 1) where world_id = w and uid = u;
  perform act_perform(w, u, 'butcher', jsonb_build_object('kind', 'item', 'uid', it.id));
  insert into said (k, v) select '${tag}:SAID', e.text from event e where e.world_id = w and e.uid = u and e.n > mark order by e.n;
`;

const isle = psql(`
begin;
create temp table said (i serial, k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; c int; k int; i int; mark bigint; it item; px double precision; py double precision;
        v_knife bigint; v_bow bigint;
begin
  perform setseed(0.628);
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stagename', 628, 48, 12, 24, true) returning id into w;
  perform land_blank(w, 48);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 47) x, generate_series(0, 47) y;
  perform land_set_height(w, x, y, 10) from generate_series(0, 48) x, generate_series(0, 48) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Tester');
  -- Off the safe ring round the spawn, where things may be fought (\`at_peace\`).
  px := least(44, 12 + peace_reach() + 6) + 0.5; py := 24.5;
  update player set x = px, y = py, act = null, act_queue = '[]'::jsonb, level = 0, away = false, fight_stance = 'balanced',
      stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1, 'aegis', 0)
    where world_id = w and uid = u;
  delete from creature where world_id = w;
  insert into skill (world_id, uid, id, value)
    select w, u, s, 100 from unnest(array['fighting', 'knives', 'archery', 'body_control', 'butchering']) s
    on conflict (world_id, uid, id) do update set value = excluded.value;
  v_knife := give(w, u, 'hunting_knife', 1, 60);
  v_bow := give(w, u, 'short_bow', 1, 60);
  perform give(w, u, 'butchering_knife', 1, 60);
${fight('orse', EVOLVE_AT[0], 'SECOND')}
${fight('sparra', EVOLVE_AT[1], 'THIRD')}
${fight('orse', 1, 'FIRST')}

  -- A companion's kill, told to its keeper.
  k := creature_spawn(w, 'orse', px - 1, py, 'active', now() - interval '60 days', u);
  update creature set name = 'Biscuit' where world_id = w and id = k;
  c := creature_spawn(w, 'orse', px + 1, py, 'wild', now() - interval '60 days');
  update creature set skills = jsonb_build_object(level_skill('orse'), ${EVOLVE_AT[0]}) where world_id = w and id = c;
  select coalesce(max(n), 0) into mark from event where world_id = w;
  perform wound_beast(w, c, 1e9, null, null, null, k);
  insert into said (k, v) select 'COMPANION', e.text from event e where e.world_id = w and e.uid = u and e.n > mark;
  delete from creature where world_id = w and id = k;

  -- Carcasses left by old age, by a blow taken for its keeper, and by a cull.
  delete from item where world_id = w and def = 'corpse';
  c := creature_spawn(w, 'orse', px + 2, py + 2, 'wild', now() - interval '60 days');
  update creature set skills = jsonb_build_object(level_skill('orse'), ${EVOLVE_AT[0]}), born = now() - interval '100000 days' where world_id = w and id = c;
  perform old_age_sweep(w);
  insert into said (k, v) select 'OLD', coalesce(string_agg(extra, ','), '-') from item where world_id = w and def = 'corpse';
  delete from item where world_id = w and def = 'corpse';
  c := creature_spawn(w, 'orse', px + 1, py, 'active', now() - interval '60 days', u);
  update creature set skills = jsonb_build_object(level_skill('orse'), ${EVOLVE_AT[0]}) where world_id = w and id = c;
  perform class_beast_take(w, c, 1e9, null);
  insert into said (k, v) select 'TAKEN', coalesce(string_agg(extra, ','), '-') from item where world_id = w and def = 'corpse';
  delete from item where world_id = w and def = 'corpse';
  c := creature_spawn(w, 'orse', px + 1, py, 'active', now() - interval '60 days', u);
  update creature set skills = jsonb_build_object(level_skill('orse'), ${EVOLVE_AT[0]}), name = 'Pudding' where world_id = w and id = c;
  select coalesce(max(n), 0) into mark from event where world_id = w;
  perform perform_creature(w, u, 'cull_creature', jsonb_build_object('kind', 'creature', 'id', c));
  insert into said (k, v) select 'CULLED', coalesce(string_agg(extra, ','), '-') from item where world_id = w and def = 'corpse';
  insert into said (k, v) select 'CULL', e.text from event e where e.world_id = w and e.uid = u and e.n > mark;
end $t$;
select k || '|' || v from said order by i;
rollback;
`);

const all = (k: string): string[] => isle.split('\n').filter((l) => l.startsWith(`${k}|`)).map((l) => l.slice(k.length + 1));
const one = (k: string): string => all(k)[0] ?? 'MISSING';
const shown = (ls: string[]): string => (ls.length ? ls.slice(0, 6).join(' / ') : 'nothing');

console.log('--- the island');
for (const [tag, name, wrong] of [['SECOND', SECOND, BASE], ['THIRD', THIRD, OTHER.name], ['FIRST', BASE, SECOND]] as const) {
  const lines = all(`${tag}:LINE`);
  const said = all(`${tag}:SAID`);
  const n = low(name);
  check(`${tag}: it is a ${name}`, one(`${tag}:NAME`).startsWith(`${name}|`), one(`${tag}:NAME`));
  check(`${tag}: a blow says "${n}"`, lines.some((l) => l.startsWith('Hit') && l.includes(`: ${n} `)), shown(lines.filter((l) => l.startsWith('Hit'))));
  check(`${tag}: an arrow says "${n}"`, lines.some((l) => /^Arrow (hit|missed)/.test(l) && l.includes(`: ${n}`)), shown(lines.filter((l) => l.startsWith('Arrow'))));
  check(`${tag}: its blow dodged says "${n}"`, lines.includes(`Dodged: ${n}.`), shown(lines.filter((l) => l.startsWith('Dodged'))));
  check(`${tag}: fighting back says "${n}"`, lines.includes(`Fighting back: ${n}.`), shown(lines.filter((l) => l.startsWith('Fighting'))));
  check(`${tag}: it dies, and the kill says "${n}"`, one(`${tag}:DEAD`) === 'true' && lines.includes(`Killed: wild ${n}.`), shown(lines.filter((l) => l.startsWith('Killed'))));
  check(`${tag}: and no fight line calls it a ${wrong}`, !lines.some((l) => l.toLowerCase().includes(low(wrong))), shown(lines.filter((l) => l.toLowerCase().includes(low(wrong)))));
  check(`${tag}: its carcass on the ground is "Corpse (${n})"`, one(`${tag}:GROUND`) === `${name}|Corpse (${n})`, one(`${tag}:GROUND`));
  check(`${tag}: Examine on the ground says it`, said[0]?.startsWith(`Corpse (${n}): Quality`) ?? false, said[0] ?? 'nothing');
  check(`${tag}: picked up, in the pack it is "Corpse (${n})"`, one(`${tag}:PACK`) === `player|Corpse (${n})`, one(`${tag}:PACK`));
  check(`${tag}: and picking it up says it`, said.includes(`Picked up: corpse (${n}).`), shown(said));
  check(`${tag}: Examine in the pack says it`, said.filter((l) => l.startsWith(`Corpse (${n}): Quality`)).length === 2, shown(said));
  check(`${tag}: Butchered says "${n}"`, said.some((l) => l.startsWith(`Butchered: ${n}. Got `)), shown(said.filter((l) => l.startsWith('Butcher'))));
}
check(`a companion's kill is told to its keeper as a ${SECOND}`, all('COMPANION').includes(`Biscuit killed a wild ${low(SECOND)}.`), shown(all('COMPANION')));
check(`a ${SECOND} dead of old age leaves a ${SECOND} carcass`, one('OLD') === SECOND, one('OLD'));
check(`one dead of a blow taken for its keeper, the same`, one('TAKEN') === SECOND, one('TAKEN'));
check(`one culled, the same, and the cull says so`, one('CULLED') === SECOND && all('CULL').includes(`Culled: Pudding. ${SECOND} carcass left.`), `${one('CULLED')}; ${shown(all('CULL'))}`);

/* ---- the browser ----------------------------------------------------------- */

console.log('--- the browser');
const game = Game.create(628, 256);
const cx = game.spawn.x, cy = game.spawn.y;
for (let y = cy - 12; y <= cy + 13; y++) for (let x = cx - 12; x <= cx + 13; x++) game.world.setHeight(x, y, Math.max(4, game.world.getHeight(cx, cy)));
for (let y = cy - 12; y <= cy + 12; y++) for (let x = cx - 12; x <= cx + 12; x++) game.world.setTile(x, y, TileType.Grass);
game.putBody(cx + 0.5, cy + 0.5, 0);
for (const c of [...game.creatures.list.values()]) game.creatures.list.delete(c.id);
game.skills.values.set('fighting', 100);
game.skills.values.set('knives', 100);
game.skills.values.set('butchering', 100);
game.inventory.add('hunting_knife', { ql: 60 });
game.inventory.add('butchering_knife', { ql: 60 });
const knife = game.inventory.items.find((it) => it.id === 'hunting_knife')!;
game.equip('weapon', knife.uid);
const attack = ACTION_BY_ID.get('attack_creature')!;
const butcher = ACTION_BY_ID.get('butcher')!;

for (const [kind, level, name] of [['orse', EVOLVE_AT[0], SECOND], ['sparra', EVOLVE_AT[1], THIRD], ['orse', 1, BASE]] as const) {
  const n = low(name);
  const c = game.creatures.spawn(kind, game.player.x + 0.8, game.player.y, 'wild', game.rand, game.time - 3600 * 24 * 60);
  c.skills = { [levelSkill(SPECIES[kind])!]: level };
  c.health = 1e6;
  check(`${name}: stageName says so`, stageName(c) === name, stageName(c));
  const seen = game.log.length;
  const t: Target = { kind: 'creature', id: c.id };
  for (let i = 0; i < 40; i++) {
    c.x = game.player.x + 0.8; c.y = game.player.y; c.tx = c.x; c.ty = c.y;
    game.player.stats.stamina = 1; game.player.stats.health = 1;
    attack.perform(t, game);
  }
  const lines = game.log.slice(seen).map((l) => l.text);
  check(`${name}: a blow or a miss says "${n}"`, lines.some((l) => /^(Hit|Missed)/.test(l) && l.includes(`: ${n}`)), shown(lines));
  // The island's lines of a fight it is in, and its end: the line summing it up names the stage.
  game.fightTarget = c.id;
  game.write(`Hit: ${n} 10/60.`, 'fight');
  const before = game.log.length;
  game.creatures.kill(game, c, 'player');
  game.fightTarget = null;
  for (let i = 0; i < 4; i++) game.update(0.25);
  const after = game.log.slice(before).map((l) => l.text);
  check(`${name}: the kill says "${n}"`, after.includes(`Killed: wild ${n}.`), shown(after));
  check(`${name}: the line summing up the fight says "${name}"`, after.some((l) => l.startsWith(`${name} killed: `)), shown(after));
  const pile = game.groundAt(Math.floor(c.x), Math.floor(c.y));
  const corpse = pile.find((it) => it.id === 'corpse');
  check(`${name}: its carcass is "Corpse (${n})"`, !!corpse && corpse.extra === name && itemName(corpse) === `Corpse (${n})`, corpse ? itemName(corpse) : 'none');
  check(`${name}: and is of its stage (corpseKind)`, !!corpse && corpseKind(corpse) === name, corpse ? String(corpseKind(corpse)) : 'none');
  if (corpse) {
    const at = game.log.length;
    game.requestAction(butcher, { kind: 'ground', x: Math.floor(c.x), y: Math.floor(c.y), uid: corpse.uid });
    for (let i = 0; i < 400 && game.action; i++) game.update(0.25);
    const b = game.log.slice(at).map((l) => l.text);
    check(`${name}: Butchered says "${n}"`, b.some((l) => l.startsWith(`Butchered: ${n}. Got `)), shown(b));
  }
}
// A monster of a subspecies leaves a carcass of its kind, as the island's does, and it can be butchered.
{
  const gob = game.creatures.spawn('goblin', game.player.x + 0.8, game.player.y, 'wild', game.rand, game.time - 3600 * 24 * 60);
  game.creatures.kill(game, gob, 'player');
  const corpse = game.groundAt(Math.floor(gob.x), Math.floor(gob.y)).find((it) => it.id === 'corpse');
  check(`a ${SPECIES.goblin.name.toLowerCase()} of a subspecies leaves a "${SPECIES.goblin.name}" carcass, of its kind`,
    corpse?.extra === SPECIES.goblin.name && corpseKind(corpse) === SPECIES.goblin.name, `${corpse?.extra} ${corpse && corpseKind(corpse)}`);
}
// What the island sends for a carcass is named as the island names it.
for (const name of [SECOND, THIRD, BASE]) {
  const it: Item = { uid: 1, id: 'corpse', ql: 30, dmg: 0, count: 1, extra: name };
  check(`an island carcass carrying "${name}" is "Corpse (${low(name)})", of its stage`, itemName(it) === `Corpse (${low(name)})` && corpseKind(it) === name, `${itemName(it)} ${corpseKind(it)}`);
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(`an evolved wildermon is named for its stage in a fight and on its carcass — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

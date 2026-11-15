/**
 * Containers named for an item: a Chestkit moves that item into them.
 *
 * Asked for: "If a player names an eligible container on their settlement, the wildermon will transport items to that
 * container from any unmatched or unnamed containers." Asked of the island and of the browser, the same settlement
 * (`hoard.ts`, `Creatures.hoardMove`; the island's `private.hoard_move`, `hoard_take`, `hoard_into`):
 *
 *   * a name matches an item by its name, its plural or its id, any case, spaces round it ignored; the same items
 *     on both sides, for a sample of every item's name, plural and id;
 *   * naming: the owner names a chest, and the name is cut to its most; a stranger and a citizen whose rank lacks
 *     Crates and stores are refused, in the same words on both sides;
 *   * a hatchet lying about is carried first, and never into a container named for another item;
 *   * mortar out of an unnamed chest and a bin named "spill" (a source), into a chest named "Mortar" until it is full,
 *     the stack split to its room, then into a second named "MORTARS"; planks into one named " Planks ";
 *   * never out of a target (the five mortar and the dirt in "Mortar" stay), a padlocked chest or for an item no
 *     target is named for (the nails stay in "spill");
 *   * idle: nothing to move; every target full; no named container; in the same words on both sides;
 *   * and the same loads in the same order on both sides.
 *
 * The island half makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { SPECIES, workRangeOf, type Creature, type GatherKind } from '../../src/game/creatures';
import { furnitureCentre, type PlacedFurniture } from '../../src/game/furniture';
import { hoardItems, hoardPlural } from '../../src/game/hoard';
import { ITEM_DEFS, type Item } from '../../src/game/items';
import { NAME_MAX, nameThingRefusal } from '../../src/game/naming';
import { permsOf } from '../../src/game/ranks';
import { idleSays, type Idle, type IdleWhy } from '../../src/game/workerlog';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const T = 60;
const U = '7e5b0000-0000-4000-8000-000000000a01';
const STRANGER = '7e5b0000-0000-4000-8000-000000000a02';
const PORTER = '7e5b0000-0000-4000-8000-000000000a03';
const DEED = 'Hoardstead';
// Where everything stands, off the token.
const SPILL = [T + 2, T] as const;
const CHEST = [T - 3, T] as const;
const LOCKED = [T - 1, T - 6] as const;
const T1 = [T + 5, T] as const;
const T2 = [T + 8, T + 4] as const;
const T3 = [T - 6, T + 4] as const;
const HATCHET = [T + 5, T + 2] as const;
const NAMES = { spill: 'spill', t1: 'Mortar', t2: 'MORTARS', t3: ' Planks ' };
const CAP = 60;
const FILL = 35;
const MORE = 100;

/* ---- what a name is for ------------------------------------------------- */

const ids = Object.keys(ITEM_DEFS).sort();
const asked = new Set<string>(['Mortar', 'mortar', 'MORTAR', '  mortar  ', 'mortars', 'Planks', 'plank', 'craft_bin', 'CRAFT_BIN',
  'Craft material bin', 'craft material bins', 'spill', '', 'Raw material bin']);
for (let i = 0; i < ids.length; i += 23) {
  const d = ITEM_DEFS[ids[i]];
  asked.add(ids[i]);
  asked.add(d.name);
  asked.add(hoardPlural(d.name).toUpperCase());
}
const names = [...asked];
const browserFor = new Map(names.map((n) => [n, hoardItems(n).join(',')]));

/* ---- naming, in the browser -------------------------------------------- */

const sq = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const named = (g: Game, f: PlacedFurniture): string | null => nameThingRefusal(g, { kind: 'furniture', id: f.id });
// The owner, a stranger with no settlement there, and a citizen whose rank holds Use the settlement stores only.
const own = Game.create(259, 512);
own.deed = { name: DEED, x: T, y: T, radius: 10, level: 5 };
const ownPiece = own.addFurniture('chest', T1[0], T1[1], 0, 0, 50, []);
ownPiece.mine = true;
const strange = Game.create(259, 512);
strange.deed = null;
const strangePiece = strange.addFurniture('chest', T1[0], T1[1], 0, 0, 50, []);
strangePiece.mine = false;
strangePiece.name = NAMES.t1;
const porter = Game.create(259, 512);
porter.deed = { name: DEED, x: T, y: T, radius: 10, level: 5, role: 'porter', rank: 'Porter', perms: permsOf(['use_stores']) };
const porterPiece = porter.addFurniture('chest', T1[0], T1[1], 0, 0, 50, []);
porterPiece.mine = false;
porterPiece.name = NAMES.t1;
const browserNaming = { own: named(own, ownPiece), stranger: named(strange, strangePiece), porter: named(porter, porterPiece) };

/* ---- the settlement, in the browser ------------------------------------- */

const g = Game.create(259, 512);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
g.deed = { name: DEED, x: T, y: T, radius: 10, level: 5 };
let uid = 1;
const it = (id: string, count: number, ql = 30): Item => ({ uid: uid++, id, ql, dmg: 0, count });
const spill = g.addFurniture('craft_bin', SPILL[0], SPILL[1], 0, 0, 50, [it('mortar', 30), it('nail', 20)]);
spill.name = NAMES.spill;
const chest = g.addFurniture('chest', CHEST[0], CHEST[1], 0, 0, 50, [it('mortar', 12), it('plank', 6)]);
const locked = g.addFurniture('chest', LOCKED[0], LOCKED[1], 0, 0, 50, [it('mortar', 7)]);
locked.lock = 1;
const t1 = g.addFurniture('chest', T1[0], T1[1], 0, 0, 50, [it('dirt', FILL), it('mortar', 5)]);
t1.name = NAMES.t1;
const t2 = g.addFurniture('chest', T2[0], T2[1], 0, 0, 50, []);
t2.name = NAMES.t2;
const t3 = g.addFurniture('chest', T3[0], T3[1], 0, 0, 50, []);
t3.name = NAMES.t3;
g.dropOnGround(HATCHET[0], HATCHET[1], it('hatchet', 1));
const magga = g.creatures.spawn('magga', T + 0.5, T + 0.5, 'deed', () => 0.5, -1e9);
magga.traits = [];
const step = (c: Creature): void =>
  (g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void }).updateWorker(c, 0.25, g);
const run = (secs: number): string => {
  const seq: string[] = [];
  let last = '';
  for (let t = 0; t < secs; t += 0.25) {
    g.time += 0.25;
    magga.hunger = 1;
    step(magga);
    const now = magga.carrying ? `${magga.carrying.id}:${magga.carrying.count}` : '';
    if (now !== last && now) seq.push(now);
    last = now;
  }
  return seq.join(',');
};
const count = (f: PlacedFurniture, id: string): number => f.items.filter((x) => x.id === id).reduce((n, x) => n + x.count, 0);
const idleOf = (c: Creature): string => (c.idle ? `${c.idle.why}|${Math.round(c.idle.n)}` : '');
const state = (): string => [
  `spill ${count(spill, 'mortar')}/${count(spill, 'nail')}`,
  `chest ${count(chest, 'mortar')}/${count(chest, 'plank')}/${count(chest, 'hatchet')}`,
  `locked ${count(locked, 'mortar')}`,
  `t1 ${count(t1, 'mortar')}/${count(t1, 'dirt')}/${count(t1, 'hatchet')}`,
  `t2 ${count(t2, 'mortar')}/${count(t2, 'hatchet')}`,
  `t3 ${count(t3, 'plank')}/${count(t3, 'hatchet')}`,
].join(' ');

const browser: Record<string, string> = {};
browser.SEQ = run(900);
browser.STATE = state();
browser.IDLE = idleOf(magga);
// A hundred more mortar in the unnamed chest: into "MORTARS" up to its room; then the bins' sort; every target full.
chest.items.push(it('mortar', MORE));
browser.SEQ2 = run(900);
browser.STATE2 = state();
browser.IDLE2 = idleOf(magga);
// No name left on any of them, and no bin: nothing named for an item.
for (const f of [t1, t2, t3, spill]) delete f.name;
g.furniture.delete(spill.id);
browser.SEQ3 = run(120);
browser.IDLE3 = idleOf(magga);

/* ---- the island ----------------------------------------------------------- */

const centre = (f: PlacedFurniture): string => furnitureCentre(f).join(', ');
const longName = 'M'.repeat(NAME_MAX + 12);
const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table asked (v text);
insert into asked values ${names.map((n) => `(${sq(n)})`).join(', ')};
create function pg_temp.settle(w uuid, m int, n int) returns text language plpgsql as $f$
declare i int; seq text := ''; v_now text; v_last text := '';
begin
  for i in 1..n loop
    update creature set until = now() - interval '1 millisecond', leg_at = now() - interval '2 milliseconds',
           leg_ends = now() - interval '1 millisecond', hunger = 1
     where world_id = w and id = m;
    perform worker_settle(w, m);
    select coalesce((carrying->>'def') || ':' || coalesce(carrying->>'count', '1'), '') into v_now from creature where world_id = w and id = m;
    if v_now <> v_last and v_now <> '' then seq := seq || case when seq = '' then '' else ',' end || v_now; end if;
    v_last := v_now;
  end loop;
  return seq;
end $f$;
create function pg_temp.n(p bigint, p_def text) returns int language sql as $f$
  select coalesce(sum(count), 0)::int from item where placed = p and def = p_def $f$;
do $t$
declare w uuid; u uuid := '${U}'; m int; v_spill bigint; v_chest bigint; v_locked bigint; v_t1 bigint; v_t2 bigint; v_t3 bigint;
        v_named bigint; r_porter bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hoardnamed', 259, 400, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 400);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 30}, ${T + 30}) x, generate_series(${T - 30}, ${T + 30}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Namer');
  perform set_config('request.jwt.claims', json_build_object('sub', '${STRANGER}')::text, true);
  perform rpc_join(w, 'Outlander');
  perform set_config('request.jwt.claims', json_build_object('sub', '${PORTER}')::text, true);
  perform rpc_join(w, 'Porterly');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, '${DEED}', ${T}, ${T}, 10, 5, u);
  insert into deed_rank_def (world_id, founder, name, ord, perms)
    values (w, u, 'Porter', 90, power_bits(array['use_stores'])) returning id into r_porter;
  insert into deed_member (world_id, founder, uid, rank_id) values (w, u, '${PORTER}', r_porter);
  update player set x = ${T1[0]} + 1.5, y = ${T1[1]} + 9.5, body_at = now(), swim_at = now(), seen_at = now() where world_id = w;

  -- What a name is for.
  insert into said select 'FOR:' || v, coalesce(array_to_string(private.hoard_items(v), ','), '') from asked;

  -- Naming: the owner, then a stranger and a citizen whose rank lacks Crates and stores.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${T1[0]}, ${T1[1]} + 9, 0, 0, ${T1[0]} + 0.5, ${T1[1]} + 9.5, 50, u) returning id into v_named;
  insert into said values ('OWN_ASK', coalesce(act_refusal(w, u, 'name_thing', jsonb_build_object('kind', 'furniture', 'id', v_named, 'name', '${NAMES.t1}')), 'ALLOWED'));
  perform act_perform(w, u, 'name_thing', jsonb_build_object('kind', 'furniture', 'id', v_named, 'name', '${NAMES.t1}'));
  insert into said values ('OWN_SAID', (select text from event where uid = u order by n desc limit 1));
  insert into said values ('OWN_NAME', (select name from placed where id = v_named));
  insert into said values ('STRANGER', coalesce(act_refusal(w, '${STRANGER}', 'name_thing', jsonb_build_object('kind', 'furniture', 'id', v_named, 'name', 'Mine')), 'ALLOWED'));
  insert into said values ('PORTER', coalesce(act_refusal(w, '${PORTER}', 'name_thing', jsonb_build_object('kind', 'furniture', 'id', v_named, 'name', 'Mine')), 'ALLOWED'));
  perform act_perform(w, u, 'name_thing', jsonb_build_object('kind', 'furniture', 'id', v_named, 'name', '${longName}'));
  insert into said values ('LONG', (select length(name)::text from placed where id = v_named));
  delete from placed where id = v_named;

  -- The settlement.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name)
    values (w, 'furniture', 'craft_bin', ${SPILL[0]}, ${SPILL[1]}, 0, 0, ${centre(spill)}, 50, u, '${NAMES.spill}') returning id into v_spill;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_spill, 'mortar', 30, 30), (w, 'furniture', v_spill, 'nail', 30, 20);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${CHEST[0]}, ${CHEST[1]}, 0, 0, ${centre(chest)}, 50, u) returning id into v_chest;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_chest, 'mortar', 30, 12), (w, 'furniture', v_chest, 'plank', 30, 6);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, lock)
    values (w, 'furniture', 'chest', ${LOCKED[0]}, ${LOCKED[1]}, 0, 0, ${centre(locked)}, 50, u, 1) returning id into v_locked;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_locked, 'mortar', 30, 7);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name)
    values (w, 'furniture', 'chest', ${T1[0]}, ${T1[1]}, 0, 0, ${centre(t1)}, 50, u, '${NAMES.t1}') returning id into v_t1;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_t1, 'dirt', 30, ${FILL}), (w, 'furniture', v_t1, 'mortar', 30, 5);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name)
    values (w, 'furniture', 'chest', ${T2[0]}, ${T2[1]}, 0, 0, ${centre(t2)}, 50, u, '${NAMES.t2}') returning id into v_t2;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name)
    values (w, 'furniture', 'chest', ${T3[0]}, ${T3[1]}, 0, 0, ${centre(t3)}, 50, u, '${NAMES.t3}') returning id into v_t3;
  perform drop_on_ground(w, ${HATCHET[0]}, ${HATCHET[1]}, 'hatchet', 30, null, 1);
  insert into said values ('CAP', (select furniture_capacity(p)::text from placed p where id = v_t1));
  m := creature_spawn(w, 'magga', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, form_size = null, keeper = u, phase = 'idle', carrying = null, job = null, post = null, hunger = 1,
         from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5
   where world_id = w and id = m;

  insert into said values ('SEQ', pg_temp.settle(w, m, 200));
  insert into said values ('STATE', 'spill ' || pg_temp.n(v_spill, 'mortar') || '/' || pg_temp.n(v_spill, 'nail')
    || ' chest ' || pg_temp.n(v_chest, 'mortar') || '/' || pg_temp.n(v_chest, 'plank') || '/' || pg_temp.n(v_chest, 'hatchet')
    || ' locked ' || pg_temp.n(v_locked, 'mortar')
    || ' t1 ' || pg_temp.n(v_t1, 'mortar') || '/' || pg_temp.n(v_t1, 'dirt') || '/' || pg_temp.n(v_t1, 'hatchet')
    || ' t2 ' || pg_temp.n(v_t2, 'mortar') || '/' || pg_temp.n(v_t2, 'hatchet')
    || ' t3 ' || pg_temp.n(v_t3, 'plank') || '/' || pg_temp.n(v_t3, 'hatchet'));
  insert into said select 'IDLE', coalesce(idle_why, '') || '|' || coalesce(round(idle_n)::text, '') from creature where world_id = w and id = m;
  insert into said select 'RANGE', work_range(c)::text from creature c where world_id = w and id = m;

  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_chest, 'mortar', 30, ${MORE});
  insert into said values ('SEQ2', pg_temp.settle(w, m, 120));
  insert into said values ('STATE2', 'spill ' || pg_temp.n(v_spill, 'mortar') || '/' || pg_temp.n(v_spill, 'nail')
    || ' chest ' || pg_temp.n(v_chest, 'mortar') || '/' || pg_temp.n(v_chest, 'plank') || '/' || pg_temp.n(v_chest, 'hatchet')
    || ' locked ' || pg_temp.n(v_locked, 'mortar')
    || ' t1 ' || pg_temp.n(v_t1, 'mortar') || '/' || pg_temp.n(v_t1, 'dirt') || '/' || pg_temp.n(v_t1, 'hatchet')
    || ' t2 ' || pg_temp.n(v_t2, 'mortar') || '/' || pg_temp.n(v_t2, 'hatchet')
    || ' t3 ' || pg_temp.n(v_t3, 'plank') || '/' || pg_temp.n(v_t3, 'hatchet'));
  insert into said select 'IDLE2', coalesce(idle_why, '') || '|' || coalesce(round(idle_n)::text, '') from creature where world_id = w and id = m;

  update placed set name = null where id in (v_t1, v_t2, v_t3);
  delete from item where placed = v_spill;
  delete from placed where id = v_spill;
  insert into said values ('SEQ3', pg_temp.settle(w, m, 30));
  insert into said select 'IDLE3', coalesce(idle_why, '') || '|' || coalesce(round(idle_n)::text, '') from creature where world_id = w and id = m;
end $t$;
select k || '=' || coalesce(v, '') from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

/* ---- the two side by side -------------------------------------------------- */

const off = names.filter((n) => (isle.get(`FOR:${n}`) ?? '') !== browserFor.get(n));
check(`a name is for the same items on both sides, for ${names.length} names`, off.length === 0,
  off.slice(0, 5).map((n) => `"${n}": ${isle.get(`FOR:${n}`)} / ${browserFor.get(n)}`).join('; '));
check('"Mortar", "mortar", "MORTAR", "  mortar  " and its plural "mortars" are all for mortar',
  ['Mortar', 'mortar', 'MORTAR', '  mortar  ', 'mortars'].every((n) => browserFor.get(n) === 'mortar' && isle.get(`FOR:${n}`) === 'mortar'));
check('an id is for its item: "craft_bin" and "CRAFT_BIN" as "Craft material bin" and its plural',
  ['craft_bin', 'CRAFT_BIN', 'Craft material bin', 'craft material bins'].every((n) => browserFor.get(n) === 'craft_bin' && isle.get(`FOR:${n}`) === 'craft_bin'));
check('"Planks" is for planks; "spill" and no name are for nothing',
  browserFor.get('Planks') === 'plank' && browserFor.get('spill') === '' && browserFor.get('') === '' && isle.get('FOR:spill') === '' && isle.get('FOR:') === '');

check('the owner names a chest Mortar', isle.get('OWN_ASK') === 'ALLOWED' && isle.get('OWN_NAME') === NAMES.t1 && browserNaming.own === null,
  `${isle.get('OWN_ASK')}, ${isle.get('OWN_NAME')}, ${isle.get('OWN_SAID')} / ${browserNaming.own}`);
check(`a name is cut to ${NAME_MAX} characters`, isle.get('LONG') === String(NAME_MAX), isle.get('LONG'));
check(`a stranger is refused: "${isle.get('STRANGER')}", on both sides`,
  isle.get('STRANGER') === `Not yours to name: ${NAMES.t1}.` && browserNaming.stranger === isle.get('STRANGER'), `${browserNaming.stranger}`);
check(`a citizen whose rank lacks Crates and stores is refused: "${isle.get('PORTER')}", on both sides`,
  !!isle.get('PORTER')?.startsWith(`Your rank at ${DEED} (Porter) cannot`) && browserNaming.porter === isle.get('PORTER'), `${browserNaming.porter}`);

const SEQ = 'hatchet:1,mortar:12,mortar:8,mortar:22,plank:6';
check(`the loads, in order, the same on both sides: ${SEQ}`, isle.get('SEQ') === SEQ && browser.SEQ === SEQ, `${isle.get('SEQ')} / ${browser.SEQ}`);
const room = CAP - FILL - 5;
const STATE = `spill 0/20 chest 0/0/1 locked 7 t1 ${5 + room}/${FILL}/0 t2 ${30 + 12 - room}/0 t3 6/0`;
check(`"Mortar" (room ${room}) filled first, the stack split to it, then "MORTARS"; planks to " Planks "; the hatchet to the unnamed chest`,
  isle.get('STATE') === STATE && browser.STATE === STATE && isle.get('CAP') === String(CAP), `${isle.get('STATE')} / ${browser.STATE}`);
check('never out of a target: the 5 mortar and the dirt in "Mortar" stay; nor out of a padlocked chest; the nails, no target named for them, stay in "spill"',
  /t1 \d+\/35\//.test(browser.STATE) && browser.STATE.includes('locked 7') && browser.STATE.includes('spill 0/20') && isle.get('STATE') === browser.STATE);

const reach = workRangeOf(magga, SPECIES.magga);
const says = (k: string): string => {
  const [why, n] = k.split('|');
  return why ? idleSays({ why: why as IdleWhy, n: Number(n) } as Idle, SPECIES.magga.gathers as GatherKind) : '';
};
check(`nothing to move: "${says(`nomove|${reach}`)}" on both sides`,
  isle.get('IDLE') === `nomove|${reach}` && browser.IDLE === `nomove|${reach}` && isle.get('RANGE') === String(reach), `${isle.get('IDLE')} / ${browser.IDLE}`);

const t2Had = 30 + 12 - room;
const SEQ2 = `mortar:${CAP - t2Had},mortar:${MORE - (CAP - t2Had)}`;
check(`${MORE} more mortar: "MORTARS" filled, then the rest sorted into the craft bin "spill" (a source): ${SEQ2}, on both sides`,
  isle.get('SEQ2') === SEQ2 && browser.SEQ2 === SEQ2, `${isle.get('SEQ2')} / ${browser.SEQ2}`);
check('and the same in every container on both sides', isle.get('STATE2') === browser.STATE2, `${isle.get('STATE2')} / ${browser.STATE2}`);
check(`every target full: "${says(`namedfull|${reach}`)}" on both sides`,
  isle.get('IDLE2') === `namedfull|${reach}` && browser.IDLE2 === `namedfull|${reach}`, `${isle.get('IDLE2')} / ${browser.IDLE2}`);
check(`no container named for an item: "${says(`noname|${reach}`)}", nothing carried, on both sides`,
  isle.get('IDLE3') === `noname|${reach}` && browser.IDLE3 === `noname|${reach}` && isle.get('SEQ3') === '' && browser.SEQ3 === '',
  `${isle.get('IDLE3')} ${isle.get('SEQ3')} / ${browser.IDLE3} ${browser.SEQ3}`);

finish('containers named for an item');

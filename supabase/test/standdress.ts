/**
 * An armour stand dressed from its menu, through the island's door.
 *
 * Reported: "unable to add armor to the armor stand". The stand's jobs (`decor.ts`) were on both sides and the island
 * did them, but the piece's menu never listed them: a click on a stand offered Pick up and nothing else, and the same
 * went for a sundial, a compost bin and curtains. `decorMenu.ts` is their menu now. This asks, of an island made for
 * the test and deleted after it, each step as the browser takes it:
 *
 *   * the menu a browser builds off the island's own ground read and pack, for the stand's maker and for a citizen
 *     of the maker's settlement whose rank may use its crates: Put on stand, for a piece of every armour slot
 *     (`ARMOUR_SLOTS`, the shawl among them), carried and worn;
 *   * the target that row asks with, sent through `rpc_act` (its door, `spec_target`, included) and settled as the
 *     clock settles it: the piece on the stand, out of the pack and off the body, said in the browser's words;
 *   * the stand's Take off row for that slot, the same way: the piece back in the pack;
 *   * every refusal on the way the same on both sides: a slot taken, and a rank that may not use the crates;
 *   * and with a piece for every slot at once, Put on stand lists each, carried first, worn ones marked, and each
 *     goes on.
 */
import { Game } from '../../src/game/game';
import type { IslandGround } from '../../src/contract/ground';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { DECOR_SAID, decorDone, decorSaid, STAND_PUT, STAND_TAKE } from '../../src/game/decor';
import { ARMOUR_STAND } from '../../src/game/decordefs';
import { ARMOUR_SLOTS, SLOT_NAMES, type Slot } from '../../src/game/gear';
import { itemDef } from '../../src/game/items';
import { lacksSaid } from '../../src/game/ranks';
import { TileType } from '../../src/world/tiles';
import { decorEntries } from '../../src/ui/decorMenu';
import type { MenuItem } from '../../src/ui/contextmenu';
import { psql, check, finish } from './harness';

const MIRA = '57a4d000-0000-4000-8000-0000000000a1';
const OTTO = '57a4d000-0000-4000-8000-0000000000a2';
const AT = [14, 6] as const;
/** One piece of each slot, and a second for the slot-taken ask. */
const PIECE: Record<Slot, string> = { head: 'leather_cap', chest: 'leather_jerkin', shawl: 'cloth_shawl', legs: 'cloth_trousers', feet: 'leather_boots' } as Record<Slot, string>;
const wordOf = (id: string): string => itemDef(id).name.toLowerCase();
const sq = (s: string): string => `'${s.replace(/'/g, "''")}'`;

const one = (sql: string): string => psql(sql);
const world = one(`insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stand', 168, 40, 10, 10, true) returning id;`);
const W = sq(world);
const as = (who: string): string => `select set_config('request.jwt.claims', json_build_object('sub', ${sq(who)})::text, false);
  delete from caller where uid = ${sq(who)};`;

interface Look { ground: IslandGround; items: Array<{ id: number; def: string; locked: boolean }>; equipped: Record<string, number> }
/** What `who`'s browser has: the ground as the island reads it to them, their pack and what they wear. */
const look = (who: string): Look => JSON.parse(one(`${as(who)}
  select jsonb_build_object('ground', rpc_ground(${W}, 40, true),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'def', i.def, 'locked', i.locked) order by i.id) from item i
                        where i.world_id = ${W} and i.holder = 'player' and i.holder_uid = ${sq(who)}), '[]'::jsonb),
    'equipped', p.equipped) from player p where p.world_id = ${W} and p.uid = ${sq(who)};`).split('\n').pop() ?? '{}') as Look;

/** The browser `who` has, off what the island told it: the ground, the pack, the body, beside the stand. */
const browser = (l: Look): Game => {
  const g = Game.create(168, 40);
  g.world.water = null;
  g.world.heights.fill(10);
  g.world.tiles.fill(TileType.Grass);
  g.sawGround(l.ground);
  g.inventory.items.length = 0;
  for (const it of l.items) {
    const x = g.inventory.add(it.def, { ql: 40 });
    x.uid = it.id;
    if (it.locked) x.locked = true;
  }
  for (const s of Object.keys(g.player.equipped)) (g.player.equipped as Record<string, number | null>)[s] = null;
  for (const [slot, uid] of Object.entries(l.equipped ?? {})) if (typeof uid === 'number') (g.player.equipped as Record<string, number | null>)[slot] = uid;
  g.putBody(AT[0] + 0.5, AT[1] + 0.5, 0);
  return g;
};

/** The stand's menu in `g`, and what each row would ask, by label: a row's target is the one `requestAction` is handed. */
const menuOf = (g: Game, std: number): { rows: MenuItem[]; asks: (row: MenuItem) => { def: ActionDef; t: Target } | null } => {
  const f = g.furniture.get(std);
  const rows = f ? decorEntries(g, f) : [];
  return {
    rows,
    asks: (row) => {
      let got: { def: ActionDef; t: Target } | null = null;
      const was = g.requestAction;
      g.requestAction = ((def: ActionDef, t: Target) => { got = { def, t }; }) as typeof g.requestAction;
      row.onSelect?.();
      g.requestAction = was;
      return got;
    },
  };
};

/**
 * Ask the island as the browser would: the job and the target the row asked with, through `rpc_act`, then the clock
 * run until the job is done. What it answered, the refusal it gives the same ask first, and what it said done.
 */
const ask = (who: string, action: string, t: Target): { why: string; started: string; said: string } => {
  const out = one(`${as(who)}
  update player set body_at = now(), stats = coalesce(stats, '{}'::jsonb) || '{"stamina": 1, "hunger": 1, "thirst": 1}'::jsonb
   where world_id = ${W} and uid = ${sq(who)};
  select coalesce(act_refusal(${W}, ${sq(who)}, ${sq(action)}, ${sq(JSON.stringify(t))}::jsonb), 'none')
    || '#' || coalesce((rpc_act(${W}, ${sq(action)}, ${sq(JSON.stringify(t))}::jsonb))::text, '-');
  update player set act_ends = now() - interval '1 second' where world_id = ${W} and uid = ${sq(who)} and act is not null;
  select settle(${W}, ${sq(who)});
  select '#' || coalesce((select e.text from event e where e.world_id = ${W} and e.uid = ${sq(who)} and e.kind = 'event' order by e.n desc limit 1), '-');`);
  const lines = out.split('\n').filter((l) => l.includes('#'));
  const [why, answer] = (lines[0] ?? '#').split('#');
  const a = JSON.parse(answer && answer !== '-' ? answer : '{}') as { started?: boolean; why?: string };
  return { why, started: a.started ? 'started' : `not: ${a.why ?? answer}`, said: (lines[1] ?? '#').slice(1) };
};

/** Where an item is now: on the stand, in the pack, worn, and the stand's slots as every browser reads them. */
const where = (id: number, who: string, std: number): string => one(`select i.holder || '|' || coalesce((select string_agg(k, ',' order by k)
    from jsonb_object_keys(pl.garden->'worn') k), '-') || '|' || exists (select 1 from player p, jsonb_each(p.equipped) e
      where p.world_id = ${W} and p.uid = ${sq(who)} and jsonb_typeof(e.value) = 'number' and (e.value)::text::bigint = ${id})::text
  from item i, placed pl where i.id = ${id} and pl.id = ${std};`);

try {
  const std = Number(one(`do $t$
declare w uuid := ${W}; u uuid := ${sq(MIRA)}; o uuid := ${sq(OTTO)}; v_it bigint;
begin
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
  perform rpc_join(w, 'Otto');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = ${AT[0] + 0.5}, y = ${AT[1] + 0.5}, body_at = now(), swim_at = now(), equipped = '{}'::jsonb,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  -- Mira's settlement over the stand; Otto a citizen of it, a Builder, who may use its crates.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Home', 12, 8, 6, 1, u);
  perform deed_ranks_seed(w, u);
  insert into deed_member (world_id, founder, uid, role, rank_id)
    values (w, u, o, 'builder', (select id from deed_rank_def where world_id = w and founder = u and name = 'Builder'));
  -- The stand, set down by Mira.
  v_it := give(w, u, ${sq(ARMOUR_STAND)}, 1, 40);
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_it, 'x', ${AT[0]}, 'y', ${AT[1]}, 'sx', 0, 'sy', 0, 'facing', 's'));
end $t$;
select id from placed where world_id = ${W} and kind = 'furniture' and sub = ${sq(ARMOUR_STAND)};`).split('\n').pop());
  check('the stand is set down', std > 0, String(std));

  const putRow = (rows: MenuItem[]): MenuItem | undefined => rows.find((r) => r.label.startsWith(ACTION_BY_ID.get(STAND_PUT)!.label));
  const takeLabel = (slot: Slot): string => `Take off ${wordOf(PIECE[slot])}`;

  /* ---- every slot, carried and worn, by the maker and by a citizen --------------------------------------------- */

  for (const [who, name] of [[MIRA, 'the maker'], [OTTO, 'a citizen']] as const) {
    for (const slot of ARMOUR_SLOTS) {
      for (const worn of [false, true]) {
        const how = `${name}, ${SLOT_NAMES[slot].toLowerCase()}, ${worn ? 'worn' : 'carried'}`;
        const id = Number(one(`select give(${W}, ${sq(who)}, ${sq(PIECE[slot])}, 1, 40);`));
        if (worn) one(`update player set equipped = jsonb_build_object(${sq(slot)}, ${id}) where world_id = ${W} and uid = ${sq(who)};`);
        let g = browser(look(who));
        const { rows, asks } = menuOf(g, std);
        const row = putRow(rows);
        const asked = row ? asks(row) : null;
        check(`${how}: the stand's menu offers Put on stand: ${wordOf(PIECE[slot])}, open`,
          row?.label === `Put on stand: ${wordOf(PIECE[slot])}` && !row.disabled && asked?.def.id === STAND_PUT,
          `${rows.map((r) => `${r.label}${r.hint ? ` [${r.hint}]` : ''}`).join(' / ')}`);
        if (!asked) continue;
        check(`${how}: and asks with the stand and the piece`, JSON.stringify(asked.t) === JSON.stringify({ kind: 'furniture', id: std, itemUid: id }), JSON.stringify(asked.t));
        const put = ask(who, asked.def.id, asked.t);
        check(`${how}: the island lets it through the door and agrees`, put.why === 'none' && put.started === 'started', `${put.why} | ${put.started}`);
        check(`${how}: on the stand, said in the browser's words`, put.said === decorDone('put', { what: wordOf(PIECE[slot]) }), put.said);
        check(`${how}: the piece is the stand's, out of the pack and off the body`, where(id, who, std) === `stand|${slot}|false`, where(id, who, std));

        g = browser(look(who));
        const after = menuOf(g, std);
        const take = after.rows.find((r) => r.label === takeLabel(slot));
        check(`${how}: every browser reads it on the stand`, Object.keys(g.furniture.get(std)?.decor?.worn ?? {}).join(',') === slot,
          JSON.stringify(g.furniture.get(std)?.decor));
        check(`${how}: and Put on stand says there is nothing to put, as the island does`,
          putRow(after.rows)?.hint === DECOR_SAID.noArmour && ask(who, STAND_PUT, { kind: 'furniture', id: std } as Target).why === DECOR_SAID.noArmour,
          putRow(after.rows)?.hint);
        const took = take ? after.asks(take) : null;
        check(`${how}: the menu offers ${takeLabel(slot)}`, !!took && !take?.disabled && took.def.id === STAND_TAKE(slot), after.rows.map((r) => r.label).join(' / '));
        if (!took) continue;
        const off = ask(who, took.def.id, took.t);
        check(`${how}: taken off`, off.why === 'none' && off.started === 'started' && off.said === decorDone('taken', { what: wordOf(PIECE[slot]) }),
          `${off.why} | ${off.started} | ${off.said}`);
        check(`${how}: back in the pack, the stand bare`, where(id, who, std) === 'player|-|false', where(id, who, std));
        one(`delete from item where id = ${id};`);
      }
    }
  }

  /* ---- a piece for every slot at once: listed, each going on ---------------------------------------------------- */

  const ids = Object.fromEntries(ARMOUR_SLOTS.map((s) => [s, Number(one(`select give(${W}, ${sq(MIRA)}, ${sq(PIECE[s])}, 1, 40);`))])) as Record<Slot, number>;
  // Head, chest and feet worn; the shawl and the legs carried.
  one(`update player set equipped = jsonb_build_object('head', ${ids.head}, 'chest', ${ids.chest}, 'feet', ${ids.feet}) where world_id = ${W} and uid = ${sq(MIRA)};`);
  {
    const g = browser(look(MIRA));
    const { rows, asks } = menuOf(g, std);
    const row = putRow(rows);
    const kids = row?.children ?? [];
    const want = ['shawl', 'legs', 'head', 'chest', 'feet'].map((s) => `${wordOf(PIECE[s as Slot])}|${SLOT_NAMES[s as Slot]}${['head', 'chest', 'feet'].includes(s) ? ' · worn' : ''}`);
    check(`Put on stand lists all ${ARMOUR_SLOTS.length}, carried first, worn ones marked`,
      row?.label === 'Put on stand' && kids.map((k) => `${k.label.toLowerCase()}|${k.note}`).join(',') === want.join(',') && kids.every((k) => !k.disabled),
      kids.map((k) => `${k.label}|${k.note}|${k.hint ?? ''}`).join(','));
    for (const k of kids) {
      const a = asks(k);
      if (!a) continue;
      const put = ask(MIRA, a.def.id, a.t);
      check(`${k.label}: on`, put.why === 'none' && put.started === 'started', `${put.why} | ${put.started}`);
    }
  }
  check(`every slot dressed, nothing of it left worn or carried`,
    one(`select string_agg(k, ',' order by k) from placed pl, jsonb_object_keys(pl.garden->'worn') k where pl.id = ${std};`) === [...ARMOUR_SLOTS].sort().join(',')
      && one(`select count(*) from item where world_id = ${W} and holder = 'player' and holder_uid = ${sq(MIRA)};`) === '0'
      && one(`select equipped::text from player where world_id = ${W} and uid = ${sq(MIRA)};`) === '{}',
    one(`select garden::text from placed where id = ${std};`));

  /* ---- refused alike: a slot taken, and a rank that may not use the crates -------------------------------------- */

  const second = Number(one(`select give(${W}, ${sq(OTTO)}, 'scale_shawl', 1, 40);`));
  {
    const g = browser(look(OTTO));
    const row = putRow(menuOf(g, std).rows);
    const a = row ? menuOf(g, std).asks(row) : null;
    const isle = a ? ask(OTTO, a.def.id, a.t) : null;
    check('a citizen, a slot taken: the menu greys it in the island\'s words', row?.hint === decorSaid('slotTaken', 'shawl') && isle?.why === row.hint
      && isle.started === `not: ${row.hint}`, `${row?.hint} | ${isle?.why} | ${isle?.started}`);
  }
  one(`update deed_rank_def set perms = 0 where world_id = ${W} and founder = ${sq(MIRA)} and name = 'Builder';
    delete from item where id = (select i.id from item i where i.holder = 'stand' and i.placed = ${std} and i.def = ${sq(PIECE.shawl)});`);
  {
    const g = browser(look(OTTO));
    const row = putRow(menuOf(g, std).rows);
    const a = row ? menuOf(g, std).asks(row) : null;
    const isle = a ? ask(OTTO, a.def.id, a.t) : null;
    const want = lacksSaid('Home', 'Builder', 'stores');
    check('a citizen whose rank may not use the crates: refused alike', row?.hint === want && isle?.why === want && isle.started === `not: ${want}`,
      `${row?.hint} | ${isle?.why} | ${isle?.started}`);
  }
  check('and the piece stays in the pack', where(second, OTTO, std).startsWith('player|'), where(second, OTTO, std));
} finally {
  one(`delete from world where id = ${W};`);
}

finish('an armour stand dressed from its menu, through the island\'s door');

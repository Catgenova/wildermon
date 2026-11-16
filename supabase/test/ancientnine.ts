/**
 * Nine more ancient baubles: coppice, pruning, butchery, shearing, orchard, vineyard, tapping, reeds and botany.
 *
 * Asked for: nine new ancient bauble effects in the form of the six there were, each adding `ANCIENT_PLUS` times its
 * rarity to what one job gives, every time that job gives anything. So this asks, of each of the nine:
 *
 *   * the island and the browser write it in the same words at every rarity, and read it back the same;
 *   * a roll of an ancient bauble can come out as it, on both sides;
 *   * a citizen on a settlement with it set, doing its job, gets exactly `ANCIENT_PLUS` × rarity more of every
 *     yield of the go than the same go without it -- the dice pinned, so the go is the same go -- on the island and
 *     in the browser alike;
 *   * and a trellis vine picked counts as a bush harvested for the vineyard bauble, on both sides (`BAUBLE_JOB_AS`).
 *
 * Settlement workers are not citizens: no bauble of any kind works for them (`bauble_here`), the six before these
 * included, so none is asked of them here.
 *
 * Makes its own island inside one transaction and rolls it back.
 */
import { Game, type Deed } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import {
  ANCIENT_EFFECTS, ANCIENT_PLUS, BAUBLE_JOB_AS, baublePlus, baubleText, baubleTimes, readBauble, rollBauble, type DeedBauble,
} from '../../src/game/baubles';
import { perksOf } from '../../src/game/perks';
import { RARITIES } from '../../src/game/items';
import { FRUITING } from '../../src/game/fruiting';
import { RESIN_TREE } from '../../src/game/worksites';
import { packTreeData, TileType, TREE_AGES, TREE_DEFS, BUSH_DEFS } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const NINE = ['coppice', 'pruning', 'butchery', 'shearing', 'orchard', 'vineyard', 'tapping', 'reeds', 'botany'];
const EFFECT = new Map(ANCIENT_EFFECTS.map((e) => [e.id, e]));
check('the nine are ancient effects, after the six, each once', NINE.every((id) => EFFECT.has(id))
  && ANCIENT_EFFECTS.slice(6).map((e) => e.id).join(',') === NINE.join(',') && new Set(ANCIENT_EFFECTS.map((e) => e.id)).size === ANCIENT_EFFECTS.length,
  ANCIENT_EFFECTS.map((e) => e.id).join(','));
check('the six before them are as they were, by id and job',
  ANCIENT_EFFECTS.slice(0, 6).map((e) => `${e.id}:${e.action}`).join(',')
    === 'mining:mine,felling:cut_down,digging:dig,harvest:harvest_crop,fishing:fish,foraging:forage');
check('each names a job the browser has, and every job counted as another is one too',
  ANCIENT_EFFECTS.every((e) => ACTION_BY_ID.has(e.action)) && Object.entries(BAUBLE_JOB_AS).every(([a, b]) => ACTION_BY_ID.has(a) && ACTION_BY_ID.has(b)));

/** The rarity a bauble is tested at: supreme, three times an ordinary one. */
const RARE = 2;
const RARE_ID = RARITIES[RARE].name;
const PLUS = ANCIENT_PLUS * baubleTimes(RARE);
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/* ---- the jobs, set up on the island ---------------------------------------------------------------------------- */

const T = 30;
const U = '7e5b0000-0000-4000-8000-0000000a9e09';
const age = (name: string): number => TREE_AGES.findIndex((a) => a.name === name);
const [MATURE, OLD] = ['Mature', 'Old'].map(age);
const OAK = TREE_DEFS.findIndex((t) => t.name === 'Oak');
const APPLE = TREE_DEFS.findIndex((t) => t.name === 'Apple');
const ROSE = BUSH_DEFS.findIndex((b) => b.yields === 'rose_petals');
const tileAt = (x: number, y: number): string => `jsonb_build_object('kind', 'tile', 'x', ${x}, 'y', ${y})`;
const tree = (x: number, y: number, species: number, a: number): string =>
  `perform land_set_tile(w, ${x}, ${y}, tile_id('Tree')); perform land_set_data(w, ${x}, ${y}, tree_pack(${species}, ${a}))`;
const ground = (x: number, y: number, tile: string, data = 0): string =>
  `perform land_set_tile(w, ${x}, ${y}, tile_id('${tile}')); perform land_set_data(w, ${x}, ${y}, ${data})`;

/** Each job: its bauble, the action, where it is done, what is set up for it, and whether every find is a yield of its own. */
interface Job { id: string; action: string; target: string; setup: string; each?: boolean }
const JOBS: Job[] = [
  { id: 'coppice', action: 'coppice', target: tileAt(T + 1, T), setup: tree(T + 1, T, RESIN_TREE, MATURE) },
  { id: 'pruning', action: 'prune', target: tileAt(T - 1, T), setup: tree(T - 1, T, OAK, OLD) },
  { id: 'butchery', action: 'butcher', target: `jsonb_build_object('kind', 'ground', 'x', ${T}, 'y', ${T})`,
    setup: `perform drop_on_ground(w, ${T}, ${T}, 'corpse', 50, 'Rabba')` },
  { id: 'shearing', action: 'shear', target: "jsonb_build_object('kind', 'creature', 'id', v_woola)", setup: '' },
  { id: 'shearing', action: 'shear', target: "jsonb_build_object('kind', 'creature', 'id', v_quill)", setup: '' },
  { id: 'orchard', action: 'pick_fruit', target: tileAt(T, T + 1), setup: tree(T, T + 1, APPLE, OLD) },
  { id: 'vineyard', action: 'harvest_bush', target: tileAt(T, T - 1), setup: ground(T, T - 1, 'Bush', ROSE) },
  { id: 'tapping', action: 'tap_resin', target: tileAt(T + 1, T + 1), setup: tree(T + 1, T + 1, RESIN_TREE, MATURE) },
  { id: 'reeds', action: 'cut_reeds', target: tileAt(T - 1, T - 1), setup: ground(T - 1, T - 1, 'Reed') },
  { id: 'botany', action: 'botanize', target: tileAt(T + 1, T - 1), setup: ground(T + 1, T - 1, 'Grass'), each: true },
];
const season = (item: string): string => FRUITING[item]?.[0] ?? '';
const FORESTER = perksOf('forester');
const perkId = (name: string): string => FORESTER.find((p) => p.name === name)?.id ?? `missing ${name}`;
const perkFx = (name: string): Record<string, number> => FORESTER.find((p) => p.name === name)?.fx ?? {};

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
-- Every skill check passes: the yield is what is asked of, not whether the go comes off.
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
  p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
/*
 * One go of a job as the clock takes it -- its job on the player, inside a go for the baubles -- from the same dice
 * every time, and then undone: what it put in the pack, by item, comes back.
 */
create function pg_temp.trial(w uuid, u uuid, a text, t jsonb) returns text language plpgsql as $f$
declare v text; v_mark bigint := coalesce((select max(id) from item where world_id = w), 0);
begin
  begin
    perform setseed(0.37);
    update player set act = a, act_target = t where world_id = w and uid = u;
    perform set_config('wildermon.bauble_go', 'go', true);
    perform set_config('wildermon.bauble_made', '', true);
    perform act_perform(w, u, a, t);
    perform bauble_said(w, u);
    select coalesce(string_agg(s.def || ':' || s.n, ',' order by s.def), '') into v
      from (select i.def, sum(i.count) n from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.id > v_mark
             group by i.def) s;
    raise sqlstate 'UNDO9';
  exception when sqlstate 'UNDO9' then null;
  end;
  return v;
end $f$;
do $t$
declare w uuid; u uuid := '${U}'; v_woola int; v_quill int; e record; r record; v_seen text;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Ancientnine', 909, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 6}, ${T + 6}) x, generate_series(${T - 6}, ${T + 6}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Ninefold');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now(), act = null, act_queue = '[]',
         craft_class = 'forester', combat_class = null, equipped = '{}'::jsonb,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  insert into skill (world_id, uid, id, value)
    select w, u, s, 60 from unnest(array['woodcutting', 'forestry', 'foraging', 'botanizing', 'butchering', 'tailoring']) s
    on conflict (world_id, uid, id) do update set value = excluded.value;
  delete from player_node where world_id = w and uid = u;
  insert into player_node (world_id, uid, node) values (w, u, ${q(perkId('Coppice'))}), (w, u, ${q(perkId('Tap Resin'))});
  perform class_fold(w, u);
  foreach v_seen in array array['hatchet', 'sickle', 'carving_knife', 'butchering_knife'] loop
    perform give(w, u, v_seen, 1, 100);
  end loop;
  -- A settlement of its own under it, with nothing in its altar yet.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Ninestead', ${T}, ${T}, 10, 3, u);
  -- A woola and a quill of its own, grown back in full, beside it.
  select creature_spawn(w, 'woola', ${T} + 0.5, ${T - 1} + 0.5, 'active', now() - interval '10 days', u) into v_woola;
  select creature_spawn(w, 'quill', ${T - 1} + 0.5, ${T} + 0.5, 'active', now() - interval '10 days', u) into v_quill;
  update creature set mode = 'active', keeper = u, traits = '{}', fleece = 1, leg_at = now(), leg_ends = now(),
         until = now() + interval '1 hour', settled_at = now()
   where world_id = w and id in (v_woola, v_quill);
  ${JOBS.map((j) => j.setup).filter(Boolean).join(';\n  ')};

  /* The words, on every rarity, and read back. */
  for e in select a.id from bauble_ancient a order by a.ord loop
    -- An ordinary one has no rarity, and no row of its own.
    for r in select d.id, s.ord from generate_series(0, ${RARITIES.length - 1}) s(ord) left join rarity_def d on d.ord = s.ord order by s.ord loop
      insert into said values ('TEXT:' || e.id || ':' || r.ord, bauble_text('plus', e.id, ancient_plus() * bauble_times(r.id)));
      insert into said select 'READ:' || e.id || ':' || r.ord, b.kind || '|' || b.key || '|' || b.amount
        from bauble_read('bauble_ancient', bauble_text('plus', e.id, ancient_plus() * bauble_times(r.id))) b;
    end loop;
  end loop;
  /* What a roll comes out as. */
  perform setseed(0.11);
  insert into said select 'ROLLED', string_agg(distinct (bauble_read('bauble_ancient', x.t)).key, ',')
    from (select bauble_roll('ancient', null) t from generate_series(1, 900)) x;

  /* Each job, without the bauble and then with it. */
  ${JOBS.map((j, i) => `
  perform set_config('wildermon.season', ${q(j.action === 'pick_fruit' ? season('apple') : j.action === 'harvest_bush' ? season('rose_petals') : '')}, true);
  delete from deed_bauble where world_id = w;
  insert into said values ('NO:${i}', pg_temp.trial(w, u, '${j.action}', ${j.target}));
  insert into deed_bauble (world_id, founder, tier, slot, kind, key, amount)
    select w, u, 'ancient', 0, b.kind, b.key, b.amount
      from bauble_read('bauble_ancient', bauble_text('plus', '${j.id}', ancient_plus() * bauble_times(${q(RARE_ID)}))) b;
  insert into said values ('YES:${i}', pg_temp.trial(w, u, '${j.action}', ${j.target}));`).join('')}
  perform set_config('wildermon.season', '', true);

  /* And what is asked of a job by name: a trellis vine picked is a bush harvested. */
  delete from deed_bauble where world_id = w;
  insert into deed_bauble (world_id, founder, tier, slot, kind, key, amount) values (w, u, 'ancient', 0, 'plus', 'vineyard', ${PLUS});
  insert into said values ('GRAPES', bauble_plus(w, u, 'pick_grapes') || '|' || bauble_plus(w, u, 'harvest_bush') || '|' || bauble_plus(w, u, 'pick_fruit'));
  -- And every job the browser counts as another.
  ${Object.entries(BAUBLE_JOB_AS).map(([a, b]) => `
  delete from deed_bauble where world_id = w;
  insert into deed_bauble (world_id, founder, tier, slot, kind, key, amount)
    select w, u, 'ancient', 0, 'plus', a.id, ${PLUS} from bauble_ancient a where a.action = '${b}';
  insert into said values ('AS:${a}', bauble_plus(w, u, '${a}')::text);`).join('')}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the words, the reading and the roll --------------------------------------------------------------------- */

for (const id of NINE) {
  const texts = RARITIES.map((_, step) => baubleText('plus', id, ANCIENT_PLUS * baubleTimes(step)));
  check(`${id}: written the same on both sides at every rarity: "${texts[0]}" to "${texts[texts.length - 1]}"`,
    texts.every((t, step) => at(`TEXT:${id}:${step}`) === t), RARITIES.map((_, s) => at(`TEXT:${id}:${s}`)).join(' / '));
  check(`${id}: and read back the same on both sides`,
    texts.every((t, step) => {
      const b = readBauble({ id: 'bauble_ancient', extra: t });
      return !!b && b.kind === 'plus' && b.key === id && b.amount === ANCIENT_PLUS * baubleTimes(step)
        && at(`READ:${id}:${step}`) === `plus|${id}|${ANCIENT_PLUS * baubleTimes(step)}`;
    }), RARITIES.map((_, s) => at(`READ:${id}:${s}`)).join(' / '));
}
{
  const rolled = new Set(at('ROLLED').split(','));
  check('a roll of an ancient bauble on the island comes out as each of the nine', NINE.every((id) => rolled.has(id)), at('ROLLED'));
  // The browser's: one roll for each place in the list, and what it says read back.
  const n = ANCIENT_EFFECTS.length;
  const browser = ANCIENT_EFFECTS.map((_, i) => readBauble({ id: 'bauble_ancient', extra: rollBauble('ancient', RARE, () => (i + 0.5) / n) })?.key);
  check('and in the browser, at its rarity', NINE.every((id) => browser.includes(id))
    && ANCIENT_EFFECTS.every((e, i) => browser[i] === e.id && rollBauble('ancient', RARE, () => (i + 0.5) / n).includes(`+${PLUS} `)), browser.join(','));
}

/* ---- the yield, on the island ----------------------------------------------------------------------------------- */

const counts = (s: string): Map<string, number> => new Map(s.split(',').filter(Boolean).map((p) => {
  const [d, n] = p.split(':');
  return [d, Number(n)] as [string, number];
}));
/** What a go with the bauble should give, from the same go without it: `PLUS` more of each yield. */
const expected = (without: Map<string, number>, each: boolean | undefined): string =>
  [...without].map(([d, n]) => `${d}:${n + PLUS * (each ? n : 1)}`).sort().join(',');
const sortedOf = (m: Map<string, number>): string => [...m].map(([d, n]) => `${d}:${n}`).sort().join(',');
JOBS.forEach((j, i) => {
  const without = counts(at(`NO:${i}`));
  const got = counts(at(`YES:${i}`));
  check(`on the island, ${j.action} with a ${RARE_ID} ${j.id} bauble set: +${PLUS} ${j.each ? 'each find' : 'of each yield'}`,
    without.size > 0 && sortedOf(got) === expected(without, j.each), `without ${at(`NO:${i}`)}; with ${at(`YES:${i}`)}`);
});
check(`a trellis vine picked counts as a bush harvested for the vineyard bauble, and no other job does: +${PLUS}`,
  at('GRAPES') === `${PLUS}|${PLUS}|0`
    && baublePlus([{ tier: 'ancient', slot: 0, kind: 'plus', key: 'vineyard', amount: PLUS }], 'pick_grapes') === PLUS, at('GRAPES'));
check('every job the browser counts as another, the island counts the same',
  Object.keys(BAUBLE_JOB_AS).every((a) => at(`AS:${a}`) === String(PLUS)), Object.keys(BAUBLE_JOB_AS).map((a) => `${a} ${at(`AS:${a}`)}`).join(', '));

/* ---- the yield, in the browser ------------------------------------------------------------------------------- */

/** mulberry32, from a fixed seed: the same dice for the go with the bauble and the go without. */
const dice = (seed: number): (() => number) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const B = 40;
interface BrowserJob { id: string; action: string; each?: boolean; setup: (g: Game) => Target }
const BROWSER_JOBS: BrowserJob[] = [
  { id: 'coppice', action: 'coppice', setup: (g) => { g.world.setTile(B + 1, B, TileType.Tree, packTreeData(RESIN_TREE, MATURE)); return { kind: 'tile', x: B + 1, y: B } as Target; } },
  { id: 'pruning', action: 'prune', setup: (g) => { g.world.setTile(B - 1, B, TileType.Tree, packTreeData(OAK, OLD)); return { kind: 'tile', x: B - 1, y: B } as Target; } },
  {
    id: 'butchery', action: 'butcher',
    setup: (g) => {
      g.dropOnGround(B, B, { uid: g.inventory.nextUid++, id: 'corpse', ql: 50, dmg: 0, count: 1, extra: 'Rabba' });
      return { kind: 'ground', x: B, y: B, uid: null } as Target;
    },
  },
  ...['woola', 'quill'].map((species): BrowserJob => ({
    id: 'shearing', action: 'shear',
    setup: (g) => {
      const c = g.creatures.spawn(species, B + 0.5, B - 0.5, 'active');
      c.fleece = 1;
      return { kind: 'creature', id: c.id } as Target;
    },
  })),
  { id: 'orchard', action: 'pick_fruit', setup: (g) => { g.world.setTile(B, B + 1, TileType.Tree, packTreeData(APPLE, OLD)); return { kind: 'tile', x: B, y: B + 1 } as Target; } },
  { id: 'vineyard', action: 'harvest_bush', setup: (g) => { g.world.setTile(B, B - 1, TileType.Bush, ROSE); return { kind: 'tile', x: B, y: B - 1 } as Target; } },
  { id: 'tapping', action: 'tap_resin', setup: (g) => { g.world.setTile(B + 1, B + 1, TileType.Tree, packTreeData(RESIN_TREE, MATURE)); return { kind: 'tile', x: B + 1, y: B + 1 } as Target; } },
  { id: 'reeds', action: 'cut_reeds', setup: (g) => { g.world.setTile(B - 1, B - 1, TileType.Reed, 0); return { kind: 'tile', x: B - 1, y: B - 1 } as Target; } },
  { id: 'botany', action: 'botanize', each: true, setup: () => ({ kind: 'tile', x: B + 1, y: B - 1 } as Target) },
];
const TOOLS = ['hatchet', 'sickle', 'carving_knife', 'butchering_knife'];
/** One go of a job in a fresh game, inside a go for the baubles, from fixed dice: what it put in the pack, by item. */
const browserGo = (job: BrowserJob, baubles: DeedBauble[]): Map<string, number> => {
  const g = Game.create(9090);
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  for (let y = B - 6; y <= B + 6; y++) for (let x = B - 6; x <= B + 6; x++) {
    g.world.setHeight(x, y, 4);
    g.world.setDirt(x, y, 5);
    g.world.setTile(x, y, TileType.Grass, 0);
  }
  g.neighbourDeeds = [];
  const home: Deed = { name: 'Ninestead', x: B, y: B, radius: 10, level: 3, mine: true, baubles };
  g.deed = home;
  g.player.x = B + 0.5;
  g.player.y = B + 0.5;
  for (const it of [...g.inventory.items]) g.inventory.remove(it.uid, it.count);
  for (const tool of TOOLS) g.inventory.add(tool, { ql: 100 });
  for (const s of ['woodcutting', 'forestry', 'foraging', 'botanizing', 'butchering', 'tailoring']) g.skills.values.set(s, 60);
  g.setPerks({ ...perkFx('Coppice'), ...perkFx('Tap Resin') });
  const t = job.setup(g);
  g.rand = dice(37);
  const unpinned = Math.random;
  Math.random = dice(73);
  g.skillCheck = () => true;
  const before = new Set(g.inventory.items.map((i) => i.uid));
  const inGo = g as unknown as { baubleGo: { job: unknown; twice?: boolean; made: string[] } | null; sayBaubleGo(): void };
  inGo.baubleGo = { job: ACTION_BY_ID.get(job.action), made: [] };
  try {
    ACTION_BY_ID.get(job.action)?.perform(t, g);
    inGo.sayBaubleGo();
  } finally {
    Math.random = unpinned;
  }
  const got = new Map<string, number>();
  for (const it of g.inventory.items) if (!before.has(it.uid)) got.set(it.id, (got.get(it.id) ?? 0) + it.count);
  return got;
};
for (const j of BROWSER_JOBS) {
  const without = browserGo(j, []);
  const got = browserGo(j, [{ tier: 'ancient', slot: 0, kind: 'plus', key: j.id, amount: PLUS, rare: RARE }]);
  check(`in the browser, ${j.action} with a ${RARE_ID} ${j.id} bauble set: +${PLUS} ${j.each ? 'each find' : 'of each yield'}`,
    without.size > 0 && sortedOf(got) === expected(without, j.each), `without ${sortedOf(without)}; with ${sortedOf(got)}`);
}

finish('Nine more ancient baubles');

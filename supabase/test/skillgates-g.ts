/**
 * Skill gates, the seventh set (batch G): the user's answers to batch F's questions.
 *
 * Decided: wemp sown at farming 1; the bucket at carpentry 1 and lye at alchemy 1; an alloy poured and its casting
 * worked at the level of the recipe that mixes it (fire-tempered steel at smelting's 40 with it); everything made with
 * obsidian or built of it at 99, in its own making skill; a treasure map read under its tier's gate (only digging it up
 * gated); a hod carrier whose only work is bridge spans over its level naming the gate. Asked of the island and the
 * browser:
 *
 *   * the island's rows are the browser's for every gate this moved: wemp, the bucket, lye, every alloy's pouring and
 *     casting, every obsidian recipe and obsidian glass building;
 *   * an alloy's level is its mixing recipe's, derived; obsidian's is 99 for every recipe with obsidian in it, in the
 *     recipe's own skill, and for obsidian glass building;
 *   * refused in the one rule's words on both sides: steel pouring at blacksmithing 1, fire-tempered steel at 30, an
 *     obsidian vase at glassblowing 90, obsidian glass building at masonry 90; the bucket, lye and wemp open at 1;
 *   * a hod carrier at carpentry 1 with only a drawbridge's span within reach is idle `gate`, naming it, on both sides;
 *     at carpentry 50, not; and its words;
 *   * the Unlocks: glassblowing, stonecutting and platesmithing list their obsidian work at 99.
 *
 * The island half makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { RECIPE_BY_ID, RECIPES, recipeReason } from '../../src/game/recipes';
import { buildGateRefusal, CASTING_SKILLS, castingGateId, hodMay, METAL_GATE, metalGateRefusal, OBSIDIAN, recipeLevel } from '../../src/game/craftgates';
import { MATERIALS } from '../../src/game/building';
import { METALS } from '../../src/game/metal';
import { idleSays } from '../../src/game/workerlog';
import { cropSeed, gateOf, itemGateRefusal, OBSIDIAN_LEVEL, seenName, SKILL_GATES, unlocksOf } from '../../src/game/skillgates';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const U = '7e5b0000-0000-4000-8000-0000000a7e01';
const T = 40;
const SEED = 317;
/** A drawbridge's span, within a hod carrier's reach of the totem. */
const BX = T + 4;
const BY = T + 2;
const ALLOYS = METALS.filter((m) => !m.ore);
const OBSIDIAN_RECIPES = RECIPES.filter((r) => r.inputs.some((i) => i.item === OBSIDIAN));
const OBSIDIAN_MATERIALS = MATERIALS.filter((m) => m.bill.some(([i]) => i === OBSIDIAN));
const LOWERED = ['make_bucket', 'make_lye'];
/** Every row this batch moved, keyed as the island lists them. */
const MOVED = [
  'crop:wemp',
  ...LOWERED.map((id) => `recipe:${id}`),
  ...ALLOYS.map((m) => `metal:${m.id}`),
  ...ALLOYS.flatMap((m) => CASTING_SKILLS.map((s) => `casting:${castingGateId(s, m.id)}`)),
  ...OBSIDIAN_RECIPES.map((r) => `recipe:${r.id}`),
  ...OBSIDIAN_MATERIALS.map((m) => `material:${m.id}`),
];
const refused = (call: string): string => `coalesce(${call}, 'ALLOWED')`;
const isGate = (s: string): boolean => /: needs [a-z ]+ \d+; have \d+\.\d\.$/.test(s);
const VASE = OBSIDIAN_RECIPES.find((r) => r.result === 'obsidian_vase')!;

/* ---- the island ----------------------------------------------------------- */

const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.skill(w uuid, u uuid, id text, v real) returns void language sql as $s$
  insert into skill (world_id, uid, id, value) values (w, u, id, v)
    on conflict (world_id, uid, id) do update set value = excluded.value;
$s$;
create function pg_temp.worker(w uuid, u uuid, p_skills jsonb) returns creature language plpgsql as $m$
declare v int; c creature;
begin
  v := creature_spawn(w, 'magga', ${T}.5, ${T}.5, 'active', now() - interval '60 days', u);
  update creature set skills = p_skills where world_id = w and id = v returning * into c;
  return c;
end $m$;
do $t$
declare w uuid; u uuid := '${U}'; c creature; v_b bigint; v_seed bigint; v_it item; r record;
begin
  insert into said select 'MOVED', string_agg(kind || ':' || id || ':' || skill || ':' || level, ',' order by kind collate "C", id collate "C")
    from skill_gate where kind || ':' || id in (${MOVED.map((k) => `'${k}'`).join(', ')});
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Gates G', ${SEED}, 120, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 120);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 119) x, generate_series(0, 119) y;
  perform land_set_height(w, x, y, 50) from generate_series(0, 120) x, generate_series(0, 120) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Gatestead', ${T}, ${T}, 15, 5, u);
  update player set x = ${T}.5, y = ${T + 1}.5, body_at = now(), seen_at = now(),
         stats = '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb where world_id = w and uid = u;

  /* ---- the everyday ones at 1 ---- */
  perform pg_temp.skill(w, u, 'carpentry', 1);
  perform pg_temp.skill(w, u, 'alchemy', 1);
  perform pg_temp.skill(w, u, 'farming', 1);
${LOWERED.map((id) => `  insert into said values ('LOW_${id}', ${refused(`craft_refusal(w, u, '${id}', null)`)});`).join('\n')}
  v_seed := give(w, u, '${cropSeed('wemp')}', 2, 30, null);
  select * into v_it from item where id = v_seed;
  insert into said values ('WEMP_NAME', seen_name(w, u, v_it));
  insert into said values ('WEMP_SOW', ${refused('item_gate_refusal(w, u, v_it)')});

  /* ---- alloys by their recipe ---- */
  perform pg_temp.skill(w, u, 'blacksmithing', 1);
  insert into said values ('STEEL1', ${refused(`metal_gate_refusal(w, u, 'steel')`)});
  perform pg_temp.skill(w, u, 'blacksmithing', 30);
  insert into said values ('FIRE30', ${refused(`metal_gate_refusal(w, u, 'firesteel')`)});

  /* ---- obsidian at 99 ---- */
  perform pg_temp.skill(w, u, 'glassblowing', 90);
  insert into said values ('VASE90', ${refused(`craft_refusal(w, u, '${VASE.id}', null)`)});
  perform pg_temp.skill(w, u, 'glassblowing', 99);
  insert into said values ('VASE99', ${refused(`craft_refusal(w, u, '${VASE.id}', null)`)});
  perform pg_temp.skill(w, u, 'masonry', 90);
  insert into said values ('GLASS90', ${refused(`build_gate_refusal(w, u, '${OBSIDIAN_MATERIALS[0]?.id ?? 'obsidian_glass'}', 'solid', null, null)`)});

  /* ---- a hod carrier and a drawbridge's span ---- */
  insert into bridge (world_id, kind, ax, ay, bx, by, height) values (w, 'draw', ${BX}, ${BY}, ${BX + 1}, ${BY}, 52) returning id into v_b;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total) values (w, v_b, 0, ${BX}, ${BY}, '{"plank": 10}', '{"plank": 10}');
  c := pg_temp.worker(w, u, '{"masonry": 1, "carpentry": 1}');
  select * into r from hod_span_gate(w, c, ${T}, ${T}, 10);
  insert into said values ('SPAN1', coalesce(r.kind || ':' || r.n, 'none'));
  c := pg_temp.worker(w, u, '{"masonry": 1, "carpentry": 50}');
  select * into r from hod_span_gate(w, c, ${T}, ${T}, 10);
  insert into said values ('SPAN50', coalesce(r.kind || ':' || r.n, 'none'));
  -- And a wall it may fit within reach: not only spans, so no gate.
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total)
    values (w, 0, 'h', ${T + 2}, ${T + 2}, 0, 'solid', 'log', '{"log": 4}', '{"log": 4}');
  c := pg_temp.worker(w, u, '{"masonry": 1, "carpentry": 1}');
  select * into r from hod_span_gate(w, c, ${T}, ${T}, 10);
  insert into said values ('SPANWALL', coalesce(r.kind || ':' || r.n, 'none'));
end $t$;
select k || '=' || coalesce(v, '') from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const said = (k: string): string => isle.get(k) ?? '';

/* ---- the table ------------------------------------------------------------ */

{
  const rows = SKILL_GATES.filter((g) => MOVED.includes(`${g.kind}:${g.id}`))
    .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((g) => `${g.kind}:${g.id}:${g.skill}:${g.level}`).join(',');
  check(`the island's rows for what batch G moved are the browser's (${MOVED.length})`, said('MOVED') === rows && rows.split(',').length === MOVED.length,
    `island ${said('MOVED').slice(0, 300)} / browser ${rows.slice(0, 300)}`);
  check('wemp sown at farming 1, the bucket at carpentry 1, lye at alchemy 1',
    gateOf('crop', 'wemp')?.level === 1 && gateOf('recipe', 'make_bucket')?.level === 1 && gateOf('recipe', 'make_lye')?.level === 1
      && gateOf('recipe', 'make_lye')?.skill === 'alchemy');
  const mix = (lump: string): number => recipeLevel(RECIPES.find((r) => r.category === 'Smelting' && r.result === lump)!);
  check(`an alloy poured and its castings worked at its mixing recipe's level: ${ALLOYS.map((m) => `${m.id} ${METAL_GATE[m.id]}`).join(', ')}`,
    ALLOYS.every((m) => METAL_GATE[m.id] === mix(m.lump) && gateOf('metal', m.id)?.level === mix(m.lump)
      && CASTING_SKILLS.every((s) => gateOf('casting', castingGateId(s, m.id))?.level === mix(m.lump)))
      && METAL_GATE.steel === 20 && METAL_GATE.firesteel === 40 && METAL_GATE.bronze === 10 && METAL_GATE.pewter === 5);
  check(`every recipe with obsidian in it at ${OBSIDIAN_LEVEL}, in its own skill (${OBSIDIAN_RECIPES.length}: ${[...new Set(OBSIDIAN_RECIPES.map((r) => r.skill))].join(', ')})`,
    OBSIDIAN_RECIPES.length > 0 && OBSIDIAN_RECIPES.every((r) => gateOf('recipe', r.id)?.level === OBSIDIAN_LEVEL && gateOf('recipe', r.id)?.skill === r.skill));
  check(`and every material built of it (${OBSIDIAN_MATERIALS.map((m) => m.id).join(', ')}), in its own skill`,
    OBSIDIAN_MATERIALS.length > 0 && OBSIDIAN_MATERIALS.every((m) => gateOf('material', m.id)?.level === OBSIDIAN_LEVEL && gateOf('material', m.id)?.skill === m.skill));
  check('and nothing made without obsidian reaches 99 by its difficulty',
    RECIPES.filter((r) => !r.inputs.some((i) => i.item === OBSIDIAN)).every((r) => (gateOf('recipe', r.id)?.level ?? 0) <= 90));
}

/* ---- the browser ---------------------------------------------------------- */

const fresh = (): Game => {
  const g = Game.create(SEED, 120);
  g.world.water = null;
  g.world.heights.fill(50);
  g.world.tiles.fill(TileType.Grass);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.deed = { name: 'Gatestead', x: T, y: T, radius: 15, level: 5 } as typeof g.deed;
  g.player.x = T + 0.5;
  g.player.y = T + 1.5;
  return g;
};
const set = (g: Game, skill: string, v: number): void => { g.skills.values.set(skill, v); };

{
  const g = fresh();
  for (const s of ['carpentry', 'alchemy', 'farming']) set(g, s, 1);
  const low = LOWERED.map((id) => recipeReason(RECIPE_BY_ID.get(id)!, g) ?? 'ALLOWED');
  check(`the bucket and lye at 1: past the gate on both sides (${low.join(' | ')} / ${LOWERED.map((id) => said(`LOW_${id}`)).join(' | ')})`,
    low.every((s) => !isGate(s)) && LOWERED.every((id) => said(`LOW_${id}`) !== '' && !isGate(said(`LOW_${id}`))));
  const seed = g.inventory.add(cropSeed('wemp'), { ql: 30, count: 2 });
  check('wemp seeds known and sown at farming 1, on both sides', seenName(seed, g) === said('WEMP_NAME') && !said('WEMP_NAME').startsWith('Unidentified')
    && itemGateRefusal(seed, g) === null && said('WEMP_SOW') === 'ALLOWED', `island ${said('WEMP_NAME')} ${said('WEMP_SOW')}`);
  set(g, 'blacksmithing', 1);
  const steel = 'Steel pouring: needs blacksmithing 20; have 1.0.';
  check(`steel pouring at blacksmithing 1: "${steel}" on both sides`, metalGateRefusal(g, 'steel') === steel && said('STEEL1') === steel, said('STEEL1'));
  set(g, 'blacksmithing', 30);
  const fire = 'Fire-tempered steel pouring: needs blacksmithing 40; have 30.0.';
  check(`fire-tempered steel at 30: "${fire}" on both sides`, metalGateRefusal(g, 'firesteel') === fire && said('FIRE30') === fire, said('FIRE30'));
  set(g, 'glassblowing', 90);
  const vase = `${gateOf('recipe', VASE.id)!.name}: needs glassblowing ${OBSIDIAN_LEVEL}; have 90.0.`;
  const v90 = recipeReason(VASE, g);
  check(`an obsidian vase at glassblowing 90: "${vase}" on both sides; at 99 past it`, v90 === vase && said('VASE90') === vase && !isGate(said('VASE99')),
    `island "${said('VASE90')}" ${said('VASE99')} / browser "${v90}"`);
  set(g, 'masonry', 90);
  const m = OBSIDIAN_MATERIALS[0];
  const glass = `${gateOf('material', m.id)!.name}: needs masonry ${OBSIDIAN_LEVEL}; have 90.0.`;
  const g90 = buildGateRefusal(g, m.id, { wall: 'solid' });
  check(`${m.name.toLowerCase()} building at masonry 90: "${glass}" on both sides`, g90 === glass && said('GLASS90') === glass, `island "${said('GLASS90')}" / browser "${g90}"`);
}

/* ---- a hod carrier and a drawbridge's span ---------------------------------------- */

{
  const g = fresh();
  // Its deck the tiles between its two ends: its first span at (BX, BY), as the island's.
  g.addBridge('draw', BX - 1, BY, BX + 2, BY, 52);
  const near = (): boolean => true;
  const from = { x: T, y: T };
  const at = (carpentry: number): string => {
    const got = g.hodGatedSpan(near, from, (t) => hodMay({ skills: { masonry: 1, carpentry } }, t));
    return got ? `${got.kind}:${got.n}` : 'none';
  };
  check(`a hod carrier at carpentry 1 with only a drawbridge's span in reach: gate, naming it (${at(1)}); at 50, not; on both sides`,
    at(1) === `draw:${Math.max(BX - T, BY - T)}` && said('SPAN1') === at(1) && at(50) === 'none' && said('SPAN50') === 'none',
    `island ${said('SPAN1')} ${said('SPAN50')} / browser ${at(1)} ${at(50)}`);
  check('and with a wall it may fit in reach too, not only spans: no gate, on the island', said('SPANWALL') === 'none', said('SPANWALL'));
  const idle = idleSays({ why: 'gate', n: BX - T, what: ['bridge', 'draw'] }, 'hod', null, 1, { carpentry: 1 });
  check(`its words: "${idle}"`, idle === `Idle: Drawbridge ${BX - T} tiles from the totem needs carpentry 50 (yours 1.0).`, idle);
}

/* ---- the Skills window ------------------------------------------------------------ */

{
  for (const skill of ['glassblowing', 'stonecutting', 'platesmithing']) {
    const top = unlocksOf(skill, 90).filter((u) => u.level === OBSIDIAN_LEVEL);
    check(`${skill}'s Unlocks list its obsidian work at ${OBSIDIAN_LEVEL}, not met at 90 (${top.map((u) => u.name).slice(0, 4).join(', ')})`,
      top.length > 0 && top.every((u) => !u.met) && top.every((u) => OBSIDIAN_RECIPES.some((r) => gateOf('recipe', r.id)?.name === u.name)));
  }
}

finish('Skill gates: the answers to batch F, obsidian at 99, alloys by their recipe, a hod carrier naming a bridge');

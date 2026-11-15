/**
 * Iron and rock outcroppings (`outcrops.ts`): set down at each daily reset on grass inside the safe ring round the
 * spawn and each Runestone, mined twenty times at QL 5 and gone.
 *
 * Asked for: "iron and rock outcropping models. These will spawn randomly within the runestone safe zones on grass
 * daily and can be mined 20 times before breaking and going away until next daily reset spawns more." And: everything
 * mined off one is QL 5, whatever the skill or the pickaxe. Asked of the island, on an island of its own big enough
 * for the Runestones (every rule here is the island's), and of the browser's words for the same numbers:
 *
 *   * every kind, count and number is the same on both sides, and Mine at one is mining's job: its skill, tool, wind,
 *     time and odds;
 *   * a daily reset sets down each kind's count round the spawn and round each Runestone, every one on dry grass
 *     inside that ring, clear of its centre, off the settlement, the cobbles, the dirt and the water laid across the
 *     rings, never beside another placed piece, each with its uses whole; and the daily tick runs it after the woods;
 *   * Examine of its tile says it, its uses left and what it gives, in the browser's words; nothing but Mine is done
 *     to one;
 *   * mined until it breaks: each swing that comes off gives one iron ore at QL 5 at mining 99 with a pickaxe of QL
 *     100, takes one use and says so; a failed swing takes none; the twentieth takes it away and says it broke; Mine
 *     after is refused; mining is trained; a rock one gives rock shards at QL 5;
 *   * the next reset takes the rest away and sets down a whole new set.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { ACTION_BY_ID } from '../../src/game/actions';
import { itemDef } from '../../src/game/items';
import {
  MINE_JOB, OUTCROP_BY_ID, OUTCROP_CLEAR, OUTCROP_DRAWS, OUTCROP_KINDS, OUTCROP_MINE, OUTCROP_QL, OUTCROP_SAID, OUTCROP_USES, OUTCROPS_A_RING,
  outcropBrokeSays, outcropMinedSays, outcropSays, usesSaid,
} from '../../src/game/outcrops';
import { RUNESTONES, SAFE_RING, safeRingPoints } from '../../src/game/runestones';
import { psql, check, finish } from './harness';

const U = '0c7c0000-0000-4000-8000-0000000000a1';
/** Big enough for the Runestones (`STONE_LEAST`). */
const SIZE = 1024;
const SPAWN = { x: 120, y: 120 };
/** Where the island's rings are measured from: the spawn and each stone. */
const CENTRES = safeRingPoints(SIZE, SPAWN.x, SPAWN.y);

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.go(w uuid, u uuid, a text, t jsonb) returns void language plpgsql as $f$
begin
  update player set act = a, act_target = t, act_started = now() - interval '2 seconds',
         act_ends = now() - interval '1 second', act_left = 1, act_goes = 1, act_queue = '[]',
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  perform settle(w, u);
end $f$;
do $t$
declare w uuid; c record; o record; v_id bigint; v_x int; v_y int; v_t jsonb; v_uses int; v_was int; v_ore int; v_n int; k int;
        v_ok int := 0; v_fail int := 0; v_bad text := ''; v_skill double precision; v_ids bigint[]; v_rock bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Outcrops', 4243, ${SIZE}, ${SPAWN.x}, ${SPAWN.y}, true) returning id into w;
  insert into said values ('WORLD', w::text);
  perform land_blank(w, ${SIZE});
  -- Every corner ten metres up and every tile grass; then, across every ring, a band of dirt, a band of cobbles and a
  -- band of sea, and a settlement over the spawn ring's west.
  update land_corner set heights = decode(repeat('6400', ${SIZE + 1}), 'hex') where world_id = w;
  update land_tile t set tiles = (select decode(string_agg(lpad(to_hex(case
      when (gx % 64) between 40 and 47 then tile_id('Dirt') when (gx % 64) between 48 and 51 then tile_id('Cobblestone') else 0 end), 2, '0'), '' order by gx), 'hex')
    from generate_series(0, ${SIZE - 1}) gx) where t.world_id = w;
  for c in select * from outcrop_centres(w) loop
    for v_y in floor(c.y)::int + 20 .. floor(c.y)::int + 30 loop
      for v_x in floor(c.x)::int - 61 .. floor(c.x)::int + 61 loop perform land_set_height(w, v_x, v_y, -20); end loop;
    end loop;
  end loop;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Hamlet', ${SPAWN.x - 35}, ${SPAWN.y - 10}, 15, 1, '0c7c0000-0000-4000-8000-0000000000ff');
  -- A chest set down in the spawn ring: nothing is set down beside it.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy) values (w, 'furniture', 'chest', ${SPAWN.x + 20}, ${SPAWN.y - 20}, 0, 0, ${SPAWN.x + 20.5}, ${SPAWN.y - 19.5});

  -- Both sides' numbers.
  insert into said select 'KINDS', string_agg(id || ':' || name || ':' || yields || ':' || per_ring, '|' order by id) from outcrop_kinds();
  insert into said values ('NUMS', outcrop_uses() || '|' || outcrop_ql() || '|' || outcrop_clear() || '|' || outcrop_draws() || '|' || outcrops_a_ring()
    || '|' || outcrop_mine() || '|' || outcrop_said_gone() || '|' || outcrop_said_only() || '|' || safe_ring() || '|' || outcrop_uses_said(14));
  insert into said select 'JOB', d.skill || '|' || d.tool || '|' || d.stamina || '|' || d.base_time || '|' || d.difficulty || '|' || d.label || '|' || act_ported(d.id)
    || '|' || (select m.skill || '|' || m.tool || '|' || m.stamina || '|' || m.base_time || '|' || m.difficulty from action_def m where m.id = 'mine')
    from action_def d where d.id = outcrop_mine();
  insert into said values ('CENTRES', (select string_agg(x || ',' || y, '|' order by x, y) from outcrop_centres(w)));
  insert into said values ('TICK', (pg_get_functiondef('tree_tick()'::regprocedure) like '%perform outcrop_day(v_world)%')::text);

  -- ---- A daily reset ------------------------------------------------------------------------------------------------
  insert into said values ('LAID', outcrop_day(w)::text);
  for o in select pl.* from placed pl where pl.world_id = w and pl.sub in (select id from outcrop_kinds()) order by pl.id loop
    insert into said values ('SITE', o.sub || '|' || o.x || '|' || o.y || '|' || land_tile(w, o.x, o.y) || '|' || has_water(w, o.x, o.y) || '|'
      || on_deed(w, o.x, o.y) || '|' || (building_at(w, o.x, o.y) is not null) || '|' || coalesce((o.state->>'uses'), '-') || '|' || o.kind || '|'
      || (select count(*) from placed p2 where p2.world_id = w and p2.id <> o.id and p2.x between o.x - 1 and o.x + 1 and p2.y between o.y - 1 and o.y + 1)
      || '|' || o.cx || '|' || o.cy);
  end loop;
  v_ids := array(select pl.id from placed pl where pl.world_id = w and pl.sub in (select id from outcrop_kinds()));

  -- ---- A body, a pickaxe and an iron outcropping ---------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', '${U}')::text, true);
  perform rpc_join(w, 'Miner');
  select pl.id, pl.x, pl.y into v_id, v_x, v_y from placed pl where pl.world_id = w and pl.sub = 'iron_outcrop' order by pl.id limit 1;
  select pl.id into v_rock from placed pl where pl.world_id = w and pl.sub = 'rock_outcrop' order by (pl.x - v_x) ^ 2 + (pl.y - v_y) ^ 2 desc, pl.id limit 1;
  update player set x = v_x + 0.5 + 1.2, y = v_y + 0.5, away = false, body_at = now(), act = null, act_queue = '[]' where world_id = w and uid = '${U}';
  delete from item where world_id = w and holder = 'player' and holder_uid = '${U}';
  insert into said values ('NOPICK', coalesce(act_refusal(w, '${U}', outcrop_mine(), jsonb_build_object('kind', 'furniture', 'id', v_id)), 'ALLOWED'));
  perform give(w, '${U}', 'pickaxe', 1, 100);
  insert into skill (world_id, uid, id, value) values (w, '${U}', 'mining', 99) on conflict (world_id, uid, id) do update set value = excluded.value;
  v_t := jsonb_build_object('kind', 'furniture', 'id', v_id);
  insert into said values ('EXAMINE', examine_tile_text(w, v_x, v_y, '${U}'));
  insert into said values ('REFUSE', coalesce(act_refusal(w, '${U}', outcrop_mine(), v_t), 'ALLOWED'));
  insert into said values ('OTHER', coalesce(act_refusal(w, '${U}', 'pick_up_furniture', v_t), 'ALLOWED') || '|'
    || coalesce(act_refusal(w, '${U}', 'turn_furniture', v_t), 'ALLOWED'));
  insert into said values ('FAR', coalesce(act_refusal(w, '${U}', outcrop_mine(), jsonb_build_object('kind', 'furniture', 'id', v_rock)), 'ALLOWED'));

  -- ---- Mined until it breaks ------------------------------------------------------------------------------------------
  v_skill := skill_of(w, '${U}', 'mining');
  for k in 1 .. 200 loop
    select (pl.state->>'uses')::int into v_was from placed pl where pl.id = v_id;
    exit when v_was is null;
    v_ore := (select coalesce(sum(i.count), 0) from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = '${U}' and i.def = 'iron_ore');
    update skill set value = 99 where world_id = w and uid = '${U}' and id = 'mining';
    perform pg_temp.go(w, '${U}', outcrop_mine(), v_t);
    select (pl.state->>'uses')::int into v_uses from placed pl where pl.id = v_id;
    v_n := (select coalesce(sum(i.count), 0) from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = '${U}' and i.def = 'iron_ore') - v_ore;
    if v_n = 1 then
      v_ok := v_ok + 1;
      -- One use taken, or the piece gone at the last.
      if coalesce(v_uses, 0) <> v_was - 1 then v_bad := v_bad || ' swing ' || k || ': ' || v_was || '->' || coalesce(v_uses::text, 'gone'); end if;
    elsif v_n = 0 then
      v_fail := v_fail + 1;
      if v_uses is distinct from v_was then v_bad := v_bad || ' failed swing ' || k || ' took a use'; end if;
    else
      v_bad := v_bad || ' swing ' || k || ' gave ' || v_n;
    end if;
  end loop;
  insert into said values ('MINED', v_ok || '|' || v_fail || '|' || v_bad || '|' || exists (select 1 from placed pl where pl.id = v_id));
  insert into said select 'ORE', coalesce(sum(i.count), 0) || '|' || coalesce(string_agg(distinct i.ql::text, ','), '-')
    from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = '${U}' and i.def = 'iron_ore';
  insert into said values ('AFTER', coalesce(act_refusal(w, '${U}', outcrop_mine(), v_t), 'ALLOWED'));
  insert into said values ('TRAINED', (skill_of(w, '${U}', 'mining') > 99)::text);
  insert into said select 'TOLD', string_agg(e.text, '|' order by e.n) from (
    select e.n, e.text from event e where e.world_id = w and e.uid = '${U}' and (e.text like 'Mined:%' or e.text like '%broken.%') order by e.n desc limit 3) e;

  -- And a swing at a rock one.
  select pl.x, pl.y into v_x, v_y from placed pl where pl.id = v_rock;
  update player set x = v_x + 0.5 + 1.2, y = v_y + 0.5 where world_id = w and uid = '${U}';
  for k in 1 .. 20 loop
    perform pg_temp.go(w, '${U}', outcrop_mine(), jsonb_build_object('kind', 'furniture', 'id', v_rock));
    exit when exists (select 1 from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = '${U}' and i.def = 'rock_shards');
  end loop;
  insert into said select 'SHARDS', coalesce(sum(i.count), 0) || '|' || coalesce(string_agg(distinct i.ql::text, ','), '-') || '|'
    || (select pl.state->>'uses' from placed pl where pl.id = v_rock)
    from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = '${U}' and i.def = 'rock_shards';

  -- ---- The next reset ----------------------------------------------------------------------------------------------
  insert into said values ('RELAID', outcrop_day(w)::text);
  insert into said select 'NEW', count(*) || '|' || count(*) filter (where pl.id = any (v_ids)) || '|'
    || count(*) filter (where (pl.state->>'uses')::int = outcrop_uses()::int)
    from placed pl where pl.world_id = w and pl.sub in (select id from outcrop_kinds());
end $t$;
select k || '=' || v from said;
rollback;
`);
const lines = out.split('\n').filter((l) => l.includes('='));
const said = (k: string): string[] => lines.filter((l) => l.startsWith(`${k}=`)).map((l) => l.slice(k.length + 1));
const one = (k: string): string => said(k)[0] ?? '';

/* ---- The numbers ---------------------------------------------------------------------------------------------------- */

const kindsHere = [...OUTCROP_KINDS].sort((a, b) => a.id.localeCompare(b.id)).map((k) => `${k.id}:${k.name}:${k.yields}:${k.perRing}`).join('|');
check(`the kinds, what each yields and how many round each ring centre, the same on both sides (${OUTCROP_KINDS.map((k) => `${k.perRing} ${k.name.toLowerCase()}`).join(', ')})`,
  one('KINDS') === kindsHere, one('KINDS'));
const nums = [OUTCROP_USES, OUTCROP_QL, OUTCROP_CLEAR, OUTCROP_DRAWS, OUTCROPS_A_RING, OUTCROP_MINE, OUTCROP_SAID.gone, OUTCROP_SAID.only, SAFE_RING, usesSaid(14)].join('|');
check(`${OUTCROP_USES} uses, QL ${OUTCROP_QL}, clear ${OUTCROP_CLEAR} tiles of a centre, ${OUTCROP_DRAWS} draws, ${OUTCROPS_A_RING} a ring, the words, the same on both sides`,
  one('NUMS') === nums && OUTCROP_USES === 20 && OUTCROP_QL === 5, one('NUMS'));
const mine = ACTION_BY_ID.get('mine')!, mo = ACTION_BY_ID.get(OUTCROP_MINE)!;
const job = one('JOB').split('|');
check('Mine at an outcropping is mining\'s job on both sides: skill, tool, wind, time and odds; ported',
  job.slice(0, 5).join('|') === job.slice(7, 12).join('|') && job[5] === 'Mine' && job[6] === 'true'
    && mo.skill === mine.skill && mo.tool === mine.tool && mo.stamina === mine.stamina && mo.baseTime === mine.baseTime && mo.difficulty === mine.difficulty
    && mine.skill === MINE_JOB.skill && Number(job[2]) === MINE_JOB.stamina && Number(job[3]) === MINE_JOB.baseTime,
  one('JOB'));
const centresHere = CENTRES.map((p) => `${p.x},${p.y}`).sort().join('|');
const centresThere = one('CENTRES').split('|').map((p) => p.split(',').map(Number).join(',')).sort().join('|');
check(`the island's ring centres are the browser's: the spawn and the ${RUNESTONES.length} Runestones`, centresThere === centresHere && CENTRES.length === RUNESTONES.length + 1, one('CENTRES'));
check('the daily tick sets the day\'s outcroppings down after the woods', one('TICK') === 'true');

/* ---- A daily reset ---------------------------------------------------------------------------------------------- */

interface Site { kind: string; x: number; y: number; tile: number; wet: boolean; deed: boolean; built: boolean; uses: string; pkind: string; near: number; cx: number; cy: number }
const sites: Site[] = said('SITE').map((l) => {
  const [kind, x, y, tile, wet, deed, built, uses, pkind, near, cx, cy] = l.split('|');
  return { kind, x: +x, y: +y, tile: +tile, wet: wet === 'true', deed: deed === 'true', built: built === 'true', uses, pkind, near: +near, cx: +cx, cy: +cy };
});
const want = CENTRES.length * OUTCROPS_A_RING;
check(`a reset sets down ${OUTCROPS_A_RING} round each of the ${CENTRES.length} ring centres: ${want}`, Number(one('LAID')) === want && sites.length === want, `${one('LAID')} laid, ${sites.length} found`);
const ringOf = (s: Site): number => CENTRES.findIndex((p) => (s.x + 0.5 - p.x) ** 2 + (s.y + 0.5 - p.y) ** 2 <= SAFE_RING ** 2);
// Rings that meet (the chart laid over a small island) share their ground, so each kind is counted over them all.
const perKind = OUTCROP_KINDS.map((k) => sites.filter((s) => s.kind === k.id).length);
check(`each kind's count round every centre (${OUTCROP_KINDS.map((k) => `${k.perRing} ${k.id}`).join(', ')})`,
  perKind.every((n, j) => n === OUTCROP_KINDS[j].perRing * CENTRES.length), JSON.stringify(perKind));
const offGrass = sites.filter((s) => s.tile !== 0 || s.wet);
check('every one on dry grass: none on the dirt, the cobbles or the sea laid across the rings', offGrass.length === 0, JSON.stringify(offGrass.slice(0, 3)));
const outside = sites.filter((s) => ringOf(s) < 0);
check(`every one inside the safe ring (${SAFE_RING} tiles of the spawn or a Runestone)`, outside.length === 0, JSON.stringify(outside.slice(0, 3)));
const crowded = sites.filter((s) => CENTRES.some((p) => Math.max(Math.abs(s.x + 0.5 - p.x), Math.abs(s.y + 0.5 - p.y)) <= OUTCROP_CLEAR));
check(`none within ${OUTCROP_CLEAR} tiles of a ring's centre`, crowded.length === 0, JSON.stringify(crowded.slice(0, 3)));
check('none on the settlement or in a building, and none beside another placed piece (the chest, another outcropping)',
  sites.every((s) => !s.deed && !s.built && s.near === 0), JSON.stringify(sites.filter((s) => s.deed || s.built || s.near).slice(0, 3)));
check(`each a whole tile of furniture with its ${OUTCROP_USES} uses`, sites.every((s) => s.pkind === 'furniture' && Number(s.uses) === OUTCROP_USES && s.cx === s.x + 0.5 && s.cy === s.y + 0.5));

/* ---- Examine, and what is refused ---------------------------------------------------------------------------- */

const iron = OUTCROP_BY_ID.get('iron_outcrop')!, rock = OUTCROP_BY_ID.get('rock_outcrop')!;
const ironSays = outcropSays(iron, OUTCROP_USES, itemDef(iron.yields).name);
check(`Examine of its tile says it, in the browser's words: "${ironSays.trim()}"`, one('EXAMINE').endsWith(ironSays), one('EXAMINE'));
check('Mine with no pickaxe is refused, with one it is not', one('NOPICK') === 'Need a pickaxe.' && one('REFUSE') === 'ALLOWED', `${one('NOPICK')} / ${one('REFUSE')}`);
check('one out of reach is refused', one('FAR') === 'You are too far away from that.', one('FAR'));
check(`nothing but Mine is done to one: "${iron.name}: ${OUTCROP_SAID.only}"`, one('OTHER') === `${iron.name}: ${OUTCROP_SAID.only}|${iron.name}: ${OUTCROP_SAID.only}`, one('OTHER'));

/* ---- Mined until it breaks ------------------------------------------------------------------------------------ */

const [okN, failN, badSwings, still] = one('MINED').split('|');
check(`mined until it breaks: ${OUTCROP_USES} swings come off, each giving one ${itemDef(iron.yields).name.toLowerCase()} and taking one use; a failed swing takes none`,
  Number(okN) === OUTCROP_USES && badSwings === '' && still === 'false', `${okN} came off, ${failN} failed${badSwings ? `;${badSwings}` : ''}; still there: ${still}`);
check(`everything mined off it at QL ${OUTCROP_QL}, at mining 99 with a pickaxe of QL 100`, one('ORE') === `${OUTCROP_USES}|${OUTCROP_QL}`, one('ORE'));
check(`Mine once it is gone is refused: "${OUTCROP_SAID.gone}"`, one('AFTER') === OUTCROP_SAID.gone, one('AFTER'));
check('mining is trained by it', one('TRAINED') === 'true');
const told = one('TOLD').split('|');
const toldHere = [outcropMinedSays(itemDef(iron.yields).name, 1), outcropMinedSays(itemDef(iron.yields).name, 0), outcropBrokeSays(iron)];
check('the last swings and the break said in the browser\'s words', told.join('|') === toldHere.join('|'), `${one('TOLD')} against ${toldHere.join('|')}`);
check(`a rock one gives ${itemDef(rock.yields).name.toLowerCase()} at QL ${OUTCROP_QL}, a use taken`, one('SHARDS') === `1|${OUTCROP_QL}|${OUTCROP_USES - 1}`, one('SHARDS'));

/* ---- The next reset -------------------------------------------------------------------------------------------- */

check(`the next reset takes the rest away and sets down ${want} new ones, whole`,
  Number(one('RELAID')) === want && one('NEW') === `${want}|0|${want}`, `${one('RELAID')} laid; ${one('NEW')} (count|old|whole)`);

finish('Outcroppings: set down daily in the safe ring on grass, mined twenty times at QL 5, gone until the next reset');

/**
 * Dye scrubbed off with a brush.
 *
 * Asked: "Add the option to scrub dye off an object/surface using a brush". Three jobs with a brush and no lye, the
 * other way to remove a dye than boiling it out (`strip_dye`, `strip_wall_paint`): Scrub off dye on a dyed thing in
 * the pack or a dyed piece set down (`scrub_dye`), Scrub off paint on a painted side (`scrub_wall_paint`), Scrub off
 * floor paint on a painted floor (`scrub_floor_paint`).
 *
 * Asked of both sides, on a dyed cloth, a dyed banner set down, a painted wall side and a painted floor:
 *   * the definitions: label, tool, time, wind, no skill, the same on the island's `action_def`;
 *   * without a brush each is refused in the general tool words ("Need a brush."), and not with one;
 *   * with nothing to remove ("No colour to remove."), on a plain cloth, a plain banner, a bare side and a bare floor;
 *   * a banner padlocked against you is refused as lifting it is ("Locked: no key."), and one out of reach on the
 *     island ("Stand next to the banner.");
 *   * a go of each comes out plain, says the lye removals' words ("Dye removed: plain cloth.", "Paint removed: bare
 *     log."), the same on both sides, and wears the brush a go's worth, once, uses no lye and leaves the lye removals
 *     as they were.
 *
 * Read only: the island's half is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, ACTIONS, type ActionDef, type Target } from '../../src/game/actions';
import { NO_COLOUR, SCRUB_TIME, SCRUB_TOOL, SCRUB_WIND } from '../../src/game/dyes';
import { Game } from '../../src/game/game';
import { BUCKET_LITRES, litresOf } from '../../src/game/items';
import { needToolSaid } from '../../src/game/jobtools';
import { wearPerUse } from '../../src/game/limits';
import { STOREY_JOBS } from '../../src/game/building';

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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

const JOBS = ['scrub_dye', 'scrub_wall_paint', 'scrub_floor_paint'] as const;
const HEX = '#3355aa';
const QL = 30;
const LOCK = 987654321;
/** One go's wear on a plain brush at `QL`: the browser's `wearPerUse`, the island's `wear_tool`. */
const GO_WEAR = wearPerUse(QL);
const BRUSH_SAID = needToolSaid(SCRUB_TOOL);

/* ---- the definitions ------------------------------------------------------ */
const defs = JOBS.map((id) => ACTION_BY_ID.get(id));
check('the three jobs are actions, with a brush, no skill, the time and the wind of a scrubbing',
  defs.every((d) => !!d && d.tool === SCRUB_TOOL && !d.skill && d.baseTime === SCRUB_TIME && d.stamina === SCRUB_WIND),
  defs.map((d) => `${d?.id}:${d?.tool}/${d?.skill ?? '-'}/${d?.baseTime}/${d?.stamina}`).join(' '));
const sqlIds = JOBS.map((id) => `'${id}'`).join(', ');
const islandDefs = psql(`select string_agg(id || '|' || label || '|' || coalesce(tool, '-') || '|' || coalesce(skill, '-') || '|' || base_time || '|' || stamina,
  ',' order by id collate "C") from action_def where id in (${sqlIds});`);
const browserDefs = defs.map((d) => `${d?.id}|${d?.label}|${d?.tool ?? '-'}|${d?.skill ?? '-'}|${d?.baseTime}|${d?.stamina}`).sort().join(',');
check('and the same on the island (`action_def`)', islandDefs === browserDefs, `${islandDefs} / ${browserDefs}`);
check('a scrubbing is offered under its own name beside the lye\'s (Remove dye, Remove paint)',
  new Set(['strip_dye', 'strip_wall_paint', ...JOBS].map((id) => ACTION_BY_ID.get(id)?.label)).size === 5,
  ['strip_dye', 'strip_wall_paint', ...JOBS].map((id) => ACTION_BY_ID.get(id)?.label).join(', '));
check('the side and the floor are storey jobs on both sides (`STOREY_JOBS`, `private.storey_job`)',
  STOREY_JOBS.has('scrub_wall_paint') && STOREY_JOBS.has('scrub_floor_paint') && !STOREY_JOBS.has('scrub_dye')
    && psql(`select string_agg(id || '=' || private.storey_job(id), ',' order by id collate "C") from unnest(array[${sqlIds}]) id;`)
      === 'scrub_dye=false,scrub_floor_paint=true,scrub_wall_paint=true');
check('and every one of them is ported to the island (`act_ported`)', psql(`select bool_and(act_ported(id)) from unnest(array[${sqlIds}]) id;`) === 't');
void ACTIONS.length;

/* ---- the browser ---------------------------------------------------------- */
const g = Game.create(4123, 96);
g.perkFx = {};
const tx = 9;
const ty = 9;
g.player.x = tx + 0.5;
g.player.y = ty + 0.5;
g.player.level = 0;
for (const it of [...g.inventory.items]) g.inventory.remove(it.uid, it.count);
const b = g.buildings.create('Scrubbed house', tx, ty);
const painted = g.buildings.setWall(b, 0, tx, ty, 'n', 'solid', 'log');
const bare = g.buildings.setWall(b, 0, tx, ty, 'w', 'solid', 'log');
for (const w of [painted, bare]) for (const k of Object.keys(w.needed)) w.needed[k] = 0;
painted.dye = HEX;
const floor = g.buildings.setFloor(b, 0, tx, ty, 'log');
for (const k of Object.keys(floor.needed)) floor.needed[k] = 0;
floor.dye = HEX;
const cloth = g.inventory.add('cloth', { ql: QL });
cloth.dye = HEX;
const plainCloth = g.inventory.add('sack', { ql: QL });
const lye = g.inventory.add('lye_bucket', { ql: QL });
const banner = g.addFurniture('banner', tx + 1, ty, 0, 0, QL);
banner.dye = HEX;
const plainBanner = g.addFurniture('banner', tx + 1, ty, 2, 2, QL);
const locked = g.addFurniture('banner', tx + 2, ty, 0, 0, QL);
locked.dye = HEX;
locked.lock = LOCK;

const tile = (side?: 'n' | 'w'): Target => ({ kind: 'tile', x: tx, y: ty, cx: tx, cy: ty, level: 0, ...(side ? { side } : {}) }) as Target;
const T: Record<string, [string, Target]> = {
  item: ['scrub_dye', { kind: 'item', uid: cloth.uid } as Target],
  banner: ['scrub_dye', { kind: 'furniture', id: banner.id } as Target],
  wall: ['scrub_wall_paint', tile('n')],
  floor: ['scrub_floor_paint', tile()],
  plainItem: ['scrub_dye', { kind: 'item', uid: plainCloth.uid } as Target],
  plainBanner: ['scrub_dye', { kind: 'furniture', id: plainBanner.id } as Target],
  bareWall: ['scrub_wall_paint', tile('w')],
  locked: ['scrub_dye', { kind: 'furniture', id: locked.id } as Target],
};
const said = (k: string): string => {
  const [id, t] = T[k];
  return ACTION_BY_ID.get(id)?.check?.(t, g) ?? '-';
};
const browser = new Map<string, string>();
const DYED = ['item', 'banner', 'wall', 'floor'] as const;
for (const k of DYED) browser.set(k, said(k));
const brush = g.inventory.add(SCRUB_TOOL, { ql: QL });
for (const k of Object.keys(T)) browser.set(`${k}+`, said(k));
check('offered on each dyed thing and not on a plain one, in the browser',
  DYED.every((k) => ACTION_BY_ID.get(T[k][0])?.applies(T[k][1], g))
    && ['plainItem', 'plainBanner', 'bareWall'].every((k) => !ACTION_BY_ID.get(T[k][0])?.applies(T[k][1], g)));
// A go as the clock has it: the job asked again, done, and its tool worn (`completeAction`).
const go = (def: ActionDef, t: Target): string => {
  g.log.length = 0;
  g.player.stats.stamina = 1;
  g.action = { def, target: t, state: 'performing', elapsed: 1, duration: 1 };
  (g as unknown as { completeAction(): void }).completeAction();
  return g.log.map((l) => l.text).filter((s) => / removed: /.test(s)).join(' / ') || 'NOTHING SAID';
};
const goneBy: string[] = [];
for (const k of DYED) {
  const before = g.inventory.get(brush.uid)?.dmg ?? -1;
  browser.set(`${k}:said`, go(ACTION_BY_ID.get(T[k][0]) as ActionDef, T[k][1]));
  goneBy.push(((g.inventory.get(brush.uid)?.dmg ?? -1) - before).toFixed(6));
}
browser.set('item:dye', cloth.dye ?? '-');
browser.set('banner:dye', banner.dye ?? '-');
browser.set('wall:dye', painted.dye ?? '-');
browser.set('floor:dye', floor.dye ?? '-');
browser.set('brush', goneBy.join('/'));
browser.set('lye', String(litresOf(lye)));

/* ---- the island ----------------------------------------------------------- */
const out = psql(`
begin;
create temp table said (k text, v text);
create function pg_temp.go(w uuid, u uuid, a text, t jsonb) returns text language plpgsql as $f$
declare why text;
begin
  delete from event where world_id = w and uid = u;
  why := act_refusal(w, u, a, t);
  update player set act = a, act_target = t, act_started = now() - interval '2 seconds',
         act_ends = now() - interval '1 second', act_left = 1, act_goes = 1, act_queue = '[]'
   where world_id = w and uid = u;
  perform settle(w, u);
  return coalesce(why, '-') || '|' || coalesce((select string_agg(text, ' / ' order by n) from event
    where world_id = w and uid = u and text like '% removed: %'), 'NOTHING SAID');
end $f$;
create function pg_temp.brush(w uuid, u uuid) returns double precision language sql as $f$
  select coalesce((select dmg from item where world_id = w and holder = 'player' and holder_uid = u and def = '${SCRUB_TOOL}'), -1)
$f$;
do $$
declare w uuid; u uuid; v_b int; v_cloth bigint; v_plain bigint; v_banner bigint; v_plainb bigint; v_locked bigint; v_far bigint;
        t jsonb; r record; v_before double precision; v_gone text := '';
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  -- The padlocked banner stands off any settlement, where nobody's master key or rank opens it (\`lock_shut\`), as in the browser.
  if exists (select 1 from deed_covering(w, ${tx + 2}, ${ty})) then
    raise exception 'tile ${tx + 2},${ty} is on a settlement';
  end if;
  for x in 4..15 loop for y in 4..15 loop
    perform land_set_height(w, x, y, 40); perform land_set_dirt(w, x, y, 20);
    perform land_set_tile(w, x, y, tile_id('Packed dirt')); perform land_set_data(w, x, y, 0);
  end loop; end loop;
  delete from placed where world_id = w and x between 4 and 15 and y between 4 and 15;
  delete from wall where world_id = w and x between 3 and 16 and y between 3 and 16;
  delete from floor_tile where world_id = w and x between 4 and 15 and y between 4 and 15;
  delete from building_tile where world_id = w and x between 4 and 15 and y between 4 and 15;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = ${tx + 0.5}, y = ${ty + 0.5}, level = 0, act = null, act_queue = '[]', wind_until = null,
         class_mul = jsonb_build_object('fx', '{}'::jsonb) where world_id = w and uid = u;

  select coalesce(max(id), 0) + 1 into v_b from building where world_id = w;
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, v_b, 'Scrubbed house', 1, 0, u);
  insert into building_tile (world_id, building, x, y) values (w, v_b, ${tx}, ${ty});
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, dye)
    select w, 0, bd.dir, bd.x, bd.y, v_b, 'solid', 'log', '{"log": 0}', '{"log": 4}', '${HEX}' from border_of(${tx}, ${ty}, 'n') bd;
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total)
    select w, 0, bd.dir, bd.x, bd.y, v_b, 'solid', 'log', '{"log": 0}', '{"log": 4}' from border_of(${tx}, ${ty}, 'w') bd;
  insert into floor_tile (world_id, level, x, y, building, material, needed, total, dye)
    values (w, 0, ${tx}, ${ty}, v_b, 'log', '{"log": 0}', '{"log": 4}', '${HEX}');
  insert into item (world_id, holder, holder_uid, def, ql, dye) values (w, 'player', u, 'cloth', ${QL}, '${HEX}') returning id into v_cloth;
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, 'sack', ${QL}) returning id into v_plain;
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, 'lye_bucket', ${QL});
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, dye)
    values (w, 'furniture', 'banner', ${tx + 1}, ${ty}, 0, 0, ${tx + 1.25}, ${ty + 0.25}, ${QL}, u, '${HEX}') returning id into v_banner;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'banner', ${tx + 1}, ${ty}, 2, 2, ${tx + 1.75}, ${ty + 0.75}, ${QL}, u) returning id into v_plainb;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, dye, lock)
    values (w, 'furniture', 'banner', ${tx + 2}, ${ty}, 0, 0, ${tx + 2.25}, ${ty + 0.25}, ${QL}, u, '${HEX}', ${LOCK}) returning id into v_locked;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, dye)
    values (w, 'furniture', 'banner', 14, 14, 0, 0, 14.25, 14.25, ${QL}, u, '${HEX}') returning id into v_far;

  for r in select * from (values
    ('item', 'scrub_dye', jsonb_build_object('kind', 'item', 'uid', v_cloth)),
    ('banner', 'scrub_dye', jsonb_build_object('kind', 'furniture', 'id', v_banner)),
    ('wall', 'scrub_wall_paint', '{"kind": "tile", "x": ${tx}, "y": ${ty}, "cx": ${tx}, "cy": ${ty}, "level": 0, "side": "n"}'::jsonb),
    ('floor', 'scrub_floor_paint', '{"kind": "tile", "x": ${tx}, "y": ${ty}, "cx": ${tx}, "cy": ${ty}, "level": 0}'::jsonb),
    ('plainItem', 'scrub_dye', jsonb_build_object('kind', 'item', 'uid', v_plain)),
    ('plainBanner', 'scrub_dye', jsonb_build_object('kind', 'furniture', 'id', v_plainb)),
    ('bareWall', 'scrub_wall_paint', '{"kind": "tile", "x": ${tx}, "y": ${ty}, "cx": ${tx}, "cy": ${ty}, "level": 0, "side": "w"}'::jsonb),
    ('locked', 'scrub_dye', jsonb_build_object('kind', 'furniture', 'id', v_locked)),
    ('far', 'scrub_dye', jsonb_build_object('kind', 'furniture', 'id', v_far))
  ) as v(k, job, target) loop
    insert into said values (r.k, coalesce(act_refusal(w, u, r.job, r.target), '-'));
  end loop;
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, '${SCRUB_TOOL}', ${QL});
  for r in select * from (values
    ('item', 'scrub_dye', jsonb_build_object('kind', 'item', 'uid', v_cloth)),
    ('banner', 'scrub_dye', jsonb_build_object('kind', 'furniture', 'id', v_banner)),
    ('wall', 'scrub_wall_paint', '{"kind": "tile", "x": ${tx}, "y": ${ty}, "cx": ${tx}, "cy": ${ty}, "level": 0, "side": "n"}'::jsonb),
    ('floor', 'scrub_floor_paint', '{"kind": "tile", "x": ${tx}, "y": ${ty}, "cx": ${tx}, "cy": ${ty}, "level": 0}'::jsonb),
    ('plainItem', 'scrub_dye', jsonb_build_object('kind', 'item', 'uid', v_plain)),
    ('plainBanner', 'scrub_dye', jsonb_build_object('kind', 'furniture', 'id', v_plainb)),
    ('bareWall', 'scrub_wall_paint', '{"kind": "tile", "x": ${tx}, "y": ${ty}, "cx": ${tx}, "cy": ${ty}, "level": 0, "side": "w"}'::jsonb),
    ('locked', 'scrub_dye', jsonb_build_object('kind', 'furniture', 'id', v_locked)),
    ('far', 'scrub_dye', jsonb_build_object('kind', 'furniture', 'id', v_far))
  ) as v(k, job, target) loop
    insert into said values (r.k || '+', coalesce(act_refusal(w, u, r.job, r.target), '-'));
  end loop;
  -- A go of each of the four, as the clock has it.
  for r in select * from (values
    (1, 'item', 'scrub_dye', jsonb_build_object('kind', 'item', 'uid', v_cloth)),
    (2, 'banner', 'scrub_dye', jsonb_build_object('kind', 'furniture', 'id', v_banner)),
    (3, 'wall', 'scrub_wall_paint', '{"kind": "tile", "x": ${tx}, "y": ${ty}, "cx": ${tx}, "cy": ${ty}, "level": 0, "side": "n"}'::jsonb),
    (4, 'floor', 'scrub_floor_paint', '{"kind": "tile", "x": ${tx}, "y": ${ty}, "cx": ${tx}, "cy": ${ty}, "level": 0}'::jsonb)
  ) as v(n, k, job, target) order by n loop
    v_before := pg_temp.brush(w, u);
    insert into said values (r.k || ':said', pg_temp.go(w, u, r.job, r.target));
    v_gone := v_gone || case when v_gone = '' then '' else '/' end || to_char(pg_temp.brush(w, u) - v_before, 'FM0.000000');
  end loop;
  insert into said values ('item:dye', coalesce((select dye from item where id = v_cloth), '-'));
  insert into said values ('banner:dye', coalesce((select dye from placed where id = v_banner), '-'));
  insert into said values ('wall:dye', coalesce((select w2.dye from border_of(${tx}, ${ty}, 'n') bd join wall w2 on w2.world_id = w
    and w2.level = 0 and w2.dir = bd.dir and w2.x = bd.x and w2.y = bd.y), '-'));
  insert into said values ('floor:dye', coalesce((select dye from floor_tile where world_id = w and level = 0 and x = ${tx} and y = ${ty}), '-'));
  insert into said values ('brush', v_gone);
  insert into said values ('lye', (select item_litres(i)::text from item i where world_id = w and holder = 'player' and holder_uid = u and def = 'lye_bucket'));
end $$;
select string_agg(k || '=' || v, E'\\n' order by k) from said;
rollback;
`);
const island = new Map(out.split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as const));
const islandSaid = (k: string): string => (island.get(k) ?? 'missing').split('|')[1] ?? 'missing';
const islandWhy = (k: string): string => (island.get(k) ?? 'missing').split('|')[0];

/* ---- both sides ----------------------------------------------------------- */
const both = (k: string): string => `browser "${browser.get(k)}", island "${island.get(k)}"`;
for (const k of DYED) {
  check(`${k}: refused without a brush, "${BRUSH_SAID}", on both sides`, browser.get(k) === BRUSH_SAID && island.get(k) === BRUSH_SAID, both(k));
  check(`${k}: not refused with one, on both sides`, browser.get(`${k}+`) === '-' && island.get(`${k}+`) === '-', both(`${k}+`));
}
for (const k of ['plainItem', 'plainBanner', 'bareWall']) {
  check(`${k}: "${NO_COLOUR}" with a brush, on both sides`, browser.get(`${k}+`) === NO_COLOUR && island.get(`${k}+`) === NO_COLOUR, both(`${k}+`));
}
check('a banner padlocked against you: "Locked: no key.", as lifting it is, on both sides',
  browser.get('locked+') === 'Locked: no key.' && island.get('locked+') === 'Locked: no key.', both('locked+'));
check('a banner out of reach on the island: "Stand next to the banner."', island.get('far+') === 'Stand next to the banner.', island.get('far+'));
const WANT_SAID: Record<string, string> = {
  item: 'Dye removed: plain cloth.',
  banner: 'Dye removed: plain banner.',
  wall: 'Paint removed: bare log.',
  floor: 'Paint removed: bare log.',
};
for (const k of DYED) {
  check(`${k}: a go is allowed on the island and says "${WANT_SAID[k]}", the same on both sides`,
    islandWhy(`${k}:said`) === '-' && islandSaid(`${k}:said`) === WANT_SAID[k] && browser.get(`${k}:said`) === WANT_SAID[k],
    `browser "${browser.get(`${k}:said`)}", island "${island.get(`${k}:said`)}"`);
  check(`${k}: and comes out plain, on both sides`, browser.get(`${k}:dye`) === '-' && island.get(`${k}:dye`) === '-', both(`${k}:dye`));
}
const wantBrush = DYED.map(() => GO_WEAR.toFixed(6)).join('/');
check(`the brush is worn a go's worth each go, once (${GO_WEAR.toFixed(6)} at QL ${QL}), on both sides`,
  browser.get('brush') === wantBrush && island.get('brush') === wantBrush, `${both('brush')}, want ${wantBrush}`);
check(`and no lye is used, on both sides: ${BUCKET_LITRES} L left`,
  browser.get('lye') === String(BUCKET_LITRES) && Number(island.get('lye')) === BUCKET_LITRES, both('lye'));
check('the brush\'s wear is a plain one', near(GO_WEAR, wearPerUse(QL)));

/* ---- the lye removals, as they were --------------------------------------- */
const strip = ['strip_dye', 'strip_wall_paint'].map((id) => ACTION_BY_ID.get(id));
check('Remove dye and Remove paint take lye and no brush, on both sides',
  strip.every((d) => !!d && !d.tool) && psql(`select string_agg(id || '=' || coalesce(tool, '-'), ',' order by id) from action_def where id in ('strip_dye', 'strip_wall_paint');`)
    === 'strip_dye=-,strip_wall_paint=-');

for (const l of [...ok, ...bad]) console.log(l);
console.log(`dye scrubbed off with a brush — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

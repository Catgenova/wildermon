/**
 * Six more relics, and what each is good for.
 *
 * Asked for: "Old collar, old bridle, seed jar, old whetstone, makers stamp, rune tablet", from a list where each said
 * what it does. This asks, of both sides:
 *
 *   * that the six are relics restoring into things of their own, with the same numbers;
 *   * that an ancient collar takes `COLLAR_CUT` off a wildermon's upkeep and an ancient bridle puts `BRIDLE_PACE` on its
 *     speed ridden, once each, and a team's bridles their share on its pace;
 *   * that an ancient whetstone takes all the damage off a tool, its QL kept, and is refused on what it cannot hone;
 *   * that an ancient seed jar opens to `JAR_SEEDS` seeds of one crop at the jar's QL;
 *   * that a rune tablet puts `TABLET_GAIN` into the skill chosen, and is refused at `TABLET_BELOW`;
 *   * that an ancient stamp doubles the first step of rarity for `STAMP_GOES` goes and is gone after the last, its goes
 *     in its name;
 *   * and that each says the same on both sides.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { RELICS } from '../../src/game/archaeology';
import { CREATURE_ACTION_BY_ID } from '../../src/game/creatureActions';
import { ACTION_BY_ID } from '../../src/game/actions';
import { bloodMul, BRIDLE_PACE, bridleTeam, COLLAR_CUT, tackSpeed } from '../../src/game/creatures';
import { ITEM_DEFS, itemName } from '../../src/game/items';
import { CROP_BY_SEED } from '../../src/game/farming';
import { JAR_SEEDS, pressStamp, STAMP_GOES, STAMP_RARE, TABLET_BELOW, TABLET_GAIN } from '../../src/game/relicuse';

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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));

const SIX: Record<string, string> = {
  'old collar': 'ancient_collar', 'old bridle': 'ancient_bridle', 'seed jar': 'ancient_seed_jar',
  'old whetstone': 'ancient_whetstone', "maker's stamp": 'ancient_stamp', 'rune tablet': 'rune_tablet',
};
const SKILL = 'carpentry';
const U = '61616161-6161-4161-8161-616161616161';

/* ---- on the island ----------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; a int; c creature; px double precision; py double precision; v_tool bigint; v_frag bigint;
        v_jar bigint; v_tab bigint; v_was double precision; v_odds text := ''; i int; v_appetite double precision;
        v_tack double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Six relics', 616, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Delver');
  select x, y into px, py from player where world_id = w and uid = u;
  insert into said select 'RELICS', string_agg(name || ':' || parts || ':' || difficulty || ':' || result, ',' order by name)
    from relic_def where result in ('ancient_collar', 'ancient_bridle', 'ancient_seed_jar', 'ancient_whetstone', 'ancient_stamp', 'rune_tablet');
  insert into said values ('NUMBERS', collar_cut() || '|' || bridle_pace() || '|' || jar_seeds() || '|' || stamp_goes() || '|'
    || stamp_rare() || '|' || tablet_gain() || '|' || tablet_below());
  insert into said select 'PORTED', string_agg(t.act || ':' || act_ported(t.act) || ':' || exists (select 1 from action_def d where d.id = t.act), ',' order by t.act)
    from unnest(array['use_ancient_collar', 'use_ancient_bridle', 'hone_whetstone', 'open_seed_jar', 'read_rune_tablet']) as t(act);

  -- The collar and the bridle.
  a := creature_spawn(w, 'rabba', px + 0.5, py, 'active', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, name = 'Ash', kept = null, boosts = null where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  v_appetite := beast_mul(c, 'appetite'); v_tack := tack_speed(c);
  insert into said values ('COLLAR:NONE', coalesce(creature_refusal(w, u, 'use_ancient_collar', jsonb_build_object('kind', 'creature', 'id', a)), '-'));
  perform give(w, u, 'ancient_collar', 2, 30);
  perform give(w, u, 'ancient_bridle', 2, 30);
  perform perform_creature(w, u, 'use_ancient_collar', jsonb_build_object('kind', 'creature', 'id', a));
  perform perform_creature(w, u, 'use_ancient_bridle', jsonb_build_object('kind', 'creature', 'id', a));
  select * into c from creature where world_id = w and id = a;
  insert into said values ('FITTED', (beast_mul(c, 'appetite') / v_appetite) || '|' || (tack_speed(c) / v_tack) || '|'
    || pack_count(w, u, 'ancient_collar') || '|' || pack_count(w, u, 'ancient_bridle'));
  insert into said values ('AGAIN', creature_refusal(w, u, 'use_ancient_collar', jsonb_build_object('kind', 'creature', 'id', a)) || '|'
    || creature_refusal(w, u, 'use_ancient_bridle', jsonb_build_object('kind', 'creature', 'id', a)));
  insert into said select 'FITTOLD', string_agg(text, ' / ' order by n) from event where world_id = w and uid = u and text like '% fitted on %';
  insert into said values ('TEAMPATCHED', (pg_get_functiondef('vehicle_speed'::regproc) like '%bridle_team(p_world, p_id)%')::text);

  -- The whetstone.
  v_tool := give(w, u, 'shovel', 1, 37.25);
  update item set dmg = 40 where id = v_tool;
  v_frag := give(w, u, 'fragment', 1, 20, 'old pot 1/2');
  update item set dmg = 40 where id = v_frag;
  insert into said values ('HONE:NONE', coalesce(act_refusal(w, u, 'hone_whetstone', jsonb_build_object('kind', 'item', 'uid', v_tool)), '-'));
  perform give(w, u, 'ancient_whetstone', 1, 30);
  insert into said values ('HONE:FRAG', coalesce(act_refusal(w, u, 'hone_whetstone', jsonb_build_object('kind', 'item', 'uid', v_frag)), '-'));
  insert into said values ('HONE:OK', coalesce(act_refusal(w, u, 'hone_whetstone', jsonb_build_object('kind', 'item', 'uid', v_tool)), '-'));
  perform act_perform(w, u, 'hone_whetstone', jsonb_build_object('kind', 'item', 'uid', v_tool));
  insert into said select 'HONED', dmg || '|' || ql || '|' || pack_count(w, u, 'ancient_whetstone') from item where id = v_tool;
  perform give(w, u, 'ancient_whetstone', 1, 30);
  insert into said values ('HONE:SOUND', coalesce(act_refusal(w, u, 'hone_whetstone', jsonb_build_object('kind', 'item', 'uid', v_tool)), '-'));
  insert into said select 'HONETOLD', text from event where world_id = w and uid = u and text like 'Honed:%' order by n desc limit 1;

  -- The seed jar.
  v_jar := give(w, u, 'ancient_seed_jar', 1, 33.5);
  perform act_perform(w, u, 'open_seed_jar', jsonb_build_object('kind', 'item', 'uid', v_jar));
  insert into said select 'JAR', coalesce((select string_agg(def || ':' || count || ':' || ql, ',') from item
    where world_id = w and holder = 'player' and holder_uid = u and def like '%\\_seed' and def <> 'ancient_seed_jar'), '-')
    || '|' || pack_count(w, u, 'ancient_seed_jar');
  insert into said select 'JARTOLD', text from event where world_id = w and uid = u and text like 'Seed jar opened:%' order by n desc limit 1;

  -- The rune tablet.
  v_tab := give(w, u, 'rune_tablet', 1, 30);
  insert into said values ('TABLET:NOSKILL', coalesce(act_refusal(w, u, 'read_rune_tablet', jsonb_build_object('kind', 'item', 'uid', v_tab)), '-'));
  insert into skill (world_id, uid, id, value) values (w, u, '${SKILL}', 12.5) on conflict (world_id, uid, id) do update set value = excluded.value;
  perform act_perform(w, u, 'read_rune_tablet', jsonb_build_object('kind', 'item', 'uid', v_tab, 'skill', '${SKILL}'));
  insert into said values ('TABLET', skill_standing(w, u, '${SKILL}') || '|' || pack_count(w, u, 'rune_tablet'));
  insert into said select 'TABLETTOLD', text from event where world_id = w and uid = u and text like 'Rune tablet read:%' order by n desc limit 1;
  v_tab := give(w, u, 'rune_tablet', 1, 30);
  update skill set value = ${TABLET_BELOW} where world_id = w and uid = u and id = '${SKILL}';
  insert into said values ('TABLET:HIGH', coalesce(act_refusal(w, u, 'read_rune_tablet', jsonb_build_object('kind', 'item', 'uid', v_tab, 'skill', '${SKILL}')), '-'));

  -- The stamp: its goes, then none.
  perform give(w, u, 'ancient_stamp', 1, 30);
  for i in 1 .. ${STAMP_GOES} + 1 loop
    -- The press and the read of what it left are two statements: one would read the stamp from before its own press.
    v_odds := v_odds || press_stamp(w, u, 0.01) || ':';
    v_odds := v_odds || coalesce((select coalesce(charges, -1)::text from item where world_id = w
      and holder = 'player' and holder_uid = u and def = 'ancient_stamp'), 'gone') || ',';
  end loop;
  insert into said values ('STAMP', v_odds);
  insert into said select 'STAMPTOLD', string_agg(text, ' / ' order by n) from event where world_id = w and uid = u and text like 'Ancient stamp:%';
  v_tab := give(w, u, 'ancient_stamp', 1, 30);
  update item set charges = 3 where id = v_tab;
  insert into said select 'STAMPNAME', item_name(st) from item st where st.id = v_tab;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(616);
g.time = 3600 * 24 * 60;
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
const ash = g.creatures.spawn('rabba', g.player.x + 1, g.player.y, 'active', g.rand, g.time - 3600 * 24 * 30);
ash.traits = [];
ash.rare = 0;
ash.name = 'Ash';
ash.boosts = undefined;
const T = { kind: 'creature' as const, id: ash.id };
const told = (start: string): string[] => g.log.map((e) => e.text).filter((t) => t.startsWith(start));
const collar = CREATURE_ACTION_BY_ID.get('use_ancient_collar')!;
const bridle = CREATURE_ACTION_BY_ID.get('use_ancient_bridle')!;
const hone = ACTION_BY_ID.get('hone_whetstone')!;
const jar = ACTION_BY_ID.get('open_seed_jar')!;
const tablet = ACTION_BY_ID.get('read_rune_tablet')!;

/* ---- both ---------------------------------------------------------------------------- */

const browserRelics = RELICS.filter((r) => r.result in Object.fromEntries(Object.values(SIX).map((v) => [v, 1])))
  .map((r) => `${r.name}:${r.parts}:${r.difficulty}:${r.result}`).sort().join(',');
check('the six relics restore into things of their own, the same on both sides',
  browserRelics === at('RELICS') && Object.entries(SIX).every(([n, id]) => RELICS.some((r) => r.name === n && r.result === id) && ITEM_DEFS[id]
    && !ITEM_DEFS[id].description?.includes('{')), `${browserRelics} | ${at('RELICS')}`);
check('the numbers are the same on both sides',
  at('NUMBERS') === `${COLLAR_CUT}|${BRIDLE_PACE}|${JAR_SEEDS}|${STAMP_GOES}|${STAMP_RARE}|${TABLET_GAIN}|${TABLET_BELOW}`, at('NUMBERS'));
check('the five actions are ones the island does and prices, and the browser has',
  at('PORTED') === 'hone_whetstone:true:true,open_seed_jar:true:true,read_rune_tablet:true:true,use_ancient_bridle:true:true,use_ancient_collar:true:true'
    && [collar, bridle, hone, jar, tablet].every(Boolean), at('PORTED'));

// The collar and the bridle.
{
  const appetite = bloodMul(ash, 'appetite');
  const tack = tackSpeed(ash);
  check('without a collar, both refuse in the same words', collar.check?.(T, g) === at('COLLAR:NONE') && at('COLLAR:NONE') === 'Need an ancient collar.', at('COLLAR:NONE'));
  g.inventory.add('ancient_collar', { ql: 30 });
  g.inventory.add('ancient_collar', { ql: 30 });
  g.inventory.add('ancient_bridle', { ql: 30 });
  g.inventory.add('ancient_bridle', { ql: 30 });
  for (const a of [collar, bridle]) if (!a.check?.(T, g)) a.perform(T, g);
  const [isleAppetite, isleTack, isleCollars, isleBridles] = at('FITTED').split('|');
  check(`a collar takes ${COLLAR_CUT * 100}% off upkeep and a bridle puts ${BRIDLE_PACE * 100}% on speed ridden, on both sides, one of each used`,
    near(bloodMul(ash, 'appetite') / appetite, 1 - COLLAR_CUT) && near(tackSpeed(ash) / tack, 1 + BRIDLE_PACE)
      && near(Number(isleAppetite), 1 - COLLAR_CUT) && near(Number(isleTack), 1 + BRIDLE_PACE)
      && isleCollars === '1' && isleBridles === '1' && g.inventory.countAll('ancient_collar') === 1, at('FITTED'));
  check('once each: a second is refused, kept, in the same words on both sides',
    `${collar.check?.(T, g)}|${bridle.check?.(T, g)}` === at('AGAIN') && at('AGAIN') === 'Ash: ancient collar already fitted.|Ash: ancient bridle already fitted.', at('AGAIN'));
  check('both sides say the same when one is fitted', told('Ancient c').concat(told('Ancient b')).join(' / ') === at('FITTOLD'),
    `${told('Ancient c').concat(told('Ancient b')).join(' / ')} | ${at('FITTOLD')}`);
  check('a team\'s bridles: their share of the pace, and the island\'s vehicle pace takes them',
    near(bridleTeam([ash, { boosts: undefined }]), 1 + BRIDLE_PACE / 2) && bridleTeam([]) === 1 && at('TEAMPATCHED') === 'true', at('TEAMPATCHED'));
}

// The whetstone.
{
  const tool = g.inventory.add('shovel', { ql: 37.25 });
  tool.dmg = 40;
  const frag = g.inventory.add('fragment', { ql: 20, extra: 'old pot 1/2' });
  frag.dmg = 40;
  const on = (uid: number) => ({ kind: 'item' as const, uid });
  check('without a whetstone, both refuse in the same words', hone.check?.(on(tool.uid), g) === at('HONE:NONE') && !hone.applies(on(tool.uid), g), at('HONE:NONE'));
  g.inventory.add('ancient_whetstone', { ql: 30 });
  check('a find not yet restored is refused, in the same words on both sides',
    hone.check?.(on(frag.uid), g) === at('HONE:FRAG') && !hone.applies(on(frag.uid), g), at('HONE:FRAG'));
  check('a damaged tool may be honed on both sides', hone.check?.(on(tool.uid), g) === null && hone.applies(on(tool.uid), g) && at('HONE:OK') === '-', at('HONE:OK'));
  hone.perform(on(tool.uid), g);
  check('honed: all damage off, QL kept, the whetstone used up, on both sides',
    tool.dmg === 0 && tool.ql === 37.25 && g.inventory.countAll('ancient_whetstone') === 0 && at('HONED') === '0|37.25|0', at('HONED'));
  g.inventory.add('ancient_whetstone', { ql: 30 });
  check('one with no damage is refused in the same words', hone.check?.(on(tool.uid), g) === at('HONE:SOUND') && at('HONE:SOUND') === 'Not damaged.', at('HONE:SOUND'));
  check('both sides say the same when it is honed', told('Honed:').join() === at('HONETOLD'), `${told('Honed:').join()} | ${at('HONETOLD')}`);
}

// The seed jar.
{
  const j = g.inventory.add('ancient_seed_jar', { ql: 33.5 });
  jar.perform({ kind: 'item', uid: j.uid }, g);
  const seeds = g.inventory.items.filter((it) => CROP_BY_SEED.has(it.id));
  const [got, left] = at('JAR').split('|');
  const [seed, n, ql] = got.split(':');
  check(`a seed jar opens to ${JAR_SEEDS} seeds of one crop at the jar's QL, and is used up, on both sides`,
    seeds.length === 1 && seeds[0].count === JAR_SEEDS && seeds[0].ql === 33.5 && g.inventory.countAll('ancient_seed_jar') === 0
      && CROP_BY_SEED.has(seed) && Number(n) === JAR_SEEDS && Number(ql) === 33.5 && left === '0', at('JAR'));
  const pattern = /^Seed jar opened: \d+ × .+, QL \d+\.\d\.$/;
  check('both sides say it in the same words', pattern.test(told('Seed jar opened:')[0] ?? '') && pattern.test(at('JARTOLD'))
    && at('JARTOLD').endsWith(`, QL 33.5.`), `${told('Seed jar opened:')[0]} | ${at('JARTOLD')}`);
}

// The rune tablet.
{
  const tab = g.inventory.add('rune_tablet', { ql: 30 });
  check('without a skill chosen, both refuse in the same words',
    tablet.check?.({ kind: 'item', uid: tab.uid }, g) === at('TABLET:NOSKILL') && at('TABLET:NOSKILL') === 'Choose a skill in the Skills window.', at('TABLET:NOSKILL'));
  g.skills.values.set(SKILL, 12.5);
  tablet.perform({ kind: 'item', uid: tab.uid, skill: SKILL }, g);
  check(`read into a skill, it is ${TABLET_GAIN} higher, and the tablet used up, on both sides`,
    near(g.skills.standing(SKILL), 12.5 + TABLET_GAIN) && g.inventory.countAll('rune_tablet') === 0 && at('TABLET') === `${12.5 + TABLET_GAIN}|0`, at('TABLET'));
  check('both sides say the same when it is read', told('Rune tablet read:').join() === at('TABLETTOLD'), `${told('Rune tablet read:').join()} | ${at('TABLETTOLD')}`);
  const tab2 = g.inventory.add('rune_tablet', { ql: 30 });
  g.skills.values.set(SKILL, TABLET_BELOW);
  check(`at ${TABLET_BELOW} it is refused, in the same words on both sides`,
    tablet.check?.({ kind: 'item', uid: tab2.uid, skill: SKILL }, g) === at('TABLET:HIGH') && at('TABLET:HIGH') === `Carpentry: ${TABLET_BELOW} or over, nothing to learn.`, at('TABLET:HIGH'));
}

// The stamp.
{
  g.inventory.add('ancient_stamp', { ql: 30 });
  const odds: string[] = [];
  for (let i = 0; i <= STAMP_GOES; i++) {
    const got = pressStamp(g, 0.01);
    const left = g.inventory.items.find((it) => it.id === 'ancient_stamp');
    odds.push(`${got}:${left ? (left.charges ?? -1) : 'gone'}`);
  }
  const want = [...Array.from({ length: STAMP_GOES - 1 }, (_, i) => `${0.01 * STAMP_RARE}:${STAMP_GOES - 1 - i}`), `${0.01 * STAMP_RARE}:gone`, '0.01:gone'];
  check(`a stamp doubles the first step for ${STAMP_GOES} goes and is gone after the last, on both sides`,
    odds.join(',') === want.join(',') && at('STAMP') === `${want.join(',')},`, `${odds.join(',')} | ${at('STAMP')}`);
  check('both sides say the same as it is pressed', told('Ancient stamp:').join(' / ') === at('STAMPTOLD'), `${told('Ancient stamp:').join(' / ')} | ${at('STAMPTOLD')}`);
  check('a stamp says its goes in its name, the same on both sides',
    itemName({ ...g.inventory.add('ancient_stamp', { ql: 30 }), charges: 3 }) === 'Ancient stamp (3 goes)' && at('STAMPNAME') === 'Ancient stamp (3 goes)', at('STAMPNAME'));
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`six more relics put to use — ${ok.length} of ${ok.length}`);

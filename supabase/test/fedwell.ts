/**
 * Food quality matters.
 *
 * Asked for: "when a tame wildermon eats a food item of quality q (0–100), it
 * gets a learning bonus of FED_LEARN (= 0.2) × q/100 for FED_FOR (= one island
 * hour ...), replacing any smaller current bonus (no stacking: take the larger,
 * refresh the timer if equal or larger). If the food is the FIRST item of its
 * diet list (its favourite), the bonus is doubled. Grazing grass counts as
 * quality 0 (no bonus). The bonus multiplies into learnMul on both sides", and
 * "each food item eaten adds FED_CARE (= 0.05) × q/100 to care (clamped to 1)".
 *
 * Asked of both sides:
 *
 *   * the numbers are the ones asked for, and the island's are the browser's,
 *     its favourite included;
 *   * its favourite at quality 80 from your hand puts 0.2 × 0.8 × 2 = 32% on
 *     its learning for the time asked, and that much on every gain it makes,
 *     and its care goes up by 0.05 × 0.8;
 *   * anything else of its diet at the same quality puts on half that; a
 *     lesser meal leaves a greater one be and its time where it was, a greater
 *     one replaces a lesser, and one as great starts the time again;
 *   * once the time is out it learns as it did;
 *   * a meal at quality nought puts nothing on, nor any care, and a wild one
 *     grazing gets nothing at all;
 *   * a deed worker eating out of the stores gets the same, its care read
 *     where the settle had worn it down to;
 *   * and the card says it, and the island tells a browser what is on one.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import {
  CARE_BONUS, CARE_HOURS, Creatures, FED_CARE, FED_FAVOURITE, FED_FOR, FED_LEARN, favouriteOf, favouriteSays, fedBonus, fedNow, fedOn, SPECIES, wellFedSays,
  type Creature, type IslandCreature,
} from '../../src/game/creatures';
import { QL_TOP } from '../../src/game/limits';
import { world } from '../../src/game/pace';

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
const near = (a: number, b: number, by = 1e-6): boolean => Math.abs(a - b) <= by * Math.max(1, Math.abs(b));

const KIND = 'sedra';
const def = SPECIES[KIND];
const FAV = favouriteOf(def)!;
const OTHER = def.diet.find((id) => id !== FAV)!;
const Q = 80;
const FULL = FED_LEARN * Q / QL_TOP * FED_FAVOURITE;
const HALF = FED_LEARN * Q / QL_TOP;
const CARE = FED_CARE * Q / QL_TOP;
/** What the care one meal put in is worth to its learning on its own, as a brushing's is (\`careMul\`). */
const CARED = 1 + CARE * CARE_BONUS;
/** Seconds the worker had been left before it was settled, for the care worn off it. */
const LEFT = 360;

/* ---- the asked-for numbers ------------------------------------------------------------------- */

check(`a meal is worth ${FED_LEARN} learning at the top quality for ${FED_FOR} seconds, ×${FED_FAVOURITE} for its favourite, and ${FED_CARE} care, as asked`,
  FED_LEARN === 0.2 && FED_FOR === world(60 * 60) && FED_FAVOURITE === 2 && FED_CARE === 0.05 && QL_TOP === 100);
check(`its favourite is the first of its diet: a ${def.name}'s is ${FAV}`, FAV === def.diet[0]);
check(`its favourite at quality ${Q} is ${FED_LEARN} × ${Q / QL_TOP} × ${FED_FAVOURITE} = ${(FULL * 100).toFixed(0)}% and anything else of its diet half that`,
  near(fedBonus(def, FAV, Q), 0.32) && near(fedBonus(def, OTHER, Q), 0.16));

/* ---- on the island --------------------------------------------------------------------------- */

const U = '7e5b0000-0000-4000-8000-0000000000c4';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; a int; b int; g int; k int; c creature; px double precision; py double precision;
        v_fav bigint; v_other bigint; v_base double precision; v_larder bigint; v_got jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Fedwell', 223, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform land_set_height(w, x, y, 10) from generate_series(0, 40) x, generate_series(0, 40) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Feeder');
  select x, y into px, py from player where world_id = w and uid = u;
  insert into said values ('NUMBERS', fed_learn() || '|' || fed_for() || '|' || fed_favourite() || '|' || fed_care() || '|'
    || (select favourite from species_def where id = '${KIND}'));

  a := creature_spawn(w, '${KIND}', px + 0.5, py, 'active', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, hunger = 0.5 where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  v_base := beast_mul(c, 'learn');

  -- Its favourite at quality ${Q}, from your hand.
  v_fav := give(w, u, '${FAV}', 1, ${Q});
  perform perform_creature(w, u, 'feed', jsonb_build_object('kind', 'creature', 'id', a, 'itemUid', v_fav));
  select * into c from creature where world_id = w and id = a;
  insert into said values ('FAV', c.fed_bonus || '|' || extract(epoch from (c.fed_until - now())) || '|' || c.care || '|' || (beast_mul(c, 'learn') / v_base)
    || '|' || pack_count(w, u, '${FAV}'));
  select e into v_got from jsonb_array_elements(rpc_creatures(w)) e where (e->>'id')::int = a;
  insert into said values ('SENT', coalesce(v_got->>'fed', '-') || '|' || coalesce(v_got->>'fedLeft', '-'));
  insert into said values ('ROW', v_got::text);

  -- Something else of its diet: half; a lesser one leaves the greater be, and its time.
  b := creature_spawn(w, '${KIND}', px - 0.5, py, 'active', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, mode = 'deed' where world_id = w and id = b;
  v_other := give(w, u, '${OTHER}', 1, ${Q});
  perform perform_creature(w, u, 'feed', jsonb_build_object('kind', 'creature', 'id', b, 'itemUid', v_other));
  select * into c from creature where world_id = w and id = b;
  insert into said values ('OTHER', c.fed_bonus || '|' || extract(epoch from (c.fed_until - now())) || '|' || c.care || '|' || (beast_mul(c, 'learn') / v_base));
  update creature set fed_until = now() + interval '100 seconds' where world_id = w and id = b;
  perform beast_fed(w, b, '${FAV}', ${Q});
  select * into c from creature where world_id = w and id = b;
  insert into said values ('GREATER', c.fed_bonus || '|' || extract(epoch from (c.fed_until - now())) || '|' || c.care);
  update creature set fed_until = now() + interval '100 seconds' where world_id = w and id = b;
  perform beast_fed(w, b, '${OTHER}', ${Q});
  select * into c from creature where world_id = w and id = b;
  insert into said values ('LESSER', c.fed_bonus || '|' || extract(epoch from (c.fed_until - now())) || '|' || c.care);
  perform beast_fed(w, b, '${FAV}', ${Q});
  select * into c from creature where world_id = w and id = b;
  insert into said values ('EQUAL', c.fed_bonus || '|' || extract(epoch from (c.fed_until - now())) || '|' || c.care);
  -- Clamped at full care.
  update creature set care = 0.99 where world_id = w and id = b;
  perform beast_fed(w, b, '${OTHER}', ${Q});
  insert into said select 'CLAMP', care::text from creature where world_id = w and id = b;

  -- Out of time: as it was.
  update creature set fed_until = now() - interval '1 second' where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('GONE', (beast_mul(c, 'learn') / v_base)::text);
  select e into v_got from jsonb_array_elements(rpc_creatures(w)) e where (e->>'id')::int = a;
  insert into said values ('SENTGONE', coalesce(v_got->>'fed', '-'));

  -- Quality nought: nothing, nor care. A wild one: nothing at all. A wild one grazing: nothing.
  update creature set fed_bonus = null, fed_until = null, care = 0.25 where world_id = w and id = a;
  perform beast_fed(w, a, '${FAV}', 0);
  insert into said select 'NOUGHT', coalesce(fed_bonus::text, '-') || '|' || care from creature where world_id = w and id = a;
  g := creature_spawn(w, '${KIND}', px + 5, py + 5, 'wild', now() - interval '30 days', null);
  perform beast_fed(w, g, '${FAV}', ${Q});
  update creature set hunger = 0.1, until = now() - interval '1 minute', settled_at = now() - interval '1 minute' where world_id = w and id = g;
  perform creature_settle(w, g);
  insert into said select 'WILD', coalesce(fed_bonus::text, '-') || '|' || care || '|' || (hunger > 0.1) from creature where world_id = w and id = g;

  -- A deed worker out of the stores, its care where the settle wore it to.
  insert into deed (world_id, name, x, y, radius, founded_by) values (w, 'Larder', floor(px)::int, floor(py)::int, 5, u);
  k := creature_spawn(w, '${KIND}', floor(px) + 1.5, floor(py) + 0.5, 'deed', now() - interval '30 days', u);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, made_by)
    values (w, 'furniture', 'larder', floor(px)::int + 1, floor(py)::int, 0, 0, floor(px) + 1.5, floor(py) + 0.5, u)
    returning id into v_larder;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_larder, '${FAV}', ${Q}, 3);
  update creature set traits = '{}', rare = null, care = 0.5, hunger = 0.1, settled_at = now() - interval '${LEFT} seconds'
    where world_id = w and id = k;
  perform creature_settle(w, k);
  insert into said select 'STORES', coalesce(fed_bonus::text, '-') || '|' || coalesce(extract(epoch from (fed_until - now()))::text, '-') || '|' || care
    || '|' || (select coalesce(sum(count), 0) from item where placed = v_larder)
    from creature where world_id = w and id = k;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const nums = (k: string): number[] => at(k).split('|').map(Number);

check('the island has the browser\'s numbers and the same favourite', at('NUMBERS') === `${FED_LEARN}|${FED_FOR}|${FED_FAVOURITE}|${FED_CARE}|${FAV}`, at('NUMBERS'));
{
  const [bonus, left, care, mul, packed] = nums('FAV');
  check(`on the island its favourite at quality ${Q} from your hand puts ${(FULL * 100).toFixed(0)}% on its learning for ${FED_FOR} seconds and ${CARE} on its care, and is eaten`,
    near(bonus, FULL) && near(left, FED_FOR) && near(care, CARE) && near(mul, (1 + FULL) * CARED) && packed === 0, at('FAV'));
  const [sent, sentLeft] = nums('SENT');
  check('and the island tells a browser what is on it and for how long', near(sent, FULL) && near(sentLeft, FED_FOR), at('SENT'));
}
{
  const [bonus, left, care, mul] = nums('OTHER');
  check(`something else of its diet at quality ${Q} puts on half that, ${(HALF * 100).toFixed(0)}%`, near(bonus, HALF) && near(left, FED_FOR) && near(care, CARE) && near(mul, (1 + HALF) * CARED), at('OTHER'));
  const [g, gl, gc] = nums('GREATER');
  check('a greater meal replaces a lesser one and starts the time again, and adds its care', near(g, FULL) && near(gl, FED_FOR) && near(gc, 2 * CARE), at('GREATER'));
  const [l, ll, lc] = nums('LESSER');
  check('a lesser one leaves the greater be and its time where it was, and still adds its care', near(l, FULL) && near(ll, 100) && near(lc, 3 * CARE), at('LESSER'));
  const [e, el] = nums('EQUAL');
  check('one as great starts the time again', near(e, FULL) && near(el, FED_FOR), at('EQUAL'));
  check('and care goes no higher than full', near(Number(at('CLAMP')), 1), at('CLAMP'));
}
check('once its time is out it learns as it did, but for the care the meal put in, and a browser is told nothing is on it', near(Number(at('GONE')), CARED) && at('SENTGONE') === '-', `${at('GONE')} / ${at('SENTGONE')}`);
check('a meal at quality nought puts nothing on it, nor any care', at('NOUGHT') === '-|0.25', at('NOUGHT'));
check('a wild one gets nothing from a meal, and grazing puts nothing on it', at('WILD').startsWith('-|0|'), at('WILD'));
{
  const [bonus, left, care, leftIn] = nums('STORES');
  const want = 0.5 - LEFT / (CARE_HOURS * 3600) + CARE;
  check(`a deed worker eating its favourite out of the stores gets the same, its care ${want.toFixed(4)}: worn for ${LEFT} seconds, then the meal's`,
    near(bonus, FULL) && near(left, FED_FOR) && near(care, want, 1e-5) && leftIn === 2, at('STORES'));
}

/* ---- the browser ----------------------------------------------------------------------------- */

// What the island said of one, as a browser on it takes it.
{
  const heard = Game.create(2224);
  for (const c of [...heard.creatures.list.values()]) heard.creatures.remove(c.id);
  heard.creatures.fromIsland = true;
  const row = JSON.parse(at('ROW')) as IslandCreature;
  heard.creatures.sawAll([row], heard.time);
  const c = heard.creatures.get(row.id);
  check('a browser on the island takes what is on one of yours, and its card says it',
    !!c && near(fedNow(c, heard.time), FULL) && near((c.fedUntil ?? 0) - heard.time, FED_FOR, 1e-3) && wellFedSays(c, heard.time).startsWith('Well fed: +32% learning for 2 hours and 30 minutes'),
    c ? wellFedSays(c, heard.time) : 'not heard');
}

const game = Game.create(2223);
for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
const px = game.player.x, py = game.player.y;
const tame = (x: number): Creature => {
  const c = game.creatures.spawn(KIND, px + x, py, 'active', game.rand, 0);
  c.traits = [];
  c.rare = 0;
  c.care = 0;
  c.hunger = 0.5;
  return c;
};
const feed = (c: Creature, id: string, ql: number): void => {
  const it = game.inventory.add(id, { count: 1, ql });
  ACTION_BY_ID.get('feed')?.perform({ kind: 'creature', id: c.id, itemUid: it.uid } as Target, game);
};
const a = tame(0.5);
const base = game.creatures.learnMul(a, game.time);
feed(a, FAV, Q);
check(`in a game of your own its favourite at quality ${Q} from your hand puts ${(FULL * 100).toFixed(0)}% on its learning for ${FED_FOR} seconds and ${CARE} on its care, and is eaten`,
  near(a.fedBonus ?? 0, FULL) && near((a.fedUntil ?? 0) - game.time, FED_FOR) && near(a.care, CARE) && near(game.creatures.learnMul(a, game.time) / base, (1 + FULL) * CARED)
    && !game.inventory.items.some((it) => it.id === FAV), `${a.fedBonus} until +${(a.fedUntil ?? 0) - game.time}, care ${a.care}`);
check('its card says so', wellFedSays(a, game.time) === `Well fed: +32% learning for 2 hours and 30 minutes more`, wellFedSays(a, game.time));
check('and its card and its page say what its favourite is worth', favouriteSays(def) === `Favourite: reed, +40% learning for two and a half hours at quality ${QL_TOP}`, favouriteSays(def));
// A gain it makes while it lasts, at the same roll, against one with nothing on it.
{
  const roll = game.rand;
  game.rand = () => 0.5;
  const fresh = tame(1.5);
  const was = a.skills.foraging;
  a.skills.foraging = fresh.skills.foraging = 10;
  const fed = game.creatures.gainSkill(game, a, 'foraging', 1);
  const plain = game.creatures.gainSkill(game, fresh, 'foraging', 1);
  check('and every gain it makes while it lasts is that much more', fed > plain && near(fed / plain, (1 + FULL) * CARED, 1e-2), `${fed} / ${plain}`);
  a.skills.foraging = was;
  game.creatures.remove(fresh.id);
  game.rand = roll;
}
const b = tame(-0.5);
b.mode = 'deed';
feed(b, OTHER, Q);
check(`something else of its diet at quality ${Q} puts on half that`, near(b.fedBonus ?? 0, HALF) && near(b.care, CARE), `${b.fedBonus}`);
b.fedUntil = game.time + 100;
fedOn(b, FAV, Q, game.time);
check('a greater meal replaces a lesser one and starts the time again', near(b.fedBonus ?? 0, FULL) && near((b.fedUntil ?? 0) - game.time, FED_FOR) && near(b.care, 2 * CARE));
b.fedUntil = game.time + 100;
fedOn(b, OTHER, Q, game.time);
check('a lesser one leaves the greater be and its time where it was', near(b.fedBonus ?? 0, FULL) && near((b.fedUntil ?? 0) - game.time, 100) && near(b.care, 3 * CARE));
fedOn(b, FAV, Q, game.time);
check('one as great starts the time again', near((b.fedUntil ?? 0) - game.time, FED_FOR));
b.care = 0.99;
fedOn(b, OTHER, Q, game.time);
check('and care goes no higher than full', b.care === 1);
game.time += FED_FOR + 1;
check('once its time is out it learns as it did, but for the care the meal put in, and its card says nothing of it',
  fedNow(a, game.time) === 0 && near(game.creatures.learnMul(a, game.time) / base, 1 + a.care * CARE_BONUS) && wellFedSays(a, game.time) === '');
const c0 = tame(0);
c0.care = 0.25;
fedOn(c0, FAV, 0, game.time);
check('a meal at quality nought puts nothing on it, nor any care', fedNow(c0, game.time) === 0 && c0.care === 0.25);
c0.mode = 'wild';
c0.care = 0;
fedOn(c0, FAV, Q, game.time);
check('and a wild one gets nothing from a meal', fedNow(c0, game.time) === 0 && c0.care === 0);
// The two sides on the same meals.
check('the two sides put the same on it, meal for meal',
  near(Number(at('FAV').split('|')[0]), fedBonus(def, FAV, Q)) && near(Number(at('OTHER').split('|')[0]), fedBonus(def, OTHER, Q)));
// A save keeps it.
{
  const d = tame(2);
  fedOn(d, FAV, Q, game.time);
  const again = Creatures.fromJSON(JSON.parse(JSON.stringify(game.creatures.toJSON())));
  const d2 = again.get(d.id);
  check('and a save keeps what a meal put on one', !!d2 && d2.fedBonus === d.fedBonus && d2.fedUntil === d.fedUntil, `${d2?.fedBonus} ${d2?.fedUntil}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
if (bad.length) process.exit(1);

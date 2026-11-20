/**
 * Two things for somebody new: their first tame is sure, and a sprout before
 * their name for their first week ashore.
 *
 * First tame: sure (`src/game/firsttame.ts`, `first_tame`, `player.tamed_at`):
 *   * a body just ashore has tamed nothing (`tamed_at` null) and the beat says
 *     its first tame is to come (`first_tame`);
 *   * its first offering is taken with the roll pinned to fail (`pg_temp.dice`),
 *     at the chance the kind has (under the roll); its second, at the same roll,
 *     refused, and the beat says so;
 *   * the same out of a trap: the first taken with the handling check pinned to
 *     fail, the second still held;
 *   * every gate still refuses a first tame: the taming a kind asks, the taming
 *     a wild one past its first stage asks, the offering, reach, the room for one
 *     more; and nothing refused marks the first tame spent;
 *   * never a monster: refused, and not a first tame;
 *   * in the browser: the card says "First tame: sure" in place of the odds, the
 *     Tame entry says it beside it, the Guiding Light's tame step says it (Bring); and
 *     none of them once it is spent.
 *
 * New (`NEW_DAYS`, `src/game/badges.ts`, `player.joined_at`):
 *   * an islander reads everybody's day ashore off the roster's columns
 *     (`PEOPLE_COLUMNS`);
 *   * a player on their third day has the sprout, titled "New: day 3 of 7", and
 *     one ashore eight days has none: in chat, in Social and over their heads,
 *     by day and by night;
 *   * Settings, Name icons, takes it away with the trade and class icons.
 *
 * Makes its own island (Newplayer) on the suite's database: the tames in one
 * transaction, rolled back; the badge's players, taken away after. The browser
 * half needs a Chromium; with none it says so and passes, unless
 * `NEWPLAYER_STRICT` is set. `NEWPLAYER_SHOTS=<dir>` keeps the pictures.
 */
import { build } from 'esbuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EVOLVE_AT, levelSkill, SPECIES, tameNeeds, WILD_STAGE_TAME } from '../../src/game/creatures';
import { FIRST_TAME_SAYS, firstTameSure } from '../../src/game/firsttame';
import { BadgeBook, badgeIds, badgeTitle, DAY_MS, NEW_BADGE, NEW_DAYS, newDay, newTitle } from '../../src/game/badges';
import { EMBLEM_INK, emblemParts } from '../../src/render/emblems';
import { PEOPLE_COLUMNS, type Social } from '../../src/net/island';
import type { PlayerRow } from '../../src/contract/rows';
import { Game } from '../../src/game/game';
import { creatureLines } from '../../src/ui/creatureinfo';
import { PATH_STEP_BY_ID } from '../../src/game/path';
import { psql, check, finish } from './harness';

/* ---- first tame, on the island ---------------------------------------------------------------- */

const KIND = 'rabba';
const FOOD = SPECIES[KIND].diet[0];
/** A kind asking more taming than a body just ashore has. */
const HARD = Object.values(SPECIES).filter((d) => !d.monster && !d.hybrid && d.tameLevel >= 10).sort((a, b) => a.tameLevel - b.tameLevel)[0];
const MONSTER = Object.values(SPECIES).find((d) => d.monster)!;
const STAGED = tameNeeds({ species: KIND, skills: { [levelSkill(SPECIES[KIND])!]: EVOLVE_AT[0] } }).level;

const TAMER = '1c0b0000-0000-4000-8000-00000000000a';
const GATED = '1c0b0000-0000-4000-8000-00000000000b';
const FACER = '1c0b0000-0000-4000-8000-00000000000c';
const TRAPPER = '1c0b0000-0000-4000-8000-00000000000d';
const TAMERS: Array<[string, string]> = [[TAMER, 'Firsthand'], [GATED, 'Gatewood'], [FACER, 'Orcface'], [TRAPPER, 'Snareby']];

const out = psql(`
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
declare xs text[] := string_to_array(current_setting('wildermon.dice'), ',');
        n int := coalesce(nullif(current_setting('wildermon.dice_n', true), ''), '0')::int;
begin
  perform set_config('wildermon.dice_n', (n + 1)::text, true);
  return xs[1 + n % array_length(xs, 1)]::double precision;
end $f$;
create function pg_temp.dice(v text) returns void language plpgsql as $f$
begin
  perform set_config('wildermon.dice', v, true);
  perform set_config('wildermon.dice_n', '0', true);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
end $f$;
create function pg_temp.nodice() returns void language plpgsql as $f$
begin
  perform set_config('search_path', '"$user", public', true);
end $f$;
create function pg_temp.as_(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from caller where uid = u;
end $f$;
/** A wild one, held still where it is put, fed and ordinary. */
create function pg_temp.wild(w uuid, sp text, x double precision, y double precision) returns int language plpgsql as $f$
declare c int;
begin
  c := creature_spawn(w, sp, x, y, 'wild', now() - interval '60 days', null);
  update creature set hunger = 1, rare = null, coaxed = 0, coaxed_at = null, skills = '{}'::jsonb,
         from_x = to_x, from_y = to_y, leg_at = now(), leg_ends = now(), settled_at = now()
   where world_id = w and id = c;
  return c;
end $f$;
create function pg_temp.at(c int) returns jsonb language sql as $f$ select jsonb_build_object('kind', 'creature', 'id', c) $f$;
/** The last line said to somebody, past the skill lines. */
create function pg_temp.last(w uuid, u uuid) returns text language sql as $f$
  select coalesce((select text from event where world_id = w and uid = u and kind <> 'skill' order by n desc limit 1), 'unsaid') $f$;

do $$
declare w uuid; c int; c2 int; t int; v text;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Newplayer', 626, 32, 10, 10, true) returning id into w;
  perform land_blank(w, 32);
  insert into auth.users (id) values ${TAMERS.map(([u]) => `('${u}')`).join(', ')} on conflict do nothing;
  insert into account (uid, name) values ${TAMERS.map(([u, n]) => `('${u}', '${n.toLowerCase()}')`).join(', ')} on conflict do nothing;
${TAMERS.map(([u, n]) => `  perform pg_temp.as_('${u}'); perform rpc_join(w, '${n}');`).join('\n')}
  insert into said select 'FRESH', string_agg(coalesce(tamed_at::text, 'null') || ':' || (joined_at > now() - interval '1 minute')::text, ',' order by uid)
    from player where world_id = w;
  insert into skill (world_id, uid, id, value)
    select w, u, 'taming', ${SPECIES[KIND].tameLevel} from unnest(array['${TAMER}', '${TRAPPER}']::uuid[]) u
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into skill (world_id, uid, id, value) values (w, '${GATED}', 'taming', 1)
    on conflict (world_id, uid, id) do update set value = 1;

  /* ---- the first offering, the roll pinned to fail ---- */
  perform pg_temp.as_('${TAMER}');
  insert into said values ('BEAT0', coalesce(rpc_settle(null, w, null, false, null)->>'first_tame', 'unsaid'));
  perform give(w, '${TAMER}', '${FOOD}', 5, 30);
  c := pg_temp.wild(w, '${KIND}', 10.9, 10.5);
  insert into said select 'CHANCE', tame_chance(w, '${TAMER}', cc)::text || '|' || first_tame(w, '${TAMER}', cc)::text from creature cc where world_id = w and id = c;
  insert into said values ('REFUSED0', coalesce(act_refusal(w, '${TAMER}', 'tame', pg_temp.at(c)), 'allowed'));
  perform pg_temp.dice('0.99');
  perform perform_creature(w, '${TAMER}', 'tame', pg_temp.at(c));
  perform pg_temp.nodice();
  insert into said select 'FIRST', mode || '|' || coalesce((keeper = '${TAMER}')::text, 'false') || '|' || pg_temp.last(w, '${TAMER}') from creature where world_id = w and id = c;
  insert into said select 'SPENT', (tamed_at is not null)::text from player where world_id = w and uid = '${TAMER}';
  perform pg_temp.as_('${TAMER}');
  insert into said values ('BEAT1', coalesce(rpc_settle(null, w, null, false, null)->>'first_tame', 'unsaid'));

  /* ---- the second, at the same roll ---- */
  delete from creature where world_id = w and id = c;
  c2 := pg_temp.wild(w, '${KIND}', 10.9, 10.5);
  perform pg_temp.dice('0.99');
  perform perform_creature(w, '${TAMER}', 'tame', pg_temp.at(c2));
  perform pg_temp.nodice();
  insert into said select 'SECOND', mode || '|' || pg_temp.last(w, '${TAMER}') from creature where world_id = w and id = c2;
  delete from creature where world_id = w and id = c2;

  /* ---- out of a trap: the handling check pinned to fail ---- */
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'trap', 'twine_snare', 11, 10, 0, 0, 11.125, 10.125, 50, '${TRAPPER}') returning id into t;
  c := pg_temp.wild(w, '${KIND}', 11.2, 10.2);
  update creature set trapped = t where world_id = w and id = c;
  update placed set caught = c where id = t;
  insert into said values ('TRAPREFUSED', coalesce(trap_refusal(w, '${TRAPPER}', 'take_catch', jsonb_build_object('kind', 'trap', 'id', t)), 'allowed'));
  perform pg_temp.dice('0.99');
  insert into said values ('TRAPROLL', skill_check(skill_of(w, '${TRAPPER}', 'taming'), ${SPECIES[KIND].tameLevel} + 10, 50, 0)::text);
  perform pg_temp.dice('0.99');
  perform perform_trap(w, '${TRAPPER}', 'take_catch', jsonb_build_object('kind', 'trap', 'id', t));
  perform pg_temp.nodice();
  insert into said select 'TRAPFIRST', mode || '|' || coalesce((keeper = '${TRAPPER}')::text, 'false') || '|'
    || (select (tamed_at is not null)::text from player where world_id = w and uid = '${TRAPPER}') from creature where world_id = w and id = c;
  delete from creature where world_id = w and id = c;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'trap', 'twine_snare', 11, 10, 0, 0, 11.125, 10.125, 50, '${TRAPPER}') returning id into t;
  c := pg_temp.wild(w, '${KIND}', 11.2, 10.2);
  update creature set trapped = t where world_id = w and id = c;
  update placed set caught = c where id = t;
  perform pg_temp.dice('0.99');
  perform perform_trap(w, '${TRAPPER}', 'take_catch', jsonb_build_object('kind', 'trap', 'id', t));
  perform pg_temp.nodice();
  insert into said select 'TRAPSECOND', mode || '|' || coalesce((select caught = c from placed where id = t)::text, 'gone') || '|' || pg_temp.last(w, '${TRAPPER}')
    from creature where world_id = w and id = c;

  /* ---- the gates, before a first tame ---- */
  -- The taming a kind asks.
  c := pg_temp.wild(w, '${HARD.id}', 10.9, 10.5);
  perform give(w, '${GATED}', '${HARD.diet[0]}', 5, 30);
  insert into said values ('GATE:LEVEL', coalesce(act_refusal(w, '${GATED}', 'tame', pg_temp.at(c)), 'allowed'));
  delete from creature where world_id = w and id = c;
  -- And past its first stage, more.
  c := pg_temp.wild(w, '${KIND}', 10.9, 10.5);
  update creature set skills = '${JSON.stringify({ [levelSkill(SPECIES[KIND])!]: EVOLVE_AT[0] })}'::jsonb where world_id = w and id = c;
  update skill set value = ${SPECIES[KIND].tameLevel} where world_id = w and uid = '${GATED}' and id = 'taming';
  insert into said values ('GATE:STAGE', coalesce(act_refusal(w, '${GATED}', 'tame', pg_temp.at(c)), 'allowed'));
  update creature set skills = '{}'::jsonb where world_id = w and id = c;
  -- The offering.
  insert into said values ('GATE:FOOD', coalesce(act_refusal(w, '${GATED}', 'tame', pg_temp.at(c)), 'allowed'));
  perform give(w, '${GATED}', '${FOOD}', 5, 30);
  insert into said values ('GATE:OPEN', coalesce(act_refusal(w, '${GATED}', 'tame', pg_temp.at(c)), 'allowed'));
  -- Reach.
  update creature set from_x = 24.5, from_y = 24.5, to_x = 24.5, to_y = 24.5 where world_id = w and id = c;
  insert into said values ('GATE:REACH', coalesce(act_refusal(w, '${GATED}', 'tame', pg_temp.at(c)), 'allowed'));
  update creature set from_x = 10.9, from_y = 10.5, to_x = 10.9, to_y = 10.5 where world_id = w and id = c;
  -- Room for one more: one following already, and no empty crate.
  c2 := creature_spawn(w, '${KIND}', 9.5, 10.5, 'active', now() - interval '60 days', '${GATED}');
  insert into said values ('GATE:ROOM', coalesce(act_refusal(w, '${GATED}', 'tame', pg_temp.at(c)), 'allowed'));
  insert into said select 'GATE:KEPT', coalesce(tamed_at::text, 'null') || '|' || first_tame(w, '${GATED}', cc)::text
    from player, creature cc where player.world_id = w and player.uid = '${GATED}' and cc.world_id = w and cc.id = c;

  /* ---- a monster ---- */
  c := pg_temp.wild(w, '${MONSTER.id}', 10.9, 10.5);
  insert into said values ('MONSTER', coalesce(act_refusal(w, '${FACER}', 'tame', pg_temp.at(c)), 'allowed'));
  insert into said select 'MONSTERFIRST', first_tame(w, '${FACER}', cc)::text || '|' || first_tame(w, '${FACER}', k)::text
    from creature cc, creature k where cc.world_id = w and cc.id = c and k.world_id = w and k.id = c2;
end $$;
select k || '=' || replace(v, E'\\n', ' ') from said order by k;
rollback;
`);
const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const at = line.indexOf('=');
  if (at > 0) said.set(line.slice(0, at), line.slice(at + 1));
}
const isle = (k: string): string => said.get(k) ?? 'MISSING';

check('a body just ashore: nothing tamed (tamed_at null), and came ashore now (joined_at)',
  isle('FRESH').split(',').length === TAMERS.length && isle('FRESH').split(',').every((x) => x === 'null:true'), isle('FRESH'));
check('the beat says its first tame is to come', isle('BEAT0') === 'true', isle('BEAT0'));
const [chance, first] = isle('CHANCE').split('|');
check(`the ${SPECIES[KIND].name}'s chance is under the roll pinned at 0.99 (${chance}), and it is a first tame`, Number(chance) < 0.99 && first === 'true', isle('CHANCE'));
check('nothing refuses it', isle('REFUSED0') === 'allowed', isle('REFUSED0'));
check('the first offering, the roll pinned to fail: taken, and follows', isle('FIRST').startsWith('active|true|Tamed: '), isle('FIRST'));
check('and the first tame is spent (tamed_at), and the beat says so', isle('SPENT') === 'true' && isle('BEAT1') === 'false', `${isle('SPENT')} ${isle('BEAT1')}`);
check('the second offering, at the same roll: refused', isle('SECOND').startsWith('wild|Taming failed.'), isle('SECOND'));

check('out of a trap: nothing refuses it', isle('TRAPREFUSED') === 'allowed', isle('TRAPREFUSED'));
check('the handling check pinned at 0.99 fails', isle('TRAPROLL') === 'false', isle('TRAPROLL'));
check('the first take out of a trap at that roll: taken, follows, and the first tame spent', isle('TRAPFIRST') === 'active|true|true', isle('TRAPFIRST'));
check('the second at that roll: still held', isle('TRAPSECOND').startsWith('wild|true|Handling failed:'), isle('TRAPSECOND'));

check(`a first tame refused the taming a kind asks (${HARD.name}: ${HARD.tameLevel})`, isle('GATE:LEVEL') === `${HARD.name}: needs taming ${HARD.tameLevel}; have 1.0.`, isle('GATE:LEVEL'));
check(`and the taming one past its first stage asks (${STAGED}: ${SPECIES[KIND].tameLevel} + ${WILD_STAGE_TAME})`, isle('GATE:STAGE').endsWith(`: needs taming ${STAGED}; have 1.0.`), isle('GATE:STAGE'));
check('and without an offering', isle('GATE:FOOD').startsWith('Need an offering: '), isle('GATE:FOOD'));
check('with all of them: allowed', isle('GATE:OPEN') === 'allowed', isle('GATE:OPEN'));
check('out of reach: refused', isle('GATE:REACH') !== 'allowed', isle('GATE:REACH'));
check('one following already and no crate: refused', isle('GATE:ROOM').includes('already follows you'), isle('GATE:ROOM'));
check('and none of those spent the first tame', isle('GATE:KEPT') === 'null|true', isle('GATE:KEPT'));
check(`a monster (${MONSTER.name}): refused, and never a first tame`, isle('MONSTER') === `${MONSTER.name}: cannot be tamed.` && isle('MONSTERFIRST') === 'false|true', `${isle('MONSTER')} ${isle('MONSTERFIRST')}`);

/* ---- first tame, in the browser ---------------------------------------------------------------- */

{
  const g = Game.create(626);
  g.skills.values.set('taming', SPECIES[KIND].tameLevel + 1);
  const c = g.creatures.spawn(KIND, g.player.x + 1, g.player.y, 'wild', () => 0.5, 0);
  const monster = g.creatures.spawn(MONSTER.id, g.player.x + 2, g.player.y, 'wild', () => 0.5, 0);
  const card = (): string => creatureLines(g, c).join(' / ');
  const step = PATH_STEP_BY_ID.get('tame')!;
  g.player.firstTame = true;
  check(`the card, a first tame to come: "${FIRST_TAME_SAYS}" in place of the odds`, card().includes(FIRST_TAME_SAYS) && !card().includes('% chance per offering'), card());
  check('the Guiding Light\'s tame step says it, under Bring', (step.bring?.(g) ?? []).includes(FIRST_TAME_SAYS), (step.bring?.(g) ?? []).join(' / '));
  check('never for a monster', !firstTameSure(true, MONSTER.id) && firstTameSure(true, KIND) && !creatureLines(g, monster).join(' ').includes(FIRST_TAME_SAYS));
  g.player.firstTame = false;
  check('spent: the odds again, and the step without it', card().includes('% chance per offering') && !card().includes(FIRST_TAME_SAYS) && !(step.bring?.(g) ?? []).includes(FIRST_TAME_SAYS), card());
}

/* ---- New, on the island ---------------------------------------------------------------------- */

const FRESH = '1c0b0000-0000-4000-8000-0000000000a1';
const WEEKER = '1c0b0000-0000-4000-8000-0000000000a2';
const ME = '1c0b0000-0000-4000-8000-0000000000a3';
/** Each: name, and how long ashore, in days. */
const FOLK: Array<[string, string, number]> = [
  [FRESH, 'Sproutling', 2.5],
  [WEEKER, 'Weekold', 8],
  [ME, 'Lookout', 30],
];
const DAY3 = newTitle(3);

check(`New for ${NEW_DAYS} days: day 1 at once, day ${NEW_DAYS} its last hour, none after`,
  newDay(1000, 1000) === 1 && newDay(0, NEW_DAYS * DAY_MS - 1) === NEW_DAYS && newDay(0, NEW_DAYS * DAY_MS) === null && newDay(null) === null);
check(`titled "${DAY3}" on the third day`, DAY3 === `New: day 3 of ${NEW_DAYS}` && newDay(0, 2.5 * DAY_MS) === 3);
const sprout = emblemParts(NEW_BADGE, 'bare');
check('the sprout drawn as the emblems are: paths edged in the stones\' ink, on no badge', sprout.length > 0 && sprout.every((p) => p.stroke === EMBLEM_INK || p.cased !== undefined) && sprout.every((p) => p.d.startsWith('M')));

const as = (uid: string, sql: string): string =>
  psql(`select set_config('request.jwt.claims', json_build_object('sub', '${uid}')::text, false) \\g /dev/null
delete from caller where uid = '${uid}';
${sql}`).split('\n').pop() ?? '';
const read = (uid: string, sql: string): string =>
  psql(`begin;
select set_config('request.jwt.claims', json_build_object('sub', '${uid}')::text, true) \\g /dev/null
set local role authenticated;
${sql}
rollback;`).split('\n').filter((l) => l && l !== 'BEGIN' && l !== 'ROLLBACK' && l !== 'SET').pop() ?? '';

psql(`delete from world where name = 'Newfolk';`);
const W = psql(`
insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Newfolk', 627, 32, 10, 10, true) returning id \\gset w_
select land_blank(:'w_id'::uuid, 32) \\g /dev/null
insert into auth.users (id) values ${FOLK.map((f) => `('${f[0]}')`).join(', ')} on conflict do nothing;
insert into account (uid, name) values ${FOLK.map((f) => `('${f[0]}', '${f[1].toLowerCase()}')`).join(', ')} on conflict do nothing;
select :'w_id';`).split('\n').pop() ?? '';

let rows: PlayerRow[] = [];
let chat: Array<{ text: string; at?: number; by?: string }> = [];
let social: Social | null = null;
try {
  for (const [uid, name] of FOLK) as(uid, `select rpc_join('${W}', '${name}') \\g /dev/null`);
  for (const [uid, , days] of FOLK) {
    psql(`update player set craft_class = null, combat_class = null, away = false, joined_at = now() - interval '${days * 24} hours'
      where world_id = '${W}' and uid = '${uid}';`);
  }
  for (const [uid, name] of FOLK) as(uid, `select rpc_say('${W}', 'Hello from ${name}.') \\g /dev/null`);
  rows = JSON.parse(read(ME, `select coalesce(jsonb_agg(r), '[]')::text from (select ${PEOPLE_COLUMNS} from player where world_id = '${W}' and away = false) r;`) || '[]') as PlayerRow[];
  check('an islander reads everybody\'s day ashore off the roster\'s columns (joined_at)',
    rows.length === FOLK.length && FOLK.every(([uid, , days]) => {
      const r = rows.find((x) => x.uid === uid);
      return !!r && typeof r.joined_at === 'string' && Math.abs((Date.now() - Date.parse(r.joined_at)) / DAY_MS - days) < 0.01;
    }), JSON.stringify(rows.map((r) => [r.name, r.joined_at])));
  const lines = JSON.parse(as(ME, `select rpc_chat('${W}')::text;`) || '[]') as Array<{ n: number; text: string; at: string; by?: string }>;
  chat = lines.map((l) => ({ text: l.text, at: Date.parse(l.at), by: l.by }));
  const book = new BadgeBook();
  book.saw(rows);
  check(`from the island's rows: the sprout for ${FOLK[0][1]} (day 3), none for ${FOLK[1][1]} (8 days)`,
    badgeIds(book.get(FRESH), true).join() === NEW_BADGE && badgeIds(book.get(WEEKER), true).length === 0
    && badgeTitle(NEW_BADGE, book.get(FRESH)) === DAY3,
    `${badgeIds(book.get(FRESH), true).join('+')} / ${badgeIds(book.get(WEEKER), true).join('+')} / ${badgeTitle(NEW_BADGE, book.get(FRESH))}`);
  check('with Name icons off, none', badgeIds(book.get(FRESH), false).length === 0);
  social = JSON.parse(as(ME, `select rpc_social('${W}')::text;`)) as Social;
} finally {
  psql(`delete from world where id = '${W}';`);
}

/* ---- New, and First tame, in the browser ------------------------------------------------------- */

function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}

type Icons = Array<{ id: string; title: string }>;
interface Driven {
  load: (rows: PlayerRow[], chat: unknown[], s: Social, me: string) => Promise<void>;
  look: (style: string, light: string) => Promise<void>;
  show: (id: string, x: number, y: number, w: number, h: number) => Promise<{ x: number; y: number; w: number; h: number }>;
  world: (zoom: number, night: boolean) => Promise<Array<{ text: string; icons: string[] }>>;
  setIcons: (on: boolean) => boolean;
  read: () => { chat: Array<{ text: string; by: string; icons: Icons }>; social: Array<{ text: string; by: string; icons: Icons }> };
}
interface Mine {
  tameMenu: (species: string, first: boolean, x: number, y: number) => Promise<{ label: string; note: string | null; card: string[]; box: { x: number; y: number; w: number; h: number } }>;
  sprout: () => { title: string; x: number; y: number } | null;
  hover: () => { title: string; x: number; y: number } | null;
}
const drive = <T>(tab: Page, fn: (c: Driven, arg: unknown) => T, arg?: unknown): Promise<T> =>
  tab.evaluate(([f, a]) => (new Function('c', 'a', `return (${f})(c, a)`))((window as unknown as { nameIcons: Driven }).nameIcons, a), [fn.toString(), arg] as const) as Promise<T>;
const mine = <T>(tab: Page, fn: (c: Mine, arg: unknown) => T, arg?: unknown): Promise<T> =>
  tab.evaluate(([f, a]) => (new Function('c', 'a', `return (${f})(c, a)`))((window as unknown as { newPlayer: Mine }).newPlayer, a), [fn.toString(), arg] as const) as Promise<T>;

const hasNew = (icons: Icons): boolean => icons.some((i) => i.id === NEW_BADGE);
const newOk = (icons: Icons): boolean => icons.filter((i) => i.id === NEW_BADGE).every((i) => i.title === DAY3);

const options = browserOptions();
if (!options) {
  console.log('newplayer: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.NEWPLAYER_STRICT) check('a Chromium to draw in', false);
} else if (social) {
  const shots = process.env.NEWPLAYER_SHOTS ? resolve(process.env.NEWPLAYER_SHOTS) : null;
  if (shots) mkdirSync(shots, { recursive: true });
  const bundled = await build({
    entryPoints: [resolve('supabase/test/newplayer-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const css = ['src/ui/tokens.css', 'src/style.css', 'src/ui/interior.css', 'src/ui/creator.css', 'src/phone.css']
    .map((f) => readFileSync(resolve(f), 'utf8')).join('\n');
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addStyleTag({ content: css });
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    await drive(tab, (c, a) => {
      const [r, l, s, m] = a as [PlayerRow[], unknown[], Social, string];
      return c.load(r, l, s, m);
    }, [rows, chat, social, ME]);
    const clip = (b: { x: number; y: number; w: number; h: number }, r = 30) => ({ x: Math.max(0, b.x - r), y: Math.max(0, b.y - r), width: b.w + 2 * r, height: b.h + 2 * r });

    // Chat, by day and by night.
    for (const light of ['day', 'night']) {
      await drive(tab, (c, a) => c.look('runecut', a as string), light);
      const box = await drive(tab, (c) => c.show('events', 60, 60, 460, 300));
      const shown = await drive(tab, (c) => c.read());
      const fresh = shown.chat.filter((l) => l.by === FRESH);
      const week = shown.chat.filter((l) => l.by === WEEKER);
      check(`in chat (${light}): the sprout before ${FOLK[0][1]}, titled "${DAY3}"; none before ${FOLK[1][1]}`,
        fresh.length > 0 && fresh.every((l) => hasNew(l.icons) && newOk(l.icons)) && week.length > 0 && week.every((l) => !hasNew(l.icons)),
        shown.chat.map((l) => `${l.text}: ${l.icons.map((i) => `${i.id}(${i.title})`).join('+') || 'none'}`).join('; '));
      if (shots) await tab.screenshot({ path: join(shots, `chat-new-${light}.png`), clip: clip(box) });
    }
    // The hover: its title, shown in the game's own tooltip for the picture (a browser's title tip is not drawn in a screenshot).
    const hover = await mine(tab, (c) => c.hover());
    check(`the hover on the sprout: "${DAY3}"`, hover?.title === DAY3, JSON.stringify(hover));
    if (shots && hover) {
      await tab.mouse.move(hover.x, hover.y);
      await tab.screenshot({ path: join(shots, 'chat-new-hover.png'), clip: { x: Math.max(0, hover.x - 160), y: Math.max(0, hover.y - 60), width: 380, height: 130 } });
    }
    await drive(tab, (c) => c.look('runecut', 'day'));

    // Social.
    const socialBox = await drive(tab, (c) => c.show('social', 60, 60, 360, 420));
    let shown = await drive(tab, (c) => c.read());
    const people = shown.social.filter((r) => r.by);
    check(`in Social: the sprout on ${FOLK[0][1]}'s row, titled; none on ${FOLK[1][1]}'s`,
      people.some((r) => r.by === FRESH && hasNew(r.icons) && newOk(r.icons)) && people.filter((r) => r.by === WEEKER).every((r) => !hasNew(r.icons)) && people.some((r) => r.by === WEEKER),
      people.map((r) => `${r.text}: ${r.icons.map((i) => i.id).join('+') || 'none'}`).join('; '));
    if (shots) await tab.screenshot({ path: join(shots, 'social-new.png'), clip: clip(socialBox) });

    // Over their heads, by day and by night.
    for (const [zoom, night] of [[1, false], [1, true], [3, false], [3, true]] as const) {
      const plates = await drive(tab, (c, a) => c.world((a as [number, boolean])[0], (a as [number, boolean])[1]), [zoom, night]);
      const of = (name: string) => plates.find((p) => p.text === name);
      check(`over their heads at zoom ${zoom} ${night ? 'by night' : 'by day'}: the sprout over ${FOLK[0][1]}, none over ${FOLK[1][1]}`,
        !!of(FOLK[0][1])?.icons.includes(NEW_BADGE) && !!of(FOLK[1][1]) && !of(FOLK[1][1])!.icons.includes(NEW_BADGE),
        plates.map((p) => `${p.text}: ${p.icons.join('+') || 'none'}`).join('; '));
      if (shots) {
        await tab.screenshot({ path: join(shots, `plate-new-zoom${zoom}-${night ? 'night' : 'day'}.png`), clip: zoom === 1 ? { x: 330, y: 230, width: 440, height: 250 } : { x: 170, y: 40, width: 760, height: 660 } });
      }
    }

    // Settings, Name icons: the sprout goes with the rest, and comes back.
    await drive(tab, (c) => c.show('events', 60, 60, 460, 300));
    const off = await drive(tab, (c) => c.setIcons(false));
    shown = await drive(tab, (c) => c.read());
    const platesOff = await drive(tab, (c) => c.world(1, false));
    check('Name icons off: no sprout in chat, in Social or over anybody\'s head',
      off && shown.chat.every((l) => !hasNew(l.icons)) && shown.social.every((r) => !hasNew(r.icons)) && platesOff.every((p) => !p.icons.includes(NEW_BADGE)));
    const on = await drive(tab, (c) => c.setIcons(true));
    shown = await drive(tab, (c) => c.read());
    check('and on again, back', on && shown.chat.some((l) => l.by === FRESH && hasNew(l.icons)));

    // A wild one's menu and card: First tame: sure, and the odds once it is spent.
    let menu = await mine(tab, (c, a) => c.tameMenu(a as string, true, 420, 200), KIND);
    check(`the Tame entry, a first tame to come: "${FIRST_TAME_SAYS}" beside it`, menu.label.startsWith('Tame') && menu.note === FIRST_TAME_SAYS, JSON.stringify(menu));
    check('and on the card', menu.card.some((l) => l.includes(FIRST_TAME_SAYS)), menu.card.join(' / '));
    if (shots) await tab.screenshot({ path: join(shots, 'tame-menu-first.png'), clip: clip(menu.box, 140) });
    menu = await mine(tab, (c, a) => c.tameMenu(a as string, false, 420, 200), KIND);
    check('spent: nothing beside Tame, the odds on the card', menu.note === null && menu.card.some((l) => l.includes('% chance per offering')), JSON.stringify(menu));
    if (shots) await tab.screenshot({ path: join(shots, 'tame-menu-spent.png'), clip: clip(menu.box, 140) });
    check('nothing thrown on the page', !thrown.length, thrown.join(' | '));
    await ctx.close();
  } finally {
    await browser.close();
  }
}

finish('first tame sure, and New before a name');

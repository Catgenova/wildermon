/**
 * Dying on a real island in a real page: the chooser shows, with how you died, and a pick wakes you there.
 *
 * Reported, again: "still getting no prompt on where to spawn when I died, should be the ability to spawn at my
 * settlement totem or a runestone of my choice". The offer of where to wake (`respawn_offer`, `rpc_settle`'s
 * `fallen`) stands only while the body is on the tile death woke it on (`respawn_fall`). A body walking when it died
 * says where it walked to next from the ground it fell on, before it knows; `rpc_move` took that as a walk from the
 * spawn, pulled the body a walk's worth towards it and answered "held to its pace", so the page took the walk up
 * again. The body was off the spawn tile on the first word after the death, the beat withdrew the offer, and the
 * chooser never showed. `respawnpick.ts` and `fell.ts` killed a standing body and asked the beat straight after,
 * so nothing ever walked between the two; `qol.ts` put the body back with no pull at all.
 *
 * And asked for: "a summary card at death with how you died". What this asks, on an island made here (1024 across,
 * so the five Runestones stand on it), with a page (`deathchooser-page.ts`) whose every door is answered by it:
 *
 *   * walking when a goblin kills it: the next word leaves the body on the spawn, held (not taken up again); the beat
 *     after shows the chooser, on top, with the five stones and its settlement's totem; the death card at its top
 *     says the goblin, the killing blow among the last blows, where (tile and region), the grave with its count,
 *     and when; the totem picked wakes it next to the token, on the island and in the page;
 *   * standing in the sea, out of breath, in its death grace: the beat shows the chooser (the page put on the spawn
 *     with the island), the card says drowned and the grace kept; a Runestone picked wakes it on a first join's ring;
 *   * the island's half by itself: the offer's cause, blows and things as the card reads them, a word from before
 *     the death held, and one well after it taken (`respawn_hold`), which withdraws the offer as a step off did;
 *   * `deathRows` with nothing said of the death (an island before it): where only.
 *
 * Needs Chromium (as `respawnpick.ts`); without it the page half is skipped, failed with `DEATHCHOOSER_STRICT`.
 * Makes its own island, and takes it away again.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from './pagebuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { DEED_AT, fallenIn, RESPAWN_RING, respawnChoices, tilesSaid } from '../../src/game/respawn';
import {
  BLOWS_LABEL, CAUSE_LABEL, CAUSE_SAID, DEATH_BLOWS, DEATH_BLOWS_SECS, DEATH_TITLE, deathRows, KILLING_BLOW, NOTHING_CARRIED, RESPAWN_HOLD, THINGS_LABEL,
  WHEN_LABEL, WHERE_LABEL,
} from '../../src/game/deathcard';
import { RUNESTONES, START_RING, stoneCentre } from '../../src/game/runestones';
import type { Driven, Seen } from './deathchooser-page';
import { bad, check, finish, psql } from './harness';

const N = 1024;
const SPAWN = 5;
const ME = '5e5b0000-0000-4000-8000-0000000000d1';
const ISLE = 'Deathbed';
const W = `(select id from world where name = '${ISLE}')`;
const as = `select set_config('request.jwt.claims', json_build_object('sub', '${ME}')::text, false) \\g /dev/null\n`;
const j = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
/** Where the body is walking when the goblin kills it, its settlement, and the sea it drowns in. */
const FALL = { x: 400.5, y: 650.5 };
const OWN = { x: 300, y: 300, name: 'Ashford', level: 2 };
const SEA = { x: 1010.5, y: 650.5 };
const SPAWN_AT = `${SPAWN + 0.5},${SPAWN + 0.5}`;

const drop = (): void => {
  psql(`do $d$ declare w uuid; begin
    select id into w from world where name = '${ISLE}';
    delete from private.fallen where uid = '${ME}';
    if to_regclass('private.blow') is not null then execute format('delete from private.blow where uid = %L', '${ME}'); end if;
    if w is null then return; end if;
    delete from deed where world_id = w;
    delete from world where id = w;
  end $d$;`);
};
drop();
psql(`${as}do $t$
declare w uuid; me uuid := '${ME}';
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('${ISLE}', 4249, ${N}, ${SPAWN}, ${SPAWN}, true) returning id into w;
  perform land_blank(w, ${N});
  -- Dry and level west of x 1000, where every stone stands on a world this size; the sea east of it.
  update land_corner set heights = decode(repeat('0a00', 1000) || repeat('d8ff', ${N + 1 - 1000}), 'hex') where world_id = w;
  perform rpc_join(w, 'Mearh');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, '${OWN.name}', ${OWN.x}, ${OWN.y}, 5, ${OWN.level}, me);
end $t$;`);

/** A door as the page knocks at it, answered off the database as the person (`ME`) it is signed in as. */
function door(name: string, args: Record<string, unknown>): { data: unknown; error: { message: string } | null } {
  const lit = (v: unknown): string => (v === null || v === undefined ? 'null'
    : typeof v === 'number' || typeof v === 'boolean' ? String(v)
      : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : j(v));
  const named = Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
  try {
    const out = psql(`${as}delete from caller where uid = '${ME}';\nselect coalesce((public.${name}(${named}))::text, 'null');`);
    return { data: JSON.parse(out), error: null };
  } catch (e) {
    const line = String((e as { stderr?: string }).stderr ?? e).split('\n').find((l) => l.startsWith('ERROR')) ?? String(e);
    return { data: null, error: { message: line.replace(/^ERROR:\s*/, '') } };
  }
}

/** Where the island has the body, as `x,y,level`. */
const where = (): string => psql(`select x || ',' || y || ',' || coalesce(level, 0) from player where world_id = ${W} and uid = '${ME}';`);
/** The beat's offer, as the island says it now (the page's own beats aside). */
const offer = (): Record<string, unknown> | null => {
  const beat = door('rpc_settle', { p_world: psql(`select id from world where name = '${ISLE}';`) }).data as Record<string, unknown> | null;
  return (beat?.fallen as Record<string, unknown> | undefined) ?? null;
};

/** A goblin beside the body, which kills it with blows (`hurt_player`, as `hunt_settle` lands them). */
const goblinKills = (): void => {
  psql(`${as}do $k$ declare w uuid := ${W}; me uuid := '${ME}'; g int; k int := 0;
  begin
    g := creature_spawn(w, 'goblin', ${FALL.x + 1}, ${FALL.y}, 'wild', now() - interval '60 days', null);
    -- Carrying a hatchet, past the death grace: a grave.
    perform give(w, me, 'hatchet', 1, 50, null, null, null, null, null);
    update player set played = greatest(played, death_grace()) where world_id = w and uid = me;
    -- Two blows that leave it standing, a moment apart.
    update player set stats = stats || jsonb_build_object('health', 1, 'hurtBy', g) where world_id = w and uid = me;
    perform hurt_player(w, me, 0.05, 'The goblin is on you', 'cut');
    perform hurt_player(w, me, 0.05, 'The goblin is on you', 'cut');
  end $k$;`);
  // The killing blow in a later moment of its own, as a later tick lands it.
  psql(`${as}do $k$ declare w uuid := ${W}; me uuid := '${ME}'; k int := 0;
  begin
    while k < 40 and not exists (select 1 from private.fallen f where f.world_id = w and f.uid = me and f.at > now() - interval '5 seconds') loop
      update player set stats = jsonb_set(stats, '{health}', '0.001') where world_id = w and uid = me;
      perform hurt_player(w, me, 0.05, 'The goblin is on you', 'cut');
      k := k + 1;
    end loop;
  end $k$;`);
};

/** Standing in the sea out of breath, in its death grace: `body_settle` drowns it. */
const drowns = (): void => {
  psql(`${as}do $k$ declare w uuid := ${W}; me uuid := '${ME}';
  begin
    update player set x = ${SEA.x}, y = ${SEA.y}, level = 0, played = 0, away = false, seen_at = now(),
        stats = stats || jsonb_build_object('health', 0.02, 'stamina', 0),
        body_at = now() - interval '50 seconds', swim_at = now() - interval '50 seconds'
     where world_id = w and uid = me;
    perform body_settle(w, me);
  end $k$;`);
};

/* ---- the island by itself ------------------------------------------------------------------------------------ */

const WORLD = psql(`select id from world where name = '${ISLE}';`);
psql(`${as}update player set x = ${FALL.x}, y = ${FALL.y} where world_id = ${W} and uid = '${ME}';`);
goblinKills();
const held = psql(`select x || ',' || y from player where world_id = ${W} and uid = '${ME}';`);
check('a goblin kills the body: on the spawn', held === SPAWN_AT, held);
const o1 = offer();
const f1 = o1 ? fallenIn(o1) : null;
check('the offer says the cause: a blow, by the goblin', JSON.stringify(o1?.cause) === JSON.stringify({ by: 'Goblin', kind: 'blow' }), JSON.stringify(o1?.cause));
const blows = (o1?.blows ?? []) as Array<Record<string, unknown>>;
check('and the last blows, oldest first: three cuts by the goblin, the last the killing one',
  blows.length === 3 && blows.every((b) => b.by === 'Goblin' && b.what === 'cut' && typeof b.part === 'string' && typeof b.taken === 'number')
    && blows.map((b) => b.kill === true).join(',') === 'false,false,true', JSON.stringify(blows));
const things = (o1?.things ?? {}) as { grave?: { x: number; y: number; n: number } };
const inGrave = Number(psql(`select count(*) from item i join placed g on g.id = i.placed where g.world_id = ${W} and g.made_by = '${ME}' and g.sub = 'grave';`));
check('and the grave where it fell, with what is in it (the hatchet among it)', things.grave?.x === Math.floor(FALL.x) && things.grave?.y === Math.floor(FALL.y)
  && things.grave?.n === inGrave && inGrave >= 1, `${JSON.stringify(o1?.things)} ${inGrave}`);
check('and when: the instant, and the island\'s clock then', typeof o1?.at === 'string' && typeof o1?.clock === 'number', `${o1?.at} ${o1?.clock}`);
check('fallenIn reads it all', !!f1?.death && f1.death.cause?.kind === 'blow' && f1.death.blows.length === 3 && !!f1.death.things, JSON.stringify(f1?.death));
// A word from the ground it fell on, said before the page knew: held on the spawn, and held (not taken up again).
const word = door('rpc_move', { p_world: WORLD, p_x: FALL.x + 0.3, p_y: FALL.y, p_level: 0 }).data as Record<string, unknown> | null;
check('a word from before the death: the body stays on the spawn, held (pulled and blocked)',
  where() === `${SPAWN_AT},0` && word?.x === SPAWN + 0.5 && word?.pulled === true && word?.blocked === true, `${where()} ${JSON.stringify(word)}`);
check('  and the offer stands', !!offer());
// A step off the tile once the death is `respawn_hold` old is a step, and the offer goes with it, as before.
psql(`update private.fallen set at = now() - interval '${RESPAWN_HOLD + 1} seconds' where uid = '${ME}';
update player set moved_at = now() - interval '2 seconds', walk_ahead = 0 where world_id = ${W} and uid = '${ME}';`);
door('rpc_move', { p_world: WORLD, p_x: SPAWN + 1.6, p_y: SPAWN + 0.5, p_level: 0 });
check(`a step off the spawn ${RESPAWN_HOLD} s after the death is taken`, where() === `${SPAWN + 1.6},${SPAWN + 0.5},0`, where());
check('  and the offer goes', offer() === null);
drowns();
const o2 = offer();
check('in the sea out of breath, in its grace: on the spawn, the offer says drowned and the grace kept',
  JSON.stringify(o2?.cause) === JSON.stringify({ kind: 'drowned' }) && typeof (o2?.things as { grace?: number } | undefined)?.grace === 'number'
    && (o2?.blows as unknown[] | undefined)?.length === 0, `${where()} ${JSON.stringify(o2)}`);
door('rpc_respawn', { p_world: WORLD, p_at: 'stay' });
// Past its grace, carrying nothing, dead of nothing said: no cause, no blows, and nothing carried (`grave` false).
psql(`${as}do $k$ declare w uuid := ${W}; me uuid := '${ME}';
begin
  delete from item where world_id = w and holder = 'player' and holder_uid = me and not issued;
  update player set played = greatest(played, death_grace()), x = ${FALL.x}, y = ${FALL.y} where world_id = w and uid = me;
  perform player_die(w, me);
end $k$;`);
const o3 = offer();
const f3 = o3 ? fallenIn(o3) : null;
check('carrying nothing past its grace: no cause, no blows, nothing carried',
  !!f3?.death && f3.death.cause === null && f3.death.blows.length === 0 && JSON.stringify(f3.death.things) === JSON.stringify({ grave: null })
    && deathRows(f3, f3.death).find((r) => r.label === THINGS_LABEL)?.lines[0] === NOTHING_CARRIED, JSON.stringify(o3));
door('rpc_respawn', { p_world: WORLD, p_at: 'stay' });

let terms = '';
try {
  terms = psql(`select respawn_hold() || ',' || death_blows() || ',' || death_blows_secs();`);
} catch {
  terms = 'none';
}
check('the hold after a death and the blows a card lists are the browser\'s', terms === `${RESPAWN_HOLD},${DEATH_BLOWS},${DEATH_BLOWS_SECS}`, terms);

/* ---- the card's words ---------------------------------------------------------------------------------------- */

const bare = deathRows({ x: 400.5, y: 650.5 }, null);
check('deathRows with nothing said of the death (an island before it): where only',
  JSON.stringify(bare) === JSON.stringify([{ label: WHERE_LABEL, lines: ['400, 650'] }]), JSON.stringify(bare));
check('fallenIn, an offer from an island before it: no death', fallenIn({ x: 1, y: 2, deeds: [] })?.death === null);

/* ---- the page ----------------------------------------------------------------------------------------------- */

function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}

const options = browserOptions();
if (!options) {
  console.log('deathchooser: no Chromium here (set CHROME_PATH); the page is not driven.');
  if (process.env.DEATHCHOOSER_STRICT) bad.push('FAIL driven: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/deathchooser-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const css = ['src/style.css', 'src/phone.css'].map((f) => readFileSync(resolve(f), 'utf8')).join('\n');
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const tab: Page = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.exposeFunction('islandRpc', (name: string, args: Record<string, unknown>) => door(name, args));
    await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addStyleTag({ content: css });
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    const drive = <T>(fn: (c: Driven, a: unknown) => T | Promise<T>, arg?: unknown): Promise<T> =>
      tab.evaluate(([f, a]) => (new Function('c', 'a', `return (${f})(c, a)`))((window as unknown as { dc: Driven }).dc, a), [fn.toString(), arg] as const) as Promise<T>;
    const read = (): Promise<Seen> => drive((c) => c.read());
    const rows = (s: Seen): Map<string, string> => new Map(s.death.slice(1).map((r) => [r.slice(0, r.indexOf(': ')), r.slice(r.indexOf(': ') + 2)]));

    // 1. Walking from where it stands, a goblin kills it, and the next word goes from the ground it fell on.
    psql(`update player set x = ${FALL.x}, y = ${FALL.y}, level = 0, moved_at = now(), walk_ahead = 0 where world_id = ${W} and uid = '${ME}';`);
    await drive((c, a) => c.setup((a as [string, number, { x: number; y: number }, { x: number; y: number }])[0], (a as [string, number])[1],
      (a as [string, number, { x: number; y: number }])[2], (a as [string, number, { x: number; y: number }, { x: number; y: number }])[3]),
    [WORLD, N, { x: SPAWN, y: SPAWN }, FALL]);
    for (let k = 1; k <= 3; k++) await drive((c, a) => c.step(a as number, 650.5), FALL.x + k * 0.1);
    goblinKills();
    for (let k = 4; k <= 6; k++) await drive((c, a) => c.step(a as number, 650.5), FALL.x + k * 0.1);
    check('walking when the goblin killed it: the next words leave the body on the spawn tile', where().startsWith(`${SPAWN_AT},`), where());
    let seen = await read();
    const put = seen.moved.at(-1);
    check('  and the page is put there, the walk not taken up again', !!put && Math.floor(put.x) === SPAWN && Math.floor(put.y) === SPAWN && !put.resume
      && Math.floor(seen.body.x) === SPAWN && Math.floor(seen.body.y) === SPAWN, JSON.stringify(seen.moved));
    const open = await drive((c) => c.waitOpen());
    seen = await read();
    check('the beat after: the chooser shows, on top', open && seen.onTop, `${open} ${seen.onTop} ${seen.asked.join(',')}`);
    const stoneCards = RUNESTONES.map((s) => s.id);
    check('  with the five Runestones and its settlement\'s totem', JSON.stringify(seen.cards.map((c) => c.split('|')[0])) === JSON.stringify([...stoneCards, `${DEED_AT}${ME}`])
      && seen.cards.at(-1)?.split('|').slice(1, 3).join('|') === `${OWN.name}|Founder`, seen.cards.join('; '));
    const r1 = rows(seen);
    check(`  the death card at its top: "${DEATH_TITLE}"`, seen.death[0] === DEATH_TITLE, seen.death.join(' / '));
    check(`  ${CAUSE_LABEL}: ${CAUSE_SAID.blow}: Goblin`, r1.get(CAUSE_LABEL) === `${CAUSE_SAID.blow}: Goblin`, r1.get(CAUSE_LABEL));
    const lastBlows = (r1.get(BLOWS_LABEL) ?? '').split(' | ');
    check(`  ${BLOWS_LABEL}: three, newest first, the ${KILLING_BLOW.toLowerCase()} by the goblin, a cut, where and how much`,
      lastBlows.length === 3 && new RegExp(`^${KILLING_BLOW}: Goblin · cut · (head|chest|arm|leg|foot|hand) · \\d+(\\.\\d)?% health$`).test(lastBlows[0])
        && lastBlows.slice(1).every((l) => /^Goblin · cut · \w+ · \d+(\.\d)?% health$/.test(l)), lastBlows.join(' | '));
    check(`  ${WHERE_LABEL}: the tile it fell on`, (r1.get(WHERE_LABEL) ?? '').startsWith(`${Math.floor(FALL.x)}, ${Math.floor(FALL.y)}`), r1.get(WHERE_LABEL));
    check(`  ${THINGS_LABEL}: the grave there, the hatchet in it`, new RegExp(`^Grave: ${Math.floor(FALL.x)}, ${Math.floor(FALL.y)} · 1 item · crumbles in `).test(r1.get(THINGS_LABEL) ?? ''),
      r1.get(THINGS_LABEL));
    check(`  ${WHEN_LABEL}: the island's clock and the season`, /^\d\d:\d\d · \w+, day \d+ of \d+$/.test(r1.get(WHEN_LABEL) ?? ''), r1.get(WHEN_LABEL));
    const own = respawnChoices({ x: FALL.x, y: FALL.y, deeds: [{ id: ME, name: OWN.name, x: OWN.x, y: OWN.y, level: OWN.level, own: true }] }, N).at(-1);
    check('  the totem\'s distance from where it fell', seen.cards.at(-1)?.split('|')[3] === tilesSaid(own?.tiles ?? -1), seen.cards.at(-1));
    await drive((c, a) => c.click(a as string), `${DEED_AT}${ME}`);
    seen = await read();
    const tok = `${OWN.x + RESPAWN_RING[0][0] + 0.5},${OWN.y + RESPAWN_RING[0][1] + 0.5}`;
    check(`the totem picked: woken next to it, ${tok}, on the island`, where() === `${tok},0`, where());
    check('  and in the page, the chooser gone', !seen.open && `${seen.body.x},${seen.body.y}` === tok, `${seen.open} ${seen.body.x},${seen.body.y}`);

    // 2. Standing in the sea out of breath, in its grace: the page knows nothing until the beat.
    drowns();
    await drive((c) => c.beat());
    seen = await read();
    const r2 = rows(seen);
    check('drowned standing still: the beat shows the chooser, the page put on the spawn with the island', seen.open
      && Math.floor(seen.body.x) === SPAWN && Math.floor(seen.body.y) === SPAWN, `${seen.open} ${JSON.stringify(seen.body)}`);
    check(`  ${CAUSE_LABEL}: ${CAUSE_SAID.drowned}; no blows`, r2.get(CAUSE_LABEL) === CAUSE_SAID.drowned && !r2.has(BLOWS_LABEL), seen.death.join(' / '));
    check(`  ${WHERE_LABEL}: the sea tile`, (r2.get(WHERE_LABEL) ?? '').startsWith(`${Math.floor(SEA.x)}, ${Math.floor(SEA.y)}`), r2.get(WHERE_LABEL));
    check(`  ${THINGS_LABEL}: the death grace kept, said once`, /^Death grace: .* played left; nothing lost\.$/.test(r2.get(THINGS_LABEL) ?? '')
      && seen.grace === null, `${r2.get(THINGS_LABEL)} | ${seen.grace}`);
    const stone = RUNESTONES[1];
    await drive((c, a) => c.click(a as string), stone.id);
    seen = await read();
    const c = stoneCentre(stone, N);
    const ring = `${c.x + START_RING[0][0] + 0.5},${c.y + START_RING[0][1] + 0.5}`;
    check(`${stone.name} picked: woken on a first join's ring round it, ${ring}, on the island`, where() === `${ring},0`, where());
    check('  and in the page, the chooser gone', !seen.open && `${seen.body.x},${seen.body.y}` === ring, `${seen.open} ${seen.body.x},${seen.body.y}`);
    check('the page threw nothing', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
  }
}

drop();
finish('dying on a real island: the chooser, the death card, and a pick');

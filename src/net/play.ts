import { preloadTreesAt, type TreePreload } from '../render/preload';
import { TREE_WAIT_MS, type BootPhase } from '../ui/bootsteps';
import { gearFrom } from '../game/worn';
import { BROWSER_TALLY, Game, SPROUT_COOLDOWN } from '../game/game';
import type { Marker } from '../game/marks';
import { EMOTE_BY_ID } from '../game/emotes';
import { cleanLook } from '../game/look';
import { whoAmI } from './accounts';
import { supabase } from './supabase';
import { toldOf, toldWire } from './told';
import { PRESENCE_FRESH_MS } from './presence';
import { ACT_MANY_JOBS, Island, type CastMore, type CastWire, type HeldSaid, type ItemRow, type PlayerRow, type SkinSaid } from './island';
import { heldFrom } from '../ui/effects';
import { isSpell } from '../render/spells/info';
import type { CastAt } from '../game/events';
import { generateAtlasWorld, loadAtlas } from '../world/atlas-world';
import { ACTION_BY_ID, type ActionDef, type Target } from '../game/actions';
import { hiddenAsk } from '../game/gates';
import { swirlIn, type Swirl } from '../game/motes';
import { startChoices, TELESTONE_KEY, type Runestone, type RunestoneId } from '../game/runestones';
import { runeGatesHeld, sawGateFolk } from '../game/runegate';
import { isFightJob, isFightStance } from '../game/fight';
import { FIGHT_BACK_GOES } from '../game/creatures';
import { saidWords } from '../game/roster';
import { skillRises, tookOff } from './felt';
import { packAll } from './packed';
import { reportErrorsTo } from './errors';
import { learnChart } from '../game/cartography';
import { isBarred } from '../game/keeper';

/**
 * Off to the landing page, logged off by a keeper of the island or barred from
 * it. Only the island's id and a bare `off` travel: the landing page asks the
 * island for the line itself (`rpc_barred`), so no link can put words there.
 */
function sentOff(island: string): Promise<never> {
  location.replace(`./account.html?${new URLSearchParams({ island, off: '1' })}`);
  return new Promise<never>(() => {});
}

/**
 * Starting on an island that lives in Postgres rather than in this tab.
 *
 * The front door opens on the island. With nothing in the address bar at all
 * this asks the keeper which island it keeps and comes ashore on it, which is
 * what a front door should do — a page that needs a uuid pasted into it is not
 * one. The rest of the address bar still decides the unusual cases:
 *
 *   (nothing)        come ashore on the island this keeper keeps
 *   ?island=<id>     come ashore on a particular one
 *   ?found=<name>    roll a small one here, hand it over, and be its first
 *
 * There is no single-player game. A keeper that cannot be reached or keeps no
 * island yet is an error, said on the boot card with a Retry (`main.ts`).
 */

export interface Started {
  game: Game;
  island: Island;
  id: string;
}

/**
 * How the boot screen is told what is happening: the phase (`BOOT_PHASES`), a word on what it is on, and how
 * far through it is when that can be counted. A `total` of nought means "counting up towards nobody knows
 * what", which is the island's history: a percentage of an unknown is the one number that looks exactly like
 * being stuck.
 */
type Telling = (phase: BootPhase, detail?: string, done?: number, total?: number) => void;

/** How long the front door waits for an answer before giving up on the keeper. */
const ASK_HOME_MS = 8000;

/**
 * Which island this keeper keeps, if it keeps one.
 *
 * One small read of one small table. It is not an id anybody can set from a
 * browser: whoever could would be pointing every visitor at an island of their
 * own, so `home` is written by a migration and by the opening of an island
 * bigger than a tab may found, and by nothing else.
 */
async function homeIsland(): Promise<string | null> {
  /*
   * With a clock on it, because this is the first thing the page does.
   *
   * A front door that hangs is worse than one that opens on the wrong room:
   * eight seconds is already longer than anybody should spend looking at a
   * notice. A keeper that has not
   * answered by then is a keeper that is not answering.
   */
  const asked = supabase().from('home').select('island').limit(1).maybeSingle();
  const timeout = new Promise<never>((_, no) =>
    setTimeout(() => no(new Error('The island keeper did not answer.')), ASK_HOME_MS));
  const { data, error } = await Promise.race([asked, timeout]);
  if (error) throw new Error(`Could not ask the keeper which island it keeps: ${error.message}`);
  return ((data ?? {}) as { island?: string | null }).island ?? null;
}

/** How a first join is shown the Runestones and answers with the one it starts beside (`pickStone`). */
export type StonePick = (stones: readonly Runestone[]) => Promise<RunestoneId | null>;

export async function startIsland(params: URLSearchParams, tell: Telling, pick?: StonePick): Promise<Started> {
  const founding = params.get('found');
  tell('auth');
  /*
   * The survey chart, decoded while the keeper is asked who you are and which island: it is the first thing
   * the join needs and nothing about it waits on an answer.
   */
  const charting = loadAtlas();
  charting.catch(() => undefined);
  const log: Array<[string, string, number | undefined]> = [];
  const island = new Island({
    say: (text, kind, at) => log.push([text, kind, at]),
    ground: () => {},
    people: () => {},
    pack: () => {},
    /*
     * A total of nought means nobody knows how many there are — the island's
     * history is read until it runs out, and a percentage of an unknown is a
     * lie that looks exactly like being stuck. Reported as "hung on catching
     * up, 100%": it was not hung, it was counting, and saying 100% the whole
     * way through was the only thing wrong with it.
     */
    progress: (done, total, what, phase) => {
      tell(phase ?? 'world', what, done, total);
      // The land is known and so is where you stand: the trees round you are baked while the rest is read.
      if (!preloading && phase === 'land' && island.world && island.me) preloading = preloadTreesAt(island.world, island.me.x, island.me.y, island.time(), undefined, treeStep);
    },
    chart: () => charting,
  });
  let preloading: TreePreload | null = null;
  // The near trees' parts as they are baked, said once the boot card is on the trees and kept until then.
  let treesDone = 0;
  let treesOf = 0;
  let onTrees = false;
  const treeStep = (done: number, total: number): void => {
    treesDone = done;
    treesOf = total;
    if (onTrees) tell('trees', 'near', done, total);
  };
  /*
   * Which island, who you are, and whether the island takes this build (with a session to ask it with; the join
   * waits on the answer), side by side: none waits on another. A keeper that will not say which island is still
   * the error it was, ahead of the landing page.
   */
  island.askBuildEarly();
  const asked = params.get('island');
  const [joining, account] = await Promise.all([
    !asked && founding === null ? homeIsland() : Promise.resolve(asked),
    whoAmI().catch(() => null),
  ]);
  if (!joining && founding === null) throw new Error('The island keeper has no island on it yet.');

  /**
   * What to call you.
   *
   * An account first, and the address bar only if there is no account. That
   * order is the whole point of having accounts: `?me=` is a string anybody
   * can type, while `whoAmI()` is the island keeper reading a name back out of
   * the address you signed in with, which nobody can type their way into.
   * With neither, you are a Wanderer, and the island still lets you in — an
   * account is a name you can prove, not a toll.
   */
  /*
   * No account, no island. The landing page first.
   *
   * It has been there all along and the game walked straight past it, so
   * everybody who ever came ashore was an anonymous session called Wanderer —
   * indistinguishable on the roster, impossible to tell apart on the tables,
   * and hanging every skill they earned off a uid kept in `localStorage`,
   * which is a place browsers tidy up. "Just had all my skills wiped" is what
   * that looks like from inside.
   *
   */
  if (!account) {
    tell('auth', 'landing page');
    const carried = new URLSearchParams();
    for (const key of ['island', 'found', 'size', 'seed']) {
      const had = params.get(key);
      if (had !== null) carried.set(key, had);
    }
    location.replace(`./account.html${carried.toString() ? `?${carried}` : ''}`);
    // And hold here rather than hand back while the page navigates.
    return new Promise<never>(() => {});
  }
  const name = account;

  let id = joining ?? '';
  if (!id) {
    tell('world', 'rolling');
    /*
     * Founding from a tab is for small islands, and `Island.found` says so
     * above 512. The big one — `ISLAND_SIZE`, four thousand and ninety-six —
     * is founded once by `tools/found-island.ts`, because it is three minutes
     * of ground and 138 MB of land and neither belongs in a page somebody is
     * waiting on. Coming *ashore* on it costs nothing extra, which is the
     * whole point of the change.
     */
    const size = Number(params.get('size')) || 256;
    const seed = (Math.random() * 0x7fffffff) >>> 0;
    /*
     * From the survey chart, not from the old radial mask.
     *
     * This has to be the generator the *join* uses, or an island is one shape
     * the day it is founded and another shape the day somebody comes back to
     * it: founding uploads what was rolled here, and joining works the ground
     * out from the seed. Two generators is two islands that have to agree
     * forever, and they would not.
     */
    const gen = generateAtlasWorld(seed, await charting, size);
    id = await island.found(gen.world, founding || 'An island', gen.spawn);
    /**
     * Put the island's name in the address bar.
     *
     * Without this an island is founded and then immediately lost: the only
     * copy of the one thing anybody needs in order to visit it — its id — was
     * a string in a variable. Now the page you are looking at *is* the
     * invitation, and reloading comes back to the same island rather than
     * founding another one.
     */
    const here = new URLSearchParams(params);
    here.delete('found');
    here.delete('size');
    here.set('island', id);
    history.replaceState({}, '', `?${here.toString()}`);
  }

  tell('join');
  /*
   * A first join on an island the stones stand on picks the Runestone it
   * starts beside (`startChoices`); somebody coming back never sees it.
   */
  let stone: RunestoneId | null = null;
  if (pick) {
    const { first, size } = await island.firstJoin(id);
    const stones = startChoices(first, size);
    if (stones.length) {
      tell('join', 'Runestone');
      stone = await pick(stones);
    }
  }
  try {
    await island.join(id, name, stone);
  } catch (e) {
    // Barred: the landing page says until when, rather than a Retry that cannot work.
    if (e instanceof Error && isBarred(e.message.replace(/^The island would not have us: /, ''))) return sentOff(id);
    throw e;
  }
  const world = island.world;
  const info = island.info;
  const me = island.me;
  if (!world || !info || !me) throw new Error('The island did not arrive in one piece.');

  // A game built on the island's land, with its own body where the island says
  // it is. Everything it would normally decide, it now asks about.
  const game = new Game({
    seed: info.seed,
    world,
    spawn: { x: info.spawn_x, y: info.spawn_y },
    player: {
      x: me.x, y: me.y, name: me.name,
      // The island's copy, not this browser's: the face you chose is kept with
      // the account and handed back at the join, so a new machine comes ashore
      // looking like you rather than like a stranger.
      look: cleanLook(me.look),
      stats: (me.stats as Game['player']['stats']) ?? { health: 1, stamina: 1, hunger: 1, thirst: 1 },
    },
    time: island.time(),
  });

  /*
   * The hour comes from the island from here on, rather than being counted up
   * a frame at a time on this machine. Reported as "day and night only seem to
   * change on client refresh", and a reload was indeed the only thing that
   * ever put the clock right.
   */
  game.islandClock = () => island.time();

  /*
   * Your perks, as the island folded them onto your row: the few things they
   * change that are this side's to draw -- your pace on a road, what your
   * pack weighs, what your back takes, and which jobs a menu offers. The
   * Trades window hands on a fresh fold whenever it asks the island.
   */
  game.setPerks(((me.class_mul as { fx?: Record<string, number> } | null) ?? {}).fx);

  /** What was last asked about, so the bar has something to point at. */
  let lastTarget: Target | null = null;
  /** Whether the island's book of skills has landed once, so a rise is a rise. */
  let seeded = false;

  game.ask = (def: ActionDef, target: Target, goes?: number) => {
    // A shot goes with the arrows to loose first (`nockedArrow`), which only this side keeps.
    if (def.id === 'shoot_creature' && target.kind === 'creature' && !target.arrow) target = { ...target, arrow: game.settings.nock };
    lastTarget = target;
    // gates: a solid wall asked for as a hidden door goes in the one call that keeps the ask with its plan (`gates.ts`).
    // A fight asked for without a count goes on until it is over or out of reach, as it does here.
    void island.act(def.id, target as unknown as Record<string, unknown>, goes ?? (isFightJob(def.id) ? FIGHT_BACK_GOES : 1), hiddenAsk(target));
  };
  /*
   * Many things into a store or out of one, a few dozen to an ask (`Island.actMany`). With a job in hand the
   * island does none of them, and the rest go one at a time, as before, to be queued behind it.
   */
  game.askAll = (def: ActionDef, targets: Target[]) => {
    if (!ACT_MANY_JOBS.has(def.id)) return false;
    lastTarget = targets[targets.length - 1] ?? null;
    void island.actMany(def.id, targets as unknown as Array<Record<string, unknown>>).then(({ rest, busy }) => {
      if (busy) for (const t of rest) void island.act(def.id, t, 1);
    });
    return true;
  };
  game.stop = () => {
    lastTarget = null;
    void island.stop();
  };
  game.hold = () => {
    lastTarget = null;
    void island.hold();
  };
  game.reorder = (seen, order) => void island.queueOrder(seen, order);
  // A plan over an area, and the last plan taken back: one call each (`planarea.ts`).
  game.planArea = (asks) => island.planArea(asks);
  game.undoPlan = () => island.undoPlan();

  /*
   * The clock on what the island is doing.
   *
   * `ask` sends the whole of an action away, which is what makes the island
   * the authority — and left the screen with nothing to draw. `showAction`
   * puts the island's own reckoning on the bar without this machine owning any
   * of the work: the clock runs here between one answer and the next, and
   * whether the job happened is still the island's to say.
   */
  /*
   * The wildlife, which the browser had simply never asked for.
   *
   * `creatures.fromIsland` stops this machine thinking for any of them — their
   * hunger, wandering and hunting are all settled over there, the same seam as
   * actions — and leaves it drawing the legs the island hands over.
   */
  game.creatures.fromIsland = true;
  // And the springs: the island settles them and says where their water is.
  game.springs.fromIsland = true;
  /*
   * And the body, which the island now keeps.
   *
   * Reported as "thirst and hunger reset to full on every client reset": the
   * bars fell here all session and the island's row had never moved, so a
   * refresh read the full mark it was made with. The island settles a body off
   * a timestamp now, and this side stops moving what it does not own.
   */
  game.bodyFromIsland = true;
  /*
   * And the pack, which it has always kept — the browser simply never read
   * most of a row off it. See `packed` below for the seven fields that were
   * dropped and the bugs each of them was.
   */
  game.packFromIsland = true;
  // And the record of what has been ticked off, which is the island's to keep:
  // nothing on this side is ever written down on an island.
  game.tickedGoal = (id) => island.tickGoal(id);
  /*
   * And the pins on your map, which an island game has nowhere to keep: it
   * never saves, and the island holds no pins. Kept in this browser, one set
   * for each island and each person on it, and taken back as the game starts.
   */
  const marksKey = `wurm.marks.${info.id}.${island.uid}`;
  try {
    const kept = JSON.parse(localStorage.getItem(marksKey) ?? '[]') as unknown;
    if (Array.isArray(kept)) game.takeMarks(kept.filter((m): m is Marker => !!m && typeof m === 'object'
      && typeof m.id === 'number' && typeof m.x === 'number' && typeof m.y === 'number' && typeof m.name === 'string' && typeof m.colour === 'string'));
  } catch {
    // Nothing kept, or storage shut: the map starts with no pins of yours.
  }
  game.marksChanged = () => {
    try {
      localStorage.setItem(marksKey, JSON.stringify(game.marks.filter((m) => m.grave === undefined)));
    } catch {
      // Storage full or shut: the pins last as long as the page.
    }
  };
  // And nothing is read out of it until the island has sent it: a tally that
  // has not arrived yet is an empty one, and every goal already met would be
  // announced all over again on every refresh.
  game.journalReady = false;
  // And every count it reads is the island's, but the two only a browser sees (`BROWSER_TALLY`).
  game.tallyFromIsland = true;
  // And the field guide, which the island keeps too: a kind that comes into
  // view is handed over rather than written down here, and goes in the book
  // when the island has taken it.
  game.guideSaw = (species) => island.sawKind(species);
  island.hooks.guided = (added, had) => game.guideHeard(added, had);
  island.hooks.mobs = (rows) => {
    // Everything that lost health since the last answer gets its number, which
    // is the half of the fight that happens away from your own body.
    for (const h of game.creatures.sawAll(rows, game.time)) {
      // Larger for one the island has just said was critical (`critPending`).
      game.events.emit('hit', h.x, h.y, h.taken, game.critPending() ? 'crit' : 'dealt');
    }
    // And which of them are in whose traces, which lives on the vehicle here.
    game.teamsFromCreatures();
    game.events.emit('creature');
  };

  /*
   * And everything standing on the ground, which had the same bug for the same
   * reason: the island keeps it and nothing here ever looked. A campfire laid
   * on a live island was a row in `placed` and a blank patch of grass.
   */
  // Whose uid this is, so the seat and the shafts that are ours can be told
  // from somebody else's.
  island.hooks.built = (ground) => game.sawGround(ground, island, island.uid || null);
  island.hooks.paved = (x, y, on) => game.sawPaving(x, y, on);
  island.hooks.springs = (near, chains) => game.springs.sawIsland(near, chains);
  // And which spots near us are picked over, for the waits the menus and the tile window say (`yieldLines`).
  island.hooks.foraged = (rows) => game.foragedFromIsland(rows);
  island.hooks.foragedWithin = SPROUT_COOLDOWN;
  island.hooks.knownSprings = () => Object.fromEntries([...game.springs.list.values()].map((s) => [String(s.id), s.ver]));
  // And the mote swirls round us, which the island puts down at dawn and takes away as they are collected (`motes.ts`).
  island.hooks.swirls = (rows) => game.setSwirls(rows.map(swirlIn).filter((s): s is Swirl => s !== null));
  // And who lights a rune gate: the rolls of the settlements they stand on, while one is in view (`runegate.ts`).
  island.hooks.gateFolk = (rows) => sawGateFolk(game, rows);
  island.hooks.gatesHeld = () => runeGatesHeld(game);
  island.hooks.swirlsGone = (ids) => {
    for (const id of ids) game.takeSwirl(id);
  };
  // Where the island put the body, which is only ever somewhere we did not put
  // it ourselves: dying does, and so does a keeper of the island moving a
  // stuck body, which takes it off whatever it was on as well.
  island.hooks.paced = (mul, secs) => game.spedUp(mul, secs);
  // Logged off by a keeper, and perhaps barred: every door now refuses this body, so the page goes too.
  island.hooks.kicked = () => void sentOff(id);
  island.hooks.moved = (x, y, level, letGo, resume) => {
    if (letGo) game.letGoOfAll();
    game.putBody(x, y, level, resume);
  };
  // And a journey by Telestone, which says when the next may be made (`runestones.ts`).
  island.hooks.travelled = (until) => {
    game.player.usedAt[TELESTONE_KEY] = until;
  };
  // And a map studied, which puts its square on your map (`cartography.ts`).
  island.hooks.charted = (x, y, r) => {
    learnChart(game, { x, y, r });
  };
  // And somebody logging on or off, for the banner while the line is fresh; not your own (`presence.ts`).
  island.hooks.presence = (name, on, at) => {
    if (name === game.player.name || (at !== undefined && Date.now() - at > PRESENCE_FRESH_MS)) return;
    game.loggedSaid = { name, on, at: performance.now() };
  };
  // And a trail read by a go of Track, which puts its arrow on the screen from where you stand (`tracking.ts`).
  island.hooks.tracked = (name, bearing, dist) => {
    game.trail = { name, bearing, dist, x: game.player.x, y: game.player.y, at: game.time };
  };
  /*
   * And the crates our own ask touched, which come back with the answer to it.
   *
   * Laid down on their own rather than through `sawGround`, which clears
   * everything standing and rebuilds it: right for a ground read, wrong for an
   * answer that names the two crates at your elbow.
   */
  island.hooks.stored = (crates) => game.sawCrates(crates);

  /*
   * And what spells have left on you, and the skin over you.
   *
   * Both kept on your row (`blessings`, `stats.aegis`) and only ever heard
   * here at the moment of a cast, so a reload emptied the effects row of every
   * timer while the island went on counting them. The join hands the row over
   * and every beat says them again.
   */
  const sawHeld = (said: Record<string, HeldSaid>): void => {
    game.player.held = heldFrom(said, game.time);
    game.player.heldAt = game.time;
  };
  /** Whose uid laid the skin over you, so a skin said again without a name keeps the one it had. */
  let skinBy: string | null = null;
  const sawSkin = (s: SkinSaid): void => {
    const size = typeof s.size === 'number' && s.size > 0 ? s.size : 0;
    const by = typeof s.by === 'string' ? s.by : size > 0 ? skinBy : null;
    const name = typeof s.name === 'string' ? s.name
      : by !== null && by === skinBy ? game.player.skin.by
        : by !== null ? game.roster.list().find((q) => q.uid === by)?.name ?? null : null;
    skinBy = by;
    game.player.skin = { size, mine: by !== null && by === island.uid, by: name };
  };
  const skinOfStats = (stats: Record<string, unknown>): SkinSaid => ({
    size: typeof stats.aegis === 'number' ? stats.aegis : 0,
    by: typeof stats.aegisBy === 'string' ? stats.aegisBy : undefined,
  });
  sawHeld(island.held(me.blessings));
  // Your favour as the island keeps it, until the first beat says it with what has trickled in since.
  if (typeof me.favour === 'number') game.player.favour = me.favour;
  if (me.stats && typeof me.stats === 'object') sawSkin(skinOfStats(me.stats as Record<string, unknown>));

  /*
   * The rest of you, which the browser had no way of hearing about.
   *
   * Each of these was a separate-looking bug with one cause: the island owns
   * the player row and the browser read it once, at the join. The action bar
   * never said what was queued behind the job in hand; prospecting said "they
   * are marked for a while" and marked nothing; the health and stamina bars
   * were the ones you came ashore with; the skills window disagreed with the
   * log line that had just said a skill went up.
   */
  island.hooks.mine = (what) => {
    // Each of these only when the island said something about it: the answer to
    // a queued job carries the queue and nothing else, and a prospector's marks
    // must not go out because a different question was asked.
    if (what.queue) game.showQueue(what.queue, what.cap ?? null);
    if (what.stats) {
      const s = game.player.stats as unknown as Record<string, number>;
      // What health it took off, before it is written down: a body on an
      // island is hurt over there, so `hurtPlayer` — which is what puts a
      // number over you in a game of your own — never runs.
      const was = s.health;
      for (const k of ['health', 'stamina', 'hunger', 'thirst']) {
        if (typeof what.stats[k] === 'number') s[k] = what.stats[k];
      }
      const took = tookOff(was, s.health);
      if (took) {
        game.events.emit('hit', game.player.x, game.player.y, took, 'taken');
        // And the flash of being struck, and the edge of the view reddening, as a blow here has it.
        game.player.attackedAt = game.time;
      }
      game.events.emit('stats');
    }
    if (what.skills) {
      /*
       * And which skill went up, which this had no way of saying.
       *
       * Reported as "floating text only shows for climbing". It was exactly
       * that: `gainSkill` is what raises a skill *and* emits the event the
       * floating number is drawn from, and on an island the island raises
       * them, so the only ones left running through it here were the two the
       * browser still owned then — climbing and swimming, off your own feet
       * in `update`, both of which the island raises now too. Everything else
       * came down this line, which set the numbers and then emitted a
       * nameless gain of nothing:
       *
       *     game.events.emit('skill', '', 0);
       *
       * The renderer drops a gain of nothing, so the log said "Mining
       * increased by 0.42" and nothing floated. Nothing new has to be sent:
       * the whole book arrives every beat, so the rise is the difference
       * between what it says and what we were holding.
       */
      for (const r of skillRises(what.skills, (id) => game.skills.get(id), seeded)) {
        game.events.emit('skill', r.id, r.gain);
      }
      for (const [id, value] of Object.entries(what.skills)) game.skills.values.set(id, value);
      seeded = true;
      game.events.emit('skill', '', 0);
    }
    /*
     * And what you are carrying.
     *
     * The island has kept wounds all along and no door ever mentioned them, so
     * the window was empty however cut about you were and a bandage had
     * nothing to be put on. Replaced wholesale rather than merged: the island
     * closes them, turns them bad and takes the blood out, and this side draws
     * what it is told. An empty list is "they have all closed over".
     */
    if (what.wounds) game.sawWounds(what.wounds);
    /*
     * And the rest of what you are.
     *
     * Every one of these is a column the island has kept since the day the
     * player row was made and has never once sent: the rest a night in a bed
     * banks, the dishes favouring a trade, the knacks earned over a long day,
     * the titles, and what is on your table. The hud and the Skills window
     * draw all five off the browser's own copy, which on an island was
     * whatever it came ashore with — so the rest bar counted down from
     * nothing, the title box was empty however long anybody played, and a
     * meal's favour showed for a browser that had granted it to itself.
     */
    if (typeof what.rested === 'number') game.player.rested = what.rested;
    // And your favour, which the island keeps and spends: the browser's own was its save's, nought after a reload.
    if (typeof what.favour === 'number') game.player.favour = what.favour;
    /*
     * And what you have on, which is the same story one column over. The
     * island has dispatched `equip` and `unequip` and kept the answer in
     * `player.equipped` all along, and never sent it -- so a reload left the
     * browser holding an empty record. Nothing read as worn, no armour of
     * yours counted towards what you could carry, and the menu offered
     * `Wear or wield` on the helm already on your head and never `Take it
     * off` on anything: "there's no option to unequip gear."
     */
    if (what.equipped) game.sawEquipped(what.equipped as Record<string, number | null>);
    // And what spells have left on you and the skin over you, which the effects row draws (`SpellsOnYou`).
    if (what.held) sawHeld(what.held);
    if (what.skin) sawSkin(what.skin);
    else if (what.stats && typeof what.stats.aegis === 'number') sawSkin(skinOfStats(what.stats));
    if (what.boons) game.player.boons = what.boons as typeof game.player.boons;
    if (what.knacks) game.player.knacks = what.knacks;
    if (what.titles) game.player.titles = what.titles;
    if (what.title !== undefined) game.player.title = what.title;
    if (what.nutrition) {
      const n = game.player.nutrition as unknown as Record<string, number>;
      for (const [k, v] of Object.entries(what.nutrition)) if (typeof v === 'number') n[k] = v;
    }
    if (what.marks !== undefined) game.showProspected(what.marks?.tiles ?? [], what.marks?.secs ?? 0);
    // And your path, which sight, the map and a wildermon's blood are worked out from here (`setPath`).
    if (what.path) game.setPath(what.path);
    /*
     * And the journal, which had nothing to read and nowhere to keep it.
     *
     * Forty-six of its eighty-five goals count things done, the counting was
     * done by browser performers that do not run on an island, and an island
     * session never saves — so a whole afternoon's work ticked nothing and
     * whatever it did tick went with the tab. The island notes and keeps all
     * three of these now.
     *
     * The tally is the island's, but for two keys that are still this side's
     * (`BROWSER_TALLY`): `reach` and `laden` are sailing, and the browser still
     * owns how a hull moves through water. Any other key only this tab knows
     * about goes at the beat: it was counted here for something the island
     * never counted for you.
     */
    if (what.tally) {
      // The island's counts, and nothing else but the two only this side sees: a count this tab made for something
      // the island never counted for you is somebody else's, or nobody's (`Game.tallyFromIsland`).
      for (const k of Object.keys(game.tally)) if (!BROWSER_TALLY.has(k) && !(k in what.tally)) delete game.tally[k];
      for (const [k, v] of Object.entries(what.tally)) if (typeof v === 'number') game.tally[k] = v;
    }
    if (what.ledger) {
      for (const k of Object.keys(game.ledger)) delete game.ledger[k];
      Object.assign(game.ledger, what.ledger);
    }
    if (what.ticked) game.heardTicked(what.ticked);
  };

  island.hooks.doing = (what) => {
    if (!what.act) {
      game.showAction(null, null);
      return;
    }
    const def = ACTION_BY_ID.get(what.act);
    if (!def) return;
    game.showAction(def, lastTarget, what.total, what.secs, what.left, what.goes);
  };

  // Everything the island says, said here. The lines that arrived while the
  // land was still coming down go up first, in the order they were said.
  island.hooks.say = (text, kind) => game.write(text, kind as Parameters<Game['write']>[1]);

  /*
   * Talking, which the island keeps for everybody.
   *
   * The box in the event window has been there since before there was an
   * island and did nothing on one: a line went into this browser's own log and
   * no further. It goes over now and comes back down the subscription that is
   * already open, which is how everybody else gets it — so nothing is drawn
   * here, and the only thing that comes back is a refusal.
   */
  game.talk = (text: string) => {
    void island.say(text).then((why) => {
      if (why) game.write(why, 'error');
    });
  };

  /*
   * And what was said before you got here.
   *
   * A chat you cannot scroll back through after a refresh is not a persistent
   * one. Sixty lines, oldest first, written straight into the log so they read
   * exactly as they did when they were said — and before the subscription is
   * carrying anything, so nothing lands twice.
   */
  void island.recentChat().then((lines) => {
    // With the hour each was said at, which the island has always sent and
    // this line used to drop: sixty lines stamped with the second you opened
    // the page is not a chat you can scroll back through.
    for (const line of lines) game.write(line.text, 'chat', line.at);
  });
  island.hooks.ground = (x, y) => game.events.emit('world', x, y);
  island.hooks.pack = (items: ItemRow[]) => {
    // In the order the island made them, whatever order they last changed in:
    // a mould filled and emptied is the same mould in the same place in every
    // list that walks the pack.
    game.inventory.items = packAll([...items].sort((a, b) => a.id - b.id), island);
    game.events.emit('inventory');
  };
  /*
   * Everybody, in one word, rather than one at a time.
   *
   * `saw` adds and updates and never removes, so somebody who left stood there
   * for ever. `sawAll` replaces the list — which is what this now is: the
   * roster is reconciled from the table every twenty seconds, and Broadcast
   * carries the walking in between.
   */
  /*
   * Somebody waved. Stamped by the roster on arrival rather than carried, and
   * written into the log as well as the world — half the point of waving at
   * somebody is that they know you meant them.
   */
  island.hooks.emote = (uid: string, name: string, id: string) => {
    const def = EMOTE_BY_ID.get(id);
    if (!def) return;
    game.roster.emoted(hashId(uid), id);
    game.write(def.said.replace('{name}', name || 'Somebody'), 'event');
  };
  /*
   * A bubble over whoever said it. The roster holds everybody but this body,
   * so this body's goes on the game — and it is stamped by the clock the
   * frames are drawn on either way.
   */
  island.hooks.spoke = (uid: string, text: string) => {
    const words = saidWords(text);
    if (!words) return;
    if (uid === island.uid) game.saidAloud = { text: words, at: performance.now() / 1000 };
    else game.roster.spoke(hashId(uid), words);
  };
  game.emoted = (id: string) => island.emote(id);
  /*
   * Spells, both ways. Yours, once the island has taken it (the spell bar
   * raises `cast` then), goes out for everybody watching to draw; anybody
   * else's comes in and is drawn here, at whoever or wherever it went.
   */
  // Somebody a cast reached, by uid, as it is drawn: you, or a peer by the number the roster files them under.
  const personAt = (uid: string): CastAt => (uid === island.uid ? { kind: 'you' } : { kind: 'peer', id: hashId(uid), uid });
  game.events.on('cast', (c) => {
    if (c.by !== null) return;
    const at = c.at;
    // With the companion's creature, so everybody sees the real beast act, where you stood if the island moved you, and
    // what the island said it did.
    const more: CastMore = {};
    if (c.companion !== undefined) more.pet = c.companion;
    if (c.from) more.from = c.from;
    if (c.told) {
      more.told = toldWire(c.told, (a) => (a.kind === 'you' || a.kind === 'self' ? island.uid || null : a.kind === 'peer' ? a.uid ?? null : null));
    }
    island.castSeen(c.spell, at.kind === 'peer' && at.uid ? { kind: 'player', uid: at.uid }
      : at.kind === 'creature' ? { kind: 'creature', id: at.id }
        : at.kind === 'spot' ? { kind: 'spot', x: at.x, y: at.y } : { kind: 'self' }, more);
  });
  island.hooks.castSeen = (uid: string, spell: string, at: CastWire, more: CastMore) => {
    if (!isSpell(spell)) return;
    const by = hashId(uid);
    if (!game.roster.get(by)) return;
    game.events.emit('cast', {
      spell, by,
      at: at.kind === 'player' ? (at.uid === island.uid ? { kind: 'you' } : { kind: 'peer', id: hashId(at.uid), uid: at.uid })
        : at.kind === 'creature' ? { kind: 'creature', id: at.id }
          : at.kind === 'spot' ? { kind: 'spot', x: at.x, y: at.y } : { kind: 'self' },
      companion: more.pet, from: more.from, told: more.told ? toldOf(more.told, personAt) : undefined,
    });
  };
  // Something of a spell's that fired after its cast: yours, as the island told you, or somebody else's, as their browser did.
  island.hooks.castFired = (uid, f) => {
    if (!isSpell(f.spell)) return;
    const by = uid === island.uid ? null : hashId(uid);
    if (by !== null && !game.roster.get(by)) return;
    game.events.emit('castFired', { spell: f.spell, by, on: personAt(f.on), size: f.size });
  };
  game.woreTitle = (id: string | null) => void island.wearTitle(id);
  /*
   * The two crafting settings. The island spends the stock, so it keeps a
   * copy on the body. A copy it already has wins -- it was set from some
   * browser, perhaps another one, and a setting that keeps rare stock safe
   * should not come undone because this browser never heard of it -- and a
   * body that has never been told is told what this browser has.
   */
  const toldStores = me.craft_from_stores;
  const toldRare = me.craft_spare_rare;
  if (typeof toldStores === 'boolean') game.settings.fromStores = toldStores;
  if (typeof toldRare === 'boolean') game.settings.spareRare = toldRare;
  game.craftPrefsChanged = () => void island.craftPrefs(game.settings.fromStores, game.settings.spareRare);
  if (typeof toldStores !== 'boolean' || typeof toldRare !== 'boolean') {
    void island.craftPrefs(game.settings.fromStores, game.settings.spareRare, true);
  }
  /*
   * And the two fighting ones, the same way round: the island lands the blows
   * and turns you on what bit you, so a copy it already has wins, and a body
   * that has never been told is told what this browser has.
   */
  const toldStance = me.fight_stance;
  const toldBack = me.fight_back;
  if (isFightStance(toldStance)) game.settings.fightStance = toldStance;
  if (typeof toldBack === 'boolean') game.settings.fightBack = toldBack;
  game.fightPrefsChanged = () => void island.fightPrefs(game.settings.fightStance, game.settings.fightBack);
  if (!isFightStance(toldStance) || typeof toldBack !== 'boolean') {
    void island.fightPrefs(game.settings.fightStance, game.settings.fightBack, true);
  }
  island.hooks.people = (people: PlayerRow[]) => {
    game.roster.sawAll(people
      .filter((p) => p.uid !== island.uid)
      .map((p) => ({
        id: hashId(p.uid), uid: p.uid, name: p.name, x: p.x, y: p.y, dirX: 0, dirY: 1,
        level: p.level, moving: false, swimming: false, working: !!p.act,
        act: p.act ?? undefined, look: cleanLook(p.look), gear: gearFrom(p.gear),
      })));
  };
  for (const [text, kind, at] of log) game.write(text, kind as Parameters<Game['write']>[1], at);
  game.write(`You are on ${info.name}. Send somebody this page's address and they can join you.`, 'system');
  game.write(
    account
      ? `You are signed in as ${account}.`
      : `You are playing as ${name}, which anybody could type. Settings (O) has a link to set up a name you can prove.`,
    'system',
  );
  tell('pack');
  await Promise.all([island.refreshPack(), island.refreshPeople()]);
  /*
   * The trees round you (`NEAR_REACH`), baked before the first frame rather than in it: begun as the land came
   * in, and waited for here up to `TREE_WAIT_MS`. A join that read no land (an island founded just now) begins
   * them here. The rest of the reach go on baking until the first frame.
   */
  onTrees = true;
  if (treesOf) tell('trees', 'near', treesDone, treesOf);
  else tell('trees');
  preloading ??= preloadTreesAt(world, me.x, me.y, island.time(), undefined, treeStep);
  await Promise.race([preloading.near, new Promise<void>((done) => setTimeout(done, TREE_WAIT_MS))]);
  // Joined: what goes wrong in this browser from now on, and anything that
  // already has, goes to the island to be written down.
  reportErrorsTo((r) => island.reportError(r));
  return { game, island, id };
}

/**
 * A uuid squeezed into the small number the roster files people under. The
 * roster is a drawing thing — it wants something to tell two bodies apart, not
 * something to look anybody up by, and it is never sent anywhere.
 */
function hashId(uid: string): number {
  let h = 2166136261;
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000000;
}

import { wornWire } from './game/worn';
import type { CastAt } from './game/events';
import { ALL_SPELL_IDS } from './render/spells/info';
import { dprCapOf, frameCapOf } from './game/settings';
import { onPhone } from './engine/device';
import { mountPhone } from './ui/phone';
import { FullscreenCanvas } from './engine/canvas';
import { Input } from './engine/input';
import { clockSteps, GameLoop } from './engine/loop';
import { partsMissing, piecesHeld, RELICS } from './game/archaeology';
import { cropSprite } from './render/sprites';
import { creatureLines, creatureSkills } from './ui/creatureinfo';
import { tameChance } from './game/creatureActions';
import { ACTIONS } from './game/actions';
import { FURNITURE } from './game/furniture';
import { MATERIALS } from './game/materials';
import { TRAITS } from './game/traits';
import { DYESTUFFS as DYES } from './game/dyestuffs';
import { WOUND_KINDS } from './game/wounds';
import { TRAPS } from './game/traps';
import { BRIDGES, bridgeDone } from './game/bridges';
import { BAITS, catchFish, FISH } from './game/fishing';
import { pointOfSail, sailWord, windAt, windFrom, windWord } from './game/wind';
import { favourCap, prayerWorth } from './game/faith';
import { PATHS, sittingWorth } from './game/meditation';
import { BELT_MAX, loopsFor } from './game/belt';
import { coaxBonus, COAX_LAPSE, COAX_STEP } from './game/creatures';
import { PER_ROLL, rollsAt } from './game/forage';
import { knackBonus, knackLands, KNACK_BONUS, KNACK_CAP, KNACK_HOME, KNACK_ODDS } from './game/titles';
import { boonOf, boonTime, BOON_BONUS } from './game/boons';
import { balance, fedness, NUTRIENTS, tableMul, upkeepMul } from './game/nutrition';
import { weaponDamage, WEAPON_BY_ID } from './game/gear';
import { SPECIES } from './game/creatures';
import { BAR_SLOTS } from './game/patrons';
import { TITLES } from './game/titles';
import { ITEM_DEFS, itemName } from './game/items';
import { RECIPES } from './game/recipes';
import { Game } from './game/game';
import { Keybinds } from './game/keybinds';
import { warmMasonry } from './render/masonry';
import { warmMeadow } from './render/meadow';
import { Renderer, skyWash, sunAt, type Pick } from './render/renderer';
import { Sound } from './audio/sound';
import { PUFFS, PUFF_LIFE, PUFF_RISE, puffAge, puffOf } from './render/smoke';
import { DUST_LIFE } from './render/dust';
import { FLOAT_LIFE, FLOAT_RISE, Floaters, MERGE_WINDOW } from './render/floaters';
import { HAZE_MAX, HAZE_REACH, skyAt, unknownInk } from './render/sky';
import { Asker } from './ui/ask';
import { UI } from './ui/ui';
import { dragging } from './ui/dragdrop';
// Debug surface only. These come last on purpose: main is the entry point, so
// the order of its imports is the order the module graph is evaluated in.
import { groundRoll, ROCK_VARIANTS, TILE_DEFS } from './world/tiles';
import { crateName } from './game/crates';
import { furnitureName } from './game/furniture';
import { trapName } from './game/traps';
import { postName } from './game/posts';
import { candleBurn, lanternReach } from './game/light';
import { METALS } from './game/metal';
import { lanternState } from './game/lantern';
import { smeltableIn } from './game/smelter';
import { bodyOf } from './net/session';
import { PROTOCOL, cleanName, cleanText, decode, encode } from './net/protocol';
import { packLand, packWorld, unpack } from './game/save';
import { smeltSeconds } from './game/metal';
import { needsIron } from './world/ore';
import { tileUses } from './ui/tileinfo';
import { startIsland } from './net/play';
import { watchErrors } from './net/errors';
import { mountSavingBanner } from './ui/saving';
import type { Island } from './net/island';
import { LOOK_TABLES, cleanLook, randomLook } from './game/look';
import { WORLD_PACE } from './game/pace';
import { CROPS } from './game/farming';
import { DAY_SECONDS } from './game/game';
import { TORCH_BURN } from './game/light';
import { findPath } from './world/pathfinding';
import { WATER_PALETTE, waterRgb } from './render/water';
import { drawHeadshot, drawPortrait } from './render/sprites';
import { followScreen, pageZoom, setUiSize, unzoomPage } from './ui/screen';
import { applyLook } from './ui/theme';

const canvasEl = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const params = new URLSearchParams(location.search);
// Raising a thousand-tile island holds the thread for a second or more, and
// nothing painted after that point is seen until it is done. Two frames of
// waiting is what it takes for the notice in the page to actually reach the
// screen first.
await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

/**
 * The island, which is the only game there is.
 *
 * With nothing in the address bar this asks the keeper which island it keeps
 * and comes ashore on it. `?island=<id>` goes to a particular one and `?found=`
 * rolls a small one. There is no single-player game and no offline fallback:
 * a keeper that cannot be reached, or that has no island on it yet, leaves the
 * boot card saying so with a Retry, and nothing else starts.
 */
/**
 * The boot screen, which says what it is doing and how long it has been at it.
 *
 * It used to be one line of text. That is fine while everything is quick and
 * is the whole problem when one step is not: a screenshot came back of
 * "catching up… 100%", which was a step that had *finished*, sitting there
 * while two later ones ran in silence. A percentage of an unknown total, and
 * no clock, and no way to tell a slow step from a dead page.
 *
 * So the bar is the steps, the line is the one it is on, the number beside it
 * is how long — appearing only once a step has taken long enough to wonder
 * about — and the list underneath is what it has already done and what each
 * cost. `total` of nought means counting up towards nobody knows what, which
 * is how the island's history is read; that shows the count instead of a
 * fraction, because a fraction would be made up.
 */
const boot = ((): { say: (text: string, at?: number, of?: number) => void; stop: () => void } => {
  const root = document.querySelector('#boot');
  const bar = root?.querySelector('.boot-bar i') as HTMLElement | null;
  const line = root?.querySelector('.boot-now span') as HTMLElement | null;
  const clock = root?.querySelector('.boot-now b') as HTMLElement | null;
  const past = root?.querySelector('.boot-done') as HTMLElement | null;
  let step = '';
  let since = performance.now();
  const secs = (): number => (performance.now() - since) / 1000;
  const tick = window.setInterval(() => {
    if (clock) clock.textContent = secs() < 0.8 ? '' : `${secs().toFixed(1)}s`;
  }, 100);
  return {
    say(text, at, of) {
      if (text !== step) {
        if (step && past) {
          const was = document.createElement('li');
          was.textContent = `${step} · ${secs().toFixed(1)}s`;
          past.append(was);
          // Four is enough to see where it has been without the card growing.
          while (past.children.length > 4) past.firstElementChild?.remove();
        }
        step = text;
        since = performance.now();
        if (clock) clock.textContent = '';
      }
      if (line) line.textContent = of === 0 && at ? `${text} — ${at.toLocaleString()}` : text;
      if (bar && of && of > 0 && at !== undefined) bar.style.width = `${Math.round((at / of) * 100)}%`;
    },
    stop() {
      window.clearInterval(tick);
    },
  };
})();
/** The keeper could not be reached, or keeps no island: said on the boot card, with a Retry. */
function cannotReach(why: string): void {
  const card = document.querySelector('#boot .boot-card');
  const line = card?.querySelector('.boot-now span');
  if (line) line.textContent = `Can't reach the island: ${why}`;
  const clock = card?.querySelector('.boot-now b');
  if (clock) clock.textContent = '';
  const again = document.createElement('button');
  again.className = 'boot-retry';
  again.textContent = 'Retry';
  again.addEventListener('click', () => location.reload());
  card?.append(again);
}
// Before anything that could throw: what goes wrong from here on is written down (see `errors.ts`).
watchErrors();
const tellBoot = (text: string, done?: number, total?: number): void => boot.say(text, done, total);
const started = await startIsland(params, tellBoot).catch((e: unknown) => {
  boot.stop();
  cannotReach(e instanceof Error ? e.message : 'The island keeper did not answer.');
  // Nothing past here runs without an island: the page stays on its Retry.
  return new Promise<never>(() => {});
});
const { island, game } = started;

const canvas = new FullscreenCanvas(canvasEl);
// The fast graphics, and Low power on a phone, draw a pixel for every screen pixel (`dprCapOf`); sized again whenever either changes.
const fitGraphics = (): void => {
  const most = dprCapOf(game.settings, onPhone());
  if (canvas.maxDpr !== most) {
    canvas.maxDpr = most;
    canvas.resize();
  }
};
fitGraphics();
game.graphicsChanged = fitGraphics;
game.measureDrawing = () => {
  game.settings.timings = true;
  renderer.timings.measure();
};
const renderer = new Renderer(canvas, game);
const camera = renderer.camera;
const input = new Input(canvasEl);
/** Screen pixels a second the view slides while a push key is held. */
const PAN_SPEED = 900;
/**
 * What the keys do. Read here and written by the Keys tab in Settings; kept in
 * `localStorage`, so it belongs to whoever is sitting here rather than to the
 * island they happen to have open.
 */
const keys = new Keybinds();
/** Turn the view an eighth (+1 or -1) and remember the choice in the save. */
function turnView(step: number): void {
  camera.turn(step, (x, y) => game.world.heightAt(x, y));
  game.settings.rotation = camera.rotation;
}

/*
 * The island's ear.
 *
 * It cannot start itself: a browser will not open an audio context until the
 * person sitting here has done something, and a page that tried would be
 * refused and stay refused. So it is armed off the first click or key, which
 * is a thing that happens in the first second of anybody playing.
 */
const sound = new Sound(game, camera);
for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(ev, () => sound.arm(), { passive: true });
}

const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: turnView, keys, island });
// A window or bar moved or resized against another clicks as they join.
ui.windows.onJoin = () => sound.join();
// The island can refuse to save: the banner says when it has.
mountSavingBanner(uiRoot);
// Coming back from the background, the screen kept on through a queue, and the keyboard (`src/ui/phone.ts`).
mountPhone(game, island, uiRoot);

/*
 * The game asks in its own words, on its own canvas.
 *
 * `window.prompt` and `window.confirm` are not dialogues on a phone: Chrome on
 * Android suppresses them in more cases than it documents, and once anybody
 * has dismissed one with "don't let this page create more dialogs" every later
 * call answers null and false, silently, for the rest of the session. A player
 * on the island got no box at all and a settlement called Homestead.
 */
const asker = new Asker(uiRoot);
game.hooks = {
  prompt: (question, fallback) => asker.name(question, fallback),
  confirm: (question) => asker.sure(question),
  choose: (question, choices) => asker.choose(question, choices),
  count: (question, most, fallback) => asker.count(question, most, fallback),
  note: (question, max) => asker.name(question, '', max),
};

const player = game.player;
camera.rotation = game.settings.rotation;
camera.focus(player.x, player.y, game.playerHeight(), null);

declare global {
  interface Window {
    /** Console handle for poking at the running game. */
    wurm: { game: Game; renderer: Renderer; camera: typeof camera; sound: Sound; ACTIONS: typeof ACTIONS; RECIPES: typeof RECIPES; FURNITURE: typeof FURNITURE; MATERIALS: typeof MATERIALS; RELICS: typeof RELICS; TRAITS: typeof TRAITS; TITLES: typeof TITLES; DYES: typeof DYES; WOUND_KINDS: typeof WOUND_KINDS; TRAPS: typeof TRAPS; BRIDGES: typeof BRIDGES; bridgeDone: typeof bridgeDone; BAITS: typeof BAITS; FISH_IDS: string[]; SPECIES: typeof SPECIES; WEAPON_BY_ID: typeof WEAPON_BY_ID; itemName: typeof itemName; arch: { partsMissing: typeof partsMissing; piecesHeld: typeof piecesHeld }; ui: UI; island: Island;
      /**
       * Play a spell's drawing from you at what is under the cursor, with no island (`Renderer.playSpell`): `from` as though
       * the island had moved you there from that spot, `companion` with that creature as your companion; and every spell id.
       */
      spell: (id: string, at?: CastAt, opts?: { from?: { x: number; y: number }; companion?: number }) => boolean; spells: readonly string[] };
  }
}
Object.assign(window as unknown as Record<string, unknown>, { catchFish, windAt, windFrom, windWord, pointOfSail, sailWord, favourCap, prayerWorth, PATHS, sittingWorth, weaponDamage, loopsFor, BELT_MAX, coaxBonus, COAX_STEP, COAX_LAPSE, rollsAt, PER_ROLL, cropSprite, creatureLines, tameChance, knackLands, knackBonus, KNACK_ODDS, KNACK_CAP, KNACK_BONUS, KNACK_HOME, boonTime, boonOf, BOON_BONUS, tableMul, upkeepMul, fedness, balance, NUTRIENTS, ITEM_DEFS, TILE_DEFS, groundRoll, crateName, furnitureName, trapName, postName, lanternReach, candleBurn, lanternState, sunAt, skyWash, puffAge, puffOf, PUFFS, PUFF_LIFE, PUFF_RISE, DUST_LIFE, FLOAT_LIFE, FLOAT_RISE, MERGE_WINDOW, Floaters, skyAt, unknownInk, findPath, WATER_PALETTE, waterRgb, CROPS, DAY_SECONDS, TORCH_BURN, WORLD_PACE, drawPortrait, drawHeadshot, LOOK_TABLES, cleanLook, randomLook, HAZE_MAX, HAZE_REACH, ROCK_VARIANTS, METALS, smeltableIn, smeltSeconds, needsIron, creatureSkills, tileUses, bodyOf, PROTOCOL, cleanName, cleanText, encode, decode, packLand, packWorld, unpack });
window.wurm = { game, renderer, camera, sound, ACTIONS, RECIPES, FURNITURE, MATERIALS, RELICS, TRAITS, TITLES, DYES, WOUND_KINDS, TRAPS, BRIDGES, bridgeDone, BAITS, FISH_IDS: FISH.map((f) => f.id), SPECIES, WEAPON_BY_ID, itemName, arch: { partsMissing, piecesHeld }, ui, island,
  spell: (id: string, at?: CastAt, opts?: { from?: { x: number; y: number }; companion?: number }) => renderer.playSpell(id, at, opts), spells: ALL_SPELL_IDS };

input.onClick = (x, y, button) => {
  // Something on its way to the ground takes the click: down it goes, or back into the pack.
  if (ui.placing) {
    ui.menu.hide();
    ui.placeClick(renderer.pick(x, y), button);
    return;
  }
  // A press that closed an open menu is spent, unless it is asking for a new menu.
  if (ui.menu.consumeSwallow() && button !== 2) return;
  ui.menu.hide();
  const pick = renderer.pick(x, y);
  if (!pick) return;
  if (button === 0) {
    /*
     * A click on something that is after you, or the kind that hunts on
     * sight, is a fight rather than a walk: it is marked and gone for
     * (`engage`). Anything else wild that is clicked is marked, for the key
     * that attacks, and walked to as any click is.
     */
    const beast = pick.creature !== undefined ? game.creatures.get(pick.creature) : undefined;
    if (beast?.mode === 'wild') game.marked = beast.id;
    if (beast && game.hostile(beast)) {
      game.engage(beast.id);
      ui.selectTile(pick);
      return;
    }
    // A left click both walks you there and chooses the tile, so the tile
    // window follows wherever you are looking.
    game.moveTo(pick.x, pick.y);
    ui.selectTile(pick);
  } else if (button === 2) {
    ui.selectTile(pick);
    ui.showTileMenu(pick, x, y);
  }
};

/*
 * Something dragged out of the pack and let go over a crate, a chest, a cart --
 * anything standing in the world that holds things -- goes into it.
 *
 * The browser's own drag and drop holds pointer events back while it lasts, so
 * the frame loop below cannot see where the cursor is. What is under it is
 * asked here, of the drag itself, and kept for the loop to outline.
 */
let dropOver: { pick: Pick; x: number; y: number } | null = null;
canvasEl.addEventListener('dragover', (e) => {
  const carried = dragging();
  if (!carried || carried.from !== 'inventory') return;
  const pick = renderer.pick(e.clientX, e.clientY);
  dropOver = pick && ui.storeAt(pick) ? { pick, x: e.clientX, y: e.clientY } : null;
  if (!dropOver) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
});
canvasEl.addEventListener('dragleave', () => (dropOver = null));
window.addEventListener('dragend', () => (dropOver = null));
canvasEl.addEventListener('drop', (e) => {
  const carried = dragging();
  dropOver = null;
  if (carried && ui.dropOnWorld(carried, renderer.pick(e.clientX, e.clientY))) e.preventDefault();
});

input.onDrag = (dx, dy, button) => {
  if (button === 0 || button === 1) camera.panBy(dx, dy);
};

input.onWheel = (delta, x, y) => {
  camera.zoomAt(x, y, Math.exp(-delta * 0.0012));
};

input.onPinch = (factor, x, y) => {
  camera.zoomAt(x, y, factor);
};

/**
 * One press, looked up rather than hard-coded.
 *
 * Every entry in this table is a row in Settings → Keys. The digits are not:
 * they are ten of a kind, answering to whatever the selection window or the
 * toolbelt is offering, and they stay where they are.
 */
const PRESSES: Record<string, () => void> = {
  centre: () => {
    game.settings.follow = true;
    camera.follow = true;
  },
  // While something is being set down, the turn keys turn that instead of the view.
  turn_left: () => (ui.placing ? ui.rotatePlacing(-1) : turnView(-1)),
  turn_right: () => (ui.placing ? ui.rotatePlacing(1) : turnView(1)),
  zoom_in: () => camera.zoomAt(canvas.width / 2, canvas.height / 2, 1.25),
  zoom_out: () => camera.zoomAt(canvas.width / 2, canvas.height / 2, 0.8),
  storey_up: () => ui.hud.stepStorey(1),
  storey_down: () => ui.hud.stepStorey(-1),
  cutaway: () => ui.hud.toggleCutaway(),
  grid: () => (game.settings.grid = !game.settings.grid),
  win_inventory: () => ui.toggleWindow('inventory'),
  win_craft: () => ui.toggleWindow('craft'),
  win_tile: () => ui.toggleWindow('tile'),
  win_skills: () => ui.toggleWindow('skills'),
  win_trades: () => ui.toggleWindow('trades'),
  win_faith: () => ui.toggleWindow('faith'),
  win_tracker: () => ui.toggleJournal('tracker'),
  win_events: () => ui.toggleWindow('events'),
  win_map: () => ui.toggleWindow('map'),
  win_wildermon: () => ui.toggleWindow('wildermon'),
  win_guide: () => ui.toggleJournal('guide'),
  win_deed: () => ui.toggleWindow('deed'),
  win_ledger: () => ui.toggleJournal('ledger'),
  win_stores: () => ui.toggleWindow('stores'),
  win_journal: () => ui.toggleJournal('goals'),
  win_market: () => ui.toggleWindow('market'),
  // Bound to Y and listed under Windows since the Social window came, and never pressed here.
  win_social: () => ui.toggleWindow('social'),
  win_boards: () => ui.toggleJournal('boards'),
  // Nothing, for anybody who does not keep the island: they have no such window.
  win_keeper: () => ui.toggleWindow('keeper'),
  win_settings: () => ui.toggleWindow('settings'),
  win_help: () => ui.toggleJournal('help'),
  win_news: () => ui.toggleJournal('news'),
  walk_home: () => game.walkHome(),
  carry_on: () => {
    if (!game.resumeQueue()) game.logMsg('There is nothing waiting to be taken up.', 'info');
  },
  repeat: () => game.repeatLast(),
  emotes: () => ui.showEmotes(),
  stop: () => {
    if (ui.menu.isOpen) ui.menu.hide();
    // Before the job and before the feet: Escape while walking after somebody
    // has to mean "stop following", or it stops the walk and the next tick
    // starts it again.
    else if (game.following()) game.unfollow('You stop following.');
    else if (game.action) {
      ui.notices.hush();
      game.cancelAction();
    }
    else player.stop();
  },
  chat: () => ui.focusChat(),
  fight_mark: () => game.markNext(),
  fight: () => game.fightMarked(),
  fight_stance: () => game.cycleStance(),
  pet_attack: () => game.orderAttack(),
  pet_back: () => game.orderHeel(),
  palette: () => ui.openPalette(),
};
// What each key does, for Find anything to offer by name.
ui.presses = PRESSES;

input.onKey = (code, ev) => {
  /*
   * A key the Keys tab is listening for never reaches the game — and never
   * reaches the browser either. Binding F1 must not open the browser's help,
   * and binding Tab must not walk the focus out of the window.
   */
  if (ui.grabKey(code)) {
    ev.preventDefault();
    return;
  }
  // Ctrl+K, and ⌘K on a Mac: Find anything, as most programs have it.
  if ((ev.ctrlKey || ev.metaKey) && code === 'KeyK') {
    ev.preventDefault();
    ui.openPalette();
    return;
  }
  if (code === 'Escape' && ui.placing) {
    ui.cancelPlacing();
    return;
  }
  // The number keys: the selection window when it is looking at something,
  // and the loops on a worn toolbelt otherwise. 0 is the tenth of either.
  const digit = /^Digit([0-9])$/.exec(code);
  // Shift and a number is a slot of the spell bar, which has no zero.
  if (digit && ev.shiftKey && Number(digit[1]) >= 1 && Number(digit[1]) <= BAR_SLOTS) {
    ui.castSpell(Number(digit[1]) - 1);
    return;
  }
  if (digit) {
    ui.pressNumber((Number(digit[1]) + 9) % 10);
    return;
  }
  const id = keys.actionFor(code);
  if (!id) return;
  // Tab bound to something is that thing, not a walk of the focus round the page;
  // F6 is not the address bar, and / is not the browser's quick find nor a / typed into the box it opens.
  if (code === 'Tab' || code === 'Slash' || /^F\d+$/.test(code)) ev.preventDefault();
  // A window layout: Shift keeps the windows as they are in it, the key alone puts them back.
  const layout = /^layout_(\d+)$/.exec(id);
  if (layout) {
    ui.layout(Number(layout[1]) - 1, ev.shiftKey);
    return;
  }
  const press = PRESSES[id];
  if (press) press();
  // A window with no press of its own opens by its name: Health, Equipment and the shopping list had keys that did nothing.
  else if (id.startsWith('win_')) ui.toggleWindow(id.slice(4));
};

const loop = new GameLoop(
  (dt) => {
    /*
     * The keys push the view, and nothing else moves you: walking is a click,
     * and a click is the only thing that walks.
     *
     * These are screen directions and stay screen directions — unlike the
     * walking they replaced, which had to be turned back into world directions
     * because the body moves through the world and the camera does not.
     */
    const held = (id: string): boolean => keys.isHeld(id, (c) => input.isDown(c));
    let px = 0;
    let py = 0;
    if (held('pan_up')) py += 1;
    if (held('pan_down')) py -= 1;
    if (held('pan_left')) px += 1;
    if (held('pan_right')) px -= 1;
    if ((px !== 0 || py !== 0) && !input.isTyping()) {
      // Diagonals go the same speed as the straights. `panBy` takes screen
      // pixels and divides by the zoom itself, so the view slides at the same
      // rate under the eye however far out it is — and it lets the camera off
      // following, exactly as a drag does.
      const len = Math.hypot(px, py);
      const step = PAN_SPEED * dt;
      camera.panBy((px / len) * step, (py / len) * step);
    }

    // The whole of the frame's wall time, a tenth of a second at a time (`clockSteps`).
    for (const step of clockSteps(dt)) game.update(step);

    // Where we have walked to, told rarely and never twice for standing still, with the turns of the path
    // walked since: the island believes it only as far as its own clock allows, and walks it leg by leg.
    if (island) void island.move(player.x, player.y, player.level, performance.now() / 1000, wornWire((slot) => game.worn(slot)), game.atStairs(), player.takeTurns());

    /*
     * The view at the screen edge. Resting the cursor in the outer band slides
     * the camera that way, harder the closer to the edge, and stops the camera
     * following you while it does: it is a way of looking about without having
     * to hold the mouse down.
     */
    if (game.settings.edgePan && input.pointer.overCanvas && !input.dragging && !ui.menu.isOpen) {
      const band = Math.max(24, Math.min(64, Math.min(canvas.width, canvas.height) * 0.06));
      const push = (v: number, size: number): number => (v < band ? (v - band) / band : v > size - band ? (v - (size - band)) / band : 0);
      const px = push(input.pointer.x, canvas.width);
      const py = push(input.pointer.y, canvas.height);
      if (px !== 0 || py !== 0) {
        const speed = 900 * dt;
        camera.panBy(-px * speed, -py * speed);
      }
    }

    // The camera keeps to you unless it has been dragged off, or told not to.
    if (game.settings.follow && camera.follow) {
      camera.focus(player.x, player.y, Math.max(-4, game.playerHeight()), dt);
    }

    sound.step();

    if (dropOver) {
      renderer.hover = dropOver.pick;
      ui.setHover(dropOver.pick, dropOver.x, dropOver.y);
      ui.syncGhost(null);
    } else if (input.pointer.overCanvas && !input.dragging && !ui.menu.isOpen) {
      renderer.hover = renderer.hoverPick(input.pointer.x, input.pointer.y);
      ui.setHover(renderer.hover, input.pointer.x, input.pointer.y);
      ui.syncGhost(renderer.hover);
    } else {
      renderer.hover = null;
      renderer.forgetPick();
      ui.setHover(null, 0, 0);
      ui.syncGhost(null);
    }
  },
  (dt) => {
    renderer.render(dt);
    ui.update(loop.fps);
    loop.maxFps = frameCapOf(game.settings, onPhone());
  },
);
loop.start();
// Nothing drawn while the page is out of sight, and started again, from a fresh clock, when it is back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});
// The island is up and the first frame is drawn; the notice can go.
/*
 * Keep the interface on the screen it is actually on.
 *
 * Not the page: on a phone those are different boxes. A browser rendering a
 * desktop layout gives the page nine hundred pixels and shrinks the lot onto
 * four hundred of glass, and zooming in to read it leaves everything `fixed`
 * off the side. `src/ui/screen.ts` has the whole of the reasoning; this is
 * where it is turned on, along with the way back from a zoom — which the game
 * itself has to offer, because the canvas takes a pinch and zooms the island.
 */
const zoomOut = document.createElement('button');
zoomOut.className = 'zoom-out';
zoomOut.type = 'button';
zoomOut.textContent = 'Fit the screen';
zoomOut.title = 'Put the page back to its own size';
zoomOut.hidden = true;
zoomOut.addEventListener('click', () => unzoomPage());
uiRoot.append(zoomOut);
// At the size asked for, from the first fit, rather than at 100% for a frame.
setUiSize(game.settings.uiSize);
// The interface's look before the first frame, so it does not open in one look and change to another.
applyLook(game.settings, game.isNight());
followScreen(uiRoot, () => {
  zoomOut.hidden = pageZoom() <= 1.02;
  // The box the windows live in has just changed, and `resize` did not fire:
  // a pinch moves it, and so does a browser laying the page out for a desktop.
  ui.windows.clampAll();
});

boot.stop();
document.getElementById('boot')?.remove();

// The cobblestone painted before it is needed: a wall of it coming into view should not be the thing that pays for drawing it.
warmMasonry();
warmMeadow();
/*
 * Three ways out of a page, and the last of them is the only one a phone
 * reliably gives you.
 *
 * Almost everything about an island body is already written down in Postgres
 * and there is nothing to put away on the way out. The fog of war is the
 * exception: only the tab knows what its camera has covered, so it is handed
 * over on a slow beat while playing and once more here, which is what catches
 * the last three quarters of a minute of walking.
 */
const onExit = (): void => island.fogOnExit();
window.addEventListener('beforeunload', onExit);
window.addEventListener('pagehide', onExit);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) onExit();
});

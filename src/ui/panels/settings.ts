import { AUTO_EAT_AT } from '../../game/autoeat';
import { HEAL_FED } from '../../game/body';
import { ROT_LOOK, ROT_SOON } from '../../game/rot';
import { DAMAGE_MAX, DAMAGE_WARN, NIGHT_ENDS, NIGHT_STARTS, type Game } from '../../game/game';
import { applyLook, islandTime, LOCAL_NIGHT_ENDS, LOCAL_NIGHT_STARTS } from '../theme';
import { BINDS, BIND_GROUPS, keyName, keyReserved, MAX_KEYS, type Keybinds } from '../../game/keybinds';
import { whoAmI } from '../../net/accounts';
import { RARITIES } from '../../game/items';
import { CRAFT_REACH } from '../../game/recipes';
import { FIGHT_BACK_STILL, FIGHT_QUIET } from '../../game/fight';
import { LAYOUT_SLOTS, type UIWindow, type WindowManager } from '../windows';
import { esc } from '../esc';
import { setUiSize, UI_SIZE_MAX, UI_SIZE_MIN, uiSizeShown } from '../screen';
import { FAST_DPR, FRAME_CAPS, FULL_DPR, LOW_POWER_FPS, type UiColours, type UiFrames, type UiLight, type UiStyle } from '../../game/settings';
import { FRAME_REACH, FRAME_REACHES, FRAME_RIM, FRAMES, frameLabel, frameOddities, RIM, RIMS } from '../runecut-art';
import { lifeWords } from '../runecut-life';
import { LAYERS, TIMING_WINDOW, TRIAL_SECONDS } from '../../render/timings';
import { listed, percent } from '../../game/words';
import { DONE_AFTER, NOTICE_MS } from '../notices';
import { RING_FADE_MS } from '../pointerring';
import { BANNER_AGAIN, BANNER_DEPTH, BANNER_MS, LEAVING_MS } from '../deedbanner';
import { RING_REACH, THREAT_SHADE, THREAT_SHADE_HUNTING } from '../../render/renderer';
import { FIRE_CAPACITY, fireBurnsFor, type PlacedCampfire } from '../../game/campfire';
import { keepControlKeys } from '../controlkeys';
import { onPhone } from '../../engine/device';
import { fullscreenOffered, isFullscreen, setFullscreen, wakeOffered } from '../phone';

interface Toggle {
  input: HTMLInputElement;
  read: () => boolean;
}

/**
 * Two tabs: what the island looks like, and what the keys do.
 *
 * The keys half is the only part of the UI that has to *stop* being the game
 * for a moment — while it is listening for a key, every press belongs to it and
 * none of them reach `main`. `grabbing` is that moment, and `grab()` is how the
 * key handler asks whether this press is one of the game's or not.
 */
export class SettingsPanel {
  private toggles: Toggle[] = [];
  private tabs = new Map<string, HTMLButtonElement>();
  private pages = new Map<string, HTMLDivElement>();
  private tab = 'display';
  /** The slot waiting for a key, and the button showing that it is waiting. */
  private grabbing: { id: string; slot: number; btn: HTMLButtonElement } | null = null;
  private note: HTMLParagraphElement;
  private keyRows = new Map<string, HTMLButtonElement[]>();
  /** Rows for a keeper of the island alone, hidden until the island says this body is one. */
  private keeperRows: HTMLDivElement[] = [];
  /** The window layouts' rows: the name, Use, and the key that does the same. */
  private layoutRows: Array<{ name: HTMLInputElement; use: HTMLButtonElement; key: HTMLElement }> = [];
  /** The see-through switches, one a window that can be made see-through. */
  private seeRows: Array<{ input: HTMLInputElement; win: UIWindow }> = [];

  constructor(
    win: UIWindow,
    game: Game,
    private readonly keys: Keybinds,
    openLook: (() => void) | null,
    private readonly windows: WindowManager,
  ) {
    win.body.classList.add('settings-body');
    // A slot waiting for a key takes Tab, Enter and Space as keys to bind.
    keepControlKeys(win.body, 'button, select, summary, input[type="checkbox"]', () => this.grabbing !== null);
    const bar = document.createElement('div');
    bar.className = 'log-tabs';
    for (const [id, label, title] of [
      ['display', 'Display', 'Graphics and interface'],
      ['windows', 'Windows', 'Window layouts and see-through windows'],
      ['keys', 'Keys', 'Key bindings'],
    ] as Array<[string, string, string]>) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb-btn tb-small log-tab' + (id === this.tab ? ' tb-on' : '');
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', () => this.show(id));
      this.tabs.set(id, b);
      bar.append(b);
    }
    win.body.append(bar);

    const display = document.createElement('div');
    display.className = 'settings-page';
    const keyPage = document.createElement('div');
    keyPage.className = 'settings-page keys-page';
    keyPage.hidden = true;
    const winPage = document.createElement('div');
    winPage.className = 'settings-page';
    winPage.hidden = true;
    this.pages.set('display', display);
    this.pages.set('windows', winPage);
    this.pages.set('keys', keyPage);
    win.body.append(display, winPage, keyPage);
    this.buildWindows(winPage);

    const add = (label: string, hint: string, read: () => boolean, write: (v: boolean) => void): HTMLLabelElement => {
      const row = document.createElement('label');
      row.className = 'setting-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = read();
      input.addEventListener('change', () => write(input.checked));
      const text = document.createElement('span');
      text.innerHTML = `<b>${label}</b><small>${hint}</small>`;
      row.append(input, text);
      display.append(row);
      this.toggles.push({ input, read });
      return row;
    };
    /** A heading over the run of rows after it on the Display tab. */
    const head = (text: string): void => {
      const h = document.createElement('h4');
      h.className = 'keys-group';
      h.textContent = text;
      display.append(h);
    };
    head('Sound');
    /**
     * The one setting here that is not a yes or a no.
     *
     * It sits at the top because it is the one somebody reaches for in a
     * hurry — the island has only just learned to make a noise at all, and
     * the first thing anybody wants from a game that has started making one
     * is the means to stop it.
     */
    {
      const row = document.createElement('label');
      row.className = 'setting-row setting-pick';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '5';
      input.value = String(Math.round(game.settings.volume * 100));
      const text = document.createElement('span');
      const say = (): void => {
        const pc = Math.round(game.settings.volume * 100);
        text.innerHTML = `<b>Volume &mdash; ${pc === 0 ? 'silent' : `${pc}%`}</b><small>Sound effects volume. Panned by screen side; quieter with distance from the centre.</small>`;
      };
      say();
      input.addEventListener('input', () => {
        game.settings.volume = Number(input.value) / 100;
        say();
      });
      row.append(input, text);
      display.append(row);
    }
    /*
     * How big the interface is drawn: "Text and window size. There's no
     * setting for it, and that matters on a phone."
     *
     * Put on when the slider is let go rather than while it moves, because
     * this window is part of what it scales: resized under the pointer, the
     * slider would slide out from under the drag that is setting it. The
     * number in the caption follows the drag, so you can see where you are.
     */
    head('Interface');
    {
      const row = document.createElement('label');
      row.className = 'setting-row setting-pick';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(Math.round(UI_SIZE_MIN * 100));
      input.max = String(Math.round(UI_SIZE_MAX * 100));
      input.step = '10';
      input.value = String(Math.round(game.settings.uiSize * 100));
      const text = document.createElement('span');
      const say = (): void => {
        const asked = Number(input.value);
        const put = Math.round(game.settings.uiSize * 100);
        const shown = Math.round(uiSizeShown() * 100);
        // Only once it has been put on, and only if the screen held it back.
        const held = asked === put && shown < put ? ` Max on this screen: ${shown}%.` : '';
        text.innerHTML = `<b>Text and window size &mdash; ${asked}%</b><small>Scale of all windows, menus, bars and text. World not scaled (zoom: mouse wheel or pinch).${held}</small>`;
      };
      say();
      input.addEventListener('input', say);
      input.addEventListener('change', () => {
        game.settings.uiSize = Number(input.value) / 100;
        setUiSize(game.settings.uiSize);
        say();
      });
      row.append(input, text);
      display.append(row);
    }
    /*
     * How hard the screen is worked: a choice of two rather than a yes or no,
     * so a list rather than a tick box. Every figure in the words comes from
     * the setting itself.
     */
    const choose = <T extends string | number>(label: string, hint: string, options: Array<[T, string]>, read: () => T, write: (v: T) => void): void => {
      const row = document.createElement('label');
      row.className = 'setting-row setting-pick';
      const select = document.createElement('select');
      for (const [value, name] of options) {
        const o = document.createElement('option');
        o.value = String(value);
        o.textContent = name;
        select.append(o);
      }
      select.value = String(read());
      select.addEventListener('change', () => write(options.find(([v]) => String(v) === select.value)![0]));
      const text = document.createElement('span');
      text.innerHTML = `<b>${label}</b><small>${hint}</small>`;
      row.append(select, text);
      display.append(row);
    };
    /*
     * The interface's look, and Runecut's light. Both take effect at once:
     * they are two attributes on the page (`src/ui/theme.ts`).
     */
    const relook = (): void => applyLook(game.settings, game.isNight());
    choose<UiStyle>(
      'Interface look',
      'Runecut: pale carved stone, dark text, window rune in the title, Alegreya Sans 14 px. '
        + 'Classic: dark panels, pale text, system font 13 px.',
      [['runecut', 'Runecut'], ['classic', 'Classic']],
      () => game.settings.uiStyle,
      (v) => {
        game.settings.uiStyle = v;
        relook();
      },
    );
    choose<UiLight>(
      'Runecut light',
      'Day: pale stone, dark text. Night: dark stone, pale text, front window rune glows. '
        + `Island clock: night ${islandTime(NIGHT_STARTS)}–${islandTime(NIGHT_ENDS)} island time. `
        + `Computer clock: night ${islandTime(LOCAL_NIGHT_STARTS)}–${islandTime(LOCAL_NIGHT_ENDS)} local time. `
        + 'Always day / Always night: fixed. Frame life follows the same night. Runecut only.',
      [['clock', 'Island clock'], ['local', "My computer's clock"], ['day', 'Always day'], ['night', 'Always night']],
      () => game.settings.uiLight,
      (v) => {
        game.settings.uiLight = v;
        relook();
      },
    );
    // The colours that carry a meaning (`data-cb` in src/style.css); every place also has a mark that is not a colour, whichever is chosen.
    choose<UiColours>(
      'Colours',
      'Recolours meaningful colours only (Runecut, Classic, world). '
        + 'Red-green safe (deuteranopia, protanopia): good blue, bad vermilion, warning yellow. '
        + 'Blue-yellow safe (tritanopia): good teal, bad crimson, warning amber. '
        + 'Every coloured meaning also has a non-colour mark.'
        + '<details class="setting-more"><summary>Where, and each mark</summary><ul>'
        + '<li>Compare card better/worse: ▲ / ▼ before the difference.</li>'
        + '<li>Wildermon trait figures: ▲ gain, ▼ loss.</li>'
        + '<li>Crafting: ✓ have, ✗ lack.</li>'
        + '<li>Target panel: Easy / Even / Hard before the blow counts; ⚠︎ before a heavy blow.</li>'
        + '<li>Status effects: buffs round, left; debuffs square, right.</li>'
        + '<li>Overloaded: ⚠︎ on the pack weight line; load bar striped past the limit, cross-hatched past the max.</li>'
        + '<li>Irreversible buttons (leave, disband, …): striped foot.</li>'
        + '<li>Four bars, named: red-green safe, Health vermilion, Stamina yellow, Food purple, Water blue; '
        + 'blue-yellow safe, Health crimson, Stamina amber, Food green, Water dark blue.</li>'
        + '<li>World: creature health bar (also length), heavy-blow ring and !, '
        + 'edge arrows for threats (also shape), screen edge when struck, '
        + 'health lost (also its −).</li>'
        + '</ul></details>',
      [['standard', 'Standard'], ['rg', 'Red–green safe'], ['by', 'Blue–yellow safe']],
      () => game.settings.uiColours,
      (v) => {
        game.settings.uiColours = v;
        relook();
      },
    );
    {
      const framed = FRAMES.reduce((n, f) => n + f.for.length, 0);
      const of = (id: string): string => frameLabel(id).toLowerCase();
      choose<UiFrames>(
        'Window frames',
        `Runecut only. Themed: border matches window content, ${FRAMES.length} kinds over ${framed} windows and bars: `
          + `pack: ${of('inventory')}; crate or stores: ${of('crate')}; crafting: ${of('craft')}; events: ${of('events')}; map: ${of('map')} with compass rose. `
          + 'Others: plain stone. Stone: plain rim everywhere. Inner space unchanged.'
          + '<details class="setting-more"><summary>Border widths and overhangs</summary>'
          + `Border: ${RIM} px (${frameOddities(FRAME_RIM)} themed; phone ${RIMS.phone}, status panel ${RIMS.hud}, toolbar ${RIMS.toolbar}). `
          + `Knobs, knots, seals: up to ${FRAME_REACH} px past the edge (${frameOddities(FRAME_REACHES)}); click-through.</details>`,
        [['themed', 'Themed'], ['stone', 'Stone']],
        () => game.settings.uiFrames,
        (v) => {
          game.settings.uiFrames = v;
          relook();
        },
      );
    }
    add(
      'Frame life',
      'Animated animals and lights on window frames; never over window content; click-through. '
        + 'Runecut themed frames only; off on phones, with Fast graphics, or with reduced motion.'
        + `<details class="setting-more"><summary>Per frame</summary><ul>${lifeWords().split('; ').map((w) => `<li>${w}</li>`).join('')}</ul></details>`,
      () => game.settings.uiLife,
      (v) => (game.settings.uiLife = v),
    );
    // The job in hand at the pointer (src/ui/pointerring.ts), and a settlement's name at its border (src/ui/deedbanner.ts).
    add(
      'Progress ring at the pointer',
      'Ring at the pointer: fills clockwise with current action progress (as the action bar); '
        + `in combat, once per swing or draw. Fades over ${RING_FADE_MS / 1000} s when done. `
        + 'Only over the world; not over windows, bars or menus, nor on touch screens.',
      () => game.settings.pointerRing,
      (v) => (game.settings.pointerRing = v),
    );
    add(
      'Settlement names at the border',
      `Settlement name at screen top for ${BANNER_MS / 1000} s, ${BANNER_DEPTH} tile${BANNER_DEPTH === 1 ? '' : 's'} inside its border, `
        + 'with your rank (citizen) or its founder (otherwise); '
        + `"Leaving" for ${LEAVING_MS / 1000} s, ${BANNER_DEPTH} tile${BANNER_DEPTH === 1 ? '' : 's'} outside. `
        + `Not shown on re-entry within ${BANNER_AGAIN} s.`,
      () => game.settings.deedBanner,
      (v) => (game.settings.deedBanner = v),
    );
    add(
      'Players logging on and off',
      `Name at screen top: ${BANNER_MS / 1000} s on logging on, ${LEAVING_MS / 1000} s on logging off. `
        + 'The line in Talk either way.',
      () => game.settings.presenceBanner,
      (v) => (game.settings.presenceBanner = v),
    );
    head('Performance');
    choose<'full' | 'fast'>(
      'Graphics',
      `Fast: ${FAST_DPR} pixel per screen pixel on high-density screens (Full: up to ${FULL_DPR}), `
        + `${Math.round((1 - (FAST_DPR / FULL_DPR) ** 2) * 100)}% fewer pixels at ${FULL_DPR}×; no sea swell, `
        + 'distance haze, butterflies, dragonflies, fireflies, petals, falling leaves or frame life.',
      [['full', 'Full'], ['fast', 'Fast']],
      () => game.settings.graphics,
      (v) => {
        game.settings.graphics = v;
        game.graphicsChanged?.();
      },
    );
    choose<number>(
      'Frame rate limit',
      `Max frames per second. No limit: one frame per screen refresh, even above ${FRAME_CAPS[1]} Hz (more cost, same look).`,
      FRAME_CAPS.map((n): [number, string] => [n, n === 0 ? 'No limit' : `${n}/s`]),
      () => game.settings.frameCap,
      (v) => (game.settings.frameCap = v),
    );
    add(
      'Show drawing times',
      `Under the frame rate: frame time and ms per layer (ground, ${listed(Object.keys(LAYERS))}), `
        + `averaged over ${TIMING_WINDOW * 1000} ms. Frame time far above draw time: GPU-bound.`,
      () => game.settings.timings,
      (v) => (game.settings.timings = v),
    );
    {
      const row = document.createElement('div');
      row.className = 'setting-row setting-look';
      const text = document.createElement('span');
      text.innerHTML = `<b>Measure each layer</b><small>Hides each of ${listed(Object.keys(LAYERS))} for ${TRIAL_SECONDS} s in turn `
        + `(${(Object.keys(LAYERS).length + 2) * TRIAL_SECONDS} s total); shows frames per second without each under the frame rate. `
        + 'Close this window first.</small>';
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'tb-btn tb-small';
      go.textContent = 'Measure';
      go.addEventListener('click', () => game.measureDrawing?.());
      row.append(text, go);
      display.append(row);
    }
    // A phone's alone (`src/ui/phone.ts`): not shown on a desktop, and each only where the browser can do it.
    if (onPhone()) {
      head('Phone');
      if (fullscreenOffered()) {
        add('Fullscreen', 'No address or navigation bars.', isFullscreen, (v) => void setFullscreen(v));
      }
      if (wakeOffered()) {
        add('Keep screen on while working', 'While an action runs or one is queued.',
          () => game.settings.keepAwake, (v) => (game.settings.keepAwake = v));
      }
      add(
        'Low power',
        `Frame limit ${LOW_POWER_FPS}/s; Fast graphics (${FAST_DPR} pixel per screen pixel, no sea swell, haze or small life); no wakes or dust. `
          + 'Overrides Graphics and a higher frame limit.',
        () => game.settings.lowPower,
        (v) => {
          game.settings.lowPower = v;
          game.graphicsChanged?.();
        },
      );
    }
    head('World view');
    add('Show tile grid', 'Tile outlines. Toggle: G.', () => game.settings.grid, (v) => (game.settings.grid = v));
    add(
      'Show the first-steps card',
      'Next-step card above the action bar while the first journal chapter is unfinished. Hidden once your settlement is founded.',
      () => game.settings.guide,
      (v) => (game.settings.guide = v),
    );
    add(
      'Cut away walls facing you',
      'Hide walls between you and building interiors. Toggle: X or ◪.',
      () => game.settings.cutaway,
      (v) => (game.settings.cutaway = v),
    );
    add(
      'Fog of war',
      'Hide unexplored land; show out-of-sight ground as last seen. Off: whole world shown, all creatures simulated.',
      () => game.settings.fog,
      (v) => {
        game.settings.fog = v;
        game.vision.invalidate();
      },
    );
    add(
      'Open the tile window on a click',
      'Click a tile: its actions in the Tile window (T). Off: right-click menu only.',
      () => game.settings.tileWindow,
      (v) => (game.settings.tileWindow = v),
    );
    add(
      'Keep the camera on you',
      'Camera follows you. Moving it by keys or drag pauses this; C or Centre resumes. Off: camera stays put.',
      () => game.settings.follow,
      (v) => (game.settings.follow = v),
    );
    add(
      'Push the view at the screen edge',
      'Cursor at the screen edge pans the view; faster nearer the edge. Off: drag only.',
      () => game.settings.edgePan,
      (v) => (game.settings.edgePan = v),
    );
    add(
      'Always show settlement border',
      'Settlement border always shown. Off: only while pointing at the totem.',
      () => game.settings.deedBorder,
      (v) => (game.settings.deedBorder = v),
    );
    add('Mark hostile creatures',
      `Aggressive creatures and any creature hunting you: red overlay through trees and buildings, ${percent(THREAT_SHADE)} strength (${percent(THREAT_SHADE_HUNTING)} while hunting you), red marker overhead (pulsing while hunting you).`,
      () => game.settings.markThreats, (v) => (game.settings.markThreats = v));
    add('Rings over fires, smelters and kilns', `Within ${RING_REACH} tiles: outer ring fuel (full at ${fireBurnsFor({ fuel: FIRE_CAPACITY } as PlacedCampfire)} of burning; orange lit, grey cold); inner ring front item progress; gold dot when something is done.`,
      () => game.settings.stationRings, (v) => (game.settings.stationRings = v));

    /*
     * What a craft may take. "A toggle in settings for allowing or
     * disallowing crafting from nearby containers", and "another setting that
     * disallows the automatic use of any rare material in crafting". Both
     * reach the island as well (`craftPrefsChanged`), which is where a job's
     * stock is spent.
     */
    head('Crafting');
    const rareNames = RARITIES.slice(1).map((r) => r.name);
    const rareWords = `${rareNames.slice(0, -1).join(', ')} or ${rareNames[rareNames.length - 1]}`;
    add(
      'Use stores within reach',
      `Crafting and station work: pack, then bags, then crates, furniture and vehicles within ${CRAFT_REACH} tiles. Building (wall, floor, frame, bridge, aqueduct): pack, then a crate on the tile, then those stores. Off: pack and bags only (plus a crate on the tile when building).`,
      () => game.settings.fromStores,
      (v) => {
        game.settings.fromStores = v;
        game.craftPrefsChanged?.();
      },
    );
    add(
      'Keep rare materials out of crafting',
      `Crafting never auto-picks a ${rareWords} stack. Still used when chosen: right-click the stack, or pick it from a station menu.`,
      () => game.settings.spareRare,
      (v) => {
        game.settings.spareRare = v;
        game.craftPrefsChanged?.();
      },
    );

    /*
     * Fighting: whether a bite turns you on what bit you. Kept on the island as
     * well (`fightPrefsChanged`), which is where the bite lands.
     */
    head('Fighting');
    add(
      'Turn on what bites you',
      `Bitten after standing still ${FIGHT_BACK_STILL} s: fight back until it dies or leaves reach; current action waits at the front of the action queue. Not while walking. Off: fight only what you attack.`,
      () => game.settings.fightBack,
      (v) => {
        game.settings.fightBack = v;
        game.fightPrefsChanged?.();
      },
    );
    add(
      'One line for a whole fight',
      `Fight skill gains summarized once, ${FIGHT_QUIET} s after the last blow, with duration, damage dealt and taken. Off: one line per gain.`,
      () => game.settings.compactFight,
      (v) => (game.settings.compactFight = v),
    );

    // Notices (src/ui/notices.ts): a line near the top of the screen, gone after a few seconds; the event log says the same either way.
    head('Notices');
    const seconds = Math.round(NOTICE_MS / 1000 * 10) / 10;
    const noticeLead = document.createElement('p');
    noticeLead.className = 'keys-lead';
    noticeLead.textContent = `Banner at screen top for ${seconds} s. The event log has them either way.`;
    display.append(noticeLead);
    add('A skill at a new whole number', `Skill reaches a new whole number: skill and level, ${seconds} s.`,
      () => game.settings.noticeLevel, (v) => (game.settings.noticeLevel = v));
    add('A knack', `Knack gained, ${seconds} s.`,
      () => game.settings.noticeKnack, (v) => (game.settings.noticeKnack = v));
    add('Work done', `Queue finished after ${DONE_AFTER} s or more of work, ${seconds} s. Not on manual stop.`,
      () => game.settings.noticeDone, (v) => (game.settings.noticeDone = v));
    add('A birth', `Your wildermon gives birth, ${seconds} s.`,
      () => game.settings.noticeBirth, (v) => (game.settings.noticeBirth = v));
    add('Wearing out', `Worn or held item at ${DAMAGE_WARN}% damage (breaks at ${DAMAGE_MAX}%), ${seconds} s.`,
      () => game.settings.noticeWear, (v) => (game.settings.noticeWear = v));
    add('Food about to rot', `Ground food within ${ROT_LOOK} tiles with under ${Math.round(ROT_SOON / 60)} min left, ${seconds} s. No rot in packs or stores.`,
      () => game.settings.noticeRot, (v) => (game.settings.noticeRot = v));

    // Eating by itself (src/game/autoeat.ts).
    head('Eating');
    choose<number>(
      'Eat by yourself',
      `Food below this: eat from your pack after the current action, until above it. No healing below ${Math.round(HEAL_FED * 100)}% Food. Locked stacks and bagged food never eaten.`,
      AUTO_EAT_AT.map((v) => [v, v ? `Under ${Math.round(v * 100)}% Food` : 'Never']),
      () => game.settings.autoEat,
      (v) => (game.settings.autoEat = v),
    );
    add('Worst food first', 'Eat lowest QL first (default: most filling).',
      () => game.settings.autoEatWorst, (v) => (game.settings.autoEatWorst = v));

    /**
     * Who you are, and the one thing the game can do about it.
     *
     * Setting up an account happens on a page of its own rather than in a
     * window here, so all this can do is point at it — and pointing at it is
     * the whole job, because a landing page nobody can find from the game is a
     * landing page nobody lands on.
     *
     * The line starts out saying you have no account and is corrected once the
     * island keeper answers. That way round on purpose: a browser with no
     * session never asks anybody anything, and a browser that cannot reach the
     * keeper is told the truth about what it can prove, which is nothing.
     */
    head('Account');
    const who = document.createElement('p');
    who.className = 'setting-note';
    display.append(who);
    const door = document.createElement('a');
    door.href = './account.html';
    const sayWho = (line: string, label: string): void => {
      who.textContent = `${line} `;
      door.textContent = label;
      who.append(door);
    };
    sayWho('No account: island name from the address bar.', 'Set one up');
    void whoAmI().then(
      (name) => { if (name) sayWho(`Signed in as ${name}.`, 'Change account'); },
      () => {},
    );
    /*
     * How you look, chosen on the account page as an account is made: this
     * goes back there, to the same creator, on the look you have on. Only on
     * an island, where there is an account to keep it with.
     */
    if (openLook) {
      const row = document.createElement('div');
      row.className = 'setting-row setting-look';
      const text = document.createElement('span');
      text.innerHTML = '<b>Appearance</b><small>Opens the character creator (build, skin, hair, hair colour, eyes, beard, shirt, trousers). <i>Step ashore</i>: apply and return. <i>On to the island</i>: no change.</small>';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'tb-btn tb-small';
      open.textContent = 'Customize character';
      open.addEventListener('click', openLook);
      row.append(text, open);
      display.append(row);
    }

    // ---- The keys ----
    const lead = document.createElement('p');
    lead.className = 'keys-lead';
    lead.innerHTML =
      '<b>Click a key to rebind</b>, then press the new key: <kbd>Esc</kbd> cancels, <kbd>Backspace</kbd> unbinds. ' +
      'Keys move the <i>view</i> and open windows, never your character (left click: walk; right click: actions). ' +
      'Number keys <kbd>1</kbd>–<kbd>0</kbd>: always the Tile window or toolbelt.';
    keyPage.append(lead);

    this.note = document.createElement('p');
    this.note.className = 'keys-note';
    this.note.hidden = true;
    keyPage.append(this.note);

    for (const group of BIND_GROUPS) {
      const rows = BINDS.filter((b) => b.group === group);
      if (!rows.length) continue;
      const h = document.createElement('h4');
      h.className = 'keys-group';
      h.textContent = group;
      keyPage.append(h);
      const table = document.createElement('div');
      table.className = 'keys-table';
      for (const bind of rows) {
        const row = document.createElement('div');
        row.className = 'keys-row';
        const text = document.createElement('span');
        text.className = 'keys-what';
        text.innerHTML = `<b>${esc(bind.label)}</b><small>${esc(bind.hint)}</small>`;
        const slots = document.createElement('span');
        slots.className = 'keys-slots';
        const btns: HTMLButtonElement[] = [];
        for (let slot = 0; slot < MAX_KEYS; slot++) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'tb-btn tb-small keys-key';
          b.addEventListener('click', () => this.listen(bind.id, slot, b));
          btns.push(b);
          slots.append(b);
        }
        this.keyRows.set(bind.id, btns);
        row.append(text, slots);
        if (bind.keeper) {
          row.hidden = true;
          this.keeperRows.push(row);
        }
        table.append(row);
      }
      keyPage.append(table);
    }

    const foot = document.createElement('div');
    foot.className = 'keys-foot';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'tb-btn tb-small';
    reset.textContent = 'Reset keys';
    reset.title = 'Restore default key bindings';
    // Every key you have set goes at once, so it is asked first.
    reset.addEventListener('click', () => {
      this.stopListening();
      void game.hooks.confirm('Reset all keys to defaults? Custom bindings are lost.').then((yes) => {
        if (!yes) return;
        this.keys.reset();
        this.say('Keys reset to defaults.');
      });
    });
    foot.append(reset);
    keyPage.append(foot);

    // Who redraws on a rebinding is `UI`'s business: the toolbar has to hear
    // about it too, and this panel is not the only thing that shows a key.
    this.drawKeys();
  }

  /**
   * The Windows tab: the layouts, kept and called back, and which windows are
   * see-through.
   */
  private buildWindows(page: HTMLDivElement): void {
    const intro = document.createElement('p');
    intro.className = 'setting-note';
    intro.innerHTML = '<b>Window layouts</b><small>Stores each window&rsquo;s position, size, open, expanded and see-through state. <b>Keep</b>: save current. <b>Use</b> or the layout key: restore. Shift+key: save. Windows snap to screen and window edges; hold Alt while dragging to place freely.</small>';
    page.append(intro);
    const note = document.createElement('p');
    note.className = 'keys-note';
    note.hidden = true;
    const sayHere = (text: string): void => {
      note.textContent = text;
      note.hidden = false;
    };
    for (let slot = 0; slot < LAYOUT_SLOTS; slot++) {
      const row = document.createElement('div');
      row.className = 'setting-row layout-row';
      const name = document.createElement('input');
      name.type = 'text';
      name.id = `layout-name-${slot + 1}`;
      name.className = 'layout-name';
      name.maxLength = 24;
      name.value = this.windows.layoutName(slot);
      name.title = 'Layout name';
      name.addEventListener('keydown', (e) => e.stopPropagation());
      name.addEventListener('change', () => {
        this.windows.renameLayout(slot, name.value);
        this.drawLayouts();
      });
      const keep = document.createElement('button');
      keep.type = 'button';
      keep.className = 'tb-btn tb-small';
      keep.textContent = 'Keep';
      keep.title = 'Save current windows to this layout';
      keep.addEventListener('click', () => {
        this.windows.saveLayout(slot);
        this.drawLayouts();
        sayHere(`Saved as “${this.windows.layoutName(slot)}”.`);
      });
      const use = document.createElement('button');
      use.type = 'button';
      use.className = 'tb-btn tb-small';
      use.textContent = 'Use';
      use.addEventListener('click', () => {
        if (this.windows.useLayout(slot)) sayHere(`Restored “${this.windows.layoutName(slot)}”.`);
      });
      const key = document.createElement('kbd');
      row.append(name, keep, use, key);
      page.append(row);
      this.layoutRows.push({ name, use, key });
    }
    page.append(note);
    const seeHead = document.createElement('p');
    seeHead.className = 'setting-note';
    seeHead.innerHTML = '<b>See-through windows</b><small>Dimmed; clicks pass to the world. Title bar still drags and toggles it. Hold Alt to click or scroll inside. The title-bar ◐ is the same toggle.</small>';
    page.append(seeHead);
    for (const w of this.windows.windows.values()) {
      if (!w.opts.seeThrough) continue;
      const row = document.createElement('label');
      row.className = 'setting-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `see-${w.opts.id}`;
      input.checked = w.isSeeThrough;
      input.addEventListener('change', () => w.setSeeThrough(input.checked));
      const text = document.createElement('span');
      text.innerHTML = `<b>${esc(w.opts.title)}</b>`;
      row.append(input, text);
      page.append(row);
      this.seeRows.push({ input, win: w });
    }
    this.drawLayouts();
  }

  /** The layouts' names, whether each has anything kept, and their keys. */
  drawLayouts(): void {
    this.layoutRows.forEach((r, slot) => {
      if (document.activeElement !== r.name) r.name.value = this.windows.layoutName(slot);
      const kept = this.windows.layoutKept(slot);
      r.use.disabled = !kept;
      r.use.title = kept ? 'Restore this layout' : 'Empty: arrange windows and press Keep';
      const k = this.keys.label(`layout_${slot + 1}`);
      r.key.textContent = k;
      r.key.title = k === 'unbound' ? 'No key: set one under Keys' : `${k}: restore; Shift+${k}: save`;
    });
  }

  /**
   * Every row on the Display and Windows tabs, by what it is called, for the
   * Find anything box: opening one shows its tab and lights the row up.
   */
  findables(): Array<{ label: string; hint: string; reveal: () => void }> {
    const out: Array<{ label: string; hint: string; reveal: () => void }> = [];
    for (const tab of ['display', 'windows']) {
      const page = this.pages.get(tab);
      if (!page) continue;
      for (const row of page.querySelectorAll<HTMLElement>('.setting-row, .setting-note')) {
        const b = row.querySelector('b');
        const label = (b?.textContent ?? '').replace(/\s+—.*$/, '').trim();
        if (!label) continue;
        out.push({
          label,
          hint: row.querySelector('small')?.textContent ?? '',
          reveal: () => {
            this.show(tab);
            row.scrollIntoView({ block: 'center' });
            row.classList.remove('found-flash');
            void row.offsetWidth;
            row.classList.add('found-flash');
          },
        });
      }
    }
    return out;
  }

  /** The island says this body keeps it: its keys are listed with the rest. */
  showKeeper(): void {
    for (const row of this.keeperRows) row.hidden = false;
  }

  /** Switch tabs. */
  private show(id: string): void {
    if (!this.pages.has(id)) return;
    this.stopListening();
    this.tab = id;
    for (const [key, el] of this.tabs) el.classList.toggle('tb-on', key === id);
    for (const [key, el] of this.pages) el.hidden = key !== id;
  }

  /**
   * Take the next press for this slot.
   *
   * Clicking the slot that is already listening puts it back rather than
   * leaving somebody stuck waiting for a key they did not mean to change.
   */
  private listen(id: string, slot: number, btn: HTMLButtonElement): void {
    if (this.grabbing?.id === id && this.grabbing.slot === slot) {
      this.stopListening();
      return;
    }
    this.stopListening();
    this.grabbing = { id, slot, btn };
    btn.classList.add('keys-listening');
    btn.textContent = 'press…';
    this.say('Press a key. Esc: cancel. Backspace: unbind.');
  }

  private stopListening(): void {
    if (!this.grabbing) return;
    this.grabbing.btn.classList.remove('keys-listening');
    this.grabbing = null;
    this.drawKeys();
  }

  /**
   * A press, while a slot is listening.
   *
   * Answers whether the key was swallowed, which is what keeps `Escape` from
   * cancelling your work and `I` from opening the inventory behind the window
   * you are binding it in.
   */
  grab(code: string): boolean {
    const g = this.grabbing;
    if (!g) return false;
    if (code === 'Escape') {
      this.stopListening();
      this.say('Unchanged.');
      return true;
    }
    if (code === 'Backspace' || code === 'Delete') {
      this.keys.clear(g.id, g.slot);
      this.stopListening();
      this.say('Unbound.');
      return true;
    }
    const reserved = keyReserved(code);
    if (reserved) {
      this.say(reserved);
      return true;
    }
    const took = this.keys.bind(g.id, g.slot, code);
    this.stopListening();
    if (!took.ok) this.say(took.why ?? 'Key not allowed.');
    else if (took.took) {
      const from = BINDS.find((b) => b.id === took.took);
      this.say(`${keyName(code)} set. Unbound from: ${from ? from.label.toLowerCase() : 'another action'}.`);
    } else this.say(`${keyName(code)} set.`);
    return true;
  }

  private say(text: string): void {
    this.note.textContent = text;
    this.note.hidden = false;
  }

  /** Put every slot's caption back in step with the table. */
  drawKeys(): void {
    for (const [id, btns] of this.keyRows) {
      const codes = this.keys.codes(id);
      btns.forEach((b, i) => {
        const code = codes[i];
        b.textContent = code ? keyName(code) : '—';
        b.classList.toggle('keys-empty', !code);
        b.title = code ? `${keyName(code)}: click to change` : 'Unbound: click to set';
      });
    }
  }

  /** Keep the boxes in step with hotkeys that change the same settings. */
  refresh(): void {
    for (const t of this.toggles) {
      const v = t.read();
      if (t.input.checked !== v) t.input.checked = v;
    }
    for (const r of this.seeRows) if (r.input.checked !== r.win.isSeeThrough) r.input.checked = r.win.isSeeThrough;
  }
}

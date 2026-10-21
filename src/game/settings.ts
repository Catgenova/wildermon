/**
 * What the person sitting here likes, kept where the person is.
 *
 * Reported from the island: *"settings like the screen pan seem to reset each
 * refresh/session."*
 *
 * They did, and only on an island, which is the shape of half the bugs this
 * week. `main.ts` reads:
 *
 *     if (!island) warmSave();
 *     if (!island) { setTimeout(saveGame, 3000); setInterval(saveGame, 20000); }
 *
 * — an island session never saves and never loads. The settings rode the save
 * and nowhere else, so in the solo world they came back and on an island
 * `game.settings` was the constructor's defaults every single time somebody
 * opened the page.
 *
 * They do not belong in a save at all. `Keybinds` says why, and the window
 * layout says it too: this is a fact about the person sitting here, not about
 * the island. Carrying it in a save means a keyboard — or a camera, or the
 * edge pan — changing under you when you load somebody else's world, and
 * losing it entirely the moment the world is somebody else's to keep.
 *
 * So: `localStorage`, beside the keys and the windows, written the moment
 * anything changes.
 */

const KEY = 'wurm.settings.v1';

/** The frame-rate limits on offer, 0 for every refresh of the screen. */
export const FRAME_CAPS = [0, 60, 30] as const;
/** Device pixels drawn to a screen pixel, at most: everything, and the fast graphics. */
export const FULL_DPR = 2;
export const FAST_DPR = 1;
/** The most frames drawn a second with Low power on (`lowPower`), whatever the frame-rate limit says. */
export const LOW_POWER_FPS = 30;

/** Everything that is a preference, and their out-of-the-box answers. */
export const SETTING_DEFAULTS = {
  grid: true,
  /** Which of the eight ways round the camera is turned. */
  rotation: 0,
  deedBorder: true,
  /** Hide walls standing between the viewer and the inside of a building. */
  cutaway: false,
  /** Open the tile window when a tile is clicked. */
  tileWindow: true,
  /** Hide the land nobody has looked at, and cool what is out of sight. */
  fog: true,
  /** Keep the camera on the player rather than leaving it where it was dragged. */
  follow: true,
  /** Push the view along when the cursor rests against the edge of the screen. */
  edgePan: true,
  /**
   * How loud the island is, 0 for silence.
   *
   * Kept beside the camera and the keys rather than in the save, for the same
   * reason they are: how loud a room is, is a fact about the room, and
   * carrying it in a save means a volume that changes under you when you load
   * somebody else's world.
   */
  volume: 0.55,
  /**
   * How big every window, menu and bar is drawn, and the writing in them, as
   * a share of the size the screen would give them anyway (`setUiSize` in
   * `src/ui/screen.ts`). A fact about somebody's eyes and their screen, which
   * is as far from being about the island as anything here.
   */
  uiSize: 1,
  /**
   * Whether the first-steps card is shown.
   *
   * It stands down on its own once the first chapter of the journal is
   * behind you, so this is only about putting it away sooner — and it is a
   * fact about the person rather than about the island, like everything else
   * here: somebody who knows the game does not want to be told how to fell a
   * tree on every island they ever open.
   */
  guide: true,
  /**
   * Whether a craft, and work at a station that uses something up, may take
   * it from your stores within reach as well as from what you carry.
   *
   * Asked for as "a toggle in settings for allowing or disallowing crafting
   * from nearby containers" -- "a player setting to only use inventory". Off,
   * the pack and the bags on your back are all there is. On an island the
   * island keeps a copy of its own on your body, since it is the island that
   * spends the stock (`Island.craftPrefs`).
   */
  fromStores: true,
  /**
   * Whether a craft leaves rare, supreme and fantastic stock alone unless it
   * was pointed at it: "disallows the automatic use of any rare material in
   * crafting". Kept on the island's copy too.
   */
  spareRare: false,
  /**
   * Which way you stand in a fight (`fight.ts`): aggressive, balanced or
   * defensive. Kept on the island's copy of your body as well, as the two
   * crafting ones are, since it is the island that settles the blows.
   */
  fightStance: 'balanced' as 'aggressive' | 'balanced' | 'defensive',
  /**
   * Whether a creature biting you turns you on it. Off, you fight only what
   * you set out to fight. Kept on the island's copy too.
   */
  fightBack: true,
  /** Skill lines in a fight folded into one line at its end, rather than one after every swing. */
  compactFight: true,
  /** The arrows a bow looses first while there are any (`nockedArrow`); sent with every shot, since it is the island that looses them. */
  nock: 'arrow',
  /** The most frames drawn a second, or 0 for every refresh of the screen (`GameLoop.maxFps`). */
  frameCap: 0,
  /**
   * How much is drawn: everything, or the fast set (`FAST_GRAPHICS`), which
   * draws one pixel for every screen pixel and leaves out the swell, the haze
   * and the small life.
   */
  graphics: 'full' as 'full' | 'fast',
  /** Under the frame rate, the milliseconds a frame spends drawing each layer (`Timings`). */
  timings: false,
  /**
   * Phone only (`lowPowerOn`): at most `LOW_POWER_FPS` frames a second, the
   * fast graphics, and no wakes or dust.
   */
  lowPower: false,
  /** Phone only: the screen kept on while an action runs or one is queued (`src/ui/phone.ts`). */
  keepAwake: true,
  /** Notices near the top of the screen (`src/ui/notices.ts`): a skill at a new whole number, a knack, a run of work done, a birth, a thing you wear or hold wearing out, food on the ground about to rot. */
  noticeLevel: true,
  noticeKnack: true,
  noticeDone: true,
  noticeBirth: true,
  noticeWear: true,
  noticeRot: true,
  /**
   * Eat by itself when Food falls under this share, 0 for never
   * (`autoeat.ts`): from the pack, after the job in hand, the food that fills
   * most (or the worst of it first, by `autoEatWorst`).
   */
  autoEat: 0,
  autoEatWorst: false,
  /** Hostile creatures in red over the trees and buildings in front of them, with a marker over each (`drawThreats`). */
  markThreats: true,
  /** A ring over each fire, smelter and kiln near you: its fuel, the work in it, and a dot when something is ready (`drawStationRings`). */
  stationRings: true,
  /**
   * How the windows, menus and bars are drawn (`src/ui/theme.ts`): Runecut,
   * pale stone cut like the runestones', or Classic, the dark interface as it
   * was before Runecut.
   */
  uiStyle: 'runecut' as UiStyle,
  /**
   * Runecut's stone: following the island's own clock (`Game.isNight`), this
   * computer's (`LOCAL_NIGHT_STARTS` to `LOCAL_NIGHT_ENDS` in src/ui/theme.ts),
   * or always by day or always after dark. The saved words are the ones from
   * before the computer's clock was a choice: `clock` is the island's.
   */
  uiLight: 'day' as UiLight,
  /**
   * The colours that carry a meaning -- better and worse, have and lack, the
   * bars, danger -- as they are, or swapped for a pair that reads apart with
   * red-green or blue-yellow colour blindness (`data-cb` in src/style.css).
   */
  uiColours: 'standard' as UiColours,
  /** Runecut's window borders: each drawn as the stuff of what its window holds, or all plain stone (`src/ui/runecut-frames.ts`); nothing in Classic. */
  uiFrames: 'themed' as UiFrames,
  /** Runecut's themed frames have small animals and lights going about them (`src/ui/runecut-life.ts`). */
  uiLife: true,
  /** A ring round the mouse pointer that fills with the job in hand, as the action bar does (`src/ui/pointerring.ts`). */
  pointerRing: true,
  /** A settlement's name near the top of the screen as you cross into its border, and a line as you leave (`src/ui/deedbanner.ts`). */
  deedBanner: true,
};

/** Whether Low power is on, which it only ever is on a phone. */
export const lowPowerOn = (s: { lowPower: boolean }, phone: boolean): boolean => phone && s.lowPower;

/** The frame-rate limit the loop keeps to: the one chosen, or `LOW_POWER_FPS` with Low power if that is lower. */
export function frameCapOf(s: { frameCap: number; lowPower: boolean }, phone: boolean): number {
  if (!lowPowerOn(s, phone)) return s.frameCap;
  return s.frameCap > 0 ? Math.min(s.frameCap, LOW_POWER_FPS) : LOW_POWER_FPS;
}

/** Whether the fast graphics are drawn: chosen, or put on by Low power. */
export const drawsFast = (s: { graphics: string; lowPower: boolean }, phone: boolean): boolean =>
  s.graphics === 'fast' || lowPowerOn(s, phone);

/** Device pixels drawn to a screen pixel, at most (`FullscreenCanvas.maxDpr`). */
export const dprCapOf = (s: { graphics: string; lowPower: boolean }, phone: boolean): number =>
  drawsFast(s, phone) ? FAST_DPR : FULL_DPR;

export const UI_STYLES = ['runecut', 'classic'] as const;
export type UiStyle = (typeof UI_STYLES)[number];
/** `clock` is the island's clock and `local` this computer's; listed in the order Settings offers them. */
export const UI_LIGHTS = ['clock', 'local', 'day', 'night'] as const;
export type UiLight = (typeof UI_LIGHTS)[number];
/** Standard, red-green safe (deuteranopia and protanopia) and blue-yellow safe (tritanopia). */
export const UI_COLOURS = ['standard', 'rg', 'by'] as const;
export type UiColours = (typeof UI_COLOURS)[number];
export const UI_FRAMES = ['themed', 'stone'] as const;
export type UiFrames = (typeof UI_FRAMES)[number];

export type Settings = typeof SETTING_DEFAULTS & {
  /**
   * Storey being looked at, 0 for the ground floor; null follows the player.
   *
   * The one thing here that is *not* kept. It is where you are rather than
   * what you like — coming back to an island on the second floor of a building
   * you are no longer standing in is not a preference anybody expressed.
   */
  viewLevel: number | null;
};

const KEPT = Object.keys(SETTING_DEFAULTS) as Array<keyof typeof SETTING_DEFAULTS>;

/** Whether anything has ever been put away here, which decides who wins a tie. */
export function settingsStored(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

function read(): Partial<typeof SETTING_DEFAULTS> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const got = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    // Type by type against the defaults rather than trusted: what comes out of
    // a browser's store is whatever was in a browser's store, including an
    // older build's idea of what these were.
    for (const k of KEPT) if (typeof got[k] === typeof SETTING_DEFAULTS[k]) out[k] = got[k];
    // A stance is one of three words, not any word.
    if (!['aggressive', 'balanced', 'defensive'].includes(out.fightStance as string)) delete out.fightStance;
    if (!['full', 'fast'].includes(out.graphics as string)) delete out.graphics;
    if (!(FRAME_CAPS as readonly number[]).includes(out.frameCap as number)) delete out.frameCap;
    if (!(UI_STYLES as readonly string[]).includes(out.uiStyle as string)) delete out.uiStyle;
    if (!(UI_LIGHTS as readonly string[]).includes(out.uiLight as string)) delete out.uiLight;
    if (!(UI_COLOURS as readonly string[]).includes(out.uiColours as string)) delete out.uiColours;
    if (!(UI_FRAMES as readonly string[]).includes(out.uiFrames as string)) delete out.uiFrames;
    return out as Partial<typeof SETTING_DEFAULTS>;
  } catch {
    return {};
  }
}

/**
 * The live settings, which put themselves away whenever they are changed.
 *
 * A proxy rather than a `save()` beside every assignment: there are fourteen
 * places that set one of these, across the settings panel, the hud, the
 * toolbelt and the keys, and the fifteenth would have been written by somebody
 * who did not know there was a save to call. What cannot be forgotten is the
 * thing that happens on the assignment itself.
 */
export function liveSettings(): Settings {
  const live: Settings = { ...SETTING_DEFAULTS, ...read(), viewLevel: null };
  let due: ReturnType<typeof setTimeout> | null = null;
  const put = (): void => {
    due = null;
    try {
      const out: Record<string, unknown> = {};
      for (const k of KEPT) out[k] = live[k];
      localStorage.setItem(KEY, JSON.stringify(out));
    } catch {
      // A browser that will not keep anything — private browsing, a store
      // that is full. The settings still work for as long as the page is open,
      // which is what they did before any of this.
    }
  };
  return new Proxy(live, {
    set(target, prop, value): boolean {
      (target as Record<string | symbol, unknown>)[prop] = value;
      // Coalesced, so a run of changes is one write; and only for the ones
      // that are kept, so following the player around a building does not
      // touch the store once a frame.
      if (KEPT.includes(prop as keyof typeof SETTING_DEFAULTS)) {
        if (due) clearTimeout(due);
        due = setTimeout(put, 200);
      }
      return true;
    },
  });
}

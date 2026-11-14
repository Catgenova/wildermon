import type { PeerId, PeerState } from '../net/protocol';
import { tileKey } from './tileindex';
import { phasePerTile, RIDE_CADENCE } from './player';
import { BODY_EVERY } from './keep';
import { BLOCK_SECS, FLINCH_SECS } from './fight';
import { emoteLeft } from './emotes';

/** Handed back for a tile nobody is standing on, so the common answer is free. */
const NOBODY: readonly Peer[] = [];

/**
 * The other people on the island.
 *
 * The game has exactly one `player`, and three and a half thousand lines are
 * written on that assumption — it is the thing the camera follows, the thing
 * actions are performed by, the thing whose hunger the clock eats. Turning
 * that one into a list is a rebuild and would be a poor way to start.
 *
 * So other people are kept apart from it, here. A peer is not a `Player`: it
 * has no inventory, no skills, no stamina, nothing the simulation reads. It is
 * a position, a name and a pose — everything needed to draw somebody and
 * nothing else, because on this machine nobody else's body is simulated. The
 * host's machine has the truth about all of them; every other machine has this.
 *
 * That line is worth keeping sharp. The day the local player becomes one of
 * many, it will be because this grew up to meet `Player`, not because `Player`
 * was scattered across the game.
 */
export interface Peer extends PeerState {
  /** When this was last heard about, on the local clock, for easing and for timing out. */
  at: number;
  /**
   * Where they were the last time we were told, so the gap between one word
   * and the next can be walked rather than jumped. Twelve times a second is
   * plenty to know where somebody is and nowhere near enough to watch them
   * walk.
   */
  fromX: number;
  fromY: number;
  /** Where the walk to the last word began: where they were drawn when it came, and when that was drawn. */
  startX: number;
  startY: number;
  walkAt: number;
  /** How long that walk should take, in seconds (`walkSpan`). */
  span: number;
  /**
   * Their own walk cycle, counted by the clock at `RIDE_CADENCE` as it
   * always was: what times the rock of a seat or a saddle under them.
   */
  walkPhase: number;
  /**
   * And on their own feet, counted by the ground they are drawn covering: a
   * stride for every stride's worth (`phasePerTile`), so a foot they put down
   * stays where it was put however fast they go. It was the clock alone, which
   * kept up at exactly a walk and nowhere else -- on a road, under a spell or
   * wading, their feet skated.
   */
  stepPhase: number;
  /** How fast they are drawn going, in tiles a second, smoothed, for the stride that pace is drawn at; and where they were drawn last frame. */
  pace: number;
  drawnX: number;
  drawnY: number;
  /**
   * And which of the eight ways they are drawn turned, kept here for the same
   * reason: it is worked out from a heading that can sit on the line between
   * two of them, and it must not be re-decided from scratch every frame.
   */
  facing: number;
  /**
   * An emote they are part way through, and when it reached us.
   *
   * On the local clock, like `at` and for the same reason: an emote runs for a
   * second or two and is drawn frame by frame, so it has to be timed by the
   * clock the frames are timed by rather than by anybody else's.
   */
  emote?: string;
  emoteAt?: number;
  /**
   * The last thing they said out loud, and when it reached us.
   *
   * On the local clock like `emoteAt` and for the same reason: a bubble is
   * drawn frame by frame for a few seconds, so it has to be timed by the clock
   * the frames are timed by rather than by the hour the island stamped on the
   * line. A line caught up on after a quiet spell is not somebody talking now
   * and never reaches this.
   */
  said?: string;
  saidAt?: number;
  /**
   * The last blow they took on their shield (`player.blocked_at`): the island's instant, epoch milliseconds, so one
   * block heard twice (their body broadcast, then the roster's read) is drawn once; and when it reached us, on the
   * local clock like `emoteAt`, for the block drawn (`../render` `FigurePose.block`).
   */
  blockedMs?: number;
  blockedAt?: number;
  /** The last blow that landed on them (`player.hurt_at`), as `blockedMs` and `blockedAt`; where (`hurt_where`) and what struck (a creature's id), when said. */
  hurtMs?: number;
  hurtAt?: number;
  hurtWhere?: string;
  hurtBy?: number;
  /** Whether that blow was a heavy one (`player.hurt_heavy`), drawn as a stumble (`FigurePose.heavy`). */
  hurtHeavy?: boolean;
}

/**
 * The words out of a chat line, without the name in front of them.
 *
 * Every line said on this island is written `<Name> the words`, by `rpc_say`
 * over there and by `say` here, so that the log reads as a conversation. A
 * bubble over somebody's head does not need their name in it — their name is
 * already drawn under the bubble — and a bubble that carries it is a bubble
 * half full of something you can read anyway.
 */
export const saidWords = (line: string): string => line.replace(/^<[^>]*>\s*/, '');

/**
 * The fastest anybody is drawn going, in tiles a second: a caravel on a reach
 * in a gale makes about eleven (\`pace.ts\`), a mount five.
 */
const FASTEST = 12;

/**
 * How far out of step a peer must be before they are snapped rather than
 * walked: two words' worth at the fastest pace, so a word lost on the way is
 * walked over and only a rune gate, a spell or a death is a jump.
 */
const TELEPORT = Math.max(6, 2 * FASTEST * BODY_EVERY);

/**
 * How much longer than the gap between two words the walk between them takes.
 *
 * A word goes out every \`BODY_EVERY\` at most. Walked in exactly that, somebody
 * arrives at each word just as the next is due, and any word late on the wire
 * leaves them standing until it comes: a walk drawn as a string of stops. A
 * little longer, and the next word always comes while they are still on their
 * way to this one, so they walk on from wherever they have got to without a
 * pause. They are drawn that much behind where they are; nothing reads where
 * they are drawn but the drawing (\`drawnAt\`): a reach or a target reads \`x\`
 * and \`y\`, the last word.
 */
export const WALK_SLACK = 1.5;

/** The longest ago a frame may have been drawn for a walk to be timed from it (\`walkAt\`): a tab put away draws none. */
const WALK_FRAME_MOST = 0.1;

/**
 * How long the walk to a word takes, from the gap since the word before it.
 *
 * Never less than the gap words are sent at, and never more than two of them:
 * the first word after somebody has stood still a minute is a step from where
 * they stood, not a minute's walk.
 */
export const walkSpan = (gap: number): number => Math.min(2 * BODY_EVERY, Math.max(BODY_EVERY, gap)) * WALK_SLACK;

/** How quickly a peer's drawn pace follows what it is drawn doing, a second: as slowly as the gait it is drawn at (`EASE` in `../render/gait`). */
const PACE_EASE = 4;

/**
 * One clock, read here and nowhere else.
 *
 * Whoever notes that somebody moved and whoever walks them there have to be
 * reading the same clock, and they are called from opposite ends of the
 * program — a session on the network's beat, the renderer on the drawing beat,
 * which counts from the first frame rather than from the page. Taking the time
 * from a caller meant two clocks could be mixed with nothing to say so, and a
 * peer eased between a stamp from one and a reading from the other walks
 * briskly off the map.
 */
const clock = (): number => performance.now() / 1000;

/** The people on the island who are not you. */
export class Roster {
  private readonly peers = new Map<PeerId, Peer>();
  /** Who we are on this island. Zero is the host; -1 means nobody, which is single player. */
  self: PeerId = -1;
  /** Who is standing where, rebuilt once a frame by `ease`. */
  private byTile = new Map<number, Peer[]>();
  /** The tiles written to this frame, so the rest are left alone. */
  private filled: number[] = [];
  /** When the last frame was eased (\`ease\`), on \`clock\`. */
  private easedAt = -Infinity;

  get size(): number {
    return this.peers.size;
  }

  list(): Peer[] {
    return [...this.peers.values()];
  }

  get(id: PeerId): Peer | undefined {
    return this.peers.get(id);
  }

  /** Somebody by the uid the island knows them by. */
  byUid(uid: string): Peer | undefined {
    for (const p of this.peers.values()) if (p.uid === uid) return p;
    return undefined;
  }

  /**
   * Everyone standing on a given tile, for the renderer, which asks per tile.
   *
   * Filed rather than searched. This used to walk every peer on the island for
   * every tile on screen — two thousand tiles against twenty people is forty
   * thousand comparisons a frame to answer "nobody" forty thousand times. The
   * index is built once a frame in `ease`, which already walks all of them.
   */
  atTile(x: number, y: number): readonly Peer[] {
    return this.byTile.get(tileKey(x, y)) ?? NOBODY;
  }

  /**
   * What we have just been told about somebody. Where they were becomes where
   * they are walking from, so the frames between one word and the next have
   * something to draw.
   */
  saw(state: PeerState): void {
    const now = clock();
    if (state.id === this.self) return;
    const had = this.peers.get(state.id);
    if (!had) {
      this.peers.set(state.id, { ...state, at: now, fromX: state.x, fromY: state.y, startX: state.x, startY: state.y, walkAt: now, span: 0, walkPhase: 0, facing: 1, stepPhase: 0, pace: 0, drawnX: state.x, drawnY: state.y });
      return;
    }
    /*
     * Told again where somebody already is: there is nothing new to walk.
     *
     * Every word about anybody is laid as a word about everybody (\`sawAll\`),
     * so five times a second for each person on the move, everybody else was
     * told where they already were -- and starting the walk again from its
     * own end cut short the one they were halfway along. Somebody moving
     * quickly went in jumps whenever anybody else moved at all.
     */
    if (state.x === had.x && state.y === had.y && state.level === had.level) {
      Object.assign(had, { ...state, at: had.at, fromX: had.fromX, fromY: had.fromY, span: had.span, walkPhase: had.walkPhase, facing: had.facing });
      return;
    }
    const jumped = Math.hypot(state.x - had.x, state.y - had.y) > TELEPORT;
    /*
     * From where they are drawn, not from the last word: they are still on
     * their way to it (\`WALK_SLACK\`), and starting from it would jump them the
     * rest of the way.
     */
    had.fromX = jumped ? state.x : had.fromX;
    had.fromY = jumped ? state.y : had.fromY;
    had.startX = had.fromX;
    had.startY = had.fromY;
    /*
     * From the frame that drew them there, which is where \`fromX\` was worked
     * out, rather than from now: timed from now, the frame a word comes in on
     * draws them where the last one did, a stop at every word.
     */
    had.walkAt = !jumped && now - this.easedAt <= WALK_FRAME_MOST ? this.easedAt : now;
    // The gap actually observed: a link that is running slow is walked slowly, not walked fast and then waited.
    had.span = jumped ? 0 : walkSpan(now - had.at);
    had.at = now;
    Object.assign(had, { ...state, at: now, fromX: had.fromX, fromY: had.fromY, startX: had.startX, startY: had.startY, walkAt: had.walkAt, span: had.span, walkPhase: had.walkPhase, facing: had.facing });
  }

  /** Everybody, in one word, replacing whoever is no longer in the list. */
  sawAll(states: PeerState[]): void {
    const seen = new Set<PeerId>();
    for (const s of states) {
      if (s.id === this.self) continue;
      seen.add(s.id);
      this.saw(s);
    }
    for (const id of [...this.peers.keys()]) if (!seen.has(id)) this.peers.delete(id);
  }

  gone(id: PeerId): void {
    this.peers.delete(id);
  }

  clear(): void {
    this.peers.clear();
    this.self = -1;
  }

  /**
   * Move everybody along the walk they were last seen on. Called once a frame
   * from the renderer's clock rather than the game's, since this is drawing
   * rather than simulation and should be smooth even when the world is paused.
   */
  ease(dt: number): void {
    const now = clock();
    this.easedAt = now;
    // The tile index goes with the easing: one walk of the list does both, and
    // the renderer asks `atTile` immediately afterwards.
    for (const key of this.filled) {
      const at = this.byTile.get(key);
      if (at) at.length = 0;
    }
    this.filled.length = 0;
    for (const p of this.peers.values()) {
      // At one pace along the line from where the walk began, so somebody going steadily is drawn going steadily.
      if (p.span > 0) {
        const t = Math.min(1, (now - p.walkAt) / p.span);
        p.fromX = p.startX + (p.x - p.startX) * t;
        p.fromY = p.startY + (p.y - p.startY) * t;
        if (t >= 1) p.span = 0;
      }
      if (p.moving) p.walkPhase += dt * RIDE_CADENCE;
      // Sat on the ground (a held emote) until they walk off, swim or work (`emoteLeft`).
      if (emoteLeft(p.emote, p.moving || p.swimming || p.working)) p.emote = undefined;
      // A frame's walk, and not a jump to where somebody turned up after a gap in the word.
      const [x, y] = this.drawnAt(p);
      const gone = Math.hypot(x - p.drawnX, y - p.drawnY);
      p.drawnX = x;
      p.drawnY = y;
      if (gone < 1 && dt > 0) {
        p.pace += (gone / dt - p.pace) * Math.min(1, PACE_EASE * dt);
        if (p.moving) p.stepPhase += gone * phasePerTile(p.pace);
      }
      const key = tileKey(Math.floor(p.x), Math.floor(p.y));
      let at = this.byTile.get(key);
      if (!at) {
        at = [];
        this.byTile.set(key, at);
      }
      if (!at.length) this.filled.push(key);
      at.push(p);
    }
  }

  /** Where somebody should be drawn this frame, which is not quite where they are. */
  drawnAt(p: Peer): [number, number] {
    return p.span > 0 ? [p.fromX, p.fromY] : [p.x, p.y];
  }

  /**
   * Somebody waved.
   *
   * Stamped on arrival rather than carried with the message: a sender's clock
   * is not ours, and an emote a second and a half long timed against a clock a
   * second out is an emote that is over before it is drawn.
   */
  emoted(id: number, emote: string): void {
    const p = this.peers.get(id);
    if (!p) return;
    p.emote = emote;
    p.emoteAt = clock();
  }

  /**
   * Somebody took a blow on their shield at the island's instant `ms` (epoch milliseconds). Stamped on arrival, as an
   * emote is; a block within `BLOCK_SECS` of the last one heard is the same block heard again.
   */
  blocked(id: number, ms: number): void {
    const p = this.peers.get(id);
    if (!p || ms < (p.blockedMs ?? -Infinity) + BLOCK_SECS * 1000) return;
    p.blockedMs = ms;
    p.blockedAt = clock();
  }

  /**
   * A blow landed on somebody at the island's instant `ms` (epoch milliseconds), where and from what when said. Stamped
   * on arrival, as a block is; a blow within `FLINCH_SECS` of the last one heard is the same blow heard again, which only
   * says where and from what if the first did not.
   */
  hurt(id: number, ms: number, where?: string, by?: number, heavy?: boolean): void {
    const p = this.peers.get(id);
    if (!p) return;
    const again = ms < (p.hurtMs ?? -Infinity) + FLINCH_SECS * 1000;
    if (!again) {
      p.hurtMs = ms;
      p.hurtAt = clock();
      p.hurtWhere = where;
      p.hurtBy = by;
      p.hurtHeavy = heavy;
      return;
    }
    p.hurtWhere ??= where;
    p.hurtBy ??= by;
    p.hurtHeavy ||= heavy;
  }

  /** Somebody said something out loud, for the bubble over their head. */
  spoke(id: number, text: string): void {
    const p = this.peers.get(id);
    if (!p) return;
    p.said = text;
    p.saidAt = clock();
  }
}

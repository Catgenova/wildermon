/**
 * The boot bar, as the phases of coming ashore.
 *
 * Each phase is a piece of real work, said by the code doing it (`play.ts`,
 * `Island.join`), and owns a fixed share of the bar: the bar is the shares of
 * the phases done, plus the part done of the one under way when that phase
 * can count (`part`). Nothing moves it but a phase beginning, counting or
 * ending; there is no timer behind it. A phase with nothing to do (no trees
 * near) is passed over and its share is filled when
 * a later one begins. The bar never goes back.
 *
 * The shares are the phases' cost on a join measured against a stand-in island
 * with a round trip of 80 ms (`scripts/login-check.mjs`), rounded.
 */

export type BootPhase = 'auth' | 'join' | 'world' | 'land' | 'pack' | 'trees' | 'frame';

export interface BootPhaseDef {
  id: BootPhase;
  /** What the boot card calls it. */
  label: string;
  /** Its part of the bar, out of 1. */
  share: number;
}

/** In the order they run. The shares add to 1. */
export const BOOT_PHASES: readonly BootPhaseDef[] = [
  { id: 'auth', label: 'Signing in', share: 0.1 },
  { id: 'join', label: 'Joining', share: 0.1 },
  { id: 'world', label: 'World', share: 0.15 },
  { id: 'land', label: 'Land', share: 0.2 },
  { id: 'pack', label: 'Pack', share: 0.1 },
  { id: 'trees', label: 'Trees', share: 0.1 },
  { id: 'frame', label: 'First frame', share: 0.25 },
];

/** How far round where you come ashore, in tiles, the trees the boot card waits for reach (`preloadTreesAt`): about a screen at zoom one. */
export const NEAR_REACH = 14;

/**
 * Longest the boot card waits on those trees being baked, in milliseconds, once everything else is in: past it
 * the first frame is drawn and bakes what is left as it goes.
 */
export const TREE_WAIT_MS = 1000;

const INDEX = new Map(BOOT_PHASES.map((p, i) => [p.id, i]));

/** One phase done: what it was called and how long it took, in milliseconds. */
export interface BootDone {
  id: BootPhase;
  label: string;
  ms: number;
}

/**
 * Where coming ashore has got to.
 *
 * `at(phase, detail?, done?, total?)` is the one call: a phase later than the
 * current one begins it (and ends every one before it), the current one is
 * counted (`done` of `total`; a `total` of nought is a count towards nobody
 * knows what, shown as the count and not moved on the bar), and an earlier one
 * is ignored, so two pieces of work running side by side cannot pull it back.
 */
export class BootProgress {
  private phase = -1;
  private since = 0;
  private part = 0;
  private detail = '';
  private most = 0;
  readonly done: BootDone[] = [];

  constructor(private readonly clock: () => number = () => performance.now()) {}

  at(id: BootPhase, detail = '', done?: number, total?: number): void {
    const i = INDEX.get(id);
    if (i === undefined || i < this.phase) return;
    const now = this.clock();
    if (i > this.phase) {
      if (this.phase >= 0) {
        const was = BOOT_PHASES[this.phase];
        this.done.push({ id: was.id, label: was.label, ms: now - this.since });
      }
      this.phase = i;
      this.since = now;
      this.part = 0;
    }
    this.detail = detail;
    if (done !== undefined && total !== undefined && total > 0) this.part = Math.max(this.part, Math.min(1, done / total));
    if (done !== undefined && total === 0) this.detail = detail ? `${detail} ${done.toLocaleString('en')}` : done.toLocaleString('en');
  }

  /** Every phase over: the last one's time written down and the bar full. */
  finish(): void {
    if (this.phase >= 0 && this.phase < BOOT_PHASES.length) {
      const was = BOOT_PHASES[this.phase];
      this.done.push({ id: was.id, label: was.label, ms: this.clock() - this.since });
    }
    this.phase = BOOT_PHASES.length;
    this.part = 0;
    this.detail = '';
  }

  /** The phase under way, or null before the first and after the last. */
  get current(): BootPhaseDef | null {
    return BOOT_PHASES[this.phase] ?? null;
  }

  /** Milliseconds into the phase under way. */
  get elapsed(): number {
    return this.clock() - this.since;
  }

  /** How much of the bar is full, 0 to 1. */
  get fraction(): number {
    let f = 0;
    for (let i = 0; i < Math.min(this.phase, BOOT_PHASES.length); i++) f += BOOT_PHASES[i].share;
    const now = BOOT_PHASES[this.phase];
    if (now) f += now.share * this.part;
    this.most = Math.max(this.most, Math.min(1, f));
    return this.phase >= BOOT_PHASES.length ? 1 : this.most;
  }

  /** The boot card's line: the phase and what it is on. */
  get line(): string {
    const now = this.current;
    if (!now) return '';
    return this.detail ? `${now.label}: ${this.detail}` : now.label;
  }

  /** Milliseconds each phase took, the ones done. */
  timings(): Partial<Record<BootPhase, number>> {
    const out: Partial<Record<BootPhase, number>> = {};
    for (const d of this.done) out[d.id] = Math.round(d.ms);
    return out;
  }
}

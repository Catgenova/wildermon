/**
 * When a panel should actually redraw itself.
 *
 * A panel that rebuilds from the world has two ways of going wrong. It can
 * rebuild many times a second while you work — every action gains a skill,
 * which wakes every list that watches skills — and that reads on screen as a
 * flash. And every rebuild throws away whatever you had open under your hand.
 *
 * This holds a redraw back to a few times a second, and then skips it
 * altogether unless what the panel would draw has actually changed. In the
 * ordinary case of standing on a tile digging, the list says the same thing
 * from one second to the next, so nothing is touched at all.
 */
export class Repaint {
  private dirty = true;
  private at = -1e9;
  private sig: string | null = null;

  constructor(private readonly every = 250) {}

  /** Something happened that might change what is drawn. */
  ask(): void {
    this.dirty = true;
  }

  /** Draw next time whatever happens, changed or not. */
  force(): void {
    this.dirty = true;
    this.sig = null;
    this.at = -1e9;
  }

  /** Whether enough has happened, and enough time passed, to look again. */
  due(now: number): boolean {
    return this.dirty && now - this.at >= this.every;
  }

  /**
   * Having looked: whether what would be drawn differs from what is drawn.
   * Call this only when `due` said so; it counts as having looked either way.
   */
  changed(now: number, signature: string): boolean {
    this.dirty = false;
    this.at = now;
    if (signature === this.sig) return false;
    this.sig = signature;
    return true;
  }
}

/**
 * Redraws asked for since the last frame, done once each at the next one.
 *
 * The island tells the pack a row at a time (`Island.packRow`): a go that
 * changes a dozen stacks is a dozen words, often in the same breath, and each
 * of them drew the whole Inventory list again, and the belt, while nobody
 * could have seen anything but the last. A panel asks here instead, under a
 * key of its own, and `UI.update` draws each that asked once, in the order
 * first asked, before the frame is shown.
 */
export class FrameBatch {
  private readonly due = new Map<unknown, () => void>();

  /** Draw at the next frame; asked again before then, still once. */
  soon(key: unknown, draw: () => void): void {
    if (!this.due.has(key)) this.due.set(key, draw);
  }

  /** Each redraw asked for, once; one asked for while these run waits for the frame after. */
  flush(): void {
    if (!this.due.size) return;
    const draws = [...this.due.values()];
    this.due.clear();
    for (const draw of draws) draw();
  }
}

/** The one the interface flushes every frame (`UI.update`). */
export const nextFrame = new FrameBatch();

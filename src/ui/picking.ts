/**
 * Picking several things in a list at once, the way a file list does:
 * Ctrl-click (⌘-click on a Mac) adds a row to the pick or takes it off,
 * Shift-click picks the run from the last row picked to this one, and a plain
 * click starts again. Dragging any picked row carries them all, and the bar
 * under the list moves them in one press.
 *
 * Asked for as "shift click and control click inventory items to highlight
 * multiple for moving them between spaces": moving eleven stacks into a chest
 * was eleven drags.
 */
export class Picking {
  readonly uids = new Set<number>();
  /** The row a Shift-click runs from: the last one clicked with Ctrl or on its own. */
  private anchor: number | null = null;

  /**
   * A click on a row, with the list in the order it is drawn. True when the
   * click was a pick (Ctrl or Shift held) and should do nothing else; false
   * for a plain click, which clears the pick and is the row's own.
   */
  click(uid: number, order: readonly number[], e: MouseEvent): boolean {
    if (e.ctrlKey || e.metaKey) {
      if (this.uids.has(uid)) this.uids.delete(uid);
      else this.uids.add(uid);
      this.anchor = uid;
      return true;
    }
    if (e.shiftKey) {
      const from = this.anchor === null ? -1 : order.indexOf(this.anchor);
      const to = order.indexOf(uid);
      if (from < 0 || to < 0) {
        this.uids.add(uid);
        this.anchor = uid;
        return true;
      }
      const [a, b] = from < to ? [from, to] : [to, from];
      for (let i = a; i <= b; i++) this.uids.add(order[i]);
      return true;
    }
    this.uids.clear();
    this.anchor = uid;
    return false;
  }

  /** Whatever was picked that is no longer in the list goes out of the pick. */
  keep(present: ReadonlySet<number> | readonly number[]): void {
    const has = present instanceof Set ? (u: number) => present.has(u) : (u: number) => (present as readonly number[]).includes(u);
    for (const u of [...this.uids]) if (!has(u)) this.uids.delete(u);
  }

  clear(): void {
    this.uids.clear();
  }

  get size(): number {
    return this.uids.size;
  }

  /** What a drag of this row carries: the whole pick when the row is in it, the row alone when it is not. */
  carried(uid: number): number[] | undefined {
    return this.uids.has(uid) && this.uids.size > 1 ? [...this.uids] : undefined;
  }
}

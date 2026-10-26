/**
 * The solid trees' bakes kept in this browser between visits (IndexedDB), so
 * a second visit draws them back rather than baking them again: a PNG each,
 * which comes back to the pixel (a lossless WebP does not), with where it
 * stands and where in it there is anything.
 *
 * A picture cache and nothing else: no game state is ever put here, and the
 * game draws the same without it. Everything is thrown away when the tree
 * code changes (`__TREES3D__`, a hash of `./` and what it imports, written in
 * by the build) or the browser does, kept to `MOST_BYTES` with the least
 * lately used let go first, and any failure -- no IndexedDB, a private
 * window, a full disk -- turns it off quietly for the visit.
 */

declare const __TREES3D__: string | undefined;

/** The tree code's own hash, or nothing in a build that does not write one in: then nothing is kept. */
const CODE: string | undefined = typeof __TREES3D__ === 'string' ? __TREES3D__ : undefined;
/** Bytes of PNG kept at most: about 1,700 bakes. */
const MOST_BYTES = 64_000_000;
const DB = 'wurm-trees3d';

export interface Stored {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  ax: number;
  ay: number;
  ink: [number, number, number, number];
}

interface Meta {
  bytes: number;
  at: number;
}

let db: IDBDatabase | null = null;
let opening: Promise<boolean> | null = null;
let off = CODE === undefined;
/** What is kept, by bake key: its size and when it was last used. */
const index = new Map<string, Meta>();
let bytes = 0;
/** Keys whose last use has moved and is not yet written down. */
const touched = new Set<string>();

const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((ok, no) => {
  r.onsuccess = () => ok(r.result);
  r.onerror = () => no(r.error);
});
const done = (tx: IDBTransaction): Promise<void> => new Promise((ok, no) => {
  tx.oncomplete = () => ok();
  tx.onerror = () => no(tx.error);
  tx.onabort = () => no(tx.error);
});
function quit(): void {
  off = true;
  index.clear();
  try {
    db?.close();
  } catch {
    // Already gone.
  }
  db = null;
}

/** Opened once a visit, with what it holds read into `index`; false when there is nothing to keep bakes in. */
export function openStore(): Promise<boolean> {
  if (off) return Promise.resolve(false);
  if (opening) return opening;
  opening = (async () => {
    try {
      if (typeof indexedDB === 'undefined' || typeof createImageBitmap === 'undefined') throw new Error('no store');
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('pics');
        open.result.createObjectStore('meta');
      };
      db = await req(open);
      const version = `${CODE}|${navigator.userAgent}`;
      const tx = db.transaction('meta', 'readonly');
      const meta = tx.objectStore('meta');
      const [keys, vals] = await Promise.all([req(meta.getAllKeys()), req(meta.getAll())]);
      let was = '';
      keys.forEach((k, i) => {
        if (k === '__version') was = String(vals[i]);
        else index.set(String(k), vals[i] as Meta);
      });
      if (was !== version) {
        index.clear();
        const w = db.transaction(['pics', 'meta'], 'readwrite');
        w.objectStore('pics').clear();
        w.objectStore('meta').clear();
        w.objectStore('meta').put(version, '__version');
        await done(w);
      }
      bytes = 0;
      for (const m of index.values()) bytes += m.bytes;
      return true;
    } catch {
      quit();
      return false;
    }
  })();
  return opening;
}

/** Whether a bake is kept here, so it is fetched (`fetchStored`) rather than baked. */
export const isStored = (key: string): boolean => !off && db !== null && index.has(key);

/** A kept bake, drawn back onto a canvas of its own; null when it is not there or will not come back. */
export async function fetchStored(key: string): Promise<Stored | null> {
  if (!isStored(key) || !db) return null;
  try {
    const got = (await req(db.transaction('pics', 'readonly').objectStore('pics').get(key))) as
      | { blob: Blob; w: number; h: number; ax: number; ay: number; ink: [number, number, number, number] }
      | undefined;
    if (!got) {
      forget(key);
      return null;
    }
    const bmp = await createImageBitmap(got.blob, { premultiplyAlpha: 'default', colorSpaceConversion: 'none' });
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('no 2d context');
    g.drawImage(bmp, 0, 0);
    bmp.close();
    const m = index.get(key);
    if (m) {
      m.at = Date.now();
      touched.add(key);
    }
    return { canvas, w: got.w, h: got.h, ax: got.ax, ay: got.ay, ink: got.ink };
  } catch {
    forget(key);
    return null;
  }
}

function forget(key: string): void {
  const m = index.get(key);
  if (!m) return;
  index.delete(key);
  bytes -= m.bytes;
  try {
    const w = db?.transaction(['pics', 'meta'], 'readwrite');
    w?.objectStore('pics').delete(key);
    w?.objectStore('meta').delete(key);
  } catch {
    quit();
  }
}

/** A new bake put away, as a PNG, the least lately used let go to make room. */
export async function putStored(key: string, s: Stored): Promise<void> {
  if (off || !db || index.has(key)) return;
  try {
    const blob = await new Promise<Blob | null>((ok) => s.canvas.toBlob(ok, 'image/png'));
    if (!blob || !db || index.has(key)) return;
    const gone: string[] = [];
    if (bytes + blob.size > MOST_BYTES) {
      const old = [...index.entries()].sort((a, b) => a[1].at - b[1].at);
      for (const [k, m] of old) {
        if (bytes + blob.size <= MOST_BYTES * 0.9) break;
        gone.push(k);
        index.delete(k);
        bytes -= m.bytes;
      }
    }
    const meta: Meta = { bytes: blob.size, at: Date.now() };
    index.set(key, meta);
    bytes += blob.size;
    const w = db.transaction(['pics', 'meta'], 'readwrite');
    for (const k of gone) {
      w.objectStore('pics').delete(k);
      w.objectStore('meta').delete(k);
    }
    w.objectStore('pics').put({ blob, w: s.w, h: s.h, ax: s.ax, ay: s.ay, ink: s.ink }, key);
    w.objectStore('meta').put(meta, key);
    for (const k of touched) {
      const m = index.get(k);
      if (m) w.objectStore('meta').put(m, k);
    }
    touched.clear();
    await done(w);
  } catch {
    // Full, or gone: nothing more is kept this visit.
    quit();
  }
}

/** What is kept: for a harness. */
export const storeStats = (): { on: boolean; n: number; bytes: number } => ({ on: !off && db !== null, n: index.size, bytes });

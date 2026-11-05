import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { captchaOptions } from './captcha';
import { queueReport } from './errors';

/**
 * Which island keeper to talk to.
 *
 * The publishable key is meant to be public — it identifies the project and
 * nothing else, and every door it can reach is guarded by row level security
 * and by the rules in `supabase/migrations`. A client holding it can read the
 * island and call eight functions, all of which check who is asking and what
 * they are asking for. It is the `service_role` key that must never be near a
 * static site, and it is not here.
 */
export const PROJECT = {
  url: 'https://glebtboagnafcgwjjvfy.supabase.co',
  key: 'sb_publishable_10_lQyHkKqBQ9F6rYuJehw_9rNaCtz3',
} as const;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(PROJECT.url, PROJECT.key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'wurm.auth' },
      // Twice a second is plenty for other people's bodies and far more than
      // the ground needs; the default of ten is a lot of wake-ups for nothing.
      realtime: { params: { eventsPerSecond: 5 } },
      global: { fetch: watchedFetch },
    });
  }
  return client;
}

/**
 * Whether the island is taking changes at all.
 *
 * On 09-25 its database filled and went read-only, and every door that
 * writes answered "cannot execute UPDATE in a read-only transaction": one
 * line in the log for every step and every click, in the database's words,
 * and nothing to say that it was the island and not the player. Postgres says
 * that with SQLSTATE 25006 whichever door it is, so it is watched for here,
 * once, on the way back from every call, rather than at each of the fifty
 * places that make one.
 *
 * It clears when a door that was refused for it answers again, which is the
 * only sign that writing works: a door that only reads is let through
 * read-only and would say nothing either way.
 */
export const READ_ONLY = '25006';

/** The line under the banner, and in the log when an action is refused for it. */
export const CANNOT_SAVE = "The island can't save right now. Until it can, nothing you do is kept.";

const refused = new Set<string>();
const savingWatchers = new Set<(saving: boolean) => void>();

/** Be told when the island stops taking changes and when it starts again. */
export function onSaving(watch: (saving: boolean) => void): () => void {
  savingWatchers.add(watch);
  return () => savingWatchers.delete(watch);
}

/**
 * The key every call to a door carries (`private.once` on the island), and the answer to a key it has
 * already taken. A call sent again after a network error carries the key it was first sent with, so the
 * island does what it asks once.
 */
export const ONCE_HEADER = 'x-wurm-once';
export const ONCE_TAKEN = 'WK409';
/** Waits before each try again of a call the network dropped, in milliseconds. */
export const ONCE_RETRIES = [300, 1200] as const;
/** Statuses a call is tried again on: the gateway's, which say nothing about whether the island did it. */
const RETRY_STATUS = new Set([502, 503, 504]);

const newKey = (): string => crypto.randomUUID();

/**
 * One device at a time on an account (`private.seat_check` on the island).
 *
 * A game tab holds the account's seat and sends it with every call (`SEAT_HEADER`): a fresh one for each tab,
 * kept in the tab's own session storage so a reload keeps the seat it had. Pages that are not the game -- the
 * account page, the stud book -- send none and are not asked. A call refused for another device's seat says
 * `SEAT_ELSEWHERE`, and whoever is watching (`onElsewhere`) is told; `takeSeat` is Play here.
 */
export const SEAT_HEADER = 'x-wurm-seat';
export const SEAT_ELSEWHERE = 'Playing on another device.';
/** Seconds a seat goes unheard before another device may take it by calling: the island's `seat_stale`. */
export const SEAT_STALE_S = 45;
const SEAT_KEY = 'wurm.seat';
let seat: string | null = null;
const elsewhereWatchers = new Set<() => void>();

/** Hold a seat in this tab: every call from here on carries it. The game page, once, before its first call. */
export function holdSeat(): void {
  if (seat) return;
  try {
    seat = sessionStorage.getItem(SEAT_KEY);
  } catch {
    seat = null;
  }
  if (!seat || !/^[0-9a-f-]{36}$/i.test(seat)) {
    seat = newKey();
    try {
      sessionStorage.setItem(SEAT_KEY, seat);
    } catch {
      // A tab that keeps nothing holds its seat until it is closed or reloaded.
    }
  }
}

/** The seat this tab holds, or null: not a game tab. */
export const heldSeat = (): string | null => seat;

/** Be told when the island refuses this tab for another device's seat, or says another device took it. */
export function onElsewhere(watch: () => void): () => void {
  elsewhereWatchers.add(watch);
  return () => elsewhereWatchers.delete(watch);
}

/** Tell the watchers: this tab no longer holds the seat. */
export function seatLost(): void {
  for (const watch of elsewhereWatchers) watch();
}

/** Play here: the seat to this tab, and the other device told (`rpc_take_seat`). Null when done, else why not. */
export async function takeSeat(): Promise<string | null> {
  holdSeat();
  const { data, error } = await supabase().rpc('rpc_take_seat');
  if (error) return error.message;
  return (data as { why?: string } | null)?.why ?? null;
}

/** The call as sent, carrying this tab's seat when it holds one. */
const seated = (init?: RequestInit): RequestInit | undefined => {
  if (!seat) return init;
  const headers = new Headers(init?.headers);
  headers.set(SEAT_HEADER, seat);
  return { ...init, headers };
};

/**
 * Whether calls carry keys. A gateway that will not let the header through answers every call with it as
 * a dropped connection; found so once -- every try with the key dropped, the same call without it
 * answered -- the rest of the session's calls go without, and the island is told.
 */
let keyed = true;

/**
 * A call to a door: with its key, tried again with the same key when the network drops it or the gateway
 * answers for it, and a key the island has already taken answered as an empty success, said to nobody --
 * the first try did the thing, and its answer is what was lost.
 */
async function onceFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!keyed) return fetch(input, init);
  const headers = new Headers(init?.headers);
  if (!headers.has(ONCE_HEADER)) headers.set(ONCE_HEADER, newKey());
  const sent: RequestInit = { ...init, headers };
  for (let i = 0; ; i++) {
    let res: Response | null = null;
    try {
      res = await fetch(input, sent);
    } catch (err) {
      if (init?.signal?.aborted) throw err;
      if (i >= ONCE_RETRIES.length) {
        const bare = await fetch(input, init).catch(() => null);
        if (!bare) throw err;
        keyed = false;
        queueReport(`Calls with ${ONCE_HEADER} were dropped and one without it was answered: calls go without keys.`);
        return bare;
      }
    }
    if (res && (!RETRY_STATUS.has(res.status) || i >= ONCE_RETRIES.length)) {
      if (res.ok) return res;
      const body = (await res.clone().json().catch(() => null)) as { code?: string } | null;
      if (body?.code !== ONCE_TAKEN) return res;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    await new Promise((done) => setTimeout(done, ONCE_RETRIES[i]));
  }
}

/** Exported for supabase/test/saving.ts and once.ts, which ask it with a stand-in `fetch`. */
export async function watchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const door = /\/rest\/v1\/rpc\/([\w]+)/.exec(url)?.[1];
  if (!door) return fetch(input, init);
  const res = await onceFetch(input, seated(init));
  if (res.ok) {
    if (refused.has(door)) {
      refused.clear();
      for (const watch of savingWatchers) watch(true);
    }
  } else {
    const body = (await res.clone().json().catch(() => null)) as { code?: string; message?: string } | null;
    if (body?.message === SEAT_ELSEWHERE) seatLost();
    if (body?.code === READ_ONLY) {
      const was = refused.size;
      refused.add(door);
      if (was === 0) for (const watch of savingWatchers) watch(false);
    }
  }
  return res;
}

/**
 * Who this browser is, as far as the island is concerned.
 *
 * Anonymous, and durable: Supabase hands out a real account with a real
 * `auth.uid()` and no sign-up screen, and the session is kept in local storage
 * so tomorrow's visit is the same person as today's. It is the durable `who`
 * the old host-and-guest code kept on the client, except that this one the
 * database can check rather than take on trust — which is the whole reason row
 * level security has anything to stand on.
 */
export async function signIn(): Promise<string> {
  const sb = supabase();
  const had = await sb.auth.getSession();
  if (had.data.session?.user?.id) return had.data.session.user.id;
  const { data, error } = await sb.auth.signInAnonymously({ options: await captchaOptions() });
  if (error || !data.user) throw new Error(`Could not reach the island keeper: ${error?.message ?? 'no account'}`);
  return data.user.id;
}

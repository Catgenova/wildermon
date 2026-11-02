/**
 * Asking the island the newest way it is not known to lack, and finding out again when it may have learnt it.
 *
 * The site goes out before the migrations it pairs with, so a page opened in between is told "no such function"
 * (PostgREST `PGRST202`) of the new form of a read and asks the old way. That held for the rest of the page's life:
 * an island that took the migration a minute later was still asked the old way by every page opened in that
 * minute, until each was reloaded. Now a form found missing is passed over for `RETRY_NEWER` seconds and then asked
 * again.
 */

/** How long a form of a read the island said it lacked is passed over before it is asked again, in seconds. */
export const RETRY_NEWER = 120;

/** An error as the client hands one back. */
export interface AskError {
  code?: string;
  message: string;
}

/** Whether an error says the island has no such function, or no such argument as `says` names. */
export const lacks = (error: AskError | null | undefined, says: RegExp): boolean =>
  !!error && (error.code === 'PGRST202' || says.test(error.message));

/** Whether a newer form of a read is passed over just now, and until when. */
export class Lacked {
  private until = -Infinity;

  constructor(private readonly retry = RETRY_NEWER) {}

  /** Passed over at `now` (seconds). */
  on(now: number): boolean {
    return now < this.until;
  }

  /** The island said it lacks it at `now`: passed over until `retry` seconds on. */
  trip(now: number): void {
    this.until = now + this.retry;
  }

  /** Asked the newest way again from the next ask (a new island, say). */
  clear(): void {
    this.until = -Infinity;
  }
}

/** One form of a read: its arguments, what passes it over (none for the oldest), and the words of a refusal of it. */
export interface Form {
  args: Record<string, unknown>;
  lacked: Lacked | null;
  says: RegExp;
}

/**
 * Ask the newest of `forms` not passed over at `now`; on "no such function" of it, pass it over and ask the next.
 * Gives back the answer, and which form it is an answer to.
 */
export async function askDown(
  forms: readonly Form[],
  now: number,
  call: (args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: AskError | null }>,
): Promise<{ data: unknown; error: AskError | null; form: number }> {
  let last: { data: unknown; error: AskError | null; form: number } = { data: null, error: { message: 'not asked' }, form: -1 };
  for (let i = 0; i < forms.length; i++) {
    const f = forms[i];
    if (f.lacked?.on(now) && i < forms.length - 1) continue;
    const { data, error } = await call(f.args);
    last = { data, error, form: i };
    if (f.lacked && i < forms.length - 1 && lacks(error, f.says)) {
      f.lacked.trip(now);
      continue;
    }
    return last;
  }
  return last;
}

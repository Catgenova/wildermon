import type { PostgrestError } from '@supabase/supabase-js';
import type { Rpc } from './rpc.gen';
import { supabase } from './supabase';

/**
 * Every call to a door on the island, checked against the island's own
 * signatures (`rpc.gen.ts`, written from the database by
 * `scripts/rpc-types.mjs`): a name the island has no door for, an argument it
 * does not take, or one of the wrong type fails to typecheck rather than
 * coming back from PostgREST as "no such function".
 */
export type { Rpc };
export type RpcName = keyof Rpc;
export type RpcArgs<N extends RpcName> = Rpc[N]['args'];
/** The doors that act on one island, and the rest of what they take once that island is said. */
export type WorldDoor = { [N in RpcName]: Rpc[N]['args'] extends { p_world: string } ? N : never }[RpcName];
export type DoorArgs<N extends WorldDoor> = Omit<Rpc[N]['args'], 'p_world'>;

/** What a door answers: its value, or the error PostgREST gave. */
export interface RpcAnswer<N extends RpcName> {
  data: Rpc[N]['returns'] | null;
  error: PostgrestError | null;
}

/** A door that takes nothing may be called with nothing. */
type ArgsOf<N extends RpcName> = {} extends Rpc[N]['args'] ? [args?: Rpc[N]['args']] : [args: Rpc[N]['args']];

/**
 * Call the door `name` with `args`. The client is looked up on each call,
 * which is what lets a test put its own `rpc` on it.
 */
export async function rpc<N extends RpcName>(name: N, ...args: ArgsOf<N>): Promise<RpcAnswer<N>> {
  const { data, error } = await supabase().rpc(name, args[0] ?? {});
  return { data: data as Rpc[N]['returns'] | null, error };
}

/** `rpc` for a door on one island: `p_world` put in front of the rest. */
export function rpcIn<N extends WorldDoor>(name: N, world: string, args: DoorArgs<N>): Promise<RpcAnswer<N>> {
  // `Omit` and the key put back are the same object; TypeScript does not see through a generic `Omit`.
  return rpc<N>(name, ...([{ p_world: world, ...args }] as unknown as ArgsOf<N>));
}

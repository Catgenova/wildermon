import { CODE_DIGITS, CODE_SECONDS } from '../game/keeper';
import { supabase } from './supabase';

/**
 * Two-step sign-in: an authenticator app's six-digit code (TOTP) on top of the
 * password, through Supabase Auth's MFA API.
 *
 * Any named account may turn it on from the account page. It matters to a
 * keeper: with a verified code on the account, every keeper door
 * (`rpc_owner_*` but `rpc_owner_am_i`) refuses until this session has been
 * through the code (`aal2` in its token). Without one they work as before.
 * Playing never asks for it.
 */

export { CODE_DIGITS, CODE_SECONDS };
/** What the factor is called in the authenticator app. */
const FRIENDLY = 'Wildermon';

/** The verified authenticator on this account, or null; from Auth itself, not the stored session. */
export async function myFactor(): Promise<{ id: string } | null> {
  const { data, error } = await supabase().auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  const f = data.totp[0];
  return f ? { id: f.id } : null;
}

/** Whether this session has been through the code. */
async function hasCode(): Promise<boolean> {
  const { data, error } = await supabase().auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(error.message);
  return data.currentLevel === 'aal2';
}

/** Whether keeper tools will want the code: a verified authenticator, and a session that has not given it. */
export async function codeNeeded(): Promise<boolean> {
  if (await hasCode()) return false;
  return (await myFactor()) !== null;
}

/** A code as typed, or null when it is not six digits. */
export const cleanCode = (raw: string): string | null => {
  const c = raw.replace(/\s+/g, '');
  return new RegExp(`^\\d{${CODE_DIGITS}}$`).test(c) ? c : null;
};

const badCode = `Code: ${CODE_DIGITS} digits.`;

/** Auth's refusals, shortened. */
function said(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid') && (m.includes('code') || m.includes('totp'))) return 'Wrong code, or too old. Try the current one.';
  if (m.includes('rate') || m.includes('too many')) return 'Too many tries: wait a minute.';
  if (m.includes('aal2')) return 'Enter the current code first.';
  return message;
}

async function check(factorId: string, raw: string): Promise<void> {
  const code = cleanCode(raw);
  if (!code) throw new Error(badCode);
  const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw new Error(said(error.message));
}

/** Give the code for this session: keeper tools open until the session ends. */
export async function giveCode(raw: string): Promise<void> {
  const f = await myFactor();
  if (!f) throw new Error('No authenticator on this account.');
  await check(f.id, raw);
}

/** A new authenticator, not yet confirmed: what to scan or type into the app. */
export interface Enrolment {
  id: string;
  /** An image (SVG data URL) of the QR code. */
  qr: string;
  /** The same secret, to type in. */
  secret: string;
}

/**
 * Start turning it on. Any half-made authenticator from an earlier try goes
 * first: Auth refuses a second one under the same name.
 */
export async function startEnrol(): Promise<Enrolment> {
  const sb = supabase();
  const { data: list, error: listed } = await sb.auth.mfa.listFactors();
  if (listed) throw new Error(listed.message);
  if (list.totp.length) throw new Error('Two-step sign-in is already on.');
  for (const f of list.all) {
    if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: FRIENDLY, issuer: FRIENDLY });
  if (error) throw new Error(said(error.message));
  return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Finish turning it on with the first code from the app. The session counts as having given it. */
export async function finishEnrol(id: string, raw: string): Promise<void> {
  await check(id, raw);
}

/**
 * Turn it off. Auth only lets a session that has given the code remove the
 * authenticator, so the code is asked for here when it has not.
 */
export async function removeFactor(raw: string): Promise<void> {
  const f = await myFactor();
  if (!f) return;
  if (!(await hasCode())) await check(f.id, raw);
  const sb = supabase();
  const { error } = await sb.auth.mfa.unenroll({ factorId: f.id });
  if (error) throw new Error(said(error.message));
  // The token keeps saying aal2 until it is refreshed.
  await sb.auth.refreshSession();
}

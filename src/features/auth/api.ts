import { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/env';
import { digitsOnly, isEmail, Sector, toE164 } from './schemas';
import type { Language } from '@/locales';

export type OtpChannel = { kind: 'email'; email: string } | { kind: 'phone'; phone: string };

export class AppError extends Error {}

// Maps Supabase/network failures to translation keys under "errors.*".
export function toErrorKey(e: unknown): string {
  if (!isSupabaseConfigured) return 'errors.notConfigured';
  if (e instanceof AppError) return e.message;
  const err = e as Partial<AuthError> & { message?: string };
  const code = err?.code ?? '';
  const msg = (err?.message ?? '').toLowerCase();
  if (err?.name === 'AuthRetryableFetchError' || msg.includes('network') || msg.includes('fetch')) return 'errors.network';
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'errors.invalidCredentials';
  if (code === 'otp_expired' || msg.includes('expired') || msg.includes('invalid otp') || msg.includes('token has expired')) return 'errors.otpInvalid';
  if (code === 'user_already_exists' || code === 'email_exists' || code === 'phone_exists' || msg.includes('already registered')) return 'errors.userExists';
  if (code.startsWith('over_') || msg.includes('rate limit')) return 'errors.rateLimited';
  if (code === 'email_not_confirmed' || code === 'phone_not_confirmed') return 'errors.notConfirmed';
  if (code === 'sms_send_failed' || code === 'phone_provider_disabled') return 'errors.smsUnavailable';
  if (code === 'weak_password') return 'validation.passwordMin';
  if (code === 'same_password') return 'errors.samePassword';
  return 'errors.generic';
}

function guard() {
  if (!isSupabaseConfigured) throw new AppError('errors.notConfigured');
}

export async function signIn(identifier: string, password: string) {
  guard();
  const creds = isEmail(identifier) ? { email: identifier.trim(), password } : { phone: toE164(identifier), password };
  const { error } = await supabase.auth.signInWithPassword(creds);
  if (error) throw error;
}

type RegisterArgs = { fullName: string; mobile: string; email: string; password: string; sectors: Sector[]; language: Language };

// Email is the default OTP channel (works on Supabase's free tier); phone OTP needs an SMS provider in the dashboard.
export async function register(a: RegisterArgs): Promise<{ channel: OtpChannel; needsOtp: boolean }> {
  guard();
  const data = { full_name: a.fullName.trim(), phone: toE164(a.mobile), sectors: a.sectors, preferred_language: a.language };
  const email = a.email.trim();
  const res = email
    ? await supabase.auth.signUp({ email, password: a.password, options: { data } })
    : await supabase.auth.signUp({ phone: toE164(a.mobile), password: a.password, options: { data } });
  if (res.error) throw res.error;
  // Supabase returns a user with no identities for an already-registered email (anti-enumeration).
  if (res.data.user && res.data.user.identities?.length === 0) throw new AppError('errors.userExists');
  const channel: OtpChannel = email ? { kind: 'email', email } : { kind: 'phone', phone: toE164(a.mobile) };
  return { channel, needsOtp: !res.data.session };
}

export async function verifySignupOtp(channel: OtpChannel, token: string) {
  guard();
  const { error } = channel.kind === 'email'
    ? await supabase.auth.verifyOtp({ email: channel.email, token, type: 'signup' })
    : await supabase.auth.verifyOtp({ phone: channel.phone, token, type: 'sms' });
  if (error) throw error;
}

export async function resendSignupOtp(channel: OtpChannel) {
  guard();
  const { error } = channel.kind === 'email'
    ? await supabase.auth.resend({ type: 'signup', email: channel.email })
    : await supabase.auth.resend({ type: 'sms', phone: channel.phone });
  if (error) throw error;
}

export function recoveryChannel(identifier: string): OtpChannel {
  return isEmail(identifier) ? { kind: 'email', email: identifier.trim() } : { kind: 'phone', phone: toE164(digitsOnly(identifier)) };
}

export async function startRecovery(channel: OtpChannel) {
  guard();
  const { error } = channel.kind === 'email'
    ? await supabase.auth.resetPasswordForEmail(channel.email)
    : await supabase.auth.signInWithOtp({ phone: channel.phone, options: { shouldCreateUser: false } });
  if (error) throw error;
}

export async function completeRecovery(channel: OtpChannel, token: string, newPassword: string) {
  guard();
  const v = channel.kind === 'email'
    ? await supabase.auth.verifyOtp({ email: channel.email, token, type: 'recovery' })
    : await supabase.auth.verifyOtp({ phone: channel.phone, token, type: 'sms' });
  if (v.error) throw v.error;
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

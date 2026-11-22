const mockAuth = { resetPasswordForEmail: jest.fn(), verifyOtp: jest.fn(), updateUser: jest.fn(), signInWithOtp: jest.fn() };
jest.mock('@/lib/env', () => ({ isSupabaseConfigured: true, env: {} }));
jest.mock('@/lib/supabase', () => ({ supabase: { get auth() { return mockAuth; } } })); // getter: factory runs before mockAuth is initialised
import { completeRecovery, recoveryChannel, startRecovery, toErrorKey } from '@/features/auth/api';
import { forgotSchema } from '@/features/auth/schemas';

beforeEach(() => Object.values(mockAuth).forEach((f) => f.mockReset().mockResolvedValue({ data: {}, error: null })));

it('forgot form accepts only an email', () => {
  expect(forgotSchema.safeParse({ email: 'ramesh@farm.in' }).success).toBe(true);
  expect(forgotSchema.safeParse({ email: '9876543210' }).success).toBe(false);
});

it('sends the recovery code by email', async () => {
  await startRecovery(recoveryChannel(' ramesh@farm.in '));
  expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('ramesh@farm.in');
});

it('verifies the 6-digit code as a recovery OTP, then sets the new password', async () => {
  await completeRecovery({ kind: 'email', email: 'ramesh@farm.in' }, '482913', 'NewPass123');
  expect(mockAuth.verifyOtp).toHaveBeenCalledWith({ email: 'ramesh@farm.in', token: '482913', type: 'recovery' });
  expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'NewPass123' });
});

it('never changes the password when the code is wrong or expired', async () => {
  mockAuth.verifyOtp.mockResolvedValue({ data: {}, error: { code: 'otp_expired', message: 'Token has expired or is invalid' } });
  await expect(completeRecovery({ kind: 'email', email: 'a@b.in' }, '000000', 'NewPass123')).rejects.toBeTruthy();
  expect(mockAuth.updateUser).not.toHaveBeenCalled();
});

it.each([
  [{ code: 'otp_expired' }, 'errors.otpInvalid'],
  [{ code: 'over_email_send_rate_limit' }, 'errors.rateLimited'],
  [{ code: 'same_password' }, 'errors.samePassword'],
  [{ code: 'weak_password' }, 'validation.passwordMin'],
])('maps %o → %s', (err, key) => expect(toErrorKey(err)).toBe(key));

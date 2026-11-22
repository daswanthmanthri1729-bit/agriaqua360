import { digitsOnly, loginSchema, profileSetupSchema, registerSchema, resetSchema, toE164 } from '@/features/auth/schemas';

const valid = { fullName: 'Ramesh Kumar', mobile: '98765 43210', email: '', password: 'secret123', confirmPassword: 'secret123', sectors: ['agriculture'], acceptTerms: true };
const issue = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, field: string) =>
  r.error?.issues.find((i) => i.path[0] === field)?.message;

describe('phone normalisation', () => {
  it.each([['9876543210', '9876543210'], ['+91 98765 43210', '9876543210'], ['09876543210', '9876543210']])('%s', (i, o) => expect(digitsOnly(i)).toBe(o));
  it('builds E.164', () => expect(toE164('98765-43210')).toBe('+919876543210'));
});

describe('loginSchema', () => {
  it('accepts mobile or email', () => {
    expect(loginSchema.safeParse({ identifier: '9876543210', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ identifier: 'a@farm.in', password: 'x' }).success).toBe(true);
  });
  it('rejects junk identifiers and empty password', () => {
    expect(issue(loginSchema.safeParse({ identifier: '12345', password: 'x' }), 'identifier')).toBe('validation.identifier');
    expect(issue(loginSchema.safeParse({ identifier: '9876543210', password: '' }), 'password')).toBe('validation.required');
  });
});

describe('registerSchema', () => {
  it('accepts a valid farmer', () => expect(registerSchema.safeParse(valid).success).toBe(true));
  it('rejects mismatched passwords', () => expect(issue(registerSchema.safeParse({ ...valid, confirmPassword: 'other123' }), 'confirmPassword')).toBe('validation.passwordMatch'));
  it('rejects short passwords', () => expect(issue(registerSchema.safeParse({ ...valid, password: 'abc', confirmPassword: 'abc' }), 'password')).toBe('validation.passwordMin'));
  it('rejects mobile not starting 6-9', () => expect(issue(registerSchema.safeParse({ ...valid, mobile: '1234567890' }), 'mobile')).toBe('validation.mobile'));
  it('requires a sector', () => expect(issue(registerSchema.safeParse({ ...valid, sectors: [] }), 'sectors')).toBe('validation.sectors'));
  it('requires terms', () => expect(issue(registerSchema.safeParse({ ...valid, acceptTerms: false }), 'acceptTerms')).toBe('validation.terms'));
  it('validates optional email', () => expect(issue(registerSchema.safeParse({ ...valid, email: 'nope' }), 'email')).toBe('validation.email'));
});

describe('otp/reset/profile', () => {
  it('reset needs 6 digits', () => expect(issue(resetSchema.safeParse({ code: '12a456', password: 'secret123', confirmPassword: 'secret123' }), 'code')).toBe('validation.otp'));
  it('profile numbers', () => {
    const base = { village: 'Kovur', district: 'Nellore', state: 'Andhra Pradesh', landAcres: '', experienceYears: '' };
    expect(profileSetupSchema.safeParse(base).success).toBe(true);
    expect(issue(profileSetupSchema.safeParse({ ...base, landAcres: '-2' }), 'landAcres')).toBe('validation.number');
    expect(issue(profileSetupSchema.safeParse({ ...base, village: '' }), 'village')).toBe('validation.required');
  });
});

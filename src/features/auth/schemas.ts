import { z } from 'zod';

// Messages are i18n keys; screens render them with t().
const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const EMAIL = z.string().trim().email('validation.email');

export const digitsOnly = (v: string) => v.replace(/\D/g, '').replace(/^(91|0)(?=[6-9]\d{9}$)/, '');
export const toE164 = (mobile: string) => `+91${digitsOnly(mobile)}`;
export const isEmail = (v: string) => EMAIL.safeParse(v).success;

const password = z.string().min(8, 'validation.passwordMin').max(72, 'validation.passwordMax');
const mobile = z.string().transform(digitsOnly).refine((v) => INDIAN_MOBILE.test(v), 'validation.mobile');

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'validation.required')
    .refine((v) => isEmail(v) || INDIAN_MOBILE.test(digitsOnly(v)), 'validation.identifier'),
  password: z.string().min(1, 'validation.required'),
});

export const SECTORS = ['agriculture', 'aquaculture', 'livestock'] as const;
export type Sector = (typeof SECTORS)[number];

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'validation.nameMin').max(80, 'validation.nameMax'),
    mobile,
    email: z.union([z.literal(''), EMAIL]),
    password,
    confirmPassword: z.string(),
    sectors: z.array(z.enum(SECTORS)).min(1, 'validation.sectors'),
    acceptTerms: z.literal(true, { message: 'validation.terms' }),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'validation.passwordMatch' });

export const forgotSchema = z.object({ email: EMAIL });

export const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'validation.otp') });

export const resetSchema = z
  .object({ code: z.string().regex(/^\d{6}$/, 'validation.otp'), password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'validation.passwordMatch' });

const optionalNumber = (max: number) =>
  z.string().trim().refine((v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= max), 'validation.number');

export const profileSetupSchema = z.object({
  village: z.string().trim().min(2, 'validation.required'),
  district: z.string().trim().min(2, 'validation.required'),
  state: z.string().trim().min(2, 'validation.required'),
  landAcres: optionalNumber(100000),
  experienceYears: optionalNumber(80),
});

export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type ProfileSetupInput = z.input<typeof profileSetupSchema>;

import type { Scheme } from '@/types/database';

/** Rule-based hint only — the official scheme site decides eligibility. */
export function eligibility(s: Scheme, ctx: { hasLand: boolean; hasCrop: boolean; species: string[]; sectors: string[] }): { level: 'likely' | 'check'; reason: string } {
  if (s.rules.requires_land && !ctx.hasLand) return { level: 'check', reason: 'schemes.why.land' };
  if (s.rules.crop_required && !ctx.hasCrop) return { level: 'check', reason: 'schemes.why.crop' };
  if (s.rules.species && !s.rules.species.some((x) => ctx.species.includes(x))) return { level: 'check', reason: 'schemes.why.species' };
  if (!s.sectors.some((x) => ctx.sectors.includes(x))) return { level: 'check', reason: 'schemes.why.sector' };
  return { level: 'likely', reason: 'schemes.why.match' };
}


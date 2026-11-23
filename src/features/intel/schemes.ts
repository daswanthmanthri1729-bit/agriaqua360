import type { Scheme } from '@/types/database';

/** Rule-based hint only — the official scheme site decides eligibility. */
export function eligibility(s: Scheme, ctx: { hasLand: boolean; hasCrop: boolean; species: string[]; sectors: string[] }): { level: 'likely' | 'check'; reason: string } {
  if (s.rules.requires_land && !ctx.hasLand) return { level: 'check', reason: 'schemes.why.land' };
  if (s.rules.crop_required && !ctx.hasCrop) return { level: 'check', reason: 'schemes.why.crop' };
  if (s.rules.species && !s.rules.species.some((x) => ctx.species.includes(x))) return { level: 'check', reason: 'schemes.why.species' };
  if (!s.sectors.some((x) => ctx.sectors.includes(x))) return { level: 'check', reason: 'schemes.why.sector' };
  return { level: 'likely', reason: 'schemes.why.match' };
}


export type Answers = { land: 'own' | 'tenant' | 'none'; crop: boolean; sectors: string[]; species: string[]; category: 'general' | 'sc_st' | 'woman'; taxPayer: boolean; govtEmployee: boolean };
/** Questionnaire check (stricter than the profile hint). 'no' only for published exclusions; otherwise likely/check. */
export function checkEligibility(code: string, a: Answers): { result: 'likely' | 'check' | 'no'; reason: string } {
  switch (code) {
    case 'pm_kisan':
      if (a.land !== 'own') return { result: 'no', reason: 'elig.r.needOwnLand' };
      if (a.taxPayer || a.govtEmployee) return { result: 'no', reason: 'elig.r.excluded' };
      return { result: 'likely', reason: 'elig.r.pmKisan' };
    case 'pmfby': return a.crop && a.land !== 'none' ? { result: 'likely', reason: 'elig.r.pmfby' } : { result: 'check', reason: 'elig.r.needCrop' };
    case 'kcc': return a.land !== 'none' || a.sectors.some((s) => s !== 'agriculture') ? { result: 'likely', reason: 'elig.r.kcc' } : { result: 'check', reason: 'elig.r.kccNoLand' };
    case 'soil_health_card': case 'pmksy_pdmc': case 'pm_kusum':
      return a.land === 'none' ? { result: 'check', reason: 'elig.r.needLand' } : { result: 'likely', reason: 'elig.r.landOk' };
    case 'pmmsy': return a.sectors.includes('aquaculture') ? { result: 'likely', reason: a.category === 'general' ? 'elig.r.pmmsy' : 'elig.r.pmmsyHigher' } : { result: 'check', reason: 'elig.r.needAqua' };
    case 'nlm': return a.sectors.includes('livestock') ? { result: 'likely', reason: 'elig.r.nlm' } : { result: 'check', reason: 'elig.r.needLivestock' };
    case 'rgm': return a.species.some((s) => s === 'cow' || s === 'buffalo') ? { result: 'likely', reason: 'elig.r.rgm' } : { result: 'check', reason: 'elig.r.needCattle' };
    default: return { result: 'check', reason: 'elig.r.general' };
  }
}
// Documents usually asked for (always confirm with the office/portal).
export const SCHEME_DOCS: Record<string, string[]> = {
  pm_kisan: ['aadhaar', 'land', 'bank'], pmfby: ['aadhaar', 'land', 'sowing', 'bank', 'tenant'], kcc: ['aadhaar', 'land', 'photo', 'bank', 'lease'],
  soil_health_card: ['aadhaar', 'land'], pmksy_pdmc: ['aadhaar', 'land', 'bank', 'quotation'], pm_kusum: ['aadhaar', 'land', 'bank'],
  aif: ['aadhaar', 'project', 'bank'], pmmsy: ['aadhaar', 'lease', 'project', 'bank', 'caste'], nlm: ['aadhaar', 'project', 'land', 'bank', 'training'], rgm: ['aadhaar', 'animal'],
};

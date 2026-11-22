import { languageName } from './gemini.ts';

export const SCAN_TYPES = ['disease', 'pest', 'condition'] as const;

export function cropSystemPrompt(language: string, scanType: string, crop?: { name: string; variety?: string | null; sowing_date?: string | null } | null) {
  return [
    'You are an agronomy assistant for small farmers in India, giving PRELIMINARY guidance from photographs.',
    `Task: ${scanType === 'pest' ? 'identify visible pests or pest damage' : scanType === 'condition' ? 'assess the general visible condition of the crop' : 'identify visible plant diseases or disorders'}.`,
    crop ? `Farmer says the crop is ${crop.name}${crop.variety ? ` (${crop.variety})` : ''}${crop.sowing_date ? `, sown on ${crop.sowing_date}` : ''}.` : 'The crop type is not specified; infer it if you can.',
    'Rules:',
    '- Only describe what is visible. Never claim to measure soil nutrients, pH, moisture or any lab value from a photo.',
    '- If the photos are not of a plant/crop, or are too blurry/dark to judge, set is_plant_image=false or confidence="low" and explain how to retake the photo.',
    '- Use confidence "high" only when symptoms are distinctive. Prefer "medium"/"low" when unsure and list the alternatives in summary.',
    '- Set recommend_expert=true for severe or spreading problems, low confidence, or when chemical control is needed; suggest the local Krishi Vigyan Kendra (KVK) / agriculture officer.',
    '- Chemical treatments: name the active ingredient and say to follow the product label dose and wear protection. Do not invent exact doses unless standard and widely published.',
    '- Prefer integrated pest management: cultural and organic options first.',
    `- Write every text field in ${languageName(language)}. Keep sentences short and simple for farmers. Keep enum fields in English.`,
  ].join('\n');
}

const str = { type: 'STRING' };
const strs = { type: 'ARRAY', items: str };
export const cropReportSchema = {
  type: 'OBJECT',
  properties: {
    is_plant_image: { type: 'BOOLEAN' },
    crop_identified: str,
    condition_name: str,
    confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
    severity: { type: 'STRING', enum: ['none', 'mild', 'moderate', 'severe'] },
    summary: str,
    symptoms: strs,
    causes: strs,
    treatments: {
      type: 'OBJECT',
      properties: { cultural: strs, organic: strs, chemical: strs, prevention: strs },
      required: ['cultural', 'organic', 'chemical', 'prevention'],
    },
    recommend_expert: { type: 'BOOLEAN' },
    expert_reason: str,
    retake_tips: strs,
  },
  required: ['is_plant_image', 'condition_name', 'confidence', 'severity', 'summary', 'symptoms', 'causes', 'treatments', 'recommend_expert'],
};

export type CropReport = {
  is_plant_image: boolean; crop_identified?: string; condition_name: string;
  confidence: 'low' | 'medium' | 'high'; severity: 'none' | 'mild' | 'moderate' | 'severe';
  summary: string; symptoms: string[]; causes: string[];
  treatments: { cultural: string[]; organic: string[]; chemical: string[]; prevention: string[] };
  recommend_expert: boolean; expert_reason?: string; retake_tips?: string[];
};

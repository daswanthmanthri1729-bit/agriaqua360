import * as Speech from 'expo-speech';
import { LANGUAGES, Language } from '@/locales';

/** Speaks `text` in the app language. Resolves false when the phone has no voice for it (common for Telugu). */
export async function speak(text: string, language: Language, cb: { onDone?: () => void } = {}): Promise<boolean> {
  Speech.stop();
  const tag = LANGUAGES.find((l) => l.code === language)!.speech;
  const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
  if (voices.length > 0 && !voices.some((v) => v.language?.toLowerCase().startsWith(tag.slice(0, 2)))) return false;
  Speech.speak(text, { language: tag, rate: 0.9, onDone: cb.onDone, onStopped: cb.onDone, onError: cb.onDone });
  return true;
}
export const stopSpeaking = () => Speech.stop();

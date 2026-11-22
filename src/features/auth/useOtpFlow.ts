import { create } from 'zustand';
import type { OtpChannel } from './api';

// Carries the OTP target between screens without putting emails/phones in the URL.
type Flow = { mode: 'signup' | 'recovery'; channel: OtpChannel } | null;
export const useOtpFlow = create<{ flow: Flow; set: (f: Flow) => void }>()((set) => ({ flow: null, set: (flow) => set({ flow }) }));

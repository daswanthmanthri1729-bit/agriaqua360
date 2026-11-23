// Write a notification row (shown in the app's notification centre, live via Realtime) and send a push
// through Expo when the user has a push token and has not turned the category off.
import { admin } from './server.ts';

export async function notifyUser(ownerId: string, n: { category: string; title: string; body?: string; route?: string; priority?: 'normal' | 'high'; data?: Record<string, unknown> }) {
  if (!admin) return;
  const [{ data: prefs }, { data: prof }] = await Promise.all([
    admin.from('user_preferences').select('notify').eq('owner_id', ownerId).maybeSingle(),
    admin.from('profiles').select('push_token').eq('id', ownerId).maybeSingle(),
  ]);
  if (prefs?.notify?.[n.category] === false) return;
  await admin.from('notifications').insert({ owner_id: ownerId, category: n.category, title: n.title, body: n.body ?? null, route: n.route ?? null, priority: n.priority ?? 'normal', data: n.data ?? {} })
    .then(({ error }) => error && console.warn('notify insert', error.message));
  const token = prof?.push_token as string | undefined;
  if (!token?.startsWith('ExponentPushToken[')) return; // raw FCM tokens from v1.0.0 can't be sent through Expo
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST', signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, title: n.title, body: n.body, sound: 'default', priority: n.priority === 'high' ? 'high' : 'default', channelId: 'default', data: { route: n.route, ...n.data } }),
  }).then(async (r) => { if (!r.ok) console.warn('expo push', r.status, (await r.text()).slice(0, 200)); }, (e) => console.warn('expo push', String(e)));
}

export async function languageOf(ownerId: string): Promise<string> {
  if (!admin) return 'en';
  const { data } = await admin.from('profiles').select('preferred_language').eq('id', ownerId).maybeSingle();
  return data?.preferred_language ?? 'en';
}

// Scheduled sweep (pg_cron → pg_net every 5 minutes; header x-cron-secret must match CRON_SECRET).
// - devices that stopped reporting → 'offline' alert + notification (once per outage)
// - pending equipment commands past their expiry → 'expired' (a late command must never run)
// - once a day: market prices for commodities farmers grow or watch, then price alerts
// - simulated readings older than 30 days are deleted (real readings are kept)
import { fail, json } from '../_shared/http.ts';
import { admin } from '../_shared/server.ts';
import { languageOf, notifyUser } from '../_shared/notify.ts';
import { alertText } from '../_shared/iot.ts';
import { commodityFor } from '../_shared/market.ts';
import { refresh } from '../_shared/marketApi.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!admin || !secret || req.headers.get('x-cron-secret') !== secret) return fail('unauthorized', 401);
  const now = Date.now();
  const report: Record<string, unknown> = {};

  // 1. Offline devices: silent for 3 reporting intervals (at least 15 minutes).
  const { data: devs } = await admin.from('sensor_devices').select('id, owner_id, name, is_simulated, last_seen_at, reporting_interval_s, farm_id, pond_id, animal_id')
    .is('offline_alerted_at', null).not('last_seen_at', 'is', null).lt('last_seen_at', new Date(now - 15 * 60_000).toISOString()).limit(500);
  let offline = 0;
  for (const d of devs ?? []) {
    if (d.is_simulated) continue;   // the simulator only runs when asked; silence is expected
    if (now - Date.parse(d.last_seen_at) < Math.max(900, d.reporting_interval_s * 3) * 1000) continue;
    await admin.from('sensor_devices').update({ offline_alerted_at: new Date(now).toISOString() }).eq('id', d.id);
    const { error } = await admin.from('sensor_alerts').insert({ owner_id: d.owner_id, device_id: d.id, farm_id: d.farm_id, pond_id: d.pond_id, animal_id: d.animal_id, kind: 'offline' });
    if (error) continue;
    const lang = await languageOf(d.owner_id);
    const since = new Date(d.last_seen_at).toLocaleString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    await notifyUser(d.owner_id, { category: 'device', priority: 'high', title: alertText('offline', lang, { d: d.name }), body: alertText('offline_body', lang, { t: since }), route: `/monitor/device/${d.id}` });
    offline++;
  }
  report.offline = offline;

  // 2. Expire stale commands.
  const { data: exp } = await admin.from('actuator_commands').update({ status: 'expired' }).eq('status', 'pending').lt('expires_at', new Date(now).toISOString()).select('id');
  report.expired_commands = exp?.length ?? 0;

  // 3. Daily market sync + price alerts (first run after 06:00 IST each day).
  const istHour = new Date(now + 5.5 * 3600_000).getUTCHours();
  const today = new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
  const { data: mark } = await admin.from('weather_cache').select('payload').eq('cache_key', 'cron:market').maybeSingle();
  if (Deno.env.get('DATA_GOV_IN_API_KEY') && istHour >= 6 && mark?.payload?.day !== today) {
    await admin.from('weather_cache').upsert({ cache_key: 'cron:market', payload: { day: today }, fetched_at: new Date().toISOString() });
    const [{ data: crops }, { data: alerts }] = await Promise.all([
      admin.from('crops').select('name, owner_id').in('status', ['planned', 'growing']).limit(2000),
      admin.from('price_alerts').select('*').eq('enabled', true).limit(2000),
    ]);
    const owners = [...new Set([...(crops ?? []).map((c) => c.owner_id), ...(alerts ?? []).map((a) => a.owner_id)])];
    const { data: profs } = owners.length ? await admin.from('profiles').select('id, state').in('id', owners) : { data: [] };
    const stateOf = new Map((profs ?? []).map((p) => [p.id, p.state ?? '']));
    const pairs = new Set<string>();
    for (const c of crops ?? []) { const com = commodityFor(c.name); if (com) pairs.add(`${com}|${stateOf.get(c.owner_id) ?? ''}`); }
    for (const a of alerts ?? []) pairs.add(`${a.commodity}|${a.state ?? ''}`);
    let synced = 0;
    for (const p of [...pairs].slice(0, 25)) {   // stay well inside data.gov.in rate limits
      const [com, st] = p.split('|');
      await refresh(com, st).then(() => synced++, (e) => console.warn('sync', p, String(e)));
    }
    report.market_synced = synced;

    let fired = 0;
    for (const a of alerts ?? []) {
      if (a.last_triggered_at && a.last_triggered_at.slice(0, 10) === today) continue;
      let q = admin.from('market_prices').select('modal_price, market, arrival_date').eq('commodity', a.commodity).gte('arrival_date', new Date(now - 3 * 86_400_000).toISOString().slice(0, 10));
      if (a.state) q = q.eq('state', a.state);
      if (a.market) q = q.eq('market', a.market);
      const { data: ps } = await q;
      if (!ps?.length) continue;
      const best = a.direction === 'above' ? ps.reduce((m, r) => (Number(r.modal_price) > Number(m.modal_price) ? r : m)) : ps.reduce((m, r) => (Number(r.modal_price) < Number(m.modal_price) ? r : m));
      const price = Number(best.modal_price);
      if (a.direction === 'above' ? price < Number(a.price) : price > Number(a.price)) continue;
      const lang = await languageOf(a.owner_id);
      const title = { en: `${a.commodity}: ₹${price}/qtl at ${best.market}`, te: `${a.commodity}: ${best.market}లో ₹${price}/క్వింటా`, hi: `${a.commodity}: ${best.market} में ₹${price}/क्विंटल` }[lang as 'en'] ?? '';
      const body = { en: `Your alert: ${a.direction} ₹${a.price}. Prices on ${best.arrival_date}; check the mandi before selling.`, te: `మీ అలర్ట్: ₹${a.price} ${a.direction === 'above' ? 'పైన' : 'కింద'}. ${best.arrival_date} ధరలు; అమ్మే ముందు మండీలో తనిఖీ చేయండి.`, hi: `आपका अलर्ट: ₹${a.price} से ${a.direction === 'above' ? 'ऊपर' : 'नीचे'}। ${best.arrival_date} के भाव; बेचने से पहले मंडी में जाँचें।` }[lang as 'en'];
      await notifyUser(a.owner_id, { category: 'market', title, body, route: '/insights/market', data: { commodity: a.commodity } });
      await admin.from('price_alerts').update({ last_triggered_at: new Date(now).toISOString() }).eq('id', a.id);
      fired++;
    }
    report.price_alerts = fired;
  }

  // 4. Housekeeping: simulated data is for demos and testing only.
  const { count } = await admin.from('sensor_readings').delete({ count: 'exact' }).eq('source', 'simulated').lt('recorded_at', new Date(now - 30 * 86_400_000).toISOString());
  report.simulated_deleted = count ?? 0;

  return json({ ok: true, ...report });
});

// Report & document centre — design: smart_farm_report_generator_document_center.
// Builds plain-text farm documents from the farmer's own records and shares them (WhatsApp, email, print apps).
import { useState } from 'react';
import { Share, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, ChoiceChips, Header, Screen } from '@/components';
import { useCrops, useFarms } from '@/features/agriculture/api';
import { usePonds } from '@/features/aquaculture/api';
import { useSoilTests, useTransactions } from '@/features/intel/api';
import { useAnimals, useVaccinations } from '@/features/livestock/api';
import { useReport } from '@/features/reports/api';
import { useSession } from '@/store/session';
import { addDays, formatDate, today } from '@/lib/dates';
import { colors, radius } from '@/theme';

const DOCS = ['summary', 'finance', 'livestock', 'ponds', 'soil'] as const;
type Doc = (typeof DOCS)[number];

export default function Documents() {
  const { t, i18n } = useTranslation();
  const profile = useSession((s) => s.profile);
  const [doc, setDoc] = useState<Doc>('summary');
  const [days, setDays] = useState(90);
  const from = addDays(today(), -days);
  const report = useReport(days); const farms = useFarms(); const crops = useCrops(); const ponds = usePonds();
  const animals = useAnimals(); const vaccs = useVaccinations(); const tx = useTransactions(from, today()); const soil = useSoilTests(farms.data?.[0]?.id ?? null);
  const d = (s: string) => formatDate(s, i18n.language);
  const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const head = [`AgriAqua 360 — ${t(`docs.kind.${doc}`)}`, `${profile?.full_name ?? ''} · ${[profile?.village, profile?.district, profile?.state].filter(Boolean).join(', ')}`, `${t('docs.period')}: ${d(from)} – ${d(today())}`, ''];
  const body: string[] = [];
  if (doc === 'summary') {
    const r = report.data;
    body.push(`${t('farms.registered')}: ${r?.agriculture.farms ?? 0} · ${r?.agriculture.acres ?? 0} ${t('common.acres')}`);
    (crops.data ?? []).forEach((c) => body.push(`• ${c.name}${c.variety ? ` (${c.variety})` : ''} — ${t(`crops.statuses.${c.status}`)}${c.sowing_date ? `, ${d(c.sowing_date)}` : ''}`));
    body.push('', `${t('perf.tasksDone')}: ${r?.agriculture.tasksDone ?? 0} · ${t('perf.scans')}: ${r?.agriculture.scans ?? 0}`);
    body.push(`${t('aqua.pondsCount', { count: r?.aquaculture.ponds ?? 0 })} · ${t('ponds.feedUsed')}: ${r?.aquaculture.feedKg ?? 0} kg`);
    body.push(`${t('livestock.animalsCount', { count: r?.livestock.animals ?? 0 })} · ${t('livestock.sick')}: ${r?.livestock.sick ?? 0}`);
  } else if (doc === 'finance') {
    const rows = tx.data ?? [];
    const inc = rows.filter((x) => x.kind === 'income').reduce((s, x) => s + Number(x.amount), 0), exp = rows.filter((x) => x.kind === 'expense').reduce((s, x) => s + Number(x.amount), 0);
    rows.forEach((x) => body.push(`${d(x.occurred_on)}  ${x.kind === 'income' ? '+' : '-'}${rupees(Number(x.amount))}  ${t(`finance.cat.${x.category}`)}${x.notes ? ` — ${x.notes}` : ''}`));
    body.push('', `${t('finance.income')}: ${rupees(inc)}`, `${t('finance.expense')}: ${rupees(exp)}`, `${t('finance.profit')}: ${rupees(inc - exp)}`);
  } else if (doc === 'livestock') {
    (animals.data ?? []).forEach((a) => {
      body.push(`• ${a.tag_id ?? ''} ${a.name ?? ''} — ${t(`livestock.species.${a.species}`)}${a.breed ? `, ${a.breed}` : ''} · ${t(`livestock.statuses.${a.status}`)}`);
      (vaccs.data ?? []).filter((v) => v.animal_id === a.id).forEach((v) => body.push(`    ${v.vaccine_name}: ${v.given_on ? d(v.given_on) : `${t('livestock.dueOn')} ${v.due_on ? d(v.due_on) : '—'}`}`));
    });
  } else if (doc === 'ponds') {
    (ponds.data ?? []).forEach((p) => {
      body.push(`• ${p.name} — ${p.species ?? ''} · ${p.area_acres ?? '—'} ${t('common.acresShort')}`);
      if (p.latest) body.push(`    ${d(p.latest.recorded_at.slice(0, 10))}: DO ${p.latest.dissolved_oxygen_mgl ?? '—'} · pH ${p.latest.ph ?? '—'} · ${p.latest.temperature_c ?? '—'}°C · NH3 ${p.latest.ammonia_mgl ?? '—'}`);
    });
  } else {
    (soil.data ?? []).forEach((s) => body.push(`• ${d(s.tested_on)} (${t(`soil.src.${s.source}`)}): pH ${s.ph ?? '—'}, EC ${s.ec_dsm ?? '—'}, OC ${s.organic_carbon_pct ?? '—'}%, N ${s.nitrogen_kg_ha ?? '—'}, P ${s.phosphorus_kg_ha ?? '—'}, K ${s.potassium_kg_ha ?? '—'} kg/ha`));
  }
  if (!body.length) body.push(t('docs.empty'));
  const text = [...head, ...body, '', t('docs.footer', { date: d(today()) })].join('\n');
  return (
    <Screen footer={<Button iconLeft="share" label={t('docs.share')} onPress={() => Share.share({ message: text, title: t(`docs.kind.${doc}`) })} />}>
      <Header title={t('docs.title')} />
      <ChoiceChips scroll value={doc} onChange={setDoc} options={DOCS.map((k) => ({ value: k, label: t(`docs.kind.${k}`) }))} />
      {(doc === 'summary' || doc === 'finance') && <ChoiceChips value={String(days)} onChange={(v) => setDays(Number(v))} options={[30, 90, 365].map((n) => ({ value: String(n), label: t(`range.${n === 365 ? '1y' : `${n}d`}`) }))} />}
      <Card style={{ backgroundColor: colors.surface }}>
        <View style={{ padding: 4, borderRadius: radius.md }}>
          <AppText variant="bodySm" selectable style={{ fontFamily: 'monospace' }}>{text}</AppText>
        </View>
      </Card>
      <Banner message={t('docs.help')} />
    </Screen>
  );
}

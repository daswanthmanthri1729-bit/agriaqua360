import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, Icon, Skeleton, SourceBadge } from '@/components';
import { ago } from '@/components/Freshness';
import { colors } from '@/theme';
import { useInsight } from './api';

const TONE = { good: { tone: 'normal', icon: 'check-circle' }, watch: { tone: 'warning', icon: 'visibility' }, act: { tone: 'error', icon: 'priority-high' } } as const;

/** AI analysis of the farmer's own data. Runs only when asked (AI quota), cached until the data changes. */
export function InsightCard({ kind, id, extra, title }: { kind: 'water' | 'soil' | 'crop' | 'livestock' | 'finance'; id: string | null; extra?: unknown; title?: string }) {
  const { t } = useTranslation();
  const [on, setOn] = useState(false);
  const q = useInsight(kind, id, extra, on);
  const d = q.data;
  return (
    <Card style={{ gap: 10, borderColor: colors.ai, borderWidth: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="auto-awesome" color={colors.ai} />
        <AppText variant="labelLg" style={{ flex: 1 }}>{title ?? t(`aiInsight.title.${kind}`)}</AppText>
        {d && <Chip tone={TONE[d.status].tone} icon={TONE[d.status].icon} label={t(`aiInsight.status.${d.status}`)} />}
      </View>
      {!on ? (
        <>
          <AppText variant="bodySm" color={colors.textMuted}>{t('aiInsight.intro')}</AppText>
          <Button variant="ai" iconLeft="auto-awesome" label={t('aiInsight.run')} onPress={() => setOn(true)} disabled={kind !== 'finance' && !id} />
        </>
      ) : q.isLoading ? <Skeleton height={100} /> : q.error && !d ? (
        <>
          <Banner tone="warning" message={t(q.error.message)} />
          <Button compact variant="secondary" iconLeft="refresh" label={t('common.retry')} onPress={() => q.refetch()} />
        </>
      ) : d ? (
        <>
          <AppText variant="bodyLg">{d.summary}</AppText>
          {!!d.findings.length && (
            <View style={{ gap: 4 }}>
              <AppText variant="labelMd" color={colors.textSubtle}>{t('aiInsight.findings')}</AppText>
              {d.findings.map((f, i) => <AppText key={i} variant="bodyMd">• {f}</AppText>)}
            </View>
          )}
          {!!d.actions.length && (
            <View style={{ gap: 4 }}>
              <AppText variant="labelMd" color={colors.textSubtle}>{t('aiInsight.actions')}</AppText>
              {d.actions.map((f, i) => <AppText key={i} variant="bodyMd">{i + 1}. {f}</AppText>)}
            </View>
          )}
          {d.see_expert && <Banner tone="warning" message={t(kind === 'livestock' ? 'aiInsight.seeVet' : 'aiInsight.seeExpert')} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <SourceBadge source="ai_estimate" />
            <AppText variant="labelSm" color={colors.textSubtle} style={{ flex: 1 }}>{t('aiInsight.basedOn', { what: d.data_used.map((k) => t(`aiInsight.data.${k}`)).join(', ') })} · {ago(d.generated_at, t)}</AppText>
          </View>
          <AppText variant="labelSm" color={colors.textSubtle}>{t('aiInsight.disclaimer')}</AppText>
        </>
      ) : null}
    </Card>
  );
}

// 19 · Disease Detection Results — Stitch: visual_search_agriaqua_360 (assessment panel)
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ErrorState, Header, LoadingList, Screen, StorageImage } from '@/components';
import { analyseScan, useIsSaved, useSaveRecord, useScan } from '@/features/agriculture/api';
import { colors, radius } from '@/theme';

const SEVERITY_TONE = { none: 'normal', mild: 'warning', moderate: 'warning', severe: 'error' } as const;

export default function ScanResult() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scan = useScan(id);
  const report = scan.data?.report[0];
  const saved = useIsSaved(report?.id);
  const save = useSaveRecord();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setRetrying(true); setError(null);
    try { await analyseScan(id); await scan.refetch(); } catch (e) { setError((e as Error).message); } finally { setRetrying(false); }
  };

  if (scan.isLoading) return <Screen><Header /><LoadingList height={160} /></Screen>;
  if (!scan.data) return <Screen><Header /><ErrorState onRetry={() => scan.refetch()} /></Screen>;
  const s = scan.data;
  const r = report?.raw_response;

  return (
    <Screen footer={report && r?.is_plant_image !== false ? (
      <>
        <Button testID="view-treatment" label={t('result.viewTreatment')} icon="arrow-forward" onPress={() => router.push(`/agriculture/scan/${id}/treatment`)} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} variant="tonal" iconLeft={saved.data ? 'bookmark' : 'bookmark-border'} label={saved.data ? t('result.saved') : t('result.save')}
            disabled={saved.data} loading={save.isPending} onPress={() => save.mutate({ id: report.id, title: report.condition_name ?? '' }, { onSuccess: () => saved.refetch() })} />
          <Button style={{ flex: 1 }} variant="secondary" iconLeft="document-scanner" label={t('result.scanAgain')} onPress={() => router.replace({ pathname: '/agriculture/scan', params: s.crop ? { cropId: s.crop.id } : {} })} />
        </View>
      </>
    ) : undefined}>
      <Header title={t('result.title')} />
      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {s.image_paths.map((p, i) => <StorageImage key={p} path={p} style={styles.img} label={`${t('scan.photos', { count: i + 1 })}`} />)}
      </ScrollView>

      {!report ? (
        <Card style={{ gap: 12, alignItems: 'center' }}>
          <AppText variant="headlineSm">{s.status === 'failed' ? t('result.failedTitle') : t('result.analysing')}</AppText>
          {error && <Banner tone="error" message={t(error)} />}
          <Button variant="ai" iconLeft="refresh" label={t('result.retry')} loading={retrying} onPress={retry} />
        </Card>
      ) : r?.is_plant_image === false ? (
        <>
          <Banner tone="warning" title={t('result.notPlant')} message={r.summary} />
          {!!r.retake_tips?.length && (
            <Card style={{ gap: 6 }}>
              <AppText variant="labelLg">{t('result.retake')}</AppText>
              {r.retake_tips.map((tip, i) => <AppText key={i} variant="bodyMd">• {tip}</AppText>)}
            </Card>
          )}
          <Button label={t('result.scanAgain')} iconLeft="document-scanner" onPress={() => router.replace('/agriculture/scan')} />
        </>
      ) : (
        <>
          <Banner tone="warning" title={t('result.preliminaryTitle')} message={t('result.preliminaryText')} />
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {report.severity && <Chip tone={SEVERITY_TONE[report.severity]} icon="warning-amber" label={t(`result.severity.${report.severity}`)} />}
              {report.confidence && <Chip tone="ai" icon="insights" label={t('result.confidence', { level: t(`result.levels.${report.confidence}`) })} />}
            </View>
            <AppText variant="display">{report.condition_name}</AppText>
            {(s.crop?.name || r?.crop_identified) && <AppText variant="bodyMd" color={colors.textMuted}>{t('result.crop')}: {s.crop?.name ?? r?.crop_identified}</AppText>}
            {!!report.summary && <AppText variant="bodyLg">{report.summary}</AppText>}
          </View>
          {!!report.symptoms?.length && (
            <Card style={{ gap: 8 }}>
              <AppText variant="labelLg">{t('result.symptoms')}</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{report.symptoms.map((x, i) => <Chip key={i} label={x} />)}</View>
            </Card>
          )}
          {!!r?.causes?.length && (
            <Card style={{ gap: 6 }}>
              <AppText variant="labelLg">{t('result.causes')}</AppText>
              {r.causes.map((x, i) => <AppText key={i} variant="bodyMd">• {x}</AppText>)}
            </Card>
          )}
          {report.recommend_expert && <Banner tone="error" title={t('result.expertTitle')} message={r?.expert_reason || t('result.expertDefault')} />}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ img: { width: 200, height: 160, borderRadius: radius.lg } });

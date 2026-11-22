// 25 · Fish Health Scanner — Stitch: visual_search_agriaqua_360 + 49_crop_aquatic_health_history (result shown inline)
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, Header, Icon, PhotoPicker, Screen, SectionHeader, StorageImage, TextField } from '@/components';
import { analyseFish, uploadFishPhotos, useFishReports, usePonds } from '@/features/aquaculture/api';
import { toErrorKey } from '@/features/auth/api';
import { useLanguage } from '@/hooks/useLanguage';
import { formatDate, isoDate } from '@/lib/dates';
import type { PickedImage } from '@/services/media';
import type { FishHealthReport } from '@/types/database';
import { colors, radius } from '@/theme';

const SEVERITY_TONE = { none: 'normal', mild: 'warning', moderate: 'warning', severe: 'error' } as const;

export default function FishScanner() {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const params = useLocalSearchParams<{ pondId?: string; reportId?: string }>();
  const ponds = usePonds();
  const history = useFishReports();
  const [pondId, setPondId] = useState(params.pondId ?? 'none');
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [paths, setPaths] = useState<string[] | null>(null); // uploaded already → retry without re-uploading
  const [observations, setObservations] = useState('');
  const [stage, setStage] = useState<'idle' | 'uploading' | 'analysing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FishHealthReport | null>(null);
  const shown = result ?? history.data?.find((r) => r.id === params.reportId) ?? null;

  const run = async () => {
    if (!photos.length && !paths) { setError('scan.needPhoto'); return; }
    setError(null);
    try {
      let p = paths;
      if (!p) { setStage('uploading'); p = await uploadFishPhotos(photos); setPaths(p); }
      setStage('analysing');
      setResult(await analyseFish({ paths: p, pondId: pondId === 'none' ? null : pondId, observations, language }));
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith('errors.') ? e.message : toErrorKey(e));
    } finally { setStage('idle'); }
  };
  const reset = () => { setResult(null); setPhotos([]); setPaths(null); setObservations(''); setError(null); router.setParams({ reportId: undefined }); };

  if (shown) {
    const r = shown.raw_response;
    const list = (title: string, items?: string[]) => !!items?.length && (
      <Card style={{ gap: 6 }}>
        <AppText variant="labelLg">{title}</AppText>
        {items.map((x, i) => <AppText key={i} variant="bodyMd">• {x}</AppText>)}
      </Card>
    );
    return (
      <Screen footer={<Button testID="fish-new" iconLeft="set-meal" label={t('fishScan.newScan')} onPress={reset} />}>
        <Header title={t('result.title')} />
        <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
          {shown.image_paths.map((p) => <StorageImage key={p} path={p} style={{ width: 160, height: 130, borderRadius: radius.lg }} />)}
        </ScrollView>
        {r?.is_fish_image === false ? (
          <>
            <Banner tone="warning" title={t('fishScan.notFish')} message={r.summary} />
            {list(t('result.retake'), r.retake_tips)}
          </>
        ) : (
          <>
            <Banner tone="warning" title={t('result.preliminaryTitle')} message={t('result.preliminaryText')} />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {shown.severity && <Chip tone={SEVERITY_TONE[shown.severity]} icon="warning-amber" label={t(`result.severity.${shown.severity}`)} />}
              {shown.confidence && <Chip tone="ai" icon="insights" label={t('result.confidence', { level: t(`result.levels.${shown.confidence}`) })} />}
            </View>
            <AppText variant="display">{shown.condition_name}</AppText>
            {!!r?.species_identified && <AppText variant="bodyMd" color={colors.textMuted}>{t('fishScan.species')}: {r.species_identified}</AppText>}
            {!!shown.summary && <AppText variant="bodyLg">{shown.summary}</AppText>}
            {shown.recommend_expert && <Banner tone="error" title={t('result.expertTitle')} message={r?.expert_reason || t('result.expertDefault')} />}
            {list(t('fishScan.actions'), r?.immediate_actions)}
            {list(t('fishScan.signs'), r?.signs)}
            {list(t('fishScan.causes'), r?.possible_causes)}
            {list(t('fishScan.water'), r?.water_management)}
            {list(t('fishScan.prevention'), r?.prevention)}
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen footer={
      <Button testID="fish-analyse" variant="ai" iconLeft="auto-awesome" loading={stage !== 'idle'} onPress={run}
        label={stage === 'uploading' ? t('scan.uploading') : stage === 'analysing' ? t('scan.analysing') : t('fishScan.analyse')} />
    }>
      <Header title={t('fishScan.title')} />
      <AppText variant="bodyLg" color={colors.textMuted}>{t('fishScan.subtitle')}</AppText>
      <ChoiceChips scroll label={t('fishScan.pond')} value={pondId} onChange={setPondId}
        options={[...(ponds.data ?? []).map((p) => ({ value: p.id, label: p.name })), { value: 'none', label: t('fishScan.noPond') }]} />
      <PhotoPicker label={t('scan.photos', { count: photos.length })} value={photos} onChange={(v) => { setPhotos(v); setPaths(null); }} max={5} />
      <TextField label={t('fishScan.observations')} placeholder={t('fishScan.observationsPlaceholder')} multiline maxLength={500}
        style={{ minHeight: 80, textAlignVertical: 'top' }} value={observations} onChangeText={setObservations} />
      <Card style={{ gap: 8, backgroundColor: colors.aiSurface, borderColor: 'rgba(101,70,199,0.2)' }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="tips-and-updates" color={colors.ai} />
          <AppText variant="labelLg" color={colors.ai}>{t('scan.tipsTitle')}</AppText>
        </View>
        {(['tip1', 'tip2', 'tip3'] as const).map((k) => <AppText key={k} variant="bodyMd">• {t(`fishScan.${k}`)}</AppText>)}
      </Card>
      {error && <Banner tone="error" message={t(error)} onDismiss={() => setError(null)} />}

      {!!history.data?.length && (
        <>
          <SectionHeader title={t('fishScan.history')} />
          {history.data.slice(0, 5).map((r) => (
            <Card key={r.id} onPress={() => router.setParams({ reportId: r.id })} accessibilityLabel={r.condition_name ?? ''} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12 }}>
              <StorageImage path={r.image_paths[0]} style={{ width: 56, height: 56, borderRadius: radius.md }} />
              <View style={{ flex: 1 }}>
                <AppText variant="labelLg" numberOfLines={1}>{r.condition_name}</AppText>
                <AppText variant="bodySm" color={colors.textMuted}>{formatDate(isoDate(new Date(r.created_at)), i18n.language)}</AppText>
              </View>
              {r.severity && <Chip tone={SEVERITY_TONE[r.severity]} label={t(`result.severity.${r.severity}`)} />}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

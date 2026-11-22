// 18 · Crop Disease Scanner — Stitch: visual_search_agriaqua_360
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, Header, Icon, PhotoPicker, Screen, SectionHeader, StorageImage } from '@/components';
import { analyseScan, createScan, useCrops, useScans } from '@/features/agriculture/api';
import { SCAN_TYPES } from '@/features/agriculture/schemas';
import { toErrorKey } from '@/features/auth/api';
import { useLanguage } from '@/hooks/useLanguage';
import { formatDate } from '@/lib/dates';
import type { PickedImage } from '@/services/media';
import type { ScanType } from '@/types/database';
import { colors, radius } from '@/theme';

export default function CropScanner() {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const params = useLocalSearchParams<{ cropId?: string }>();
  const crops = useCrops();
  const history = useScans();
  const [cropId, setCropId] = useState<string>(params.cropId ?? 'none');
  const [scanType, setScanType] = useState<ScanType>('disease');
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'analysing'>('idle');
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!photos.length) { setError('scan.needPhoto'); return; }
    setError(null);
    let scanId: string | null = null;
    try {
      setStage('uploading');
      scanId = await createScan({ images: photos, cropId: cropId === 'none' ? null : cropId, scanType, language });
      setStage('analysing');
      await analyseScan(scanId);
      router.replace(`/agriculture/scan/${scanId}`);
    } catch (e) {
      // Upload succeeded but AI failed → results screen offers retry without re-uploading.
      if (scanId) router.replace(`/agriculture/scan/${scanId}`);
      else setError(e instanceof Error && e.message.startsWith('errors.') ? e.message : toErrorKey(e));
    } finally { setStage('idle'); }
  };

  return (
    <Screen footer={
      <Button testID="scan-analyse" variant="ai" iconLeft="auto-awesome" loading={stage !== 'idle'} onPress={run}
        label={stage === 'uploading' ? t('scan.uploading') : stage === 'analysing' ? t('scan.analysing') : t('scan.analyse')} />
    }>
      <Header title={t('scan.title')} />
      <AppText variant="bodyLg" color={colors.textMuted}>{t('scan.subtitle')}</AppText>
      <ChoiceChips label={t('scan.type')} value={scanType} onChange={setScanType}
        options={SCAN_TYPES.map((s) => ({ value: s, label: t(`scan.types.${s}`), icon: s === 'pest' ? 'pest-control' as const : s === 'disease' ? 'coronavirus' as const : 'eco' as const }))} />
      <ChoiceChips scroll label={t('scan.crop')} value={cropId} onChange={setCropId}
        options={[...(crops.data ?? []).map((c) => ({ value: c.id, label: c.name })), { value: 'none', label: t('scan.noCrop') }]} />
      <PhotoPicker label={t('scan.photos', { count: photos.length })} value={photos} onChange={setPhotos} max={5} />
      <Card style={{ gap: 8, backgroundColor: colors.aiSurface, borderColor: 'rgba(101,70,199,0.2)' }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="tips-and-updates" color={colors.ai} />
          <AppText variant="labelLg" color={colors.ai}>{t('scan.tipsTitle')}</AppText>
        </View>
        {(['tip1', 'tip2', 'tip3'] as const).map((k) => <AppText key={k} variant="bodyMd">• {t(`scan.${k}`)}</AppText>)}
      </Card>
      {error && <Banner tone="error" message={t(error)} onDismiss={() => setError(null)} />}

      {!!history.data?.length && (
        <>
          <SectionHeader title={t('scan.history')} />
          {history.data.slice(0, 5).map((s) => (
            <Card key={s.id} onPress={() => router.push(`/agriculture/scan/${s.id}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12 }}
              accessibilityLabel={s.report[0]?.condition_name ?? t('scan.pending')}>
              <StorageImage path={s.image_paths[0]} style={{ width: 56, height: 56, borderRadius: radius.md }} />
              <View style={{ flex: 1 }}>
                <AppText variant="labelLg" numberOfLines={1}>{s.report[0]?.condition_name ?? t(s.status === 'failed' ? 'scan.failed' : 'scan.pending')}</AppText>
                <AppText variant="bodySm" color={colors.textMuted}>{formatDate(s.created_at.slice(0, 10), i18n.language)}</AppText>
              </View>
              {s.report[0]?.severity && <Chip tone={s.report[0].severity === 'severe' ? 'error' : 'normal'} label={t(`result.severity.${s.report[0].severity}`)} />}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

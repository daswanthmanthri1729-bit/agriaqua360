import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Chip } from '@/components';
import type { WaterReading } from '@/types/database';
import { colors, fonts, radius } from '@/theme';
import { level, PARAMS, rangeLabel } from './waterQuality';

const TONE = { ok: 'normal', warn: 'warning', bad: 'error' } as const;

// Stitch "Pond Health Metrics" tiles: value + unit, guide range, status chip.
export function WaterTiles({ reading }: { reading: WaterReading }) {
  const { t } = useTranslation();
  return (
    <View style={styles.grid}>
      {PARAMS.filter((p) => reading[p.key] != null).map((p) => {
        const v = reading[p.key]!;
        const l = level(p.key, v);
        const range = rangeLabel(p.key);
        return (
          <View key={p.key} style={[styles.tile, l === 'bad' && { borderColor: colors.error }]} accessible
            accessibilityLabel={`${t(`water.params.${p.key}`)} ${v} ${p.unit}${l ? `, ${t(`water.status.${l}`)}` : ''}`}>
            <AppText variant="labelMd" color={colors.textMuted} numberOfLines={1}>{t(`water.params.${p.key}`)}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
              <AppText style={styles.value}>{v}</AppText>
              {p.unit !== 'pH' && <AppText variant="labelMd" color={colors.textMuted} style={{ marginBottom: 6 }}>{p.unit}</AppText>}
            </View>
            {range && <AppText variant="labelSm" color={colors.textSubtle}>{t('water.safe', { range })}</AppText>}
            {l && <Chip tone={TONE[l]} label={t(`water.status.${l}`)} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '45%', padding: 12, gap: 4, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  value: { fontFamily: fonts.headingXBold, fontSize: 28, lineHeight: 36, color: colors.text },
});

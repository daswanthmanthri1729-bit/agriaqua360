import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, radius } from '@/theme';

export function StepHeader({ step, label, progress }: { step: string; label: string; progress: number }) {
  return (
    <View style={{ gap: 8 }} accessible accessibilityRole="progressbar" accessibilityLabel={`${step} ${label}`} accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
      <View style={styles.row}>
        <AppText variant="labelMd" color={colors.primary}>{step}</AppText>
        <AppText variant="labelMd" color={colors.textSubtle}>{label}</AppText>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
});

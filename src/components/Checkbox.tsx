import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { colors } from '@/theme';

export function Checkbox({ checked, onChange, children, label }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; label: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label}
      onPress={() => onChange(!checked)} style={styles.row} hitSlop={8}>
      <View style={[styles.box, checked && styles.on]}>{checked && <Icon name="check" size={18} color={colors.white} />}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
});

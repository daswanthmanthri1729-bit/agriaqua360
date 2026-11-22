import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputInstance, View } from 'react-native';
import { AppText } from './AppText';
import { colors, fonts, radius } from '@/theme';

// One real input (paste + SMS autofill work) rendered as 6 boxes.
export function OtpInput({ value, onChange, error, label }: { value: string; onChange: (v: string) => void; error?: boolean; label: string }) {
  const ref = useRef<TextInputInstance>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessible={false}>
      <View style={styles.row}>
        {Array.from({ length: 6 }, (_, i) => {
          const active = i === Math.min(value.length, 5);
          return (
            <View key={i} style={[styles.box, active && styles.active, error && { borderColor: colors.error }]}>
              <AppText style={styles.digit}>{value[i] ?? ''}</AppText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        testID="otp-input"
        accessibilityLabel={label}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  box: { flex: 1, maxWidth: 56, aspectRatio: 0.85, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  active: { borderWidth: 2, borderColor: colors.secondary },
  digit: { fontFamily: fonts.headingBold, fontSize: 24, lineHeight: 32, color: colors.text },
  hidden: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
});

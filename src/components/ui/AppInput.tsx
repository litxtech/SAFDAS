import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = TextInputProps & { label: string; error?: string };

export function AppInput({ label, error, style, ...props }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.backgroundSecondary, borderColor: error ? colors.error : colors.border },
          style,
        ]}
        {...props}
      />
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { fontSize: 12 },
});

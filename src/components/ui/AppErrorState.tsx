import { StyleSheet, Text, View } from 'react-native';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { AppButton } from './AppButton';

export function AppErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.error }]}>{t('somethingWrong')}</Text>
      <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{message}</Text>
      {onRetry ? <AppButton label={t('retry')} onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 20, gap: 10, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
});

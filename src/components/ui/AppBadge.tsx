import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function AppBadge({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'neutral' | 'success' | 'warning' }) {
  const { colors } = useTheme();
  const background =
    tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : tone === 'neutral' ? colors.backgroundSecondary : colors.primaryMuted;
  const color = tone === 'success' || tone === 'warning' ? '#1A1220' : tone === 'neutral' ? colors.textSecondary : colors.primary;
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '700' },
});

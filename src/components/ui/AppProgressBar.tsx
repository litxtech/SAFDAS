import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function AppProgressBar({ value }: { value: number }) {
  const { colors } = useTheme();
  const width = `${Math.max(0, Math.min(100, value))}%` as `${number}%`;
  return (
    <View style={[styles.track, { backgroundColor: colors.backgroundSecondary }]}>
      <View style={[styles.fill, { width, backgroundColor: colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
});

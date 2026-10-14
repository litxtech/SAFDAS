import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function AppDivider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 8 }} />;
}

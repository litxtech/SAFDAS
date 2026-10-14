import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  children: React.ReactNode;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppCard({ children, elevated, style }: Props) {
  const { colors, name } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
          shadowOpacity: name === 'light' ? 0.06 : 0,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: name === 'light' ? 2 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
};

export function AppTabs({ tabs, value, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.backgroundSecondary }]}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tab, active && { backgroundColor: colors.surface }]}>
            <Text style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: '700' }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { uri?: string | null; name?: string | null; size?: number; speaking?: boolean };

export function AppAvatar({ uri, name, size = 44, speaking }: Props) {
  const { colors } = useTheme();
  const letter = (name ?? '?').trim().charAt(0).toUpperCase();
  return (
    <View
      style={[
        styles.ring,
        {
          width: size + (speaking ? 6 : 0),
          height: size + (speaking ? 6 : 0),
          borderColor: speaking ? colors.primary : 'transparent',
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryMuted }]}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: size * 0.38 }}>{letter}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});

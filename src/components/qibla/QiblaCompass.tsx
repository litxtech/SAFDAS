import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

const TICKS = Array.from({ length: 72 }, (_, index) => index * 5);
const MARKS = [0, 45, 90, 135, 180, 225, 270, 315];
const CARDINALS: Record<number, string> = { 0: 'K', 90: 'D', 180: 'G', 270: 'B' };
const CARDINALS_EN: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

type Props = {
  size: number;
  rotation: SharedValue<number>;
  bearing: number;
  aligned: boolean;
  centerValue: string;
  centerLabel: string;
  locale?: string;
};

export function QiblaCompass({
  size,
  rotation,
  bearing,
  aligned,
  centerValue,
  centerLabel,
  locale = 'tr',
}: Props) {
  const { colors, name } = useTheme();
  const dark = name === 'dark';
  const labels = locale === 'tr' ? CARDINALS : CARDINALS_EN;

  const dialStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const accent = aligned ? colors.success : colors.primary;
  const accentSoft = aligned ? (dark ? 'rgba(69,198,165,0.22)' : 'rgba(34,166,111,0.14)') : colors.primaryMuted;
  const face = dark ? '#141821' : '#FFFFFF';
  const tickMajor = dark ? '#E8E9F0' : '#211B35';
  const tickMinor = dark ? '#6E7282' : '#C4BED4';
  const north = '#E25B6A';

  return (
    <View style={[styles.housing, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={
          dark
            ? aligned
              ? (['#1F3A34', '#151821', '#0C0E14'] as const)
              : (['#3A2758', '#1E2230', '#0C0E14'] as const)
            : aligned
              ? (['#D8F5E9', '#F3EEFF', '#FFFFFF'] as const)
              : (['#EDE4FF', '#F3EEFF', '#FFFFFF'] as const)
        }
        style={[styles.bezel, { borderRadius: size / 2, borderColor: aligned ? accent : colors.border }]}
      >
        <View style={[styles.face, { borderRadius: (size - 24) / 2, backgroundColor: face, borderColor: colors.border }]}>
          <View style={[styles.ring, { borderColor: accentSoft }]} />

          <Animated.View style={[styles.dial, dialStyle]}>
            {TICKS.map((degree) => (
              <View key={degree} style={[styles.spoke, { transform: [{ rotate: `${degree}deg` }] }]}>
                <View
                  style={[
                    styles.tick,
                    {
                      height: degree % 45 === 0 ? 16 : degree % 15 === 0 ? 11 : 6,
                      width: degree % 45 === 0 ? 2.5 : 1.5,
                      backgroundColor: degree === 0 ? north : degree % 45 === 0 ? tickMajor : tickMinor,
                    },
                  ]}
                />
              </View>
            ))}

            {MARKS.map((degree) => (
              <View key={degree} style={[styles.spoke, { transform: [{ rotate: `${degree}deg` }] }]}>
                <Text
                  style={[
                    styles.mark,
                    {
                      color: degree === 0 ? north : labels[degree] ? colors.text : colors.textSecondary,
                      fontSize: labels[degree] ? 15 : 11,
                    },
                  ]}
                >
                  {labels[degree] ?? String(degree)}
                </Text>
              </View>
            ))}

            {/* Qibla marker rides on the dial at true-north bearing — aligns with the top index when facing Kaaba. */}
            <View style={[styles.spoke, { transform: [{ rotate: `${bearing}deg` }] }]}>
              <View style={[styles.needle, { backgroundColor: accent }]} />
              <View style={[styles.kaaba, { borderColor: accent, backgroundColor: dark ? '#1B120C' : '#2A1A10' }]}>
                <View style={styles.kaabaBand} />
              </View>
            </View>
          </Animated.View>

          <View style={styles.index} pointerEvents="none">
            <View style={[styles.indexMark, { borderTopColor: accent }]} />
          </View>

          <View
            style={[
              styles.hub,
              {
                backgroundColor: dark ? '#10131A' : '#F8F9FC',
                borderColor: aligned ? accent : colors.border,
              },
            ]}
            pointerEvents="none"
          >
            <Text style={[styles.hubValue, { color: colors.text }]}>{centerValue}</Text>
            <Text style={[styles.hubLabel, { color: aligned ? accent : colors.textSecondary }]} numberOfLines={1}>
              {centerLabel}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  housing: {
    alignSelf: 'center',
    padding: 2,
  },
  bezel: {
    flex: 1,
    padding: 10,
    borderWidth: 1.5,
  },
  face: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    margin: 10,
    borderRadius: 999,
    borderWidth: 6,
    opacity: 0.9,
  },
  dial: StyleSheet.absoluteFillObject,
  spoke: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
  tick: { marginTop: 14, borderRadius: 1 },
  mark: { marginTop: 34, fontWeight: '800', letterSpacing: 0.3 },
  needle: { width: 3.5, height: '24%', marginTop: '24%', borderRadius: 2 },
  kaaba: {
    position: 'absolute',
    top: '12%',
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kaabaBand: { width: 14, height: 3.5, borderRadius: 1, backgroundColor: '#E4C27A' },
  index: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center', zIndex: 4 },
  indexMark: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  hub: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 112,
    height: 112,
    marginLeft: -56,
    marginTop: -56,
    borderRadius: 56,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  hubValue: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  hubLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 2 },
});

import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';

/** 1.2K / 3.4M — keeps stat numbers short on small screens. */
export function compactCount(value: number) {
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const scaled = value / 1000;
    return `${scaled.toFixed(scaled >= 10 ? 0 : 1).replace(/\.0$/, '')}K`;
  }
  const scaled = value / 1_000_000;
  return `${scaled.toFixed(scaled >= 10 ? 0 : 1).replace(/\.0$/, '')}M`;
}

type CoverProps = {
  uri?: string | null;
  initial: string;
  height: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  children?: React.ReactNode;
};

/**
 * Full-bleed header: cover photo, or a branded gradient with the person's
 * initial as a watermark. The bottom edge fades into the page background so the
 * avatar and name read as one surface instead of stacked blocks.
 */
export function ProfileCover({ uri, initial, height, onPress, accessibilityLabel, children }: CoverProps) {
  const { colors, name } = useTheme();
  const gradient =
    name === 'dark'
      ? (['#31204F', '#6D28D9', '#B58BE8'] as const)
      : (['#6D28D9', '#9B5CF6', '#D8C4FB'] as const);

  return (
    <View style={[styles.cover, { height, backgroundColor: colors.primaryDark }]}>
      {uri ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          style={StyleSheet.absoluteFill}
        >
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
            transition={220}
          />
        </Pressable>
      ) : (
        <>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.watermark}>{initial}</Text>
        </>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.32)', 'rgba(0,0,0,0.05)', 'transparent', colors.background]}
        locations={[0, 0.34, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

/** Avatar with a gradient ring and a gap in the page colour. */
export function ProfileAvatarRing({ uri, name, size = 96 }: { uri?: string | null; name?: string | null; size?: number }) {
  const { colors } = useTheme();
  const letter = (name ?? '?').trim().charAt(0).toUpperCase();
  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryLight]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ padding: 2.5, borderRadius: 999 }}
    >
      <View style={{ padding: 3, borderRadius: 999, backgroundColor: colors.background }}>
        {uri ? (
          <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={180} />
        ) : (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: size * 0.38 }}>{letter}</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

/** Small translucent circular button used on top of the cover. */
export function ProfileIconButton({
  icon,
  label,
  onPress,
  variant = 'glass',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: 'glass' | 'surface';
}) {
  const { colors, name } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: variant === 'glass' ? (name === 'dark' ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.9)') : colors.surface,
          borderColor: variant === 'glass' ? 'rgba(255,255,255,0.24)' : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

/** Pill chip with an icon — location, joined date, link… */
export function ProfileChip({
  icon,
  label,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Ionicons name={icon} size={13} color={colors.primary} />
      <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      {onPress ? <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} /> : null}
    </Pressable>
  );
}

type StatItem = { key: string; value: number; label: string; onPress?: () => void };

/** Three equal cells in one card, divided by hairlines. */
export function ProfileStatCard({ items }: { items: StatItem[] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {items.map((item, index) => (
        <Pressable
          key={item.key}
          accessibilityRole={item.onPress ? 'button' : undefined}
          accessibilityLabel={`${item.value} ${item.label}`}
          disabled={!item.onPress}
          onPress={item.onPress}
          style={({ pressed }) => [styles.statCell, { opacity: pressed ? 0.7 : 1 }]}
        >
          {index > 0 ? (
            <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          ) : null}
          <Text style={[styles.statValue, { color: colors.text }]}>{compactCount(item.value)}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

type SegmentedTab = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };

export function ProfileSegmentedTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: SegmentedTab[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tabs, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              active && { backgroundColor: colors.surface },
              { opacity: pressed && !active ? 0.7 : 1 },
            ]}
          >
            <Ionicons name={tab.icon} size={15} color={active ? colors.primary : colors.textSecondary} />
            <Text
              style={{
                color: active ? colors.primary : colors.textSecondary,
                fontSize: 12.5,
                fontWeight: active ? '800' : '600',
              }}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pill action with an icon — edit profile, follow, message… */
export function ProfileActionButton({
  icon,
  label,
  onPress,
  variant = 'primary',
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: primary ? colors.primary : colors.surface,
          borderColor: primary ? colors.primary : colors.border,
          opacity: pressed ? 0.86 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={16} color={primary ? colors.onPrimary : colors.text} />
      <Text
        style={{
          color: primary ? colors.onPrimary : colors.text,
          fontSize: 13.5,
          fontWeight: '800',
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Surface card used by the studio voice list. */
export function ProfileListCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', overflow: 'hidden', justifyContent: 'flex-start' },
  watermark: {
    position: 'absolute',
    end: -14,
    bottom: -34,
    fontSize: 168,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.16)',
    letterSpacing: -10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  statCard: {
    flexDirection: 'row',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { position: 'absolute', start: 0, top: 4, bottom: 4, width: StyleSheet.hairlineWidth },
  statValue: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  statLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  tabs: { flexDirection: 'row', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 4, gap: 4 },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  action: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    flexShrink: 1,
  },
  listCard: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});

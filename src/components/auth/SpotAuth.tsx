import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isRtlLocale, useI18nStore, useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

const HERO = require('../../../assets/ayasofya-rise.jpg');

/** Spotify-benzeri koyu cam + canlı vurgu */
export const spot = {
  ink: '#FFFFFF',
  muted: 'rgba(255,255,255,0.72)',
  dim: 'rgba(255,255,255,0.48)',
  line: 'rgba(255,255,255,0.14)',
  glass: 'rgba(18,18,18,0.48)',
  glassStrong: 'rgba(12,12,12,0.62)',
  accent: '#1ED760',
  accentDeep: '#1AA34A',
  field: 'rgba(255,255,255,0.08)',
  fieldFocus: 'rgba(255,255,255,0.14)',
} as const;

function usePulse(duration: number, delay = 0) {
  const progress = useSharedValue(0);
  const { reduceMotion } = useTheme();

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [delay, duration, progress, reduceMotion]);

  return progress;
}

export function SpotBackdrop() {
  const glow = usePulse(9000, 0);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.35, 0.7]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.08]) }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.glowBlob, glowStyle]}>
        <LinearGradient
          colors={['rgba(30,215,96,0.22)', 'rgba(30,215,96,0)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={styles.topScrim}
      />
    </View>
  );
}

export function SpotShell({
  children,
  scroll,
  onBack,
}: {
  children: ReactNode;
  scroll?: boolean;
  onBack?: () => void;
}) {
  const t = useT();
  const rtl = isRtlLocale(useI18nStore((state) => state.locale));
  const insets = useSafeAreaInsets();
  const showBack = router.canGoBack();
  const contentStyle: ViewStyle[] = [
    styles.content,
    { paddingTop: showBack ? 8 : 12, paddingBottom: Math.max(insets.bottom, 16) + 12, flexGrow: 1 },
  ];

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      <SpotBackdrop />
      <KeyboardAvoidingView
        style={{ flex: 1, paddingTop: insets.top }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            onPress={onBack ?? (() => router.back())}
            style={styles.back}
            hitSlop={8}
          >
            <View style={styles.backPill}>
              <BlurView intensity={28} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
              <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={spot.ink} />
            </View>
          </Pressable>
        ) : null}
        {body}
      </KeyboardAvoidingView>
    </View>
  );
}

export function SpotGlass({
  children,
  style,
  strong,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
}) {
  return (
    <View style={[styles.glassRim, style]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 48 : 32}
        tint="systemChromeMaterialDark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: strong ? spot.glassStrong : spot.glass },
        ]}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.02)', 'transparent']}
        style={styles.glassCap}
      />
      <View style={styles.glassBody}>{children}</View>
    </View>
  );
}

export function SpotField({ label, error, style, onFocus, onBlur, ...props }: TextInputProps & { label: string; error?: string }) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.fieldRim,
          {
            backgroundColor: focused ? spot.fieldFocus : spot.field,
            borderColor: error ? '#F07183' : focused ? 'rgba(30,215,96,0.55)' : spot.line,
          },
        ]}
      >
        <TextInput
          placeholderTextColor={spot.dim}
          style={[styles.field, style]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function SpotButton({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'glass' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
}) {
  const systemReduce = useReducedMotion();
  const { reduceMotion: themeReduce } = useTheme();
  const reduceMotion = themeReduce || Boolean(systemReduce);

  if (variant === 'ghost') {
    return (
      <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={styles.ghost}>
        <Text style={styles.ghostLabel}>{label}</Text>
      </Pressable>
    );
  }

  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        if (!reduceMotion) void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.btnBase,
        primary ? styles.btnPrimary : styles.btnGlass,
        {
          opacity: disabled ? 0.45 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed && !reduceMotion ? 0.985 : 1 }],
        },
      ]}
    >
      {!primary ? (
        <BlurView intensity={22} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      ) : null}
      {loading ? (
        <ActivityIndicator color={primary ? '#04140A' : spot.ink} />
      ) : (
        <Text style={[styles.btnLabel, { color: primary ? '#04140A' : spot.ink }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SpotStepProgress({
  labels,
  step,
  fraction = 0,
}: {
  labels: string[];
  step: number;
  fraction?: number;
}) {
  const t = useT();
  const total = Math.max(1, labels.length);
  const safeStep = Math.max(0, Math.min(total - 1, step));
  const safeFraction = Math.max(0, Math.min(1, fraction));
  const value = ((safeStep + safeFraction) / total) * 100;

  return (
    <View style={styles.stepWrap}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>{labels[safeStep]}</Text>
        <Text style={styles.stepCount}>{t('stepProgress', { current: safeStep + 1, total })}</Text>
      </View>
      <View style={styles.stepTrack}>
        <View style={[styles.stepFill, { width: `${value}%` }]} />
      </View>
      <View style={styles.stepDots}>
        {labels.map((label, index) => {
          const active = index === safeStep;
          const done = index < safeStep || (active && safeFraction === 1);
          return (
            <View key={label} style={styles.stepDotCol}>
              <View
                style={[
                  styles.stepDot,
                  done && styles.stepDotDone,
                  active && styles.stepDotActive,
                ]}
              />
              <Text numberOfLines={1} style={[styles.stepDotLabel, (done || active) && styles.stepDotLabelOn]}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function SpotCheck({
  label,
  value,
  onChange,
  linkLabel,
  onLink,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  linkLabel?: string;
  onLink?: () => void;
}) {
  return (
    <View style={styles.checkBlock}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        onPress={() => onChange(!value)}
        style={styles.checkRow}
      >
        <View style={[styles.checkBox, value && styles.checkBoxOn]}>
          {value ? <Ionicons name="checkmark" size={16} color="#04140A" /> : null}
        </View>
        <Text style={styles.checkLabel}>{label}</Text>
      </Pressable>
      {linkLabel && onLink ? (
        <Pressable onPress={onLink} hitSlop={8} style={styles.checkLinkHit}>
          <Text style={styles.checkLink}>{linkLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function spotEnter(delay: number, reduceMotion: boolean) {
  if (reduceMotion) return undefined;
  return FadeInDown.delay(delay).duration(420).easing(Easing.out(Easing.cubic));
}

export function spotFade(delay: number, reduceMotion: boolean) {
  if (reduceMotion) return undefined;
  return FadeIn.delay(delay).duration(480);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505' },
  content: { paddingHorizontal: 22, gap: 14 },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },
  glowBlob: {
    position: 'absolute',
    bottom: '18%',
    left: '-10%',
    width: '80%',
    height: '40%',
    borderRadius: 999,
  },
  back: { paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  backPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: spot.line,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  glassRim: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  glassCap: { position: 'absolute', top: 0, left: 0, right: 0, height: 64 },
  glassBody: { padding: 20, gap: 14 },
  fieldWrap: { gap: 8 },
  fieldLabel: { color: spot.muted, fontSize: 13, fontWeight: '600', marginLeft: 2 },
  fieldRim: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  field: { minHeight: 54, paddingHorizontal: 16, fontSize: 16, color: spot.ink, fontWeight: '500' },
  fieldError: { color: '#F07183', fontSize: 12 },
  ghost: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  ghostLabel: { color: spot.muted, fontSize: 15, fontWeight: '700' },
  btnBase: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnPrimary: {
    backgroundColor: spot.accent,
    shadowColor: spot.accent,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  btnGlass: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: spot.line,
  },
  btnLabel: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  stepWrap: { gap: 12 },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  stepTitle: { color: spot.ink, fontWeight: '800', fontSize: 16, flex: 1 },
  stepCount: { color: spot.dim, fontWeight: '700', fontSize: 13 },
  stepTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  stepFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: spot.accent,
  },
  stepDots: { flexDirection: 'row', gap: 8 },
  stepDotCol: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  stepDotActive: {
    backgroundColor: spot.accent,
    transform: [{ scale: 1.25 }],
  },
  stepDotDone: { backgroundColor: spot.accentDeep },
  stepDotLabel: { color: spot.dim, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  stepDotLabelOn: { color: spot.ink, fontWeight: '800' },
  checkBlock: { gap: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: spot.line,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    backgroundColor: spot.accent,
    borderColor: spot.accent,
  },
  checkLabel: { color: spot.ink, fontSize: 15, fontWeight: '600', flex: 1, lineHeight: 21 },
  checkLinkHit: { minHeight: 32, justifyContent: 'center', paddingLeft: 38 },
  checkLink: { color: spot.accent, fontSize: 13, fontWeight: '700' },
});

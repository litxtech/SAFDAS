import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

const COUNT = 11;
/** Max centre-to-centre spacing — bead diameter stays clearly below this. */
const MAX_GAP = 46;
/** Bead diameter as a fraction of gap so neighbours never overlap. */
const BEAD_RATIO = 0.78;
const COMMIT = 0.48;

/** Kehribar / amber wood tones — each bead varies slightly like a real strand. */
const AMBER = [
  ['#FFF2D0', '#E8A84A', '#B56A1C', '#6B3410'],
  ['#FFE8B8', '#D9943A', '#A85E16', '#5C2C0C'],
  ['#FFF6DC', '#F0B858', '#C07828', '#743810'],
  ['#FFE0A8', '#E09838', '#B06018', '#68300E'],
  ['#FFF0C4', '#E8AC4C', '#BC6E1E', '#6E3610'],
  ['#FFDEB0', '#D48830', '#A45814', '#5A280C'],
  ['#FFF4D4', '#ECB050', '#C47A24', '#7A3C12'],
  ['#FFE4B0', '#DEA040', '#B4681A', '#66320E'],
  ['#FFF8E0', '#F2BC60', '#C8822A', '#7E4014'],
  ['#FFE8B4', '#E0A040', '#B87020', '#6C3410'],
] as const;

const SPRING = { damping: 15, stiffness: 380, mass: 0.38, overshootClamping: false };
const SETTLE = { damping: 17, stiffness: 290, mass: 0.48 };

type Props = {
  onPull: (delta: number) => void;
  /** Fires at the exact commit frame — use for sound/haptics so they stay glued to the pull. */
  onClick?: () => void;
  hint: string;
};

export type TesbihHandle = { step: () => void };

export function Tesbih({ onPull, onClick, hint, ref }: Props & { ref?: Ref<TesbihHandle> }) {
  const { name, reduceMotion } = useTheme();
  const dark = name === 'dark';
  const onPullRef = useRef(onPull);
  const onClickRef = useRef(onClick);
  onPullRef.current = onPull;
  onClickRef.current = onClick;

  const fireClick = useCallback(() => {
    onClickRef.current?.();
  }, []);
  const emit = useCallback((delta: number) => {
    if (delta === 1) onPullRef.current(1);
  }, []);

  const offset = useSharedValue(0);
  const origin = useSharedValue(0);
  const committed = useSharedValue(0);
  const dragging = useSharedValue(false);
  const armed = useSharedValue(1);
  const tension = useSharedValue(0);
  const clickPulse = useSharedValue(0);
  const gap = useSharedValue(MAX_GAP);
  const trackH = useSharedValue(MAX_GAP * COUNT);
  const reduce = useSharedValue(reduceMotion);

  useEffect(() => {
    reduce.value = reduceMotion;
  }, [reduce, reduceMotion]);

  const bumpClick = useCallback(() => {
    'worklet';
    clickPulse.value = 0;
    clickPulse.value = withSequence(withTiming(1, { duration: 55 }), withTiming(0, { duration: 180 }));
  }, [clickPulse]);

  const step = useCallback(() => {
    const g = Math.max(1, gap.value);
    committed.value += 1;
    const dest = committed.value * g;
    origin.value = dest;
    offset.value = reduce.value ? dest : withSpring(dest, SPRING);
    tension.value = withSpring(0, SETTLE);
    bumpClick();
    fireClick();
    emit(1);
  }, [bumpClick, committed, emit, fireClick, gap, offset, origin, reduce, tension]);

  useImperativeHandle(ref, () => ({ step }), [step]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetY([-6, 4])
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          'worklet';
          dragging.value = true;
          armed.value = 1;
          const g = Math.max(1, gap.value);
          origin.value = committed.value * g;
          offset.value = origin.value;
          tension.value = withSpring(1, { damping: 18, stiffness: 220 });
        })
        .onUpdate((event) => {
          'worklet';
          const g = Math.max(1, gap.value);
          const down = Math.max(0, event.translationY);
          const up = Math.min(0, event.translationY);
          if (armed.value === 1 && down >= g * COMMIT) {
            armed.value = 0;
            committed.value += 1;
            origin.value = committed.value * g;
            offset.value = origin.value + g * 0.05;
            tension.value = withSpring(0.28, SPRING);
            bumpClick();
            // Sound/haptics first (sync feel), then count update.
            runOnJS(fireClick)();
            runOnJS(emit)(1);
            return;
          }
          if (armed.value === 0) {
            offset.value = origin.value;
            return;
          }
          const follow = Math.min(down, g * COMMIT);
          const rubber = Math.max(up, -g * 0.32) * 0.28;
          offset.value = origin.value + follow + rubber;
          tension.value = interpolate(follow, [0, g * COMMIT], [0.18, 1], Extrapolation.CLAMP);
        })
        .onFinalize(() => {
          'worklet';
          const g = Math.max(1, gap.value);
          const dest = committed.value * g;
          offset.value = reduce.value ? dest : withSpring(dest, SETTLE);
          tension.value = withSpring(0, SETTLE);
          dragging.value = false;
          armed.value = 1;
        }),
    [armed, bumpClick, committed, dragging, emit, fireClick, gap, offset, origin, reduce, tension],
  );

  function onTrackLayout(height: number) {
    if (height <= 0) return;
    const nextGap = Math.min(MAX_GAP, height / COUNT);
    const changed = Math.abs(nextGap - gap.value) > 0.5;
    gap.value = nextGap;
    trackH.value = height;
    if (changed && !dragging.value) offset.value = committed.value * nextGap;
  }

  const cord = dark ? '#3D2414' : '#5C3418';
  const cordEdge = dark ? 'rgba(212,176,106,0.35)' : 'rgba(120,72,28,0.4)';

  const cordPulse = useAnimatedStyle(() => ({
    opacity: interpolate(tension.value, [0, 1], [0.35, 0.85], Extrapolation.CLAMP),
    transform: [{ scaleX: interpolate(tension.value, [0, 1], [1, 1.55], Extrapolation.CLAMP) }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View collapsable={false} style={styles.column}>
        <Imame dark={dark} />
        <View style={[styles.connector, { backgroundColor: cord }]} />
        <View style={styles.track} onLayout={(event) => onTrackLayout(event.nativeEvent.layout.height)}>
          <View pointerEvents="none" style={[styles.cord, { backgroundColor: cord, borderColor: cordEdge }]} />
          <Animated.View pointerEvents="none" style={[styles.cordGlow, { backgroundColor: cordEdge }, cordPulse]} />
          <PullZone gap={gap} trackH={trackH} tension={tension} clickPulse={clickPulse} dark={dark} />
          {Array.from({ length: COUNT }, (_, index) => (
            <Bead
              key={index}
              index={index}
              divider={index === 5}
              offset={offset}
              gap={gap}
              trackH={trackH}
              tension={tension}
              clickPulse={clickPulse}
            />
          ))}
        </View>
        <View style={[styles.connector, { backgroundColor: cord }]} />
        <Tassel />
        <Text style={[styles.hint, { color: dark ? 'rgba(243, 230, 210, 0.72)' : '#7A5A3C' }]}>{hint}</Text>
      </View>
    </GestureDetector>
  );
}

function Imame({ dark }: { dark: boolean }) {
  return (
    <View pointerEvents="none" style={styles.imameWrap}>
      <LinearGradient colors={['#F5E8C8', '#C9A86A', '#8A6A38']} style={styles.metalCapTop} />
      <LinearGradient
        colors={['#FFF8E4', '#F0C060', '#C87828', '#8A4814', '#4A2408']}
        locations={[0, 0.22, 0.48, 0.78, 1]}
        style={styles.imame}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)', 'transparent']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.imameSheen}
        />
        <View style={styles.imameBand} />
        <View style={[styles.imameEye, { backgroundColor: dark ? '#1A1008' : '#2E1808' }]} />
      </LinearGradient>
      <LinearGradient colors={['#E8D4A0', '#A88448', '#6E5428']} style={styles.metalCapBottom} />
    </View>
  );
}

function Tassel() {
  const threads = [
    { deg: -20, color: '#F0D080', height: 20, width: 2 },
    { deg: -14, color: '#A82838', height: 28, width: 2.5 },
    { deg: -8, color: '#6E1828', height: 34, width: 2.5 },
    { deg: -3, color: '#4A1018', height: 40, width: 3 },
    { deg: 0, color: '#2E0A10', height: 44, width: 3 },
    { deg: 3, color: '#4A1018', height: 40, width: 3 },
    { deg: 8, color: '#6E1828', height: 34, width: 2.5 },
    { deg: 14, color: '#A82838', height: 28, width: 2.5 },
    { deg: 20, color: '#F0D080', height: 20, width: 2 },
  ];
  return (
    <View pointerEvents="none" style={styles.tassel}>
      <LinearGradient colors={['#FFF4D8', '#D4B070', '#8A6840']} style={styles.tasselCap} />
      <LinearGradient colors={['#A82838', '#5C1420', '#2E0A10']} style={styles.tasselNeck} />
      <View style={styles.tasselStrands}>
        {threads.map((thread) => (
          <View
            key={thread.deg}
            style={[
              styles.thread,
              {
                backgroundColor: thread.color,
                height: thread.height,
                width: thread.width,
                transform: [{ rotate: `${thread.deg}deg` }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function PullZone({
  gap,
  trackH,
  tension,
  clickPulse,
  dark,
}: {
  gap: SharedValue<number>;
  trackH: SharedValue<number>;
  tension: SharedValue<number>;
  clickPulse: SharedValue<number>;
  dark: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const g = Math.max(1, gap.value);
    const block = g * COUNT;
    const inset = Math.max(0, (trackH.value - block) / 2);
    const center = inset + block * 0.62;
    const size = Math.min(56, g * 1.42);
    const pulse = interpolate(tension.value, [0, 1], [1, 1.05], Extrapolation.CLAMP);
    const flash = interpolate(clickPulse.value, [0, 1], [0, 0.55], Extrapolation.CLAMP);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      marginLeft: -size / 2,
      top: center - size / 2,
      transform: [{ scale: pulse }],
      borderColor: dark
        ? `rgba(232, 196, 120, ${0.22 + tension.value * 0.4 + flash})`
        : `rgba(140, 90, 30, ${0.2 + tension.value * 0.4 + flash})`,
      backgroundColor: dark
        ? `rgba(201, 154, 74, ${0.05 + flash * 0.12})`
        : `rgba(201, 154, 74, ${0.06 + flash * 0.14})`,
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.pullZone, style]} />;
}

function Bead({
  index,
  divider,
  offset,
  gap,
  trackH,
  tension,
  clickPulse,
}: {
  index: number;
  divider: boolean;
  offset: SharedValue<number>;
  gap: SharedValue<number>;
  trackH: SharedValue<number>;
  tension: SharedValue<number>;
  clickPulse: SharedValue<number>;
}) {
  const palette = divider
    ? (['#FFFCF4', '#E8DCC8', '#B8A890', '#6A5E4C'] as const)
    : (AMBER[index % AMBER.length] ?? AMBER[0]);

  const style = useAnimatedStyle(() => {
    const g = Math.max(1, gap.value);
    const block = g * COUNT;
    const inset = Math.max(0, (trackH.value - block) / 2);

    let travel = (index * g + offset.value) % block;
    if (travel < 0) travel += block;

    const diameter = Math.min(36, g * BEAD_RATIO);
    // Slightly oval — real tesbih beads are rarely perfect spheres.
    const width = divider ? diameter * 0.94 : diameter * 0.96;
    const height = divider ? diameter * 0.36 : diameter * 1.04;

    const top = inset + travel + (g - height) / 2;
    const center = top + height / 2;
    const thumb = inset + block * 0.62;
    const fade = Math.max(8, g * 0.36);

    let opacity = 1;
    if (center < inset + fade) opacity = (center - inset) / fade;
    else if (center > inset + block - fade) opacity = (inset + block - center) / fade;

    const dist = Math.abs(center - thumb);
    const active = dist < g * 0.48;
    const press = active
      ? interpolate(tension.value, [0, 1], [1.02, 1.08], Extrapolation.CLAMP) +
        interpolate(clickPulse.value, [0, 1], [0, 0.06], Extrapolation.CLAMP)
      : 1;

    return {
      width,
      height,
      borderRadius: width / 2,
      top,
      marginLeft: -width / 2,
      opacity: Math.max(0, Math.min(1, opacity)),
      transform: [{ scale: press }],
      shadowOpacity: active ? 0.48 : 0.26,
      zIndex: active ? 5 : 1,
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.bead, style]}>
      <LinearGradient
        colors={[palette[0], palette[1], palette[2], palette[3]]}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          divider
            ? ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)', 'rgba(40,32,24,0.35)']
            : ['rgba(255,252,235,0.92)', 'rgba(255,220,140,0.12)', 'rgba(60,24,4,0.45)']
        }
        style={StyleSheet.absoluteFill}
      />
      {divider ? (
        <View style={styles.dividerLine} />
      ) : (
        <>
          <View style={styles.shine} />
          <View style={styles.rimLight} />
          <View style={styles.beadHole} />
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, alignItems: 'center', minHeight: 0 },
  imameWrap: { alignItems: 'center', marginTop: 2 },
  metalCapTop: {
    width: 16,
    height: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8C7344',
  },
  imame: {
    width: 28,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(90,48,12,0.35)',
  },
  imameSheen: {
    ...StyleSheet.absoluteFillObject,
  },
  imameBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    height: 2.5,
    backgroundColor: 'rgba(247, 236, 206, 0.85)',
  },
  imameEye: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    top: 22,
  },
  metalCapBottom: {
    width: 14,
    height: 6,
    borderRadius: 4,
    marginTop: -1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8A7040',
  },
  connector: { width: 2.5, height: 7, borderRadius: 2 },
  track: { flex: 1, width: '100%', minHeight: 140, overflow: 'hidden' },
  cord: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 3,
    marginLeft: -1.5,
    borderRadius: 2,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  cordGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 6,
    marginLeft: -3,
    borderRadius: 3,
  },
  pullZone: {
    position: 'absolute',
    left: '50%',
    borderWidth: 1.25,
  },
  bead: {
    position: 'absolute',
    left: '50%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(70, 36, 8, 0.42)',
    shadowColor: '#1A0C04',
    shadowRadius: 3.5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  shine: {
    position: 'absolute',
    top: '12%',
    left: '18%',
    width: '34%',
    height: '28%',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  rimLight: {
    position: 'absolute',
    top: '8%',
    right: '14%',
    width: '12%',
    height: '18%',
    borderRadius: 8,
    backgroundColor: 'rgba(255,240,200,0.35)',
  },
  beadHole: {
    position: 'absolute',
    top: '42%',
    left: '42%',
    width: '16%',
    height: '16%',
    borderRadius: 99,
    backgroundColor: 'rgba(28, 12, 4, 0.38)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,220,160,0.15)',
  },
  dividerLine: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    top: '44%',
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(80, 64, 40, 0.55)',
  },
  tassel: { alignItems: 'center', height: 58, marginTop: 2 },
  tasselCap: { width: 18, height: 9, borderRadius: 5 },
  tasselNeck: { width: 9, height: 9, borderRadius: 3, marginTop: -1 },
  tasselStrands: { flexDirection: 'row', alignItems: 'flex-start', marginTop: -1, paddingHorizontal: 2 },
  thread: { borderRadius: 2, marginHorizontal: 0.4 },
  hint: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2, marginTop: 4 },
});

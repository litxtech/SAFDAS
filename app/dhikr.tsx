import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Screen } from '@/components/layout/Screen';
import { loadDhikrPrefs, saveDhikrPrefs, type DhikrPrefs } from '@/components/dhikr/dhikrPrefs';
import { Tesbih, type TesbihHandle } from '@/components/dhikr/Tesbih';
import { playTesbihClick, prepareTesbihSound, releaseTesbihSound } from '@/components/dhikr/tesbihSound';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { useT, type I18nKey } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

const OPTIONS = ['dhikrSubhan', 'dhikrHamd', 'dhikrAkbar', 'dhikrTawhid'] as const satisfies readonly I18nKey[];
const TARGET = 33;
const STORAGE_KEY = 'safdas-dhikr-v1';

type SaveJob = { count: number; phrase: I18nKey; label: string; date: string };

function localDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function cycleOf(count: number) {
  const round = Math.floor((Math.max(count, 1) - 1) / TARGET) + 1;
  const remainder = count % TARGET;
  const full = remainder === 0 && count > 0;
  const progress = count === 0 ? 0 : full ? 100 : (remainder / TARGET) * 100;
  return { round, progress, full };
}

export default function DhikrScreen() {
  const { colors, name, reduceMotion: themeReduce } = useTheme();
  const systemReduce = useReducedMotion();
  const reduceMotion = themeReduce || Boolean(systemReduce);
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const [phrase, setPhrase] = useState<I18nKey>(OPTIONS[0]);
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [strand, setStrand] = useState(0);
  const [prefs, setPrefs] = useState<DhikrPrefs>({ sound: true, haptics: true });
  const [prefsReady, setPrefsReady] = useState(false);
  const label = t(phrase);
  const dark = name === 'dark';
  const { round, progress, full } = cycleOf(count);

  const countRef = useRef(0);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const dirty = useRef(false);
  const loadedPhrase = useRef<I18nKey | null>(null);
  const phraseRef = useRef(phrase);
  const labelRef = useRef(label);
  const userRef = useRef(userId);
  const localMap = useRef<Record<string, number>>({});
  const pending = useRef<SaveJob | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pop = useSharedValue(1);
  const tesbihRef = useRef<TesbihHandle>(null);
  phraseRef.current = phrase;
  labelRef.current = label;
  userRef.current = userId;

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    localMap.current[`${job.date}:${job.phrase}`] = job.count;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(localMap.current));
      const uid = userRef.current;
      if (!uid || !supabase) return;
      await supabase.from('dhikr_records').upsert(
        { user_id: uid, phrase: job.label, count: job.count, record_date: job.date },
        { onConflict: 'user_id,phrase,record_date' },
      );
    } catch {
      // Counting stays on screen when saving fails.
    }
  }, []);

  const scheduleSave = useCallback(
    (next: number) => {
      const job: SaveJob = { count: next, phrase: phraseRef.current, label: labelRef.current, date: localDate() };
      localMap.current[`${job.date}:${job.phrase}`] = next;
      pending.current = job;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, 450);
    },
    [flush],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!alive) return;
        const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        const stored = Object.fromEntries(Object.entries(parsed).filter((entry) => typeof entry[1] === 'number'));
        localMap.current = { ...stored, ...localMap.current };
      } catch {
        localMap.current = {};
      }
      if (alive) setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => {
    void flush();
  }, [flush]);

  useEffect(() => {
    void prepareTesbihSound();
    return () => releaseTesbihSound();
  }, []);

  useEffect(() => {
    let alive = true;
    void loadDhikrPrefs().then((stored) => {
      if (!alive) return;
      setPrefs(stored);
      setPrefsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  function togglePref(key: keyof DhikrPrefs) {
    setPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      void saveDhikrPrefs(next);
      if (key === 'haptics' && next.haptics) void Haptics.selectionAsync();
      if (key === 'sound' && next.sound) playTesbihClick();
      return next;
    });
  }

  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    const phraseChanged = loadedPhrase.current !== null && loadedPhrase.current !== phrase;
    loadedPhrase.current = phrase;
    if (phraseChanged) dirty.current = false;
    const date = localDate();
    const key = `${date}:${phrase}`;
    if (!dirty.current) {
      const stored = localMap.current[key] ?? 0;
      countRef.current = stored;
      setCount(stored);
    }
    const uid = userId;
    if (uid && supabase) {
      void supabase
        .from('dhikr_records')
        .select('count')
        .eq('user_id', uid)
        .eq('phrase', label)
        .eq('record_date', date)
        .maybeSingle()
        .then(({ data }) => {
          if (!alive || dirty.current) return;
          const remote = data?.count;
          if (typeof remote === 'number' && remote > countRef.current) {
            countRef.current = remote;
            localMap.current[key] = remote;
            setCount(remote);
          }
        });
    }
    return () => {
      alive = false;
    };
  }, [hydrated, phrase, userId, label]);

  function onClick() {
    const next = countRef.current + 1;
    const { sound, haptics } = prefsRef.current;
    // Sound first — must stay on the commit frame with the bead pull.
    if (sound) playTesbihClick();
    if (haptics && !reduceMotion) {
      if (next % TARGET === 0) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (next % 11 === 0) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  }

  function onPull(delta: number) {
    const next = countRef.current + delta;
    countRef.current = next;
    dirty.current = true;
    setCount(next);
    scheduleSave(next);
    if (!reduceMotion) {
      pop.value = withSequence(withTiming(1.08, { duration: 50 }), withSpring(1, { damping: 11, stiffness: 260 }));
    }
  }

  function reset() {
    countRef.current = 0;
    dirty.current = true;
    setCount(0);
    setStrand((value) => value + 1);
    scheduleSave(0);
  }

  function selectPhrase(next: I18nKey) {
    if (next === phrase) return;
    void flush();
    dirty.current = false;
    const stored = localMap.current[`${localDate()}:${next}`] ?? 0;
    countRef.current = stored;
    setCount(stored);
    setPhrase(next);
  }

  const cushion = dark
    ? (['#2A2018', '#1C1814', '#141210'] as const)
    : (['#F6EBD8', '#F3F0E8', '#FAF8F4'] as const);
  const ink = colors.text;
  const muted = colors.textSecondary;
  const gold = full ? colors.success : colors.primary;
  const width = `${progress}%` as `${number}%`;
  const enter = (delay: number) =>
    reduceMotion ? undefined : FadeInDown.delay(delay).duration(360).easing(Easing.out(Easing.cubic));

  return (
    <Screen>
      <AppHeader title={t('dhikr')} subtitle={t('dhikrBeads')} />

      <Animated.View entering={enter(40)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chips}>
          {OPTIONS.map((item) => {
            const selected = item === phrase;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => selectPhrase(item)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '700', fontSize: 13 }}>
                  {t(item)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      <Animated.View entering={enter(100)} style={{ flex: 1, minHeight: 0 }}>
        <LinearGradient colors={cushion} style={[styles.well, { borderColor: colors.border }]}>
          <View style={styles.readout}>
            <View style={styles.toggles}>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: prefs.sound }}
                accessibilityLabel={prefs.sound ? t('dhikrSoundOn') : t('dhikrSoundOff')}
                onPress={() => togglePref('sound')}
                disabled={!prefsReady}
                style={[
                  styles.toggle,
                  {
                    backgroundColor: prefs.sound ? colors.primaryMuted : colors.surface,
                    borderColor: prefs.sound ? colors.primary : colors.border,
                    opacity: prefsReady ? 1 : 0.5,
                  },
                ]}
              >
                <Ionicons name={prefs.sound ? 'volume-high' : 'volume-mute'} size={18} color={prefs.sound ? colors.primary : muted} />
              </Pressable>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: prefs.haptics }}
                accessibilityLabel={prefs.haptics ? t('dhikrHapticsOn') : t('dhikrHapticsOff')}
                onPress={() => togglePref('haptics')}
                disabled={!prefsReady}
                style={[
                  styles.toggle,
                  {
                    backgroundColor: prefs.haptics ? colors.primaryMuted : colors.surface,
                    borderColor: prefs.haptics ? colors.primary : colors.border,
                    opacity: prefsReady ? 1 : 0.5,
                  },
                ]}
              >
                <Ionicons name={prefs.haptics ? 'pulse' : 'pulse-outline'} size={18} color={prefs.haptics ? colors.primary : muted} />
              </Pressable>
            </View>

            <View style={[styles.countRing, { borderColor: gold, backgroundColor: dark ? 'rgba(166,92,214,0.12)' : '#FFFFFF' }]}>
              <Animated.Text
                accessibilityRole="adjustable"
                accessibilityLabel={`${t('dhikrBeads')}, ${label}, ${count}`}
                accessibilityHint={t('dhikrPullHint')}
                accessibilityActions={[{ name: 'increment' }]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'increment') tesbihRef.current?.step();
                }}
                style={[styles.count, popStyle, { color: full ? colors.success : ink }]}
              >
                {count}
              </Animated.Text>
            </View>
            <Text style={[styles.phrase, { color: ink }]}>{label}</Text>
            <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>
              {t('dhikrTarget', { target: TARGET })} · {t('dhikrRound', { round })}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : colors.primaryMuted }]}>
              <View style={[styles.fill, { width, backgroundColor: gold }]} />
            </View>
          </View>
          <Tesbih
            key={`${phrase}-${strand}`}
            ref={tesbihRef}
            onPull={onPull}
            onClick={onClick}
            hint={t('dhikrPullHint')}
          />
        </LinearGradient>
      </Animated.View>

      <AppButton label={t('reset')} variant="ghost" onPress={reset} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexGrow: 0, maxHeight: 44, marginBottom: 4 },
  chips: { gap: 8, paddingRight: 8, alignItems: 'center' },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  well: {
    flex: 1,
    minHeight: 0,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingTop: 14,
  },
  readout: { alignItems: 'center', gap: 4, paddingHorizontal: 16, marginBottom: 4 },
  toggles: { position: 'absolute', right: 12, top: 0, flexDirection: 'row', gap: 8, zIndex: 2 },
  toggle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countRing: {
    minWidth: 88,
    paddingHorizontal: 18,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  count: { fontSize: 42, fontWeight: '800', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  phrase: { fontSize: 16, fontWeight: '700' },
  progressTrack: { width: 140, height: 4, borderRadius: 99, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', borderRadius: 99 },
});

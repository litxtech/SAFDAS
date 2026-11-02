import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { startLiveVideo, type LiveCategory, type LivePrivacy } from '@/services/live';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';

const CATEGORIES: { key: Exclude<LiveCategory, 'following'>; labelKey: 'liveCatAll' | 'liveCatQuran' | 'liveCatDua' | 'liveCatCommunity' }[] = [
  { key: 'all', labelKey: 'liveCatAll' },
  { key: 'quran', labelKey: 'liveCatQuran' },
  { key: 'dua', labelKey: 'liveCatDua' },
  { key: 'community', labelKey: 'liveCatCommunity' },
];

export default function GoLiveScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const show = useToastStore((s) => s.show);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Exclude<LiveCategory, 'following'>>('all');
  const [privacy, setPrivacy] = useState<LivePrivacy>('public');
  const [recording, setRecording] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [starting, setStarting] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const startingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const titleY = useRef(0);

  async function start() {
    Keyboard.dismiss();
    if (!userId || startingRef.current) return;
    if (title.trim().length < 3) {
      show(t('liveTitleRequired'), 'error');
      return;
    }
    startingRef.current = true;
    setStarting(true);
    const t0 = Date.now();
    try {
      const roomId = await startLiveVideo({ title, category, privacy, recording });
      router.replace({
        pathname: '/live/[id]',
        params: { id: roomId, host: '1', t0: String(t0), mic: micOn ? '1' : '0', cam: camOn ? '1' : '0' },
      });
    } catch (e) {
      show(e instanceof Error ? e.message : t('errorGeneric'), 'error');
      startingRef.current = false;
      setStarting(false);
    }
  }

  function scrollTitleIntoView() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, titleY.current - 24), animated: true });
    });
  }

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { paddingTop: insets.top + 8 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.top}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            router.back();
          }}
          hitSlop={10}
          style={styles.iconBtn}
        >
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.heading}>{t('liveGoLiveTitle')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={Keyboard.dismiss} accessible={false}>
          <View style={[styles.preview, titleFocused && styles.previewCompact]}>
            <View style={styles.camOff}>
              <Ionicons name={camOn ? 'videocam' : 'videocam-off'} size={titleFocused ? 32 : 48} color="rgba(255,255,255,0.55)" />
              {!titleFocused ? <Text style={styles.previewHint}>{t('livePreviewHint')}</Text> : null}
            </View>
            <View style={styles.previewControls}>
              <Pressable onPress={() => setMicOn((v) => !v)} style={styles.chip}>
                <Ionicons name={micOn ? 'mic' : 'mic-off'} size={18} color="#FFF" />
              </Pressable>
              <Pressable onPress={() => setCamOn((v) => !v)} style={styles.chip}>
                <Ionicons name={camOn ? 'videocam' : 'videocam-off'} size={18} color="#FFF" />
              </Pressable>
            </View>
          </View>
        </Pressable>

        <View
          onLayout={(event) => {
            titleY.current = event.nativeEvent.layout.y;
          }}
        >
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('liveTitlePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.titleInput}
            maxLength={80}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
            onFocus={() => {
              setTitleFocused(true);
              scrollTitleIntoView();
            }}
            onBlur={() => setTitleFocused(false)}
          />
        </View>

        <View style={styles.rowWrap}>
          {CATEGORIES.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => {
                Keyboard.dismiss();
                setCategory(item.key);
              }}
              style={[styles.filter, category === item.key && styles.filterOn]}
            >
              <Text style={styles.filterText}>{t(item.labelKey)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.privacyRow}>
          {(['public', 'followers', 'private'] as LivePrivacy[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => {
                Keyboard.dismiss();
                setPrivacy(p);
              }}
              style={[styles.filter, privacy === p && styles.filterOn]}
            >
              <Text style={styles.filterText}>
                {p === 'public' ? t('livePrivacyPublic') : p === 'followers' ? t('livePrivacyFollowers') : t('livePrivacyPrivate')}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.recordRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recordLabel}>{t('liveRecording')}</Text>
            <Text style={styles.recordHint}>{t('liveRecordingHint')}</Text>
          </View>
          <Switch value={recording} onValueChange={setRecording} trackColor={{ true: '#A65CD6' }} />
        </View>

        <Pressable onPress={() => void start()} disabled={starting} style={[styles.startBtn, starting && { opacity: 0.7 }]}>
          {starting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.startText}>{t('liveStartButton')}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#12081C', paddingHorizontal: 16 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { gap: 12, flexGrow: 1 },
  preview: {
    minHeight: 280,
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A0B2E',
  },
  previewCompact: {
    minHeight: 120,
    height: 120,
  },
  camOff: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  previewHint: { color: 'rgba(255,255,255,0.55)', textAlign: 'center', paddingHorizontal: 24 },
  previewControls: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', gap: 8 },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInput: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  privacyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterOn: { backgroundColor: 'rgba(166,92,214,0.55)' },
  filterText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordLabel: { color: '#FFFFFF', fontWeight: '700' },
  recordHint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  startBtn: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#A65CD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
});

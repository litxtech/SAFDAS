import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { StoryFeedItem } from '@/services/stories/types';
import { storyFeedCategoryName } from '@/services/stories/api';
import { pauseStorySpeech, resumeStorySpeech, useStorySpeech } from '@/services/stories/tts';
import { dateLocale, useI18nStore, type Locale } from '@/i18n';
import { useFeatureT } from '@/i18n/features';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  story: StoryFeedItem;
  featured?: boolean;
  onPress: () => void;
};

function formatDate(value: string | null, locale: Locale) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(dateLocale(locale), { day: 'numeric', month: 'short' }).format(new Date(value));
  } catch {
    return '';
  }
}

/**
 * Feed card for a story.
 *
 * Instagram-style composition: media (or a quiet gradient for text-only
 * stories), category chip on the media, a floating listen button, then the
 * title/excerpt and an icon+count action row. The listen button starts the
 * reader on the detail screen instead of duplicating TTS state here.
 */
export function StoryCard({ story, featured, onPress }: Props) {
  const { colors, name } = useTheme();
  const t = useFeatureT();
  const locale = useI18nStore((state) => state.locale);
  const speech = useStorySpeech();
  const category = storyFeedCategoryName(story, locale);

  const mine = speech.storyId === story.id;
  const playing = mine && (speech.status === 'speaking' || speech.status === 'loading');
  const paused = mine && speech.status === 'paused';

  function onListen() {
    if (playing) {
      void pauseStorySpeech();
      return;
    }
    if (paused) {
      void resumeStorySpeech();
      return;
    }
    router.push({ pathname: '/stories/[id]', params: { id: story.id, listen: '1' } });
  }

  const listenLabel = playing ? t('storiesPause') : paused ? t('storiesResume') : t('storiesListen');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={story.title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.96 : 1 },
      ]}
    >
      {story.cover_url ? (
        <View>
          <Image
            source={{ uri: story.cover_url }}
            style={[styles.cover, featured ? styles.coverFeatured : null]}
            contentFit="cover"
            transition={140}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.46)']}
            style={styles.coverScrim}
          />
          <View style={styles.coverTop}>
            {category ? (
              <View style={styles.glassChip}>
                <Text style={styles.glassChipText} numberOfLines={1}>
                  {category}
                </Text>
              </View>
            ) : null}
            {story.pseudonymous ? (
              <View style={styles.glassChip}>
                <Ionicons name="eye-off-outline" size={11} color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listenLabel}
            onPress={onListen}
            hitSlop={6}
            style={({ pressed }) => [styles.listenFab, pressed && { opacity: 0.82 }]}
          >
            <Ionicons name={playing ? 'pause' : 'play'} size={17} color="#12100F" />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.body}>
        {!story.cover_url ? (
          <View style={styles.eyebrowRow}>
            {category ? (
              <View style={[styles.chip, { backgroundColor: colors.primaryMuted }]}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }} numberOfLines={1}>
                  {category}
                </Text>
              </View>
            ) : null}
            {story.pseudonymous ? (
              <View style={[styles.chip, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="eye-off-outline" size={11} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}>
                  {t('storiesPseudonymousShare')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text
          style={[styles.title, { color: colors.text, fontSize: featured ? 21 : 17, lineHeight: featured ? 28 : 23 }]}
          numberOfLines={featured ? 3 : 2}
        >
          {story.title}
        </Text>
        {story.excerpt ? (
          <Text style={[styles.excerpt, { color: colors.textSecondary }]} numberOfLines={featured ? 3 : 2}>
            {story.excerpt}
          </Text>
        ) : null}

        <View style={styles.byline}>
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
            {story.author_name}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>·</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{story.reading_minutes} {t('storiesRead')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginStart: 'auto' }}>
            {formatDate(story.published_at, locale)}
          </Text>
        </View>

        <View style={[styles.actions, { borderTopColor: name === 'dark' ? 'rgba(255,255,255,0.08)' : colors.divider }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listenLabel}
            onPress={onListen}
            hitSlop={6}
            style={({ pressed }) => [
              styles.iconAction,
              { backgroundColor: playing ? colors.primaryMuted : colors.backgroundSecondary },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons
              name={playing ? 'pause' : 'volume-medium-outline'}
              size={15}
              color={playing ? colors.primary : colors.text}
            />
            <Text style={{ color: playing ? colors.primary : colors.text, fontSize: 11, fontWeight: '700' }}>
              {listenLabel}
            </Text>
          </Pressable>
          <View style={styles.stat}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.iconMuted} />
            <Text style={{ color: colors.textSecondary, fontSize: 11.5 }}>{story.comment_count}</Text>
          </View>
          {story.support_enabled ? (
            <View style={styles.stat}>
              <Ionicons name="heart-outline" size={14} color={colors.iconMuted} />
              <Text style={{ color: colors.textSecondary, fontSize: 11.5 }}>{story.support_count}</Text>
            </View>
          ) : null}
          {story.linked_key ? (
            <View style={[styles.linkedPill, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons
                name={story.linked_kind === 'quran' ? 'book-outline' : 'sparkles-outline'}
                size={12}
                color={colors.primary}
              />
              <Text style={{ color: colors.primary, fontSize: 10.5, fontWeight: '800' }} numberOfLines={1}>
                {story.linked_label ?? t('storiesLinkedListen')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cover: { width: '100%', height: 172 },
  coverFeatured: { height: 218 },
  coverScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%' },
  coverTop: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  glassChip: {
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(12,10,14,0.52)',
  },
  glassChipText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.2 },
  listenFab: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  body: { padding: 15, gap: 8 },
  eyebrowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: {
    minHeight: 22,
    borderRadius: 999,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: { fontWeight: '800', letterSpacing: -0.2 },
  excerpt: { fontSize: 13, lineHeight: 20 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actions: {
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconAction: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkedPill: {
    marginStart: 'auto',
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
});

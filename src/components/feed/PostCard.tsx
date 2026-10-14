import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppAvatar } from '@/components/ui/AppAvatar';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

export type FeedPost = {
  id: string;
  body: string | null;
  created_at: string;
  author_id: string;
  like_count: number;
  comment_count: number;
  liked: boolean;
  saved: boolean;
  media_url: string | null;
  media_type: string | null;
  profiles: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean;
  } | null;
};

export function PostCard({ post, onChange }: { post: FeedPost; onChange: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const show = useToastStore((state) => state.show);
  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [likes, setLikes] = useState(post.like_count);
  const name = post.profiles?.display_name || post.profiles?.username || t('userFallback');

  async function toggleLike() {
    if (!supabase || !userId) return;
    const next = !liked;
    setLiked(next);
    setLikes((count) => count + (next ? 1 : -1));
    const query = next
      ? supabase.from('post_likes').insert({ post_id: post.id, user_id: userId })
      : supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', userId);
    const { error } = await query;
    if (error) {
      setLiked(!next);
      setLikes((count) => count + (next ? -1 : 1));
      show(error.message, 'error');
    }
  }

  async function toggleSave() {
    if (!supabase || !userId) return;
    const next = !saved;
    setSaved(next);
    const query = next
      ? supabase.from('saved_posts').insert({ post_id: post.id, user_id: userId })
      : supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', userId);
    const { error } = await query;
    if (error) {
      setSaved(!next);
      show(error.message, 'error');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Pressable style={styles.author} onPress={() => router.push({ pathname: '/user/[id]', params: { id: post.author_id } })}>
          <AppAvatar uri={post.profiles?.avatar_url} name={name} />
          <View>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {name} {post.profiles?.verified ? '✓' : ''}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              @{post.profiles?.username} · {new Date(post.created_at).toLocaleDateString('tr-TR')}
            </Text>
          </View>
        </Pressable>
        <Pressable accessibilityLabel={t('postMenu')} onPress={() => router.push({ pathname: '/report/create', params: { targetType: 'post', targetId: post.id } })}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.iconMuted} />
        </Pressable>
      </View>
      {post.body ? <Text style={[styles.body, { color: colors.text }]}>{post.body}</Text> : null}
      {post.media_url ? (
        <Image source={{ uri: post.media_url }} style={styles.media} contentFit="cover" />
      ) : null}
      <View style={styles.actions}>
        <Pressable onPress={() => void toggleLike()} style={styles.action}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.primary : colors.icon} />
          <Text style={{ color: colors.textSecondary }}>{likes}</Text>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })} style={styles.action}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.icon} />
          <Text style={{ color: colors.textSecondary }}>{post.comment_count}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void Share.share({ message: post.body?.trim() ? post.body : t('sharePostFallback') });
          }}
          style={styles.action}
        >
          <Ionicons name="arrow-redo-outline" size={20} color={colors.icon} />
        </Pressable>
        <Pressable onPress={() => void toggleSave()} style={styles.action}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? colors.primary : colors.icon} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, paddingVertical: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  body: { fontSize: 16, lineHeight: 23 },
  media: { width: '100%', aspectRatio: 4 / 5, borderRadius: 18 },
  actions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
});

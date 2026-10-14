import { requireSupabase } from '@/lib/supabase';
import type { FeedPost } from '@/components/feed/PostCard';

type ProfileRow = FeedPost['profiles'];
type MediaRow = { url: string; media_type: string | null };

export async function fetchFeed(mode: 'discover' | 'following', userId: string): Promise<FeedPost[]> {
  const client = requireSupabase();
  let authorIds: string[] | null = null;
  if (mode === 'following') {
    const { data, error } = await client.from('follows').select('following_id').eq('follower_id', userId).eq('status', 'accepted');
    if (error) throw error;
    authorIds = (data ?? []).map((row) => row.following_id as string);
    if (!authorIds.length) return [];
  }

  let query = client
    .from('posts')
    .select('id, body, created_at, author_id, profiles(username, display_name, avatar_url, verified), post_media(url, media_type)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(30);
  if (authorIds) query = query.in('author_id', authorIds);
  const { data, error } = await query;
  if (error) throw error;
  const posts = data ?? [];
  const ids = posts.map((post) => post.id as string);
  if (!ids.length) return [];

  const [{ data: likes }, { data: comments }, { data: saves }] = await Promise.all([
    client.from('post_likes').select('post_id, user_id').in('post_id', ids),
    client.from('comments').select('post_id').in('post_id', ids).is('deleted_at', null),
    client.from('saved_posts').select('post_id').eq('user_id', userId).in('post_id', ids),
  ]);

  return posts.map((post) => {
    const id = post.id as string;
    const media = (post.post_media as MediaRow[] | null)?.[0];
    const profile = post.profiles as ProfileRow | ProfileRow[] | null;
    return {
      id,
      body: (post.body as string | null) ?? null,
      created_at: post.created_at as string,
      author_id: post.author_id as string,
      like_count: (likes ?? []).filter((like) => like.post_id === id).length,
      comment_count: (comments ?? []).filter((comment) => comment.post_id === id).length,
      liked: (likes ?? []).some((like) => like.post_id === id && like.user_id === userId),
      saved: (saves ?? []).some((save) => save.post_id === id),
      media_url: media?.url ?? null,
      media_type: media?.media_type ?? null,
      profiles: Array.isArray(profile) ? profile[0] ?? null : profile,
    };
  });
}

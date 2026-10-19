import type { FeedPost, QuotedFeedPost } from '@/components/feed/PostCard';
import { requireSupabase } from '@/lib/supabase';
import { signedMediaUrls } from '@/services/media';

type ProfileRow = FeedPost['profiles'];
type MediaRow = { url: string; media_type: string | null };

const PAGE = 12;
const POST_SELECT =
  'id, body, kind, created_at, author_id, visibility, location_name, quoted_post_id, studio_recording_id, profiles(username, display_name, avatar_url, verified), post_media(url, media_type)';
const POST_SELECT_NO_LOCATION =
  'id, body, kind, created_at, author_id, visibility, quoted_post_id, studio_recording_id, profiles(username, display_name, avatar_url, verified), post_media(url, media_type)';
const POST_SELECT_LEGACY =
  'id, body, kind, created_at, author_id, visibility, profiles(username, display_name, avatar_url, verified), post_media(url, media_type)';
const POST_SELECT_NO_STUDIO =
  'id, body, kind, created_at, author_id, visibility, location_name, quoted_post_id, profiles(username, display_name, avatar_url, verified), post_media(url, media_type)';

export type FeedPage = { posts: FeedPost[]; nextOffset: number | null };

function oneProfile(value: ProfileRow | ProfileRow[] | null): ProfileRow {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

type RawPost = {
  id: string;
  body: string | null;
  kind?: string | null;
  created_at: string;
  author_id: string;
  location_name?: string | null;
  quoted_post_id?: string | null;
  studio_recording_id?: string | null;
  profiles: ProfileRow | ProfileRow[] | null;
  post_media: MediaRow[] | null;
};

export async function fetchFeedPage(mode: 'discover' | 'following', userId: string, offset: number): Promise<FeedPage> {
  const client = requireSupabase();
  let authorIds: string[] | null = null;
  if (mode === 'following') {
    const { data, error } = await client.from('follows').select('following_id').eq('follower_id', userId).eq('status', 'accepted');
    if (error) throw error;
    authorIds = (data ?? []).map((row) => row.following_id as string);
    if (!authorIds.length) return { posts: [], nextOffset: null };
  }

  const range = { from: offset, to: offset + PAGE - 1 };
  const run = (columns: string) => {
    let query = client
      .from('posts')
      .select(columns)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .range(range.from, range.to);
    if (authorIds) query = query.in('author_id', authorIds);
    else query = query.eq('visibility', 'public');
    return query;
  };
  let { data, error } = await run(POST_SELECT);
  if (error && /studio_recording_id/.test(error.message)) {
    ({ data, error } = await run(POST_SELECT_NO_STUDIO));
  }
  // Prefer dropping only location_name so quote embeds still hydrate.
  if (error && /location_name/.test(error.message) && !/quoted_post_id/.test(error.message)) {
    ({ data, error } = await run(POST_SELECT_NO_LOCATION));
  }
  if (error && /quoted_post_id|location_name|studio_recording_id/.test(error.message)) {
    ({ data, error } = await run(POST_SELECT_LEGACY));
  }
  if (error) throw error;
  return hydratePosts((data ?? []) as RawPost[], userId, offset);
}

async function loadQuotedMap(quoteIds: string[], sign: (rows: MediaRow[]) => MediaRow[]): Promise<Map<string, QuotedFeedPost>> {
  const map = new Map<string, QuotedFeedPost>();
  if (!quoteIds.length) return map;
  const client = requireSupabase();
  const { data, error } = await client
    .from('posts')
    .select('id, body, author_id, profiles(username, display_name, avatar_url, verified), post_media(url, media_type)')
    .in('id', quoteIds)
    .is('archived_at', null);
  if (error) return map;
  for (const row of data ?? []) {
    const id = row.id as string;
    const media = sign((((row.post_media as MediaRow[] | null) ?? []).filter((item) => item.url)) as MediaRow[]);
    map.set(id, {
      id,
      body: (row.body as string | null) ?? null,
      author_id: row.author_id as string,
      media,
      profiles: oneProfile(row.profiles as ProfileRow | ProfileRow[] | null),
    });
  }
  return map;
}

async function hydratePosts(posts: RawPost[], userId: string, offset: number): Promise<FeedPage> {
  const client = requireSupabase();
  const ids = posts.map((post) => post.id as string);
  if (!ids.length) return { posts: [], nextOffset: null };

  const quoteIds = [...new Set(posts.map((post) => post.quoted_post_id).filter((id): id is string => Boolean(id)))];

  const [{ data: likes }, { data: comments }, { data: previews }, { data: saves }, repostResult] = await Promise.all([
    client.from('post_likes').select('post_id, user_id').in('post_id', ids),
    client.from('comments').select('post_id').in('post_id', ids).is('deleted_at', null),
    client
      .from('comments')
      .select('id, post_id, body, created_at, profiles(username)')
      .in('post_id', ids)
      .is('deleted_at', null)
      .is('parent_id', null)
      .order('created_at', { ascending: false }),
    client.from('saved_posts').select('post_id').eq('user_id', userId).in('post_id', ids),
    client.from('post_reposts').select('post_id, user_id').in('post_id', ids),
  ]);
  const reposts = repostResult.error ? [] : repostResult.data ?? [];

  const embedded = new Map<string, MediaRow[]>();
  for (const post of posts) {
    embedded.set(post.id as string, ((post.post_media as MediaRow[] | null) ?? []).filter((item) => item.url));
  }
  const { data: mediaRows } = await client.from('post_media').select('post_id, url, media_type').in('post_id', [...ids, ...quoteIds]);
  const grouped = new Map<string, MediaRow[]>();
  for (const row of mediaRows ?? []) {
    const postId = row.post_id as string;
    const item = { url: row.url as string, media_type: (row.media_type as string | null) ?? null };
    grouped.set(postId, [...(grouped.get(postId) ?? []), item]);
  }
  const allUrls = [...grouped.values(), ...embedded.values()].flat().map((item) => item.url);
  const signed = await signedMediaUrls([...new Set(allUrls)]).catch(() => new Map<string, string>());
  const withUrls = (rows: MediaRow[]) => rows.map((item) => ({ ...item, url: signed.get(item.url) ?? item.url }));

  const quotedMap = await loadQuotedMap(quoteIds, withUrls);
  // Prefer media from grouped (signed) over embedded when available
  for (const [id, quote] of quotedMap) {
    const fromGrouped = grouped.get(id);
    if (fromGrouped?.length) quotedMap.set(id, { ...quote, media: withUrls(fromGrouped) });
  }

  const mapped = posts.map((post) => {
    const id = post.id as string;
    const media = withUrls(grouped.get(id) ?? embedded.get(id) ?? []);
    const quotedPostId = post.quoted_post_id ?? null;
    return {
      id,
      body: (post.body as string | null) ?? null,
      kind: (post.kind as string | null) ?? null,
      created_at: post.created_at as string,
      author_id: post.author_id as string,
      location_name: (post.location_name as string | null) ?? null,
      quoted_post_id: quotedPostId,
      studio_recording_id: (post.studio_recording_id as string | null) ?? null,
      quoted: quotedPostId ? quotedMap.get(quotedPostId) ?? null : null,
      like_count: (likes ?? []).filter((like) => like.post_id === id).length,
      comment_count: (comments ?? []).filter((comment) => comment.post_id === id).length,
      repost_count: (reposts ?? []).filter((repost) => repost.post_id === id).length,
      liked: (likes ?? []).some((like) => like.post_id === id && like.user_id === userId),
      saved: (saves ?? []).some((save) => save.post_id === id),
      reposted: (reposts ?? []).some((repost) => repost.post_id === id && repost.user_id === userId),
      media,
      comments: (previews ?? [])
        .filter((comment) => comment.post_id === id)
        .map((comment) => {
          const profile = comment.profiles as { username?: string | null } | { username?: string | null }[] | null;
          const row = Array.isArray(profile) ? profile[0] : profile;
          return { id: comment.id as string, body: comment.body as string, username: row?.username ?? null };
        })
        // Blocked authors: RLS drops comment or profile join — skip empty previews
        .filter((comment) => Boolean(comment.body))
        .slice(0, 2),
      profiles: oneProfile(post.profiles as ProfileRow | ProfileRow[] | null),
    } satisfies FeedPost;
  });
  return { posts: mapped, nextOffset: posts.length < PAGE ? null : offset + posts.length };
}

export async function fetchAuthorPosts(authorId: string, viewerId: string) {
  const client = requireSupabase();
  const run = (columns: string) =>
    client
      .from('posts')
      .select(columns)
      .eq('author_id', authorId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(30);
  let { data, error } = await run(POST_SELECT);
  if (error && /studio_recording_id/.test(error.message)) {
    ({ data, error } = await run(POST_SELECT_NO_STUDIO));
  }
  if (error && /location_name/.test(error.message) && !/quoted_post_id/.test(error.message)) {
    ({ data, error } = await run(POST_SELECT_NO_LOCATION));
  }
  if (error && /quoted_post_id|location_name|studio_recording_id/.test(error.message)) {
    ({ data, error } = await run(POST_SELECT_LEGACY));
  }
  if (error) throw error;
  const page = await hydratePosts((data ?? []) as RawPost[], viewerId, 0);
  return page.posts;
}

export async function fetchFeed(mode: 'discover' | 'following', userId: string): Promise<FeedPost[]> {
  const page = await fetchFeedPage(mode, userId, 0);
  return page.posts;
}

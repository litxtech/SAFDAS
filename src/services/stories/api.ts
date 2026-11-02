import { requireSupabase } from '@/lib/supabase';
import type {
  StoryCategory,
  StoryCategoryNames,
  StoryComment,
  StoryDetail,
  StoryFeedItem,
  StoryIncomingContact,
  StoryMyItem,
  StoryOutgoingContact,
  StorySaveInput,
} from './types';

export type StoryClientConfig = {
  enabled: boolean;
  daily_publish_limit: number;
  comment_daily_limit: number;
  contact_daily_limit: number;
  pending_contact_limit: number;
  contact_cooldown_days: number;
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function fetchStoryConfig(): Promise<StoryClientConfig> {
  const { data, error } = await requireSupabase().rpc('story_client_config');
  fail(error);
  const row = (data ?? {}) as Partial<StoryClientConfig>;
  return {
    enabled: row.enabled !== false,
    daily_publish_limit: Number(row.daily_publish_limit ?? 5),
    comment_daily_limit: Number(row.comment_daily_limit ?? 100),
    contact_daily_limit: Number(row.contact_daily_limit ?? 10),
    pending_contact_limit: Number(row.pending_contact_limit ?? 5),
    contact_cooldown_days: Number(row.contact_cooldown_days ?? 14),
  };
}

let categoryCache: { at: number; items: StoryCategory[] } | null = null;

export async function fetchStoryCategories(force = false): Promise<StoryCategory[]> {
  if (!force && categoryCache && Date.now() - categoryCache.at < 10 * 60_000) {
    return categoryCache.items;
  }
  const { data, error } = await requireSupabase().rpc('story_categories_list');
  fail(error);
  const items = asArray<StoryCategory>(data);
  categoryCache = { at: Date.now(), items };
  return items;
}

export function clearStoryCategoryCache() {
  categoryCache = null;
}

export async function fetchStories(input: {
  tab: 'for_you' | 'new' | 'saved';
  categoryId?: string | null;
  cursor?: string | null;
  limit?: number;
  linkedKey?: string | null;
}): Promise<{ items: StoryFeedItem[]; nextCursor: string | null }> {
  const limit = input.limit ?? 12;
  const { data, error } = await requireSupabase().rpc('stories_feed', {
    p_tab: input.tab,
    p_category: input.categoryId ?? null,
    p_cursor: input.cursor ?? null,
    p_limit: limit,
    p_linked_key: input.linkedKey ?? null,
  });
  fail(error);
  const items = asArray<StoryFeedItem>(data);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: items.length >= limit ? last?.published_at ?? null : null,
  };
}

export async function fetchStoryDetail(storyId: string): Promise<StoryDetail> {
  const { data, error } = await requireSupabase().rpc('story_detail', { p_story: storyId });
  fail(error);
  if (!data) throw new Error('Hikâye bulunamadı');
  return data as StoryDetail;
}

export async function fetchMyStories(): Promise<StoryMyItem[]> {
  const { data, error } = await requireSupabase().rpc('story_my_stories');
  fail(error);
  return asArray<StoryMyItem>(data);
}

export async function saveStory(
  input: StorySaveInput,
): Promise<{ id: string; status: 'draft' | 'published'; reading_minutes: number }> {
  const { data, error } = await requireSupabase().rpc('story_save', {
    p_payload: {
      id: input.id ?? null,
      title: input.title.trim(),
      body: input.body.trim(),
      category_id: input.categoryId,
      cover_url: input.coverUrl,
      pseudonymous: input.pseudonymous,
      comments_enabled: input.commentsEnabled,
      contact_enabled: input.pseudonymous ? false : input.contactEnabled,
      support_enabled: input.supportEnabled,
      status: input.status,
      linked: input.linked
        ? {
            kind: input.linked.kind,
            key: input.linked.key,
            label: input.linked.label,
            reciter_id: input.linked.reciterId ?? null,
          }
        : null,
    },
  });
  fail(error);
  return data as { id: string; status: 'draft' | 'published'; reading_minutes: number };
}

export async function setStoryStatus(
  storyId: string,
  status: 'draft' | 'published',
): Promise<{ status: string }> {
  const { data, error } = await requireSupabase().rpc('story_set_status', {
    p_story: storyId,
    p_status: status,
  });
  fail(error);
  return data as { status: string };
}

export async function deleteStory(storyId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('story_delete', { p_story: storyId });
  fail(error);
}

export async function toggleStoryBookmark(
  storyId: string,
  saved: boolean,
): Promise<{ saved: boolean; bookmark_count: number }> {
  const { data, error } = await requireSupabase().rpc('story_toggle_bookmark', {
    p_story: storyId,
    p_saved: saved,
  });
  fail(error);
  return data as { saved: boolean; bookmark_count: number };
}

export async function supportStory(storyId: string): Promise<{ supported: boolean; support_count: number }> {
  const { data, error } = await requireSupabase().rpc('story_support', { p_story: storyId });
  fail(error);
  return data as { supported: boolean; support_count: number };
}

export async function fetchStoryComments(
  storyId: string,
  before?: string | null,
  limit = 30,
): Promise<StoryComment[]> {
  const { data, error } = await requireSupabase().rpc('story_comments_list', {
    p_story: storyId,
    p_limit: limit,
    p_before: before ?? null,
  });
  fail(error);
  return asArray<StoryComment>(data);
}

export async function addStoryComment(
  storyId: string,
  body: string,
  parentId?: string | null,
): Promise<{ id: string; comment_count: number }> {
  const { data, error } = await requireSupabase().rpc('story_add_comment', {
    p_story: storyId,
    p_body: body.trim(),
    p_parent: parentId ?? null,
  });
  fail(error);
  return data as { id: string; comment_count: number };
}

export async function deleteStoryComment(commentId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('story_delete_comment', { p_comment: commentId });
  fail(error);
}

export async function requestStoryContact(
  storyId: string,
  message?: string | null,
): Promise<{ request_id: string; status: string }> {
  const { data, error } = await requireSupabase().rpc('story_request_contact', {
    p_story: storyId,
    p_message: message?.trim() ? message.trim() : null,
  });
  fail(error);
  return data as { request_id: string; status: string };
}

export async function fetchIncomingStoryContacts(): Promise<StoryIncomingContact[]> {
  const { data, error } = await requireSupabase().rpc('story_incoming_contact_requests');
  fail(error);
  return asArray<StoryIncomingContact>(data);
}

export async function fetchOutgoingStoryContacts(): Promise<StoryOutgoingContact[]> {
  const { data, error } = await requireSupabase().rpc('story_outgoing_contact_requests');
  fail(error);
  return asArray<StoryOutgoingContact>(data);
}

export async function respondStoryContact(
  requestId: string,
  action: 'accept' | 'decline' | 'block',
): Promise<{ status: string; conversation_id?: string | null }> {
  const { data, error } = await requireSupabase().rpc('story_respond_contact', {
    p_request: requestId,
    p_action: action,
  });
  fail(error);
  return data as { status: string; conversation_id?: string | null };
}

export async function reportStory(
  storyId: string,
  reason: string,
  details?: string | null,
): Promise<{ report_id: string }> {
  const { data, error } = await requireSupabase().rpc('story_report', {
    p_story: storyId,
    p_reason: reason,
    p_details: details ?? null,
  });
  fail(error);
  return data as { report_id: string };
}

export async function reportStoryComment(
  commentId: string,
  reason: string,
  details?: string | null,
): Promise<{ report_id: string }> {
  const { data, error } = await requireSupabase().rpc('story_report_comment', {
    p_comment: commentId,
    p_reason: reason,
    p_details: details ?? null,
  });
  fail(error);
  return data as { report_id: string };
}

export type StoryCategoryNameInput = {
  name_tr?: string | null;
  name_en?: string | null;
  name_ar?: string | null;
  name_es?: string | null;
  tr?: string | null;
  en?: string | null;
  ar?: string | null;
  es?: string | null;
};

export function storyCategoryNames(category: StoryCategoryNameInput | null): StoryCategoryNames {
  if (!category) return {};
  if (category.tr !== undefined || category.en !== undefined || category.ar !== undefined || category.es !== undefined) {
    return { tr: category.tr, en: category.en, ar: category.ar, es: category.es };
  }
  return {
    tr: category.name_tr,
    en: category.name_en,
    ar: category.name_ar,
    es: category.name_es,
  };
}

export function storyCategoryName(
  category: StoryCategoryNameInput | null,
  locale: 'tr' | 'en' | 'ar' | 'es',
): string {
  const names = storyCategoryNames(category);
  if (locale === 'tr') return names.tr ?? '';
  if (locale === 'en') return names.en ?? names.tr ?? '';
  if (locale === 'ar') return names.ar ?? names.en ?? names.tr ?? '';
  return names.es ?? names.en ?? names.tr ?? '';
}

export function storyFeedCategoryName(item: StoryFeedItem, locale: 'tr' | 'en' | 'ar' | 'es') {
  return storyCategoryName(
    { tr: item.name_tr, en: item.name_en, ar: item.name_ar, es: item.name_es },
    locale,
  );
}

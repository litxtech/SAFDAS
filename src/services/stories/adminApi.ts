import { requireSupabase } from '@/lib/supabase';
import type { StoryAdminDetail, StoryAdminItem, StoryCategory } from './types';

export type StoryAdminStats = {
  enabled: boolean;
  published: number;
  drafts: number;
  hidden: number;
  removed: number;
  reported_open: number;
  comments: number;
  pending_contact_requests: number;
};

export type StoryAdminCategory = StoryCategory & {
  active: boolean;
  updated_at: string;
  story_count: number;
};

export type StoryAdminSearchInput = {
  query?: string | null;
  categoryId?: string | null;
  status?: string | null;
  reportedOnly?: boolean;
  linked?: string | null;
  limit?: number;
  offset?: number;
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function fetchStoryAdminStats(): Promise<StoryAdminStats> {
  const { data, error } = await requireSupabase().rpc('admin_stories_stats');
  fail(error);
  const row = (data ?? {}) as Partial<StoryAdminStats>;
  return {
    enabled: row.enabled !== false,
    published: Number(row.published ?? 0),
    drafts: Number(row.drafts ?? 0),
    hidden: Number(row.hidden ?? 0),
    removed: Number(row.removed ?? 0),
    reported_open: Number(row.reported_open ?? 0),
    comments: Number(row.comments ?? 0),
    pending_contact_requests: Number(row.pending_contact_requests ?? 0),
  };
}

export async function searchStoryAdmin(input: StoryAdminSearchInput): Promise<StoryAdminItem[]> {
  const { data, error } = await requireSupabase().rpc('admin_stories_search', {
    p_query: input.query?.trim() || null,
    p_category: input.categoryId ?? null,
    p_status: input.status && input.status !== 'all' ? input.status : null,
    p_reported: input.reportedOnly ? true : null,
    p_linked: input.linked?.trim() || null,
    p_limit: input.limit ?? 30,
    p_offset: input.offset ?? 0,
  });
  fail(error);
  return Array.isArray(data) ? (data as StoryAdminItem[]) : [];
}

export async function fetchStoryAdminDetail(storyId: string): Promise<StoryAdminDetail> {
  const { data, error } = await requireSupabase().rpc('admin_story_detail', { p_story: storyId });
  fail(error);
  if (!data) throw new Error('Hikâye bulunamadı');
  return data as StoryAdminDetail;
}

export async function moderateStoryAdmin(
  storyId: string,
  action: 'hide' | 'restore' | 'remove' | 'clear_reports',
  reason?: string | null,
): Promise<{ status: string }> {
  const { data, error } = await requireSupabase().rpc('admin_story_moderate', {
    p_story: storyId,
    p_action: action,
    p_reason: reason?.trim() || null,
  });
  fail(error);
  return data as { status: string };
}

export async function fetchStoryAdminCategories(): Promise<StoryAdminCategory[]> {
  const { data, error } = await requireSupabase().rpc('admin_story_categories');
  fail(error);
  return Array.isArray(data) ? (data as StoryAdminCategory[]) : [];
}

export async function saveStoryAdminCategory(input: {
  id?: string | null;
  slug: string;
  nameTr: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameEs?: string | null;
  icon?: string | null;
  sortOrder: number;
  active: boolean;
}): Promise<string> {
  const { data, error } = await requireSupabase().rpc('admin_story_category_save', {
    p_id: input.id ?? null,
    p_slug: input.slug,
    p_name_tr: input.nameTr,
    p_name_en: input.nameEn ?? null,
    p_name_ar: input.nameAr ?? null,
    p_name_es: input.nameEs ?? null,
    p_icon: input.icon ?? null,
    p_sort_order: input.sortOrder,
    p_active: input.active,
  });
  fail(error);
  return (data as { id: string }).id;
}

export async function disableStoryAdminCategory(categoryId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_story_category_remove', { p_id: categoryId });
  fail(error);
}

export async function hideStoryCommentAdmin(commentId: string, hidden: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_hide_story_comment', {
    p_comment: commentId,
    p_hidden: hidden,
  });
  fail(error);
}

export async function setStoriesEnabled(enabled: boolean): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('admin_set_stories_enabled', {
    p_enabled: enabled,
  });
  fail(error);
  return Boolean((data as { enabled?: boolean } | null)?.enabled);
}

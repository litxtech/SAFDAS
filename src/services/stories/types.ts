export type StoryCategory = {
  id: string;
  slug: string;
  name_tr: string;
  name_en: string | null;
  name_ar: string | null;
  name_es: string | null;
  icon: string | null;
  sort_order: number;
};

export type StoryCategoryNames = {
  tr?: string | null;
  en?: string | null;
  ar?: string | null;
  es?: string | null;
};

export type StoryLinkedContent = {
  kind: 'quran' | 'dua';
  key: string;
  label: string | null;
  reciter_id: string | null;
};

export type StoryFeedItem = {
  id: string;
  title: string;
  excerpt: string;
  cover_url: string | null;
  category_id: string | null;
  category_slug: string | null;
  name_tr: string | null;
  name_en: string | null;
  name_ar: string | null;
  name_es: string | null;
  author_name: string;
  author_avatar: string | null;
  author_username?: string | null;
  pseudonymous: boolean;
  reading_minutes: number;
  published_at: string | null;
  comment_count: number;
  support_count: number;
  support_enabled: boolean;
  linked_kind: 'quran' | 'dua' | null;
  linked_key: string | null;
  linked_label: string | null;
  saved: boolean;
  own: boolean;
};

export type StoryDetail = {
  id: string;
  title: string;
  body: string;
  cover_url: string | null;
  category_id: string | null;
  category_slug: string | null;
  category_names: StoryCategoryNames | null;
  author_name: string;
  author_avatar: string | null;
  author_username: string | null;
  pseudonymous: boolean;
  status: 'draft' | 'published' | 'hidden' | 'removed';
  comments_enabled: boolean;
  contact_enabled: boolean;
  support_enabled: boolean;
  reading_minutes: number;
  comment_count: number;
  support_count: number;
  bookmark_count: number;
  published_at: string | null;
  updated_at: string;
  own: boolean;
  saved: boolean;
  supported: boolean;
  linked: StoryLinkedContent | null;
};

export type StoryMyItem = {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'hidden' | 'removed';
  cover_url: string | null;
  pseudonymous: boolean;
  reading_minutes: number;
  comment_count: number;
  support_count: number;
  published_at: string | null;
  updated_at: string;
  hidden_reason: string | null;
  linked_key: string | null;
  linked_kind: 'quran' | 'dua' | null;
  linked_label: string | null;
};

export type StoryComment = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  author_id: string | null;
  author_name: string;
  author_avatar: string | null;
  own: boolean;
};

export type StoryIncomingContact = {
  id: string;
  story_id: string;
  message: string | null;
  status: string;
  created_at: string;
  story_title: string;
  peer_id: string;
  peer_name: string;
  peer_avatar: string | null;
};

export type StoryOutgoingContact = {
  id: string;
  story_id: string;
  status: string;
  created_at: string;
  responded_at: string | null;
  story_title: string;
};

export type StorySaveInput = {
  id?: string | null;
  title: string;
  body: string;
  categoryId: string | null;
  coverUrl: string | null;
  pseudonymous: boolean;
  commentsEnabled: boolean;
  contactEnabled: boolean;
  supportEnabled: boolean;
  status: 'draft' | 'published';
  linked: { kind: 'quran' | 'dua'; key: string; label: string; reciterId?: string } | null;
};

export type StoryAdminItem = {
  id: string;
  title: string;
  status: string;
  pseudonymous: boolean;
  report_count: number;
  comment_count: number;
  support_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  author_id: string;
  author_name: string;
  author_username: string | null;
  category_slug: string | null;
  category_name: string | null;
  linked_key: string | null;
  linked_label: string | null;
  open_reports: number;
};

export type StoryAdminDetail = {
  id: string;
  title: string;
  body: string;
  cover_url: string | null;
  status: string;
  pseudonymous: boolean;
  alias: string | null;
  author_id: string;
  author_name: string;
  author_username: string | null;
  category_id: string | null;
  category_name: string | null;
  reading_minutes: number;
  report_count: number;
  comment_count: number;
  support_count: number;
  hidden_reason: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  linked: StoryLinkedContent | null;
  reports: {
    id: string;
    reason: string;
    details: string | null;
    status: string;
    created_at: string;
    reference_code: string | null;
  }[];
  moderation: { id: string; action: string; reason: string | null; created_at: string }[];
};

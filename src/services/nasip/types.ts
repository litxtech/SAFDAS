// SAFDAŞ NASİP — client-side types mirroring the SQL RPC payloads.

export type NasipGender = 'female' | 'male' | 'self_describe' | 'prefer_not_to_say';
export type NasipProfileStatus = 'draft' | 'active' | 'hidden' | 'frozen' | 'suspended' | 'deleted';
export type NasipVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type NasipPhotoVisibility = 'everyone' | 'matches' | 'approved';
export type NasipShowCity = 'city' | 'region' | 'hidden';
export type NasipMaritalStatus = 'never_married' | 'divorced' | 'widowed';
export type NasipSmoking = 'never' | 'occasionally' | 'regularly';
export type NasipMarriageTimeline = 'within_6_months' | 'within_1_year' | 'within_2_years' | 'no_rush';
export type NasipRelocationPreference = 'yes' | 'no' | 'maybe';
export type NasipRequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'blocked';
export type NasipReportReason =
  | 'harassment'
  | 'spam'
  | 'scam'
  | 'fake_profile'
  | 'inappropriate_photo'
  | 'threat'
  | 'minor'
  | 'impersonation'
  | 'other';

export type NasipPublicCard = {
  user_id: string;
  display_name: string;
  age: number | null;
  gender: NasipGender | null;
  city: string | null;
  country_code: string;
  bio: string | null;
  verified: boolean;
  photo_path: string | null;
  reasons: string[];
  last_active_at: string | null;
};

export type NasipProfileRow = {
  user_id: string;
  display_name: string;
  gender: NasipGender;
  gender_detail: string | null;
  birth_date: string;
  age: number | null;
  country_code: string;
  country_name: string | null;
  city_id: string | null;
  city_name: string | null;
  district_name: string | null;
  height_cm: number | null;
  education_level: string | null;
  profession: string | null;
  employment_status: string | null;
  marital_status: NasipMaritalStatus | null;
  previously_married: boolean | null;
  has_children: boolean | null;
  children_count: number | null;
  smoking: NasipSmoking | null;
  open_to_relocation: boolean | null;
  bio: string | null;
  religious_practice: string | null;
  sensitive_consent: boolean;
  marriage_intent: boolean;
  terms_accepted: boolean;
  privacy_accepted: boolean;
  rules_accepted: boolean;
  status: NasipProfileStatus;
  verification_status: NasipVerificationStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NasipPreferences = {
  interested_genders: NasipGender[];
  min_age: number;
  max_age: number;
  country_codes: string[];
  city_ids: string[];
  marriage_timeline: NasipMarriageTimeline | null;
  relocation_preference: NasipRelocationPreference | null;
  education_preferences: string[];
  lifestyle: Record<string, unknown>;
  discoverable: boolean;
  hide_from_search: boolean;
};

export type NasipPrivacy = {
  photo_visibility: NasipPhotoVisibility;
  show_city: NasipShowCity;
  show_online_status: boolean;
  read_receipts: boolean;
  notification_preview: boolean;
  hidden_visits: boolean;
  allow_photo_requests: boolean;
};

export type NasipNotificationPreferences = {
  requests: boolean;
  matches: boolean;
  messages: boolean;
  verification: boolean;
  marketing: boolean;
};

export type NasipPhoto = {
  id: string;
  storage_path: string;
  position: number;
  is_primary: boolean;
  moderation_status: 'pending' | 'approved' | 'rejected';
};

export type NasipVerificationRow = {
  id: string;
  kind: 'email' | 'phone' | 'selfie' | 'id_document';
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type NasipMyProfile = {
  profile: NasipProfileRow;
  complete: boolean;
  preferences: NasipPreferences;
  privacy: NasipPrivacy;
  notifications: NasipNotificationPreferences;
  photos: NasipPhoto[];
  verification: NasipVerificationRow | null;
  usage: { introduction_requests: number };
  counts: {
    incoming_requests: number;
    outgoing_requests: number;
    active_matches: number;
    unread_messages: number;
    visitors: number;
  };
};

export type NasipPhotoAccessStatus = {
  visibility: NasipPhotoVisibility;
  allow_requests: boolean;
  status: 'none' | 'pending' | 'granted';
};

export type NasipCandidateDetail = NasipPublicCard & {
  photos: { id: string; storage_path: string; position: number; is_primary: boolean }[];
  profile: {
    height_cm: number | null;
    education_level: string | null;
    profession: string | null;
    employment_status: string | null;
    marital_status: NasipMaritalStatus | null;
    previously_married: boolean | null;
    has_children: boolean | null;
    children_count: number | null;
    smoking: NasipSmoking | null;
    open_to_relocation: boolean | null;
    bio: string | null;
    verification_status: NasipVerificationStatus;
    last_active_at: string | null;
  };
  preferences: {
    marriage_timeline: NasipMarriageTimeline | null;
    relocation_preference: NasipRelocationPreference | null;
  };
  request: {
    id: string;
    status: NasipRequestStatus;
    outgoing: boolean;
    message: string | null;
    created_at: string;
  } | null;
  match: { id: string; status: 'active' | 'ended'; conversation_id: string | null } | null;
};

export type NasipIncomingRequest = {
  request_id: string;
  message: string | null;
  created_at: string;
  card: NasipPublicCard | null;
};

export type NasipOutgoingRequest = {
  request_id: string;
  status: NasipRequestStatus;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  card: NasipPublicCard | null;
};

export type NasipMatch = {
  match_id: string;
  status: 'active' | 'ended';
  created_at: string;
  ended_at: string | null;
  conversation_id: string;
  peer: NasipPublicCard | null;
  last_message_at: string | null;
  unread_count: number;
};

export type NasipConversationSummary = {
  conversation_id: string;
  match_id: string;
  match_status: 'active' | 'ended';
  match_created_at: string;
  peer: NasipPublicCard | null;
  last_message_at: string | null;
  last_message: string | null;
  last_message_sender: string | null;
  unread_count: number;
  muted: boolean;
  archived: boolean;
};

export type NasipMessage = {
  id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  deleted: boolean;
};

export type NasipThread = {
  conversation_id: string;
  match: {
    id: string;
    status: 'active' | 'ended';
    created_at: string;
    ended_at: string | null;
    ended_by: string | null;
    end_reason: string | null;
  };
  peer: NasipPublicCard | null;
  peer_last_read_at: string | null;
  my_last_read_at: string | null;
  blocked_by_me: boolean;
  blocked_me: boolean;
  messages: NasipMessage[];
};

export type NasipEntitlements = {
  is_plus: boolean;
  daily_request_limit: number;
  requests_used_today: number;
  requests_remaining: number;
  subscription: {
    id: string;
    platform: 'ios' | 'android' | 'manual';
    product: 'plus';
    product_id: string | null;
    status: 'pending_verification' | 'active' | 'grace' | 'cancelled' | 'expired' | 'refunded';
    environment: 'sandbox' | 'production';
    started_at: string | null;
    period_started_at?: string | null;
    expires_at: string | null;
    remaining_seconds?: number | null;
    sandbox_extended?: boolean;
    auto_renew: boolean;
    price_amount: number | null;
    currency: string | null;
  } | null;
  pending_verifications?: number;
  restored_at?: string;
};

export type NasipClientConfig = {
  premium_offer: {
    title?: string | null;
    body?: string | null;
    placements?: string[] | null;
    promo_frequency_days?: number | null;
  };
  product: {
    title?: string | null;
    period_label?: string | null;
    ios_product_id?: string | null;
    android_product_id?: string | null;
    enabled?: boolean | null;
  };
  limits: {
    free_daily_requests: number;
    plus_daily_requests: number;
  };
};

export type NasipProfileStats = {
  profile_status: NasipProfileStatus;
  verified: boolean;
  verification_status: NasipVerificationStatus;
  completed: boolean;
  is_plus: boolean;
  daily_request_limit: number;
  requests_used_today: number;
  requests_remaining: number;
  active_matches: number;
  unread_messages: number;
  visitors_7d: number;
  photos_pending: number;
};

export type NasipBlockedUser = {
  user_id: string;
  display_name: string | null;
  blocked_at: string;
};

export type NasipReportRow = {
  id: string;
  target_type: 'profile' | 'message' | 'conversation';
  reason: NasipReportReason;
  status: 'received' | 'in_review' | 'action_taken' | 'no_violation' | 'closed';
  reference_code: string;
  created_at: string;
  resolved_at: string | null;
};

export type NasipVisitor = {
  card: NasipPublicCard;
  visited_at: string;
};

export type NasipSearchFilters = {
  genders?: NasipGender[];
  minAge?: number | null;
  maxAge?: number | null;
  cityIds?: string[];
  countryCodes?: string[];
  educationLevels?: string[];
  maritalStatuses?: NasipMaritalStatus[];
  hasChildren?: boolean | null;
  smoking?: NasipSmoking[];
  marriageTimelines?: NasipMarriageTimeline[];
  verifiedOnly?: boolean;
};

export type NasipLocationRow = {
  id: string;
  country_code: string;
  country_name: string;
  city_name: string | null;
  district_name: string | null;
  level: 'country' | 'city' | 'district';
};

export type NasipProfilePatch = Partial<{
  display_name: string;
  gender: NasipGender;
  gender_detail: string | null;
  birth_date: string;
  country_code: string;
  country_name: string | null;
  city_id: string | null;
  city_name: string | null;
  district_name: string | null;
  height_cm: number | null;
  education_level: string | null;
  profession: string | null;
  employment_status: string | null;
  marital_status: NasipMaritalStatus | null;
  previously_married: boolean | null;
  has_children: boolean | null;
  children_count: number | null;
  smoking: NasipSmoking | null;
  open_to_relocation: boolean | null;
  bio: string | null;
  religious_practice: string | null;
  sensitive_consent: boolean;
  marriage_intent: boolean;
  terms_accepted: boolean;
  privacy_accepted: boolean;
  rules_accepted: boolean;
}>;

export type NasipPreferencesPatch = Partial<{
  interested_genders: NasipGender[];
  min_age: number;
  max_age: number;
  country_codes: string[];
  city_ids: string[];
  marriage_timeline: NasipMarriageTimeline | null;
  relocation_preference: NasipRelocationPreference | null;
  education_preferences: string[];
  lifestyle: Record<string, unknown>;
  discoverable: boolean;
  hide_from_search: boolean;
}>;

export type NasipPrivacyPatch = Partial<{
  photo_visibility: NasipPhotoVisibility;
  show_city: NasipShowCity;
  show_online_status: boolean;
  read_receipts: boolean;
  notification_preview: boolean;
  hidden_visits: boolean;
  allow_photo_requests: boolean;
}>;

export type NasipNotificationPatch = Partial<NasipNotificationPreferences>;

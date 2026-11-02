export type JobVisibility = 'employers' | 'applied_only' | 'hidden';
export type JobSearchStatus = 'actively_looking' | 'open' | 'not_looking';
export type WorkType = 'full_time' | 'part_time' | 'remote' | 'hybrid' | 'seasonal' | 'internship';
export type WorkMode = 'onsite' | 'remote' | 'hybrid';
export type ApplicationStatus = 'submitted' | 'reviewing' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn';
export type ApplicationStatusUpdate = 'reviewing' | 'interview' | 'offer' | 'hired' | 'rejected';
export type InterviewMethod = 'in_person' | 'phone' | 'video';
export type InterviewStatus = 'proposed' | 'accepted' | 'declined' | 'rescheduled' | 'cancelled' | 'completed';
export type ListingStatus = 'draft' | 'published' | 'paused' | 'closed' | 'removed';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type SalaryPeriod = 'monthly' | 'hourly' | 'yearly';

export type JobLocationRow = {
  id: string;
  country_code: string;
  country_name: string;
  city_name: string | null;
  district_name: string | null;
  level: 'country' | 'city' | 'district';
  latitude: number | null;
  longitude: number | null;
};

export type JobSubscription = {
  id: string;
  user_id: string;
  org_id: string | null;
  product: 'seeker_plus' | 'employer_pro';
  platform: 'ios' | 'android' | 'manual';
  product_id: string | null;
  transaction_id: string | null;
  original_transaction_id: string | null;
  environment: string | null;
  status: 'pending_verification' | 'active' | 'grace' | 'expired' | 'cancelled' | 'refunded';
  auto_renew: boolean;
  started_at: string | null;
  period_started_at?: string | null;
  expires_at: string | null;
  sandbox_extended?: boolean;
  receipt: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type JobOrganizationVerification = {
  id: string;
  org_id: string;
  tax_number: string | null;
  registry_number: string | null;
  authority_name: string | null;
  document_path: string | null;
  corporate_email_verified: boolean;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type JobSeekerProfile = {
  user_id: string;
  headline: string | null;
  bio: string | null;
  country_code: string | null;
  city_id: string | null;
  city_name: string | null;
  district_name: string | null;
  profession: string | null;
  sector: string | null;
  education_level: string | null;
  experience_years: number | null;
  job_search_status: JobSearchStatus;
  visibility: JobVisibility;
  salary_min: number | null;
  salary_currency: string | null;
  open_to_remote: boolean;
  open_to_relocation: boolean;
  open_to_abroad: boolean;
  available_from: string | null;
  created_at: string;
  updated_at: string;
};

export type JobSeekerContact = {
  user_id: string;
  phone: string | null;
  email: string | null;
  share_with_applied_employers: boolean;
};

export type JobSeekerPreferences = {
  user_id: string;
  preferred_country_codes: string[];
  preferred_city_ids: string[];
  employment_types: string[];
  work_modes: string[];
  salary_min: number | null;
  salary_currency: string | null;
  available_from: string | null;
  relocation: boolean;
  abroad: boolean;
};

export type JobExperience = {
  id: string;
  user_id: string;
  company: string;
  title: string | null;
  sector: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  sort_order: number;
};

export type JobEducation = {
  id: string;
  user_id: string;
  school: string;
  degree: string | null;
  field: string | null;
  start_year: number | null;
  end_year: number | null;
  description: string | null;
  sort_order: number;
};

export type JobSkill = { user_id: string; name: string; level: string | null };
export type JobCertificate = { id: string; user_id: string; name: string; issuer: string | null; year: number | null };
export type JobLanguage = { user_id: string; language_code: string; level: string | null };

export type JobCv = {
  id: string;
  user_id: string;
  title: string;
  kind: 'built' | 'pdf';
  file_path: string | null;
  file_name: string | null;
  content: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type JobOrganization = {
  id: string;
  owner_id: string;
  name: string;
  legal_name: string | null;
  org_type: string | null;
  sector: string | null;
  sub_sector: string | null;
  founded_year: number | null;
  company_size: string | null;
  employee_range: string | null;
  country_code: string | null;
  city_id: string | null;
  city_name: string | null;
  district_name: string | null;
  address: string | null;
  website: string | null;
  corporate_email: string | null;
  phone: string | null;
  about: string | null;
  logo_url: string | null;
  cover_url: string | null;
  cover_position: 'top' | 'center' | 'bottom';
  verification_status: VerificationStatus;
  verification_note: string | null;
  verified_at: string | null;
  status: 'active' | 'suspended';
  accepts_direct_messages: boolean;
  follower_count: number;
  created_at: string;
  updated_at: string;
};

export type JobOrganizationMember = {
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'recruiter';
  created_at: string;
};

export type JobListing = {
  id: string;
  org_id: string;
  created_by: string;
  title: string;
  sector: string | null;
  description: string | null;
  responsibilities: string | null;
  requirements: string | null;
  work_type: WorkType;
  work_mode: WorkMode;
  contract_type: string | null;
  country_code: string | null;
  city_id: string | null;
  city_name: string | null;
  district_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  remote_country_codes: string[];
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: SalaryPeriod;
  salary_gross: boolean;
  benefit_bonus: boolean;
  benefit_meals: boolean;
  benefit_transport: boolean;
  benefit_shuttle: boolean;
  benefit_accommodation: boolean;
  benefit_insurance: boolean;
  benefits: string[];
  visa_support: boolean;
  experience_level: string | null;
  experience_years_min: number | null;
  education_level: string | null;
  required_languages: string[];
  required_skills: string[];
  working_hours: string | null;
  working_days: string | null;
  shift_info: string | null;
  probation_months: number | null;
  start_date: string | null;
  positions_count: number;
  application_deadline: string | null;
  contact_email: string | null;
  status: ListingStatus;
  published_at: string | null;
  expires_at: string | null;
  view_count: number;
  application_count: number;
  created_at: string;
  updated_at: string;
};

export type JobListingQuestion = {
  id: string;
  listing_id: string;
  prompt: string;
  kind: 'text' | 'boolean' | 'select';
  options: string[];
  required: boolean;
  sort_order: number;
};

export type JobListingCard = {
  id: string;
  org_id: string;
  org_name: string;
  org_logo_url: string | null;
  org_verified: boolean;
  title: string;
  sector: string | null;
  work_type: WorkType;
  work_mode: WorkMode;
  country_code: string | null;
  city_id: string | null;
  city_name: string | null;
  district_name: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: SalaryPeriod;
  published_at: string | null;
  application_deadline: string | null;
  is_saved?: boolean;
  application_status?: ApplicationStatus | null;
  distance_km?: number | null;
  total_count?: number;
};

export type JobRecommendedListing = JobListingCard & { match_score: number; match_reasons: string[] };

export type JobApplication = {
  id: string;
  listing_id: string;
  org_id: string;
  seeker_id: string;
  cv_id: string | null;
  cover_letter: string | null;
  answers: Record<string, unknown>;
  status: ApplicationStatus;
  status_updated_at: string;
  created_at: string;
  listing?: Pick<JobListing, 'id' | 'title' | 'city_name' | 'country_code' | 'work_type'> & {
    org?: Pick<JobOrganization, 'id' | 'name' | 'logo_url' | 'verification_status'> | null;
  } | null;
  seeker?: {
    user_id?: string;
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    job_seeker_profiles?: JobSeekerProfile | JobSeekerProfile[] | null;
  } | null;
  cv?: JobCv | null;
};

export type JobApplicationStatusHistory = {
  id: string;
  application_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  note: string | null;
  actor_id: string | null;
  created_at: string;
};

export type JobInterview = {
  id: string;
  application_id: string;
  org_id: string;
  seeker_id: string;
  proposed_by: string;
  method: InterviewMethod;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  note: string | null;
  status: InterviewStatus;
  responded_at: string | null;
  created_at: string;
};

export type JobCandidateInvitation = {
  id: string;
  org_id: string;
  listing_id: string | null;
  seeker_id: string;
  sent_by: string;
  message: string | null;
  status: 'sent' | 'accepted' | 'declined' | 'withdrawn';
  responded_at: string | null;
  created_at: string;
};

export type JobReport = {
  id: string;
  reporter_id: string;
  target_type: 'listing' | 'organization' | 'seeker' | 'message';
  target_id: string;
  reason: string;
  details: string | null;
  status: 'received' | 'in_review' | 'action_taken' | 'no_violation' | 'closed';
  resolution_note: string | null;
  created_at: string;
};

export type JobProduct = {
  key: 'seeker_plus' | 'employer_pro';
  title: string;
  price: string;
  period: string;
  enabled: boolean;
  ios_product_id: string | null;
  android_product_id: string | null;
};

export type JobEntitlements = {
  seeker_plus: boolean;
  employer_pro: boolean;
  free_mode: boolean;
  limits: { active_listings: number; direct_invites: number; direct_messages: number };
  usage: { direct_invites: number; direct_messages: number };
  products: JobProduct[];
};

export type JobStoreStatus = {
  free_mode: boolean;
  checkout_ready: boolean;
  products: JobProduct[];
};

export type JobOrgAnalytics = {
  active_listings: number;
  total_listings: number;
  new_applications: number;
  interviews: number;
  pending_candidates: number;
  hired: number;
  followers: number;
  listing_views: number;
  employer_pro: boolean;
  active_limit: number;
};

export type JobSeekerAnalytics = {
  applications: number;
  active_applications: number;
  interviews: number;
  saved: number;
  profile_views_30d: number;
  plus: boolean;
  direct_message_quota: number;
  direct_messages_used: number;
};

export type JobRecommendedCandidate = {
  seeker_id: string;
  display_name: string;
  avatar_url: string | null;
  headline: string | null;
  profession: string | null;
  city_name: string | null;
  district_name: string | null;
  country_code: string | null;
  experience_years: number | null;
  education_level: string | null;
  salary_min: number | null;
  salary_currency: string | null;
  available_from: string | null;
  job_search_status: JobSearchStatus;
  match_score: number;
  match_reasons: string[];
  match_reason: string;
};

export type JobFilterOptions = {
  sectors: string[];
  countries: { code: string; name: string }[];
  languages: string[];
};

export type JobSearchParams = {
  query?: string;
  countryCodes?: string[];
  cityIds?: string[];
  district?: string;
  workTypes?: WorkType[];
  sectors?: string[];
  company?: string;
  salaryMin?: number;
  salaryCurrency?: string;
  experienceLevels?: string[];
  educationLevels?: string[];
  languages?: string[];
  visaSupport?: boolean;
  accommodation?: boolean;
  meals?: boolean;
  transport?: boolean;
  publishedDays?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
  offset?: number;
};

export type JobProfileBundle = {
  profile: JobSeekerProfile;
  contact: JobSeekerContact | null;
  preferences: JobSeekerPreferences | null;
  experiences: JobExperience[];
  education: JobEducation[];
  skills: JobSkill[];
  certificates: JobCertificate[];
  languages: JobLanguage[];
};

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { requireSupabase } from '@/lib/supabase';
import { mergeJobEntitlements } from '@/services/store/optimistic';
export type { JobProfileBundle } from './types';
import type {
  ApplicationStatus,
  InterviewMethod,
  JobApplication,
  JobApplicationStatusHistory,
  JobCandidateInvitation,
  JobCertificate,
  JobCv,
  JobEducation,
  JobEntitlements,
  JobExperience,
  JobFilterOptions,
  JobInterview,
  JobLanguage,
  JobListing,
  JobListingCard,
  JobListingQuestion,
  JobLocationRow,
  JobOrgAnalytics,
  JobOrganization,
  JobOrganizationMember,
  JobOrganizationVerification,
  JobProduct,
  JobProfileBundle,
  JobRecommendedCandidate,
  JobRecommendedListing,
  JobReport,
  JobSearchParams,
  JobSeekerAnalytics,
  JobSeekerContact,
  JobSeekerPreferences,
  JobSeekerProfile,
  JobSkill,
  JobStoreStatus,
  JobSubscription,
  JobVisibility,
  ListingStatus,
} from './types';

const db = () => requireSupabase();

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// ── Locations ───────────────────────────────────────────────────────────────

export async function fetchCountries(): Promise<JobLocationRow[]> {
  const { data, error } = await db()
    .from('job_locations')
    .select('id, country_code, country_name, city_name, district_name, level, latitude, longitude')
    .eq('level', 'country')
    .order('country_name', { ascending: true });
  fail(error);
  return (data ?? []) as JobLocationRow[];
}

export async function fetchCities(countryCode: string): Promise<JobLocationRow[]> {
  if (!countryCode) return [];
  const { data, error } = await db()
    .from('job_locations')
    .select('id, country_code, country_name, city_name, district_name, level, latitude, longitude')
    .eq('level', 'city')
    .eq('country_code', countryCode)
    .order('sort_order', { ascending: true });
  fail(error);
  return (data ?? []) as JobLocationRow[];
}

export async function fetchDistricts(cityId: string): Promise<JobLocationRow[]> {
  if (!cityId) return [];
  const { data, error } = await db()
    .from('job_locations')
    .select('id, country_code, country_name, city_name, district_name, level, latitude, longitude')
    .eq('level', 'district')
    .eq('id', cityId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return data as JobLocationRow[];
  // District ids are prefixed with their city id (`TR-istanbul:kadikoy`).
  const fallback = await db()
    .from('job_locations')
    .select('id, country_code, country_name, city_name, district_name, level, latitude, longitude')
    .eq('level', 'district')
    .like('id', `${cityId}:%`)
    .order('sort_order', { ascending: true });
  fail(fallback.error);
  return (fallback.data ?? []) as JobLocationRow[];
}

export async function fetchAllCities(): Promise<JobLocationRow[]> {
  const { data, error } = await db()
    .from('job_locations')
    .select('id, country_code, country_name, city_name, district_name, level, latitude, longitude')
    .eq('level', 'city')
    .order('country_code', { ascending: true })
    .order('sort_order', { ascending: true });
  fail(error);
  return (data ?? []) as JobLocationRow[];
}

// ── Seeker profile ──────────────────────────────────────────────────────────

export async function fetchSeekerBundle(userId: string): Promise<JobProfileBundle | null> {
  const client = db();
  const profile = await client.from('job_seeker_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (profile.error) throw new Error(profile.error.message);
  if (!profile.data) return null;
  const [contact, preferences, experiences, education, skills, certificates, languages] = await Promise.all([
    client.from('job_seeker_contacts').select('*').eq('user_id', userId).maybeSingle(),
    client.from('job_seeker_preferences').select('*').eq('user_id', userId).maybeSingle(),
    client.from('job_experiences').select('*').eq('user_id', userId).order('sort_order').order('start_date', { ascending: false }),
    client.from('job_education_records').select('*').eq('user_id', userId).order('sort_order').order('end_year', { ascending: false }),
    client.from('job_skills').select('*').eq('user_id', userId).order('name'),
    client.from('job_certificates').select('*').eq('user_id', userId).order('year', { ascending: false }),
    client.from('job_languages').select('*').eq('user_id', userId).order('language_code'),
  ]);
  for (const result of [contact, preferences, experiences, education, skills, certificates, languages]) {
    if (result.error) throw new Error(result.error.message);
  }
  return {
    profile: profile.data as JobSeekerProfile,
    contact: (contact.data as JobSeekerContact | null) ?? null,
    preferences: (preferences.data as JobSeekerPreferences | null) ?? null,
    experiences: (experiences.data ?? []) as JobExperience[],
    education: (education.data ?? []) as JobEducation[],
    skills: (skills.data ?? []) as JobSkill[],
    certificates: (certificates.data ?? []) as JobCertificate[],
    languages: (languages.data ?? []) as JobLanguage[],
  };
}

export type SeekerProfileInput = Partial<Omit<JobSeekerProfile, 'user_id' | 'created_at' | 'updated_at'>>;

export async function saveSeekerProfile(userId: string, patch: SeekerProfileInput) {
  const { error } = await db()
    .from('job_seeker_profiles')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
  fail(error);
}

export async function saveSeekerContact(userId: string, contact: Partial<Omit<JobSeekerContact, 'user_id'>>) {
  const { error } = await db()
    .from('job_seeker_contacts')
    .upsert({ user_id: userId, ...contact }, { onConflict: 'user_id' });
  fail(error);
}

export async function saveSeekerPreferences(userId: string, prefs: Partial<Omit<JobSeekerPreferences, 'user_id'>>) {
  const { error } = await db()
    .from('job_seeker_preferences')
    .upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' });
  fail(error);
}

export async function setSeekerVisibility(userId: string, visibility: JobVisibility) {
  const { error } = await db().from('job_seeker_profiles').update({ visibility }).eq('user_id', userId);
  fail(error);
}

export async function deleteJobProfile(userId: string) {
  const client = db();
  const jobs = [
    client.from('job_cvs').delete().eq('user_id', userId),
    client.from('job_experiences').delete().eq('user_id', userId),
    client.from('job_education_records').delete().eq('user_id', userId),
    client.from('job_skills').delete().eq('user_id', userId),
    client.from('job_certificates').delete().eq('user_id', userId),
    client.from('job_languages').delete().eq('user_id', userId),
    client.from('job_seeker_preferences').delete().eq('user_id', userId),
    client.from('job_seeker_contacts').delete().eq('user_id', userId),
    client.from('job_seeker_profiles').delete().eq('user_id', userId),
  ];
  for (const result of await Promise.all(jobs)) fail(result.error);
}

async function syncExperiences(userId: string, rows: JobExperience[]) {
  const client = db();
  const keep: string[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) continue;
    const payload = {
      user_id: userId,
      company: row.company,
      title: row.title,
      sector: row.sector,
      start_date: row.start_date,
      end_date: row.is_current ? null : row.end_date,
      is_current: row.is_current,
      description: row.description,
      sort_order: index,
    };
    if (row.id && !row.id.startsWith('new-')) {
      const { error } = await client.from('job_experiences').update(payload).eq('id', row.id);
      fail(error);
      keep.push(row.id);
    } else {
      const { data, error } = await client.from('job_experiences').insert(payload).select('id').single();
      fail(error);
      if (data?.id) keep.push(data.id as string);
    }
  }
  const existing = await client.from('job_experiences').select('id').eq('user_id', userId);
  fail(existing.error);
  const stale = (existing.data ?? []).map((row) => row.id as string).filter((id) => !keep.includes(id));
  if (stale.length > 0) {
    const { error } = await client.from('job_experiences').delete().in('id', stale).eq('user_id', userId);
    fail(error);
  }
}

async function syncEducation(userId: string, rows: JobEducation[]) {
  const client = db();
  const keep: string[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) continue;
    const payload = {
      user_id: userId,
      school: row.school,
      degree: row.degree,
      field: row.field,
      start_year: row.start_year,
      end_year: row.end_year,
      description: row.description,
      sort_order: index,
    };
    if (row.id && !row.id.startsWith('new-')) {
      const { error } = await client.from('job_education_records').update(payload).eq('id', row.id);
      fail(error);
      keep.push(row.id);
    } else {
      const { data, error } = await client.from('job_education_records').insert(payload).select('id').single();
      fail(error);
      if (data?.id) keep.push(data.id as string);
    }
  }
  const existing = await client.from('job_education_records').select('id').eq('user_id', userId);
  fail(existing.error);
  const stale = (existing.data ?? []).map((row) => row.id as string).filter((id) => !keep.includes(id));
  if (stale.length > 0) {
    const { error } = await client.from('job_education_records').delete().in('id', stale).eq('user_id', userId);
    fail(error);
  }
}

export async function saveSeekerSections(
  userId: string,
  sections: Partial<{
    experiences: JobExperience[];
    education: JobEducation[];
    skills: JobSkill[];
    certificates: JobCertificate[];
    languages: JobLanguage[];
  }>,
) {
  const client = db();
  if (sections.experiences) await syncExperiences(userId, sections.experiences);
  if (sections.education) await syncEducation(userId, sections.education);
  if (sections.skills) {
    const { error: removeError } = await client.from('job_skills').delete().eq('user_id', userId);
    fail(removeError);
    if (sections.skills.length > 0) {
      const { error } = await client
        .from('job_skills')
        .insert(sections.skills.map((skill) => ({ user_id: userId, name: skill.name, level: skill.level })));
      fail(error);
    }
  }
  if (sections.certificates) {
    const { error: removeError } = await client.from('job_certificates').delete().eq('user_id', userId);
    fail(removeError);
    if (sections.certificates.length > 0) {
      const { error } = await client.from('job_certificates').insert(
        sections.certificates.map((row) => ({
          user_id: userId,
          name: row.name,
          issuer: row.issuer,
          year: row.year,
        })),
      );
      fail(error);
    }
  }
  if (sections.languages) {
    const { error: removeError } = await client.from('job_languages').delete().eq('user_id', userId);
    fail(removeError);
    if (sections.languages.length > 0) {
      const { error } = await client.from('job_languages').insert(
        sections.languages.map((row) => ({
          user_id: userId,
          language_code: row.language_code,
          level: row.level,
        })),
      );
      fail(error);
    }
  }
}

// ── CVs ─────────────────────────────────────────────────────────────────────

export async function listCvs(userId: string): Promise<JobCv[]> {
  const { data, error } = await db()
    .from('job_cvs')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  fail(error);
  return (data ?? []) as JobCv[];
}

export type CvContent = {
  full_name: string;
  headline: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  summary?: string | null;
  experiences: { company: string; title: string | null; start_date: string | null; end_date: string | null; is_current: boolean; description: string | null }[];
  education: { school: string; degree: string | null; field: string | null; start_year: number | null; end_year: number | null }[];
  skills: string[];
  certificates: { name: string; issuer: string | null; year: number | null }[];
  languages: { language_code: string; level: string | null }[];
};

export function buildCvContent(bundle: JobProfileBundle, fullName: string, includeContact: boolean): CvContent {
  return {
    full_name: fullName,
    headline: bundle.profile.headline || bundle.profile.profession || '',
    email: includeContact && bundle.contact?.share_with_applied_employers ? bundle.contact.email : null,
    phone: includeContact && bundle.contact?.share_with_applied_employers ? bundle.contact.phone : null,
    city: [bundle.profile.district_name, bundle.profile.city_name, bundle.profile.country_code].filter(Boolean).join(', '),
    summary: bundle.profile.bio,
    experiences: bundle.experiences.map((row) => ({
      company: row.company,
      title: row.title,
      start_date: row.start_date,
      end_date: row.end_date,
      is_current: row.is_current,
      description: row.description,
    })),
    education: bundle.education.map((row) => ({
      school: row.school,
      degree: row.degree,
      field: row.field,
      start_year: row.start_year,
      end_year: row.end_year,
    })),
    skills: bundle.skills.map((row) => row.name),
    certificates: bundle.certificates.map((row) => ({ name: row.name, issuer: row.issuer, year: row.year })),
    languages: bundle.languages.map((row) => ({ language_code: row.language_code, level: row.level })),
  };
}

export async function createBuiltCv(userId: string, title: string, content: CvContent, isDefault: boolean) {
  const client = db();
  if (isDefault) {
    const { error } = await client.from('job_cvs').update({ is_default: false }).eq('user_id', userId);
    fail(error);
  }
  const { data, error } = await client
    .from('job_cvs')
    .insert({ user_id: userId, title, kind: 'built', content, is_default: isDefault })
    .select('*')
    .single();
  fail(error);
  return data as JobCv;
}

export async function updateBuiltCv(cvId: string, userId: string, title: string, content: CvContent) {
  const { data, error } = await db()
    .from('job_cvs')
    .update({ title, content })
    .eq('id', cvId)
    .eq('user_id', userId)
    .select('*')
    .single();
  fail(error);
  return data as JobCv;
}

export async function deleteCv(cvId: string, userId: string) {
  const client = db();
  const { data } = await client.from('job_cvs').select('file_path').eq('id', cvId).eq('user_id', userId).maybeSingle();
  const { error } = await client.from('job_cvs').delete().eq('id', cvId).eq('user_id', userId);
  fail(error);
  if (data?.file_path) {
    await client.storage.from('job-cvs').remove([data.file_path as string]);
  }
}

export async function makeDefaultCv(cvId: string, userId: string) {
  const client = db();
  const { error: clearError } = await client.from('job_cvs').update({ is_default: false }).eq('user_id', userId);
  fail(clearError);
  const { error } = await client.from('job_cvs').update({ is_default: true }).eq('id', cvId).eq('user_id', userId);
  fail(error);
}

export async function signedCvUrl(path: string | null, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await db().storage.from('job-cvs').createSignedUrl(path, seconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadCvPdf(userId: string, cvId: string, localUri: string, fileName: string) {
  const path = `${userId}/${cvId}.pdf`;
  await uploadLocalFile('job-cvs', path, localUri, 'application/pdf', false);
  const { error } = await db()
    .from('job_cvs')
    .update({ file_path: path, file_name: fileName, kind: 'pdf' })
    .eq('id', cvId)
    .eq('user_id', userId);
  fail(error);
  return path;
}

export async function createPdfCvRecord(userId: string, title: string, fileName: string) {
  const { data, error } = await db()
    .from('job_cvs')
    .insert({ user_id: userId, title, kind: 'pdf', file_name: fileName, content: {} })
    .select('*')
    .single();
  fail(error);
  return data as JobCv;
}

// ── Storage uploads ─────────────────────────────────────────────────────────

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadLocalFile(
  bucket: 'job-assets' | 'job-cvs' | 'job-verification',
  path: string,
  localUri: string,
  contentType: string,
  upsert = true,
) {
  const client = db();
  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    const blob = await response.blob();
    if (blob.size > MAX_BYTES) throw new Error('file_too_large');
    const { error } = await client.storage.from(bucket).upload(path, blob, { contentType, upsert });
    fail(error);
    return;
  }
  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists && typeof info.size === 'number' && info.size > MAX_BYTES) throw new Error('file_too_large');
  const client2 = requireSupabase();
  const session = (await client2.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error('not_authenticated');
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!base) throw new Error('supabase_url_missing');
  const endpoint = `${base}/storage/v1/object/${bucket}/${path}`;
  const result = await FileSystem.uploadAsync(endpoint, localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anon,
      'Content-Type': contentType,
      'x-upsert': upsert ? 'true' : 'false',
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(typeof result.body === 'string' && result.body.trim() ? result.body.trim() : `upload_failed_${result.status}`);
  }
}

export async function uploadOrgImage(
  userId: string,
  kind: 'logo' | 'cover',
  localUri: string,
  contentType = 'image/jpeg',
) {
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  await uploadLocalFile('job-assets', path, localUri, contentType);
  return db().storage.from('job-assets').getPublicUrl(path).data.publicUrl;
}

export async function uploadVerificationDocument(userId: string, orgId: string, localUri: string, contentType: string) {
  const ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('png') ? 'png' : 'jpg';
  const path = `${userId}/${orgId}/verification-${Date.now()}.${ext}`;
  await uploadLocalFile('job-verification', path, localUri, contentType);
  return path;
}

// ── Organizations ───────────────────────────────────────────────────────────

export async function fetchMyOrganizations(userId: string): Promise<JobOrganization[]> {
  const { data, error } = await db()
    .from('job_organization_members')
    .select('org_id, role, org:job_organizations(*)')
    .eq('user_id', userId);
  fail(error);
  return (data ?? [])
    .map((row) => (row as unknown as { org: JobOrganization | null }).org)
    .filter((org): org is JobOrganization => Boolean(org));
}

export async function fetchOrganization(orgId: string): Promise<JobOrganization | null> {
  const { data, error } = await db().from('job_organizations').select('*').eq('id', orgId).maybeSingle();
  fail(error);
  return (data as JobOrganization | null) ?? null;
}

export type OrganizationInput = Partial<
  Omit<JobOrganization, 'id' | 'owner_id' | 'verification_status' | 'verification_note' | 'verified_at' | 'status' | 'follower_count' | 'created_at' | 'updated_at'>
>;

export async function createOrganization(ownerId: string, input: OrganizationInput & { name: string }) {
  const { data, error } = await db()
    .from('job_organizations')
    .insert({
      owner_id: ownerId,
      name: input.name,
      legal_name: input.legal_name ?? null,
      org_type: input.org_type ?? null,
      sector: input.sector ?? null,
      sub_sector: input.sub_sector ?? null,
      founded_year: input.founded_year ?? null,
      company_size: input.company_size ?? null,
      employee_range: input.employee_range ?? null,
      country_code: input.country_code ?? null,
      city_id: input.city_id ?? null,
      city_name: input.city_name ?? null,
      district_name: input.district_name ?? null,
      address: input.address ?? null,
      website: input.website ?? null,
      corporate_email: input.corporate_email ?? null,
      phone: input.phone ?? null,
      about: input.about ?? null,
      logo_url: input.logo_url ?? null,
      cover_url: input.cover_url ?? null,
      cover_position: input.cover_position ?? 'center',
      accepts_direct_messages: input.accepts_direct_messages ?? true,
    })
    .select('*')
    .single();
  fail(error);
  return data as JobOrganization;
}

export async function updateOrganization(orgId: string, input: OrganizationInput) {
  const { data, error } = await db()
    .from('job_organizations')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', orgId)
    .select('*')
    .single();
  fail(error);
  return data as JobOrganization;
}

export async function fetchOrgMembers(orgId: string): Promise<(JobOrganizationMember & { profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null })[]> {
  const client = db();
  const { data, error } = await client
    .from('job_organization_members')
    .select('org_id, user_id, role, created_at')
    .eq('org_id', orgId)
    .order('created_at');
  fail(error);
  const rows = (data ?? []) as JobOrganizationMember[];
  if (rows.length === 0) return rows;
  const profiles = await client
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', rows.map((row) => row.user_id));
  const byId = new Map((profiles.data ?? []).map((row) => [row.id as string, row]));
  return rows.map((row) => ({
    ...row,
    profile: (byId.get(row.user_id) as { display_name: string | null; username: string | null; avatar_url: string | null } | undefined) ?? null,
  }));
}

export async function findProfileByHandle(handle: string) {
  const needle = handle.trim().replace(/^@/, '').toLowerCase();
  if (!needle) return null;
  const { data, error } = await db()
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .or(`username.ilike.${needle},id.eq.${needle}`)
    .limit(1)
    .maybeSingle();
  fail(error);
  return data as { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

export async function addOrgMember(orgId: string, userId: string, role: 'admin' | 'recruiter') {
  const { error } = await db().from('job_organization_members').insert({ org_id: orgId, user_id: userId, role });
  fail(error);
}

export async function removeOrgMember(orgId: string, userId: string) {
  const { error } = await db().from('job_organization_members').delete().eq('org_id', orgId).eq('user_id', userId);
  fail(error);
}

export async function fetchVerifications(orgId: string): Promise<JobOrganizationVerification[]> {
  const { data, error } = await db()
    .from('job_organization_verifications')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  fail(error);
  return (data ?? []) as JobOrganizationVerification[];
}

export async function submitVerification(input: {
  orgId: string;
  taxNumber?: string | null;
  registryNumber?: string | null;
  authorityName?: string | null;
  documentPath?: string | null;
  corporateEmailVerified?: boolean;
  note?: string | null;
}) {
  const { data, error } = await db().rpc('job_submit_verification', {
    p_org: input.orgId,
    p_tax_number: input.taxNumber ?? null,
    p_registry_number: input.registryNumber ?? null,
    p_authority_name: input.authorityName ?? null,
    p_document_path: input.documentPath ?? null,
    p_corporate_email_verified: input.corporateEmailVerified ?? false,
    p_note: input.note ?? null,
  });
  fail(error);
  return data as string;
}

export async function signedVerificationUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await db().storage.from('job-verification').createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// ── Listings / search ───────────────────────────────────────────────────────

function mapCard(row: Record<string, unknown>): JobListingCard {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    org_name: (row.org_name as string) ?? '',
    org_logo_url: (row.org_logo_url as string | null) ?? null,
    org_verified: Boolean(row.org_verified),
    title: row.title as string,
    sector: (row.sector as string | null) ?? null,
    work_type: row.work_type as JobListingCard['work_type'],
    work_mode: row.work_mode as JobListingCard['work_mode'],
    country_code: (row.country_code as string | null) ?? null,
    city_id: (row.city_id as string | null) ?? null,
    city_name: (row.city_name as string | null) ?? null,
    district_name: (row.district_name as string | null) ?? null,
    salary_min: toNumber(row.salary_min),
    salary_max: toNumber(row.salary_max),
    salary_currency: (row.salary_currency as string | null) ?? null,
    salary_period: (row.salary_period as JobListingCard['salary_period']) ?? 'monthly',
    published_at: (row.published_at as string | null) ?? null,
    application_deadline: (row.application_deadline as string | null) ?? null,
    is_saved: Boolean(row.is_saved),
    application_status: (row.application_status as ApplicationStatus | null) ?? null,
    distance_km: toNumber(row.distance_km),
    total_count: toNumber(row.total_count) ?? undefined,
  };
}

export async function searchListings(params: JobSearchParams): Promise<JobListingCard[]> {
  const { data, error } = await db().rpc('job_search_listings', {
    p_query: params.query ?? null,
    p_country_codes: params.countryCodes ?? null,
    p_city_ids: params.cityIds ?? null,
    p_district: params.district ?? null,
    p_work_types: params.workTypes ?? null,
    p_sectors: params.sectors ?? null,
    p_company: params.company ?? null,
    p_salary_min: params.salaryMin ?? null,
    p_salary_currency: params.salaryCurrency ?? null,
    p_experience_levels: params.experienceLevels ?? null,
    p_education_levels: params.educationLevels ?? null,
    p_languages: params.languages ?? null,
    p_visa_support: params.visaSupport ?? null,
    p_accommodation: params.accommodation ?? null,
    p_meals: params.meals ?? null,
    p_transport: params.transport ?? null,
    p_published_days: params.publishedDays ?? null,
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_radius_km: params.radiusKm ?? null,
    p_limit: params.limit ?? 20,
    p_offset: params.offset ?? 0,
  });
  fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map(mapCard);
}

export async function fetchRecommendedListings(limit = 20): Promise<JobRecommendedListing[]> {
  const { data, error } = await db().rpc('job_recommended_listings', { p_limit: limit });
  fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...mapCard({ ...row, id: row.listing_id }),
    match_score: toNumber(row.match_score) ?? 0,
    match_reasons: (row.match_reasons as string[] | null) ?? [],
  }));
}

export type JobListingDetail = JobListing & {
  org: JobOrganization;
  questions: JobListingQuestion[];
  is_saved: boolean;
  application: { id: string; status: ApplicationStatus } | null;
};

export async function fetchListingDetail(listingId: string): Promise<JobListingDetail> {
  const client = db();
  const { data, error } = await client
    .from('job_listings')
    .select('*, org:job_organizations(*)')
    .eq('id', listingId)
    .maybeSingle();
  fail(error);
  if (!data) throw new Error('listing_not_found');
  const row = data as unknown as JobListing & { org: JobOrganization };
  // RLS also shows every application of a listing to that company's members, so
  // the "have I applied?" lookup must be scoped to the signed-in seeker: without
  // the seeker filter maybeSingle() throws for employers and breaks the screen.
  const me = (await client.auth.getUser()).data.user?.id;
  const [questions, saved, application] = await Promise.all([
    client.from('job_listing_questions').select('*').eq('listing_id', listingId).order('sort_order'),
    client.from('job_saved_listings').select('listing_id').eq('listing_id', listingId).maybeSingle(),
    me
      ? client
          .from('job_applications')
          .select('id, status')
          .eq('listing_id', listingId)
          .eq('seeker_id', me)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  return {
    ...row,
    salary_min: toNumber(row.salary_min),
    salary_max: toNumber(row.salary_max),
    questions: (questions.data ?? []) as JobListingQuestion[],
    is_saved: Boolean(saved.data),
    application: (application.data as { id: string; status: ApplicationStatus } | null) ?? null,
  };
}

export async function markListingView(listingId: string) {
  const { error } = await db().rpc('job_mark_view', { p_listing: listingId });
  if (error) return;
}

export async function toggleSavedListing(listingId: string) {
  const { data, error } = await db().rpc('job_toggle_saved', { p_listing: listingId });
  fail(error);
  return Boolean(data);
}

export async function fetchSavedListings(): Promise<JobListingCard[]> {
  const { data, error } = await db()
    .from('job_saved_listings')
    .select('created_at, listing:job_listings(id, org_id, title, sector, work_type, work_mode, country_code, city_id, city_name, district_name, salary_min, salary_max, salary_currency, salary_period, published_at, application_deadline, status, org:job_organizations(name, logo_url, verification_status))')
    .order('created_at', { ascending: false });
  fail(error);
  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const listing = row.listing as Record<string, unknown> | null;
      if (!listing) return null;
      const org = listing.org as Record<string, unknown> | null;
      return mapCard({
        ...listing,
        org_name: org?.name,
        org_logo_url: org?.logo_url,
        org_verified: org?.verification_status === 'verified',
      });
    })
    .filter((row): row is JobListingCard => Boolean(row));
}

// ── Applications (seeker) ──────────────────────────────────────────────────

export type SeekerApplicationRow = JobApplication & {
  listing: Pick<JobListing, 'id' | 'title' | 'city_name' | 'country_code' | 'work_type' | 'org_id'> & {
    org: Pick<JobOrganization, 'id' | 'name' | 'logo_url' | 'verification_status'> | null;
  };
  interviews: JobInterview[];
};

export async function fetchSeekerApplications(userId: string): Promise<SeekerApplicationRow[]> {
  const client = db();
  const { data, error } = await client
    .from('job_applications')
    .select('*, listing:job_listings(id, title, city_name, country_code, work_type, org_id, org:job_organizations(id, name, logo_url, verification_status))')
    .eq('seeker_id', userId)
    .order('created_at', { ascending: false });
  fail(error);
  const rows = (data ?? []) as unknown as SeekerApplicationRow[];
  if (rows.length === 0) return rows;
  const interviews = await client
    .from('job_interviews')
    .select('*')
    .in('application_id', rows.map((row) => row.id))
    .order('scheduled_at', { ascending: false });
  const byApplication = new Map<string, JobInterview[]>();
  for (const interview of (interviews.data ?? []) as JobInterview[]) {
    const list = byApplication.get(interview.application_id) ?? [];
    list.push(interview);
    byApplication.set(interview.application_id, list);
  }
  return rows.map((row) => ({ ...row, interviews: byApplication.get(row.id) ?? [] }));
}

export async function fetchApplicationHistory(applicationId: string): Promise<JobApplicationStatusHistory[]> {
  const { data, error } = await db()
    .from('job_application_status_history')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });
  fail(error);
  return (data ?? []) as JobApplicationStatusHistory[];
}

export async function fetchSeekerInterviews(userId: string): Promise<JobInterview[]> {
  const { data, error } = await db()
    .from('job_interviews')
    .select('*')
    .eq('seeker_id', userId)
    .order('scheduled_at', { ascending: false });
  fail(error);
  return (data ?? []) as JobInterview[];
}

export async function respondToInterview(interviewId: string, accept: boolean, note?: string) {
  const { error } = await db().rpc('job_respond_interview', {
    p_interview: interviewId,
    p_accept: accept,
    p_note: note ?? null,
  });
  fail(error);
}

export async function applyToListing(input: {
  listingId: string;
  cvId?: string | null;
  coverLetter?: string | null;
  answers?: Record<string, unknown>;
}) {
  const { data, error } = await db().rpc('job_apply', {
    p_listing_id: input.listingId,
    p_cv_id: input.cvId ?? null,
    p_cover_letter: input.coverLetter ?? null,
    p_answers: input.answers ?? {},
  });
  fail(error);
  return data as string;
}

export async function withdrawApplication(applicationId: string) {
  const { error } = await db().rpc('job_withdraw_application', { p_application: applicationId });
  fail(error);
}

export async function fetchSeekerAnalytics(): Promise<JobSeekerAnalytics> {
  const { data, error } = await db().rpc('job_seeker_analytics');
  fail(error);
  return data as JobSeekerAnalytics;
}

// ── Employer: listings, applications, interviews ────────────────────────────

export async function fetchOrgListings(orgId: string): Promise<JobListing[]> {
  const { data, error } = await db()
    .from('job_listings')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });
  fail(error);
  return (data ?? []) as JobListing[];
}

export type ListingInput = {
  title: string;
  sector: string | null;
  description: string | null;
  responsibilities: string | null;
  requirements: string | null;
  work_type: JobListing['work_type'];
  work_mode: JobListing['work_mode'];
  contract_type: string | null;
  country_code: string | null;
  city_id: string | null;
  city_name: string | null;
  district_name: string | null;
  address: string | null;
  remote_country_codes: string[];
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: JobListing['salary_period'];
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
};

export async function createListing(orgId: string, userId: string, input: ListingInput, questions: { prompt: string; kind: 'text' | 'boolean' | 'select'; options: string[]; required: boolean }[]) {
  const { data, error } = await db()
    .from('job_listings')
    .insert({ org_id: orgId, created_by: userId, ...input })
    .select('*')
    .single();
  fail(error);
  const listing = data as JobListing;
  if (questions.length > 0) {
    const { error: questionError } = await db().from('job_listing_questions').insert(
      questions.map((question, index) => ({
        listing_id: listing.id,
        prompt: question.prompt,
        kind: question.kind,
        options: question.options,
        required: question.required,
        sort_order: index,
      })),
    );
    fail(questionError);
  }
  return listing;
}

export async function updateListing(listingId: string, input: Partial<ListingInput>) {
  const { data, error } = await db().from('job_listings').update(input).eq('id', listingId).select('*').single();
  fail(error);
  return data as JobListing;
}

export async function replaceListingQuestions(listingId: string, questions: { prompt: string; kind: 'text' | 'boolean' | 'select'; options: string[]; required: boolean }[]) {
  const client = db();
  const { error: removeError } = await client.from('job_listing_questions').delete().eq('listing_id', listingId);
  fail(removeError);
  if (questions.length === 0) return;
  const { error } = await client.from('job_listing_questions').insert(
    questions.map((question, index) => ({
      listing_id: listingId,
      prompt: question.prompt,
      kind: question.kind,
      options: question.options,
      required: question.required,
      sort_order: index,
    })),
  );
  fail(error);
}

export async function setListingStatus(listingId: string, status: ListingStatus) {
  const { error } = await db().from('job_listings').update({ status }).eq('id', listingId);
  fail(error);
}

/** Extends an expired or paused listing for another 30-day window. */
export async function renewListing(listingId: string, days = 30) {
  const now = new Date();
  const expires = new Date(now.getTime() + Math.max(1, days) * 86_400_000);
  const { error } = await db()
    .from('job_listings')
    .update({ status: 'published', expires_at: expires.toISOString() })
    .eq('id', listingId);
  fail(error);
}

export async function fetchListingQuestions(listingId: string): Promise<JobListingQuestion[]> {
  const { data, error } = await db()
    .from('job_listing_questions')
    .select('*')
    .eq('listing_id', listingId)
    .order('sort_order');
  fail(error);
  return (data ?? []) as JobListingQuestion[];
}

export type EmployerApplicationRow = JobApplication & {
  seeker_profile: JobSeekerProfile | null;
  applicant: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null;
  cv: JobCv | null;
  interviews: JobInterview[];
  listing_title: string | null;
};

async function hydrateEmployerApplications(rows: JobApplication[]): Promise<EmployerApplicationRow[]> {
  if (rows.length === 0) return [];
  const client = db();
  const seekerIds = Array.from(new Set(rows.map((row) => row.seeker_id)));
  const listingIds = Array.from(new Set(rows.map((row) => row.listing_id)));
  const [profiles, seekerProfiles, cvs, interviews, listings] = await Promise.all([
    client.from('profiles').select('id, display_name, username, avatar_url').in('id', seekerIds),
    client.from('job_seeker_profiles').select('*').in('user_id', seekerIds),
    client
      .from('job_cvs')
      .select('*')
      .in('id', rows.map((row) => row.cv_id).filter((id): id is string => Boolean(id))),
    client.from('job_interviews').select('*').in('application_id', rows.map((row) => row.id)),
    client.from('job_listings').select('id, title').in('id', listingIds),
  ]);
  const listingById = new Map((listings.data ?? []).map((row) => [row.id as string, row as { id: string; title: string }]));
  const profileById = new Map((profiles.data ?? []).map((row) => [row.id as string, row]));
  const seekerById = new Map((seekerProfiles.data ?? []).map((row) => [row.user_id as string, row as JobSeekerProfile]));
  const cvById = new Map((cvs.data ?? []).map((row) => [row.id as string, row as JobCv]));
  const interviewMap = new Map<string, JobInterview[]>();
  for (const interview of (interviews.data ?? []) as JobInterview[]) {
    const list = interviewMap.get(interview.application_id) ?? [];
    list.push(interview);
    interviewMap.set(interview.application_id, list);
  }
  return rows.map((row) => ({
    ...row,
    applicant:
      (profileById.get(row.seeker_id) as EmployerApplicationRow['applicant']) ?? null,
    seeker_profile: seekerById.get(row.seeker_id) ?? null,
    cv: row.cv_id ? cvById.get(row.cv_id) ?? null : null,
    interviews: interviewMap.get(row.id) ?? [],
    listing_title: listingById.get(row.listing_id)?.title ?? null,
  }));
}

export async function fetchOrgApplications(orgId: string): Promise<EmployerApplicationRow[]> {
  const { data, error } = await db()
    .from('job_applications')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200);
  fail(error);
  return hydrateEmployerApplications((data ?? []) as JobApplication[]);
}

export async function fetchListingApplications(listingId: string): Promise<EmployerApplicationRow[]> {
  const { data, error } = await db()
    .from('job_applications')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    .limit(200);
  fail(error);
  return hydrateEmployerApplications((data ?? []) as JobApplication[]);
}

export async function fetchEmployerApplication(applicationId: string): Promise<EmployerApplicationRow | null> {
  const { data, error } = await db().from('job_applications').select('*').eq('id', applicationId).maybeSingle();
  fail(error);
  if (!data) return null;
  const rows = await hydrateEmployerApplications([data as JobApplication]);
  return rows[0] ?? null;
}

/** Contact details are returned only when the seeker allowed sharing with applied employers. */
export async function fetchApplicantContact(seekerId: string): Promise<JobSeekerContact | null> {
  const { data, error } = await db()
    .from('job_seeker_contacts')
    .select('*')
    .eq('user_id', seekerId)
    .maybeSingle();
  fail(error);
  return (data as JobSeekerContact | null) ?? null;
}

export async function updateApplicationStatus(applicationId: string, status: Exclude<ApplicationStatus, 'submitted' | 'withdrawn'>, note?: string) {
  const { error } = await db().rpc('job_update_application_status', {
    p_application: applicationId,
    p_status: status,
    p_note: note ?? null,
  });
  fail(error);
}

export async function scheduleInterview(input: {
  applicationId: string;
  scheduledAt: string;
  method: InterviewMethod;
  location?: string | null;
  note?: string | null;
  durationMinutes?: number;
}) {
  const { data, error } = await db().rpc('job_schedule_interview', {
    p_application: input.applicationId,
    p_scheduled_at: input.scheduledAt,
    p_method: input.method,
    p_location: input.location ?? null,
    p_note: input.note ?? null,
    p_duration_minutes: input.durationMinutes ?? 30,
  });
  fail(error);
  return data as string;
}

export async function fetchOrgInterviews(orgId: string): Promise<JobInterview[]> {
  const { data, error } = await db()
    .from('job_interviews')
    .select('*')
    .eq('org_id', orgId)
    .order('scheduled_at', { ascending: false });
  fail(error);
  return (data ?? []) as JobInterview[];
}

export async function fetchOrgAnalytics(orgId: string): Promise<JobOrgAnalytics> {
  const { data, error } = await db().rpc('job_org_analytics', { p_org: orgId });
  fail(error);
  return data as JobOrgAnalytics;
}

// ── Job messaging (reuses SAFDAŞ conversation infrastructure) ───────────────

export type JobThreadSummary = {
  conversation_id: string;
  application_id: string | null;
  org_id: string;
  listing_id: string | null;
  seeker_id: string;
  employer_id: string;
  created_at: string;
  org_name: string;
  org_logo_url: string | null;
  org_verified: boolean;
  listing_title: string | null;
  peer_name: string | null;
  peer_username: string | null;
  peer_avatar_url: string | null;
};

export async function openJobThread(applicationId: string): Promise<string> {
  const { data, error } = await db().rpc('job_thread_for_application', { p_application: applicationId });
  fail(error);
  if (!data) throw new Error('conversation_unavailable');
  return data as string;
}

export async function fetchJobThreads(): Promise<JobThreadSummary[]> {
  const client = db();
  const { data, error } = await client
    .from('job_message_threads')
    .select(
      'conversation_id, application_id, org_id, listing_id, seeker_id, employer_id, created_at, org:job_organizations(name, logo_url, verification_status), listing:job_listings(title)',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  fail(error);
  const rows = (data ?? []) as unknown as (Omit<JobThreadSummary, 'org_name' | 'org_logo_url' | 'org_verified' | 'listing_title' | 'peer_name' | 'peer_username' | 'peer_avatar_url'> & {
    org: { name: string | null; logo_url: string | null; verification_status: string | null } | null;
    listing: { title: string | null } | null;
  })[];
  if (rows.length === 0) return [];

  const myId = (await client.auth.getUser()).data.user?.id;
  const peerIds = Array.from(new Set(rows.map((row) => (row.seeker_id === myId ? row.employer_id : row.seeker_id))));
  const { data: profiles } = await client.from('profiles').select('id, display_name, username, avatar_url').in('id', peerIds);
  const profileById = new Map((profiles ?? []).map((row) => [row.id as string, row]));

  return rows.map((row) => {
    const peerId = row.seeker_id === myId ? row.employer_id : row.seeker_id;
    const peer = profileById.get(peerId) as
      | { id: string; display_name: string | null; username: string | null; avatar_url: string | null }
      | undefined;
    return {
      conversation_id: row.conversation_id,
      application_id: row.application_id,
      org_id: row.org_id,
      listing_id: row.listing_id,
      seeker_id: row.seeker_id,
      employer_id: row.employer_id,
      created_at: row.created_at,
      org_name: row.org?.name ?? '',
      org_logo_url: row.org?.logo_url ?? null,
      org_verified: row.org?.verification_status === 'verified',
      listing_title: row.listing?.title ?? null,
      peer_name: peer?.display_name ?? null,
      peer_username: peer?.username ?? null,
      peer_avatar_url: peer?.avatar_url ?? null,
    };
  });
}

// ── Candidate pool / matching / invitations ─────────────────────────────────

export type CandidateSearchParams = {
  query?: string;
  countryCodes?: string[];
  cityIds?: string[];
  sectors?: string[];
  experienceMin?: number;
  educationLevels?: string[];
  languages?: string[];
  salaryMax?: number;
  salaryCurrency?: string;
  remote?: boolean;
  relocation?: boolean;
  searchStatus?: string[];
  availableBefore?: string;
  limit?: number;
  offset?: number;
};

export type CandidateRow = JobRecommendedCandidate & { total_count?: number };

export async function searchCandidates(orgId: string, params: CandidateSearchParams): Promise<CandidateRow[]> {
  const { data, error } = await db().rpc('job_search_candidates', {
    p_org: orgId,
    p_query: params.query ?? null,
    p_country_codes: params.countryCodes ?? null,
    p_city_ids: params.cityIds ?? null,
    p_sectors: params.sectors ?? null,
    p_experience_min: params.experienceMin ?? null,
    p_education_levels: params.educationLevels ?? null,
    p_languages: params.languages ?? null,
    p_salary_max: params.salaryMax ?? null,
    p_salary_currency: params.salaryCurrency ?? null,
    p_remote: params.remote ?? null,
    p_relocation: params.relocation ?? null,
    p_search_status: params.searchStatus ?? null,
    p_available_before: params.availableBefore ?? null,
    p_limit: params.limit ?? 20,
    p_offset: params.offset ?? 0,
  });
  fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    seeker_id: row.seeker_id as string,
    display_name: row.display_name as string,
    avatar_url: (row.avatar_url as string | null) ?? null,
    headline: (row.headline as string | null) ?? null,
    profession: (row.profession as string | null) ?? null,
    city_name: (row.city_name as string | null) ?? null,
    district_name: (row.district_name as string | null) ?? null,
    country_code: (row.country_code as string | null) ?? null,
    experience_years: toNumber(row.experience_years),
    education_level: (row.education_level as string | null) ?? null,
    salary_min: toNumber(row.salary_min),
    salary_currency: (row.salary_currency as string | null) ?? null,
    available_from: (row.available_from as string | null) ?? null,
    job_search_status: row.job_search_status as JobRecommendedCandidate['job_search_status'],
    match_score: toNumber(row.match_score) ?? 0,
    match_reasons: (row.match_reasons as string[] | null) ?? [],
    match_reason: (row.match_reason as string) ?? '',
    total_count: toNumber(row.total_count) ?? undefined,
  }));
}

export async function fetchRecommendedCandidates(listingId: string, limit = 30): Promise<JobRecommendedCandidate[]> {
  const { data, error } = await db().rpc('job_recommended_candidates', { p_listing: listingId, p_limit: limit });
  fail(error);
  return (data ?? []) as JobRecommendedCandidate[];
}

export async function sendCandidateInvitation(orgId: string, listingId: string | null, seekerId: string, message?: string) {
  const { data, error } = await db().rpc('job_send_invitation', {
    p_org: orgId,
    p_listing_id: listingId,
    p_seeker: seekerId,
    p_message: message ?? null,
  });
  fail(error);
  return data as string;
}

export async function respondInvitation(invitationId: string, accept: boolean) {
  const { error } = await db().rpc('job_respond_invitation', { p_invitation: invitationId, p_accept: accept });
  fail(error);
}

export async function fetchSeekerInvitations(): Promise<(JobCandidateInvitation & { org: Pick<JobOrganization, 'id' | 'name' | 'logo_url' | 'verification_status'> | null; listing: Pick<JobListing, 'id' | 'title'> | null })[]> {
  const { data, error } = await db()
    .from('job_candidate_invitations')
    .select('*, org:job_organizations(id, name, logo_url, verification_status), listing:job_listings(id, title)')
    .order('created_at', { ascending: false });
  fail(error);
  return (data ?? []) as never;
}

export type OrgInvitationRow = JobCandidateInvitation & {
  seeker: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null;
  listing_title: string | null;
};

export async function fetchOrgInvitations(orgId: string): Promise<OrgInvitationRow[]> {
  const client = db();
  const { data, error } = await client
    .from('job_candidate_invitations')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  fail(error);
  const rows = (data ?? []) as JobCandidateInvitation[];
  if (rows.length === 0) return [];
  const [profiles, listings] = await Promise.all([
    client.from('profiles').select('id, display_name, username, avatar_url').in('id', Array.from(new Set(rows.map((row) => row.seeker_id)))),
    client.from('job_listings').select('id, title').in('id', rows.map((row) => row.listing_id).filter((id): id is string => Boolean(id))),
  ]);
  const profileById = new Map((profiles.data ?? []).map((row) => [row.id as string, row]));
  const listingById = new Map((listings.data ?? []).map((row) => [row.id as string, row]));
  return rows.map((row) => ({
    ...row,
    seeker:
      (profileById.get(row.seeker_id) as { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | undefined) ?? null,
    listing_title: row.listing_id ? ((listingById.get(row.listing_id)?.title as string | undefined) ?? null) : null,
  }));
}

// ── Follow / messaging / reports ────────────────────────────────────────────

export async function toggleFollowOrg(orgId: string, notify = true) {
  const { data, error } = await db().rpc('job_toggle_follow_org', { p_org: orgId, p_notify: notify });
  fail(error);
  return Boolean(data);
}

export async function fetchFollowingState(orgId: string) {
  const { data, error } = await db()
    .from('job_followed_orgs')
    .select('org_id, notify_new_jobs')
    .eq('org_id', orgId)
    .maybeSingle();
  fail(error);
  return (data as { org_id: string; notify_new_jobs: boolean } | null) ?? null;
}

export async function setFollowNotifications(orgId: string, notify: boolean) {
  const { error } = await db().from('job_followed_orgs').update({ notify_new_jobs: notify }).eq('org_id', orgId);
  fail(error);
}

export async function fetchFollowedOrgs(): Promise<JobOrganization[]> {
  const { data, error } = await db()
    .from('job_followed_orgs')
    .select('created_at, org:job_organizations(*)')
    .order('created_at', { ascending: false });
  fail(error);
  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => row.org as JobOrganization | null)
    .filter((org): org is JobOrganization => Boolean(org));
}

export async function openApplicationThread(applicationId: string) {
  const { data, error } = await db().rpc('job_thread_for_application', { p_application: applicationId });
  fail(error);
  return data as string;
}

export async function contactEmployer(orgId: string, listingId?: string | null) {
  const { data, error } = await db().rpc('job_contact_employer', {
    p_org: orgId,
    p_listing_id: listingId ?? null,
  });
  fail(error);
  return data as string;
}

export async function submitJobReport(input: {
  targetType: JobReport['target_type'];
  targetId: string;
  reason: string;
  details?: string | null;
}) {
  const { error } = await db().from('job_reports').insert({
    reporter_id: (await db().auth.getUser()).data.user?.id,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details ?? null,
  });
  fail(error);
}

export async function fetchMyJobReports(): Promise<JobReport[]> {
  const { data, error } = await db()
    .from('job_reports')
    .select('*')
    .order('created_at', { ascending: false });
  fail(error);
  return (data ?? []) as JobReport[];
}

// ── Subscriptions / entitlements ────────────────────────────────────────────

export async function fetchEntitlements(orgId?: string | null): Promise<JobEntitlements> {
  const { data, error } = await db().rpc('job_my_entitlements', { p_org: orgId ?? null });
  fail(error);
  return mergeJobEntitlements(data as JobEntitlements, orgId ?? null);
}

export async function fetchStoreStatus(): Promise<JobStoreStatus> {
  const { data, error } = await db().rpc('job_store_status');
  fail(error);
  return data as JobStoreStatus;
}

export async function fetchMySubscriptions(): Promise<JobSubscription[]> {
  const { data, error } = await db()
    .from('job_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  fail(error);
  return (data ?? []) as JobSubscription[];
}

export async function submitPurchaseReceipt(input: {
  platform: 'ios' | 'android';
  product: 'seeker_plus' | 'employer_pro';
  productId: string;
  transactionId: string;
  originalTransactionId?: string | null;
  receipt: Record<string, unknown>;
  orgId?: string | null;
}) {
  const { data, error } = await db().rpc('job_submit_purchase_receipt', {
    p_platform: input.platform,
    p_product: input.product,
    p_product_id: input.productId,
    p_transaction_id: input.transactionId,
    p_original_transaction_id: input.originalTransactionId ?? null,
    p_receipt: input.receipt,
    p_org: input.orgId ?? null,
  });
  fail(error);
  return data as string;
}

export type JobPurchaseVerification = {
  subscriptionId?: string;
  status: 'active' | 'grace' | 'expired' | 'cancelled' | 'refunded' | 'pending_verification';
  expiresAt?: string | null;
  autoRenew?: boolean;
  environment?: string | null;
  reason?: string | null;
};

/**
 * Asks the server to verify the stored store receipt. Access is granted only
 * from a verified Apple/Google response; when the function is not configured
 * yet the subscription stays in pending_verification for admin review.
 */
export async function verifyPurchase(
  subscriptionId: string,
  receipt?: string | null,
): Promise<JobPurchaseVerification> {
  const { data, error } = await requireSupabase().functions.invoke('job-store-verify', {
    body: receipt ? { subscriptionId, receipt } : { subscriptionId },
  });
  if (error) throw error;
  return data as JobPurchaseVerification;
}

export async function cancelSubscription(subscriptionId: string) {
  const { error } = await db().rpc('job_cancel_subscription', { p_subscription: subscriptionId });
  fail(error);
}

export async function restorePendingPurchases() {
  const { data, error } = await db().rpc('job_restore_pending_purchases');
  fail(error);
  return (data ?? []) as { id: string; product: string; platform: string; status: string; created_at: string }[];
}

// ── Filter options ──────────────────────────────────────────────────────────

export async function fetchFilterOptions(): Promise<JobFilterOptions> {
  const { data, error } = await db().rpc('job_filter_options');
  fail(error);
  return data as JobFilterOptions;
}

// ── Admin ───────────────────────────────────────────────────────────────────

export type AdminJobStats = {
  seekers: number;
  employers: number;
  organizations: number;
  active_listings: number;
  applications_today: number;
  active_subscriptions: number;
  pending_verifications: number;
  open_reports: number;
  pending_purchases: number;
};

export type AdminOrgRow = JobOrganization & {
  owner: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null;
  members: number;
};

export async function adminJobStats(): Promise<AdminJobStats> {
  const { data, error } = await db().rpc('job_admin_stats');
  fail(error);
  return data as AdminJobStats;
}

export async function adminListOrganizations(search?: string): Promise<AdminOrgRow[]> {
  const client = db();
  let query = client
    .from('job_organizations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (search?.trim()) query = query.ilike('name', `%${search.trim()}%`);
  const { data, error } = await query;
  fail(error);
  const rows = (data ?? []) as JobOrganization[];
  if (rows.length === 0) return [];
  const [owners, members] = await Promise.all([
    client
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', Array.from(new Set(rows.map((row) => row.owner_id)))),
    client
      .from('job_organization_members')
      .select('org_id')
      .in('org_id', rows.map((row) => row.id)),
  ]);
  const ownerById = new Map((owners.data ?? []).map((row) => [row.id as string, row]));
  const memberCount = new Map<string, number>();
  for (const row of members.data ?? []) {
    const id = row.org_id as string;
    memberCount.set(id, (memberCount.get(id) ?? 0) + 1);
  }
  return rows.map((row) => ({
    ...row,
    owner: (ownerById.get(row.owner_id) as AdminOrgRow['owner']) ?? null,
    members: memberCount.get(row.id) ?? 0,
  }));
}

export async function adminSetOrgStatus(orgId: string, status: 'active' | 'suspended', reason?: string) {
  const { error } = await db().rpc('job_admin_set_org_status', {
    p_org: orgId,
    p_status: status,
    p_reason: reason ?? null,
  });
  fail(error);
}

export async function adminSetOrgVerification(orgId: string, status: JobOrganization['verification_status'], note?: string) {
  const { error } = await db().rpc('job_admin_set_org_verification', {
    p_org: orgId,
    p_status: status,
    p_note: note ?? null,
  });
  fail(error);
}

export async function adminListSeekers(search?: string): Promise<(JobSeekerProfile & { profile: { display_name: string | null; username: string | null; avatar_url: string | null } | null })[]> {
  const client = db();
  let query = client.from('job_seeker_profiles').select('*').order('updated_at', { ascending: false }).limit(200);
  if (search?.trim()) query = query.ilike('profession', `%${search.trim()}%`);
  const { data, error } = await query;
  fail(error);
  const rows = (data ?? []) as JobSeekerProfile[];
  if (rows.length === 0) return [];
  const profiles = await client
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', rows.map((row) => row.user_id));
  const byId = new Map((profiles.data ?? []).map((row) => [row.id as string, row]));
  return rows.map((row) => ({
    ...row,
    profile: (byId.get(row.user_id) as { display_name: string | null; username: string | null; avatar_url: string | null } | undefined) ?? null,
  }));
}

export async function adminSetSeekerVisibility(userId: string, visibility: JobVisibility, note?: string) {
  const { error } = await db().rpc('job_admin_set_seeker_visibility', {
    p_user: userId,
    p_visibility: visibility,
    p_note: note ?? null,
  });
  fail(error);
}

export async function adminListListings(search?: string, status?: string): Promise<(JobListing & { org: { id: string; name: string; owner_id: string } | null })[]> {
  const client = db();
  let query = client
    .from('job_listings')
    .select('*, org:job_organizations(id, name, owner_id)')
    .order('created_at', { ascending: false })
    .limit(250);
  if (search?.trim()) query = query.ilike('title', `%${search.trim()}%`);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  fail(error);
  return (data ?? []) as never;
}

export async function adminSetListingStatus(listingId: string, status: ListingStatus, reason?: string) {
  const { error } = await db().rpc('job_admin_set_listing_status', {
    p_listing: listingId,
    p_status: status,
    p_reason: reason ?? null,
  });
  fail(error);
}

export async function adminListJobReports(status?: string): Promise<JobReport[]> {
  let query = db().from('job_reports').select('*').order('created_at', { ascending: false }).limit(200);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  fail(error);
  return (data ?? []) as JobReport[];
}

export async function adminSetJobReportStatus(reportId: string, status: JobReport['status'], note?: string) {
  const { error } = await db().rpc('job_admin_set_report_status', {
    p_report: reportId,
    p_status: status,
    p_note: note ?? null,
  });
  fail(error);
}

export async function adminSetProduct(input: {
  key: 'seeker_plus' | 'employer_pro';
  enabled: boolean;
  priceLabel?: string | null;
  iosProductId?: string | null;
  androidProductId?: string | null;
}) {
  const { error } = await db().rpc('job_admin_set_product', {
    p_key: input.key,
    p_enabled: input.enabled,
    p_price_label: input.priceLabel ?? null,
    p_ios_product_id: input.iosProductId ?? null,
    p_android_product_id: input.androidProductId ?? null,
  });
  fail(error);
}

export async function adminGrantSubscription(input: {
  userId: string;
  orgId?: string | null;
  product: 'seeker_plus' | 'employer_pro';
  months: number;
  note?: string | null;
}) {
  const { error } = await db().rpc('job_admin_grant_subscription', {
    p_user: input.userId,
    p_org: input.orgId ?? null,
    p_product: input.product,
    p_months: input.months,
    p_note: input.note ?? null,
  });
  fail(error);
}

export async function adminRevokeSubscription(subscriptionId: string) {
  const { error } = await db().rpc('job_admin_revoke_subscription', { p_subscription: subscriptionId });
  fail(error);
}

export async function adminActivatePurchase(subscriptionId: string, months = 1, note?: string | null) {
  const { error } = await db().rpc('job_admin_activate_purchase', {
    p_subscription: subscriptionId,
    p_months: months,
    p_note: note ?? null,
  });
  fail(error);
}

export async function adminListSubscriptions(): Promise<(JobSubscription & { profile: { display_name: string | null; username: string | null } | null; org: { id: string; name: string } | null })[]> {
  const client = db();
  const { data, error } = await client
    .from('job_subscriptions')
    .select('*, org:job_organizations(id, name)')
    .order('created_at', { ascending: false })
    .limit(200);
  fail(error);
  const rows = (data ?? []) as (JobSubscription & { org: { id: string; name: string } | null })[];
  if (rows.length === 0) return [];
  const profiles = await client
    .from('profiles')
    .select('id, display_name, username')
    .in('id', Array.from(new Set(rows.map((row) => row.user_id))));
  const byId = new Map((profiles.data ?? []).map((row) => [row.id as string, row]));
  return rows.map((row) => ({
    ...row,
    profile: (byId.get(row.user_id) as { display_name: string | null; username: string | null } | undefined) ?? null,
  }));
}

export async function adminListProducts(): Promise<JobProduct[]> {
  const { data, error } = await db().from('job_products').select('*').order('sort_order');
  fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    key: row.product_key as JobProduct['key'],
    title: row.title as string,
    price: row.price_label as string,
    period: row.period_label as string,
    enabled: Boolean(row.enabled),
    ios_product_id: (row.store_product_id_ios as string | null) ?? null,
    android_product_id: (row.store_product_id_android as string | null) ?? null,
  }));
}

export async function adminListLocations(level?: string): Promise<JobLocationRow[]> {
  let query = db().from('job_locations').select('*').order('sort_order').limit(1000);
  if (level) query = query.eq('level', level);
  const { data, error } = await query;
  fail(error);
  return (data ?? []) as JobLocationRow[];
}

export async function adminUpsertLocation(input: {
  id: string;
  countryCode: string;
  countryName: string;
  cityName?: string | null;
  districtName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive?: boolean;
}) {
  const { error } = await db().rpc('job_admin_upsert_location', {
    p_id: input.id,
    p_country_code: input.countryCode,
    p_country_name: input.countryName,
    p_city_name: input.cityName ?? null,
    p_district_name: input.districtName ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_is_active: input.isActive ?? true,
  });
  fail(error);
}

export async function adminDeleteLocation(locationId: string) {
  const { error } = await db().rpc('job_admin_delete_location', { p_id: locationId });
  fail(error);
}

export type AdminJobAuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export async function adminJobAudit(): Promise<AdminJobAuditRow[]> {
  const { data, error } = await db()
    .from('job_admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  fail(error);
  return (data ?? []) as AdminJobAuditRow[];
}

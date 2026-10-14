import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { LinkRow } from '@/components/ui/LinkRow';
import { useT } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function PrivacySettings() {
  const t = useT();
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);

  async function toggle(value: boolean) {
    if (!profile) return;
    const { error } = await requireSupabase().from('profiles').update({ is_private: value }).eq('id', profile.id);
    if (!error) setProfile({ ...profile, is_private: value });
  }

  return (
    <Screen scroll>
      <AppHeader title={t('privacy')} subtitle={t('privacySubtitle')} />
      <AppSwitch label={t('privateAccount')} value={Boolean(profile?.is_private)} onValueChange={(value) => void toggle(value)} />
      <LinkRow icon="ban-outline" label={t('blockedAccounts')} onPress={() => router.push('/settings/blocked')} />
      <LinkRow icon="document-text-outline" label={t('privacyPolicy')} onPress={() => router.push('/legal/privacy')} />
      <LinkRow icon="people-outline" label={t('communityRules')} onPress={() => router.push('/legal/community')} />
      <LinkRow icon="shield-outline" label={t('childSafety')} onPress={() => router.push('/legal/safety')} />
      <LinkRow icon="trash-outline" label={t('accountDeletion')} onPress={() => router.push('/legal/deletion')} />
    </Screen>
  );
}

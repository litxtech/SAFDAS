import { Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { LinkRow } from '@/components/ui/LinkRow';
import { setPendingSignupEmail } from '@/lib/pendingSignup';
import { requireSupabase } from '@/lib/supabase';
import { useT } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const t = useT();
  const show = useToastStore((state) => state.show);
  const session = useAuthStore((state) => state.session);

  async function signOut() {
    setPendingSignupEmail(null);
    await requireSupabase().auth.signOut();
    router.replace('/(auth)/welcome');
  }

  async function removeAccount() {
    const client = requireSupabase();
    const { error } = await client.functions.invoke('delete-account');
    if (error) show(t('accountDeleteUnavailable'), 'error');
    else {
      setPendingSignupEmail(null);
      await client.auth.signOut({ scope: 'local' });
      show(t('accountDeleteRequested'), 'success');
      router.replace('/(auth)/welcome');
    }
  }

  return (
    <Screen scroll>
      <AppHeader title={t('settings')} subtitle={session?.user.email ?? ''} />
      <LinkRow icon="color-palette-outline" label={t('theme')} hint={`${t('themeLight')} · ${t('themeDark')}`} onPress={() => router.push('/settings/theme')} />
      <LinkRow icon="time-outline" label={t('prayerMethod')} onPress={() => router.push('/settings/prayer')} />
      <LinkRow icon="language-outline" label={t('language')} hint={t('languageHint')} onPress={() => router.push('/settings/language')} />
      <LinkRow icon="cloud-download-outline" label={t('offlineDownloads')} hint={t('offlineDownloadsHint')} onPress={() => router.push('/settings/downloads')} />
      <LinkRow icon="notifications-outline" label={t('backgroundTitle')} hint={t('notifications')} onPress={() => router.push('/settings/notifications')} />
      <LinkRow icon="lock-closed-outline" label={t('privacy')} onPress={() => router.push('/settings/privacy')} />
      <LinkRow icon="shield-checkmark-outline" label={t('security')} onPress={() => router.push('/settings/security')} />
      <LinkRow icon="document-text-outline" label={t('policies')} onPress={() => router.push('/legal')} />
      <AppButton label={t('signOut')} variant="secondary" onPress={() => void signOut()} />
      <AppButton label={t('deleteAccount')} variant="ghost" onPress={() => void removeAccount()} />
      <Text style={{ color: colors.textSecondary }}>LITXTECH LLC · support@litxtech.com</Text>
    </Screen>
  );
}

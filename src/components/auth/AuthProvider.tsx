import { useEffect, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { createSessionFromUrl, isAuthCallbackUrl } from '@/lib/authDeepLink';
import { setPendingSignupEmail } from '@/lib/pendingSignup';
import { supabase } from '@/lib/supabase';
import { isProfileComplete, useAuthStore, type Profile } from '@/stores/authStore';

const STAFF = new Set(['super_admin', 'admin', 'moderator', 'content_manager', 'support']);

async function loadAccount(userId: string) {
  if (!supabase) return;
  const [{ data: profile, error: profileError }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_roles').select('roles(name)').eq('user_id', userId),
  ]);
  // Network / RLS hiccups must NOT log the user out — only ban / disable / suspension.
  if (profileError) return;
  const profileRow = (profile as Profile | null) ?? null;
  const suspended =
    profileRow?.suspended_until && new Date(profileRow.suspended_until).getTime() > Date.now();
  if (profileRow?.disabled_at || suspended) {
    await supabase.auth.signOut({ scope: 'local' });
    useAuthStore.getState().setProfile(null);
    useAuthStore.getState().setStaff(false);
    return;
  }
  useAuthStore.getState().setProfile(profileRow);
  const names = (roles ?? []).flatMap((row) => {
    const role = row.roles as { name?: string } | { name?: string }[] | null;
    if (Array.isArray(role)) return role.map((item) => item.name).filter(Boolean) as string[];
    return role?.name ? [role.name] : [];
  });
  useAuthStore.getState().setStaff(names.some((name) => STAFF.has(name)));
  const prefs = useAuthStore.getState().profile;
  if (prefs?.language === 'en' || prefs?.language === 'ar' || prefs?.language === 'tr' || prefs?.language === 'es') {
    const { useI18nStore } = await import('@/i18n');
    useI18nStore.getState().setLocale(prefs.language);
  }
  if (isProfileComplete(profile as Profile | null)) {
    const { data: settings } = await supabase.from('user_settings').select('theme').eq('user_id', userId).maybeSingle();
    const theme = settings?.theme;
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      const { useThemeStore } = await import('@/stores/themeStore');
      useThemeStore.getState().setPreference(theme);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const setReady = useAuthStore((state) => state.setReady);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let active = true;

    async function handleAuthUrl(url: string | null) {
      if (!active || !url || !isAuthCallbackUrl(url)) return;
      const result = await createSessionFromUrl(url);
      if (!active) return;
      if (result.session) {
        setPendingSignupEmail(null);
        router.replace('/');
      }
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadAccount(data.session.user.id);
      setReady(true);
      // Cold start via confirmation link.
      void Linking.getInitialURL().then((url) => void handleAuthUrl(url));
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        setPendingSignupEmail(null);
        void loadAccount(session.user.id);
      } else {
        useAuthStore.getState().setProfile(null);
        useAuthStore.getState().setStaff(false);
        if (event === 'SIGNED_OUT') setPendingSignupEmail(null);
      }
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleAuthUrl(url);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, [setReady, setSession]);

  return children;
}

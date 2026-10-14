import { I18nManager, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { isRtlLocale, useI18nStore, useT, type I18nKey, type Locale } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';

const LOCALES: { id: Locale; native: string; detail: I18nKey }[] = [
  { id: 'tr', native: 'Türkçe', detail: 'langTurkishDetail' },
  { id: 'en', native: 'English', detail: 'langEnglishDetail' },
  { id: 'ar', native: 'العربية', detail: 'langArabicDetail' },
];

export default function LanguageScreen() {
  const locale = useI18nStore((state) => state.locale);
  const setLocale = useI18nStore((state) => state.setLocale);
  const t = useT();
  const { colors } = useTheme();
  const userId = useAuthStore((state) => state.session?.user.id);

  function choose(next: Locale) {
    setLocale(next);
    const rtl = isRtlLocale(next);
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
    if (userId) void requireSupabase().from('profiles').update({ language: next }).eq('id', userId);
  }

  return (
    <Screen scroll>
      <AppHeader title={t('language')} subtitle={t('languageHint')} />
      {LOCALES.map((item) => {
        const active = locale === item.id;
        return (
          <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => choose(item.id)}>
            <AppCard style={{ borderColor: active ? colors.primary : colors.border, borderWidth: active ? 1.5 : undefined }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', writingDirection: item.id === 'ar' ? 'rtl' : 'ltr' }}>{item.native}</Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t(item.detail)}</Text>
                </View>
                {active ? (
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{t('selected')}</Text>
                  </View>
                ) : null}
              </View>
            </AppCard>
          </Pressable>
        );
      })}
    </Screen>
  );
}

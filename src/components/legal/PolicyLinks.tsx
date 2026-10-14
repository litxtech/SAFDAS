import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { REQUIRED_POLICIES } from '@/content/policies';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

export function openPolicy(slug: string) {
  router.push({ pathname: '/legal/[slug]', params: { slug } });
}

export function PolicyLinks() {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('policies')}</Text>
      {REQUIRED_POLICIES.map((policy) => (
        <Pressable key={policy.slug} accessibilityRole="link" onPress={() => openPolicy(policy.slug)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' }}>{t(policy.label)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function PolicyConsents({
  values,
  onChange,
}: {
  values: Record<(typeof REQUIRED_POLICIES)[number]['slug'], boolean>;
  onChange: (slug: (typeof REQUIRED_POLICIES)[number]['slug'], value: boolean) => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.textSecondary }}>{t('requiredPolicies')}</Text>
      {REQUIRED_POLICIES.map((policy) => (
        <View key={policy.slug} style={{ gap: 4 }}>
          <AppSwitch label={t(policy.accept)} value={values[policy.slug]} onValueChange={(value) => onChange(policy.slug, value)} />
          <Pressable accessibilityRole="link" onPress={() => openPolicy(policy.slug)} style={{ minHeight: 36, justifyContent: 'center' }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('readPolicy')} · {t(policy.label)}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
